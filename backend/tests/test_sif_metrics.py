"""Phase 4.1: sif_metrics contract tests.

Covers the core API of the new ``sif_metrics`` module:
- inc_counter is atomic and accumulates across outcomes.
- get_counter returns per-outcome or summed value.
- set_gauge / get_gauge round-trip.
- set_user_gauge / get_user_gauges round-trip with isolation
  between users.
- get_metrics_snapshot returns a JSON-serializable shape.
- reset_for_tests clears state.
- Concurrent inc_counter calls don't lose updates.
"""
import importlib.util
import sys
import threading
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def metrics():
    """Load sif_metrics as a module and reset state per test."""
    spec = importlib.util.spec_from_file_location(
        "_phase41_metrics",
        BACKEND_DIR / "services" / "intelligence" / "sif_metrics.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["_phase41_metrics"] = mod
    spec.loader.exec_module(mod)
    mod.reset_for_tests()
    return mod


def test_inc_counter_basic(metrics):
    metrics.inc_counter("sif_search_total", "hit")
    metrics.inc_counter("sif_search_total", "hit")
    metrics.inc_counter("sif_search_total", "miss")
    assert metrics.get_counter("sif_search_total", "hit") == 2
    assert metrics.get_counter("sif_search_total", "miss") == 1
    # Sum across outcomes
    assert metrics.get_counter("sif_search_total") == 3


def test_inc_counter_with_value(metrics):
    metrics.inc_counter("sif_index_total", "success", value=5)
    assert metrics.get_counter("sif_index_total", "success") == 5


def test_inc_counter_ignores_non_positive(metrics):
    metrics.inc_counter("sif_x", "y", value=0)
    metrics.inc_counter("sif_x", "y", value=-3)
    assert metrics.get_counter("sif_x", "y") == 0


def test_get_counter_missing(metrics):
    assert metrics.get_counter("sif_nonexistent", "hit") == 0
    assert metrics.get_counter("sif_nonexistent") == 0


def test_gauge_roundtrip(metrics):
    metrics.set_gauge("sif_corrupt_markers", 3.0)
    assert metrics.get_gauge("sif_corrupt_markers") == 3.0
    metrics.set_gauge("sif_corrupt_markers", 0.0)
    assert metrics.get_gauge("sif_corrupt_markers") == 0.0


def test_gauge_missing(metrics):
    assert metrics.get_gauge("sif_unset") is None


def test_user_gauge_isolation(metrics):
    metrics.set_user_gauge("u1", "sif_index_count", 100)
    metrics.set_user_gauge("u2", "sif_index_count", 200)
    assert metrics.get_user_gauges("u1") == {"sif_index_count": 100.0}
    assert metrics.get_user_gauges("u2") == {"sif_index_count": 200.0}
    # Unknown user returns empty dict
    assert metrics.get_user_gauges("u3") == {}


def test_snapshot_shape(metrics):
    metrics.inc_counter("sif_search_total", "hit", value=2)
    metrics.inc_counter("sif_search_total", "miss", value=1)
    metrics.set_gauge("sif_corrupt_markers", 0.0)
    metrics.set_user_gauge("u1", "sif_index_count", 42.0)
    snap = metrics.get_metrics_snapshot()
    assert "counters" in snap
    assert "gauges" in snap
    assert "per_user_gauges" in snap
    assert snap["counters"]["sif_search_total"] == {"hit": 2, "miss": 1}
    assert snap["gauges"]["sif_corrupt_markers"] == 0.0
    assert "sif_uptime_seconds" in snap["gauges"]
    assert snap["per_user_gauges"]["u1"]["sif_index_count"] == 42.0


def test_snapshot_is_json_serializable(metrics):
    import json
    metrics.inc_counter("sif_a", "b")
    metrics.set_gauge("sif_c", 1.5)
    snap = metrics.get_metrics_snapshot()
    # Must not raise
    json.dumps(snap)


def test_reset_clears_state(metrics):
    metrics.inc_counter("sif_a", "b", value=5)
    metrics.set_gauge("sif_x", 10.0)
    metrics.set_user_gauge("u1", "sif_y", 1.0)
    metrics.reset_for_tests()
    assert metrics.get_counter("sif_a", "b") == 0
    assert metrics.get_gauge("sif_x") is None
    assert metrics.get_user_gauges("u1") == {}


def test_concurrent_inc_no_lost_updates(metrics):
    """100 threads × 100 increments = 10000, no losses."""
    n_threads = 100
    n_per_thread = 100
    barrier = threading.Barrier(n_threads)

    def worker():
        barrier.wait()
        for _ in range(n_per_thread):
            metrics.inc_counter("sif_concurrent_test", "hit")

    threads = [threading.Thread(target=worker) for _ in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert metrics.get_counter("sif_concurrent_test", "hit") == n_threads * n_per_thread


def test_get_metrics_for_user(metrics):
    metrics.inc_counter("sif_search_total", "hit", value=7)
    metrics.set_user_gauge("u1", "sif_index_count", 50)
    view = metrics.get_metrics_for_user("u1")
    assert view["user_id"] == "u1"
    assert view["counters"]["sif_search_total"]["hit"] == 7
    assert view["user_gauges"]["sif_index_count"] == 50


# ---------------------------------------------------------------------------
# Phase 4.5: structured log helper tests
# ---------------------------------------------------------------------------

def test_log_sif_event_basic(metrics, monkeypatch):
    """The log line includes the [sif_event] prefix and key=value pairs."""
    captured = []
    monkeypatch.setattr(
        metrics.logger, "info",
        lambda msg: captured.append(("info", msg)),
    )
    metrics.log_sif_event("search", user_id="u1", outcome="success")
    assert len(captured) == 1
    level, text = captured[0]
    assert level == "info"
    assert "[sif_event]" in text
    assert "operation=search" in text
    assert "user_id=u1" in text
    assert "outcome=success" in text


def test_log_sif_event_with_extras(metrics, monkeypatch):
    captured = []
    monkeypatch.setattr(
        metrics.logger, "info",
        lambda msg: captured.append(msg),
    )
    metrics.log_sif_event(
        "search", user_id="u1", outcome="success",
        extra={"result_count": 5, "score": 0.87, "is_latest": True},
    )
    text = captured[0]
    assert "result_count=5" in text
    assert "score=0.87" in text
    assert "is_latest=True" in text


def test_log_sif_event_with_non_primitive_extra(metrics, monkeypatch):
    captured = []
    monkeypatch.setattr(
        metrics.logger, "info",
        lambda msg: captured.append(msg),
    )
    metrics.log_sif_event(
        "index", user_id="u1", outcome="success",
        extra={"ids": ["a", "b", "c"]},
    )
    text = captured[0]
    # Non-primitives are JSON-encoded
    assert "ids=" in text
    assert '"a"' in text
    assert '"b"' in text


def test_log_sif_event_levels(metrics, monkeypatch):
    """Each level routes to the correct loguru method."""
    captured = []
    # monkeypatch.setattr with a dotted string attribute name
    for level_name in ("info", "warning", "error", "debug"):
        def make_capture(_ln):
            def capture(msg):
                captured.append((_ln, msg))
            return capture
        monkeypatch.setattr(metrics.logger, level_name, make_capture(level_name))
    metrics.log_sif_event("search", outcome="info", level="info")
    metrics.log_sif_event("search", outcome="warn", level="warning")
    metrics.log_sif_event("search", outcome="err", level="error")
    metrics.log_sif_event("search", outcome="dbg", level="debug")
    by_level = {lvl: msg for lvl, msg in captured}
    assert "info" in by_level
    assert "warning" in by_level
    assert "error" in by_level
    assert "debug" in by_level
    assert "outcome=info" in by_level["info"]
    assert "outcome=warn" in by_level["warning"]
    assert "outcome=err" in by_level["error"]
    assert "outcome=dbg" in by_level["debug"]


def test_log_sif_event_minimal_args(metrics, monkeypatch):
    """Operation alone (no user_id, no outcome) is valid."""
    captured = []
    monkeypatch.setattr(
        metrics.logger, "info",
        lambda msg: captured.append(msg),
    )
    metrics.log_sif_event("cache_cleanup")
    text = captured[0]
    assert "[sif_event]" in text
    assert "operation=cache_cleanup" in text
    # user_id and outcome are optional and should not appear
    assert "user_id=" not in text
    assert "outcome=" not in text
