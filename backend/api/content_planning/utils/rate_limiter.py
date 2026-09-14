"""
Per-user in-memory sliding-window rate limiter (Phase G #33).

Scope: the expensive strategy-creation surfaces — POST create (DB write)
and the polling generation start (5 AI component generations + DB writes
per call). The frontend's aiGenerating guard is client-side only (#33):
unserved requests from devtools or scripts must be rejected server-side.

Storage is process-local, mirroring the polling endpoint's existing
in-memory _task_status/_task_expires_at stores. For multi-process deploys
swap `_hits` for Redis (same interface, one call site per scope).
"""

import threading
import time
from collections import deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException
from loguru import logger

# (max_requests, window_seconds)
CREATE_STRATEGY_LIMITS: Tuple[int, int] = (10, 600)    # 10 creates per 10 min
GENERATE_STRATEGY_LIMITS: Tuple[int, int] = (3, 600)   # 3 AI generations per 10 min
GENERATE_CALENDAR_LIMITS: Tuple[int, int] = (3, 3600)  # 3 calendar generations per hour
# R6.1: semantic search loads the txtai index — budget it but keep polling cheap
CALENDAR_SIF_SEARCH_LIMITS: Tuple[int, int] = (20, 60)  # 20 searches per minute

_now = time.time  # module-level so tests can advance the clock

_hits: Dict[str, Deque[float]] = {}
_lock = threading.Lock()


def _clear() -> None:
    """Test helper — wipe the window store."""
    with _lock:
        _hits.clear()


def enforce_rate_limit(scope: str, user_id: str, limits: Tuple[int, int]) -> None:
    """Raise HTTPException(429) when ``user_id`` exceeds ``limits`` in the window."""
    max_requests, window_seconds = limits
    key = f"{scope}:{user_id}"
    with _lock:
        now = _now()
        bucket = _hits.setdefault(key, deque())
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            logger.warning(f"⚠️ Rate limit hit: {key} ({len(bucket)} hits in {window_seconds}s)")
            raise HTTPException(
                status_code=429,
                detail=(
                    "Too many requests. Please wait a few minutes before trying again."
                ),
            )
        bucket.append(now)


def rate_limit_budget_exhausted(scope: str, user_id: str, limits: Tuple[int, int]) -> bool:
    """Detect-only variant (R6.1) — returns True when a NEW hit for
    ``(scope, user_id)`` would exceed ``limits`` WITHOUT recording the hit.
    Lets read endpoints (which shouldn't record anything on rejection) share
    the limiter's accounting, and lets tests assert "beyond budget" without
    double-marking."""
    max_requests, window_seconds = limits
    key = f"{scope}:{user_id}"
    with _lock:
        now = _now()
        bucket = _hits.setdefault(key, deque())
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        return len(bucket) >= max_requests


def register_rate_limit_hit(scope: str, user_id: str) -> None:
    """Record a usage tick for ``(scope, user_id)`` (R6.1)."""
    with _lock:
        _hits.setdefault(f"{scope}:{user_id}", deque()).append(_now())
