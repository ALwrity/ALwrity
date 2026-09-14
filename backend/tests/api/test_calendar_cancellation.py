"""R2.4 (high H2) — cancellation must actually cancel the generation.

Before: DELETE /cancel/{session_id} only flipped the in-memory status; the
detached generation task kept burning AI spend and its late completion
overwrote the durable `cancelled` row with `completed` (events + SIF
dispatch included).

Contract:
- cancelling a session cancels the registered generation task
  (`asyncio.Task` reference per session, observed in `run_generation_task`);
- a late orchestrator completion can NEVER overwrite a cancelled session —
  no completed status/result, no CalendarEvent rows, no SIF dispatch;
- the durable row stays `cancelled`;
- the registered task is unregistered when it settles.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import CalendarSifIndexStatus
from models.calendar_sif_watermark import CalendarSifWatermark
from models.content_planning import CalendarEvent
from models.enhanced_calendar_models import CalendarGenerationSession

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)
from api.content_planning.services.calendar_session_registry import (
    _active_generation_tasks,
)

UID = "user-42"
STRATEGY_ID = 1
DISPATCH_TARGET = "services.calendar_sif_indexer.index_calendar_async"

GENERATED_AT = "2026-09-13T10:00:00"


def make_real_calendar():
    return {
        "status": "completed",
        "calendar_type": "monthly",
        "industry": "SaaS",
        "business_size": "SME",
        "generated_at": GENERATED_AT,
        "daily_schedule": [
            {
                "date": "2026-09-14",
                "theme": "AI Foundations",
                "content_items": [{"title": "AI 101", "content_type": "blog_post", "platform": "website"}],
            }
        ],
        "weekly_themes": [{"week_number": 38, "theme": "AI Foundations"}],
        "ai_insights": [],
        "strategy_digest": {"pillars": ["AI Tutorials"]},
        "quality_score": 0.85,
    }


class DelayedOrchestrator:
    """Stub that occupies the event loop so a mid-run cancel lands."""

    def __init__(self, result, delay: float = 0.6):
        self.result = result
        self.delay = delay
        self.entered = False

    async def generate_calendar(self, **kwargs):
        self.entered = True
        await asyncio.sleep(self.delay)
        return self.result


def make_service(engine_db, orchestrator):
    service = CalendarGenerationService.__new__(CalendarGenerationService)
    service.db_session = engine_db.session
    service.orchestrator = orchestrator
    service.orchestrator_sessions = {}
    bind = engine_db.session.get_bind()
    service.background_session_factory = (
        lambda user_id: sessionmaker(autocommit=False, autoflush=False, bind=bind)()
    )
    return service


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
    yield SimpleNamespaceSession(session)
    session.close()
    engine.dispose()


class SimpleNamespaceSession:
    def __init__(self, session):
        self.session = session


def _count_events(db_session):
    return db_session.query(CalendarEvent).count()


def _seed_request(service, sid, user_id=UID):
    request_data = {
        "user_id": user_id,
        "strategy_id": STRATEGY_ID,
        "calendar_type": "monthly",
    }
    assert service.initialize_orchestrator_session(sid, request_data)
    return request_data


class TestCancelStopsGenerationTask:
    @pytest.mark.asyncio
    async def test_cancel_cancels_running_task_and_row(self, engine_db):
        service = make_service(engine_db, DelayedOrchestrator(make_real_calendar()))
        sid = "cancel-e2e-1"
        _seed_request(service, sid)

        dispatch_calls = []

        def _dispatch(*args, **kwargs):
            dispatch_calls.append(args)

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            task = asyncio.create_task(service.run_generation_task(sid, {
                "user_id": UID, "strategy_id": STRATEGY_ID, "calendar_type": "monthly",
            }))
            await asyncio.sleep(0.05)
            assert service.orchestrator.entered
            assert service.cancel_orchestrator_session(sid, requester_user_id=UID) is True

            with pytest.raises(asyncio.CancelledError):
                await task

        assert service.orchestrator_sessions[sid]["status"] == "cancelled"
        engine_db.session.expire_all()
        row = service._find_session_row(sid)
        assert row is not None and row.generation_status == "cancelled"
        assert _count_events(engine_db.session) == 0
        assert dispatch_calls == []
        assert sid not in _active_generation_tasks

    @pytest.mark.asyncio
    async def test_late_completion_cannot_overwrite_cancelled(self, engine_db):
        """The orchestrator finishing AFTER a cancel must not flip the session."""
        service = make_service(engine_db, DelayedOrchestrator(make_real_calendar(), delay=0))
        sid = "cancel-e2e-2"
        _seed_request(service, sid)
        # Simulate the cancel having happened while the orchestrator ran:
        assert service.cancel_orchestrator_session(sid, requester_user_id=UID) is True

        dispatch_calls = []

        def _dispatch(*args, **kwargs):
            dispatch_calls.append(args)

        with patch(DISPATCH_TARGET, side_effect=_dispatch):
            # Orchestrator now completes immediately — the guard must keep
            # the terminal cancelled state.
            await service.start_orchestrator_generation(sid, {
                "user_id": UID, "strategy_id": STRATEGY_ID, "calendar_type": "monthly",
            })

        session_info = service.orchestrator_sessions[sid]
        assert session_info["status"] == "cancelled"
        assert session_info.get("result") is None
        engine_db.session.expire_all()
        row = service._find_session_row(sid)
        assert row is not None and row.generation_status == "cancelled"
        assert _count_events(engine_db.session) == 0
        assert dispatch_calls == []

    @pytest.mark.asyncio
    async def test_cancelled_task_unregisters_itself(self, engine_db):
        service = make_service(engine_db, DelayedOrchestrator(make_real_calendar()))
        sid = "cancel-e2e-3"
        request_data = _seed_request(service, sid)

        task = asyncio.create_task(service.run_generation_task(sid, request_data))
        await asyncio.sleep(0.05)
        assert _active_generation_tasks.get(sid) is task
        assert service.cancel_orchestrator_session(sid, requester_user_id=UID) is True
        with pytest.raises(asyncio.CancelledError):
            await task
        await asyncio.sleep(0)
        assert sid not in _active_generation_tasks
