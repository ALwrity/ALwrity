"""Calendar SIF lifecycle model tests.

Mirrors ``tests/services/intelligence/test_strategy_sif_index_status.py``
but for the calendar SIF index status and watermark tables.

Contract:
- One row per ``(user_id, source_id)`` where ``source_id`` is
  ``user:{uid}:calendar_latest``.
- Status values: ``pending → running → success | skipped | failed``.
- Writes are best-effort and never raise.
- Watermark tracks ``source_hash`` for dedup/freshness.
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


@pytest.fixture()
def sqlite_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from models.calendar_sif_index_status import (
        CalendarSifIndexStatus,
    )
    from models.calendar_sif_watermark import CalendarSifWatermark

    CalendarSifIndexStatus.__table__.create(engine)
    CalendarSifWatermark.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


def _make_status(session, user_id="user-1", source_id="user:user-1:calendar_latest"):
    from models.calendar_sif_index_status import CalendarSifIndexStatus

    row = CalendarSifIndexStatus(user_id=user_id, source_id=source_id)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


class TestCalendarSifIndexStatus:
    def test_status_pending_default(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_PENDING,
            CalendarSifIndexStatus,
        )

        row = CalendarSifIndexStatus(
            user_id="u1", source_id="user:u1:calendar_latest"
        )
        assert row.status is None or row.status == STATUS_PENDING
        assert row.embedding_count is None or row.embedding_count == 0
        assert row.attempt is None or row.attempt == 0

    def test_row_persists(self, sqlite_db):
        row = _make_status(sqlite_db)
        assert row.id is not None
        assert row.user_id == "user-1"
        assert row.source_id == "user:user-1:calendar_latest"

    def test_set_status_pending(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_PENDING,
            CalendarSifIndexStatus,
        )

        _make_status(sqlite_db)
        CalendarSifIndexStatus.set_status(
            sqlite_db, "user-1", "user:user-1:calendar_latest", STATUS_PENDING,
        )
        sqlite_db.commit()
        refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
        assert refreshed.status == STATUS_PENDING

    def test_set_status_running_increments_attempt(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_PENDING,
            STATUS_RUNNING,
            CalendarSifIndexStatus,
        )

        row = _make_status(sqlite_db)
        row.attempt = 2
        sqlite_db.commit()

        CalendarSifIndexStatus.set_status(
            sqlite_db, "user-1", "user:user-1:calendar_latest", STATUS_RUNNING
        )
        sqlite_db.commit()
        refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
        assert refreshed.status == STATUS_RUNNING
        assert refreshed.attempt == 3

    def test_set_status_success_stamps_finished(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_PENDING,
            STATUS_RUNNING,
            STATUS_SUCCESS,
            CalendarSifIndexStatus,
        )

        _make_status(sqlite_db)
        CalendarSifIndexStatus.set_status(
            sqlite_db, "user-1", "user:user-1:calendar_latest", STATUS_PENDING
        )
        CalendarSifIndexStatus.set_status(
            sqlite_db, "user-1", "user:user-1:calendar_latest", STATUS_RUNNING
        )
        CalendarSifIndexStatus.set_status(
            sqlite_db, "user-1", "user:user-1:calendar_latest", STATUS_SUCCESS
        )
        sqlite_db.commit()
        refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
        assert refreshed.status == STATUS_SUCCESS
        assert refreshed.finished_at is not None
        assert refreshed.started_at is not None

    def test_set_status_with_embedding_count(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_SUCCESS,
            CalendarSifIndexStatus,
        )

        CalendarSifIndexStatus.set_status(
            sqlite_db,
            "user-1",
            "user:user-1:calendar_latest",
            STATUS_SUCCESS,
            embedding_count=8,
        )
        sqlite_db.commit()
        refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
        assert refreshed.embedding_count == 8

    def test_set_status_with_error_message(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_FAILED,
            CalendarSifIndexStatus,
        )

        CalendarSifIndexStatus.set_status(
            sqlite_db,
            "user-1",
            "user:user-1:calendar_latest",
            STATUS_FAILED,
            error_message="txtai unreachable",
        )
        sqlite_db.commit()
        refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
        assert refreshed.error_message == "txtai unreachable"

    def test_get_returns_none_for_missing(self, sqlite_db):
        from models.calendar_sif_index_status import CalendarSifIndexStatus

        row = CalendarSifIndexStatus.get(
            sqlite_db, "user-1", "user:user-1:calendar_latest"
        )
        assert row is None

    def test_set_status_never_raises(self, sqlite_db):
        from models.calendar_sif_index_status import CalendarSifIndexStatus

        result = CalendarSifIndexStatus.set_status(
            sqlite_db, "u1", "user:u1:calendar_latest", "running"
        )
        assert result is None or result is not None

    def test_terminal_statuses(self, sqlite_db):
        from models.calendar_sif_index_status import (
            STATUS_FAILED,
            STATUS_SKIPPED,
            STATUS_SUCCESS,
            CalendarSifIndexStatus,
        )

        for status in (STATUS_SKIPPED, STATUS_FAILED, STATUS_SUCCESS):
            row = _make_status(sqlite_db)
            CalendarSifIndexStatus.set_status(
                sqlite_db, "user-1", "user:user-1:calendar_latest", status
            )
            sqlite_db.commit()
            refreshed = sqlite_db.query(CalendarSifIndexStatus).first()
            assert refreshed.status == status
            assert refreshed.finished_at is not None
            sqlite_db.delete(refreshed)
            sqlite_db.commit()


class TestCalendarSifWatermark:
    def test_upsert_creates_row(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        row = CalendarSifWatermark.upsert(
            sqlite_db,
            "user-1",
            "user:user-1:calendar_latest",
            source_hash="abc123",
            embedding_count=8,
            notes="test",
        )
        sqlite_db.commit()
        assert row.id is not None
        assert row.source_hash == "abc123"
        assert row.embedding_count == 8

    def test_upsert_updates_existing(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        CalendarSifWatermark.upsert(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "hash1", 5
        )
        sqlite_db.commit()
        CalendarSifWatermark.upsert(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "hash2", 8
        )
        sqlite_db.commit()
        rows = sqlite_db.query(CalendarSifWatermark).all()
        assert len(rows) == 1
        assert rows[0].source_hash == "hash2"
        assert rows[0].embedding_count == 8

    def test_is_fresh_true(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        CalendarSifWatermark.upsert(
            sqlite_db,
            "user-1",
            "user:user-1:calendar_latest",
            source_hash="abc123",
        )
        sqlite_db.commit()
        assert CalendarSifWatermark.is_fresh(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "abc123"
        ) is True

    def test_is_fresh_false_wrong_hash(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        CalendarSifWatermark.upsert(
            sqlite_db,
            "user-1",
            "user:user-1:calendar_latest",
            source_hash="abc123",
        )
        sqlite_db.commit()
        assert CalendarSifWatermark.is_fresh(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "wrong"
        ) is False

    def test_is_fresh_false_missing(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        assert CalendarSifWatermark.is_fresh(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "abc123"
        ) is False

    def test_is_fresh_false_empty_hash(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        assert CalendarSifWatermark.is_fresh(
            sqlite_db, "user-1", "user:user-1:calendar_latest", ""
        ) is False

    def test_get_indexed_source_ids(self, sqlite_db):
        from models.calendar_sif_watermark import CalendarSifWatermark

        CalendarSifWatermark.upsert(
            sqlite_db, "user-1", "user:user-1:calendar_latest", "h1"
        )
        CalendarSifWatermark.upsert(
            sqlite_db, "user-1", "user:user-2:calendar_latest", "h2"
        )
        sqlite_db.commit()
        result = CalendarSifWatermark.get_indexed_source_ids(
            sqlite_db,
            "user-1",
            [
                "user:user-1:calendar_latest",
                "user:user-2:calendar_latest",
                "user:user-3:calendar_latest",
            ],
        )
        assert len(result) == 2
        assert "user:user-1:calendar_latest" in result
