import pytest

from services.daily_meeting_review import prioritize_proposals, review_proposals, normalize_proposal
from services.intelligence.agents.core_agent_framework import TaskProposal


def proposal(title, description, priority="medium", **kwargs):
    return TaskProposal(
        title=title,
        description=description,
        pillar_id=kwargs.pop("pillar_id", "analyze"),
        priority=priority,
        estimated_time=kwargs.pop("estimated_time", 30),
        source_agent=kwargs.pop("source_agent", "agent-a"),
        reasoning=kwargs.pop("reasoning", "Grounded analysis"),
        evidence=kwargs.pop("evidence", "gsc:page:/guide"),
        expected_impact=kwargs.pop("expected_impact", "Improve performance"),
        effort=kwargs.pop("effort", "medium"),
        kpi=kwargs.pop("kpi", "organic_ctr"),
        action_type=kwargs.pop("action_type", "navigate"),
        action_parameters=kwargs.pop("action_parameters", {}),
        context_data=kwargs.pop("context_data", {"confidence": 0.8}),
    )


def test_normalize_proposal_has_stable_shared_contract():
    result = normalize_proposal(proposal("Review page", "Improve the page"))

    assert set(result) == {
        "recommendation_id", "agent", "title", "description", "pillar", "evidence",
        "reasoning", "priority", "expected_impact", "effort", "kpi", "deadline",
        "action_type", "action_parameters", "confidence",
        # Phase 2 honesty contract: how the proposal text was produced.
        "synthesis_mode",
        # Backward-compatibility aliases documented on the normalize output:
        # dict-shaped consumers read pillar_id / source_agent, and downstream
        # capacity math reads estimated_time.
        "pillar_id", "source_agent", "estimated_time",
    }
    assert result["recommendation_id"].startswith("rec-")
    assert result["evidence"] == ["gsc:page:/guide"]
    assert result["confidence"] == 0.8


@pytest.mark.asyncio
async def test_malformed_proposal_is_rejected_and_remains_in_review():
    result = await review_proposals([{"description": "Missing title", "pillar_id": "unknown"}], capacity_minutes=None)

    assert result["summary"]["rejected"] == 1
    assert len(result["normalized_proposals"]) == 1
    assert result["normalized_proposals"][0]["status"] == "rejected"
    assert result["normalized_proposals"][0]["review_reasons"]


@pytest.mark.asyncio
async def test_exact_duplicates_are_merged_and_not_silently_dropped():
    low = proposal("Refresh page", "Rewrite the title", "low", source_agent="agent-a")
    high = proposal("Refresh page", "Rewrite the title", "high", source_agent="agent-b")

    result = await review_proposals([low, high], capacity_minutes=None)

    assert result["summary"]["accepted"] == 1
    assert result["summary"]["merged"] == 1
    assert len(result["normalized_proposals"]) == 2
    merged = next(item for item in result["normalized_proposals"] if item["status"] == "merged")
    assert merged["merged_into"]


@pytest.mark.asyncio
async def test_conflicting_actions_are_quarantined():
    first = proposal(
        "Update guide", "Refresh guide content", action_parameters={"target_url": "/guide"}, action_type="navigate"
    )
    second = proposal(
        "Delete guide", "Remove obsolete guide", priority="high", action_parameters={"target_url": "/guide"}, action_type="external"
    )

    result = await review_proposals([first, second], capacity_minutes=None)

    assert result["summary"]["quarantined"] == 2
    assert all(item["review_reasons"] for item in result["normalized_proposals"])


@pytest.mark.asyncio
async def test_capacity_defers_lower_priority_work():
    first = proposal("High task", "Important task", "high", estimated_time=100)
    second = proposal("Low task", "Additional task", "low", estimated_time=100)

    result = await review_proposals([first, second], capacity_minutes=100)

    assert result["summary"]["accepted"] == 1
    assert result["summary"]["deferred"] == 1
    assert any("capacity" in reason for item in result["normalized_proposals"] for reason in item["review_reasons"])


class MemorySuppressionStub:
    db = object()

    def get_proposal_suppression_reason(self, proposal):
        return "recent task outcome requires deferral"


@pytest.mark.asyncio
async def test_recent_outcome_is_explicitly_deferred():
    result = await review_proposals(
        [proposal("Repeat task", "Repeat the same task")],
        memory_service=MemorySuppressionStub(),
        capacity_minutes=None,
    )

    assert result["summary"]["deferred"] == 1
    assert "recent task outcome" in result["normalized_proposals"][0]["review_reasons"][0]


def test_prioritization_returns_explainable_selection_factors():
    first = normalize_proposal(proposal(
        "Improve conversion funnel",
        "Use the business goal to improve conversion metrics today.",
        "high",
        pillar_id="analyze",
        deadline="today",
        expected_impact="Increase conversion rate",
    ))
    second = normalize_proposal(proposal(
        "Archive old notes",
        "Review low priority notes.",
        "low",
        pillar_id="plan",
        evidence=[],
        expected_impact="",
        deadline="",
    ))

    result = prioritize_proposals(
        [first, second],
        grounding={"onboarding_data": {"business_goals": ["increase conversion rate"]}},
        preflight={"checks": {"providers": {"status": "available"}}},
    )

    assert result[0]["title"] == "Improve conversion funnel"
    assert 0.0 <= result[0]["selection_score"] <= 1.0
    assert "business_goal_alignment" in result[0]["selection_factors"]
