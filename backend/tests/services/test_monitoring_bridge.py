"""Tests for Phase 3a monitoring bridge (fail-fast, no stubs)."""
import pytest
from types import SimpleNamespace

from services.scheduler.executors.monitoring_bridge import (
    MonitoringBridgeError,
    MonitoringBridgeNotExecutable,
    _fail_if_stub_result,
    load_strategy_data,
    orm_to_task_dict,
)


def _orm(**overrides):
    base = dict(
        id=7, task_title="GSC Visibility Check",
        task_description="Track visibility",
        assignee="ALwrity", frequency="Weekly",
        metric="gsc.visibility_score",
        measurement_method="services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance",
        component_name="Strategic Insights",
        success_criteria="x", alert_threshold="y",
        strategy_id=1, strategy=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_orm_to_task_dict_maps_fields():
    d = orm_to_task_dict(_orm())
    assert d["title"] == "GSC Visibility Check"
    assert d["metric"] == "gsc.visibility_score"
    assert d["tool"] == d["measurementMethod"]
    assert d["assignee"] == "ALwrity"


@pytest.mark.asyncio
async def test_bridge_rejects_human_task():
    from services.scheduler.executors.monitoring_bridge import execute_alwrity_orm
    with pytest.raises(MonitoringBridgeNotExecutable):
        await execute_alwrity_orm(_orm(assignee="Human"), db=None, user_id="u1")


@pytest.mark.asyncio
async def test_bridge_rejects_unknown_metric():
    from services.scheduler.executors.monitoring_bridge import execute_alwrity_orm
    with pytest.raises(MonitoringBridgeNotExecutable):
        await execute_alwrity_orm(_orm(metric="made.up.metric"), db=None, user_id="u1")


@pytest.mark.asyncio
async def test_bridge_registry_covers_impressions_delta_and_ctr():
    # Regression: gsc.impressions_delta + gsc.ctr were in ALLOWED_METRICS
    # but missing from TOOL_REGISTRY. Both now map to the real GSC
    # analyzer, so the bridge must pass registry validation and fail
    # later at strategy loading (no strategy supplied) — never as
    # NotExecutable, never as a stub.
    from services.scheduler.executors.monitoring_bridge import execute_alwrity_orm
    for metric in ("gsc.impressions_delta", "gsc.ctr"):
        with pytest.raises(MonitoringBridgeError):
            await execute_alwrity_orm(
                _orm(metric=metric,
                     measurement_method="services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance"),
                db=None, user_id="u1")


def test_fail_if_stub_result_rejects_stub_and_error():
    with pytest.raises(MonitoringBridgeError):
        _fail_if_stub_result({"stub": True}, task_id=1, metric="m", tool="t")
    with pytest.raises(MonitoringBridgeError):
        _fail_if_stub_result({"error": "boom"}, task_id=1, metric="m", tool="t")
    # clean dict passes silently
    _fail_if_stub_result({"ok": 1}, task_id=1, metric="m", tool="t")


def test_load_strategy_data_raises_without_strategy():
    with pytest.raises(MonitoringBridgeError):
        load_strategy_data(_orm(strategy=None, strategy_id=None), db=None)
