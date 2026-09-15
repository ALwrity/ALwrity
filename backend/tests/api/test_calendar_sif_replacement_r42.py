"""R4.2 (H3) — atomic latest-calendar replacement.

- partial regeneration: the 8-kind complement is DELETED from txtai so
  stale kinds of the previous calendar cannot remain searchable;
- generation fencing: an OLDER generation finishing after a newer one must
  NOT overwrite the index/watermark (token compare via the watermark's
  generation_token column).
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_SKIPPED,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from services.calendar_sif_indexer import _run_indexing_lifecycle
from services.calendar_sif_source_ids import (
    CALENDAR_KINDS,
    calendar_latest_doc_id,
    calendar_latest_source_id,
)

_UID = "user-42"


async def _run(session, calendar, generated_at, sif):
    await _run_indexing_lifecycle(session, _UID, calendar, generated_at, sif)


class RecordingSif:
    """Captures upserts + deletes (mirrors TxtaiIntelligenceService API)."""

    def __init__(self):
        self.embedded: list = []
        self.deleted: list = []

    async def index_content(self, items):
        self.embedded.extend(items)
        return len(items)

    async def delete_content(self, doc_ids):
        self.deleted.extend(doc_ids)
        return len(doc_ids)


def _calendar(kinds):
    data = {
        "status": "completed",
        "calendar_type": "monthly",
        "industry": "SaaS",
        "generated_at": "2026-09-13T10:00:00",
        "daily_schedule": [
            {"date": "2026-09-14", "theme": "T", "content_items": [{"title": "AI"}]}
        ],
        "weekly_themes": [{"week_number": 38, "theme": "T"}],
        "content_recommendations": [{"type": "blog", "topic": "T"}],
        "performance_predictions": {"estimated_engagement": 75},
        "ai_insights": [{"insight": "i", "action": "a", "confidence": 0.8}],
        "strategy_digest": {"pillars": ["p"]},
        "quality_score": 0.8,
    }
    optional = {
        "daily_schedule", "weekly_themes", "content_recommendations",
        "performance_predictions", "ai_insights",
    }
    for key in optional - kinds:
        data[key] = None if key != "performance_predictions" else {}
        data[key] = [] if key != "performance_predictions" else {}
    return data


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


class TestPartialRegenerationDeletesStaleKinds:
    @pytest.mark.asyncio
    async def test_old_8_kind_calendar_then_3_kind_listing(self, db):
        """8-kind calendar A, then a 3-kind calendar B: the 5 kinds absent
        from B must be deleted from txtai."""
        sif = RecordingSif()
        await _run(db, _calendar({
            "daily_schedule", "weekly_themes", "content_recommendations",
            "performance_predictions", "ai_insights",
        }), "g1", sif)
        first_doc_ids = {c[0] for c in sif.embedded}
        assert first_doc_ids == {calendar_latest_doc_id(_UID, k) for k in (
            "calendar_overview", "daily_schedule", "weekly_themes",
            "content_recommendations", "performance_predictions",
            "ai_insights", "strategy_alignment", "calendar_events",
        )}

        sif.embedded.clear()
        await _run(db, _calendar({
            "daily_schedule", "ai_insights",
        }), "g2", sif)

        deleted_ids = set(sif.deleted)
        # stale kinds DROPPED by the newer generation (strategy_alignment
        # derives from strategy digest/quality and stays present along with
        # calendar_overview):
        expected_stale = {
            calendar_latest_doc_id(_UID, k)
            for k in (
                "weekly_themes", "content_recommendations",
                "performance_predictions",
            )
        }
        # run 1's stale list is empty (8 kinds present) and the SECOND run's
        # stale kind set is asserted; first_doc_ids from run 1 stay intact:
        assert expected_stale <= deleted_ids
        # present kinds are NOT deleted:
        assert deleted_ids.isdisjoint(
            {calendar_latest_doc_id(_UID, k) for k in (
                "calendar_overview", "daily_schedule", "ai_insights",
            )}
        )
        # new present kinds embedded (strategy_alignment + calendar_events
        # remain present: derived from strategy digest/quality + daily items):
        assert {c[0] for c in sif.embedded} == {
            calendar_latest_doc_id(_UID, k)
            for k in (
                "calendar_overview", "daily_schedule", "ai_insights",
                "strategy_alignment", "calendar_events",
            )
        }


class TestGenerationFencing:
    @pytest.mark.asyncio
    async def test_older_job_records_skipped_and_keeps_newer_watermark(self, db):
        sif = RecordingSif()
        await _run(db, _calendar(set()), "2026-09-14T10:00:00", sif)  # newer T2
        before = (
            db.query(CalendarSifWatermark)
            .filter_by(user_id=_UID, source_id=calendar_latest_source_id(_UID))
            .one()
        )
        assert before.generation_token == "2026-09-14T10:00:00"

        await _run(db, _calendar(set()), "2026-09-14T08:00:00", sif)  # stale T1
        after = (
            db.query(CalendarSifWatermark)
            .filter_by(user_id=_UID, source_id=calendar_latest_source_id(_UID))
            .one()
        )
        assert after.generation_token == "2026-09-14T10:00:00", (
            "stale job must NOT overwrite the fenced watermark"
        )
        row = CalendarSifIndexStatus.get(db, _UID, calendar_latest_source_id(_UID))
        assert row.status in (STATUS_SKIPPED, STATUS_FAILED), (
            "stale job should not claim success over a newer generation"
        )
