"""
TDD Tests for the per-agent retry feature (Phase 4).

Covers:
  - retry_agents filtering in generate_agent_enhanced_plan
  - skip_meeting_lifecycle (no meeting, no digest re-fire)
  - retry context injection + merge semantics in retry_agent_proposals
"""
from types import SimpleNamespace
import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from services.intelligence.agents.core_agent_framework import TaskProposal
from models.base import Base


def _proposal(title, source_agent, pillar="plan"):
    return TaskProposal(
        title=title,
        description=f"desc-{title}",
        pillar_id=pillar,
        priority="medium",
        estimated_time=15,
        source_agent=source_agent,
        reasoning="test reasoning",
        synthesis_mode="data_derived",
    )


class _RecordingAgent:
    """Agent that records the grounding it receives and returns proposals."""

    def __init__(self, proposals=None):
        self._proposals = proposals or []
        self.seen_grounding = None

    async def propose_daily_tasks(self, grounding):
        self.seen_grounding = grounding
        return self._proposals


class _RecordingDecliner:
    async def propose_daily_tasks(self, grounding):
        from services.intelligence.agents.core_agent_framework import AgentDeclined
        raise AgentDeclined()


def _make_orchestrator(agents):
    """agents: dict keyed by orchestrator slot -> not-yet-created instance factory."""
    return SimpleNamespace(agents=agents)


# ============================================================
# Group A: retry_agents + skip_meeting_lifecycle on the committee
# ============================================================

@pytest.mark.asyncio
async def test_retry_agents_filters_participants(monkeypatch):
    """Only the retried agent(s) are polled; other committee agents are skipped."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    content_agent = _RecordingAgent([_proposal("content-1", "content_strategist")])
    seo_agent = _RecordingAgent([_proposal("seo-1", "seo_specialist", pillar="analyze")])

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": content_agent,
            "strategy": None,
            "seo": seo_agent,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None,
        user_id="u1",
        date="2026-01-01",
        grounding={"onboarding_data": {}},
        retry_agents=["content_strategist"],
        skip_meeting_lifecycle=True,
    )

    evidence = result.get("agent_evidence", [])
    agents = {ev["agent"] for ev in evidence}
    assert agents == {"content_strategist"}, f"expected only content_strategist, got {agents}"
    # only the retried agent's accepted task survives into tasks
    titles = {t.get("title") for t in result.get("tasks", [])}
    assert "content-1" in titles
    assert "seo-1" not in titles


@pytest.mark.asyncio
async def test_retry_still_records_retried_agent_failure(monkeypatch):
    """A retried agent that keeps failing is still surfaced as an error, not hidden."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    failing = _RecordingDecliner()

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": failing,
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None,
        user_id="u1",
        date="2026-01-01",
        grounding={"onboarding_data": {}},
        retry_agents=["content_strategist"],
        skip_meeting_lifecycle=True,
    )

    declined = [ev for ev in result.get("agent_evidence", []) if ev.get("declined")]
    assert declined, "a declining retried agent must be reported as declined"


@pytest.mark.asyncio
async def test_skip_meeting_lifecycle_has_no_meeting_and_no_digest(monkeypatch):
    """Retries must not create a new meeting record or re-fire the email digest."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    content_agent = _RecordingAgent([_proposal("content-1", "content_strategist")])

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": content_agent,
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    result = await generate_agent_enhanced_plan(
        db=None,
        user_id="u1",
        date="2026-01-01",
        grounding={"onboarding_data": {}},
        retry_agents=["content_strategist"],
        skip_meeting_lifecycle=True,
    )

    assert result.get("meeting_id") is None
    digest = result.get("digest") or {}
    # a retry must never attempt/enqueue a new digest email
    assert digest.get("status") == "skipped", f"digest should be skipped on retry, got {digest}"


@pytest.mark.asyncio
async def test_retry_context_injected_into_agent_grounding(monkeypatch):
    """The service injects retry context (prior failure + teammate tasks) into grounding."""
    from services import today_workflow_service as svc
    from services.today_workflow_agents import generate_agent_enhanced_plan

    content_agent = _RecordingAgent([_proposal("content-1", "content_strategist")])

    async def _get_orchestrator(user_id):
        return SimpleNamespace(agents={
            "content": content_agent,
            "strategy": None,
            "seo": None,
            "social": None,
            "competitor": None,
            "content_gap_radar": None,
        })

    monkeypatch.setattr(svc.orchestration_service, "get_or_create_orchestrator", _get_orchestrator)

    grounding = {
        "onboarding_data": {},
        "retry": {
            "agent": "content_strategist",
            "prior_error": {"message": "LLM timed out", "state": "error"},
            "meeting_context": [{"title": "teammate-task", "pillarId": "plan", "source_agent": "seo_specialist"}],
        },
    }

    await generate_agent_enhanced_plan(
        db=None,
        user_id="u1",
        date="2026-01-01",
        grounding=grounding,
        retry_agents=["content_strategist"],
        skip_meeting_lifecycle=True,
    )

    seen = content_agent.seen_grounding or {}
    assert seen.get("retry", {}).get("agent") == "content_strategist"
    assert "prior_error" in seen.get("retry", {})
    assert len(seen.get("retry", {}).get("meeting_context", [])) == 1


# ============================================================
# Group B: retry_agent_proposals merge semantics (in-memory DB)
# ============================================================

@pytest.fixture()
def dbsession():
    from models import daily_workflow_models  # noqa: F401  (register tables on Base)

    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    s = Session()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


def _make_plan(db, user_id="u1", date="2026-01-01", plan_json=None):
    from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask

    plan = DailyWorkflowPlan(
        user_id=user_id,
        date=date,
        source="preview",
        generation_mode="agent_committee",
        committee_agent_count=5,
        fallback_used=False,
        plan_json=plan_json or {
            "tasks": [],
            "agent_evidence": [],
            "digest": {"status": "enqueued"},
        },
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _make_task(db, plan_id, user_id, pillar, title, source_agent):
    from models.daily_workflow_models import DailyWorkflowTask

    task = DailyWorkflowTask(
        plan_id=plan_id,
        user_id=user_id,
        pillar_id=pillar,
        title=title,
        description=f"desc-{title}",
        status="pending",
        priority="medium",
        estimated_time=15,
        action_type="navigate",
        enabled=True,
        metadata_json={"source_agent": source_agent},
    )
    db.add(task)
    return task


@pytest.mark.asyncio
async def test_retry_replaces_only_target_agents_tasks(monkeypatch, dbsession):
    """On retry, the retried agent's tasks are replaced; other agents' tasks survive."""
    from services import today_workflow_service as svc

    plan = _make_plan(dbsession)
    _make_task(dbsession, plan.id, "u1", "plan", "old-content-task", "content_strategist")
    _make_task(dbsession, plan.id, "u1", "analyze", "teammate-task", "seo_specialist")
    dbsession.commit()

    retried_tasks = [{
        "pillarId": "plan",
        "title": "new-content-task",
        "description": "fresh",
        "priority": "high",
        "estimatedTime": 20,
        "actionType": "navigate",
        "actionUrl": None,
        "enabled": True,
        "metadata": {"source_agent": "content_strategist", "reasoning": "retried"},
    }]

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        assert retry_agents == ["content_strategist"]
        assert skip_meeting_lifecycle is True
        assert grounding.get("retry", {}).get("agent") == "content_strategist"
        return {
            "tasks": retried_tasks,
            "agent_evidence": [{"agent": "content_strategist", "error": None}],
            "meeting_id": None,
            "digest": {"status": "skipped", "reason": "retry"},
        }

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)
    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})

    result = await svc.retry_agent_proposals(
        dbsession, "u1", "content_strategist", date="2026-01-01"
    )

    assert result["success"] is True
    assert result["agent"] == "content_strategist"
    dbsession.refresh(plan)

    from models.daily_workflow_models import DailyWorkflowTask
    titles = {t.title for t in dbsession.query(DailyWorkflowTask).filter(
        DailyWorkflowTask.plan_id == plan.id).all()}
    assert "new-content-task" in titles
    assert "old-content-task" not in titles, "old task from retried agent must be replaced"
    assert "teammate-task" in titles, "teammate tasks from other agents must survive"

    # digest must remain untouched (still 'enqueued' from the original plan merge)
    updated_plan_json = db_lookup_plan_json(dbsession, plan.id)
    assert updated_plan_json.get("digest", {}).get("status") == "enqueued"


def db_lookup_plan_json(db, plan_id):
    from models.daily_workflow_models import DailyWorkflowPlan
    return db.query(DailyWorkflowPlan).filter(DailyWorkflowPlan.id == plan_id).first().plan_json or {}


@pytest.mark.asyncio
async def test_retry_returns_zero_when_agent_still_fails(monkeypatch, dbsession):
    """If the retried agent keeps failing, the merge leaves the plan as-is."""
    from services import today_workflow_service as svc

    plan = _make_plan(dbsession)
    _make_task(dbsession, plan.id, "u1", "analyze", "teammate-task", "seo_specialist")
    dbsession.commit()

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        return {
            "tasks": [],
            "agent_evidence": [{"agent": "content_strategist", "error": "still failing"}],
            "meeting_id": None,
            "digest": {"status": "skipped", "reason": "retry"},
        }

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)
    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})

    result = await svc.retry_agent_proposals(
        dbsession, "u1", "content_strategist", date="2026-01-01"
    )

    assert result["success"] is True
    assert result["agent"] == "content_strategist"
    assert result.get("added_count") == 0

    from models.daily_workflow_models import DailyWorkflowTask
    titles = {t.title for t in dbsession.query(DailyWorkflowTask).filter(
        DailyWorkflowTask.plan_id == plan.id).all()}
    assert titles == {"teammate-task"}


@pytest.mark.asyncio
async def test_retry_writes_shared_note_and_activity_log(monkeypatch, dbsession):
    """A successful per-agent retry is recorded in the VFS shared scratchpad
    (collaboration note + activity log) for cross-agent coordination."""
    import json
    import uuid
    import shutil
    from pathlib import Path

    from services import today_workflow_service as svc

    user_id = "u1"
    plan = _make_plan(dbsession)
    _make_task(dbsession, plan.id, user_id, "plan", "old-content-task", "content_strategist")
    dbsession.commit()

    retried_tasks = [{
        "pillarId": "plan",
        "title": "new-content-task",
        "description": "fresh",
        "priority": "high",
        "estimatedTime": 20,
        "actionType": "navigate",
        "actionUrl": None,
        "enabled": True,
        "metadata": {"source_agent": "content_strategist"},
    }]

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        return {
            "tasks": retried_tasks,
            "agent_evidence": [{"agent": "content_strategist", "error": None}],
            "meeting_id": None,
            "digest": {"status": "skipped", "reason": "retry"},
        }

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)
    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})

    workspace = Path(__file__).resolve().parents[2] / "workspace" / f"workspace_{user_id}"
    try:
        result = await svc.retry_agent_proposals(dbsession, user_id, "content_strategist", date="2026-01-01")
        assert result["success"] is True

        scratchpad = workspace / "scratchpad"
        note_file = scratchpad / "collaboration.md"
        log_file = scratchpad / "activity_log.jsonl"

        assert note_file.exists(), f"retry note missing: {note_file}"
        note_text = note_file.read_text(encoding="utf-8")
        assert "content_strategist" in note_text
        assert "retry" in note_text.lower()

        entries = [json.loads(l) for l in log_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        assert any(e.get("event_type") == "agent_retry_completed" for e in entries), f"missing retry entry: {entries}"
    finally:
        if workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True)


@pytest.mark.asyncio
async def test_retry_requires_existing_plan(dbsession):
    """Retrying with no existing plan returns an explicit not-found error."""
    from services import today_workflow_service as svc
    result = await svc.retry_agent_proposals(
        dbsession, "ghost", "content_strategist", date="2026-01-01"
    )
    assert result["success"] is False
    assert "no plan" in (result.get("error") or "").lower()
