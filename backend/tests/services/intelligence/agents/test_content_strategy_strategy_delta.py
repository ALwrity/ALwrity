"""Phase 3B: content strategist strategy-delta proposals (TDD).

Emits a task ONLY on real deltas: a roadmap milestone whose window has
arrived, or a KPI metric whose current period shows the value below target
per REAL monitoring evidence (never from predictions/mocks). No static
drumbeat when nothing is due — honest-absence preserved.
"""
import pytest

from services.intelligence.agents.specialized.content_strategy import ContentStrategyAgent


def _make_agent(context):
    agent = ContentStrategyAgent.__new__(ContentStrategyAgent)
    agent.user_id = "pytest_strategy_delta_user"
    agent.sif_service = None

    async def _passthrough(inner_context, proposals, **kwargs):
        return proposals

    agent._synthesize_task_proposals = _passthrough
    agent._remember_grounding(context)
    return agent


def _strategy_ctx(milestones=None, kpis=None, status="available",
                  created_at="2026-06-01T00:00:00"):
    return {
        "status": status,
        "strategy_id": 7,
        "created_at": created_at,
        "roadmap": milestones or [],
        "kpi_targets": kpis or [],
        "goals": [],
        "positioning": "",
    }


MILESTONE_NOW = [{"phase": "Phase 2", "milestone": "Scale",
                 "timeline": "Month 3-4", "status": "planned"}]
MILESTONE_FUTURE = [{"phase": "Phase 2", "milestone": "Scale",
                    "timeline": "Month 8-9", "status": "planned"}]
KPI_BELOW = [{"metric": "visibility_score", "target": "70", "period": "current"}]


def _monitoring_signal(kpi_metric="gsc.visibility_score", value=55):
    return {
        "status": "available", "overall": "degraded",
        "failed_tasks": [], "overdue_tasks": [], "human_pending": [],
        "kpi_last_values": {kpi_metric: value},
    }


def test_roadmap_milestone_window_arrived_emits_proposal():
    context = {
        "strategy_context": _strategy_ctx(milestones=MILESTONE_NOW),
        "strategy_monitoring": _monitoring_signal(),
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    delta = [p for p in proposals if p.synthesis_mode == "data_derived"]
    assert any("Scale" in (p.title or "") for p in delta)


def test_future_milestone_emits_nothing():
    context = {
        "strategy_context": _strategy_ctx(milestones=MILESTONE_FUTURE),
        "strategy_monitoring": _monitoring_signal(),
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    delta = [p for p in proposals if p.synthesis_mode == "data_derived"]
    assert delta == []


def test_kpi_below_target_from_real_evidence_emits_proposal():
    context = {
        "strategy_context": _strategy_ctx(kpis=KPI_BELOW),
        "strategy_monitoring": _monitoring_signal(value=55),
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))

    delta = [p for p in proposals if p.synthesis_mode == "data_derived"]
    assert any("visibility_score" in (p.title or "") for p in delta)


def test_kpi_meets_or_no_evidence_emits_nothing():
    # Meets target (or no real last value) -> no delta task, no fabrication
    ctx_ok = {
        "strategy_context": _strategy_ctx(kpis=KPI_BELOW),
        "strategy_monitoring": _monitoring_signal(value=80),
        "onboarding_data": {},
    }
    agent = _make_agent(ctx_ok)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(ctx_ok))
    assert all(p.synthesis_mode != "data_derived" for p in proposals)

    ctx_no_evidence = {
        "strategy_context": _strategy_ctx(kpis=KPI_BELOW),
        "strategy_monitoring": {"status": "available", "overall": "healthy"},
        "onboarding_data": {},
    }
    agent2 = _make_agent(ctx_no_evidence)
    proposals2 = __import__("asyncio").run(agent2.propose_daily_tasks(ctx_no_evidence))
    assert all(p.synthesis_mode != "data_derived" for p in proposals2)


def test_inactive_strategy_emits_nothing():
    context = {
        "strategy_context": _strategy_ctx(milestones=MILESTONE_NOW, status="inactive"),
        "strategy_monitoring": _monitoring_signal(),
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))
    assert all(p.synthesis_mode != "data_derived" for p in proposals)


def test_bare_kpi_name_resolves_to_canonical_evidence_key():
    """Strategy KPI 'visibility_score' must find evidence stored under the
    canonical 'gsc.visibility_score' key (Phase 6c end-to-end)."""
    context = {
        "strategy_context": _strategy_ctx(
            kpis=[{"metric": "visibility_score", "target": "70", "period": "current"}]),
        "strategy_monitoring": {
            "status": "available", "overall": "degraded",
            "failed_tasks": [], "overdue_tasks": [], "human_pending": [],
            "kpi_last_values": {"gsc.visibility_score": 55},
        },
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))
    delta = [p for p in proposals if p.synthesis_mode == "data_derived"]
    assert any("visibility_score" in (p.title or "") for p in delta)


def test_unmappable_kpi_name_emits_nothing():
    """Bare KPI name that resolves to NO canonical metric -> no fabrication."""
    context = {
        "strategy_context": _strategy_ctx(
            kpis=[{"metric": "sales_pipeline", "target": "10", "period": "current"}]),
        "strategy_monitoring": {
            "status": "available", "overall": "healthy",
            "failed_tasks": [], "overdue_tasks": [], "human_pending": [],
            "kpi_last_values": {},
        },
        "onboarding_data": {},
    }
    agent = _make_agent(context)
    proposals = __import__("asyncio").run(agent.propose_daily_tasks(context))
    assert all(p.synthesis_mode != "data_derived" for p in proposals)