"""Cross-path execution mutex for advertools pipelines.

Two duplicate ``content_audit`` tasks (created by older versions of
``schedule_step2_tasks`` which used raw ``db.add()`` instead of an upsert)
each got their own scheduler lease, so both ran the full 5-phase pipeline
simultaneously — doubling origin load and amplifying HTTP 429s.

This module provides a mutex keyed by ``(user_id, website_url, task_type)``
with two layers:

1. **In-process registry** — fast path covering the scheduler executor and
   the interactive routes within one worker process.
2. **DB check** — an ``AdvertoolsTask`` row for the same user/site/type in
   ``status='running'`` (with a fresh ``started_at``) blocks acquisition.
   This covers cross-process cases; ``stale_task_recovery`` already resets
   rows stuck in 'running' after crashes, and rows older than the stale TTL
   are ignored here as a second line of defence.

Multi-tenancy: keys always include ``user_id`` and the DB check only ever
touches the caller's per-user session. No user data is stored globally.
"""

from __future__ import annotations

import threading
import time as _time
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from loguru import logger
from sqlalchemy.orm import Session

# Longer than the advertools batch deadline (120s) plus the crawl-budget
# window, so a legitimately long pipeline is never considered stale while
# still bounding the damage of a leaked entry.
RUN_LOCK_STALE_SECS = 45 * 60

# Matches STALE_TASK_TTL_MINUTES in scheduler/core/stale_task_recovery.py:
# 'running' rows older than this are ignored (recovery will clean them up).
DB_RUNNING_STALE_SECS = 120 * 60

_RUN_LOCKS: Dict[Tuple[str, str, str], float] = {}
_RUN_LOCKS_GUARD = threading.Lock()


def _normalize_url(url: Optional[str]) -> str:
    return (url or "").strip().rstrip("/")


def _lock_key(user_id: Optional[str], website_url: Optional[str], task_type: Optional[str]) -> Tuple[str, str, str]:
    return (str(user_id or ""), _normalize_url(website_url), str(task_type or ""))


def _has_fresh_running_row(
    db: Optional[Session],
    user_id: str,
    website_url: str,
    task_type: str,
    exclude_task_id: Optional[int] = None,
) -> bool:
    """True when another AdvertoolsTask row for this user/site/type is running."""
    if db is None:
        return False
    try:
        from models.advertools_monitoring_models import AdvertoolsTask

        rows = (
            db.query(AdvertoolsTask)
            .filter(
                AdvertoolsTask.user_id == user_id,
                AdvertoolsTask.website_url == website_url,
                AdvertoolsTask.status == "running",
            )
            .all()
        )
        now = _time.time()
        for row in rows:
            if exclude_task_id is not None and row.id == exclude_task_id:
                continue
            if (row.payload or {}).get("type") != task_type:
                continue
            started_at = row.started_at
            if started_at is None:
                # No timestamp — treat as fresh (conservative) so we still skip.
                return True
            # started_at is written with datetime.utcnow() (naive UTC).
            # .timestamp() on a naive datetime assumes LOCAL time, which on
            # non-UTC hosts makes every fresh row look hours old and silently
            # disables the DB check. Anchor naive values to UTC explicitly.
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            age = now - started_at.timestamp()
            if age <= DB_RUNNING_STALE_SECS:
                return True
        return False
    except Exception as e:
        # Non-blocking: if the DB check fails, rely on the in-process lock.
        logger.warning(f"[advertools_run_lock] DB running-check failed (non-blocking): {e}")
        return False


def try_acquire(
    user_id: Optional[str],
    website_url: Optional[str],
    task_type: Optional[str],
    db: Optional[Session] = None,
    exclude_task_id: Optional[int] = None,
) -> bool:
    """Try to acquire the pipeline mutex. Returns False when busy.

    Busy means: another in-process pipeline holds the key, or a fresh
    ``status='running'`` task row exists for the same user/site/type.
    """
    key = _lock_key(user_id, website_url, task_type)
    if not key[0] or not key[1] or not key[2]:
        # Incomplete key (missing user/site/type) — do not lock, do not block.
        return True

    now = _time.monotonic()
    with _RUN_LOCKS_GUARD:
        acquired_at = _RUN_LOCKS.get(key)
        if acquired_at is not None:
            if now - acquired_at < RUN_LOCK_STALE_SECS:
                return False
            # Stale entry (e.g. worker died mid-run without release) — override.
            logger.warning(
                f"[advertools_run_lock] Stale lock override for {key} "
                f"(held {now - acquired_at:.0f}s > {RUN_LOCK_STALE_SECS}s)"
            )
        _RUN_LOCKS[key] = now

    # In-process lock acquired — now the DB-level check. If the DB says
    # busy, release our in-process claim and report busy.
    if _has_fresh_running_row(db, key[0], key[1], key[2], exclude_task_id=exclude_task_id):
        with _RUN_LOCKS_GUARD:
            _RUN_LOCKS.pop(key, None)
        return False
    return True


def release(user_id: Optional[str], website_url: Optional[str], task_type: Optional[str]) -> None:
    """Release the in-process mutex (idempotent)."""
    key = _lock_key(user_id, website_url, task_type)
    with _RUN_LOCKS_GUARD:
        _RUN_LOCKS.pop(key, None)


def is_running(
    user_id: Optional[str],
    website_url: Optional[str],
    task_type: Optional[str],
    db: Optional[Session] = None,
) -> bool:
    """True when a pipeline for this user/site/type is currently running."""
    key = _lock_key(user_id, website_url, task_type)
    with _RUN_LOCKS_GUARD:
        acquired_at = _RUN_LOCKS.get(key)
        if acquired_at is not None and _time.monotonic() - acquired_at < RUN_LOCK_STALE_SECS:
            return True
    return _has_fresh_running_row(db, key[0], key[1], key[2])
