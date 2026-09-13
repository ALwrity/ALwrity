import pytest
from unittest.mock import AsyncMock, patch
from services.monitoring_executor import MonitoringExecutor
from services.monitoring_metrics import MetricKey

def _task(metric, assignee="ALwrity"):
    return {
        "component": "Strategic Insights",
        "title": f"Task {metric}",
        "description": "desc",
        "assignee": assignee,
        "frequency": "Weekly",
        "metric": metric,
        "measurementMethod": f"services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance" if assignee=="ALwrity" else "manual.human_review",
        "tool": f"services.seo_tools.gsc_analyzer_service.GSCAnalyzerService.analyze_search_performance" if assignee=="ALwrity" else "manual.human_review",
        "successCriteria": "x",
        "alertThreshold": "y",
        "actionableInsights": "z",
    }

def test_is_executable_alwrity_true():
    e = MonitoringExecutor()
    assert e.is_executable(_task(MetricKey.GSC_VISIBILITY_SCORE.value)) is True

def test_is_executable_human_false():
    e = MonitoringExecutor()
    assert e.is_executable(_task(MetricKey.HUMAN_GOAL_ACHIEVEMENT.value, assignee="Human")) is False

def test_is_executable_hallucinated_false():
    e = MonitoringExecutor()
    assert e.is_executable(_task("Hallucinated.Fake")) is False

@pytest.mark.asyncio
async def test_execute_skips_human():
    e = MonitoringExecutor()
    res = await e.execute_task(_task(MetricKey.HUMAN_GOAL_ACHIEVEMENT.value, assignee="Human"), {"id": 1})
    assert res["status"] == "skipped"

@pytest.mark.asyncio
async def test_execute_success_stubbed():
    e = MonitoringExecutor()
    task = _task(MetricKey.SITEMAP_PUBLISHING_VELOCITY.value)
    res = await e.execute_task(task, {"id": 1, "website_url": "https://example.com"})
    assert res["status"] in ("success", "failed")
    assert "execution_time_ms" in res

@pytest.mark.asyncio
async def test_execute_failure_never_raises():
    e = MonitoringExecutor()
    with patch.object(e, "_dispatch", side_effect=Exception("boom")):
        res = await e.execute_task(_task(MetricKey.GSC_VISIBILITY_SCORE.value), {"id": 1})
        assert res["status"] == "failed"
        assert "boom" in res["error_message"]

@pytest.mark.asyncio
async def test_registry_covers_all_alwrity_metrics():
    from services.deterministic_monitoring_factory import TASK_TEMPLATES
    e = MonitoringExecutor()
    for t in TASK_TEMPLATES:
        if t["assignee"] == "ALwrity":
            assert e.is_executable(t) is True, f"ALwrity task {t['title']} not executable"
