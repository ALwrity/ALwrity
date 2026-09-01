"""
TDD Tests for the POST /api/today-workflow/retry-agent endpoint.

The endpoint is thin glue over retry_agent_proposals (unit-tested in
test_today_workflow_retry.py) plus the already-tested _build_workflow_payload.
These tests focus on the endpoint's guardrails (auth-less state validation)
and its wiring/response shape.
"""
from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.base import Base


@pytest.fixture()
def dbctx():
    from models import daily_workflow_models  # noqa: F401  (register tables on Base)

    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    dbsession = sessionmaker(bind=engine)()
    try:
        yield _Ctx(session=dbsession, engine=engine)
    finally:
        dbsession.close()
        engine.dispose()


class _Ctx:
    def __init__(self, session, engine):
        self.session = session
        self.engine = engine


def _make_plan(db, evidence):
    from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask

    plan = DailyWorkflowPlan(
        user_id="u1",
        date="2026-01-01",
        source="preview",
        generation_mode="agent_committee",
        committee_agent_count=1,
        fallback_used=False,
        plan_json={"tasks": [], "agent_evidence": evidence, "digest": {"status": "enqueued"}},
        created_at=datetime(2026, 1, 1, 9, 0),
        updated_at=datetime(2026, 1, 1, 9, 0),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    task = DailyWorkflowTask(
        plan_id=plan.id,
        user_id="u1",
        pillar_id="analyze",
        title="teammate-task",
        description="desc",
        status="pending",
        priority="medium",
        estimated_time=15,
        enabled=True,
        metadata_json={"source_agent": "seo_specialist"},
    )
    db.add(task)
    db.commit()
    return plan


async def _call_retry(db, body, date="2026-01-01"):
    from api.today_workflow import retry_agent, RetryAgentRequest

    if isinstance(body, str):
        body = RetryAgentRequest(agent_key=body)
    return await retry_agent(
        body=body,
        date=date,
        current_user={"id": "u1"},
        db=db,
    )


@pytest.mark.asyncio
async def test_retry_agent_404_when_no_plan(monkeypatch, dbctx):
    from api.today_workflow import retry_agent, RetryAgentRequest

    with pytest.raises(HTTPException) as exc:
        await retry_agent(
            body=RetryAgentRequest(agent_key="content_strategist"),
            current_user={"id": "ghost"},
            db=dbctx.session,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_retry_agent_rejects_declined_agent(monkeypatch, dbctx):
    _make_plan(dbctx.session, evidence=[
        {"agent": "content_strategist", "declined": True, "message": "I have nothing to contribute"},
    ])

    with pytest.raises(HTTPException) as exc:
        await _call_retry(dbctx.session, "content_strategist")
    assert exc.value.status_code == 400
    assert "declined" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_retry_agent_rejects_non_failed_agent(monkeypatch, dbctx):
    _make_plan(dbctx.session, evidence=[{"agent": "content_strategist", "error": None}])

    with pytest.raises(HTTPException) as exc:
        await _call_retry(dbctx.session, "content_strategist")
    assert exc.value.status_code == 400
    assert "not currently in a failed state" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_retry_agent_wires_success_response(monkeypatch, dbctx):
    from services import today_workflow_service as svc
    import services.database as dbmod

    plan = _make_plan(dbctx.session, evidence=[
        {"agent": "content_strategist", "error": "LLM timed out"},
    ])

    async def _fake_retry(db, user_id, agent_key, date=None):
        assert agent_key == "content_strategist"
        return {"success": True, "agent": agent_key, "added_count": 1, "replaced_count": 0}

    def _fake_session_for_user(uid):
        return sessionmaker(bind=dbctx.engine)()

    monkeypatch.setattr(svc, "retry_agent_proposals", _fake_retry)
    monkeypatch.setattr(dbmod, "get_session_for_user", _fake_session_for_user)

    resp = await _call_retry(dbctx.session, "content_strategist")

    assert resp["success"] is True
    data = resp["data"]
    assert data["agent"] == "content_strategist"
    assert data["plan_id"] == plan.id
    # teammate task survives in the refreshed response
    titles = [t.get("title") for t in data["tasks"]]
    assert "teammate-task" in titles
    assert isinstance(data["agent_states"], list)
    assert isinstance(data["failed_agents"], list)
    assert isinstance(data["declined_agents"], list)
    assert data["digest"] == {"status": "enqueued"}
