"""Resolve Video Analytics Overview date windows.

Rolling, calendar year/month, custom, and lifetime. Lifetime start is the
channel published date from the Data API — never a hardcoded 2005 date.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional, Tuple

MAX_ROLLING_DAYS = 365
DEFAULT_ROLLING_DAYS = 28
ROLLING_BY_WINDOW = {
    "last_7": 7,
    "last_28": 28,
    "last_90": 90,
    "last_365": 365,
}


class OverviewWindowError(ValueError):
    def __init__(self, message: str, error_code: str = "window_invalid"):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


def rolling_bounds(days: int, today: date) -> Tuple[date, date]:
    span = max(1, min(int(days), MAX_ROLLING_DAYS))
    return today - timedelta(days=span), today


def previous_rolling_bounds(current_start: date, days: int) -> Tuple[date, date]:
    span = max(1, min(int(days), MAX_ROLLING_DAYS))
    prev_end = current_start - timedelta(days=1)
    return prev_end - timedelta(days=span), prev_end


def year_bounds(year: int, today: date) -> Tuple[date, date]:
    start = date(int(year), 1, 1)
    end = min(today, date(int(year), 12, 31))
    if start > end:
        raise OverviewWindowError("Calendar year is not available yet.")
    return start, end


def previous_year_ytd_bounds(start: date, end: date) -> Tuple[date, date]:
    prev_start = date(start.year - 1, 1, 1)
    try:
        prev_end = date(end.year - 1, end.month, end.day)
    except ValueError:
        prev_end = date(end.year - 1, 2, 28)
    return prev_start, prev_end


def month_bounds(year: int, month: int, today: date) -> Tuple[date, date]:
    start = date(int(year), int(month), 1)
    if month == 12:
        last = date(int(year), 12, 31)
    else:
        last = date(int(year), int(month) + 1, 1) - timedelta(days=1)
    end = min(today, last)
    if start > end:
        raise OverviewWindowError("Calendar month is not available yet.")
    return start, end


def previous_month_bounds(current_start: date) -> Tuple[date, date]:
    last = current_start - timedelta(days=1)
    prev_start = date(last.year, last.month, 1)
    return prev_start, last


def _parse_published_at(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            return None


def lifetime_bounds(published_at: Any, today: date) -> Tuple[date, date]:
    start = _parse_published_at(published_at)
    if start is None:
        raise OverviewWindowError(
            "Channel overview is unavailable for this window.",
            error_code="analytics_unavailable",
        )
    if start > today:
        start = today
    return start, today


def _inclusive_span_days(start: date, end: date) -> int:
    return (end - start).days


def resolve_overview_query(
    *,
    window: Optional[str],
    days: Optional[int],
    start_date: Optional[date],
    end_date: Optional[date],
    today: date,
) -> Dict[str, Any]:
    """Validate router params and return window metadata. Lifetime needs publishedAt later."""
    kind = (window or "").strip().lower() or None
    has_dates = start_date is not None or end_date is not None
    if days is not None and has_dates:
        raise OverviewWindowError("Use either a rolling window or custom dates, not both.")
    if kind == "lifetime":
        if days is not None or has_dates:
            raise OverviewWindowError("Lifetime does not accept days or custom dates.")
        return {
            "kind": "lifetime",
            "needs_published_at": True,
            "compare": False,
            "window_days": None,
        }
    if kind == "calendar" or (has_dates and kind is None):
        if start_date is None or end_date is None:
            raise OverviewWindowError("Custom range requires start_date and end_date.")
        if end_date > today or start_date > end_date:
            raise OverviewWindowError("Custom range must end today or earlier.")
        if _inclusive_span_days(start_date, end_date) > MAX_ROLLING_DAYS:
            raise OverviewWindowError("Custom range cannot exceed 365 days.")
        span = _inclusive_span_days(start_date, end_date)
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span)
        return {
            "kind": "calendar",
            "needs_published_at": False,
            "compare": True,
            "window_days": None,
            "start": start_date,
            "end": end_date,
            "prev_start": prev_start,
            "prev_end": prev_end,
        }
    if kind in ROLLING_BY_WINDOW:
        rolling_days = ROLLING_BY_WINDOW[kind]
        if days is not None and int(days) != rolling_days:
            raise OverviewWindowError("Rolling window does not match days.")
        start, end = rolling_bounds(rolling_days, today)
        prev_start, prev_end = previous_rolling_bounds(start, rolling_days)
        return {
            "kind": kind,
            "needs_published_at": False,
            "compare": True,
            "window_days": rolling_days,
            "start": start,
            "end": end,
            "prev_start": prev_start,
            "prev_end": prev_end,
        }
    if kind:
        raise OverviewWindowError("Unsupported analytics window.")
    rolling_days = DEFAULT_ROLLING_DAYS if days is None else int(days)
    if rolling_days < 1 or rolling_days > MAX_ROLLING_DAYS:
        raise OverviewWindowError("Rolling window must be between 1 and 365 days.")
    start, end = rolling_bounds(rolling_days, today)
    prev_start, prev_end = previous_rolling_bounds(start, rolling_days)
    kind_name = f"last_{rolling_days}" if rolling_days in {7, 28, 90, 365} else "last_n"
    return {
        "kind": kind_name,
        "needs_published_at": False,
        "compare": True,
        "window_days": rolling_days,
        "start": start,
        "end": end,
        "prev_start": prev_start,
        "prev_end": prev_end,
    }
