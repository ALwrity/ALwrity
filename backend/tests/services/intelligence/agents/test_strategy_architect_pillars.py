"""TDD tests for strategy_architect's pillar-aware fallback (Phase A3 gap).

When SIF clustering finds no pillars (empty/thin index), the agent must use
the content pillars already known from the user's onboarding context
(research preferences / website analysis style insights) to propose
pillar-grounded tasks instead of the generic "Establish Content Pillars".
"""
import pytest

from services.intelligence.agents.specialized.strategy_architect import StrategyArchitectAgent


def _make_agent(grounding):
    agent = StrategyArchitectAgent.__new__(StrategyArchitectAgent)
    agent.user_id = "pytest_pillar_user"
    agent.agent_type = "strategy_architect"
    agent._remember_grounding(grounding)

    async def _no_clusters():
        return []

    agent.discover_pillars = _no_clusters

    async def _passthrough(context, proposals, **kwargs):
        return proposals

    agent._synthesize_task_proposals = _passthrough
    return agent


GROUNDING_WITH_PILLARS = {
    "onboarding_data": {
        "research_preferences": {
            "content_pillars": ["AI-Powered Storytelling", "Tool Comparisons"],
        },
    }
}


@pytest.mark.asyncio
async def test_known_pillars_drive_proposals_when_clustering_fails():
    agent = _make_agent(GROUNDING_WITH_PILLARS)

    proposals = await agent.propose_daily_tasks({"onboarding_data": GROUNDING_WITH_PILLARS["onboarding_data"]})

    titles = " | ".join(p.title for p in proposals)
    lowered = titles.lower()
    assert "ai-powered storytelling" in lowered, f"known pillar missing from titles: {titles}"
    assert "tool comparisons" in lowered, f"second known pillar missing: {titles}"
    assert "establish content pillars" not in lowered, (
        "generic fallback must be replaced by pillar-aware proposals"
    )


@pytest.mark.asyncio
async def test_generic_fallback_preserved_without_known_pillars():
    agent = _make_agent({"onboarding_data": {}})

    proposals = await agent.propose_daily_tasks({"onboarding_data": {}})

    titles = [p.title for p in proposals]
    assert "Establish Content Pillars" in titles, f"generic fallback missing: {titles}"


@pytest.mark.asyncio
async def test_pillar_source_falls_back_to_website_style_insights():
    grounding = {
        "onboarding_data": {
            "website_analysis": {
                "style_analysis": {
                    "content_strategy_insights": {"content_pillars": ["Workflow Automation"]},
                },
            },
        },
    }
    agent = _make_agent(grounding)

    proposals = await agent.propose_daily_tasks({"onboarding_data": grounding["onboarding_data"]})

    titles = " | ".join(p.title for p in proposals)
    assert "workflow automation" in titles.lower(), f"style-insight pillar missing: {titles}"
