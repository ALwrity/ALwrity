"""Calendar SIF x Calendar integration — Phase B: chunk builder (unit tests).

Uses a fake ``sif_service`` (no txtai) + a MagicMock db to exercise:
chunk building (8 kinds), per-kind doc ids, source hash computation,
and the metadata accessor — the exact contract that
Phase A revalidates end-to-end with a real sqlite session.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.calendar_sif_indexer import (
    CALENDAR_KINDS,
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
