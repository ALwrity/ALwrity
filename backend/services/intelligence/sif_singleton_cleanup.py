"""Phase 5 / Issue #617 #10: stale-instance cleanup for the
TxtaiIntelligenceService singleton.

The singleton uses a per-user ``_instances`` dict that grows
without bound: every user_id that ever instantiates a service
leaves an entry forever, with a reference to the service and
its loaded FAISS index (~hundreds of MB per index). For
long-running servers with many users (e.g. a multi-tenant
deployment) this is a slow but real memory leak.

The fix is a single helper, ``cleanup_stale_instances``, that
the caller invokes periodically (e.g. once per N public method
calls). The helper:
  1. Iterates ``instances`` and removes any user_id whose
     ``last_used`` timestamp is older than ``max_age_seconds``.
  2. Is thread-safe via a per-class ``threading.Lock`` passed
     in by the caller (we don't reach for the class lock to
     avoid coupling).
  3. Returns the list of evicted user_ids so the caller can
     log them.

Design notes:
  * We do NOT put this on a background thread (like the
    semantic cache cleanup loop) because the singleton dict
    already has a lock and we want cleanup to be
    deterministic: a stale user_id is removed the next time a
    public method runs, not "at some point in the future".
  * The ``last_used`` timestamp is a float epoch (time.time())
    on the instance, updated on every public method call. We
    don't track it in the singleton dict itself; the instance
    is the source of truth.
  * The helper is *opt-in*: callers that don't care about the
    leak (e.g. short-lived batch jobs) can simply not call it.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List


def record_use(instance: Any) -> None:
    """Stamp the current time on ``instance._last_used``.

    Cheap O(1) operation; safe to call on every public method.
    """
    instance._last_used = time.time()


def is_stale(instance: Any, now: float, max_age_seconds: float) -> bool:
    """Return True if ``instance._last_used`` is older than the threshold.

    An instance is also considered stale if it lacks
    ``_last_used`` entirely (defensive: pre-cleanup builds of
    the singleton don't have the attribute).
    """
    last_used = getattr(instance, "_last_used", None)
    if last_used is None:
        return True
    return (now - last_used) > max_age_seconds


def cleanup_stale_instances(
    instances: Dict[str, Any],
    lock: Any,
    max_age_seconds: float = 3600.0,
    now: float = 0.0,
) -> List[str]:
    """Remove user_ids whose last activity is older than the threshold.

    Args:
        instances: the singleton dict (``TxtaiIntelligenceService._instances``).
        lock: a ``threading.Lock`` (or ``RLock``) that protects
            the dict. The helper acquires it for the duration of
            the scan-and-delete pass; this is the only place
            where we hold the lock for a list iteration, and
            it's bounded by the dict size which we expect to be
            at most a few hundred entries.
        max_age_seconds: how old (in seconds) a user_id must be
            before it is eligible for eviction. Default 1 hour
            is a reasonable balance between memory pressure and
            "user comes back 30 min later and loses cache" UX.
        now: optional current epoch. If 0, ``time.time()`` is
            called once at function entry. Exposed for tests.

    Returns:
        The list of user_ids that were removed, in arbitrary
        order. The caller can log this for observability.
    """
    if now == 0.0:
        now = time.time()
    evicted: List[str] = []
    with lock:
        # Snapshot keys first to avoid mutating the dict while
        # iterating. This is the canonical pattern for "delete
        # while iterating" in Python.
        for user_id in list(instances.keys()):
            instance = instances.get(user_id)
            if instance is None:
                # Already removed by another thread; skip.
                continue
            if is_stale(instance, now, max_age_seconds):
                instances.pop(user_id, None)
                evicted.append(user_id)
    return evicted
