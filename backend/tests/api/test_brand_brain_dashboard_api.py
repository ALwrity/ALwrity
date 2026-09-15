"""Brand Brain — Phase 1: ``GET /api/brand-brain/dashboard`` API tests.

Proves the aggregate dashboard endpoint returns the three-section payload the
Brand Brain page renders in one request:

- ``data.onboarding`` — the canonical SSOT envelope (canonical_profile +
  its ``sources``, data_quality, onboarding_session, processing_timestamp)
  plus a lightweight ``indexing`` health block derived from the user's
  latest ``SIFIndexingTask`` row;
- ``data.domains.strategy`` — the full strategy SIF status (activation,
  indexing lifecycle, watermark, vfs mirror, 8 document kinds) reused from
  ``services.intelligence.strategy_sif_status``;
- ``data.domains.calendar`` — the calendar SIF status (indexing lifecycle,
  watermark, 8 document kinds) mirrored from ``/calendar/sif-status``
  without touching the calendar modules.

Contracts locked here:

- onboarding never started -> ``data.onboarding`` is ``None`` (dashboard
  still answers 200 so strategy/calendar keep rendering);
- ORM rows are never leaked — every value is a plain dict / timestamp /
  string;
- clerk string ids resolve both the strategy activation and the calendar
  rows via the raw clerk id;
- auth required (401).

The onboarding integration pipeline itself lives in
``OnboardingDataIntegrationService`` (covered by its own suites); here it is
patched at the class seam. Strategy/calendar rows are seeded into a real
in-memory SQLite session (mirrors ``test_strategy_sif_status_api.py``).
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import (
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from models.monitoring_models import StrategyActivationStatus
from models.sif_indexing_watermark import SIFIndexingWatermark
from models.strategy_sif_index_status import StrategySifIndexStatus
from models.website_analysis_monitoring_models import SIFIndexingTask

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

NUMERIC_UID = 42
UID = str(NUMERIC_UID)
CLERK_ID = "user_str_abc123"

BB_MOD = "api.brand_brain.router"
ONBOARDING_MOD = "api.content_planning.services.content_strategy.onboarding"
WORKSPACE_ROOT = "services.workspace_paths.get_workspace_root"

SAMPLE_CANONICAL = {
    "industry": "B2B SaaS",
    "target_audience": {"demographics": "marketing leaders"},
    "writing_tone": "professional",
    "writing_voice": "authoritative",
    "writing_complexity": "intermediate",
    "content_types": ["blog_post", "case_study"],
    "strategic_insights": "SEO growth via thought leadership",
    "sources": {"industry": "website_analysis", "target_audience": "research_preferences"},
}
SAMPLE_INTEGRATED = {
    "onboarding_session": {"current_step": 6, "progress": 100},
    "canonical_profile": SAMPLE_CANONICAL,
    "data_quality": {"completeness": 0.9, "overall_score": 0.8},
    "processing_timestamp": "2026-09-14T00:00:00",
}
NO_ONBOARDING_INTEGRATED = {**SAMPLE_INTEGRATED, "onboarding_session": {}, "canonical_profile": {}}


@pytest.fixture()
def ctx(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SIFIndexingTask.__table__.create(engine)
    StrategyActivationStatus.__table__.create(engine)
    StrategySifIndexStatus.__table__.create(engine)
    SIFIndexingWatermark.__table__.create(engine)
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield SimpleNamespace(Session=Session, session=session, workspace=tmp_path)
    session.close()
    engine.dispose()


def _seed_strategy_activation(session, *, user_id=UID, activated=True, strategy_id=7):
    if not activated:
        return
    act = StrategyActivationStatus(
        user_id=user_id,
        strategy_id=strategy_id,
        activation_date=datetime(2026, 9, 9, 10, 0, 0),
        status="active",
        last_updated=datetime(2026, 9, 9, 10, 0, 0),
    )
    session.add(act)
    session.commit()
    return act


def _seed_strategy_indexed(session, *, user_id=UID, activated=True, strategy_id=7):
    from services.intelligence.sif_strategy_source_ids import active_strategy_source_id

    _seed_strategy_activation(session, user_id=user_id, activated=activated, strategy_id=strategy_id)
    source = active_strategy_source_id(user_id)
    StrategySifIndexStatus.set_status(session, user_id, source, STATUS_RUNNING)
    StrategySifIndexStatus.set_status(
        session, user_id, source, STATUS_SUCCESS, embedding_count=8
    )
    SIFIndexingWatermark.upsert(
        session, user_id, source, "a" * 64, embedding_count=8, notes="strategy activation"
    )
    session.commit()


def _calendar_source(user_id: str) -> str:
    from services.calendar_sif_source_ids import calendar_latest_source_id

    return calendar_latest_source_id(user_id)


def _seed_calendar_indexed(session, *, user_id=UID):
    source = _calendar_source(user_id)
    CalendarSifIndexStatus.set_status(session, user_id, source, STATUS_PENDING)
    CalendarSifIndexStatus.set_status(
        session, user_id, source, STATUS_SUCCESS, embedding_count=8
    )
    CalendarSifWatermark.upsert(
        session, user_id, source, "b" * 64, embedding_count=8, notes="calendar"
    )
    session.commit()


def _seed_sif_task(session, *, user_id=UID, hours_ago=2, phase="complete"):
    task = SIFIndexingTask(
        user_id=user_id,
        website_url="https://example.com",
        status="active",
        last_success=datetime.utcnow() - timedelta(hours=hours_ago),
        payload={"phase": phase, "pages_indexed": 23, "harvest_source": "beautifulsoup"},
    )
    session.add(task)
    session.commit()
    return task


def _unauthorized_user():
    raise HTTPException(status_code=401, detail="Unauthorized")


def _user(clerk: bool = False) -> dict:
    if clerk:
        return {"id": CLERK_ID, "uid": None, "clerk_user_id": CLERK_ID, "email": "t@e.com", "is_active": True}
    return {"id": UID, "uid": UID, "clerk_user_id": UID, "email": "t@e.com", "is_active": True}


@pytest.fixture()
def client(ctx, monkeypatch):
    from api.brand_brain import router as m
    from middleware.auth_middleware import get_current_user

    monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)

    app = FastAPI()
    app.include_router(m.router)
    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[m.get_db] = lambda: ctx.session
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture()
def clerk_client(ctx, monkeypatch):
    from api.brand_brain import router as m
    from middleware.auth_middleware import get_current_user

    monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)

    app = FastAPI()
    app.include_router(m.router)
    app.dependency_overrides[get_current_user] = lambda: _user(clerk=True)
    app.dependency_overrides[m.get_db] = lambda: ctx.session
    return TestClient(app, raise_server_exceptions=False)


class TestDashboardAggregate:
    def test_full_dashboard_aggregates_all_sections(self, ctx, client):
        _seed_strategy_indexed(ctx.session)
        _seed_calendar_indexed(ctx.session)
        _seed_sif_task(ctx.session)

        with patch.object(
            _onboarding_service(),
            "get_integrated_data_sync",
            return_value=SAMPLE_INTEGRATED,
        ):
            resp = client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "success"
        data = body["data"]

        onboarding = data["onboarding"]
        assert onboarding["canonical_profile"]["industry"] == "B2B SaaS"
        assert onboarding["sources"]["industry"] == "website_analysis"
        assert onboarding["data_quality"]["overall_score"] == 0.8
        assert onboarding["onboarding_session"]["progress"] == 100
        assert onboarding["processing_timestamp"] == "2026-09-14T00:00:00"

        indexing = onboarding["indexing"]
        assert indexing["status"] == "completed"
        assert indexing["progress_pct"] == 100
        assert indexing["details"]["phase"] == "complete"
        assert indexing["details"]["pages_indexed"] == 23
        assert indexing["last_success"] is not None
        assert indexing["index_stale"] is False

        strategy = data["domains"]["strategy"]
        assert strategy["activation"]["strategy_id"] == 7
        assert strategy["indexing"]["phase"] == "success"
        assert strategy["indexing"]["embedding_count"] == 8
        assert strategy["watermark"]["embedding_count"] == 8
        assert strategy["vfs_mirror"]["exists"] is False
        assert len(strategy["document_kinds"]["names"]) == 8

        calendar = data["domains"]["calendar"]
        assert calendar["indexing"]["phase"] == "success"
        assert calendar["indexing"]["embedding_count"] == 8
        assert calendar["watermark"]["embedding_count"] == 8
        assert [k for k in calendar["document_kinds"]["names"]][0] == "calendar_overview"
        assert len(calendar["document_kinds"]["names"]) == 8

    def test_onboarding_not_started_still_serves_domains(self, ctx, client):
        _seed_strategy_indexed(ctx.session)
        _seed_calendar_indexed(ctx.session)

        with patch.object(
            _onboarding_service(),
            "get_integrated_data_sync",
            return_value=NO_ONBOARDING_INTEGRATED,
        ):
            resp = client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["onboarding"] is None
        assert data["domains"]["strategy"]["activation"]["strategy_id"] == 7
        assert data["domains"]["calendar"]["indexing"]["phase"] == "success"

    def test_no_active_strategy_and_calendar_not_indexed(self, ctx, client):
        with patch.object(
            _onboarding_service(),
            "get_integrated_data_sync",
            return_value=SAMPLE_INTEGRATED,
        ):
            resp = client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["onboarding"] is not None
        assert data["domains"]["strategy"]["activation"] is None
        assert data["domains"]["strategy"]["indexing"]["phase"] == "no_active_strategy"
        assert data["domains"]["calendar"]["indexing"]["phase"] == "not_indexed"
        assert data["domains"]["calendar"]["watermark"] is None

    def test_stale_index_flag_when_sif_task_old(self, ctx, client):
        _seed_sif_task(ctx.session, hours_ago=100)

        with patch.object(
            _onboarding_service(),
            "get_integrated_data_sync",
            return_value=SAMPLE_INTEGRATED,
        ):
            resp = client.get("/api/brand-brain/dashboard")
        indexing = resp.json()["data"]["onboarding"]["indexing"]
        assert indexing["index_stale"] is True
        assert indexing["index_freshness_hours"] >= 100.0

    def test_clerk_string_id_resolves_all_domains(self, ctx, clerk_client):
        _seed_strategy_indexed(ctx.session, user_id=CLERK_ID)
        _seed_calendar_indexed(ctx.session, user_id=CLERK_ID)
        _seed_sif_task(ctx.session, user_id=CLERK_ID)

        with patch.object(
            _onboarding_service(),
            "get_integrated_data_sync",
            return_value=SAMPLE_INTEGRATED,
        ):
            resp = clerk_client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["domains"]["strategy"]["activation"]["strategy_id"] == 7
        assert data["domains"]["strategy"]["indexing"]["phase"] == "success"
        assert data["domains"]["calendar"]["indexing"]["phase"] == "success"
        doc_kinds = data["domains"]["calendar"]["document_kinds"]["doc_ids"]
        assert all(str(d).startswith(f"user:{CLERK_ID}:calendar_latest:") for d in doc_kinds)


def _onboarding_service():
    import api.content_planning.services.content_strategy.onboarding as onboarding

    return onboarding.OnboardingDataIntegrationService


class TestDashboardAuthAndWiring:
    def test_auth_required(self, ctx, monkeypatch):
        from api.brand_brain import router as m
        from middleware.auth_middleware import get_current_user

        monkeypatch.setattr(WORKSPACE_ROOT, lambda: ctx.workspace)

        app = FastAPI()
        app.include_router(m.router)
        app.dependency_overrides[get_current_user] = _unauthorized_user
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/brand-brain/dashboard")
        assert resp.status_code == 401

    def test_dashboard_path_registered(self):
        import api.brand_brain.router as m

        assert "/api/brand-brain/dashboard" in [r.path for r in m.router.routes]