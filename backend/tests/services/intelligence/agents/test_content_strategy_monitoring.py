"""Phase 3: content strategist consumes strategy_monitoring evidence (TDD).

Mirrors tests/services/intelligence/agents/test_content_strategy_dict_pillars.py
pattern: build agent via __new__ + override _synthesize_task_proposals with a
passthrough so no LLM is invoked. Asserts monitoring-derived proposals are
evidence-grounded and additive (never replace normal proposals).
"""
import pytest

from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent


def _make_agent(context):
    agent = ContentStrategyAgent.__new__(ContentStrategyAgent)
    agent.user_id = "pytest_monitoring_evidence_user"
    agent.sif_service = None

    async def _passthrough(inner_context, proposals, **kwargs):
        return proposals

    agent._synthesize_task_proposals = _passthrough
    agent._remember_grounding(context)
    return agent


DEGRADED_ENVELOPE = {
    "status": "available",
    "strategy_id": 7,
    "overall": "degraded",
    "success_rate": 0.67,
    "byResult": {"success": 2, "failed": 1},
    "failed_tasks": [
        {
            "id": 10,
            "title": "GSC Visibility Check",
            "metric": "gsc.visibility_score",
            "error_message": "GSC 403 quota exceeded",
            "last_executed": "2026-09-12T08:00:00",
        }
    ],
    "overdue_tasks": [
        {
            "id": 11,
            "title": "SERP Share of Voice",
            "metric": "serp.share_of_voice",
            "frequency": "Weekly",
            "next_execution": "2026-09-10T08:00:00",
        }
    ],
    "human_pending": [
        {
            "id": 12,
            "title": "Validate Competitive Intelligence",
            "metric": "human.intelligence_accuracy",
            "frequency": "Monthly",
            "status": "active",
        }
    ],
    "tasks": [],
}


def test_failed_monitor_imports_proposal():
    context = {"strategy_monitoring": DEGRADED_ENVELOPE, "onboarding_data": {}}
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    failed = [p for p in proposals if p.synthesis_mode == "data_derived"
              and "Investigat" in (p.title or "")]
    assert len(failed) == 1
    p = failed[0]
    assert "gsc.visibility_score" in p.title
    assert "GSC 403 quota exceeded" in p.reasoning
    assert p.pillar_id == "analyze"
    assert p.action_url == "/content-planning-dashboard"
    assert p.kpi == "monitoring_success_rate"
    assert p.context_data and p.context_data.get("monitoring_task_id") == 10


def test_degraded_adds_overdue_and_human_review():
    context = {"strategy_monitoring": DEGRADED_ENVELOPE, "onboarding_data": {}}
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    titles = [p.title for p in proposals if p.synthesis_mode == "data_derived"]
    assert any("Investigate" in t for t in titles)
    assert any("overdue" in (t or "").lower() for t in titles)
    assert any("Validate Competitive Intelligence" in t for t in titles)


def test_healthy_or_inactive_yields_no_monitoring_proposals():
    for overall in ("healthy", "inactive"):
        envelope = {"status": "available" if overall == "healthy" else "inactive",
                    "strategy_id": 7, "overall": overall,
                    "failed_tasks": [], "overdue_tasks": [], "human_pending": []}
        context = {"strategy_monitoring": envelope, "onboarding_data": {}}
        agent = _make_agent(context)
        proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))
        assert all(p.synthesis_mode != "data_derived" for p in proposals), \
            f"overall={overall} must not add data_derived monitoring proposals"


def test_missing_or_error_key_safe():
    # Missing key: no monitoring proposals, baseline (pillars-fallback) intact
    agent = _make_agent({"onboarding_data": {}})
    proposals = __import__("asyncio").run(agent.propose_daily_tasks({"onboarding_data": {}}))
    assert all(p.synthesis_mode != "data_derived" for p in proposals)

    # Error envelope (monitoring_evidence degraded) — no crash, no fabrications
    err_ctx = {"strategy_monitoring": {"status": "error", "limitations": ["boom"]},
               "onboarding_data": {}}
    agent2 = _make_agent(err_ctx)
    proposals2 = __import__("asyncio").run(agent2.propose_daily_tasks(err_ctx))
    assert all(p.synthesis_mode != "data_derived" for p in proposals2)


def test_monitoring_proposals_are_additive_not_replacing():
    """With pillars present, normal pillar proposal remains AND monitoring
    proposals are appended (never replace)."""
    context = {
        "strategy_monitoring": DEGRADED_ENVELOPE,
        "onboarding_data": {
            "research_preferences": {"content_pillars": ["AI Storytelling"]},
        },
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    titles = [p.title for p in proposals if p.synthesis_mode == "data_derived"]
    assert len(titles) == 3  # failed + overdue + human_review
    # normal pillar proposal still present
    pillar_titles = [p.title for p in proposals if p.synthesis_mode != "data_derived"]
    assert any("AI Storytelling" in t for t in pillar_titles)