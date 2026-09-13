import pytest
from unittest.mock import AsyncMock, patch
from services.monitoring_plan_generator import MonitoringPlanGenerator

@pytest.mark.asyncio
async def test_generate_monitoring_plan_deterministic():
    gen = MonitoringPlanGenerator()
    mock_strategy = {
        "id": 1,
        "name": "Demo Tech Strategy",
        "industry": "Technology",
        "business_goals": ["traffic"],
        "content_pillars": ["AI"],
        "target_audience": {},
        "competitive_analysis": {"competitors": ["competitor.com"]},
        "strategic_insights": {},
        "performance_predictions": {},
        "implementation_roadmap": {},
        "risk_assessment": {},
        "website_url": "https://example.com",
        "gsc_connected": True,
    }
    with patch.object(gen.strategy_service, "get_strategy_by_id", new=AsyncMock(return_value=mock_strategy)), \
         patch.object(gen.strategy_service, "save_monitoring_plan", new=AsyncMock(return_value=True)):
        plan = await gen.generate_monitoring_plan(strategy_id=1, user_id="1", use_deterministic=True)
        assert plan["deterministic"] is True
        assert 3 <= plan["totalTasks"] <= 13
        assert plan["metricsCount"] == plan["totalTasks"]
        assert gen._validate_monitoring_plan(plan) is True
        for t in plan["monitoringTasks"]:
            assert "component" in t and "metric" in t and "tool" in t

@pytest.mark.asyncio
async def test_generate_deterministic_direct():
    gen = MonitoringPlanGenerator()
    data = {
        "id": 2,
        "competitive_analysis": {"competitors": []},
        "website_url": "https://example.com",
    }
    plan = gen.generate_deterministic_plan(data, user_id="1")
    assert plan["deterministic"] is True
    assert any(t["metric"] == "monitoring.task_completion_rate" for t in plan["monitoringTasks"])
    # without competitors, serp tasks skipped
    assert not any(t["metric"] == "serp.share_of_voice" for t in plan["monitoringTasks"])
