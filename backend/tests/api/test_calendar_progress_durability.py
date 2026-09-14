"""R2.3 (high H1) — durable, multi-worker-safe calendar progress reads.

Progress previously lived ONLY in a process-local dict: another worker (or a
cold instance after a restart) answered 404 for a legitimately running /
completed session, and orphaned `running` rows blocked users from starting a
new generation forever.

Contract:
- ``get_orchestrator_progress`` falls back to the durable DB row when the
  in-memory session is missing (owner-checked), serving the same payload —
  including the assembled calendar result once completed;
- restart reconciliation (`_load_sessions_from_db`): restored ACTIVE rows
  older than a cutoff are marked `failed` ("interrupted") instead of staying
  stuck running or blocking regeneration; recent ones are restored as before;
- fresh in-memory state keeps priority over the DB row.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.enhanced_calendar_models import CalendarGenerationSession
from services.database import get_db

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import api.content_planning.api.routes.calendar_generation as _routes
import middleware.auth_middleware as _auth
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)

UID = "user-42"
OTHER = "someone-else"
SID = "cal-session-durable-1"

GENERATED_AT = "2026-09-13T10:00:00"


def make_calendar():
    return {
        "calendar_type": "monthly",
        "industry": "SaaS",
        "daily_schedule": [
            {"date": "2026-09-14", "theme": "AI Foundations", "content_items": []}
        ],
        "weekly_themes": [{"week_number": 38, "theme": "AI Foundations"}],
    }


def seed_row(session, *, sid, user_id, status, calendar=None, params=None, age=None):
    row = CalendarGenerationSession(
        user_id=user_id,
        session_type="monthly",
        generation_status=status,
        generation_params={"session_id": sid, **(params or {})},
    )
    if hasattr(CalendarGenerationSession, "session_key"):
        row.session_key = sid
    if calendar is not None:
        row.generated_calendar = calendar
    if age is not None:
        row.created_at = datetime.utcnow() - timedelta(seconds=age)
    session.add(row)
    session.commit()
    return row


def make_cold_service(session):
    """Fresh instance with empty memory but a live DB session."""
    service = CalendarGenerationService.__new__(CalendarGenerationService)
    service.db_session = session
    service.orchestrator_sessions = {}
    return service


@pytest.fixture()
def engine_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarGenerationSession.__table__.create(engine)
    session = sessionmaker(bind=engine)()
    yield SimpleNamespace(engine=engine, session=session)
    session.close()
    engine.dispose()


class TestProgressFromDurableRow:
    def test_completed_row_delivers_status_and_calendar(self, engine_db):
        session = engine_db.session
        calendar = make_calendar()
        seed_row(
            session, sid=SID, user_id=UID, status="completed", calendar=calendar,
            params={"progress": {"current_step": 12, "overall_progress": 100}},
        )
        service = make_cold_service(session)

        progress = service.get_orchestrator_progress(SID, requester_user_id=UID)

        assert progress is not None
        assert progress["status"] == "completed"
        assert progress["overall_progress"] == 100
        # B4 contract: the assembled calendar is delivered once completed.
        assert progress["result"] == calendar

    def test_running_row_delivers_progress_without_result(self, engine_db):
        session = engine_db.session
        seed_row(
            session, sid=SID, user_id=UID, status="running",
            params={"progress": {"current_step": 7, "step_progress": 55}},
        )
        service = make_cold_service(session)

        progress = service.get_orchestrator_progress(SID, requester_user_id=UID)

        assert progress is not None
        assert progress["status"] == "running"
        assert progress["step_progress"] == 55
        assert progress["current_step"] == 7  # persisted through the row
        assert progress["result"] is None

    def test_failed_row_reports_failed(self, engine_db):
        session = engine_db.session
        seed_row(
            session, sid=SID, user_id=UID, status="failed",
            params={"error": "step 8 exploded"},
        )
        service = make_cold_service(session)

        progress = service.get_orchestrator_progress(SID, requester_user_id=UID)

        assert progress is not None
        assert progress["status"] == "failed"
        assert progress["result"] is None
        assert progress["errors"]

    def test_cross_user_read_forbidden_via_row(self, engine_db):
        session = engine_db.session
        seed_row(session, sid=SID, user_id=UID, status="completed", calendar=make_calendar())
        service = make_cold_service(session)

        progress = service.get_orchestrator_progress(SID, requester_user_id=OTHER)

        assert progress == {"forbidden": True, "status": "forbidden"}

    def test_missing_everywhere_returns_none(self, engine_db):
        service = make_cold_service(engine_db.session)
        assert service.get_orchestrator_progress("nope", requester_user_id=UID) is None


class TestFreshMemoryWinsOverDb:
    def test_active_memory_session_takes_priority(self, engine_db):
        session = engine_db.session
        seed_row(
            session, sid=SID, user_id=UID, status="running",
            params={"progress": {"overall_progress": 33}},
        )
        service = make_cold_service(session)
        service.orchestrator_sessions[SID] = {
            "user_id": UID,
            "status": "running",
            "result": None,
            "progress": {"overall_progress": 99},
            "transparency_messages": [],
            "educational_content": [],
            "estimated_completion": None,
            "last_updated": None,
        }

        progress = service.get_orchestrator_progress(SID, requester_user_id=UID)
        assert progress["overall_progress"] == 99


class TestRestartReconciliation:
    def _loaded_service(self, session):
        service = make_cold_service(session)
        return service

    def test_orphaned_running_rows_marked_failed(self, engine_db):
        session = engine_db.session
        orphan = seed_row(
            session, sid="orphan-1", user_id=UID, status="running",
            params={"progress": {"current_step": 9}}, age=1200,
        )
        fresh = seed_row(
            session, sid="fresh-1", user_id=UID, status="running",
            params={"progress": {"current_step": 2}}, age=30,
        )
        service = self._loaded_service(session)
        service._ORPHAN_CUTOFF_SECONDS = 900

        service._load_sessions_from_db()

        session.expire_all()
        # Re-read rows after reconciliation
        row_orphan = session.get(CalendarGenerationSession, orphan.id)
        row_fresh = session.get(CalendarGenerationSession, fresh.id)
        assert row_orphan.generation_status == "failed"
        assert "interrupted" in (row_orphan.generation_params or {}).get("error", "")
        assert row_fresh.generation_status == "running"
        # Fresh session restored to memory; orphan NOT restored as active.
        assert "fresh-1" in service.orchestrator_sessions
        assert "orphan-1" not in service.orchestrator_sessions
        # The user still has a legitimately-active fresh session:
        assert service._get_active_session_for_user(UID) == "fresh-1"

    def test_reconciled_rows_are_terminal_after_restart(self, engine_db):
        session = engine_db.session
        seed_row(session, sid=SID, user_id=UID, status="running", age=2000)
        service = self._loaded_service(session)
        service._ORPHAN_CUTOFF_SECONDS = 900

        service._load_sessions_from_db()

        progress = service.get_orchestrator_progress(SID, requester_user_id=UID)
        assert progress["status"] == "failed"
        # The reconciled orphan no longer blocks a new generation:
        assert service._get_active_session_for_user(UID) is None
