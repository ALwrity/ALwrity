"""Map Search filters UPLOAD DATE buckets to Search.list publishedAfter.

Search.list has no Today/This week enum. Calendar starts are computed in the
viewer's IANA time zone, then emitted as RFC 3339 UTC for Google.

Missing or invalid time zones fall back to UTC — never a hardcoded city.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from loguru import logger

_UPLOAD_DATE_IDS = frozenset({"today", "week", "month", "year"})


def _youtube_search_utc_now() -> datetime:
    """Clock seam for Upload Date tests. Always timezone-aware UTC."""
    return datetime.now(timezone.utc)


def _resolve_search_time_zone(time_zone: Optional[str]):
    """Return an IANA zone or UTC. Do not map abbreviations like IST."""
    raw = (time_zone or "").strip()
    if not raw or raw.upper() == "UTC":
        if not raw:
            logger.info("YouTube search upload_date time_zone missing, using UTC")
        return timezone.utc
    try:
        resolved = ZoneInfo(raw)
        logger.info("YouTube search upload_date time_zone resolved time_zone={}", raw)
        return resolved
    except (ZoneInfoNotFoundError, KeyError, ValueError, TypeError) as exc:
        logger.warning(
            "YouTube search upload_date invalid time_zone={} using UTC error={}",
            raw,
            type(exc).__name__,
        )
        return timezone.utc


def published_after_for_upload_date(
    upload_date: Optional[str],
    now: datetime,
    time_zone: Optional[str] = None,
) -> Optional[str]:
    """Return RFC 3339 UTC ``publishedAfter``, or None if upload_date is unknown."""
    if not upload_date:
        return None
    if upload_date not in _UPLOAD_DATE_IDS:
        logger.warning(
            "YouTube search ignoring unsupported upload_date={}", upload_date
        )
        return None

    try:
        tz = _resolve_search_time_zone(time_zone)
        aware_now = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
        local = aware_now.astimezone(tz)
        start_local = local.replace(hour=0, minute=0, second=0, microsecond=0)
        if upload_date == "week":
            start_local = start_local - timedelta(days=start_local.isoweekday() - 1)
        elif upload_date == "month":
            start_local = start_local.replace(day=1)
        elif upload_date == "year":
            start_local = start_local.replace(month=1, day=1)

        start_utc = start_local.astimezone(timezone.utc)
        published_after = start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        logger.info(
            "YouTube search upload_date mapped upload_date={} time_zone={} "
            "published_after={}",
            upload_date,
            time_zone or "UTC",
            published_after,
        )
        return published_after
    except Exception:
        logger.exception(
            "YouTube search upload_date mapping failed upload_date={} time_zone={}",
            upload_date,
            time_zone,
        )
        return None
