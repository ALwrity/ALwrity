import pytest

from services.intelligence.agents.specialized.content_guardian import ContentGuardianAgent


def make_proposal(**overrides):
    result = {
        "recommendation_id": "rec-1",
        "agent": "content_strategist",
        "title": "Refresh guide",
        "description": "Update the guide based on observed search performance.",
        "pillar": "analyze",
        "evidence": ["gsc:page:/guide"],
        "reasoning": "Observed low CTR and enough impressions to justify a refresh.",
        "priority": "high",
        "expected_impact": "Improve organic CTR",
        "effort": "medium",
        "kpi": "organic_ctr",
        "deadline": "this week",
        "action_type": "navigate",
        "action_parameters": {"target_url": "/guide"},
        "confidence": 0.8,
    }
    result.update(overrides)
    return result


def make_guardian():
    guardian = object.__new__(ContentGuardianAgent)
    return guardian


@pytest.mark.asyncio
async def test_guardian_approves_grounded_proposal():
    result = await make_guardian().review_normalized_proposals([make_proposal()])

    assert result["summary"]["approved"] == 1
    assert result["decisions"][0]["guardian_outcome"] == "approved"
    assert result["decisions"][0]["guardian_reasons"] == []


@pytest.mark.asyncio
async def test_guardian_approves_with_warning_when_reasoning_is_missing():
    result = await make_guardian().review_normalized_proposals([make_proposal(reasoning="")])

    assert result["summary"]["approved_with_warning"] == 1
    assert "no reasoning" in " ".join(result["decisions"][0]["guardian_reasons"])


@pytest.mark.asyncio
async def test_guardian_quarantines_missing_evidence():
    result = await make_guardian().review_normalized_proposals([make_proposal(evidence=[])])

    assert result["summary"]["quarantined"] == 1
    assert "no evidence" in " ".join(result["decisions"][0]["guardian_reasons"])


@pytest.mark.asyncio
async def test_guardian_quarantines_unsafe_or_unparameterized_action():
    unsafe = make_proposal(description="Use fraud claims to attack competitors.")
    unsafe["action_type"] = "external"
    unsafe["action_parameters"] = {}

    result = await make_guardian().review_normalized_proposals([unsafe])

    assert result["summary"]["quarantined"] == 1
    reasons = " ".join(result["decisions"][0]["guardian_reasons"])
    assert "unsafe_term" in reasons
    assert "action parameters" in reasons


@pytest.mark.asyncio
async def test_guardian_rejects_missing_required_fields():
    result = await make_guardian().review_normalized_proposals([make_proposal(title="", description="")])

    assert result["summary"]["rejected"] == 1
    assert result["decisions"][0]["guardian_outcome"] == "rejected"
