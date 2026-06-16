"""
LinkedIn analytics date-range helpers.

LinkedIn / Zernio treat the end date as exclusive. The latest two calendar days
are typically incomplete — use DATA_LAG_DAYS when computing ranges.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

DATA_LAG_DAYS = 2
WINDOW_DAYS = 7
DEFAULT_PRESET_DAYS = 7
PRESET_WINDOWS = (7, 14, 28, 90, 365)
MAX_CUSTOM_SPAN_DAYS = 365


class InvalidAnalyticsDateRange(ValueError):
    """User-facing date range validation error."""


@dataclass(frozen=True)
class AnalyticsDateRange:
    """Inclusive start through latest complete day, plus exclusive end for APIs."""

    start: date
    end_exclusive: date
    label: str
    data_lag_days: int = DATA_LAG_DAYS

    @property
    def start_iso(self) -> str:
        return self.start.isoformat()

    @property
    def end_exclusive_iso(self) -> str:
        return self.end_exclusive.isoformat()

    @property
    def latest_complete_day(self) -> date:
        return self.end_exclusive - timedelta(days=1)


def _format_label(start: date, latest_complete: date) -> str:
    """Human-readable range, e.g. 'Jun 6 – Jun 12, 2026'."""
    if start.year == latest_complete.year:
        if start.month == latest_complete.month:
            return (
                f"{start.strftime('%b')} {start.day} – "
                f"{latest_complete.strftime('%b')} {latest_complete.day}, "
                f"{latest_complete.year}"
            )
        return (
            f"{start.strftime('%b %d')} – {latest_complete.strftime('%b %d, %Y')}"
        )
    return (
        f"{start.strftime('%b %d, %Y')} – {latest_complete.strftime('%b %d, %Y')}"
    )


def _latest_complete_day(today: date, *, data_lag_days: int = DATA_LAG_DAYS) -> date:
    return today - timedelta(days=data_lag_days + 1)


def compute_preset_range(
    today: date,
    window_days: int,
    *,
    data_lag_days: int = DATA_LAG_DAYS,
) -> AnalyticsDateRange:
    """
    Rolling last N complete days relative to ``today``.

    Example (today=2026-06-15, window_days=7):
      end_exclusive=2026-06-13, start=2026-06-06, label includes Jun 6 and Jun 12.
    """
    if window_days not in PRESET_WINDOWS:
        raise InvalidAnalyticsDateRange(
            f"Invalid preset window: {window_days}. Use one of {PRESET_WINDOWS}."
        )

    end_exclusive = today - timedelta(days=data_lag_days)
    start = end_exclusive - timedelta(days=window_days)
    latest_complete = end_exclusive - timedelta(days=1)
    label = _format_label(start, latest_complete)
    return AnalyticsDateRange(
        start=start,
        end_exclusive=end_exclusive,
        label=label,
        data_lag_days=data_lag_days,
    )


def compute_last_7_day_range(
    today: date,
    *,
    data_lag_days: int = DATA_LAG_DAYS,
    window_days: int = WINDOW_DAYS,
) -> AnalyticsDateRange:
    """Rolling last 7 complete days (backward-compatible wrapper)."""
    return compute_preset_range(
        today,
        window_days,
        data_lag_days=data_lag_days,
    )


def compute_custom_range(
    start_inclusive: date,
    end_inclusive: date,
    *,
    today: date,
    data_lag_days: int = DATA_LAG_DAYS,
) -> AnalyticsDateRange:
    """
    Build a range from inclusive UI dates.

    ``end_inclusive`` is clamped to the latest complete day. API end is exclusive.
    """
    latest_complete = _latest_complete_day(today, data_lag_days=data_lag_days)
    if start_inclusive > today:
        raise InvalidAnalyticsDateRange("Dates cannot be in the future.")

    clamped_end = min(end_inclusive, latest_complete)
    if start_inclusive > clamped_end:
        raise InvalidAnalyticsDateRange(
            "Start date must be on or before the end date."
        )

    span_days = (clamped_end - start_inclusive).days + 1
    if span_days > MAX_CUSTOM_SPAN_DAYS:
        raise InvalidAnalyticsDateRange(
            f"Date range cannot exceed {MAX_CUSTOM_SPAN_DAYS} days."
        )

    end_exclusive = clamped_end + timedelta(days=1)
    label = _format_label(start_inclusive, clamped_end)
    return AnalyticsDateRange(
        start=start_inclusive,
        end_exclusive=end_exclusive,
        label=label,
        data_lag_days=data_lag_days,
    )


def _parse_iso_date(value: str, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise InvalidAnalyticsDateRange(
            f"Invalid {field_name}: use YYYY-MM-DD."
        ) from exc


def parse_range_request(
    *,
    today: date,
    preset_days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    data_lag_days: int = DATA_LAG_DAYS,
) -> AnalyticsDateRange:
    """
    Parse preset or custom date range request (mutually exclusive).

    Defaults to 7-day preset when no custom dates are provided.
    """
    has_start = start_date is not None
    has_end = end_date is not None

    if has_start != has_end:
        raise InvalidAnalyticsDateRange(
            "Both startDate and endDate are required for a custom range."
        )

    if has_start and has_end:
        if preset_days is not None:
            raise InvalidAnalyticsDateRange(
                "Cannot combine presetDays with startDate/endDate."
            )
        return compute_custom_range(
            _parse_iso_date(start_date, "startDate"),
            _parse_iso_date(end_date, "endDate"),
            today=today,
            data_lag_days=data_lag_days,
        )

    days = preset_days if preset_days is not None else DEFAULT_PRESET_DAYS
    return compute_preset_range(today, days, data_lag_days=data_lag_days)


def date_range_to_response(date_range: AnalyticsDateRange) -> dict[str, str | int]:
    return {
        "start": date_range.start_iso,
        "endExclusive": date_range.end_exclusive_iso,
        "label": date_range.label,
        "dataLagDays": date_range.data_lag_days,
    }
