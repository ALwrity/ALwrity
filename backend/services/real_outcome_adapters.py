"""Adapters for provider-backed marketing outcomes.

Provider failures are represented as unavailable results. This module never
turns predictions or missing data into measured outcomes.
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional


def _gsc_metrics(payload: Dict[str, Any]) -> Dict[str, Optional[float]]:
    rows = ((payload.get("overall_metrics") or {}).get("rows") or [])
    clicks = impressions = 0.0
    position_weight = 0.0
    position_weight_total = 0.0
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_clicks = float(row.get("clicks") or 0)
        row_impressions = float(row.get("impressions") or 0)
        clicks += row_clicks
        impressions += row_impressions
        if row.get("position") is not None and row_impressions:
            position_weight += float(row["position"]) * row_impressions
            position_weight_total += row_impressions
    return {
        "clicks": clicks,
        "impressions": impressions,
        "ctr": clicks / impressions if impressions else None,
        "position": position_weight / position_weight_total if position_weight_total else None,
    }


async def fetch_gsc_outcomes(user_id: str, db: Any, site_url: str = "") -> Dict[str, Any]:
    try:
        from services.seo.dashboard_service import SEODashboardService

        payload = await SEODashboardService(db).get_gsc_data(user_id, site_url or None)
        if payload.get("error") or payload.get("status") == "disconnected":
            return {
                "status": "unavailable",
                "source": "google_search_console",
                "reason_code": "connect_required" if payload.get("status") == "disconnected" else "provider_error",
                "reason": payload.get("error") or "Google Search Console is not connected",
            }
        return {
            "status": "available",
            "source": "google_search_console",
            "site_url": site_url or None,
            "metrics": _gsc_metrics(payload),
            "date_range": payload.get("date_range") or {},
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "source": "google_search_console",
            "reason_code": "provider_error",
            "reason": str(exc),
        }


def fetch_published_asset_outcomes(user_id: str, db: Any) -> Dict[str, Any]:
    try:
        from models.content_asset_models import AssetSource, AssetType
        from services.content_asset_service import ContentAssetService

        assets, total = ContentAssetService(db).get_user_assets(
            user_id=user_id,
            asset_type=AssetType.TEXT,
            source_module=AssetSource.BLOG_WRITER,
            sort_by="created_at",
            sort_order="desc",
            limit=500,
        )
        published = 0
        for asset in assets:
            tags = asset.tags if isinstance(asset.tags, list) else []
            metadata = asset.asset_metadata if isinstance(asset.asset_metadata, dict) else {}
            if "published" in tags or metadata.get("status") == "published":
                published += 1
        return {
            "status": "available",
            "source": "content_asset_library",
            "total_text_assets": total,
            "published_assets": published,
            "draft_assets": max(0, total - published),
            "metrics": {
                "total_text_assets": total,
                "published_assets": published,
                "draft_assets": max(0, total - published),
            },
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "source": "content_asset_library",
            "reason_code": "provider_error",
            "reason": str(exc),
        }


def fetch_conversion_outcomes(user_id: str, db: Any, days: int = 30) -> Dict[str, Any]:
    """Aggregate authenticated first-party conversion events."""
    try:
        from models.conversion_event_models import ConversionEvent

        since = datetime.utcnow() - timedelta(days=days)
        events = (
            db.query(ConversionEvent)
            .filter(
                ConversionEvent.user_id == user_id,
                ConversionEvent.occurred_at >= since,
            )
            .all()
        )
        counts: Dict[str, int] = {}
        by_dimensions: Dict[str, Dict[str, Dict[str, float]]] = {}
        value_by_currency: Dict[str, float] = {}
        valued_events = 0
        confidence_counts = {"high": 0, "medium": 0, "low": 0}
        for event in events:
            name = str(event.event_name)
            counts[name] = counts.get(name, 0) + 1
            if event.value is not None:
                currency = str(getattr(event, "currency", None) or "unspecified").upper()
                value_by_currency[currency] = value_by_currency.get(currency, 0.0) + float(event.value)
                valued_events += 1
            raw_metadata = getattr(event, "metadata_json", None)
            metadata = raw_metadata if isinstance(raw_metadata, dict) else {}
            lineage = metadata.get("lineage") if isinstance(metadata.get("lineage"), dict) else {}
            dimensions = {
                "agent": getattr(event, "agent_type", None) or lineage.get("agent_type") or metadata.get("agent_type"),
                "recommendation": getattr(event, "recommendation_id", None) or lineage.get("recommendation_id") or metadata.get("recommendation_id"),
                "artifact": getattr(event, "artifact_id", None) or lineage.get("artifact_id") or metadata.get("artifact_id"),
                "published_asset": getattr(event, "published_asset_id", None) or lineage.get("published_asset_id") or metadata.get("published_asset_id"),
                "platform": getattr(event, "platform", None) or lineage.get("platform") or metadata.get("platform"),
                "campaign": getattr(event, "campaign_id", None) or lineage.get("campaign_id") or metadata.get("campaign_id"),
            }
            linked = sum(value not in (None, "", 0) for value in dimensions.values())
            confidence = "high" if linked >= 4 else "medium" if linked else "low"
            confidence_counts[confidence] += 1
            for dimension, value in dimensions.items():
                if value in (None, "", 0):
                    continue
                key = str(value)
                bucket = by_dimensions.setdefault(dimension, {}).setdefault(
                    key, {"count": 0, "value": 0.0}
                )
                bucket["count"] += 1
                if event.value is not None:
                    bucket["value"] += float(event.value)
        for groups in by_dimensions.values():
            for bucket in groups.values():
                bucket["value"] = round(bucket["value"], 4)
        return {
            "status": "available" if events else "unavailable",
            "source": "first_party_conversion_events",
            "reason_code": None if events else "no_data",
            "reason": None if events else "No conversion events recorded",
            "metrics": {
                "total_events": len(events),
                "valued_events": valued_events,
                "total_value": round(next(iter(value_by_currency.values())), 4) if len(value_by_currency) == 1 else None,
            },
            "currency_totals": {
                currency: round(value, 4)
                for currency, value in sorted(value_by_currency.items())
            },
            "events_by_name": counts,
            "by_dimensions": by_dimensions,
            "attribution": {
                "confidence_counts": confidence_counts,
                "fully_attributed": confidence_counts["high"],
                "partially_attributed": confidence_counts["medium"],
                "unattributed": confidence_counts["low"],
                "confidence_basis": "lineage fields present on the conversion event",
            },
            "date_range": {"since": since.isoformat()},
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "source": "first_party_conversion_events",
            "reason_code": "provider_error",
            "reason": str(exc),
        }
async def fetch_linkedin_outcomes(user_id: str, db: Any, days: int = 28) -> Dict[str, Any]:
    try:
        from services.integrations.linkedin.analytics_dates import AnalyticsDateRange
        from services.integrations.linkedin.posts_service import get_posts_service
        from services.integrations.linkedin.unipile_personal_analytics import build_personal_analytics_payload

        end = date.today() - timedelta(days=2)
        start = end - timedelta(days=days)
        payload = await build_personal_analytics_payload(
            user_id,
            AnalyticsDateRange(start=start, end_exclusive=end, label=f"Last {days} days"),
            db=db,
            posts_service=get_posts_service(),
        )
        personal = payload.get("personal") or {}
        analytics = personal.get("analytics") or {}
        if not analytics:
            return {
                "status": "unavailable",
                "source": "linkedin_unipile",
                "reason_code": "no_data",
                "reason": personal.get("error") or "No LinkedIn analytics available",
            }
        return {
            "status": "available",
            "source": "linkedin_unipile",
            "date_range": payload.get("dateRange") or {},
            "metrics": {
                key: analytics.get(key)
                for key in ("reach", "impressions", "engagements", "clicks", "followers_gained", "clickthroughRate")
                if analytics.get(key) is not None
            },
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "source": "linkedin_unipile",
            "reason_code": "connect_required",
            "reason": str(exc),
        }


async def fetch_facebook_outcomes(user_id: str, days: int = 28) -> Dict[str, Any]:
    """Fetch Page Insights when a verified Graph API page token is configured.

    Tokens are intentionally read from deployment configuration only until the
    product has a per-user Facebook OAuth credential store. No predictions are
    returned when configuration is absent.
    """
    token = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "").strip()
    page_id = os.getenv("FACEBOOK_PAGE_ID", "").strip()
    if not token or not page_id:
        return {
            "status": "unavailable",
            "source": "facebook_graph_api",
            "reason_code": "coming_soon",
            "reason": "Facebook Graph Insights requires a configured page connection",
        }

    try:
        import httpx

        until = date.today()
        since = until - timedelta(days=days)
        params = {
            "metric": "page_impressions,page_reach,page_post_engagements",
            "period": "day",
            "since": since.isoformat(),
            "until": until.isoformat(),
            "access_token": token,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://graph.facebook.com/v20.0/{page_id}/insights",
                params=params,
            )
        response.raise_for_status()
        payload = response.json()
        metrics: Dict[str, float] = {}
        for item in payload.get("data", []) if isinstance(payload, dict) else []:
            if not isinstance(item, dict):
                continue
            values = item.get("values") or []
            numeric_values = [
                float(row.get("value"))
                for row in values
                if isinstance(row, dict) and isinstance(row.get("value"), (int, float))
            ]
            if numeric_values:
                metrics[str(item.get("name") or "metric")] = sum(numeric_values)
        return {
            "status": "available" if metrics else "unavailable",
            "source": "facebook_graph_api",
            "reason_code": None if metrics else "no_data",
            "reason": None if metrics else "Facebook returned no Page Insights data",
            "metrics": metrics,
            "date_range": {"since": since.isoformat(), "until": until.isoformat()},
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "source": "facebook_graph_api",
            "reason_code": "provider_error",
            "reason": str(exc),
        }
def unavailable_provider_outcome(
    source: str,
    reason: str,
    reason_code: str = "provider_error",
) -> Dict[str, str]:
    return {
        "status": "unavailable",
        "source": source,
        "reason_code": reason_code,
        "reason": reason,
    }
