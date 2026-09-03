"""TDD tests for the generic-defaults removal policy.

Policy: agents may keep DETERMINISTIC proposals derived from the user's own
data (onboarding fields, SIF counts, configuration gaps), but generic filler
tasks ("Review Strategic Goals", "Audit Old Content", ...) must no longer be
composable as default_proposals. When synthesis has nothing better, agents
decline honestly (or return empty) instead of shipping identical-for-everyone
filler.
"""
import pytest


def _stub_synthesis(agent):
    async def _passthrough(context, proposals, **kwargs):
        return proposals

    agent._synthesize_task_proposals = _passthrough
    return agent


THIN_GROUNDING = {"onboarding_data": {}}


def test_strategy_architect_no_generic_strategy_review():
    from services.intelligence.agents.specialized.strategy_architect import StrategyArchitectAgent

    agent = StrategyArchitectAgent.__new__(StrategyArchitectAgent)
    agent.user_id = "pytest_defaults_user"
    agent.agent_type = "strategy_architect"
    agent._remember_grounding(THIN_GROUNDING)
    _stub_synthesis(agent)

    async def _no_clusters():
        return []

    agent.discover_pillars = _no_clusters

    proposals = agent.propose_daily_tasks and None
    import asyncio

    proposals = asyncio.run(agent.propose_daily_tasks(THIN_GROUNDING))
    titles = [p.title for p in proposals]
    assert "Review Strategic Goals" not in titles, f"generic filler still composed: {titles}"


def test_seo_agent_no_generic_run_audit():
    import asyncio

    from services.intelligence.agents.specialized.seo_optimization import SEOOptimizationAgent

    agent = SEOOptimizationAgent.__new__(SEOOptimizationAgent)
    agent.user_id = "pytest_defaults_user"
    agent.sif_service = None
    agent._remember_grounding(THIN_GROUNDING)
    _stub_synthesis(agent)

    proposals = asyncio.run(agent.propose_daily_tasks(THIN_GROUNDING))
    titles = [p.title for p in proposals]
    assert "Run SEO Audit" not in titles, f"generic filler still composed: {titles}"


def test_competitor_agent_no_generic_research_topics():
    import asyncio

    from services.intelligence.agents.specialized.competitor_response import CompetitorResponseAgent

    agent = CompetitorResponseAgent.__new__(CompetitorResponseAgent)
    agent.user_id = "pytest_defaults_user"
    agent.sif_service = None
    agent._remember_grounding(THIN_GROUNDING)
    _stub_synthesis(agent)

    proposals = asyncio.run(agent.propose_daily_tasks(THIN_GROUNDING))
    titles = [p.title for p in proposals]
    assert "Research Competitor Topics" not in titles, f"generic filler still composed: {titles}"


def test_guardian_no_generic_audit_old_content():
    import asyncio

    from services.intelligence.agents.specialized.content_guardian import ContentGuardianAgent

    agent = ContentGuardianAgent.__new__(ContentGuardianAgent)
    agent.user_id = "pytest_defaults_user"
    agent._remember_grounding(THIN_GROUNDING)
    _stub_synthesis(agent)

    proposals = asyncio.run(agent.propose_daily_tasks(THIN_GROUNDING))
    titles = [p.title for p in proposals]
    assert "Audit Old Content" not in titles, f"generic filler still composed: {titles}"


def test_content_strategy_no_generic_quick_audit_but_keeps_config_gap_nudge():
    import asyncio

    from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent

    agent = ContentStrategyAgent.__new__(ContentStrategyAgent)
    agent.user_id = "pytest_defaults_user"
    agent.sif_service = None
    agent._remember_grounding(THIN_GROUNDING)
    _stub_synthesis(agent)

    proposals = asyncio.run(agent.propose_daily_tasks(THIN_GROUNDING))
    titles = [p.title for p in proposals]
    assert "Quick content performance audit" not in titles, f"generic filler still composed: {titles}"
    # context/config-gap derived tasks stay
    assert "Define your content pillars" in titles, f"config-gap nudge missing: {titles}"


def test_social_platform_tasks_still_context_derived():
    """Social tasks derive from the user's connected platforms — they are
    context-derived, not generic filler, and must keep working."""
    import asyncio

    from services.intelligence.agents.specialized.social_amplification import SocialAmplificationAgent

    agent = SocialAmplificationAgent.__new__(SocialAmplificationAgent)
    agent.user_id = "pytest_defaults_user"
    agent.sif_service = None
    grounding = {
        "onboarding_data": {
            "platform_integrations": {"connected_platforms": ["linkedin"]},
        },
    }
    agent._remember_grounding(grounding)
    _stub_synthesis(agent)

    proposals = asyncio.run(agent.propose_daily_tasks(grounding))
    titles = " | ".join(p.title for p in proposals)
    assert "linkedin" in titles.lower(), f"platform-derived task missing: {titles}"
