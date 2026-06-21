"""
Normalize Zernio LinkedIn aggregate analytics payloads for the landing UI.
"""

from __future__ import annotations

from typing import Any, Optional

# Request metrics (Zernio API names) — aligned with standalone CLI schemas.
PERSONAL_DEFAULT_METRICS: tuple[str, ...] = (
    "IMPRESSION",
    "MEMBERS_REACHED",
    "REACTION",
    "COMMENT",
    "RESHARE",
    "POST_SAVE",
    "POST_SEND",
)

ORG_DEFAULT_LANDING_METRICS: tuple[str, ...] = (
    "impressions",
    "unique_impressions",
    "clicks",
    "likes",
    "comments",
    "shares",
    "engagement_rate",
    "organic_followers_gained",
)

# Normalized personal keys returned to the frontend.
PERSONAL_ANALYTICS_KEYS: tuple[str, ...] = (
    "impressions",
    "reach",
    "reactions",
    "comments",
    "shares",
    "saves",
    "sends",
    "engagementRate",
)


def normalize_personal_aggregate(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Flatten Zernio personal aggregate response ``analytics`` block.

    Sample source: docs/linkedin/.../outputs/linkedin_profile_analytics_total.json
    """
    analytics = raw.get("analytics")
    if not isinstance(analytics, dict):
        return {}

    result: dict[str, Any] = {}
    for key in PERSONAL_ANALYTICS_KEYS:
        if key in analytics:
            result[key] = analytics[key]

    return result


def normalize_org_aggregate(
    raw: dict[str, Any],
    *,
    metric_keys: Optional[tuple[str, ...]] = None,
) -> dict[str, Any]:
    """
    Flatten Zernio org aggregate ``metrics.{key}.total`` values.

    Sample source: docs/linkedin/.../outputs/linkedin_org_analytics.json
    """
    metrics_block = raw.get("metrics")
    if not isinstance(metrics_block, dict):
        return {}

    keys = metric_keys or ORG_DEFAULT_LANDING_METRICS
    result: dict[str, Any] = {}
    for key in keys:
        entry = metrics_block.get(key)
        if not isinstance(entry, dict):
            continue
        if "total" in entry:
            result[key] = entry["total"]

    return result


def org_data_delay_note(raw: dict[str, Any]) -> Optional[str]:
    """Extract Zernio data delay disclaimer when present."""
    note = raw.get("dataDelay")
    if isinstance(note, str) and note.strip():
        return note.strip()
    return None
