"""R4.3 (M2) — `CalendarSifIndexStatus.set_status` reset semantics.

A fresh attempt must not inherit its predecessor's failure signals, and
success clears errors:
- entering pending/running clears finished_at + stale error_message;
- `embedding_count` is explicit (None = unchanged, 0 = reset);
- terminal success/skipped clears errors, failed keeps its new message.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_RUNNING,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


UID = "user-1"
SID = "user:user-1:calendar_latest"


class TestStatusResetSemantics:
    def test_retry_after_failure_clears_stale_error(self, db):
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_RUNNING, embedding_count=5)
        CalendarSifIndexStatus.set_status(
            db, UID, SID, STATUS_FAILED, error_message="embed crashed"
        )
        db.commit()

        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.error_message == "embed crashed"

        # A NEW dispatch resets the failure signals:
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_PENDING)
        db.commit()
        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.status == STATUS_PENDING
        assert row.error_message is None
        assert row.finished_at is None

        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_SUCCESS, embedding_count=8)
        db.commit()
        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.status == STATUS_SUCCESS
        assert row.error_message is None
        assert row.embedding_count == 8

    def test_running_attempt_clears_finished_at(self, db):
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_SUCCESS)
        CalendarSifIndexStatus.set_status(
            db, UID, SID, STATUS_FAILED, error_message="x"
        )
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_RUNNING)
        db.commit()
        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.finished_at is None
        assert row.status == STATUS_RUNNING

    def test_explicit_zero_resets_embedding_count(self, db):
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_RUNNING, embedding_count=5)
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_FAILED, error_message="boom")
        db.commit()

        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.embedding_count == 5

        # explicit 0 resets; None leaves unchanged
        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_RUNNING, embedding_count=None)
        db.commit()
        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.embedding_count == 5

        CalendarSifIndexStatus.set_status(db, UID, SID, STATUS_RUNNING, embedding_count=0)
        db.commit()
        row = CalendarSifIndexStatus.get(db, UID, SID)
        assert row.embedding_count == 0
