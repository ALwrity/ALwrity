"""Tests for the SIF persona sync (Phase A).

Covers the pure ``_build_persona_index_items`` builder and the mocked
``sync_persona_data_to_sif`` method.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock

from services.intelligence.sif._sync import (
    _build_persona_index_items,
    SIFSyncMixin,
)


SAMPLE_CORE = {
    "identity": {
        "persona_name": "The Plain-Spoken Operator",
        "archetype": "No-fluff operator for B2B founders",
        "core_belief": "Tools should be free and honest",
        "brand_voice_description": "Direct, plain, no buzzwords",
    },
    "linguistic_fingerprint": {
        "lexical_features": {
            "go_to_phrases": ["ship it", "no fluff"],
            "go_to_words": ["build", "ship"],
            "avoid_words": ["synergy", "leverage"],
        },
        "sentence_metrics": {
            "average_sentence_length_words": 14,
            "preferred_sentence_type": "declarative",
            "complexity_level": "simple",
        },
        "rhetorical_devices": {"storytelling_style": "first-principles"},
    },
    "tonal_range": {
        "default_tone": "confident",
        "permissible_tones": ["direct", "wry"],
        "forbidden_tones": ["corporate"],
    },
}

SAMPLE_PLATFORMS = {
    "linkedin": {
        "persona_name": "Thought Leader",
        "archetype": "B2B operator",
        "core_belief": "Share what works",
        "default_tone": "professional",
    },
    "instagram": {
        "platform_type": "instagram",
        "default_tone": "casual",
    },
}

SAMPLE_QUALITY = {"overall_score": 88, "core_completeness": 90}


class TestBuildPersonaIndexItems:
    def test_core_persona_item_is_natural_language(self):
        items = _build_persona_index_items({"core_persona": SAMPLE_CORE}, "u1")
        core_items = [i for i in items if i[2].get("persona_kind") == "core"]
        assert len(core_items) == 1
        _id, text, meta = core_items[0]
        assert meta["type"] == "persona"
        assert "The Plain-Spoken Operator" in text
        assert "B2B founders" in text
        assert "confident" in text
        assert "ship it" in text
        assert "Brand persona" in text

    def test_platform_items_are_per_platform(self):
        items = _build_persona_index_items({"platform_personas": SAMPLE_PLATFORMS}, "u1")
        plat = [i for i in items if i[2].get("persona_kind") == "platform"]
        assert len(plat) == 2
        by_platform = {m["platform"]: (tid, t, m) for tid, t, m in plat}
        assert set(by_platform) == {"linkedin", "instagram"}
        assert "linkedin" in by_platform["linkedin"][1]
        assert "Thought Leader" in by_platform["linkedin"][1]

    def test_quality_metrics_item(self):
        items = _build_persona_index_items({"quality_metrics": SAMPLE_QUALITY}, "u1")
        q = [i for i in items if i[2].get("persona_kind") == "quality"]
        assert len(q) == 1
        assert "88" in q[0][1]

    def test_empty_returns_empty_list(self):
        assert _build_persona_index_items({}, "u1") == []
        assert _build_persona_index_items({"core_persona": None}, "u1") == []

    def test_skips_malformed_platform(self):
        items = _build_persona_index_items(
            {"platform_personas": {"linkedin": "not-a-dict", "blog": {"name": "Blog"}}}, "u1"
        )
        plat = [i for i in items if i[2].get("persona_kind") == "platform"]
        assert len(plat) == 1
        assert plat[0][2]["platform"] == "blog"


class TestSyncPersonaDataToSif:
    def test_indexes_persona_items(self):
        fake_persona = MagicMock()
        fake_persona.to_dict.return_value = {
            "core_persona": SAMPLE_CORE,
            "platform_personas": SAMPLE_PLATFORMS,
            "quality_metrics": SAMPLE_QUALITY,
        }

        fake_scalars = MagicMock()
        fake_scalars.first.return_value = fake_persona
        fake_result = MagicMock()
        fake_result.scalars.return_value = fake_scalars

        fake_db = MagicMock()
        fake_db.execute.return_value = fake_result

        svc = SIFSyncMixin()
        svc.user_id = "user_test"
        svc.intelligence_service = MagicMock()
        svc.intelligence_service.index_content = AsyncMock()

        asyncio.run(svc.sync_persona_data_to_sif(db=fake_db))

        svc.intelligence_service.index_content.assert_called_once()
        items = svc.intelligence_service.index_content.call_args[0][0]
        assert any(m.get("type") == "persona" for _, _, m in items)
        assert any(m.get("persona_kind") == "core" for _, _, m in items)
        assert any(m.get("persona_kind") == "platform" for _, _, m in items)

    def test_no_persona_does_not_index(self):
        fake_scalars = MagicMock()
        fake_scalars.first.return_value = None
        fake_result = MagicMock()
        fake_result.scalars.return_value = fake_scalars

        fake_db = MagicMock()
        fake_db.execute.return_value = fake_result

        svc = SIFSyncMixin()
        svc.user_id = "user_test"
        svc.intelligence_service = MagicMock()
        svc.intelligence_service.index_content = AsyncMock()

        asyncio.run(svc.sync_persona_data_to_sif(db=fake_db))

        svc.intelligence_service.index_content.assert_not_called()
