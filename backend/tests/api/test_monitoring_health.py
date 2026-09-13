"""Unit tests for Phase 3b monitoring-health helpers (pure, no DB)."""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from api.content_planning.monitoring_health import (
    build_health_response,
    derive_overall_status,
    validate_schedule_patch,
)


def test_derive_status_healthy_degraded_down():
    assert derive_overall_status(["success", "success"], 0) == "healthy"
    assert derive_overall_status(["success", "failed", "success", "success"], 0) == "degraded"
    assert derive_overall_status(["success"], 2) == "degraded"
    assert derive_overall_status(["failed", "failed"], 0) == "down"
    assert derive_overall_status(["success", "failed"], 0) == "down"
    assert derive_overall_status([], 0) == "degraded"


def test_validate_patch_accepts_frequency_and_status():
    assert validate_schedule_patch({"frequency": "Daily"}) == {
        "frequency": "Daily", "status": None}
    assert validate_schedule_patch({"status": "paused"}) == {
        "frequency": None, "status": "paused"}


def test_validate_patch_rejects_metric_tool_unknown_empty():
    with pytest.raises(HTTPException) as e:
        validate_schedule_patch({"metric": "gsc.ctr"})
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        validate_schedule_patch({"frequency": "Hourly"})
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        validate_schedule_patch({"status": "deleted"})
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        validate_schedule_patch({})
    assert e.value.status_code == 400


def _task(i, **kw):
    base = dict(id=i, task_title=f"T{i}", metric="gsc.ctr",
                frequency="Weekly", assignee="ALwrity", status="active",
                next_execution=datetime.utcnow() + timedelta(days=7))
    base.update(kw)
    return SimpleNamespace(**base)


def _log(task_id, status, minutes_ago=10, error=None):
    return SimpleNamespace(
        task_id=task_id, status=status, error_message=error,
        execution_date=datetime.utcnow() - timedelta(minutes=minutes_ago))


def test_build_health_response_aggregates_truthfully():
    now = datetime.utcnow()
    tasks = [_task(1), _task(2, next_execution=now - timedelta(hours=1))]
    latest = {1: _log(1, "success"), 2: _log(2, "failed", error="GSC 403")}
    data = build_health_response(9, tasks, latest, now)
    assert data["strategy_id"] == 9
    assert data["status"] == "down"  # 1/2 failed hits 0.5 ratio
    assert data["totalTasks"] == 2
    assert data["successRate"] == 0.5
    assert data["overdueCount"] == 1
    assert data["byResult"] == {"success": 1, "failed": 1}
    assert data["tasks"][1]["lastError"] == "GSC 403"
    assert data["tasks"][1]["nextExecution"] is not None
    # never-executed task shows None, never fabricated
    data2 = build_health_response(9, [_task(3)], {}, now)
    assert data2["tasks"][0]["lastResult"] is None
    assert data2["successRate"] is None
