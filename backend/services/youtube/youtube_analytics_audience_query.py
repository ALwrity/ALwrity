"""YouTube Analytics API v2 helpers for channel Audience reports.

Independent queries: demographics, geography, subscribed status, device type.
Used by youtube_analytics_audience. Not a second API client.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from loguru import logger

from services.youtube.youtube_analytics_overview_query import (
    optional_num,
    watch_hours_from_minutes,
)

DEMOGRAPHICS_DIMENSIONS = "ageGroup,gender"
DEMOGRAPHICS_METRICS = "viewerPercentage"
GEO_DIMENSIONS = "country"
GEO_METRICS = "views,estimatedMinutesWatched"
SUBSCRIBED_DIMENSIONS = "subscribedStatus"
SUBSCRIBED_METRICS = "views,estimatedMinutesWatched"
DEVICE_DIMENSIONS = "deviceType"
DEVICE_METRICS = "views,estimatedMinutesWatched"
COUNTRY_TOP_N = 10
UNKNOWN_COUNTRY_CODE = "ZZ"
UNKNOWN_COUNTRY_LABEL = "Unknown country"


def country_label(code: str) -> str:
    if str(code or "").strip().upper() == UNKNOWN_COUNTRY_CODE:
        return UNKNOWN_COUNTRY_LABEL
    return str(code or "").strip()


def parse_demographics(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row or len(row) < 3:
            continue
        age_group = str(row[0] or "").strip()
        gender = str(row[1] or "").strip()
        percent = optional_num(row[2])
        if not age_group or not gender or percent is None:
            continue
        parsed.append(
            {
                "age_group": age_group,
                "gender": gender,
                "viewer_percentage": percent,
            }
        )
    return parsed


def parse_countries(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row or len(row) < 2:
            continue
        code = str(row[0] or "").strip()
        if not code:
            continue
        views = optional_num(row[1])
        minutes = optional_num(row[2] if len(row) > 2 else None)
        parsed.append(
            {
                "country": code,
                "label": country_label(code),
                "views": views,
                "watch_hours": watch_hours_from_minutes(minutes),
            }
        )
    parsed.sort(key=lambda item: item.get("views") or 0, reverse=True)
    return parsed[:COUNTRY_TOP_N]


def parse_subscribed(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row or len(row) < 2:
            continue
        status = str(row[0] or "").strip()
        if not status:
            continue
        views = optional_num(row[1])
        minutes = optional_num(row[2] if len(row) > 2 else None)
        parsed.append(
            {
                "status": status,
                "views": views,
                "watch_hours": watch_hours_from_minutes(minutes),
            }
        )
    return parsed


def parse_devices(report: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    parsed: List[Dict[str, Any]] = []
    for row in (report or {}).get("rows") or []:
        if not row or len(row) < 2:
            continue
        device_type = str(row[0] or "").strip()
        if not device_type:
            continue
        views = optional_num(row[1])
        minutes = optional_num(row[2] if len(row) > 2 else None)
        parsed.append(
            {
                "device_type": device_type,
                "views": views,
                "watch_hours": watch_hours_from_minutes(minutes),
                "minutes": minutes or 0.0,
            }
        )
    parsed.sort(key=lambda item: item.get("minutes") or 0, reverse=True)
    total_minutes = sum(item.get("minutes") or 0 for item in parsed)
    result: List[Dict[str, Any]] = []
    assigned = 0.0
    last_index = len(parsed) - 1
    for index, item in enumerate(parsed):
        minutes = item.get("minutes") or 0.0
        if total_minutes <= 0:
            share = 0.0
        elif index == last_index:
            share = round(100.0 - assigned, 1)
        else:
            share = round(100.0 * minutes / total_minutes, 1)
            assigned += share
        result.append(
            {
                "device_type": item["device_type"],
                "views": item["views"],
                "watch_hours": item["watch_hours"],
                "watch_share_percent": share,
            }
        )
    return result


def execute_demographics(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel audience demographics query start={} end={}",
        start.isoformat(),
        end.isoformat(),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions=DEMOGRAPHICS_DIMENSIONS,
            metrics=DEMOGRAPHICS_METRICS,
        )
        .execute()
    )


def execute_countries(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel audience countries query start={} end={}",
        start.isoformat(),
        end.isoformat(),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions=GEO_DIMENSIONS,
            metrics=GEO_METRICS,
        )
        .execute()
    )


def execute_subscribed(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel audience subscribed query start={} end={}",
        start.isoformat(),
        end.isoformat(),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions=SUBSCRIBED_DIMENSIONS,
            metrics=SUBSCRIBED_METRICS,
        )
        .execute()
    )


def execute_devices(analytics, start: date, end: date) -> Dict[str, Any]:
    logger.info(
        "YouTube channel audience devices query start={} end={}",
        start.isoformat(),
        end.isoformat(),
    )
    return (
        analytics.reports()
        .query(
            ids="channel==MINE",
            startDate=start.isoformat(),
            endDate=end.isoformat(),
            dimensions=DEVICE_DIMENSIONS,
            metrics=DEVICE_METRICS,
        )
        .execute()
    )
