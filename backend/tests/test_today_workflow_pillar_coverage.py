from types import SimpleNamespace

import json

import pytest

from services.intelligence.agents.core_agent_framework import TaskProposal


class DummyActivity:
    def __init__(self, *args, **kwargs):
        pass

    def start_run(self, *args, **kwargs):
        return SimpleNamespace(id="run-1")

    def log_event(self, *args, **kwargs):
        return None

    def finish_run(self, *args, **kwargs):
        return None


class DummyMemoryService:
    def __init__(self, user_id, db):
        pass

    async def filter_redundant_proposals(self, proposals):
        return proposals


class DummyAgent:
    def __init__(self, proposals):
        self._proposals = proposals

    async def propose_daily_tasks(self, grounding):
        return self._proposals


def _mock_orchestrator_with_agents(content_proposals=None, strategy_proposals=None):
    return SimpleNamespace(
        agents={
            "content": DummyAgent(content_proposals or []),
            "strategy": DummyAgent(strategy_proposals or []),
            "seo": None,
            "social": None,
            "competitor": None,
        }
    )


def _covered_pillars(result):
    return {task["pillarId"] for task in result["tasks"]}


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_preserves_full_committee_coverage(monkeypatch):
    # Import inside the test (not at module level) so ``svc`` binds to the
    # CURRENT sys.modules entry. Some suites re-import
    # ``services.today_workflow_service`` mid-run (env-override tests); a
    # module-level binding would patch an orphaned module object.
    from services import today_workflow_service as svc

    proposals = [
        TaskProposal("P", "desc", "plan", "high", 10, "content", "why", {}, "navigate", "/content-planning-dashboard"),
        TaskProposal("G", "desc", "generate", "high", 10, "content", "why", {}, "navigate", "/blog-writer"),
        TaskProposal("Pu", "desc", "publish", "high", 10, "content", "why", {}, "navigate", "/scheduler-dashboard"),
        TaskProposal("A", "desc", "analyze", "high", 10, "content", "why", {}, "navigate", "/seo-dashboard"),
        TaskProposal("E", "desc", "engage", "high", 10, "content", "why", {}, "navigate", "/linkedin-studio"),
        TaskProposal("R", "desc", "remarket", "high", 10, "content", "why", {}, "navigate", "/facebook-writer"),
    ]

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents(content_proposals=proposals)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == set(svc.PILLAR_IDS)
    assert len(result["tasks"]) == len(proposals)


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_backfill_off_leaves_missing_pillars_uncovered(monkeypatch):
    # Default backfill mode is ``off``: pillars the committee didn't cover
    # stay honestly absent rather than being filled with a generic template
    # or an invented LLM task.
    from services import today_workflow_service as svc

    proposals = [
        TaskProposal("P", "desc", "plan", "high", 10, "content", "why", {}, "navigate", "/content-planning-dashboard"),
        TaskProposal("G", "desc", "generate", "high", 10, "content", "why", {}, "navigate", "/blog-writer"),
    ]

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents(content_proposals=proposals)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == {"plan", "generate"}
    assert {"P", "G"}.issubset({task["title"] for task in result["tasks"]})


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_full_fallback_returns_empty_when_backfill_off(monkeypatch):
    # With backfill off and a fully dead committee (orchestrator agents None),
    # no pillar is uncovered with a fabricated template.
    from services import today_workflow_service as svc

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents()

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)
    monkeypatch.setattr(svc, "AgentActivityService", DummyActivity)

    def _raise_llm(*args, **kwargs):
        raise RuntimeError("LLM down")

    monkeypatch.setattr(svc, "llm_text_gen", _raise_llm)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert result["tasks"] == []
    assert _covered_pillars(result) == set()


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_backfill_on_restores_coverage(monkeypatch):
    # Explicitly opting in via env re-enables coverage (LLM backfill with
    # controlled fallback). Missing pillars are covered again.
    monkeypatch.setenv("TODAY_WORKFLOW_PILLAR_BACKFILL", "on")
    from services import today_workflow_service as svc

    proposals = [
        TaskProposal("P", "desc", "plan", "high", 10, "content", "why", {}, "navigate", "/content-planning-dashboard"),
        TaskProposal("G", "desc", "generate", "high", 10, "content", "why", {}, "navigate", "/blog-writer"),
    ]

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents(content_proposals=proposals)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    def _fake_llm(*args, **kwargs):
        return json.dumps({
            "pillarId": "publish",
            "title": "Review publishing queue",
            "description": "Sanity check the queue",
            "priority": "medium",
            "estimatedTime": 15,
            "actionType": "navigate",
            "actionUrl": "/scheduler-dashboard",
            "enabled": True,
            "metadata": {},
        })

    monkeypatch.setattr(svc, "llm_text_gen", _fake_llm)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == set(svc.PILLAR_IDS)


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_strategy_plan_task_survives_dedupe_and_coverage(monkeypatch):
    from services import today_workflow_service as svc

    content_proposals = [
        TaskProposal(
            "Review Strategic Goals",
            "desc",
            "plan",
            "medium",
            10,
            "ContentStrategyAgent",
            "why",
            {},
            "navigate",
            "/content-planning-dashboard",
        ),
    ]
    strategy_proposals = [
        TaskProposal(
            "Review Strategic Goals",
            "desc",
            "plan",
            "high",
            10,
            "StrategyArchitectAgent",
            "why",
            {},
            "navigate",
            "/content-planning-dashboard",
        ),
    ]

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents(
            content_proposals=content_proposals,
            strategy_proposals=strategy_proposals,
        )

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)
    monkeypatch.setattr(svc, "TaskMemoryService", DummyMemoryService)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == {"plan"}
    plan_tasks = [task for task in result["tasks"] if task["pillarId"] == "plan"]
    assert any(
        task["title"] == "Review Strategic Goals"
        and task["metadata"].get("source_agent") == "strategy_architect"
        for task in plan_tasks
    )
