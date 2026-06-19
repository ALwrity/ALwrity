"""Tests for the SIF helper modules extracted for separation of concerns.

These tests cover:
- sif_async_helpers.run_blocking (Phase 2.1)
- sif_singleton.get_singleton (Phase 2.2)
- sif_seed_terms.resolve_seed_terms (Phase 3.5)
- sif_index_remediation (Phase 3.1)
- sif_error_decorators.sif_error_boundary (Phase 1.2)
"""
from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
INTELLIGENCE_DIR = BACKEND_DIR / "services" / "intelligence"


def _load(name: str, path: Path, package: str = "services.intelligence"):
    """Load a module by file path, optionally setting its __package__ so
    relative imports inside the module resolve correctly.
    """
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    mod.__package__ = package
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ============================================================================
# sif_async_helpers
# ============================================================================

def test_run_blocking_returns_value():
    mod = _load(
        "_sif_async_helpers_test",
        INTELLIGENCE_DIR / "sif_async_helpers.py",
    )
    result = asyncio.run(mod.run_blocking(lambda x: x * 2, 21))
    assert result == 42


def test_run_blocking_passes_args_kwargs():
    mod = _load(
        "_sif_async_helpers_args",
        INTELLIGENCE_DIR / "sif_async_helpers.py",
    )
    def func(a, b, *, c):
        return (a, b, c)
    result = asyncio.run(mod.run_blocking(func, 1, 2, c=3))
    assert result == (1, 2, 3)


def test_run_blocking_does_not_block_event_loop():
    """Two concurrent run_blocking calls on slow functions should
    overlap rather than serialize."""
    mod = _load(
        "_sif_async_helpers_conc",
        INTELLIGENCE_DIR / "sif_async_helpers.py",
    )
    def slow(_):
        time.sleep(0.3)
        return _
    async def runner():
        start = time.time()
        results = await asyncio.gather(
            mod.run_blocking(slow, 1),
            mod.run_blocking(slow, 2),
        )
        return results, time.time() - start
    results, elapsed = asyncio.run(runner())
    # If serialized: 0.6s. If concurrent: ~0.3s.
    assert results == [1, 2]
    assert elapsed < 0.5, f"expected concurrent, got {elapsed:.2f}s"


# ============================================================================
# sif_singleton
# ============================================================================

def test_get_singleton_returns_same_instance():
    mod = _load(
        "_sif_singleton_basic",
        INTELLIGENCE_DIR / "sif_singleton.py",
    )
    class Fake:
        pass
    instances = {}
    lock = threading.Lock()
    a = mod.get_singleton(Fake, "u1", instances, lock)
    b = mod.get_singleton(Fake, "u1", instances, lock)
    assert a is b
    assert instances["u1"] is a


def test_get_singleton_distinct_users():
    mod = _load(
        "_sif_singleton_distinct",
        INTELLIGENCE_DIR / "sif_singleton.py",
    )
    class Fake:
        pass
    instances = {}
    lock = threading.Lock()
    a = mod.get_singleton(Fake, "u1", instances, lock)
    b = mod.get_singleton(Fake, "u2", instances, lock)
    assert a is not b
    assert instances["u1"] is a
    assert instances["u2"] is b


def test_get_singleton_concurrent_same_user():
    """50 threads racing to construct the same user_id must yield 1 instance."""
    mod = _load(
        "_sif_singleton_race",
        INTELLIGENCE_DIR / "sif_singleton.py",
    )
    class Fake:
        pass
    instances = {}
    lock = threading.Lock()
    barrier = threading.Barrier(50)
    results = []
    def worker():
        barrier.wait()
        results.append(id(mod.get_singleton(Fake, "race_user", instances, lock)))
    threads = [threading.Thread(target=worker) for _ in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    unique_ids = set(results)
    assert len(unique_ids) == 1
    assert len(instances) == 1


# ============================================================================
# sif_seed_terms
# ============================================================================

def test_resolve_seed_terms_default():
    mod = _load(
        "_sif_seed_terms_default",
        INTELLIGENCE_DIR / "sif_seed_terms.py",
    )
    assert mod.resolve_seed_terms(None) == mod.HISTORICAL_DEFAULT_SEEDS
    assert mod.resolve_seed_terms([]) == mod.HISTORICAL_DEFAULT_SEEDS


def test_resolve_seed_terms_uses_caller_first():
    mod = _load(
        "_sif_seed_terms_caller",
        INTELLIGENCE_DIR / "sif_seed_terms.py",
    )
    out = mod.resolve_seed_terms(["medical", "research"])
    assert out[:2] == ["medical", "research"]
    # Defaults fill the rest, no duplication
    assert "marketing" in out
    assert len(out) == 5
    assert len(set(out)) == 5


def test_resolve_seed_terms_caps_at_five():
    mod = _load(
        "_sif_seed_terms_cap",
        INTELLIGENCE_DIR / "sif_seed_terms.py",
    )
    out = mod.resolve_seed_terms([f"seed{i}" for i in range(10)])
    assert len(out) == 5
    assert out == ["seed0", "seed1", "seed2", "seed3", "seed4"]


# ============================================================================
# sif_index_remediation
# ============================================================================

def test_remediate_no_marker():
    mod = _load(
        "_sif_remediate_noop",
        INTELLIGENCE_DIR / "sif_index_remediation.py",
    )
    with tempfile.TemporaryDirectory() as tmp:
        idx = os.path.join(tmp, "fake_idx")
        # No marker, no index files
        assert mod.remediate_corrupt_index(idx) is False


def test_remediate_with_marker_removes_files():
    mod = _load(
        "_sif_remediate_active",
        INTELLIGENCE_DIR / "sif_index_remediation.py",
    )
    with tempfile.TemporaryDirectory() as tmp:
        idx = os.path.join(tmp, "fake_idx")
        # Create the index files
        for ext in ("", ".index", ".config", ".ids"):
            with open(f"{idx}{ext}", "w") as f:
                f.write("data")
        # Create the marker
        marker = f"{idx}.corrupt"
        with open(marker, "w") as f:
            f.write("corrupt")
        # Run remediation
        result = mod.remediate_corrupt_index(idx, user_id="u1")
        assert result is True
        # All index files + marker are gone
        for ext in ("", ".index", ".config", ".ids", ".corrupt"):
            assert not os.path.exists(f"{idx}{ext}"), f"{ext} should be removed"


def test_remediate_is_best_effort():
    """If the index file can't be deleted, remediation must not raise."""
    mod = _load(
        "_sif_remediate_safe",
        INTELLIGENCE_DIR / "sif_index_remediation.py",
    )
    with tempfile.TemporaryDirectory() as tmp:
        idx = os.path.join(tmp, "fake_idx")
        marker = f"{idx}.corrupt"
        with open(marker, "w") as f:
            f.write("corrupt")
        # Index file is in a non-existent subdir; unlink will fail.
        # The function should still not raise.
        result = mod.remediate_corrupt_index(idx)
        assert result is True
        # Marker was removed even if index files weren't
        assert not os.path.exists(marker)


# ============================================================================
# sif_error_decorators
# ============================================================================

def test_sif_error_boundary_async_returns_value():
    mod = _load(
        "_sif_err_async_ok",
        INTELLIGENCE_DIR / "sif_error_decorators.py",
    )
    # Need a class to bind to
    class Svc:
        user_id = "u1"
        fail_fast = False
        @mod.sif_error_boundary(operation="test", default=42)
        async def op(self):
            return 7
    assert asyncio.run(Svc().op()) == 7


def test_sif_error_boundary_returns_default_on_failure():
    mod = _load(
        "_sif_err_default",
        INTELLIGENCE_DIR / "sif_error_decorators.py",
    )
    class Svc:
        user_id = "u1"
        fail_fast = False
        @mod.sif_error_boundary(operation="test", default=[])
        async def op(self):
            raise RuntimeError("boom")
    result = asyncio.run(Svc().op())
    assert result == []


def test_sif_error_boundary_raises_sif_error_on_fail_fast():
    mod = _load(
        "_sif_err_failfast",
        INTELLIGENCE_DIR / "sif_error_decorators.py",
    )
    from services.intelligence.sif_errors import SIFError
    class Svc:
        user_id = "u1"
        fail_fast = True
        @mod.sif_error_boundary(operation="test", default=[])
        async def op(self):
            raise RuntimeError("boom")
    with pytest.raises(SIFError):
        asyncio.run(Svc().op())


def test_sif_error_boundary_sync_method():
    mod = _load(
        "_sif_err_sync",
        INTELLIGENCE_DIR / "sif_error_decorators.py",
    )
    class Svc:
        user_id = "u1"
        fail_fast = False
        @mod.sif_error_boundary(operation="test", default=-1)
        def op(self):
            raise RuntimeError("nope")
    assert Svc().op() == -1
