"""Phase 5 / Issue #617 #10: stale-instance cleanup tests.

Covers:
  * record_use stamps _last_used on the instance
  * is_stale returns True for old / missing timestamps
  * cleanup_stale_instances evicts only stale entries, returns
    a list of evicted user_ids, and is thread-safe under the
    provided lock
  * cleanup respects the max_age_seconds threshold exactly
"""
from __future__ import annotations

import importlib.util
import sys
import threading
import time
import types
from pathlib import Path

import pytest


def _make_instance():
    """A bare object that allows attribute assignment (_make_instance() doesn't)."""
    return types.SimpleNamespace()

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def cleanup_mod():
    return _load(
        "_sif_singleton_cleanup_test",
        BACKEND_DIR / "services" / "intelligence" / "sif_singleton_cleanup.py",
    )


# ---------------------------------------------------------------------------
# record_use
# ---------------------------------------------------------------------------

def test_record_use_stamps_last_used(cleanup_mod):
    inst = _make_instance()
    cleanup_mod.record_use(inst)
    assert hasattr(inst, "_last_used")
    assert isinstance(inst._last_used, float)
    assert inst._last_used <= time.time()


# ---------------------------------------------------------------------------
# is_stale
# ---------------------------------------------------------------------------

def test_is_stale_for_old_instance(cleanup_mod):
    inst = _make_instance()
    inst._last_used = 100.0
    assert cleanup_mod.is_stale(inst, now=200.0, max_age_seconds=50.0) is True


def test_is_stale_for_fresh_instance(cleanup_mod):
    inst = _make_instance()
    inst._last_used = 100.0
    assert cleanup_mod.is_stale(inst, now=120.0, max_age_seconds=50.0) is False


def test_is_stale_for_missing_last_used(cleanup_mod):
    """Defensive: pre-cleanup instances without the attr are stale."""
    inst = _make_instance()
    assert cleanup_mod.is_stale(inst, now=1000.0, max_age_seconds=10.0) is True


# ---------------------------------------------------------------------------
# cleanup_stale_instances
# ---------------------------------------------------------------------------

def test_cleanup_evicts_only_stale_entries(cleanup_mod):
    instances = {}
    lock = threading.Lock()
    fresh = _make_instance()
    fresh._last_used = 100.0
    stale = _make_instance()
    stale._last_used = 50.0
    instances["fresh_user"] = fresh
    instances["stale_user"] = stale
    # now=120, max_age=30 => fresh (120-100=20 <= 30) and stale (120-50=70 > 30)
    evicted = cleanup_mod.cleanup_stale_instances(
        instances, lock, max_age_seconds=30.0, now=120.0
    )
    assert evicted == ["stale_user"]
    assert "stale_user" not in instances
    assert "fresh_user" in instances
    assert instances["fresh_user"] is fresh


def test_cleanup_handles_empty_dict(cleanup_mod):
    instances = {}
    lock = threading.Lock()
    assert cleanup_mod.cleanup_stale_instances(
        instances, lock, max_age_seconds=10.0, now=100.0
    ) == []


def test_cleanup_handles_missing_last_used(cleanup_mod):
    """Old instances without _last_used are treated as stale."""
    instances = {"old_no_attr": _make_instance()}
    lock = threading.Lock()
    evicted = cleanup_mod.cleanup_stale_instances(
        instances, lock, max_age_seconds=100.0, now=1000.0
    )
    assert evicted == ["old_no_attr"]
    assert "old_no_attr" not in instances


def test_cleanup_threshold_exact_boundary(cleanup_mod):
    """The threshold is strict: instance at exactly max_age is fresh."""
    inst = _make_instance()
    inst._last_used = 100.0
    instances = {"boundary_user": inst}
    lock = threading.Lock()
    # now - last_used == max_age (boundary) - not stale
    evicted = cleanup_mod.cleanup_stale_instances(
        instances, lock, max_age_seconds=20.0, now=120.0
    )
    assert evicted == []
    assert "boundary_user" in instances
    # one second past the boundary - stale
    evicted = cleanup_mod.cleanup_stale_instances(
        instances, lock, max_age_seconds=20.0, now=121.0
    )
    assert evicted == ["boundary_user"]


def test_cleanup_concurrent_eviction_is_safe(cleanup_mod):
    """50 threads racing to evict; no exception, the dict ends up empty."""
    instances = {f"u{i}": _make_instance() for i in range(50)}
    # all entries have _last_used far in the past
    for v in instances.values():
        v._last_used = 0.0
    lock = threading.Lock()
    results = []
    barrier = threading.Barrier(50)
    def worker():
        barrier.wait()
        results.append(cleanup_mod.cleanup_stale_instances(
            instances, lock, max_age_seconds=10.0, now=100.0
        ))
    threads = [threading.Thread(target=worker) for _ in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # The dict is empty after the dust settles.
    assert instances == {}
    # Each user_id was evicted exactly once across all threads.
    all_evicted = sorted(
        user_id
        for result in results
        for user_id in result
    )
    assert all_evicted == sorted([f"u{i}" for i in range(50)])
