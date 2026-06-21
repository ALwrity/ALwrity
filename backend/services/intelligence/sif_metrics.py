"""Phase 4.1: SIF metrics — in-process counters and gauges.

Provides a tiny, dependency-free metrics surface for the SIF
(intelligence) layer. We deliberately do NOT pull in
``prometheus_client`` or any other library — this codebase already
has counter sprawl in different shapes; the goal here is a
**single, well-typed place** to read live SIF numbers from the
team-activity page and the ``/sif-indexing/health`` endpoint.

Design choices:
- **Process-wide dicts**, not a Registry. The FastAPI app is a
  single-process server (gunicorn is configured for 1 worker for
  this service in production). If we ever scale to multiple
  workers, the dicts can be replaced with a multi-proc collector.
- **Lock-protected mutation**. Phase 4.2 wires these counters
  into hot paths (search, cache, index_content) so we need a
  single ``threading.Lock`` to keep ``total + per_outcome`` sums
  consistent under concurrency.
- **Gauges + counters only**, no histograms. Histograms add 200
  lines of bucket math for numbers nobody is going to plot
  (we have Datadog/Honeycomb for that). Keep it boring.
- **No automatic Prometheus export**. The team-activity page
  reads via ``get_metrics_snapshot()`` directly. A
  ``/metrics`` Prometheus endpoint can be added later if needed.

Counters (monotonic):
- ``sif_search_total{outcome=hit|miss|error}``
- ``sif_index_total{outcome=success|error}``
- ``sif_delete_total{outcome=success|error}``
- ``sif_cluster_total{outcome=success|error|fallback}``
- ``sif_cache_total{operation=read|write, outcome=hit|miss|error}``
- ``sif_sync_total{source=..., outcome=success|skipped|error}``

Gauges (point-in-time):
- ``sif_index_count{user_id=...}`` — number of docs in the index
- ``sif_cache_size{user_id=..., layer=semantic|query}``
- ``sif_corrupt_markers`` — count of ``.corrupt`` marker files
- ``sif_uptime_seconds`` — process start time as epoch

Per-user gauges are populated on demand by Phase 4.4; we keep
both a global ``gauges`` dict and a per-user ``user_gauges`` dict.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict
from typing import Any, Dict, Optional

from loguru import logger


# Phase 4.1: module-level lock. Phase 4.2 hot paths may call
# ``inc_counter`` from multiple coroutines / threads; this lock
# keeps the dict update atomic.
_lock = threading.Lock()

# Monotonic counters. Stored as a nested dict:
#   _counters["sif_search_total"]["hit"] = 42
_counters: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

# Point-in-time gauges. Two flavors:
# - ``_gauges``: process-wide scalars (e.g. corrupt_markers, uptime)
# - ``_user_gauges``: per-user scalars (e.g. index_count, cache_size)
_gauges: Dict[str, float] = {}
_user_gauges: Dict[str, Dict[str, Dict[str, float]]] = defaultdict(
    lambda: defaultdict(dict)
)

# Process start time captured at module import. Used by
# ``sif_uptime_seconds`` gauge.
_process_start_epoch = time.time()


def inc_counter(metric: str, outcome: str, value: int = 1) -> None:
    """Atomically increment ``metric[outcome]`` by ``value`` (default 1).

    Phase 4.2 hot path: this function is on the request path
    (search, cache, index_content) so it must be cheap. We do a
    single dict lookup under the lock and a single ``+=``.
    """
    if value <= 0:
        return
    with _lock:
        _counters[metric][outcome] += value


def get_counter(metric: str, outcome: Optional[str] = None) -> int:
    """Read a counter. If ``outcome`` is given, return that cell;
    otherwise return the sum across all outcomes.
    """
    with _lock:
        if outcome is not None:
            return int(_counters.get(metric, {}).get(outcome, 0))
        return int(sum(_counters.get(metric, {}).values()))


def set_gauge(metric: str, value: float) -> None:
    """Set a process-wide gauge to ``value``."""
    with _lock:
        _gauges[metric] = float(value)


def get_gauge(metric: str) -> Optional[float]:
    with _lock:
        return _gauges.get(metric)


def set_user_gauge(user_id: str, metric: str, value: float) -> None:
    """Set a per-user gauge. ``user_id`` is part of the key."""
    with _lock:
        _user_gauges[user_id][metric] = float(value)


def get_user_gauges(user_id: str) -> Dict[str, float]:
    with _lock:
        return dict(_user_gauges.get(user_id, {}))


def reset_for_tests() -> None:
    """Phase 4.1 test helper. Wipes all counters and gauges.

    Production code MUST NOT call this.
    """
    with _lock:
        _counters.clear()
        _gauges.clear()
        _user_gauges.clear()
        global _process_start_epoch
        _process_start_epoch = time.time()


def get_metrics_snapshot() -> Dict[str, Any]:
    """Return a JSON-serializable snapshot of all SIF metrics.

    Shape::

        {
            "counters": {
                "sif_search_total": {"hit": 42, "miss": 17, "error": 1},
                ...
            },
            "gauges": {
                "sif_corrupt_markers": 0.0,
                "sif_uptime_seconds": 1234.5
            },
            "per_user_gauges": {
                "user-1": {"sif_index_count": 120, ...}
            }
        }
    """
    with _lock:
        snapshot_counters = {
            name: dict(outcomes) for name, outcomes in _counters.items()
        }
        snapshot_gauges = dict(_gauges)
        snapshot_gauges["sif_uptime_seconds"] = time.time() - _process_start_epoch
        snapshot_per_user = {
            uid: dict(per_metric)
            for uid, per_metric in _user_gauges.items()
        }
    return {
        "counters": snapshot_counters,
        "gauges": snapshot_gauges,
        "per_user_gauges": snapshot_per_user,
    }


def get_metrics_for_user(user_id: str) -> Dict[str, Any]:
    """Phase 4.4: return a per-user metrics view.

    Includes global counters (so a user can see their share of
    activity) plus the user's own gauges.
    """
    snap = get_metrics_snapshot()
    return {
        "user_id": user_id,
        "counters": snap["counters"],
        "gauges": snap["gauges"],
        "user_gauges": snap["per_user_gauges"].get(user_id, {}),
    }


# ---------------------------------------------------------------------------
# Phase 4.5: structured log helper
# ---------------------------------------------------------------------------
# The SIF service has many call sites that emit loguru lines like
# ``logger.info(f"Search completed successfully for user {self.user_id}. Found {len(results)} results")``.
# For the team-activity page and the health endpoint, we want to be
# able to filter / aggregate by ``sif_operation`` (search|index|cluster|cache|sync)
# and ``sif_outcome`` (success|miss|error|fallback). Rather than rewrite
# every call site, this helper wraps the structured fields in a
# consistent prefix that downstream log shippers (Datadog, Honeycomb)
# can split on. It is intentionally cheap: no I/O, no JSON dump.
#
# Usage in call sites::
#
#     from .sif_metrics import log_sif_event
#     log_sif_event("search", user_id=self.user_id, outcome="success",
#                   extra={"result_count": len(results)})

def log_sif_event(
    operation: str,
    user_id: Optional[str] = None,
    outcome: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
    level: str = "info",
) -> None:
    """Emit a single log line with the SIF structured-field prefix.

    Format (deliberately grep-friendly)::

        [sif_event] operation=<op> user_id=<uid> outcome=<outcome> k1=v1 k2=v2 ...

    The line is emitted via the same loguru logger that the rest of
    the SIF stack uses, so it shows up alongside the existing
    ``logger.info`` lines and is captured by the same sinks.
    """
    parts = ["[sif_event]"]
    parts.append(f"operation={operation}")
    if user_id is not None:
        parts.append(f"user_id={user_id}")
    if outcome is not None:
        parts.append(f"outcome={outcome}")
    if extra:
        # Only serialize primitive values to keep the line flat
        # (so log search by ``key=value`` works). Non-primitive
        # values are JSON-encoded so they remain inspectable.
        import json
        for k, v in extra.items():
            if isinstance(v, (str, int, float, bool)):
                parts.append(f"{k}={v}")
            else:
                parts.append(f"{k}={json.dumps(v, default=str)}")
    line = " ".join(parts)
    if level == "warning":
        logger.warning(line)
    elif level == "error":
        logger.error(line)
    elif level == "debug":
        logger.debug(line)
    else:
        logger.info(line)

