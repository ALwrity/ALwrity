import pytest
from services.deterministic_monitoring_factory import DeterministicMonitoringFactory, TASK_TEMPLATES
from services.monitoring_metrics import ALLOWED_METRICS, ALLOWED_FREQUENCIES, ALLOWED_COMPONENTS, ALLOWED_ASSIGNEES
from services.monitoring_plan_generator import MonitoringPlanGenerator

def _strategy(competitors=None, sitemap=True, gsc=False):
    return {
        "id": 1,
        "name": "Test Strategy",
        "website_url": "https://example.com",
        "competitive_analysis": {"competitors": competitors or []},
        "sitemap_present": sitemap,
        "gsc_connected": gsc,
        "sitemap_analysis": {"total_urls": 100} if sitemap else None,
        "business_goals": ["traffic"],
        "content_pillars": ["AI"],
    }

def test_templates_each_metric_in_allow_list():
    for t in TASK_TEMPLATES:
        assert t["metric"] in ALLOWED_METRICS, f"Hallucinated metric {t['metric']}"
        assert t["frequency"] in ALLOWED_FREQUENCIES
        assert t["assignee"] in ALLOWED_ASSIGNEES
        assert t["component"] in ALLOWED_COMPONENTS

def test_templates_alwrity_has_executable_tool():
    for t in TASK_TEMPLATES:
        if t["assignee"] == "ALwrity":
            assert t["tool"] != "manual.human_review"
            assert "services." in t["tool"]

def test_build_plan_always_at_least_5():
    f = DeterministicMonitoringFactory()
    plan = f.build_plan(_strategy(competitors=["a.com"], sitemap=True, gsc=True))
    assert 6 <= plan["totalTasks"] <= 13
    assert plan["metricsCount"] == plan["totalTasks"]
    assert plan["alwrityTasks"] + plan["humanTasks"] == plan["totalTasks"]
    assert plan["deterministic"] is True

def test_presence_gating_competitors_absent_skips_serp():
    f = DeterministicMonitoringFactory()
    with_comp = f.build_plan(_strategy(competitors=["a.com"], sitemap=True, gsc=False))
    without_comp = f.build_plan(_strategy(competitors=[], sitemap=True, gsc=False))
    assert len(with_comp["monitoringTasks"]) > len(without_comp["monitoringTasks"])
    assert not any(t["metric"] == "serp.share_of_voice" for t in without_comp["monitoringTasks"])
    assert not any(t["metric"] == "competitor.content_count" for t in without_comp["monitoringTasks"])

def test_validator_accepts_deterministic_plan():
    f = DeterministicMonitoringFactory()
    plan = f.build_plan(_strategy(competitors=["a.com"]))
    gen = MonitoringPlanGenerator()
    assert gen._validate_monitoring_plan(plan) is True

def test_validator_rejects_hallucinated_metric():
    gen = MonitoringPlanGenerator()
    bad = {
        "monitoringTasks": [{
            "component": "Strategic Insights",
            "title": "Bad",
            "description": "x",
            "assignee": "ALwrity",
            "frequency": "Weekly",
            "metric": "Hallucinated.Fake_Metric_XYZ",
            "measurementMethod": "Competitive analysis",
            "successCriteria": "x",
            "alertThreshold": "y",
            "actionableInsights": "z",
            "tool": "services.fake"
        }],
        "totalTasks": 1,
        "alwrityTasks": 1,
        "humanTasks": 0,
        "metricsCount": 1
    }
    assert gen._validate_monitoring_plan(bad) is False

def test_validator_rejects_invalid_frequency():
    gen = MonitoringPlanGenerator()
    f = DeterministicMonitoringFactory()
    plan = f.build_plan(_strategy())
    plan["monitoringTasks"][0]["frequency"] = "Hourly"
    assert gen._validate_monitoring_plan(plan) is False

def test_deterministic_is_idempotent():
    f = DeterministicMonitoringFactory()
    s = _strategy(competitors=["a.com"])
    p1 = f.build_plan(s)
    p2 = f.build_plan(s)
    assert [t["metric"] for t in p1["monitoringTasks"]] == [t["metric"] for t in p2["monitoringTasks"]]
