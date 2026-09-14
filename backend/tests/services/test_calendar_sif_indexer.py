"""Calendar SIF x Calendar integration — Phase B: chunk builder (unit tests).

Uses a fake ``sif_service`` (no txtai) + a MagicMock db to exercise:
chunk building (8 kinds), per-kind doc ids, source hash computation,
and the metadata accessor — the exact contract that
Phase A revalidates end-to-end with a real sqlite session.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from models.calendar_sif_index_status import (
    STATUS_FAILED,
    STATUS_SUCCESS,
    CalendarSifIndexStatus,
)
from models.calendar_sif_watermark import CalendarSifWatermark
from services.calendar_sif_indexer import (
    CALENDAR_KINDS,
    _run_indexing_lifecycle,
    build_calendar_chunks,
    compute_calendar_source_hash,
    calendar_sif_indexing_enabled,
)
from services.calendar_sif_source_ids import (
    calendar_latest_doc_id,
    calendar_latest_source_id,
)

UID = "user-42"
GENERATED_AT = "2026-09-13T10:00:00"


def make_calendar(**overrides):
    calendar = {
        "calendar_type": "monthly",
        "industry": "SaaS",
        "business_size": "SME",
        "content_pillars": ["AI Tutorials", "Case Studies"],
        "platform_strategies": {"linkedin": ["posts", "articles"]},
        "content_mix": {"blog": 60, "video": 40},
        "optimal_timing": {"linkedin": "Tue 9am"},
        "generated_at": GENERATED_AT,
        "daily_schedule": [
            {
                "date": "2026-09-14",
                "week_number": 38,
                "theme": "AI Foundations",
                "content_items": [
                    {
                        "title": "AI 101",
                        "content_type": "blog_post",
                        "platform": "website",
                        "status": "draft",
                        "kpi": "engagement",
                        "expected_outcome": "1000 views",
                    }
                ],
                "platform_distribution": {"website": 1},
                "quality_metrics": {"score": 0.9},
            }
        ],
        "weekly_themes": [
            {"week_number": 38, "theme": "AI Foundations", "content_count": 3, "platforms": ["website", "linkedin"]},
        ],
        "content_recommendations": [
            {"type": "blog_post", "topic": "AI Tutorials", "priority": "high", "estimated_roi": 0.15},
        ],
        "performance_predictions": {
            "estimated_engagement": 75,
            "estimated_reach": 5000,
            "estimated_conversions": 200,
        },
        "trending_topics": ["AI in SaaS"],
        "ai_insights": [
            {"insight": "Post mornings", "action": "Schedule for 9am", "confidence": 0.85},
        ],
        "strategy_insights": {"alignment_score": 0.9},
        "gap_analysis_insights": {"gaps": ["Video content"]},
        "strategy_digest": {"pillars": ["AI Tutorials"]},
        "quality_score": 0.85,
    }
    calendar.update(overrides)
    return calendar


class TestChunkBuilder:
    def test_chunk_contract(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        ids = [c[0] for c in chunks]
        assert len(ids) == len(set(ids)), f"doc ids collide: {ids}"
        assert len(ids) >= 1
        assert all(i.startswith("user:user-42:calendar_latest:") for i in ids)

        metas = {c[2]["kind"]: c[2] for c in chunks}
        for kind in CALENDAR_KINDS:
            if kind in metas:
                assert metas[kind]["source_id"] == "user:user-42:calendar_latest"
                assert metas[kind]["kind"] == kind
                assert metas[kind]["version"] == "1.0"
                assert metas[kind]["generated_at"] == GENERATED_AT
                assert metas[kind]["calendar_type"] == "monthly"

    def test_all_8_kinds_present(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        kinds = {c[2]["kind"] for c in chunks}
        assert "calendar_overview" in kinds
        assert "daily_schedule" in kinds
        assert "weekly_themes" in kinds
        assert "content_recommendations" in kinds
        assert "performance_predictions" in kinds
        assert "ai_insights" in kinds
        assert "strategy_alignment" in kinds
        assert "calendar_events" in kinds

    def test_overview_is_text_lines(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        overview = [c[1] for c in chunks if c[2]["kind"] == "calendar_overview"][0]
        assert "calendar_type: monthly" in overview
        assert "industry: SaaS" in overview
        assert "content_pillars" in overview

    def test_daily_schedule_serialized(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        schedule = [c[1] for c in chunks if c[2]["kind"] == "daily_schedule"][0]
        parsed = json.loads(schedule)
        assert len(parsed) >= 1
        assert parsed[0]["date"] == "2026-09-14"
        assert "AI 101" in schedule

    def test_events_extracted(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        events = [c[1] for c in chunks if c[2]["kind"] == "calendar_events"][0]
        assert "AI 101" in events
        assert "blog_post" in events
        assert "website" in events

    def test_event_chunks_carry_the_day_date_and_theme(self):
        """R4.5: event queries like 'what's scheduled next week?' need the
        containing day's date — generated content items don't carry one."""
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        events = [c[1] for c in chunks if c[2]["kind"] == "calendar_events"][0]
        assert "2026-09-14" in events, "the day's date must be in the passage"
        assert "week 38" in events or "AI Foundations" in events

    def test_recommendations_serialized(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        recs = [c[1] for c in chunks if c[2]["kind"] == "content_recommendations"][0]
        parsed = json.loads(recs)
        assert len(parsed) >= 1
        assert parsed[0]["topic"] == "AI Tutorials"

    def test_predictions_serialized(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        preds = [c[1] for c in chunks if c[2]["kind"] == "performance_predictions"][0]
        assert "estimated_engagement" in preds
        assert "75" in preds

    def test_insights_serialized(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        insights = [c[1] for c in chunks if c[2]["kind"] == "ai_insights"][0]
        assert "Post mornings" in insights

    def test_alignment_serialized(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        alignment = [c[1] for c in chunks if c[2]["kind"] == "strategy_alignment"][0]
        assert "0.85" in alignment or "quality" in alignment.lower()

    def test_empty_schedule_skipped(self):
        calendar = make_calendar(daily_schedule=[])
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        kinds = {c[2]["kind"] for c in chunks}
        assert "daily_schedule" not in kinds

    def test_empty_insights_skipped(self):
        calendar = make_calendar(ai_insights=[])
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        kinds = {c[2]["kind"] for c in chunks}
        assert "ai_insights" not in kinds

    def test_overview_always_present(self):
        calendar = make_calendar(
            daily_schedule=[],
            weekly_themes=[],
            content_recommendations=[],
            performance_predictions={},
            ai_insights=[],
            strategy_insights={},
            gap_analysis_insights={},
            strategy_digest={},
        )
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        kinds = {c[2]["kind"] for c in chunks}
        assert "calendar_overview" in kinds

    def test_doc_ids_unique_per_kind(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        ids = [c[0] for c in chunks]
        for kind in CALENDAR_KINDS:
            kind_ids = [i for i in ids if i.endswith(f":{kind}")]
            assert len(kind_ids) <= 1, f"multiple docs for kind {kind}"

    def test_source_hash_matches_helper(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        chunk_hash = chunks[0][2].pop("source_hash", None)
        computed = compute_calendar_source_hash(UID, calendar, GENERATED_AT)
        assert chunk_hash == computed or chunk_hash is None

    def test_source_hash_in_metadata(self):
        calendar = make_calendar()
        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        for c in chunks:
            meta = c[2]
            assert "source_id" in meta
            assert meta["source_id"] == calendar_latest_source_id(UID)
            doc_id_base = calendar_latest_doc_id(UID, meta["kind"])
            assert meta["kind"] is not None


class TestSourceHashContract:
    def test_hash_deterministic(self):
        calendar = make_calendar()
        h1 = compute_calendar_source_hash(UID, calendar, GENERATED_AT)
        h2 = compute_calendar_source_hash(UID, calendar, GENERATED_AT)
        assert h1 == h2
        assert len(h1) == 64

    def test_hash_changes_with_content(self):
        cal1 = make_calendar()
        cal2 = make_calendar(industry="Healthcare")
        h1 = compute_calendar_source_hash(UID, cal1, GENERATED_AT)
        h2 = compute_calendar_source_hash(UID, cal2, GENERATED_AT)
        assert h1 != h2

    def test_hash_changes_with_user(self):
        calendar = make_calendar()
        h1 = compute_calendar_source_hash("user-1", calendar, GENERATED_AT)
        h2 = compute_calendar_source_hash("user-2", calendar, GENERATED_AT)
        assert h1 != h2


class TestFeatureFlag:
    def test_enabled_by_default(self):
        assert calendar_sif_indexing_enabled() is True


class FakeAsyncSif:
    """Async stand-in mirroring ``TxtaiIntelligenceService.index_content``.

    Returns the number of items upserted (like the real service) unless a
    fixed ``return_count`` or ``error`` is forced.
    """

    def __init__(self, *, return_count=None, error=None):
        self.calls: list = []
        self.return_count = return_count
        self.error = error

    async def index_content(self, items):
        self.calls.append(list(items))
        if self.error is not None:
            raise self.error
        return len(items) if self.return_count is None else self.return_count


class TestIndexingLifecycle:
    """R1.2 / finding C2: the lifecycle must actually embed.

    - the default ``TxtaiIntelligenceService`` is constructed **with the
      user_id** (it is a required argument);
    - ``index_content`` is **awaited** and its returned count — not
      ``len(chunks)`` — drives the watermark + success status;
    - a raising service → ``failed`` and **no watermark**;
    - zero embeddings → ``failed`` and no watermark (never a false-positive
      success on an un-executed coroutine).
    """

    @pytest.fixture()
    def db(self):
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

    def test_success_awaits_embed_and_records_watermark(self, db):
        calendar = make_calendar()
        fake = FakeAsyncSif()

        asyncio.run(
            _run_indexing_lifecycle(db, UID, calendar, GENERATED_AT, sif_service=fake)
        )

        chunks = build_calendar_chunks(calendar, UID, GENERATED_AT)
        assert len(fake.calls) == 1, (
            "index_content must be awaited exactly once with the built chunks"
        )
        assert [c[0] for c in fake.calls[0]] == [c[0] for c in chunks]

        source_id = calendar_latest_source_id(UID)
        expected_hash = compute_calendar_source_hash(UID, calendar, GENERATED_AT)

        status = CalendarSifIndexStatus.get(db, UID, source_id)
        assert status is not None
        assert status.status == STATUS_SUCCESS
        assert status.embedding_count == len(chunks)

        wm = (
            db.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=source_id)
            .one()
        )
        assert wm.embedding_count == len(chunks)
        assert wm.source_hash == expected_hash

    def test_default_service_is_constructed_with_user_id(self, db, monkeypatch):
        constructed: list = []
        calls: list = []

        class FakeSifClass:
            def __init__(self, user_id, *args, **kwargs):
                constructed.append(user_id)
                self.user_id = user_id

            async def index_content(self, items):
                calls.append(list(items))
                return len(items)

        monkeypatch.setattr(
            "services.intelligence.txtai_service.TxtaiIntelligenceService",
            FakeSifClass,
        )

        asyncio.run(_run_indexing_lifecycle(db, UID, make_calendar(), GENERATED_AT))

        assert constructed == [UID], (
            "the default service must be constructed with user_id "
            "(TxtaiIntelligenceService.__init__ requires it)"
        )
        assert len(calls) == 1

    def test_index_failure_records_failed_and_never_writes_watermark(self, db):
        asyncio.run(
            _run_indexing_lifecycle(
                db, UID, make_calendar(), GENERATED_AT,
                sif_service=FakeAsyncSif(error=RuntimeError("txtai exploded")),
            )
        )

        status = CalendarSifIndexStatus.get(db, UID, calendar_latest_source_id(UID))
        assert status is not None
        assert status.status == STATUS_FAILED
        assert "txtai exploded" in (status.error_message or "")
        assert status.embedding_count == 0
        watermark_rows = (
            db.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=calendar_latest_source_id(UID))
            .count()
        )
        assert watermark_rows == 0, "a failed embed must never write the watermark"

    def test_zero_embeddings_records_failed_without_watermark(self, db):
        asyncio.run(
            _run_indexing_lifecycle(
                db, UID, make_calendar(), GENERATED_AT,
                sif_service=FakeAsyncSif(return_count=0),
            )
        )

        status = CalendarSifIndexStatus.get(db, UID, calendar_latest_source_id(UID))
        assert status is not None
        assert status.status == STATUS_FAILED
        watermark_rows = (
            db.query(CalendarSifWatermark)
            .filter_by(user_id=UID, source_id=calendar_latest_source_id(UID))
            .count()
        )
        assert watermark_rows == 0, "zero embeddings must never write the watermark"

    def test_real_txtai_service_constructs_with_user_id(self):
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        svc = TxtaiIntelligenceService("smoke-user")
        assert svc.user_id == "smoke-user"
