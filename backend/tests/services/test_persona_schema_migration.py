"""Tests for the legacy persona-schema reads fixed post-E.4 (finding #2).

The SSOT ``PersonaData.core_persona`` uses ``identity`` / ``tonal_range`` /
``linguistic_fingerprint`` / ``stylistic_constraints``. A few consumers still
read the legacy ``core_persona.writing_style`` / ``.target_audience`` /
``.brand_voice`` / ``.tone`` field names and silently fell back to defaults.
These tests pin the migrated behavior.
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _summary_service():
    from api.onboarding_utils.onboarding_summary_service import OnboardingSummaryService

    return object.__new__(OnboardingSummaryService)


class TestPersonalizationSettingsMigration:
    def test_reads_new_schema_brand_voice_and_tone(self):
        svc = _summary_service()
        persona_data = {
            "core_persona": {
                "identity": {"brand_voice_description": "Clear, authoritative"},
                "tonal_range": {"default_tone": "professional_friendly"},
            },
            "platform_personas": {},
        }
        prefs = {
            "writing_style": "conversational",
            "target_audience": "SMB founders",
            "content_focus": "educational",
        }

        result = svc._get_personalization_settings(prefs, persona_data)

        assert result["brand_voice"] == "Clear, authoritative"
        assert result["tone"] == "professional_friendly"
        assert result["writing_style"] == "conversational"
        assert result["target_audience"] == "SMB founders"
        assert result["content_focus"] == "educational"

    def test_writing_style_and_audience_come_from_research_preferences(self):
        svc = _summary_service()
        persona_data = {
            "core_persona": {
                "identity": {"brand_voice_description": "Expert authority"},
                "tonal_range": {"default_tone": "authoritative"},
            },
        }
        prefs = {"writing_style": "journalistic", "target_audience": "engineers"}

        result = svc._get_personalization_settings(prefs, persona_data)

        assert result["writing_style"] == "journalistic"
        assert result["target_audience"] == "engineers"
        assert result["brand_voice"] == "Expert authority"
        assert result["tone"] == "authoritative"

    def test_no_persona_returns_research_preferences_only(self):
        svc = _summary_service()
        prefs = {"writing_style": "concise", "target_audience": "startups", "content_focus": "tutorial"}

        result = svc._get_personalization_settings(prefs, None)

        assert result["writing_style"] == "concise"
        assert result["target_audience"] == "startups"
        assert result["content_focus"] == "tutorial"
        assert "brand_voice" not in result
        assert "tone" not in result

    def test_empty_voice_and_tone_are_omitted(self):
        svc = _summary_service()
        persona_data = {"core_persona": {"identity": {}, "tonal_range": {}}}
        prefs = {"writing_style": "formal"}

        result = svc._get_personalization_settings(prefs, persona_data)

        assert result["writing_style"] == "formal"
        assert "brand_voice" not in result
        assert "tone" not in result


class TestPlatformConsistencyMigration:
    def _improver(self):
        from services.persona.persona_quality_improver import PersonaQualityImprover

        return object.__new__(PersonaQualityImprover)

    def test_neutral_when_no_comparable_tone(self):
        improver = self._improver()
        core = {"tonal_range": {"default_tone": "direct"}}
        platforms = {"linkedin": {"content_format_rules": {}}}

        assert improver._assess_platform_consistency(core, platforms) == 75

    def test_tone_match_scores_high(self):
        improver = self._improver()
        core = {"tonal_range": {"default_tone": "direct"}}
        platforms = {"linkedin": {"tonal_range": {"default_tone": "direct"}}}

        assert improver._assess_platform_consistency(core, platforms) == 100
