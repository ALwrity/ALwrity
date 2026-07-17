"""Period window + baseline selection for Engagement Since You Joined ALwrity.

Keeps comparison logic small and testable without bloating the analytics service.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Optional

EngagementPeriodKey = Literal["1d", "7d", "15d", "30d", "since_joining"]

VALID_PERIOD_KEYS: tuple[str, ...] = ("1d", "7d", "15d", "30d", "since_joining")

# Minimum time between "now" and baseline so rapid Sync does not empty Trends.
MIN_BASELINE_GAP = timedelta(hours=6)

# Suggested client Sync cooldown (matches Phase 1 UI).
RECOMMENDED_SYNC_COOLDOWN_SECONDS = 300

_PERIOD_DELTAS: dict[str, timedelta] = {
    "1d": timedelta(days=1),
    "7d": timedelta(days=7),
    "15d": timedelta(days=15),
    "30d": timedelta(days=30),
}


def normalize_period_key(period: Optional[str]) -> EngagementPeriodKey:
    """Return a valid period key; default to since_joining."""
    key = (period or "since_joining").strip().lower()
    if key not in VALID_PERIOD_KEYS:
        raise ValueError(
            f"Invalid period '{period}'. Expected one of: {', '.join(VALID_PERIOD_KEYS)}"
        )
    return key  # type: ignore[return-value]


def select_baseline_epoch(
    epochs: list[datetime],
    now: datetime,
    period_key: EngagementPeriodKey,
) -> tuple[Optional[datetime], str]:
    """Pick a meaningful baseline snapshot timestamp.

    Rules:
    - ``since_joining`` → earliest epoch
    - otherwise → latest epoch at or before ``now - window``
    - if that baseline is closer than ``MIN_BASELINE_GAP`` to ``now``, walk older
    - returns ``(None, reason)`` when history is insufficient
    """
    if not epochs:
        return None, "no_snapshots"

    ordered = sorted(epochs)
    # Only consider baselines strictly before now.
    older = [e for e in ordered if e < now]
    if not older:
        return None, "insufficient_history"

    if period_key == "since_joining":
        candidate = older[0]
        reason = "since_joining_earliest"
    else:
        target = now - _PERIOD_DELTAS[period_key]
        at_or_before = [e for e in older if e <= target]
        if at_or_before:
            candidate = at_or_before[-1]
            reason = f"nearest_to_window_start_{period_key}"
        else:
            # Not enough span for the full window — use earliest available.
            candidate = older[0]
            reason = f"earliest_available_for_{period_key}"

    # Enforce minimum gap by walking further back when needed.
    while older and (now - candidate) < MIN_BASELINE_GAP:
        idx = older.index(candidate)
        if idx == 0:
            if (now - candidate) < MIN_BASELINE_GAP:
                return None, "baseline_too_close"
            break
        candidate = older[idx - 1]
        reason = "min_gap_walkback"

    if (now - candidate) < MIN_BASELINE_GAP:
        return None, "baseline_too_close"

    return candidate, reason


def metric_delta(before: int, now: int) -> dict:
    """Build MetricDelta-compatible dict with safe pct_change."""
    delta = now - before
    pct = 0.0 if before == 0 else round(delta / before * 100, 1)
    return {"before": before, "now": now, "delta": delta, "pct_change": pct}
