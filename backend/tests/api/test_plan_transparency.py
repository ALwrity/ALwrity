"""TDD tests for plan transparency exposure (Phase 1b).

The preview and retry endpoints must surface the transparency data the
committee already records in plan_json: limitations, meeting preflight
checks, per-agent evidence (incl. SIF query provenance), proposal review
summary, guardian health, and plan quality/contextuality.
"""
import json
from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.base import Base


PLAN_JSON = {
    "tasks": [
        {
            "pillarId": "plan",
            "title": "Build Out Content Pillar: AI Storytelling",
            "metadata": {
                "source_agent": "strategy_architect",
                "reasoning": "Pillar comes from your onboarding content strategy",
                "selection_score": 0.82,
                "selection_factors": {"priority": 1.0, "evidence_quality": 0.6},
                "selection_reason": ["aligns with a stated business goal"],
                "synthesis_mode": "llm",
                "confidence": 0.75,
            },
        },
    ],
    "agent_evidence": [
        {
            "agent": "strategy_architect",
            "evidence": ["onboarding:content_pillars"],
            "analysis": "Pillars derived from onboarding research preferences",
            "confidence": 0.8,
            "expected_impact": ["topical authority"],
            "kpi": ["organic_ctr"],
            "sif_queries": [
                {"query": "content pillars strategy digital marketing", "limit": 8,
                 "result_count": 5, "outcome": "success", "trigger": "proposal",
                 "timestamp": "2026-09-02T00:00:00"}
            ],
        },
        {
            "agent": "content_strategist",
            "error": "ValueError: 0",
        },
    ],
    "limitations": [
        "SIF index was self-healed from local onboarding context before this run (+4 docs)",
        "Data freshness is stale; recommendations may be incomplete.",
    ],
    "meeting_preflight": {
        "checks": {
            "onboarding": {"status": "available", "message": "required onboarding context is present"},
            "freshness": {"status": "stale", "message": "Data freshness is stale"},
            "providers": {"status": "available", "message": "provider state evaluated"},
        },
        "limitations": ["Data freshness is stale"],
        "blocking": False,
    },
    "proposal_review": {
        "summary": {"accepted": 12, "rejected": 2, "merged": 1, "deferred": 0, "quarantined": 0},
        "normalized_proposals": [
            {"title": "Duplicate task", "status": "rejected", "review_reasons": ["unsupported pillar: unknown"]},
        ],
    },
    "guardian_review": {"summary": {"health_score": 88}, "decisions": [], "status": "completed"},
    "quality_status": "contextual",
    "contextuality_validation": {"is_contextual": True, "limitations": []},
    "digest": {"status": "enqueued"},
}


def _make_transparent_plan(db, user_id="u1", date="2026-01-01"):
    from models.daily_workflow_models import DailyWorkflowPlan, DailyWorkflowTask

    plan = DailyWorkflowPlan(
        user_id=user_id,
        date=date,
        source="preview",
        generation_mode="agent_committee",
        committee_agent_count=6,
        fallback_used=False,
        plan_json=json.loads(json.dumps(PLAN_JSON)),
        created_at=datetime(2026, 1, 1, 9, 0),
        updated_at=datetime(2026, 1, 1, 9, 0),
    )
    db.add(plan)
    db.flush()
    db.add(DailyWorkflowTask(
        plan_id=plan.id, user_id=user_id, pillar_id="plan",
        title="Build Out Content Pillar: AI Storytelling", description="d",
        status="pending", priority="high", estimated_time=45, enabled=True,
        metadata_json={
            "source_agent": "strategy_architect",
            "reasoning": "Pillar comes from your onboarding content strategy",
            "selection_score": 0.82,
            "selection_factors": {"priority": 1.0, "evidence_quality": 0.6},
            "selection_reason": ["aligns with a stated business goal"],
            "synthesis_mode": "llm",
            "confidence": 0.75,
        },
    ))
    db.commit()
    db.refresh(plan)
    return plan


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


@pytest.mark.asyncio
async def test_preview_exposes_transparency_fields(monkeypatch, dbctx):
    from api.today_workflow import preview_workflow

    plan = _make_transparent_plan(dbctx.session)

    resp = await preview_workflow(
        date="2026-01-01",
        force=False,
        current_user={"id": "u1"},
        db=dbctx.session,
    )

    assert resp["success"] is True
    data = resp["data"]
    assert data["plan_id"] == plan.id

    # Plan-level transparency
    assert data["limitations"] == PLAN_JSON["limitations"]
    assert data["meeting_preflight"]["checks"]["freshness"]["status"] == "stale"
    assert data["quality_status"] == "contextual"
    assert data["contextuality_validation"]["is_contextual"] is True
    assert data["guardian_health"] == 88

    # Proposal review summary
    summary = data["proposal_review_summary"]
    assert summary["counts"]["accepted"] == 12
    assert summary["counts"]["rejected"] == 2
    assert any("unsupported pillar" in r["reasons"][0] for r in summary["flagged"])

    # Per-agent evidence incl. SIF query provenance
    evidence = {ev["agent"]: ev for ev in data["agent_evidence"]}
    sa = evidence["strategy_architect"]
    assert sa["analysis"] == "Pillars derived from onboarding research preferences"
    assert sa["confidence"] == 0.8
    assert sa["sif_queries"][0]["query"].startswith("content pillars strategy")
    # raw evidence entries carry the error; derived states live in agent_states
    assert evidence["content_strategist"]["error"] == "ValueError: 0"
    states = {s["agent"]: s["state"] for s in data["agent_states"]}
    assert states["content_strategist"] == "error"

    # The task's reasoning/citations travel in metadata (frontend renders them)
    task_meta = data["tasks"][0]["metadata"]
    assert task_meta["reasoning"].startswith("Pillar comes from")
    assert task_meta["selection_score"] == 0.82
    assert task_meta["synthesis_mode"] == "llm"


@pytest.mark.asyncio
async def test_retry_exposes_transparency_fields(monkeypatch, dbctx):
    from api.today_workflow import retry_agent, RetryAgentRequest
    from services import today_workflow_service as svc

    plan = _make_transparent_plan(dbctx.session)

    async def _fake_retry(db, user_id, agent_key, date=None):
        return {"success": True, "agent": agent_key, "added_count": 1, "replaced_count": 0}

    def _fake_session_for_user(uid):
        return sessionmaker(bind=dbctx.engine)()

    monkeypatch.setattr(svc, "retry_agent_proposals", _fake_retry)
    monkeypatch.setattr(
        __import__("services.database", fromlist=["get_session_for_user"]),
        "get_session_for_user",
        _fake_session_for_user,
    )

    resp = await retry_agent(
        body=RetryAgentRequest(agent_key="content_strategist"),
        date="2026-01-01",
        current_user={"id": "u1"},
        db=dbctx.session,
    )

    assert resp["success"] is True
    data = resp["data"]
    assert data["limitations"] == PLAN_JSON["limitations"]
    assert data["meeting_preflight"]["checks"]["onboarding"]["status"] == "available"
    assert data["proposal_review_summary"]["counts"]["accepted"] == 12
    assert data["guardian_health"] == 88


@pytest.mark.asyncio
async def test_generate_indexes_tasks_for_preview_sourced_plan(monkeypatch, dbctx):
    """Finding #2: the onboarding save path (POST /generate) FINDS the
    preview-created plan (created=False), so its tasks were never indexed
    into SIF. The save transition must index them."""
    import asyncio

    import api.today_workflow as tw
    from api.today_workflow import generate_workflow

    plan = _make_transparent_plan(dbctx.session)
    plan.source = "preview"
    dbctx.session.commit()

    indexed = []

    async def _fake_index(user_id, date, tasks, label):
        indexed.append({"user_id": user_id, "date": date, "tasks": tasks, "label": label})

    monkeypatch.setattr(tw, "_index_tasks_to_sif", _fake_index)

    await generate_workflow(
        date="2026-01-01",
        workflow_type="main",
        current_user={"id": "u1"},
        db=dbctx.session,
    )

    # let the scheduled background task run
    await asyncio.sleep(0)

    assert indexed, "preview-sourced plan tasks must be indexed into SIF on save"
    assert indexed[0]["date"] == "2026-01-01"
    assert any(t.get("title") == "Build Out Content Pillar: AI Storytelling" for t in indexed[0]["tasks"])


@pytest.mark.asyncio
async def test_generate_does_not_reindex_manual_plans(monkeypatch, dbctx):
    """A manual plan that was already indexed (created=False, source=manual)
    must NOT be re-indexed on every /generate call."""
    import asyncio

    import api.today_workflow as tw
    from api.today_workflow import generate_workflow

    plan = _make_transparent_plan(dbctx.session)
    plan.source = "manual"
    dbctx.session.commit()

    indexed = []

    async def _fake_index(user_id, date, tasks, label):
        indexed.append({"user_id": user_id, "date": date, "tasks": tasks, "label": label})

    monkeypatch.setattr(tw, "_index_tasks_to_sif", _fake_index)

    await generate_workflow(
        date="2026-01-01",
        workflow_type="main",
        current_user={"id": "u1"},
        db=dbctx.session,
    )

    await asyncio.sleep(0)

    assert indexed == [], "already-indexed manual plans must not be re-indexed"
