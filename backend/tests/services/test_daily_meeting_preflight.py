from services.daily_meeting_preflight import build_agent_evidence, run_daily_meeting_preflight
from services.intelligence.agents.core_agent_framework import TaskProposal
from unittest.mock import patch   # noqa: E402


def test_missing_onboarding_blocks_tenant_meeting_without_inventing_tasks():
    result = run_daily_meeting_preflight(
        user_id="tenant-1",
        db=object(),
        grounding={},
        meeting_date="2026-08-24",
    )

    assert result["blocking"] is True
    assert result["checks"]["onboarding"]["status"] == "missing"
    assert result["limitations"]


def test_preflight_reports_provider_and_freshness_facts():
    result = run_daily_meeting_preflight(
        user_id="tenant-1",
        db=None,
        grounding={
            "onboarding_data": {
                "website_analysis": {"website_url": "https://example.com"},
                "onboarding_session": {"current_step": 4},
                "platform_integrations": [{"platform": "gsc"}],
                "data_quality": {"freshness": 0.9},
            }
        },
        meeting_date="2026-08-24",
    )

    assert result["blocking"] is False
    assert result["checks"]["onboarding"]["status"] == "available"
    assert result["checks"]["providers"]["status"] == "available"
    assert result["checks"]["freshness"]["status"] == "available"


def test_agent_evidence_envelope_preserves_proposal_fields():
    proposal = TaskProposal(
        title="Refresh low CTR page",
        description="Rewrite the title and meta description using GSC evidence.",
        pillar_id="analyze",
        priority="high",
        estimated_time=30,
        source_agent="ContentStrategyAgent",
        reasoning="The page has impressions but low CTR.",
        evidence="gsc:page:/guide",
        expected_impact="Higher organic CTR",
        effort="medium",
        kpi="organic_ctr",
        deadline="this week",
        action_type="navigate",
        action_parameters={"target_url": "/guide"},
        context_data={"confidence": 0.8},
    )

    result = build_agent_evidence("content_strategist", [proposal])

    assert result["agent"] == "content_strategist"
    assert result["evidence"] == ["gsc:page:/guide"]
    assert result["analysis"] == proposal.reasoning
    assert result["confidence"] == 0.8
    assert result["proposed_tasks"][0]["action_parameters"] == {"target_url": "/guide"}
    assert result["kpi"] == ["organic_ctr"]
    assert result["required_action_parameters"] == [{"target_url": "/guide"}]


def test_agent_evidence_records_empty_result_without_fake_confidence():
    result = build_agent_evidence("seo_specialist", [])

    assert result["proposed_tasks"] == []
    assert result["evidence"] == []
    assert result["confidence"] == 0.0


# ── Phase 4: strategy_monitoring preflight check ──────────────────────────
def test_preflight_includes_monitoring_check():
    import services.daily_meeting_preflight as preflight

    envelope = {
        "status": "available", "strategy_id": 7, "overall": "degraded",
        "success_rate": 0.67,
        "failed_tasks": [{"id": 10, "title": "GSC", "metric": "gsc.ctr",
                          "error_message": "GSC 403"}],
        "overdue_tasks": [{"id": 11, "title": "SERP"}],
        "human_pending": [{"id": 12, "title": "Review"}],
    }
    with patch.object(preflight, "build_strategy_monitoring_evidence",
                      return_value=envelope):
        result = run_daily_meeting_preflight(
            user_id="tenant-1", db=object(), grounding={},
            meeting_date="2026-08-24",
        )
    check = result["checks"]["strategy_monitoring"]
    assert check["status"] == "degraded"
    assert check["overall"] == "degraded"
    assert check["failed_tasks"] == 1
    assert check["success_rate"] == 0.67
    assert any("degraded" in lim for lim in result["limitations"])


def test_preflight_limitation_when_monitoring_error():
    import services.daily_meeting_preflight as preflight

    with patch.object(
        preflight,
        "build_strategy_monitoring_evidence",
        return_value={"status": "error", "limitations": ["boom"]},
    ):
        result = run_daily_meeting_preflight(
            user_id="tenant-1", db=object(), grounding={},
            meeting_date="2026-08-24",
        )
    check = result["checks"]["strategy_monitoring"]
    assert check["status"] == "error"
    assert any("Monitoring evidence" in lim or "monitoring evidence" in lim
               for lim in result["limitations"])


def test_preflight_monitoring_raise_degrades_and_does_not_crash():
    import services.daily_meeting_preflight as preflight

    with patch.object(
        preflight,
        "build_strategy_monitoring_evidence",
        side_effect=RuntimeError("boom"),
    ):
        result = run_daily_meeting_preflight(
            user_id="tenant-1", db=object(), grounding={},
            meeting_date="2026-08-24",
        )
    assert result["checks"]["strategy_monitoring"]["status"] == "error"
    assert result["checks"]["onboarding"]  # other checks intact
    assert result["limitations"]


# ── Phase 4: strategy_context preflight check ────────────────────────────
def test_preflight_includes_strategy_context_check():
    import services.daily_meeting_preflight as preflight

    envelope = {"status": "available", "strategy_id": 7, "name": "DocuTech"}
    with patch.object(preflight, "build_strategy_context",
                      return_value=envelope):
        result = run_daily_meeting_preflight(
            user_id="tenant-1", db=object(), grounding={},
            meeting_date="2026-08-24",
        )
    check = result["checks"]["strategy_context"]
    assert check["status"] == "available"
    assert check["strategy_id"] == 7


def test_preflight_limitation_when_strategy_context_error():
    import services.daily_meeting_preflight as preflight

    with patch.object(
        preflight,
        "build_strategy_context",
        return_value={"status": "error", "limitations": ["boom"]},
    ):
        result = run_daily_meeting_preflight(
            user_id="tenant-1", db=object(), grounding={},
            meeting_date="2026-08-24",
        )
    assert result["checks"]["strategy_context"]["status"] == "error"
    assert any("Strategy context" in lim or "strategy context" in lim
               for lim in result["limitations"])
