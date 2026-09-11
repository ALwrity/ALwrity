"""SIF x Strategy integration — Phase SIF-A: source-id contracts (unit tests).

Locks the stable identifier scheme for indexing one active content
strategy per user:

- ``active_strategy_source_id(user_id)`` is the watermark/dedupe key.
- ``active_strategy_doc_id(user_id, kind)`` is the per-kind txtai doc
  id (one document per ``kind`` so re-activation overwrites the same
  docs in place and no stale kinds accumulate).
- ``to_canonical`` / ``source_hash`` are deterministic so an unchanged
  re-activation is detected by the watermark without re-embedding.
- ``build_form_text`` renders the 30 form fields as stable
  ``"{label}: {value}"`` lines for embedding.

Pure functions — no DB, no txtai. Kept deterministic.
"""
import hashlib

import pytest

from services.intelligence.sif_strategy_source_ids import (
    STRATEGY_FORM_FIELDS,
    STRATEGY_KINDS,
    active_strategy_doc_id,
    active_strategy_source_id,
    build_form_text,
    compute_source_hash,
    source_hash_for,
    strategy_vfs_source_id,
    to_canonical,
)


class TestSourceIds:
    def test_active_source_id_shape(self):
        assert active_strategy_source_id("123") == "user:123:strategy_active:current"

    def test_vfs_source_id_is_distinct(self):
        assert strategy_vfs_source_id("123") == "user:123:strategy_vfs:current"
        assert strategy_vfs_source_id("123") != active_strategy_source_id("123")

    def test_doc_id_is_source_plus_kind(self):
        uid = "abc-42"
        source = active_strategy_source_id(uid)
        assert active_strategy_doc_id(uid, "base_strategy") == f"{source}:base_strategy"

    @pytest.mark.parametrize("kind", ["form_summary", "base_strategy",
                                      "strategic_insights", "competitive_analysis",
                                      "performance_predictions", "implementation_roadmap",
                                      "risk_assessment", "user_persona_digest"])
    def test_doc_ids_are_prefix_stable(self, kind):
        first = active_strategy_doc_id("u1", kind)
        assert active_strategy_doc_id("u1", kind) == first

    def test_doc_ids_unique_per_kind(self):
        uid = "u-7"
        ids = [active_strategy_doc_id(uid, k) for k in STRATEGY_KINDS]
        assert len(ids) == len(set(ids)), f"doc ids collide: {ids}"
        assert len(ids) == 8

    def test_doc_ids_partitioned_per_user(self):
        u1 = {active_strategy_doc_id("user-1", k) for k in STRATEGY_KINDS}
        u2 = {active_strategy_doc_id("user-2", k) for k in STRATEGY_KINDS}
        assert u1.isdisjoint(u2)
        assert active_strategy_source_id("user-1") != active_strategy_source_id("user-2")

    def test_kind_order_is_fixed(self):
        # Stable ordering keeps hash/dedup contract stable across releases.
        assert STRATEGY_KINDS.index("form_summary") < STRATEGY_KINDS.index("base_strategy")

    def test_form_fields_count_matches_30(self):
        assert len(STRATEGY_FORM_FIELDS) == 30
        # The two non-JSON columns lead; the 28 wizard inputs follow.
        assert STRATEGY_FORM_FIELDS[:2] == ("name", "industry")
        assert "business_objectives" in STRATEGY_FORM_FIELDS
        assert "content_roi_targets" in STRATEGY_FORM_FIELDS


class TestCanonicalHash:
    def test_to_canonical_deterministic(self):
        obj = {"b": 1, "a": [1, 2, {"z": 2, "y": 1}], "c": "héllo"}
        assert to_canonical(obj) == to_canonical(obj)

    def test_to_canonical_ignores_key_order(self):
        a = {"x": 1, "y": [3, 2, 1]}
        b = {"y": [3, 2, 1], "x": 1}
        assert to_canonical(a) == to_canonical(b)

    def test_to_canonical_handles_non_json_types(self):
        from datetime import datetime, date
        obj = {"d": datetime(2026, 9, 9, 1, 2, 3), "dt": date(2026, 9, 9), "s": {1, 2}}
        assert to_canonical(obj) == to_canonical(obj)

    def test_source_hash_sha256_hex(self):
        uid = "u1"
        data = {"form": {"business_objectives": ["a"]}, "activation": "2026-09-09T00:00:00"}
        digest = compute_source_hash(uid, data, activation_date="2026-09-09T00:00:00")
        assert len(digest) == 64
        int(digest, 16)  # raises if not hex

    def test_source_hash_reproducible(self):
        uid = "u1"
        data = {"form": {"business_objectives": ["a"], "brand_voice": "bold"}, "x": 1}
        kw = dict(user_id=uid, data=data, activation_date="2026-09-09T00:00:00")
        assert compute_source_hash(**kw) == compute_source_hash(**kw)

    def test_source_hash_sensitive_to_content(self):
        uid = "u1"
        base = {"form": {"business_objectives": ["a"]}}
        d1 = compute_source_hash(uid, base, activation_date="2026-09-09T00:00:00")
        mutated = compute_source_hash(
            uid, {"form": {"business_objectives": ["b"]}}, activation_date="2026-09-09T00:00:00"
        )
        assert d1 != mutated

    def test_source_hash_independent_of_dict_key_order(self):
        uid = "u1"
        a = {"form": {"brand_voice": "bold", "content_frequency": "weekly"}}
        b = {"form": {"content_frequency": "weekly", "brand_voice": "bold"}}
        kw = dict(activation_date="2026-09-09T00:00:00")
        assert compute_source_hash(uid, a, **kw) == compute_source_hash(uid, b, **kw)

    def test_source_hash_for_alias(self):
        uid = "u2"
        raw = {"business_objectives": ["grow"], "brand_voice": "friendly"}
        expected = compute_source_hash(
            uid, {"form": raw}, activation_date="2026-09-09T00:00:00"
        )
        assert source_hash_for(uid, raw, activation_date="2026-09-09T00:00:00") == expected


class TestBuildFormText:
    def test_flat_lines(self):
        text = build_form_text(
            {"brand_voice": "bold", "content_frequency": "weekly"},
            fields=("brand_voice", "content_frequency"),
        )
        lines = [ln for ln in text.splitlines() if ln]
        assert len(lines) == 2
        assert lines[0] == "brand_voice: bold"
        assert lines[1] == "content_frequency: weekly"

    def test_full_form_renders_fixed_30_line_shape(self):
        text = build_form_text({"business_objectives": ["grow"]})
        lines = [ln for ln in text.splitlines() if ln]
        assert len(lines) == 30
        assert lines[0] == "name:"
        assert lines[1] == "industry:"
        assert lines[2].startswith("business_objectives:")

    def test_deterministic_order(self):
        f1 = {"brand_voice": "bold", "content_frequency": "weekly"}
        f2 = {"content_frequency": "weekly", "brand_voice": "bold"}
        assert build_form_text(f1) == build_form_text(f2)

    def test_value_stringification(self):
        fields = ("business_objectives", "content_budget", "team_size",
                  "implementation_timeline", "ab_testing_capabilities")
        text = build_form_text({
            "business_objectives": ["grow", "retain"],
            "content_budget": 5000.0,
            "team_size": 3,
            "implementation_timeline": None,
            "ab_testing_capabilities": {"active": True},
        }, fields=fields)
        assert "business_objectives: grow, retain" in text
        assert "content_budget: 5000.0" in text
        assert "team_size: 3" in text
        assert "implementation_timeline:" in text
        assert "ab_testing_capabilities: active: true" in text

    def test_empty_fields_emit_label_with_empty_value(self):
        text = build_form_text({"brand_voice": None}, fields=("brand_voice",))
        assert text == "brand_voice:\n"