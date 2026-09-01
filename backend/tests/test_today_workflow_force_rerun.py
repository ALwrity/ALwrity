"""
TDD Tests for the forced re-run of Today's Workflow preview.

``POST /preview?force=true`` ("Re-run preview") must re-run the committee
even when a plan already exists for the date, replacing the plan's tasks
and ``plan_json`` while preserving the digest and meeting linkage. Without
``force`` the call stays idempotent: an existing plan is returned as-is and
the committee is never re-run.
"""
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.base import Base


def _seed_plan(db, user_id="u1", date="2026-01-01"):
    from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask

    plan = DailyWorkflowPlan(
        user_id=user_id,
        date=date,
        source="preview",
        generation_mode="agent_committee",
        committee_agent_count=6,
        fallback_used=True,
        plan_json={
            "tasks": [
                {"pillarId": "plan", "title": "old-content-task", "metadata": {"source_agent": "content_strategist"}},
                {"pillarId": "analyze", "title": "teammate-task", "metadata": {"source_agent": "seo_specialist"}},
            ],
            "agent_evidence": [
                {"agent": "content_strategist", "error": "LLM timed out"},
            ],
            "digest": {"status": "enqueued"},
            "meeting_id": "meeting-1",
        },
        created_at=datetime(2026, 1, 1, 9, 0),
        updated_at=datetime(2026, 1, 1, 9, 0),
    )
    db.add(plan)
    db.flush()

    db.add(DailyWorkflowTask(
        plan_id=plan.id, user_id=user_id, pillar_id="plan",
        title="old-content-task", description="old", status="pending",
        priority="medium", estimated_time=15, enabled=True,
        metadata_json={"source_agent": "content_strategist"},
    ))
    db.add(DailyWorkflowTask(
        plan_id=plan.id, user_id=user_id, pillar_id="analyze",
        title="teammate-task", description="keep", status="pending",
        priority="medium", estimated_time=15, enabled=True,
        metadata_json={"source_agent": "seo_specialist"},
    ))
    db.commit()
    db.refresh(plan)
    return plan


def _fresh_committee_result():
    return {
        "tasks": [
            {
                "pillarId": "plan",
                "title": "fresh-content-task",
                "description": "fresh proposal",
                "priority": "high",
                "estimatedTime": 20,
                "actionType": "navigate",
                "actionUrl": "/content-planning-dashboard",
                "enabled": True,
                "metadata": {"source_agent": "content_strategist"},
            },
        ],
        "agent_evidence": [
            {"agent": "content_strategist", "error": None},
            {"agent": "seo_specialist", "error": None},
        ],
        "committee_agent_count": 6,
        "meeting_id": None,
        "digest": {"status": "skipped", "reason": "rerun"},
        "fallback_used": False,
    }


@pytest.fixture()
def dbsession(monkeypatch):
    from models import daily_workflow_models  # noqa: F401  (register tables on Base)

    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    # The service runs its persistence helpers in a threadpool via
    # services.database.get_session_for_user; route it to the test engine.
    import services.database as database_module

    monkeypatch.setattr(database_module, "get_session_for_user", lambda user_id: Session())

    s = Session()
    try:
        yield s
    finally:
        s.close()
        engine.dispose()


# ============================================================
# Service level: get_or_create_daily_workflow_plan(force_rerun=...)
# ============================================================

@pytest.mark.asyncio
async def test_no_force_returns_existing_without_rerun(monkeypatch, dbsession):
    """Without force an existing plan short-circuits; the committee never re-runs."""
    from services import today_workflow_service as svc

    plan = _seed_plan(dbsession)

    calls = {"count": 0}

    async def _must_not_run(*args, **kwargs):
        calls["count"] += 1
        raise AssertionError("committee must not re-run without force=true")

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _must_not_run)

    result_plan, created = await svc.get_or_create_daily_workflow_plan(
        dbsession, "u1", date="2026-01-01", creation_source="preview", allow_preview=True
    )

    assert created is False
    assert result_plan.id == plan.id
    assert calls["count"] == 0

    from models.daily_workflow_models import DailyWorkflowTask
    titles = {t.title for t in dbsession.query(DailyWorkflowTask).filter(
        DailyWorkflowTask.plan_id == plan.id).all()}
    assert titles == {"old-content-task", "teammate-task"}


@pytest.mark.asyncio
async def test_force_rerun_replaces_tasks_and_preserves_lifecycle(monkeypatch, dbsession):
    """force_rerun=True replaces all tasks + plan_json but keeps digest, meeting
    linkage and the plan row id; the committee runs with skip_meeting_lifecycle."""
    from services import today_workflow_service as svc

    plan = _seed_plan(dbsession)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})
    monkeypatch.setattr(svc, "_generate_calendar_event_plan", lambda date, grounding: {"tasks": []})

    calls = {"count": 0}

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             allow_preview=False, manual_override=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        calls["count"] += 1
        # A re-run must not create a new meeting or re-fire the digest.
        assert skip_meeting_lifecycle is True
        return _fresh_committee_result()

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)

    result_plan, created = await svc.get_or_create_daily_workflow_plan(
        dbsession, "u1", date="2026-01-01", creation_source="preview",
        allow_preview=True, force_rerun=True,
    )

    assert created is False, "a re-run replaces the row, it does not create a new one"
    assert result_plan.id == plan.id
    assert calls["count"] == 1

    from models.daily_workflow_models import DailyWorkflowTask
    titles = {t.title for t in dbsession.query(DailyWorkflowTask).filter(
        DailyWorkflowTask.plan_id == plan.id).all()}
    assert "fresh-content-task" in titles, "fresh committee task must be persisted"
    assert "old-content-task" not in titles, "stale tasks must be replaced"
    assert "teammate-task" not in titles, "a full re-run replaces ALL tasks, not one agent's"

    plan_json = result_plan.plan_json or {}
    # Digest from the first run must survive the re-run untouched.
    assert plan_json.get("digest", {}).get("status") == "enqueued"
    # Meeting linkage must survive (the re-run has no meeting of its own).
    assert plan_json.get("meeting_id") == "meeting-1"
    # Evidence is refreshed from the new committee output.
    agents = {ev.get("agent") for ev in plan_json.get("agent_evidence", [])}
    assert agents == {"content_strategist", "seo_specialist"}
    assert plan_json.get("agent_evidence", [])[0].get("error") is None
    # The plan row reflects the fresh (non-fallback) state.
    assert result_plan.fallback_used is False


@pytest.mark.asyncio
async def test_force_rerun_updates_committee_count(monkeypatch, dbsession):
    """committee_agent_count on the plan row follows the fresh committee run."""
    from services import today_workflow_service as svc

    plan = _seed_plan(dbsession)

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})
    monkeypatch.setattr(svc, "_generate_calendar_event_plan", lambda date, grounding: {"tasks": []})

    fresh = _fresh_committee_result()
    fresh["committee_agent_count"] = 4

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             allow_preview=False, manual_override=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        return fresh

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)

    result_plan, created = await svc.get_or_create_daily_workflow_plan(
        dbsession, "u1", date="2026-01-01", creation_source="preview",
        allow_preview=True, force_rerun=True,
    )

    assert created is False
    assert result_plan.committee_agent_count == 4


# ============================================================
# Endpoint level: POST /preview?force=true
# ============================================================

@pytest.fixture()
def dbctx(monkeypatch):
    from models import daily_workflow_models  # noqa: F401  (register tables on Base)

    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    import services.database as database_module

    monkeypatch.setattr(database_module, "get_session_for_user", lambda user_id: Session())

    s = Session()
    try:
        yield _Ctx(session=s, engine=engine)
    finally:
        s.close()
        engine.dispose()


class _Ctx:
    def __init__(self, session, engine):
        self.session = session
        self.engine = engine


def _wire_pipeline(monkeypatch, calls):
    from services import today_workflow_service as svc

    monkeypatch.setattr(svc, "build_grounding_context", lambda db, uid, d: {"onboarding_data": {}})
    monkeypatch.setattr(svc, "_generate_calendar_event_plan", lambda date, grounding: {"tasks": []})

    async def _fake_generate(db, user_id, date, grounding=None, strict_contextuality=False,
                             allow_preview=False, manual_override=False,
                             retry_agents=None, skip_meeting_lifecycle=False, **kwargs):
        calls["count"] += 1
        calls["skip_lifecycle"] = skip_meeting_lifecycle
        return _fresh_committee_result()

    monkeypatch.setattr(svc, "generate_agent_enhanced_plan", _fake_generate)


async def _call_preview(db, force):
    from api.today_workflow import preview_workflow

    return await preview_workflow(
        date="2026-01-01",
        force=force,
        current_user={"id": "u1"},
        db=db,
    )


@pytest.mark.asyncio
async def test_preview_without_force_is_idempotent(monkeypatch, dbctx):
    from services import today_workflow_service as svc

    plan = _seed_plan(dbctx.session)
    calls = {"count": 0, "skip_lifecycle": None}
    _wire_pipeline(monkeypatch, calls)

    resp = await _call_preview(dbctx.session, force=False)

    assert resp["success"] is True
    data = resp["data"]
    assert data["plan_id"] == plan.id
    assert calls["count"] == 0, "preview without force must not re-run the committee"
    titles = [t.get("title") for t in data["tasks"]]
    assert set(titles) == {"old-content-task", "teammate-task"}


@pytest.mark.asyncio
async def test_preview_with_force_reruns_committee(monkeypatch, dbctx):
    from services import today_workflow_service as svc

    plan = _seed_plan(dbctx.session)
    calls = {"count": 0, "skip_lifecycle": None}
    _wire_pipeline(monkeypatch, calls)

    resp = await _call_preview(dbctx.session, force=True)

    assert resp["success"] is True
    data = resp["data"]
    assert data["plan_id"] == plan.id, "re-run keeps the same plan row"
    assert calls["count"] == 1
    assert calls["skip_lifecycle"] is True, "re-run must skip meeting/digest lifecycle"
    titles = [t.get("title") for t in data["tasks"]]
    assert "fresh-content-task" in titles
    assert "old-content-task" not in titles
