from services.daily_meeting_preflight import build_agent_evidence, run_daily_meeting_preflight
from services.intelligence.agents.core_agent_framework import TaskProposal


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
