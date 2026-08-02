"""
Clicks and CTR helpers for Unipile LinkedIn post analytics.

Unipile list-posts often includes ``clicks_counter: 0`` without
``clickthrough_rate`` while retrieve-post returns the real creator metrics.
"""

from __future__ import annotations

from typing import Any, Optional

CLICKS_KEYS = ("clicks", "clicks_counter")
CTR_KEYS = ("clickthrough_rate", "clickthrough_rate_counter")
IMPRESSIONS_KEYS = ("impressions", "impressions_counter")


def analytics_dict(item: dict[str, Any]) -> dict[str, Any]:
    raw = item.get("analytics")
    return raw if isinstance(raw, dict) else {}


def first_present(source: dict[str, Any], *keys: str) -> Any:
    """Return the first key that exists (including explicit 0)."""
    for key in keys:
        if key in source and source[key] is not None:
            return source[key]
    return None


def optional_non_negative_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None


def optional_non_negative_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    return parsed


def resolve_impressions(
    item: dict[str, Any], analytics: Optional[dict[str, Any]] = None
) -> int:
    """Impressions from top-level counters or nested analytics."""
    analytics = analytics if analytics is not None else analytics_dict(item)
    for source in (item, analytics):
        for key in ("impressions_counter", *IMPRESSIONS_KEYS):
            val = optional_non_negative_int(source.get(key))
            if val is not None:
                return val
    return 0


def resolve_clicks_raw(
    item: dict[str, Any], analytics: Optional[dict[str, Any]] = None
) -> Any:
    """Raw clicks value from analytics or top-level counter."""
    analytics = analytics if analytics is not None else analytics_dict(item)
    raw = first_present(analytics, *CLICKS_KEYS)
    if raw is None:
        raw = item.get("clicks_counter")
    return raw


def resolve_clicks(item: dict[str, Any], analytics: Optional[dict[str, Any]] = None) -> int:
    return optional_non_negative_int(resolve_clicks_raw(item, analytics)) or 0


def resolve_clickthrough_rate(
    item: dict[str, Any], analytics: Optional[dict[str, Any]] = None
) -> Optional[float]:
    """Normalize Unipile CTR to a 0–1 ratio when possible."""
    analytics = analytics if analytics is not None else analytics_dict(item)
    rate = optional_non_negative_float(first_present(analytics, *CTR_KEYS))
    if rate is None:
        return None
    if rate > 1:
        return round(rate / 100.0, 4)
    return round(rate, 4)


def has_clickthrough_rate(analytics: dict[str, Any]) -> bool:
    return first_present(analytics, *CTR_KEYS) is not None


def clicks_analytics_complete(item: dict[str, Any]) -> bool:
    """
    True when list-post analytics confidently include clicks/CTR.

    A stub ``clicks_counter: 0`` without ``clickthrough_rate`` is treated as
    incomplete so retrieve-post can supply real LinkedIn creator metrics.
    """
    analytics = analytics_dict(item)
    if not analytics:
        return False
    if has_clickthrough_rate(analytics):
        return True

    clicks = resolve_clicks(item, analytics)
    impressions = resolve_impressions(item, analytics)
    if impressions <= 0:
        return first_present(analytics, *CLICKS_KEYS) is not None and clicks > 0
    return clicks > 0


def merge_analytics_prefer_detail(
    base: dict[str, Any], detail: dict[str, Any]
) -> dict[str, Any]:
    """
    Merge retrieve-post analytics onto list analytics.

    Prefer non-zero clicks/CTR from detail when list had 0 or omitted fields.
    """
    merged = {**base, **detail}
    for key in (*CLICKS_KEYS, *CTR_KEYS):
        if key not in detail:
            continue
        detail_val = detail[key]
        if detail_val is None:
            continue
        base_val = base.get(key)
        if base_val in (None, 0) and detail_val not in (None, 0):
            merged[key] = detail_val
        elif key in CTR_KEYS and base_val is None:
            merged[key] = detail_val
    return merged


def derive_clickthrough_rate(
    clicks: int, impressions: int, provider_rate: Optional[float]
) -> Optional[float]:
    """Use provider CTR when present; else derive only when clicks > 0.

    Personal LinkedIn posts often omit clicks entirely; do not invent CTR=0
    from impressions alone (misleading vs LinkedIn company-page analytics).
    """
    if provider_rate is not None:
        return provider_rate
    if impressions <= 0 or clicks <= 0:
        return None
    return round(clicks / impressions, 4)
