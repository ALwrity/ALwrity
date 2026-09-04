"""Phase 2: Verify _task_status bounded cleanup and TTL pruning."""

import sys
import types
from datetime import datetime, timedelta
from unittest.mock import MagicMock

# We need to test the pruning logic in isolation.  The pruning
# helpers live inside ai_generation_endpoints.py and reference
# the module-level generate_comprehensive_strategy_polling function
# via getattr.  We replicate the same data structures here so the
# tests exercise the *algorithm* without importing the full
# endpoint module (which pulls in FastAPI, SQLAlchemy, etc.).

# ---------- helpers (mirrored from ai_generation_endpoints.py) ----------

TASK_STATUS_TTL_SECONDS = 3600
TASK_STATUS_MAX_SIZE = 1000  # new cap introduced in Phase 2


def _make_prune_fn(task_status: dict, task_expires_at: dict):
    """Return a prune function that operates on the given dicts."""

    def _prune_expired_tasks() -> None:
        now = datetime.utcnow().timestamp()
        expired = [tid for tid, exp in task_expires_at.items() if exp <= now]
        for tid in expired:
            task_status.pop(tid, None)
            task_expires_at.pop(tid, None)

    return _prune_expired_tasks


def _enforce_max_size(task_status: dict, task_expires_at: dict, max_size: int) -> None:
    """Drop oldest entries when the store exceeds *max_size*."""
    if len(task_status) <= max_size:
        return
    # Sort by expiry (oldest first) and remove surplus
    sorted_ids = sorted(task_expires_at, key=lambda t: task_expires_at[t])
    to_remove = len(task_status) - max_size
    for tid in sorted_ids[:to_remove]:
        task_status.pop(tid, None)
        task_expires_at.pop(tid, None)


# ---------- tests ----------


def test_prune_removes_expired_entries():
    task_status = {"t1": {"status": "done"}, "t2": {"status": "done"}, "t3": {"status": "running"}}
    now = datetime.utcnow().timestamp()
    task_expires_at = {
        "t1": now - 100,  # expired
        "t2": now + 3600,  # still valid
        "t3": now + 3600,  # still valid
    }

    prune = _make_prune_fn(task_status, task_expires_at)
    prune()

    assert "t1" not in task_status
    assert "t1" not in task_expires_at
    assert "t2" in task_status
    assert "t3" in task_status


def test_prune_is_noop_when_all_valid():
    now = datetime.utcnow().timestamp()
    task_status = {"t1": {"status": "running"}, "t2": {"status": "running"}}
    task_expires_at = {"t1": now + 3600, "t2": now + 3600}

    prune = _make_prune_fn(task_status, task_expires_at)
    prune()

    assert len(task_status) == 2
    assert len(task_expires_at) == 2


def test_prune_handles_empty_store():
    task_status = {}
    task_expires_at = {}

    prune = _make_prune_fn(task_status, task_expires_at)
    prune()  # should not raise

    assert len(task_status) == 0


def test_max_size_caps_store():
    """Adding > max_size entries and calling _enforce_max_size keeps only max_size."""
    now = datetime.utcnow().timestamp()
    task_status = {}
    task_expires_at = {}

    # Add 1200 entries with sequential expiry
    for i in range(1200):
        tid = f"task_{i}"
        task_status[tid] = {"status": "running"}
        task_expires_at[tid] = now + i  # sequential expiry

    _enforce_max_size(task_status, task_expires_at, TASK_STATUS_MAX_SIZE)

    assert len(task_status) == TASK_STATUS_MAX_SIZE
    assert len(task_expires_at) == TASK_STATUS_MAX_SIZE
    # Oldest entries (task_0 .. task_199) should have been removed
    assert "task_0" not in task_status
    assert "task_199" not in task_status
    assert "task_200" in task_status  # first surviving entry


def test_max_size_noop_when_under_cap():
    now = datetime.utcnow().timestamp()
    task_status = {"t1": {"status": "running"}}
    task_expires_at = {"t1": now + 3600}

    _enforce_max_size(task_status, task_expires_at, TASK_STATUS_MAX_SIZE)

    assert len(task_status) == 1
    assert "t1" in task_status


def test_max_size_keeps_newest_entries():
    """When over cap, oldest-expiry entries are dropped first."""
    now = datetime.utcnow().timestamp()
    task_status = {}
    task_expires_at = {}

    # Add 10 entries; entry "old" expires soonest
    for i in range(10):
        tid = f"task_{i}"
        task_status[tid] = {"status": "running"}
        task_expires_at[tid] = now + (i * 100)

    _enforce_max_size(task_status, task_expires_at, 5)

    assert len(task_status) == 5
    # The 5 entries with latest expiry survive
    assert "task_5" in task_status
    assert "task_9" in task_status
    assert "task_0" not in task_status
    assert "task_4" not in task_status
