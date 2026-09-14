"""R4.3 — honest calendar SIF indexing lifecycle.

- `pending` is recorded DURABLY (synchronously) at dispatch, before the
  background task exists;
- the embed step retries per the documented contract (3 attempts,
  1s/2s/4s backoff); success writes truthful watermark + status;
- fail-always → status FAILED after the retry budget, no watermark;
  backoff is exercised via a stub of asyncio.sleep (no real waiting).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.content_planning.services.calendar_generation_service import (
    CalendarGenerationService,
)
from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from models.content_planning import CalendarEvent
from models.enhanced_calendar_models import CalendarGenerationSession

from services.calendar_sif_indexer import (
    DEFAULT_RETRY_BASE_DELAY,
    build_calendar_chunks,
    index_calendar_async,
)
from services.calendar_sif_source_ids import calendar_latest_source_id

GENERATED_AT = "2026-09-13T10:00:00"
UID = "user-42"
STRATEGY_ID = 1


def make_calendar():
    return {
        "status": "completed",
        "calendar_type": "monthly",
        "industry": "SaaS",
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


class FlakySif:
    """Fails the first `fails` calls, then embeds normally."""

    def __init__(self, fails: int):
        self.fails = fails
        self.attempts = 0

    async def index_content(self, items):
        self.attempts += 1
        if self.attempts <= self.fails:
            raise RuntimeError(f"attempt {self.attempts} exploded")
        return len(items)


class AlwaysFailingSif:
    async def index_content(self, items):
        raise RuntimeError("txtai down for good")


@pytest.fixture()
def db():
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
    yield session, sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session.close()
    engine.dispose()


class TestPendingAtDispatch:
    def test_pending_written_synchronously_before_task(self, db):
        session, SessionLocal = db
        disposable_tasks: list = []

        def factory(user_id):
            instance = SessionLocal()

            class _P:
                def __getattr__(self, name):
                    return getattr(instance, name)

                def close(self):
                    pass  # keep the shared engine writable; closed at dispose

            disposable_tasks.append(instance)
            return instance

        async def runner():
            task = index_calendar_async(
                UID, make_calendar(), GENERATED_AT,
                sif_service=_AlwaysOk(),
                session_factory=factory,
            )
            # BEFORE awaiting the task, the durable `pending` is visible:
            row = CalendarSifIndexStatus.get(
                session, UID, calendar_latest_source_id(UID)
            )
            assert row is not None
            assert row.status == STATUS_PENDING, "pending must be written at dispatch"
            await task
            return row

        row = asyncio.run(runner())
        session.expire_all()
        engine_db_row = CalendarSifIndexStatus.get(
            session, UID, calendar_latest_source_id(UID)
        )
        assert engine_db_row.status == 'success'


class _AlwaysOk:
    async def index_content(self, items):
        return len(items)


class TestEmbedRetryWithBackoff:
    @pytest.mark.asyncio
    async def test_flaky_embed_retries_then_succeeds(self, db, monkeypatch):
        session, SessionLocal = db
        sleeps: list = []

        async def fake_sleep(seconds):
            sleeps.append(seconds)

        monkeypatch.setattr("services.calendar_sif_indexer.asyncio.sleep", fake_sleep)

        flaky = FlakySif(fails=2)
        calendar = make_calendar()

        await _run_direct(
            session, UID, calendar, GENERATED_AT, flaky
        )

        row = CalendarSifIndexStatus.get(session, UID, calendar_latest_source_id(UID))
        session.expire_all()
        row = CalendarSifIndexStatus.get(session, UID, calendar_latest_source_id(UID))
        print('DEBUG row status:', row.status, '| err:', row.error_message, '| sleeps:', sleeps, '| wmcount:', session.query(CalendarSifWatermark).count())
        assert row.status == 'success'
        chunks = len(build_calendar_chunks(make_calendar(), UID, GENERATED_AT))
        wm = (
            session.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=calendar_latest_source_id(UID))
            .one()
        )
        assert wm.embedding_count == chunks
        # documented backoff: 1s after attempt 1, 2s after attempt 2
        assert sleeps == [1.0, 2.0]
        # pending durably recorded then running attempt
        assert row.attempt == 1

    @pytest.mark.asyncio
    async def test_fail_always_records_failed_no_watermark(self, db, monkeypatch):
        session, SessionLocal = db
        sleeps: list = []

        async def fake_sleep(seconds):
            sleeps.append(seconds)

        monkeypatch.setattr("services.calendar_sif_indexer.asyncio.sleep", fake_sleep)

        await _run_direct(
            session, UID, make_calendar(), GENERATED_AT, AlwaysFailingSif()
        )

        row = CalendarSifIndexStatus.get(session, UID, calendar_latest_source_id(UID))
        assert row.status == 'failed'
        assert 'txtai down for good' in (row.error_message or '')
        wm = (
            session.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=calendar_latest_source_id(UID))
            .count()
        )
        assert wm == 0
        assert sleeps == [1.0, 2.0]


async def _run_direct(session, user_id, calendar_data, generated_at, sif_service):
    """Run the lifecycle directly (no event-loop task indirection)."""
    from services.calendar_sif_indexer import _run_indexing_lifecycle

    await _run_indexing_lifecycle(
        session, user_id, calendar_data, generated_at, sif_service
    )
