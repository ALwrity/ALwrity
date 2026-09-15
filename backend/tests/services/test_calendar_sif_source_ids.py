"""Calendar SIF x Calendar integration — Phase C: source-id contracts (unit tests).

Locks the stable identifier scheme for indexing one generated
content calendar per user:

- ``calendar_latest_source_id(user_id)`` is the watermark/dedupe key.
- ``calendar_latest_doc_id(user_id, kind)`` is the per-kind txtai doc
  id (one document per ``kind`` so re-generation overwrites the same
  docs in place and no stale kinds accumulate).
- ``compute_calendar_source_hash`` is deterministic so an unchanged
  re-generation is detected by the watermark without re-embedding.
- ``CALENDAR_KINDS`` lists the 8 canonical document kinds.

Pure functions — no DB, no txtai. Kept deterministic and importable
in isolation (like ``sif_strategy_source_ids.py``).
"""
import hashlib
import json

import pytest

from services.calendar_sif_source_ids import (
    CALENDAR_KINDS,
    calendar_latest_doc_id,
    calendar_latest_source_id,
    compute_calendar_source_hash,
    to_canonical,
)


class TestCalendarSourceIds:
    def test_calendar_latest_source_id_shape(self):
        assert calendar_latest_source_id("123") == "user:123:calendar_latest"

    def test_calendar_source_id_is_distinct_from_strategy(self):
        from services.intelligence.sif_strategy_source_ids import (
            active_strategy_source_id,
        )
        uid = "some-user"
        assert calendar_latest_source_id(uid) != active_strategy_source_id(uid)
        assert ":calendar_latest" in calendar_latest_source_id(uid)

    def test_doc_id_is_source_plus_kind(self):
        uid = "abc-42"
        source = calendar_latest_source_id(uid)
        assert calendar_latest_doc_id(uid, "daily_schedule") == f"{source}:daily_schedule"

    @pytest.mark.parametrize("kind", [
        "calendar_overview",
        "daily_schedule",
        "weekly_themes",
        "content_recommendations",
        "performance_predictions",
        "ai_insights",
        "strategy_alignment",
        "calendar_events",
    ])
    def test_doc_ids_are_prefix_stable(self, kind):
        first = calendar_latest_doc_id("u1", kind)
        assert calendar_latest_doc_id("u1", kind) == first

    def test_doc_ids_unique_per_kind(self):
        uid = "u-7"
        ids = [calendar_latest_doc_id(uid, k) for k in CALENDAR_KINDS]
        assert len(ids) == len(set(ids)), f"doc ids collide: {ids}"
        assert len(ids) == 8

    def test_doc_ids_partitioned_per_user(self):
        u1 = {calendar_latest_doc_id("user-1", k) for k in CALENDAR_KINDS}
        u2 = {calendar_latest_doc_id("user-2", k) for k in CALENDAR_KINDS}
        assert u1.isdisjoint(u2)
        assert calendar_latest_source_id("user-1") != calendar_latest_source_id("user-2")

    def test_kind_order_is_fixed(self):
        # Stable ordering keeps hash/dedup contract stable across releases.
        assert CALENDAR_KINDS.index("calendar_overview") < CALENDAR_KINDS.index("daily_schedule")

    def test_8_kinds(self):
        assert len(CALENDAR_KINDS) == 8
        assert "calendar_overview" in CALENDAR_KINDS
        assert "calendar_events" in CALENDAR_KINDS


class TestCanonicalHash:
    def test_to_canonical_deterministic(self):
        data = {"user_id": "u1", "calendar_type": "monthly", "items": [1, 2, 3]}
        first = to_canonical(data)
        second = to_canonical(data)
        assert first == second
        assert isinstance(first, str)

    def test_to_canonical_order_independent(self):
        a = {"z": 1, "a": 2, "m": 3}
        b = {"a": 2, "m": 3, "z": 1}
        assert to_canonical(a) == to_canonical(b)

    def test_compute_source_hash_deterministic(self):
        uid = "user-9"
        calendar = {"daily_schedule": [{"date": "2026-01-01", "theme": "Testing"}]}
        generated_at = "2026-01-01T00:00:00"
        h1 = compute_calendar_source_hash(uid, calendar, generated_at)
        h2 = compute_calendar_source_hash(uid, calendar, generated_at)
        assert h1 == h2
        assert len(h1) == 64  # sha256 hex

    def test_source_hash_changes_with_content(self):
        uid = "user-9"
        cal1 = {"daily_schedule": [{"date": "2026-01-01"}]}
        cal2 = {"daily_schedule": [{"date": "2026-01-02"}]}
        h1 = compute_calendar_source_hash(uid, cal1, "2026-01-01T00:00:00")
        h2 = compute_calendar_source_hash(uid, cal2, "2026-01-01T00:00:00")
        assert h1 != h2

    def test_source_hash_changes_with_user(self):
        calendar = {"daily_schedule": [{"date": "2026-01-01"}]}
        h1 = compute_calendar_source_hash("user-1", calendar, "2026-01-01T00:00:00")
        h2 = compute_calendar_source_hash("user-2", calendar, "2026-01-01T00:00:00")
        assert h1 != h2

    def test_source_hash_with_datetime_input(self):
        from datetime import datetime
        uid = "user-1"
        calendar = {"daily_schedule": [{"date": "2026-01-01"}]}
        dt = datetime(2026, 1, 1, 12, 0, 0)
        h = compute_calendar_source_hash(uid, calendar, dt)
        assert len(h) == 64


class TestSourceHashIgnoresVolatileFields:
    """R4.4: the hash is over CONTENT — volatile timestamps/session identity
    must never force a re-embed of an unchanged calendar."""

    def test_generated_at_alone_does_not_change_hash(self):
        content = {"daily_schedule": [{"date": "2026-01-01", "theme": "T"}]}
        h1 = compute_calendar_source_hash("u", content, "2026-01-01T00:00:00")
        h2 = compute_calendar_source_hash("u", content, "2027-12-31T23:59:59")
        assert h1 == h2

    def test_volatile_inner_fields_do_not_change_hash(self):
        base = {"daily_schedule": [{"date": "2026-01-01", "theme": "T"}]}
        with_noise = {
            **base,
            "generated_at": "2026-02-02T02:02:02",
            "processing_time": 3.25,
            "session_id": "cal-session-77",
        }
        h1 = compute_calendar_source_hash("u", base, "2026-01-01T00:00:00")
        h2 = compute_calendar_source_hash("u", with_noise, "2026-01-01T00:00:00")
        assert h1 == h2

    def test_nested_generated_at_does_not_change_hash(self):
        base = {"daily_schedule": [{"date": "2026-01-01", "generated_at": "A"}]}
        changed = {"daily_schedule": [{"date": "2026-01-01", "generated_at": "B"}]}
        h1 = compute_calendar_source_hash("u", base, "x")
        h2 = compute_calendar_source_hash("u", changed, "y")
        assert h1 == h2

    def test_real_content_change_still_changes_hash(self):
        cal1 = {"daily_schedule": [{"date": "2026-01-01", "theme": "T"}]}
        cal2 = {"daily_schedule": [{"date": "2026-01-01", "theme": "Also new"}]}
        h1 = compute_calendar_source_hash("u", cal1, "g")
        h2 = compute_calendar_source_hash("u", cal2, "x")
        assert h1 != h2


class TestCalendarSourceIdsAgainstStrategy:
    def test_calendar_and_strategy_source_ids_different(self):
        from services.intelligence.sif_strategy_source_ids import (
            active_strategy_source_id,
        )
        uid = "shared-user"
        strategy_id = active_strategy_source_id(uid)
        calendar_id = calendar_latest_source_id(uid)
        assert strategy_id != calendar_id
        assert ":strategy_active:" in strategy_id
        assert ":calendar_latest" in calendar_id

    def test_calendar_doc_ids_partitioned_from_strategy(self):
        from services.intelligence.sif_strategy_source_ids import (
            active_strategy_doc_id,
        )
        uid = "shared-user-2"
        strategy_docs = {active_strategy_doc_id(uid, k) for k in
                          ["form_summary", "base_strategy", "strategic_insights",
                           "competitive_analysis", "performance_predictions",
                           "implementation_roadmap", "risk_assessment",
                           "user_persona_digest"]}
        calendar_docs = {calendar_latest_doc_id(uid, k) for k in CALENDAR_KINDS}
        assert strategy_docs.isdisjoint(calendar_docs)
