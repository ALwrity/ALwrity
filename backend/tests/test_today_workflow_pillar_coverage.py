from types import SimpleNamespace

import pytest

from services.intelligence.agents.core_agent_framework import TaskProposal
from services import today_workflow_service as svc


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
async def test_generate_agent_enhanced_plan_backfills_missing_committee_pillars(monkeypatch):
    proposals = [
        TaskProposal("P", "desc", "plan", "high", 10, "content", "why", {}, "navigate", "/content-planning-dashboard"),
        TaskProposal("G", "desc", "generate", "high", 10, "content", "why", {}, "navigate", "/blog-writer"),
    ]

    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents(content_proposals=proposals)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == set(svc.PILLAR_IDS)
    assert {"P", "G"}.issubset({task["title"] for task in result["tasks"]})


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_full_fallback_path_still_covers_all_pillars(monkeypatch):
    async def _get_orchestrator(user_id):
        return _mock_orchestrator_with_agents()

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, user_id, date: {})
    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)
    monkeypatch.setattr(svc, "AgentActivityService", DummyActivity)

    def _raise_llm(*args, **kwargs):
        raise RuntimeError("LLM down")

    monkeypatch.setattr(svc, "llm_text_gen", _raise_llm)

    result = await svc.generate_agent_enhanced_plan(db=None, user_id="u1", date="2026-01-01")

    assert _covered_pillars(result) == set(svc.PILLAR_IDS)
    assert len(result["tasks"]) >= len(svc.PILLAR_IDS)


@pytest.mark.asyncio
async def test_generate_agent_enhanced_plan_strategy_plan_task_survives_dedupe_and_coverage(monkeypatch):
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

    assert _covered_pillars(result) == set(svc.PILLAR_IDS)
    plan_tasks = [task for task in result["tasks"] if task["pillarId"] == "plan"]
    assert any(
        task["title"] == "Review Strategic Goals"
        and task["metadata"].get("source_agent") == "strategy_architect"
        for task in plan_tasks
    )
