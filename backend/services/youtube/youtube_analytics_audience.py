"""Load channel Audience reports for Video Analytics.

Three independent Analytics queries. One failure does not invent metrics
for the others. Window math matches Overview.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.youtube.youtube_analytics_audience_query import (
    execute_countries,
    execute_demographics,
    execute_subscribed,
    parse_countries,
    parse_demographics,
    parse_subscribed,
)
from services.youtube.youtube_analytics_overview_query import analytics_error_kind
from services.youtube.youtube_analytics_overview_window import (
    OverviewWindowError,
    lifetime_bounds,
    resolve_overview_query,
)
from services.youtube.youtube_oauth_service import YouTubeOAuthService

DEMO_UNAVAILABLE = "Audience demographics are unavailable for this window."
DEMO_EMPTY = "No demographic data in this period."
COUNTRIES_UNAVAILABLE = "Audience countries are unavailable for this window."
COUNTRIES_EMPTY = "No country data in this period."
SUBSCRIBED_UNAVAILABLE = "Audience subscriber split is unavailable for this window."
SUBSCRIBED_EMPTY = "No subscribed-viewer data in this period."


def _section(rows: List[Dict[str, Any]], empty_message: str) -> Dict[str, Any]:
    if not rows:
        return {"available": True, "rows": [], "message": empty_message}
    return {"available": True, "rows": rows, "message": None}


def _failed_section(message: str) -> Dict[str, Any]:
    return {"available": False, "rows": [], "message": message}


def load_channel_audience(
    oauth_service: YouTubeOAuthService,
    user_id: str,
    *,
    days: Optional[int] = None,
    token_id: Optional[int] = None,
    window: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, Any]:
    today = date.today()
    logger.info(
        "YouTube channel audience start window={} has_days={} has_dates={}",
        window,
        days is not None,
        start_date is not None and end_date is not None,
    )
    resolved = resolve_overview_query(
        window=window,
        days=days,
        start_date=start_date,
        end_date=end_date,
        today=today,
    )
    try:
        creds = oauth_service.get_valid_credentials(user_id, token_id)
        if not creds:
            logger.warning("YouTube channel audience not connected")
            return {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube to load channel audience.",
            }

        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        channel = youtube.channels().list(
            part="snippet,statistics,contentDetails",
            mine=True,
        ).execute()
        items = channel.get("items") or []
        if not items:
            logger.warning("YouTube channel audience no channel")
            return {
                "success": False,
                "error_code": "no_channel",
                "message": "No YouTube channel found for this account.",
            }

        snippet = items[0].get("snippet") or {}
        published_at = snippet.get("publishedAt")
        if resolved.get("needs_published_at"):
            try:
                start, end = lifetime_bounds(published_at, today)
            except OverviewWindowError as exc:
                logger.warning("YouTube channel audience lifetime unavailable")
                return {
                    "success": False,
                    "error_code": exc.error_code,
                    "message": exc.message,
                }
        else:
            start = resolved["start"]
            end = resolved["end"]

        analytics = build(
            "youtubeAnalytics", "v2", credentials=creds, cache_discovery=False
        )
        demographics = _load_demographics(analytics, start, end)
        countries = _load_countries(analytics, start, end)
        subscribed = _load_subscribed(analytics, start, end)
        logger.info(
            "YouTube channel audience complete kind={} demo_rows={} country_rows={} sub_rows={}",
            resolved.get("kind"),
            len(demographics.get("rows") or []),
            len(countries.get("rows") or []),
            len(subscribed.get("rows") or []),
        )
        return {
            "success": True,
            "window_kind": resolved.get("kind"),
            "window_days": resolved.get("window_days"),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "published_at": published_at,
            "demographics": demographics,
            "countries": countries,
            "subscribed": subscribed,
            "message": "Channel audience loaded.",
        }
    except OverviewWindowError:
        raise
    except Exception as exc:
        logger.warning(
            "YouTube channel audience failed kind={}",
            analytics_error_kind(exc),
        )
        return {
            "success": False,
            "error_code": "analytics_unavailable",
            "message": "Channel audience is unavailable for this window.",
        }


def _load_demographics(analytics, start: date, end: date) -> Dict[str, Any]:
    try:
        report = execute_demographics(analytics, start, end)
        section = _section(parse_demographics(report), DEMO_EMPTY)
        logger.info(
            "YouTube channel audience demographics complete rows={}",
            len(section.get("rows") or []),
        )
        return section
    except Exception as exc:
        logger.warning(
            "YouTube channel audience demographics skipped kind={}",
            analytics_error_kind(exc),
        )
        return _failed_section(DEMO_UNAVAILABLE)


def _load_countries(analytics, start: date, end: date) -> Dict[str, Any]:
    try:
        report = execute_countries(analytics, start, end)
        section = _section(parse_countries(report), COUNTRIES_EMPTY)
        logger.info(
            "YouTube channel audience countries complete rows={}",
            len(section.get("rows") or []),
        )
        return section
    except Exception as exc:
        logger.warning(
            "YouTube channel audience countries skipped kind={}",
            analytics_error_kind(exc),
        )
        return _failed_section(COUNTRIES_UNAVAILABLE)


def _load_subscribed(analytics, start: date, end: date) -> Dict[str, Any]:
    try:
        report = execute_subscribed(analytics, start, end)
        section = _section(parse_subscribed(report), SUBSCRIBED_EMPTY)
        logger.info(
            "YouTube channel audience subscribed complete rows={}",
            len(section.get("rows") or []),
        )
        return section
    except Exception as exc:
        logger.warning(
            "YouTube channel audience subscribed skipped kind={}",
            analytics_error_kind(exc),
        )
        return _failed_section(SUBSCRIBED_UNAVAILABLE)
