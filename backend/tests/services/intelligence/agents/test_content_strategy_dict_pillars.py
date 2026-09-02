"""TDD tests for dict-shaped onboarding payloads in content_strategy.

Some onboarding payloads store ``content_pillars`` as a dict (form data
like ``{"0": {"topic": ...}}``) instead of a list. The agent previously
crashed with ``KeyError: 0`` (dict indexed with integer 0), which surfaced
as a "Failed" committee agent. Dict payloads must be normalized to lists.
"""
import pytest

from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent


def _make_agent(grounding):
    agent = ContentStrategyAgent.__new__(ContentStrategyAgent)
    agent.user_id = "pytest_dict_pillars_user"
    agent.sif_service = None

    async def _passthrough(context, proposals, **kwargs):
        return proposals

    agent._synthesize_task_proposals = _passthrough
    agent._remember_grounding(grounding)
    return agent


@pytest.mark.asyncio
async def test_dict_shaped_content_pillars_do_not_crash():
    """content_pillars as {"0": {...}} must produce a pillar-grounded
    proposal, not KeyError: 0."""
    grounding = {
        "onboarding_data": {
            "research_preferences": {
                "content_pillars": {"0": {"topic": "AI Storytelling"}, "1": {"topic": "Tool Comparisons"}},
            },
        },
    }
    agent = _make_agent(grounding)

    proposals = await agent.propose_daily_tasks({"onboarding_data": grounding["onboarding_data"]})

    titles = " | ".join(p.title for p in proposals)
    assert "AI Storytelling" in titles, f"pillar topic missing from titles: {titles}"


@pytest.mark.asyncio
async def test_dict_of_strings_pillars_uses_keys_as_names():
    grounding = {
        "onboarding_data": {
            "research_preferences": {
                "content_pillars": {"0": "Marketing Automation"},
            },
        },
    }
    agent = _make_agent(grounding)

    proposals = await agent.propose_daily_tasks({"onboarding_data": grounding["onboarding_data"]})

    titles = " | ".join(p.title for p in proposals)
    assert "Marketing Automation" in titles, f"pillar name missing: {titles}"
