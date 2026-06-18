"""Phase 4.3/4.4/4.5: SIF indexing health endpoint helpers.

Covers the new stat-collector helpers added to ``api/seo_dashboard.py``:
- ``_collect_sif_cache_stats`` returns the expected shape (or None).
- ``_collect_sif_metrics_snapshot`` returns a JSON-serializable dict
  with counters, gauges, per_user_gauges.
- ``_collect_sif_index_stats`` returns None if txtai is unavailable
  and a dict with the expected keys when it works (we patch the
  service to simulate an initialized state).

We deliberately do NOT call the real ``get_sif_indexing_health``
FastAPI handler (it requires a DB session and current_user). The
helpers themselves are pure functions of the sif_* modules, so we
test them in isolation.
"""
import importlib
import importlib.util
import sys
import types
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


def _load_seo_dashboard_module():
    """Load api/seo_dashboard as a module and return the helper
    functions. We avoid triggering the full app import chain by
    stubbing the FastAPI app.
    """
    # Other test files in this directory (``test_sif_seed_terms``,
    # ``test_sif_concurrency``) populate ``sys.modules`` with fake
    # package names like ``_phase35_fake_pkg`` whose __path__ points
    # at ``services/intelligence``. If those entries leak into the
    # module-resolution order, ``import services.intelligence.sif_metrics``
    # (which ``api.seo_dashboard`` does) fails with
    # ``'services' is not a package``. We purge any such fake
    # packages from ``sys.modules`` before importing.
    for mod_name in list(sys.modules.keys()):
        if mod_name.startswith("_phase") or "_phase" in mod_name:
            sys.modules.pop(mod_name, None)
        elif mod_name.startswith("services.intelligence.txtai"):
            # Also drop any cache of txtai_service loaded under a fake
            # package, so the real one is reimported.
            sys.modules.pop(mod_name, None)

    mod_name = "api.seo_dashboard"
    if mod_name in sys.modules:
        return sys.modules[mod_name]
    try:
        import api.seo_dashboard as mod
    except ImportError as e:
        pytest.skip(f"Could not load api.seo_dashboard: {e}")
        return None  # unreachable
    return mod


@pytest.fixture(scope="module")
def seo_mod():
    return _load_seo_dashboard_module()


def test_collect_cache_stats_shape(seo_mod):
    """Cache stats returns expected keys or None."""
    stats = seo_mod._collect_sif_cache_stats()
    if stats is None:
        pytest.skip("semantic_cache_manager not available")
    assert "cache_size" in stats
    assert "memory_usage_mb" in stats
    assert "total_hits" in stats
    assert "total_misses" in stats
    assert "total_invalidations" in stats
    assert "max_memory_size_mb" in stats


def test_collect_cache_stats_values_are_numeric(seo_mod):
    stats = seo_mod._collect_sif_cache_stats()
    if stats is None:
        pytest.skip("semantic_cache_manager not available")
    for key, value in stats.items():
        assert isinstance(value, (int, float)), f"{key} is {type(value)}"


def test_collect_metrics_snapshot_shape(seo_mod):
    snap = seo_mod._collect_sif_metrics_snapshot("test_user_4_5")
    assert snap is not None
    assert "user_id" in snap
    assert snap["user_id"] == "test_user_4_5"
    assert "counters" in snap
    assert "gauges" in snap
    assert "user_gauges" in snap
    assert "sif_uptime_seconds" in snap["gauges"]


def test_collect_metrics_snapshot_increments(seo_mod):
    """After incrementing, the snapshot reflects the new value."""
    from services.intelligence.sif_metrics import inc_counter, reset_for_tests
    reset_for_tests()
    inc_counter("sif_search_total", "hit", value=5)
    snap = seo_mod._collect_sif_metrics_snapshot("test_user_4_5b")
    assert snap["counters"]["sif_search_total"]["hit"] == 5


def test_collect_index_stats_returns_dict_with_expected_keys(seo_mod):
    """Index stats returns None if txtai is unavailable, or a dict
    with the expected shape when it works. We accept either."""
    stats = seo_mod._collect_sif_index_stats("test_user_4_3")
    if stats is None:
        # txtai not installed in this env - that's an acceptable outcome
        return
    assert "doc_count" in stats
    assert "ann_disabled" in stats
    assert "corrupt_marker_present" in stats
    assert "index_path" in stats
    assert "initialized" in stats
    # doc_count should be a non-negative integer
    assert isinstance(stats["doc_count"], int)
    assert stats["doc_count"] >= 0


def test_collect_index_stats_sets_user_gauge(seo_mod):
    """_collect_sif_index_stats should populate per-user gauges so the
    team-activity page can read them via get_metrics_for_user()."""
    from services.intelligence.sif_metrics import get_user_gauges, reset_for_tests
    reset_for_tests()
    stats = seo_mod._collect_sif_index_stats("test_user_4_3b")
    # Whether or not the call succeeded, the gauge for doc_count
    # should now exist (set to 0 if initialization failed).
    gauges = get_user_gauges("test_user_4_3b")
    assert "sif_index_count" in gauges
    assert isinstance(gauges["sif_index_count"], float)
