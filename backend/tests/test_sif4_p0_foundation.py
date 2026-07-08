"""Source-level + lightweight runtime tests for the SIF-4 P0
foundation fixes: cached monitor, graceful not_available status,
monitoring task cancellation, and frontend polling suspension.
"""
import asyncio
import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = Path(__file__).resolve().parents[2] / "frontend/src"


def _read_backend(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8")


def _read_frontend(rel: str) -> str:
    return (FRONTEND_ROOT / rel).read_text(encoding="utf-8")


# ---------- Issue 4: graceful not_available when SIF is disabled ----------

def test_check_semantic_health_returns_not_available_when_sif_disabled():
    """When has_onboarding_session() returns False, check_semantic_health
    must return a SemanticHealthMetric with status='not_available'
    and a clear 'complete onboarding' recommendation.
    """
    import sys
    if "services.intelligence.monitoring.semantic_dashboard" in sys.modules:
        del sys.modules["services.intelligence.monitoring.semantic_dashboard"]
    from services.intelligence.monitoring.semantic_dashboard import (
        RealTimeSemanticMonitor,
    )

    async def go():
        m = RealTimeSemanticMonitor("nonexistent_user_xyz")
        assert m.sif_enabled is False
        result = await m.check_semantic_health("nonexistent_user_xyz")
        return result

    result = asyncio.run(go())
    assert result.status == "not_available"
    assert "onboarding" in result.description.lower()
    assert any("onboarding" in r.lower() for r in result.recommendations)


def test_check_semantic_health_falls_back_to_warning_when_sif_enabled_no_metrics():
    """When SIF is enabled but the inner check returns no metrics,
    the public method still returns a 'warning' status (preserves the
    pre-existing behavior for that case).
    """
    # The not_available branch is for sif_enabled=False; the warning
    # branch is for sif_enabled=True with no metrics. We don't need
    # a real onboarding session to verify the source structure.
    src = _read_backend("services/intelligence/monitoring/semantic_dashboard.py")
    # The not_available branch is the FIRST early return; the warning
    # branch is the SECOND (after the inner check returns []).
    na_idx = src.find('status="not_available"')
    warning_idx = src.find('status="warning"')
    assert na_idx > 0
    assert warning_idx > 0
    assert na_idx < warning_idx, "not_available must come before the warning fallback"


# ---------- Issue 3: cached SemanticDashboardAPI.get_monitor() ----------

def test_endpoint_uses_cached_dashboard_api_monitor():
    """The endpoint must use semantic_dashboard_api.get_monitor() and
    not construct a new RealTimeSemanticMonitor per request.
    """
    src = _read_backend("api/seo_dashboard.py")
    # Both endpoint functions must use the cached accessor
    # Find the get_semantic_health function body
    m = re.search(
        r"async def get_semantic_health\(.*?\) ->.*?:(.*?)(?=\nasync def |\Z)",
        src, re.DOTALL,
    )
    assert m is not None
    body = m.group(1)
    assert "semantic_dashboard_api" in body
    assert "get_monitor(" in body
    # The new RealTimeSemanticMonitor(...) call must be gone from the
    # body (we only check for direct construction; the symbol may
    # still appear in the type annotation block above).
    # We allow the symbol to appear in the type imports at the top
    # but NOT in a fresh `= RealTimeSemanticMonitor(` construction.
    direct_construct = re.search(r"=\s*RealTimeSemanticMonitor\(", body)
    assert direct_construct is None, "endpoint must not construct a new RealTimeSemanticMonitor per request"


def test_dashboard_api_singleton_caches_monitors():
    """SemanticDashboardAPI.get_monitor() returns the same instance
    for repeated calls with the same user_id.
    """
    import sys
    if "services.intelligence.monitoring.semantic_dashboard" in sys.modules:
        del sys.modules["services.intelligence.monitoring.semantic_dashboard"]
    from services.intelligence.monitoring.semantic_dashboard import (
        semantic_dashboard_api,
    )

    m1 = semantic_dashboard_api.get_monitor("cache_test_user_42")
    m2 = semantic_dashboard_api.get_monitor("cache_test_user_42")
    assert m1 is m2


# ---------- Issue 5: monitoring task reference + cancellation ----------

def test_monitoring_task_attribute_initialized_to_none():
    """RealTimeSemanticMonitor must have a _monitoring_task attribute
    initialized to None, and the loop must be cancellable.
    """
    import sys
    if "services.intelligence.monitoring.semantic_dashboard" in sys.modules:
        del sys.modules["services.intelligence.monitoring.semantic_dashboard"]
    from services.intelligence.monitoring.semantic_dashboard import (
        RealTimeSemanticMonitor,
    )

    async def go():
        m = RealTimeSemanticMonitor("task_ref_user")
        assert m._monitoring_task is None
        # start/stop without a real loop should still flip the task ref
        # We don't await start_monitoring here because the loop would
        # block for monitoring_interval seconds; we only test the
        # attribute shape and the source-level contract.
        return m._monitoring_task

    result = asyncio.run(go())
    assert result is None


def test_start_monitoring_stores_task_reference_and_stop_cancels():
    """start_monitoring() stores the task reference; stop_monitoring()
    cancels it. We use a tiny monitoring interval via direct method
    call to keep the test fast.
    """
    import sys
    if "services.intelligence.monitoring.semantic_dashboard" in sys.modules:
        del sys.modules["services.intelligence.monitoring.semantic_dashboard"]
    from services.intelligence.monitoring.semantic_dashboard import (
        RealTimeSemanticMonitor,
    )

    async def go():
        m = RealTimeSemanticMonitor("cancel_test_user")
        # Patch the monitoring interval so the loop returns quickly
        # when started.
        m.monitoring_interval = 0.05
        await m.start_monitoring([])
        try:
            assert m._monitoring_task is not None
            assert not m._monitoring_task.done()
        finally:
            await m.stop_monitoring()
        assert m._monitoring_task is None or m._monitoring_task.done()

    asyncio.run(go())


# ---------- Frontend polling suspension ----------

def test_frontend_sif_health_polling_suspends_on_not_scheduled():
    """MainDashboard.tsx SIF-health useEffect must short-circuit
    setInterval when has_task === false.
    """
    src = _read_frontend("components/MainDashboard/MainDashboard.tsx")
    # The SIF-health useEffect must reference has_task and skip
    # the interval when it's false
    m = re.search(
        r"// Fetch SIF indexing health.*?// Onboarding background tasks",
        src, re.DOTALL,
    )
    assert m is not None
    block = m.group(0)
    assert "sifHealth && sifHealth.has_task === false" in block
    assert "setInterval(fetchSifHealth, 60_000)" in block
    # The skip must be BEFORE the setInterval call (otherwise it
    # never takes effect)
    skip_idx = block.find("sifHealth.has_task === false")
    interval_idx = block.find("setInterval(fetchSifHealth, 60_000)")
    assert 0 <= skip_idx < interval_idx, "skip must come before setInterval call"
