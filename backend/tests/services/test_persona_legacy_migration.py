"""Tests for the E.4 legacy persona migration (Phase 1 — consumers re-pointed to PersonaData)."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


RAW_PERSONA = {
    "platform": "linkedin",
    "platform_persona": {"content_format_rules": {"character_limit": 3000}},
    "core_persona": {
        "identity": {
            "persona_name": "The Operator",
            "archetype": "Educator",
            "core_belief": "Clarity first",
        },
        "linguistic_fingerprint": {
            "sentence_metrics": {"average_sentence_length_words": 12},
            "lexical_features": {"go_to_words": ["straight"], "avoid_words": ["synergy"]},
            "rhetorical_devices": {"metaphors": "minimal"},
        },
        "tonal_range": {"default_tone": "direct"},
        "stylistic_constraints": {},
    },
}


class TestReplicationEngineMigration:
    def test_system_prompt_reads_nested_identity_and_tone(self):
        from services.persona_replication_engine import PersonaReplicationEngine

        engine = PersonaReplicationEngine()
        prompt = engine._build_hardened_system_prompt(RAW_PERSONA, "linkedin")

        assert "The Operator" in prompt
        assert "Educator" in prompt
        assert "Clarity first" in prompt
        assert "direct" in prompt  # tonal_range now read (was always defaulting to "professional")

    def test_validate_reads_platform_persona(self):
        from services.persona_replication_engine import PersonaReplicationEngine

        engine = PersonaReplicationEngine()
        result = engine._validate_content_fidelity("Some concise content here.", RAW_PERSONA, "linkedin")
        assert "fidelity_score" in result
        assert "platform_score" in result


class TestContentGeneratorMigration:
    def test_cached_persona_data_returns_none(self):
        from services.linkedin.content_generator import ContentGenerator

        gen = object.__new__(ContentGenerator)
        assert gen._get_cached_persona_data("u1", "linkedin") is None


class TestFacebookMigration:
    def test_prompt_reads_nested_identity(self):
        from api.facebook_writer.services.base_service import FacebookWriterBaseService

        svc = FacebookWriterBaseService()
        prompt = svc._build_persona_enhanced_prompt("base prompt", RAW_PERSONA)

        assert "The Operator" in prompt
        assert "Educator" in prompt
        assert "Clarity first" in prompt


class TestArticlePromptBuilderMigration:
    def test_article_prompt_prefers_persona_context(self):
        from services.linkedin.content_generator_prompts.article_prompts import ArticlePromptBuilder

        req = MagicMock()
        req.industry = "SaaS"
        req.topic = "Topic"
        req.tone = "professional"
        req.target_audience = None
        req.word_count = 500
        req.key_sections = None
        req.outline_override = None

        prompt = ArticlePromptBuilder.build_article_prompt(
            req, persona={"core_persona": {}}, persona_context="BRAND VOICE BLOCK"
        )
        assert "BRAND VOICE BLOCK" in prompt


class TestCommentAssistantMigration:
    def test_load_persona_passes_string_user_id(self):
        from services import linkedin_comment_assistant_draft_service as mod

        with patch.object(
            mod.PersonaDataService, "get_platform_persona", return_value={"platform": "linkedin"}
        ) as gp:
            result = mod._load_persona("user_123")

        gp.assert_called_once_with("user_123", "linkedin")
        assert result == {"platform": "linkedin"}

    def test_resolve_industry_reads_canonical_profile(self):
        from services.linkedin_comment_assistant_draft_service import _resolve_industry

        db = MagicMock()
        with patch("services.database.get_session_for_user", return_value=db), \
             patch("api.content_planning.services.content_strategy.onboarding.OnboardingDataIntegrationService") as integ_cls:
            integ_cls.return_value.get_integrated_data_sync.return_value = {
                "canonical_profile": {"industry": "B2B SaaS"}
            }
            assert _resolve_industry("u1") == "B2B SaaS"

    def test_resolve_industry_defaults_to_general(self):
        from services.linkedin_comment_assistant_draft_service import _resolve_industry

        db = MagicMock()
        with patch("services.database.get_session_for_user", return_value=db), \
             patch("api.content_planning.services.content_strategy.onboarding.OnboardingDataIntegrationService") as integ_cls:
            integ_cls.return_value.get_integrated_data_sync.return_value = {
                "canonical_profile": {}
            }
            assert _resolve_industry("u1") == "General"
