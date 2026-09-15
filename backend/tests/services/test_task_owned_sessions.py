"""R2.1 (critical C5) — background tasks own their DB sessions.

`/start` (route -> create_task) and the SIF indexer dispatch detached work
while holding the request-scoped session yielded by ``get_db``, which FastAPI
closes at response end — unsupported ownership, teardown races, leaked
connections, jobs lost at shutdown.

Contract:
- ``index_calendar_async`` takes NO session: the background task opens a
  dedicated session via ``get_session_for_user`` (injectable factory), runs
  the lifecycle inside it, and closes it exactly once;
- the ``/start`` background entry (``run_generation_task``) likewise swaps
  the service to a task-owned session for the whole task and restores the
  request session afterwards;
- the request-scoped session never crosses a task boundary (behavioral +
  source guards).
"""
from __future__ import annotations

import asyncio
import inspect
import re
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import (
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from models.content_planning import CalendarEvent
from models.enhanced_calendar_models import CalendarGenerationSession

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import api.content_planning.api.routes.calendar_generation as _routes
from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)
from services.calendar_sif_source_ids import (
    calendar_latest_source_id,
    compute_calendar_source_hash,
)

GENERATED_AT = "2026-09-13T10:00:00"
UID = "user-42"

INDEXER_PATH = _BACKEND_ROOT / "services" / "calendar_sif_indexer.py"
SERVICE_PATH = (
    _BACKEND_ROOT
    / "api" / "content_planning" / "services" / "calendar_generation_service.py"
)
ROUTES_PATH = (
    _BACKEND_ROOT
    / "api" / "content_planning" / "api" / "routes" / "calendar_generation.py"
)


def make_calendar():
    return {
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
            }
        ],
        "weekly_themes": [
            {"week_number": 38, "theme": "AI Foundations", "content_count": 1, "platforms": ["website"]},
        ],
        "content_recommendations": [
            {"type": "blog_post", "topic": "AI Tutorials", "priority": "high"},
        ],
        "performance_predictions": {"estimated_engagement": 75},
        "ai_insights": [
            {"insight": "Post mornings", "action": "Schedule for 9am", "confidence": 0.85},
        ],
        "strategy_digest": {"pillars": ["AI Tutorials"]},
        "quality_score": 0.85,
    }


class FakeAsyncSif:
    async def index_content(self, items):
        return len(items)


class SessionRecorder:
    """Delegates everything to the real session; records close() calls."""

    def __init__(self, session):
        self._session = session
        self.close_calls = 0

    def close(self):
        self.close_calls += 1
        self._session.close()

    def __getattr__(self, name):
        return getattr(self._session, name)

    def __iter__(self):
        return iter(self._session)


class RecordingFactory:
    """`factory(user_id)` -> recorder-wrapped session on the shared engine."""

    def __init__(self, engine):
        self.engine = engine
        self.made: list = []
        self.user_ids: list = []

    def __call__(self, user_id: str):
        self.user_ids.append(user_id)
        wrapper = SessionRecorder(
            sessionmaker(autocommit=False, autoflush=False, bind=self.engine)()
        )
        self.made.append(wrapper)
        return wrapper


@pytest.fixture()
def engine_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in (
        CalendarGenerationSession.__table__,
        CalendarEvent.__table__,
        CalendarSifIndexStatus.__table__,
        CalendarSifWatermark.__table__,
    ):
        table.create(engine)
    session = sessionmaker(bind=engine)()
    yield SimpleNamespace(engine=engine, session=session)
    session.close()
    engine.dispose()


class TestSifTaskOwnsSession:
    """index_calendar_async must open/close its own session."""

    def test_task_session_opened_once_closed_once(self, engine_db):
        from services.calendar_sif_indexer import index_calendar_async

        factory = RecordingFactory(engine_db.engine)
        calendar = make_calendar()

        async def runner():
            task = index_calendar_async(
                UID, calendar, GENERATED_AT,
                sif_service=FakeAsyncSif(), session_factory=factory,
            )
            assert task is not None, "dispatch must return the created task"
            await task

        asyncio.run(runner())

        source_id = calendar_latest_source_id(UID)
        # R4.3 contract: dispatch now opens TWO sessions — one for the
        # durable `pending` write, one for the lifecycle task.
        assert len(factory.made) == 2
        assert factory.made[0].close_calls == 1, "pending session must close"
        assert factory.made[1].close_calls == 1, "task must close its session"
        assert factory.user_ids == [UID, UID], (
            "pending write + lifecycle task both run as the user"
        )

        status = CalendarSifIndexStatus.get(engine_db.session, UID, source_id)
        assert status is not None and status.status == STATUS_SUCCESS

    def test_lifecycle_runs_inside_factory_session(self, engine_db):
        """The lifecycle's DB writes land via the task's own session:
        commits from the task session are visible from the request session,
        while the request session itself received no lifecycle calls."""
        from services.calendar_sif_indexer import index_calendar_async

        factory = RecordingFactory(engine_db.engine)
        calendar = make_calendar()

        def spy_factory(user_id):
            return SessionRecorder(
                sessionmaker(autocommit=False, autoflush=False, bind=engine_db.engine)()
            )

        request_session = engine_db.session

        async def runner():
            task = index_calendar_async(
                UID, calendar, GENERATED_AT,
                sif_service=FakeAsyncSif(), session_factory=spy_factory,
            )
            await task

        asyncio.run(runner())

        # Committed from the task session: visible from the request session.
        wm = (
            request_session.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=calendar_latest_source_id(UID))
            .one()
        )
        assert wm.embedding_count >= 1

    def test_dispatch_failure_never_raises(self, engine_db):
        from services.calendar_sif_indexer import index_calendar_async

        def _broken_factory(user_id):
            raise RuntimeError("no engine")

        async def runner():
            index_calendar_async(
                UID, make_calendar(), GENERATED_AT,
                session_factory=_broken_factory,
            )

        asyncio.run(runner())  # must not raise


class TestTaskOwnedHttpStart:
    """run_generation_task: swap to task-owned session, restore in finally."""

    def make_service(self, engine_db):
        service = CalendarGenerationService.__new__(CalendarGenerationService)
        service.db_session = engine_db.session
        service.orchestrator = StubOrchestrator(make_calendar())
        service.orchestrator_sessions = {}
        service.background_session_factory = None
        return service

    def test_task_opens_closes_own_session_restores_request(self, engine_db):
        factory = RecordingFactory(engine_db.engine)
        service = self.make_service(engine_db)
        service.background_session_factory = factory
        request_session = service.db_session

        request_data = {"user_id": UID, "strategy_id": 1, "calendar_type": "monthly"}
        sid = "task-own-1"
        assert service.initialize_orchestrator_session(sid, request_data)

        captured = {"dispatched": []}
        with patch(
            "services.calendar_sif_indexer.index_calendar_async",
            lambda user_id, calendar, at, sif_service=None, session_factory=None:
            captured["dispatched"].append(user_id),
        ):
            asyncio.run(service.run_generation_task(sid, request_data))

        assert service.orchestrator_sessions[sid]["status"] == "completed"
        # Exacly one task-owned session, closed exactly once
        assert len(factory.made) == 1
        assert factory.made[0].close_calls == 1
        # The request-scoped session attribute was restored
        assert service.db_session is request_session
        # Durable work happened through the task session:
        row = service._find_session_row(sid)
        assert row is not None and row.generation_status == "completed"
        assert len(captured["dispatched"]) == 1

    def test_factory_failure_marks_session_failed_not_raised(self, engine_db):
        service = self.make_service(engine_db)

        def _boom(user_id):
            raise RuntimeError("engine unavailable")

        service.background_session_factory = _boom
        request_data = {"user_id": UID, "strategy_id": 1}
        sid = "task-own-2"
        assert service.initialize_orchestrator_session(sid, request_data)

        asyncio.run(service.run_generation_task(sid, request_data))

        session_info = service.orchestrator_sessions[sid]
        assert session_info["status"] == "failed"
        assert "engine unavailable" in (session_info["error"] or "")

    def test_route_schedules_run_generation_task(self, engine_db, tmp_path, monkeypatch):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        import middleware.auth_middleware as _auth
        from services.database import get_db
        from services.calendar_sif_indexer import index_calendar_async

        monkeypatch.setattr(_routes, "_require_calendar_preflight", lambda *a, **k: None)

        service = self.make_service(engine_db)
        service.background_session_factory = RecordingFactory(engine_db.engine)
        monkeypatch.setattr(_routes, "CalendarGenerationService", lambda db: service)

        captured = {"coro": None}

        def _fake_create_task(coro):
            captured["coro"] = coro
            return None

        monkeypatch.setattr(_routes.asyncio, "create_task", _fake_create_task, raising=True)
        monkeypatch.setattr(
            "services.calendar_sif_indexer.index_calendar_async",
            lambda *a, **k: captured.setdefault("dispatched", []).append(a),
            raising=True,
        )

        app = FastAPI()
        app.include_router(_routes.router)
        app.dependency_overrides[_auth.get_current_user] = lambda: {
            "id": UID, "uid": UID,
            "clerk_user_id": UID, "email": "t@e.com", "is_active": True,
        }
        app.dependency_overrides[get_db] = lambda: engine_db.session
        client = TestClient(app, raise_server_exceptions=True)

        resp = client.post(
            "/calendar-generation/start",
            json={"strategy_id": 1, "calendar_type": "monthly"},
        )
        assert resp.status_code == 200, resp.text

        # The route schedules the TASK-OWNED wrapper, not the raw generation:
        assert captured["coro"] is not None
        assert captured["coro"].cr_code.co_name == "run_generation_task"

        asyncio.run(captured["coro"])

        assert len(service.background_session_factory.made) == 1
        assert service.background_session_factory.made[0].close_calls == 1


class TestSourceGuardsNoSessionAcrossTaskBoundary:
    """Source guards: no request-scoped session crosses a task boundary."""

    def test_index_calendar_async_signature_has_no_session_param(self):
        src = INDEXER_PATH.read_text(encoding="utf-8")
        match = re.search(r"def index_calendar_async\(\s*([A-Za-z_]+)", src)
        assert match, "index_calendar_async signature not found"
        first_param = match.group(1)
        assert first_param == "user_id", (
            "index_calendar_async's first parameter must be user_id, got: "
            f"{first_param!r}"
        )
        signature_block = re.search(
            r"def index_calendar_async\((.*?)\)", src, re.DOTALL
        )
        assert signature_block is not None
        assert re.search(r"\bsession\b", signature_block.group(1)) is None, (
            "index_calendar_async must not take a session parameter — the "
            "task opens its own (session_factory is allowed)"
        )

    def test_save_calendar_db_dispatches_without_request_session(self):
        src = inspect.getsource(
            CalendarGenerationService._save_calendar_to_db
        )
        assert re.search(r"index_calendar_async\(\s*user_id", src), (
            "the SIF dispatch must receive user_id (not the request session)"
        )
        assert not re.search(r"index_calendar_async\(\s*self\.db_session", src), (
            "the SIF dispatch must not cross the request-scoped session into "
            "the background task"
        )

    def test_start_route_uses_run_generation_task(self):
        src = ROUTES_PATH.read_text(encoding="utf-8")
        assert re.search(r"create_task\(\s*calendar_service\.run_generation_task", src), (
            "/start must schedule run_generation_task (task owns its session)"
        )
        assert not re.search(r"create_task\(\s*calendar_service\.start_orchestrator_generation", src), (
            "/start must not schedule start_orchestrator_generation directly "
            "(request-scoped session would cross the task boundary)"
        )


class StubOrchestrator:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def generate_calendar(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        return self.result
