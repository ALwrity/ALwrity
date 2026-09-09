"""YouTube Analytics API v2 helpers for channel Overview reports.

Used only by YouTubeAnalyticsService. Not a second API client.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

CHANNEL_WINDOW_METRICS = (
    "views,estimatedMinutesWatched,averageViewDuration,"
    "subscribersGained,subscribersLost"
)
DAY_SERIES_METRICS = (
    "views,estimatedMinutesWatched,subscribersGained,subscribersLost"
)
VIDEO_TOP_METRICS_WITH_PERCENT = (
    "views,averageViewDuration,averageViewPercentage"
)
VIDEO_TOP_METRICS = "views,averageViewDuration"
VIDEO_REPORT_MAX_RESULTS = 10


def analytics_error_kind(exc: BaseException) -> str:
    return type(exc).__name__


def overview_window_bounds(days: int) -> Tuple[date, date]:
    from services.youtube.youtube_analytics_overview_window import rolling_bounds

    return rolling_bounds(days, date.today())


def previous_window_bounds(current_start: date, days: int) -> Tuple[date, date]:
    from services.youtube.youtube_analytics_overview_window import previous_rolling_bounds

    return previous_rolling_bounds(current_start, days)


def optional_num(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        logger.warning("YouTube channel overview skipped non-numeric metric cell")
        return None


def watch_hours_from_minutes(minutes: Optional[float]) -> Optional[float]:
    if minutes is None:
        return None
    return round(minutes / 60.0, 1)


def subscribers_net(gained: Optional[float], lost: Optional[float]) -> Optional[float]:
    if gained is None and lost is None:
        return None
    return (gained or 0) - (lost or 0)


def parse_window_totals(report: Optional[Dict[str, Any]]) -> Dict[str, Optional[float]]:
    rows = (report or {}).get("rows") or []
    if not rows:
        return {
            "views": 0.0,
            "estimated_minutes_watched": 0.0,
            "average_view_duration_seconds": 0.0,
            "subscribers_gained": 0.0,
            "subscribers_lost": 0.0,
        }
    row = rows[0]
    return {
        "views": optional_num(row[0] if len(row) > 0 else None),
        "estimated_minutes_watched": optional_num(row[1] if len(row) > 1 else None),
        "average_view_duration_seconds": optional_num(row[2] if len(row) > 2 else None),
        "subscribers_gained": optional_num(row[3] if len(row) > 3 else None),
        "subscribers_lost": optional_num(row[4] if len(row) > 4 else None),
    }


def window_payload(totals: Dict[str, Optional[float]]) -> Dict[str, Optional[float]]:
    return {
        "views": totals.get("views"),
        "estimated_minutes_watched": totals.get("estimated_minutes_watched"),
        "watch_hours": watch_hours_from_minutes(
            totals.get("estimated_minutes_watched")
        ),
        "average_view_duration_seconds": totals.get("average_view_duration_seconds"),
        "subscribers_gained": totals.get("subscribers_gained"),
        "subscribers_lost": totals.get("subscribers_lost"),
        "subscribers_net": subscribers_net(
            totals.get("subscribers_gained"),
            totals.get("subscribers_lost"),
        ),
    }


def parse_views_by_day(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    points: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row or len(row) < 2:
            continue
        day = str(row[0] or "").strip()
        if not day:
            continue
        minutes = optional_num(row[2] if len(row) > 2 else None)
        points.append(
            {
                "date": day,
                "views": optional_num(row[1]),
                "watch_hours": watch_hours_from_minutes(minutes),
                "subscribers_net": subscribers_net(
                    optional_num(row[3] if len(row) > 3 else None),
                    optional_num(row[4] if len(row) > 4 else None),
                ),
            }
        )
    points.sort(key=lambda item: item["date"])
    return points


def parse_video_metric_rows(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row:
            continue
        video_id = str(row[0] or "").strip()
        if not video_id:
            continue
        item: Dict[str, Any] = {
            "video_id": video_id,
            "views": optional_num(row[1] if len(row) > 1 else None),
            "average_view_duration_seconds": optional_num(
                row[2] if len(row) > 2 else None
            ),
        }
        if len(row) > 3:
            item["average_view_percentage"] = optional_num(row[3])
        parsed.append(item)
    return parsed


def execute_channel_window(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel overview totals query start={} end={}",
        start.isoformat(),
        end.isoformat(),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            metrics=CHANNEL_WINDOW_METRICS,
        )
        .execute()
    )


def execute_views_by_day(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel overview day query start={} end={} metric_count={}",
        start.isoformat(),
        end.isoformat(),
        len(DAY_SERIES_METRICS.split(",")),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions="day",
            metrics=DAY_SERIES_METRICS,
        )
        .execute()
    )


def execute_top_videos(analytics, start: date, end: date, metrics: str) -> Dict[str, Any]:
    logger.info(
        "YouTube channel overview top query start={} end={} metric_count={}",
        start.isoformat(),
        end.isoformat(),
        len(metrics.split(",")),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions="video",
            metrics=metrics,
            sort="-views",
            maxResults=VIDEO_REPORT_MAX_RESULTS,
        )
        .execute()
    )
