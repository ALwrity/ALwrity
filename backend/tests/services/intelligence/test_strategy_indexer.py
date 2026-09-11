"""SIF x Strategy integration — Phase SIF-B: indexing pipeline (unit tests).

Uses a fake ``sif_service`` (no txtai) + a MagicMock db to exercise:
chunk building, per-kind doc ids, watermark fresh-skip, watermark
recording, retry/backoff, and the metadata accessor — the exact contract
that SIF-E revalidates end-to-end with a real sqlite session.
"""
import asyncio
from unittest.mock import MagicMock, patch

import pytest

from services.intelligence import strategy_indexer as idx
from services.intelligence.strategy_indexer import (
    ANALYSIS_KINDS,
    STRATEGY_FORM_FIELDS,
    build_strategy_chunks,
    extract_form_fields,
    get_document_metadata,
    index_active_strategy,
    index_active_strategy_async,
    strategy_sif_indexing_enabled,
)

UID = "user-42"
ACTIVATION = "2026-09-09T10:00:00"


def make_strategy(**overrides):
    comprehensive = {
        "strategy_metadata": {
            "version": "2.0",
            "generated_at": "2026-09-09T09:00:00",
            "grounding_status": "grounded",
            "content_categories": ["blog", "social"],
        },
        "base_strategy": {"pillars": ["ownership", "education"]},
        "strategic_insights": {"top": "differentiate on trust"},
        "competitive_analysis": {"competitors": ["A", "B"], "gap": "video"},
        "performance_predictions": {"6m_views": 50000},
        "implementation_roadmap": {"q1": ["brand audit"]},
        "risk_assessment": {"risks": ["team bandwidth"]},
        "summary": "bolt-on summary that must NOT be indexed",
    }
    data = dict(
        id=7,
        name="Growth Plan",
        industry="SaaS",
        business_objectives=["grow", "retain"],
        target_metrics=["DAU"],
        content_budget=5000.0,
        team_size=3,
        implementation_timeline="6 months",
        market_share="5%",
        competitive_position="challenger",
        content_preferences=["blogs"],
        consumption_patterns=["evening"],
        audience_pain_points=["time"],
        buying_journey=["awareness"],
        seasonal_trends=["q4"],
        engagement_metrics={"ctr": 0.03},
        top_competitors=["X"],
        competitor_content_strategies="webinars",
        market_gaps=["video"],
        industry_trends=["AI"],
        emerging_trends=["personalization"],
        preferred_formats=["long-form"],
        content_mix=["60/40"],
        content_frequency="weekly",
        optimal_timing=["9am"],
        quality_metrics=["editorial bar"],
        editorial_guidelines=["no jargon"],
        brand_voice="bold",
        traffic_sources=["search"],
        conversion_rates={"lead": 0.1},
        content_roi_targets={"roas": 3.0},
        comprehensive_ai_analysis=comprehensive,
    )
    data.update(overrides)
    return data


class FakeEmbeddings:
    def __init__(self):
        self.docs = {}

    def get(self, doc_id):
        return self.docs.get(doc_id)


class FakeSIF:
    """Stand-in for TxtaiIntelligenceService (async index_content only)."""

    def __init__(self, fail_before_success=0):
        self.calls = []
        self.fail_before_success = fail_before_success
        self.embeddings = FakeEmbeddings()

    async def index_content(self, items):
        if self.fail_before_success > 0:
            self.fail_before_success -= 1
            raise RuntimeError("simulated txtai failure")
        self.calls.append(items)
        for doc_id, text, _meta in items:
            self.embeddings.docs[doc_id] = {"text": text}
        return len(items)


def _run(coro):
    return asyncio.run(coro)


class TestChunkBuilder:
    def test_chunk_contract(self):
        strategy = make_strategy()
        chunks = build_strategy_chunks(strategy, UID, ACTIVATION)
        assert len(chunks) == 8
        ids = [c[0] for c in chunks]
        assert len(ids) == len(set(ids))
        assert all(i.startswith(f"user:user-42:strategy_active:current:") for i in ids)

        metas = {c[2]["kind"]: c[2] for c in chunks}
        assert set(metas) == {"form_summary", "base_strategy", "strategic_insights",
                              "competitive_analysis", "performance_predictions",
                              "implementation_roadmap", "risk_assessment",
                              "user_persona_digest"}
        for c in chunks:
            meta = c[2]
            assert meta["strategy_id"] == 7
            assert meta["source_id"] == "user:user-42:strategy_active:current"
            assert meta["activation_date"] == ACTIVATION
            assert meta["version"] == "2.0"
            assert meta["grounding_status"] == "grounded"

    def test_form_summary_is_30_lines(self):
        chunks = build_strategy_chunks(make_strategy(), UID, ACTIVATION)
        text = dict((c[2]["kind"], c[0]) for c in chunks)
        form = [c[1] for c in chunks if c[2]["kind"] == "form_summary"][0]
        lines = [ln for ln in form.splitlines() if ln]
        assert len(lines) == 30
        assert "name: Growth Plan" in lines
        assert "business_objectives: grow, retain" in lines

    def test_analysis_components_serialized(self):
        chunks = build_strategy_chunks(make_strategy(), UID, ACTIVATION)
        by_kind = {c[2]["kind"]: c[1] for c in chunks}
        assert "pillars" in by_kind["base_strategy"]
        assert "differentiate on trust" in by_kind["strategic_insights"]
        assert "gap" in by_kind["competitive_analysis"]
        assert "summary" not in "".join(by_kind.values()) or "bolt-on summary" not in \
            "".join(by_kind.values())
        assert "form_summary" in by_kind

    def test_summary_key_is_not_indexed(self):
        chunks = build_strategy_chunks(make_strategy(), UID, ACTIVATION)
        all_text = " ".join(c[1] for c in chunks)
        assert "bolt-on summary" not in all_text

    def test_missing_component_skipped_but_form_always_emitted(self):
        strategy = make_strategy()
        strategy["comprehensive_ai_analysis"].pop("risk_assessment")
        strategy["comprehensive_ai_analysis"]["strategic_insights"] = {}
        chunks = build_strategy_chunks(strategy, UID, ACTIVATION)
        kinds = {c[2]["kind"] for c in chunks}
        assert len(chunks) == 6
        assert "form_summary" in kinds
        assert "risk_assessment" not in kinds
        assert "strategic_insights" not in kinds
        ids = [c[0] for c in chunks]
        assert len(ids) == len(set(ids))

    def test_persona_digest_uses_persona_fields(self):
        strategy = make_strategy()
        chunks = build_strategy_chunks(strategy, UID, ACTIVATION)
        persona = [c[1] for c in chunks if c[2]["kind"] == "user_persona_digest"][0]
        assert "brand_voice: bold" in persona
        assert "buying_journey: awareness" in persona

    def test_persona_absent_skipped_if_no_persona_fields(self):
        strategy = make_strategy()
        for f in ("brand_voice", "content_preferences", "consumption_patterns",
                  "audience_pain_points", "buying_journey"):
            strategy.pop(f, None)
        chunks = build_strategy_chunks(strategy, UID, ACTIVATION)
        kinds = {c[2]["kind"] for c in chunks}
        assert "user_persona_digest" not in kinds

    def test_extract_form_fields_covers_30_columns(self):
        data = make_strategy()
        fields = extract_form_fields(data)
        assert len(fields) == 30
        assert set(fields) == set(STRATEGY_FORM_FIELDS)

    def test_in_place_replacement_ids(self):
        first = build_strategy_chunks(make_strategy(), UID, ACTIVATION)
        mutated = make_strategy(business_objectives=["only-ads"])
        second = build_strategy_chunks(mutated, UID, ACTIVATION)
        assert [c[0] for c in first] == [c[0] for c in second]
        assert [c[1] for c in first] != [c[1] for c in second]


class TestIndexPipeline:
    def test_watermark_fresh_skips_embed(self):
        db = MagicMock()
        service = FakeSIF()
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=True) as fresh, \
             patch.object(idx.SIFIndexingWatermark, "upsert") as upsert:
            count = _run(index_active_strategy(
                db, UID, make_strategy(), activation_date=ACTIVATION, sif_service=service))
        assert count == 0
        fresh.assert_called_once()
        assert service.calls == []
        upsert.assert_not_called()

    def test_success_upserts_watermark_and_commits(self):
        db = MagicMock()
        service = FakeSIF()
        upsert_calls = []

        def _upsert(*args, **kwargs):
            upsert_calls.append((args, kwargs))
            return object()

        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False), \
             patch.object(idx.SIFIndexingWatermark, "upsert", side_effect=_upsert):
            count = _run(index_active_strategy(
                db, UID, make_strategy(), activation_date=ACTIVATION, sif_service=service))
        assert count == 8
        assert len(service.calls[-1]) == 8
        assert len(upsert_calls) == 1
        args, kwargs = upsert_calls[0]
        assert args[1] == UID
        assert args[2] == "user:user-42:strategy_active:current"
        assert kwargs.get("embedding_count") == 8
        db.commit.assert_called_once()

    def test_returns_same_ids_for_reactivation_after_change(self):
        db = MagicMock()
        service = FakeSIF()
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False):
            _run(index_active_strategy(db, UID, make_strategy(),
                                       activation_date=ACTIVATION, sif_service=service))
            _run(index_active_strategy(db, UID, make_strategy(business_objectives=["x"]),
                                       activation_date=ACTIVATION, sif_service=service))
        assert len(service.calls) == 2
        first_ids = [c[0] for c in service.calls[0]]
        second_ids = [c[0] for c in service.calls[1]]
        assert first_ids == second_ids

    def test_zero_embeds_do_not_stamp_watermark(self):
        db = MagicMock()
        service = FakeSIF()
        service.index_content = _zero_index
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False), \
             patch.object(idx.SIFIndexingWatermark, "upsert") as upsert:
            count = _run(index_active_strategy(
                db, UID, make_strategy(), activation_date=ACTIVATION, sif_service=service))
        assert count == 0
        upsert.assert_not_called()

    def test_async_task_retries_then_succeeds(self):
        db = MagicMock()
        service = FakeSIF(fail_before_success=1)
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False), \
             patch.object(idx.SIFIndexingWatermark, "upsert"):

            async def _wait():
                task = index_active_strategy_async(
                    db, UID, make_strategy(), activation_date=ACTIVATION,
                    sif_service=service, retries=3, base_delay=0.0)
                return await task

            count = asyncio.run(_wait())
        assert count == 8
        assert len(service.calls) == 1

    def test_retry_attempts_are_metered(self):
        db = MagicMock()
        service = FakeSIF(fail_before_success=2)
        events = []
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False), \
             patch.object(idx.SIFIndexingWatermark, "upsert"), \
             patch("services.intelligence.strategy_indexer._record_strategy_event",
                   side_effect=lambda *a, **k: events.append((a, k))):

            async def _wait():
                task = index_active_strategy_async(
                    db, UID, make_strategy(), activation_date=ACTIVATION,
                    sif_service=service, retries=3, base_delay=0.01)
                return await task

            count = asyncio.run(_wait())
        assert count == 8
        retries = [e for e in events if e[0][0] == "strategy_index_retry"]
        assert len(retries) == 2, "each failed attempt before the last must be metered"
        attempts = {kw["attempt"] for (_op,), kw in retries}
        assert attempts == {1, 2}
        delays = {round(kw["delay"], 4) for (_op,), kw in retries}
        assert delays == {0.01, 0.02}, "metered delay must match the backoff applied"
        for (_op,), kw in retries:
            assert kw["user_id"] == UID
            assert kw["outcome"] == "retry"
            assert kw["value"] == 1

    def test_async_task_exhausts_retries_returns_zero(self):
        db = MagicMock()
        service = FakeSIF(fail_before_success=999)
        with patch.object(idx.SIFIndexingWatermark, "is_fresh", return_value=False), \
             patch.object(idx.SIFIndexingWatermark, "upsert") as upsert:

            async def _wait():
                task = index_active_strategy_async(
                    db, UID, make_strategy(), activation_date=ACTIVATION,
                    sif_service=service, retries=2, base_delay=0.0)
                return await task

            count = asyncio.run(_wait())
        assert count == 0
        upsert.assert_not_called()

    def test_source_hash_contract(self):
        h1 = idx.compute_strategy_source_hash(UID, make_strategy(), ACTIVATION)
        h2 = idx.compute_strategy_source_hash(UID, make_strategy(), ACTIVATION)
        h3 = idx.compute_strategy_source_hash(UID, make_strategy(brand_voice="quiet"), ACTIVATION)
        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64


class TestMetadataAccessor:
    def test_roundtrip(self):
        service = FakeSIF()
        service.embeddings.docs["user:user-42:strategy_active:current:base_strategy"] = {
            "text": "...",
            "metadata": '{"kind": "base_strategy", "strategy_id": 7, '
                        '"activation_date": "2026-09-09T10:00:00"}',
        }
        meta = get_document_metadata(service, "user:user-42:strategy_active:current:base_strategy")
        assert meta["kind"] == "base_strategy"
        assert meta["strategy_id"] == 7

    def test_missing_doc_returns_empty(self):
        assert get_document_metadata(FakeSIF(), "nope") == {}

    def test_parse_error_returns_empty(self):
        service = FakeSIF()
        service.embeddings.docs["bad"] = {"metadata": "{not-json"}
        assert get_document_metadata(service, "bad") == {}


class TestFeatureFlag:
    def test_default_enabled(self):
        with patch.dict("os.environ", {}, clear=True):
            assert strategy_sif_indexing_enabled() is True

    @pytest.mark.parametrize("raw", ["0", "false", "no", "off", "False"])
    def test_disabled_variants(self, raw):
        with patch.dict("os.environ", {idx.SIF_STRATEGY_FEATURE_FLAG: raw}, clear=True):
            assert strategy_sif_indexing_enabled() is False

    def test_enabled_variant(self):
        with patch.dict("os.environ", {idx.SIF_STRATEGY_FEATURE_FLAG: "1"}, clear=True):
            assert strategy_sif_indexing_enabled() is True


async def _zero_index(items):
    return 0