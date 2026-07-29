"""Helpers extracted from UsageTrackingService.get_usage_trends."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

from loguru import logger
from sqlalchemy import func

from models.subscription_models import APIProvider, APIUsageLog, UsageStatus, UsageSummary


def _normalize_provider_name(provider_input: Any) -> str | None:
    """Safely extract provider name from enum or string, handling both name and value formats."""
    valid_providers = {'gemini', 'openai', 'anthropic', 'mistral', 'wavespeed', 
                      'tavily', 'serper', 'metaphor', 'firecrawl', 'stability', 
                      'exa', 'video', 'image_edit', 'audio'}
    
    try:
        if hasattr(provider_input, "value"):
            return provider_input.value
        elif isinstance(provider_input, str):
            name = provider_input.lower()
            if "." in name:
                name = name.split(".")[-1].lower()
            return name
        else:
            return str(provider_input).lower()
    except Exception:
        return None


def build_billing_periods(months: int) -> List[str]:
    """Build billing period keys (YYYY-MM) from oldest to newest."""
    end_date = datetime.now()
    periods: List[str] = []
    for i in range(months):
        period_date = end_date - timedelta(days=30 * i)
        periods.append(period_date.strftime("%Y-%m"))
    periods.reverse()
    return periods


def query_usage_summaries(db: Any, user_id: str, periods: List[str]) -> Dict[str, Any]:
    """Load usage summaries for requested periods keyed by billing period."""
    summaries = (
        db.query(UsageSummary)
        .filter(UsageSummary.user_id == user_id, UsageSummary.billing_period.in_(periods))
        .all()
    )
    return {summary.billing_period: summary for summary in summaries}


def self_heal_summaries_from_logs(db: Any, user_id: str, periods: List[str], summary_dict: Dict[str, Any]) -> None:
    """Backfill/create usage summaries from aggregated API usage logs."""
    try:
        from sqlalchemy import cast, String
        
        log_stats = (
            db.query(
                APIUsageLog.billing_period,
                cast(APIUsageLog.provider, String).label("provider"),
                func.count(APIUsageLog.id).label("calls"),
                func.sum(APIUsageLog.cost_total).label("cost"),
                func.sum(APIUsageLog.tokens_total).label("tokens"),
            )
            .filter(APIUsageLog.user_id == user_id, APIUsageLog.billing_period.in_(periods))
            .group_by(APIUsageLog.billing_period, cast(APIUsageLog.provider, String))
            .all()
        )

        log_data_by_period: Dict[str, Dict[str, Dict[str, float | int]]] = {}
        
        for period, provider_str, calls, cost, tokens in log_stats:
            if period not in log_data_by_period:
                log_data_by_period[period] = {}

            provider_name = _normalize_provider_name(provider_str)
            if not provider_name:
                logger.warning(f"[UsageStats] Could not normalize provider: '{provider_str}', skipping")
                continue

            if provider_name not in log_data_by_period[period]:
                log_data_by_period[period][provider_name] = {"calls": 0, "cost": 0.0, "tokens": 0}

            log_data_by_period[period][provider_name]["calls"] += calls or 0
            log_data_by_period[period][provider_name]["cost"] += float(cost or 0.0)
            log_data_by_period[period][provider_name]["tokens"] += tokens or 0

        for period in periods:
            period_logs = log_data_by_period.get(period, {})
            summary = summary_dict.get(period)

            if not summary and period_logs:
                logger.info(f"[UsageStats] Self-healing: Creating missing summary for {period}")
                summary = UsageSummary(
                    user_id=user_id,
                    billing_period=period,
                    usage_status=UsageStatus.ACTIVE,
                    total_calls=0,
                    total_cost=0.0,
                    total_tokens=0,
                )
                db.add(summary)
                summary_dict[period] = summary

            if summary and period_logs:
                total_calls_calc = 0
                total_cost_calc = 0.0
                total_tokens_calc = 0

                for provider_name, data in period_logs.items():
                    total_calls_calc += int(data["calls"])
                    total_cost_calc += float(data["cost"])
                    total_tokens_calc += int(data["tokens"])

                    calls_attr = f"{provider_name}_calls"
                    cost_attr = f"{provider_name}_cost"
                    tokens_attr = f"{provider_name}_tokens"

                    if hasattr(summary, calls_attr):
                        current_val = getattr(summary, calls_attr, 0) or 0
                        if current_val < data["calls"]:
                            setattr(summary, calls_attr, data["calls"])

                    if hasattr(summary, cost_attr):
                        current_val = getattr(summary, cost_attr, 0.0) or 0.0
                        if (float(data["cost"]) - current_val) > 0.000001:
                            setattr(summary, cost_attr, data["cost"])

                    if hasattr(summary, tokens_attr):
                        current_val = getattr(summary, tokens_attr, 0) or 0
                        if current_val < data["tokens"]:
                            setattr(summary, tokens_attr, data["tokens"])

                if (summary.total_cost or 0.0) < total_cost_calc:
                    logger.info(
                        f"[UsageStats] Self-healing cost for {period}: {summary.total_cost} -> {total_cost_calc}"
                    )
                    summary.total_cost = total_cost_calc
                if (summary.total_calls or 0) < total_calls_calc:
                    summary.total_calls = total_calls_calc
                if (summary.total_tokens or 0) < total_tokens_calc:
                    summary.total_tokens = total_tokens_calc

        db.commit()
    except Exception as e:
        logger.error(f"Failed to self-heal usage trends: {e}")
        db.rollback()


def build_usage_trends_response(periods: List[str], summary_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Build trends response payload from summaries."""
    trends = {
        "periods": periods,
        "total_calls": [],
        "total_cost": [],
        "total_tokens": [],
        "provider_trends": {},
    }

    for provider in APIProvider:
        if provider == APIProvider.HUGGINGFACE:
            continue
        provider_name = provider.value
        trends["provider_trends"][provider_name] = {"calls": [], "cost": [], "tokens": []}

    for period in periods:
        summary = summary_dict.get(period)
        if summary:
            trends["total_calls"].append(summary.total_calls or 0)
            trends["total_cost"].append(summary.total_cost or 0.0)
            trends["total_tokens"].append(summary.total_tokens or 0)

            for provider in APIProvider:
                if provider == APIProvider.HUGGINGFACE:
                    continue
                provider_name = provider.value
                trends["provider_trends"][provider_name]["calls"].append(
                    getattr(summary, f"{provider_name}_calls", 0) or 0
                )
                trends["provider_trends"][provider_name]["cost"].append(
                    getattr(summary, f"{provider_name}_cost", 0.0) or 0.0
                )
                trends["provider_trends"][provider_name]["tokens"].append(
                    getattr(summary, f"{provider_name}_tokens", 0) or 0
                )
        else:
            trends["total_calls"].append(0)
            trends["total_cost"].append(0.0)
            trends["total_tokens"].append(0)
            for provider in APIProvider:
                if provider == APIProvider.HUGGINGFACE:
                    continue
                provider_name = provider.value
                trends["provider_trends"][provider_name]["calls"].append(0)
                trends["provider_trends"][provider_name]["cost"].append(0.0)
                trends["provider_trends"][provider_name]["tokens"].append(0)

    return trends
