"""R1.1 (critical C1) — the user-facing /start flow must persist the calendar.

Before this fix, ``start_orchestrator_generation`` marked the session
completed and only called ``_persist_session_to_db`` — it never invoked
``_save_calendar_to_db``, so the user wizard produced NO CalendarEvent rows
and never dispatched SIF indexing. Only the legacy synchronous
``/generate-calendar`` path persisted.

Contract (docs/planning/calendar-prod-readiness-phases.md R1.1):
- a real orchestrator calendar → session row ``completed`` with
  ``generated_calendar`` persisted, CalendarEvent rows created, and
  ``index_calendar_async`` dispatched once (after commit);
- an orchestrator error dict → session ``failed`` and neither events nor
  dispatch;
- ``_save_calendar_to_db`` raising → the generation still completes and the
  failure is logged (non-fatal for the user-visible result);
- the legacy sync path keeps persisting exactly once (no double events).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import CalendarSifIndexStatus
from models.calendar_sif_watermark import CalendarSifWatermark
from models.content_planning import CalendarEvent
from models.enhanced_calendar_models import CalendarGenerationSession
from services.database import get_db

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import middleware.auth_middleware as _auth
import api.content_planning.api.routes.calendar_generation as _routes
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)

UID = "user-42"
STRATEGY_ID = 1
DISPATCH_TARGET = "services.calendar_sif_indexer.index_calendar_async"

GENERATED_AT = "2026-09-13T10:00:00"


def make_real_calendar(**overrides):
    calendar = {
        "status": "completed",
        "calendar_type": "monthly",
        "industry": "SaaS",
        "business_size": "SME",
        "generated_at": GENERATED_AT,
        "daily_schedule": [
            {
                "date": "2026-09-14",
                "week_number": 38,
                "theme": "AI Foundations",
                "content_items": [
                    {
                        "title": "AI 101",
                        "description": "Intro post",
                        "content_type": "blog_post",
                        "platform": "website",
                        "status": "draft",
                    }
                ],
                "platform_distribution": {"website": 1},
                "quality_metrics": {"score": 0.9},
            }
        ],
        "weekly_themes": [
            {"week_number": 38, "theme": "AI Foundations", "content_count": 1, "platforms": ["website"]},
        ],
        "content_recommendations": [
            {"type": "blog_post", "topic": "AI Tutorials", "priority": "high", "estimated_roi": 0.15},
        ],
        "performance_predictions": {"estimated_engagement": 75},
        "ai_insights": [
            {"insight": "Post mornings", "action": "Schedule for 9am", "confidence": 0.85},
        ],
        "strategy_digest": {"pillars": ["AI Tutorials"]},
        "quality_score": 0.85,
    }
    calendar.update(overrides)
    return calendar


class StubOrchestrator:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def generate_calendar(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def make_service(db_session, orchestrator_result):
    """Build a CalendarGenerationService without running __init__."""
    service = CalendarGenerationService.__new__(CalendarGenerationService)
    service.db_session = db_session
    service.orchestrator = StubOrchestrator(orchestrator_result)
    service.orchestrator_sessions = {}
    # R2.1: background tasks open per-user sessions through this factory
    # (same engine, so in-test sqlite memory sees the same data).
    bind = db_session.get_bind()
    service.background_session_factory = (
        lambda user_id: sessionmaker(autocommit=False, autoflush=False, bind=bind)()
    )
    return service


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarGenerationSession.__table__.create(engine)
    CalendarEvent.__table__.create(engine)
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def _count_events(db):
    return db.query(CalendarEvent).count()


class TestStartPathPersistsCalendar:
    """Service-level: the /start completion path persists + dispatches."""

    def test_completed_start_persists_events_and_dispatches_sif(self, db):
        service = make_service(db, make_real_calendar())
        request_data = {
            "user_id": UID,
            "strategy_id": STRATEGY_ID,
            "calendar_type": "monthly",
            "industry": "SaaS",
            "business_size": "SME",
            "strategy_digest": {},
        }
        session_id = "cal-start-1"
        assert service.initialize_orchestrator_session(session_id, request_data)

        captured = {}

        def _dispatch(user_id, calendar_data, generated_at, sif_service=None):
            captured["user_id"] = user_id
            captured["calendar"] = calendar_data
            captured["generated_at"] = generated_at

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            asyncio.run(service.start_orchestrator_generation(session_id, request_data))

        # In-memory session completed with the result attached
        assert service.orchestrator_sessions[session_id]["status"] == "completed"
        assert service.orchestrator_sessions[session_id]["result"]["daily_schedule"]

        # Durable session row completed with the generated calendar
        row = service._find_session_row(session_id)
        assert row is not None
        assert row.generation_status == "completed"
        assert (row.generated_calendar or {}).get("daily_schedule")

        # CalendarEvent rows materialized from the daily schedule
        assert _count_events(db) == 1
        event = db.query(CalendarEvent).first()
        assert event.title == "AI 101"
        assert event.strategy_id == STRATEGY_ID

        # SIF dispatched once, after persistence
        assert captured.get("user_id") == UID
        assert captured.get("calendar", {}).get("daily_schedule")
        assert captured.get("generated_at") == GENERATED_AT

    def test_orchestrator_error_dict_fails_without_events_or_dispatch(self, db):
        service = make_service(
            db, {"status": "error", "error_message": "step 8 exploded"}
        )
        request_data = {"user_id": UID, "strategy_id": STRATEGY_ID}
        session_id = "cal-start-2"
        assert service.initialize_orchestrator_session(session_id, request_data)

        dispatch_calls = []

        def _dispatch(*args, **kwargs):
            dispatch_calls.append(args)

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            asyncio.run(service.start_orchestrator_generation(session_id, request_data))

        assert service.orchestrator_sessions[session_id]["status"] == "failed"
        assert service.orchestrator_sessions[session_id]["error"] == "step 8 exploded"
        row = service._find_session_row(session_id)
        assert row is not None and row.generation_status == "failed"
        assert _count_events(db) == 0
        assert dispatch_calls == []

    def test_persistence_failure_keeps_generation_completed(self, db):
        service = make_service(db, make_real_calendar())
        request_data = {"user_id": UID, "strategy_id": STRATEGY_ID}
        session_id = "cal-start-3"
        assert service.initialize_orchestrator_session(session_id, request_data)

        def _raise_save(self, *args, **kwargs):
            raise RuntimeError("db exploded mid-save")

        dispatch_calls = []

        def _dispatch(*args, **kwargs):
            dispatch_calls.append(args)

        with patch(DISPATCH_TARGET, side_effect=_dispatch), patch.object(
            CalendarGenerationService, "_save_calendar_to_db", _raise_save
        ):
            asyncio.run(service.start_orchestrator_generation(session_id, request_data))

        # The user-visible generation still completed…
        assert service.orchestrator_sessions[session_id]["status"] == "completed"
        row = service._find_session_row(session_id)
        assert row is not None and row.generation_status == "completed"
        # …but nothing durable landed and nothing was dispatched.
        assert _count_events(db) == 0
        assert dispatch_calls == []

    def test_sync_generate_path_saves_exactly_once(self, db):
        """Legacy sync path: still persists itself, and only once."""
        service = make_service(db, make_real_calendar())

        dispatch_calls = []

        def _dispatch(*args, **kwargs):
            dispatch_calls.append(args)

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            result = asyncio.run(
                service.generate_comprehensive_calendar(
                    user_id=UID,
                    strategy_id=STRATEGY_ID,
                    calendar_type="monthly",
                    industry="SaaS",
                    business_size="SME",
                    strategy_digest={},
                )
            )

        assert result.get("daily_schedule")
        assert result.get("processing_time") is not None
        assert _count_events(db) == 1, "sync path must persist exactly once"
        assert len(dispatch_calls) == 1


class TestStartRouteEndToEnd:
    """HTTP /start: the background task it schedules persists + dispatches."""

    @pytest.fixture()
    def client_and_db(self, db, monkeypatch):
        # The preflight gauntlet is covered by test_calendar_phase3_preflight.py.
        monkeypatch.setattr(
            _routes, "_require_calendar_preflight", lambda *a, **k: None
        )

        service = make_service(db, make_real_calendar())

        def _factory(_db):
            return service

        monkeypatch.setattr(_routes, "CalendarGenerationService", _factory)

        captured = {"dispatched": []}

        def _fake_create_task(coro):
            captured["coro"] = coro
            return None

        monkeypatch.setattr(
            _routes.asyncio, "create_task", _fake_create_task, raising=True
        )
        monkeypatch.setattr(
            "services.calendar_sif_indexer.index_calendar_async",
            lambda *a, **k: captured["dispatched"].append(a),
            raising=True,
        )

        app = FastAPI()
        app.include_router(_routes.router)
        app.dependency_overrides[_auth.get_current_user] = lambda: {
            "id": UID, "uid": UID,
            "clerk_user_id": UID, "email": "t@e.com", "is_active": True,
        }
        app.dependency_overrides[get_db] = lambda: db
        client = TestClient(app, raise_server_exceptions=True)
        return client, service, db, captured

    def test_start_schedules_background_persistence(self, client_and_db):
        client, service, db, captured = client_and_db

        resp = client.post(
            "/calendar-generation/start",
            json={
                "strategy_id": STRATEGY_ID,
                "calendar_type": "monthly",
                "industry": "SaaS",
                "business_size": "SME",
            },
        )
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["status"] == "started"
        session_id = payload["session_id"]

        # Nothing durable has happened yet — the background task is pending.
        row = service._find_session_row(session_id)
        assert row is not None
        assert row.generation_status in ("initializing", "running")
        assert _count_events(db) == 0
        assert captured["dispatched"] == []

        # Deterministically run the background coroutine the route created.
        asyncio.run(captured["coro"])

        # The task committed through its own session (R2.1); expire the
        # request session's identity map so we read the durable values.
        db.expire_all()

        assert service.orchestrator_sessions[session_id]["status"] == "completed"
        row = service._find_session_row(session_id)
        assert row is not None and row.generation_status == "completed"
        assert (row.generated_calendar or {}).get("daily_schedule")
        assert _count_events(db) == 1
        assert len(captured["dispatched"]) == 1
        assert captured["dispatched"][0][0] == UID
