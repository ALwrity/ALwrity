"""
In-memory dedup gate for the competitive sitemap benchmarking
endpoint. Lives in its own module so it can be tested without
importing the full seo_tools router (which has pre-existing
import errors unrelated to this fix).
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict


# 5 minutes is a sensible default: long enough to absorb click-spam
# (the original failure mode that produced the log flood), short
# enough to allow a fresh run after the underlying data is plausibly
# stale.
SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC = 300


_sitemap_benchmark_last_run: Dict[str, datetime] = {}


def is_recent_sitemap_benchmark_in_flight(user_id: str) -> bool:
    """True if a sitemap benchmark for this user was started within
    the dedup window. Used by the API layer to short-circuit
    duplicate requests and avoid hammering upstream sitemaps.
    """
    if not user_id:
        return False
    last = _sitemap_benchmark_last_run.get(user_id)
    if not last:
        return False
    elapsed = (datetime.utcnow() - last).total_seconds()
    return elapsed < SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC


def mark_sitemap_benchmark_started(user_id: str) -> None:
    """Record that a sitemap benchmark has started for this user."""
    if user_id:
        _sitemap_benchmark_last_run[user_id] = datetime.utcnow()


def mark_sitemap_benchmark_finished(user_id: str) -> None:
    """Refresh the dedup gate so a fresh run is allowed after the
    dedup window expires. We deliberately update the timestamp on
    completion too — this prevents a failed run from being
    immediately re-triggered by another /run call.
    """
    if user_id:
        _sitemap_benchmark_last_run[user_id] = datetime.utcnow()


def _reset_for_tests() -> None:
    """Clear all dedup state. Test-only helper."""
    _sitemap_benchmark_last_run.clear()
