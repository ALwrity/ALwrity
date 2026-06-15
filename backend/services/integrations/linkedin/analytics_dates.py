"""
LinkedIn analytics date-range helpers (rolling last 7 complete days).

LinkedIn / Zernio treat the end date as exclusive. The latest two calendar days
are typically incomplete — use DATA_LAG_DAYS when computing ranges.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

DATA_LAG_DAYS = 2
WINDOW_DAYS = 7


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


def compute_last_7_day_range(
    today: date,
    *,
    data_lag_days: int = DATA_LAG_DAYS,
    window_days: int = WINDOW_DAYS,
) -> AnalyticsDateRange:
    """
    Rolling last N complete days relative to ``today``.

    Example (today=2026-06-15):
      end_exclusive=2026-06-13, start=2026-06-06, label includes Jun 6 and Jun 12.

    Example (today=2026-07-15):
      end_exclusive=2026-07-13, start=2026-07-06, label includes Jul 6 and Jul 12.
    """
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
