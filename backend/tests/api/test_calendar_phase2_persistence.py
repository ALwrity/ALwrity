"""Phase 2 persistence contracts: session_key dedupe, loud save, date parsing."""

from __future__ import annotations

import pytest

from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)


@pytest.fixture
def sqlite_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from models.base import Base  # noqa: F401
    import models.content_planning  # noqa: F401
    import models.enhanced_calendar_models  # noqa: F401

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _service(db):
    service = object.__new__(CalendarGenerationService)
    service.db_session = db
    service.orchestrator_sessions = {}
    service.orchestrator = None
    return service


def test_parse_scheduled_date_handles_z_suffix():
    parsed = CalendarGenerationService._parse_scheduled_date("2026-01-05T10:00:00Z")
    assert parsed.year == 2026 and parsed.month == 1 and parsed.day == 5


@pytest.mark.asyncio
async def test_save_dedupes_persist_row(sqlite_session):
    from models.content_planning import ContentStrategy
    from models.enhanced_calendar_models import CalendarGenerationSession as Row

    strategy = ContentStrategy(user_id=1, name="S", industry="saas")
    sqlite_session.add(strategy)
    sqlite_session.commit()

    service = _service(sqlite_session)
    calendar_data = {
        "calendar_type": "monthly",
        "daily_schedule": [
            {"date": "2026-01-05", "content_items": [
                {"title": "T", "description": "D",
                 "content_type": "blog", "target_platform": "LinkedIn"}
            ]},
        ],
    }
    await service._save_calendar_to_db("user-123", strategy.id, calendar_data, "dup-sid")
    await service._save_calendar_to_db("user-123", strategy.id, calendar_data, "dup-sid")

    rows = sqlite_session.query(Row).all()
    assert len(rows) == 1
    assert rows[0].generation_status == "completed"


@pytest.mark.asyncio
async def test_save_events_idempotent_on_resave(sqlite_session):
    """R4.1: retrying/partial re-saving a session must NOT duplicate
    CalendarEvent rows - save-is-twice counts events once."""
    from models.content_planning import CalendarEvent, ContentStrategy

    strategy = ContentStrategy(user_id=1, name="S", industry="saas")
    sqlite_session.add(strategy)
    sqlite_session.commit()

    service = _service(sqlite_session)
    calendar_data = {
        "calendar_type": "monthly",
        "daily_schedule": [
            {"date": "2026-01-05", "content_items": [
                {"title": "T", "description": "D",
                 "content_type": "blog", "target_platform": "LinkedIn"}
            ]},
        ],
    }
    await service._save_calendar_to_db("user-123", strategy.id, calendar_data, "dup-sid")
    await service._save_calendar_to_db("user-123", strategy.id, calendar_data, "dup-sid")

    events = (
        sqlite_session.query(CalendarEvent)
        .filter(CalendarEvent.strategy_id == strategy.id)
        .all()
    )
    assert len(events) == 1, "re-saving an identical calendar must be idempotent"


@pytest.mark.asyncio
async def test_save_loud_on_db_failure():
    service = object.__new__(CalendarGenerationService)

    class _Broken:
        def add(self, *a, **k):
            raise RuntimeError("boom")
        def flush(self, *a, **k):
            raise RuntimeError("boom")
        def commit(self, *a, **k):
            raise RuntimeError("boom")
        def rollback(self):
            pass
        def query(self, *a, **k):
            raise RuntimeError("boom")

    service.db_session = _Broken()
    service.orchestrator_sessions = {}
    with pytest.raises(Exception):
        await service._save_calendar_to_db(
            "u", 1, {"daily_schedule": [{"date": "2026-01-05", "content_items": []}]},
            "sid-boom",
        )


def test_failed_status_canonical():
    import inspect

    src = inspect.getsource(CalendarGenerationService.start_orchestrator_generation)
    assert 'session["status"] = "failed"' in src
