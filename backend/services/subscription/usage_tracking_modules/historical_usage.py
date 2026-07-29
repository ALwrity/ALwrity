"""
Historical usage aggregation functions.
Extracted from usage_tracking_service.py for better maintainability.
"""

from typing import Dict, Any
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

from models.subscription_models import UsageSummary, UsageStatus


# Shared provider mapping: DB column → frontend key
PROVIDER_MAPPING = {
    'gemini_calls': 'gemini',
    'openai_calls': 'openai',
    'anthropic_calls': 'anthropic',
    'mistral_calls': 'huggingface',  # HuggingFace stored as mistral
    'wavespeed_calls': 'wavespeed',
    'exa_calls': 'exa',
    'tavily_calls': 'tavily',
    'serper_calls': 'serper',
    'firecrawl_calls': 'firecrawl',
    'metaphor_calls': 'metaphor',
    'stability_calls': 'stability',
    'video_calls': 'video',
    'image_edit_calls': 'image_edit',
    'audio_calls': 'audio',
}


def _build_provider_breakdown(summaries: list, mapping: dict) -> dict:
    """Build provider_breakdown dict from a list of UsageSummary records."""
    breakdown = {}
    for db_col, frontend_key in mapping.items():
        total = sum(getattr(s, db_col, 0) or 0 for s in summaries)
        breakdown[frontend_key] = {'calls': total, 'cost': 0, 'tokens': 0}
    return breakdown


def _build_usage_percentages(provider_breakdown: dict, limits: dict) -> dict:
    """Build usage_percentages dict from provider_breakdown and per-period limits."""
    pcts = {}
    if not limits or not limits.get('limits'):
        return pcts

    limit_map = {
        'gemini_calls': ('gemini', 'gemini_calls'),
        'huggingface_calls': ('huggingface', 'mistral_calls'),
        'stability_calls': ('stability', 'stability_calls'),
        'video_calls': ('video', 'video_calls'),
        'audio_calls': ('audio', 'audio_calls'),
        'image_edit_calls': ('image_edit', 'image_edit_calls'),
        'wavespeed_calls': ('wavespeed', 'wavespeed_calls'),
        'tavily_calls': ('tavily', 'tavily_calls'),
        'serper_calls': ('serper', 'serper_calls'),
        'firecrawl_calls': ('firecrawl', 'firecrawl_calls'),
        'metaphor_calls': ('metaphor', 'metaphor_calls'),
        'exa_calls': ('exa', 'exa_calls'),
    }

    for pct_key, (bk_key, limit_key) in limit_map.items():
        used = provider_breakdown.get(bk_key, {}).get('calls', 0)
        limit_val = limits.get('limits', {}).get(limit_key, 0) or 0
        if limit_val > 0:
            pcts[pct_key] = (used / limit_val) * 100

    # Cost percentage
    total_cost = provider_breakdown.get('total_cost', 0)
    cost_limit = limits.get('limits', {}).get('monthly_cost', 0) or 0
    if cost_limit > 0:
        pcts['cost'] = (total_cost / cost_limit) * 100

    return pcts


def _summaries_usage_status(summaries: list) -> str:
    """Derive overall usage_status from a list of summaries."""
    status = 'active'
    for s in summaries:
        try:
            st = s.usage_status.value
        except Exception:
            st = 'active'
        if st == 'limit_reached':
            return 'limit_reached'
        if st == 'warning' and status != 'limit_reached':
            status = 'warning'
    return status


def _empty_usage_response(billing_period: str, limits: dict) -> Dict[str, Any]:
    """Return a zeroed UsageStats-shaped response."""
    return {
        'billing_period': billing_period,
        'usage_status': 'active',
        'total_calls': 0,
        'total_tokens': 0,
        'total_cost': 0.0,
        'avg_response_time': 0.0,
        'error_rate': 0.0,
        'limits': limits,
        'provider_breakdown': {},
        'usage_percentages': {},
        'historical_breakdown': [],
        'last_updated': datetime.now().isoformat()
    }


def get_all_historical_usage(user_id: str, db: Session, pricing_service) -> Dict[str, Any]:
    """Get ALL historical usage data aggregated across all billing periods."""
    all_summaries = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id
    ).order_by(UsageSummary.billing_period.desc()).all()

    limits = pricing_service.get_user_limits(user_id)

    if not all_summaries:
        return _empty_usage_response('all', limits)

    # Aggregate
    total_calls = sum(s.total_calls or 0 for s in all_summaries)
    total_tokens = sum(s.total_tokens or 0 for s in all_summaries)
    total_cost = sum(float(s.total_cost or 0) for s in all_summaries)

    total_weighted_time = sum((s.avg_response_time or 0) * (s.total_calls or 0) for s in all_summaries)
    avg_response_time = total_weighted_time / total_calls if total_calls > 0 else 0.0

    total_errors = sum((s.total_calls or 0) * (s.error_rate or 0) / 100 for s in all_summaries)
    error_rate = (total_errors / total_calls * 100) if total_calls > 0 else 0.0

    provider_breakdown = _build_provider_breakdown(all_summaries, PROVIDER_MAPPING)

    # Historical breakdown per period
    historical_breakdown = []
    for s in all_summaries:
        try:
            status_val = s.usage_status.value
        except Exception:
            status_val = 'active'
        historical_breakdown.append({
            'billing_period': s.billing_period,
            'total_calls': s.total_calls or 0,
            'total_tokens': s.total_tokens or 0,
            'total_cost': float(s.total_cost or 0),
            'usage_status': status_val,
            'updated_at': s.updated_at.isoformat() if s.updated_at else None
        })

    return {
        'billing_period': 'all',
        'usage_status': _summaries_usage_status(all_summaries),
        'total_calls': total_calls,
        'total_tokens': total_tokens,
        'total_cost': round(total_cost, 2),
        'avg_response_time': round(avg_response_time, 2),
        'error_rate': round(error_rate, 2),
        'limits': limits,
        'provider_breakdown': provider_breakdown,
        'usage_percentages': {},  # misleading for all-time vs per-period limits
        'historical_breakdown': historical_breakdown,
        'last_updated': datetime.now().isoformat()
    }


def get_current_period_usage(user_id: str, db: Session, pricing_service) -> Dict[str, Any]:
    """Get current billing period usage data with correct per-period limit percentages.

    Returns a UsageStats-shaped dict with provider_breakdown and usage_percentages
    computed against the plan's per-period limits.
    """
    current_period = pricing_service.get_current_billing_period(user_id)
    limits = pricing_service.get_user_limits(user_id)

    summary = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id,
        UsageSummary.billing_period == current_period
    ).first()

    if not summary:
        result = _empty_usage_response(current_period, limits)
        result['usage_percentages'] = _build_usage_percentages({}, limits)
        return result

    provider_breakdown = _build_provider_breakdown([summary], PROVIDER_MAPPING)

    usage_percentages = _build_usage_percentages(provider_breakdown, limits)

    try:
        status_val = summary.usage_status.value
    except Exception:
        status_val = 'active'

    return {
        'billing_period': current_period,
        'usage_status': status_val,
        'total_calls': summary.total_calls or 0,
        'total_tokens': summary.total_tokens or 0,
        'total_cost': round(float(summary.total_cost or 0), 2),
        'avg_response_time': summary.avg_response_time or 0.0,
        'error_rate': summary.error_rate or 0.0,
        'limits': limits,
        'provider_breakdown': provider_breakdown,
        'usage_percentages': usage_percentages,
        'historical_breakdown': [],
        'last_updated': datetime.now().isoformat()
    }


def get_usage_for_period(user_id: str, billing_period: str, db: Session, pricing_service) -> Dict[str, Any]:
    """Get usage data for a specific billing period.

    Returns a UsageStats-shaped dict with that period's provider_breakdown
    and usage_percentages computed against plan limits.
    """
    limits = pricing_service.get_user_limits(user_id)

    summary = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id,
        UsageSummary.billing_period == billing_period
    ).first()

    if not summary:
        result = _empty_usage_response(billing_period, limits)
        result['usage_percentages'] = _build_usage_percentages({}, limits)
        return result

    provider_breakdown = _build_provider_breakdown([summary], PROVIDER_MAPPING)
    usage_percentages = _build_usage_percentages(provider_breakdown, limits)

    try:
        status_val = summary.usage_status.value
    except Exception:
        status_val = 'active'

    return {
        'billing_period': billing_period,
        'usage_status': status_val,
        'total_calls': summary.total_calls or 0,
        'total_tokens': summary.total_tokens or 0,
        'total_cost': round(float(summary.total_cost or 0), 2),
        'avg_response_time': summary.avg_response_time or 0.0,
        'error_rate': summary.error_rate or 0.0,
        'limits': limits,
        'provider_breakdown': provider_breakdown,
        'usage_percentages': usage_percentages,
        'historical_breakdown': [],
        'last_updated': datetime.now().isoformat()
    }
