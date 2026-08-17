"""Tests for canonical_profile persona enrichment (Phase E.2)."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


CORE_PERSONA = {
    "identity": {
        "persona_name": "The Plain-Spoken Operator",
        "archetype": "No-fluff operator for B2B SaaS founders",
        "core_belief": "Clarity beats cleverness.",
        "brand_voice_description": "Direct, plain-spoken, no jargon.",
    },
    "tonal_range": {
        "default_tone": "direct and plain-spoken",
        "permissible_tones": ["confident", "warm"],
        "forbidden_tones": ["salesy", "hype"],
        "emotional_range": "steady, occasional dry wit",
    },
    "linguistic_fingerprint": {
        "lexical_features": {
            "go_to_phrases": ["Here's the thing", "Bottom line"],
            "go_to_words": ["straightforward", "operator"],
            "avoid_words": ["synergy", "leverage"],
            "vocabulary_level": "plain, accessible",
        },
        "rhetorical_devices": {"storytelling_style": "short, concrete examples"},
    },
    "stylistic_constraints": {
        "punctuation": {"em_dash": "frequent", "exclamation_points": "rare"},
        "formatting": {"lists": "frequent"},
    },
    "evidence": {"archetype_basis": "site copy"},
    "what_was_missing": ["competitor data"],
    "confidence": 0.9,
}

PERSONA_DATA = {"core_persona": CORE_PERSONA, "quality_metrics": {"overall_score": 82}}


def _svc():
    from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService
    return OnboardingDataIntegrationService()


def _build_profile(**overrides):
    svc = _svc()
    args = dict(
        website_analysis={},
        research_preferences={},
        persona_data={},
        onboarding_session={},
        competitor_analysis=[],
        deep_competitor_analysis={},
        linkedin_profile=None,
    )
    args.update(overrides)
    return svc._build_canonical_profile(
        args["website_analysis"],
        args["research_preferences"],
        args["persona_data"],
        args["onboarding_session"],
        args["competitor_analysis"],
        args["deep_competitor_analysis"],
        args["linkedin_profile"],
    )


class TestPersonaSynthesis:
    def test_maps_full_persona(self):
        block = _svc()._build_persona_synthesis(PERSONA_DATA)
        assert block["identity"]["persona_name"] == "The Plain-Spoken Operator"
        assert block["tonal_range"]["default_tone"] == "direct and plain-spoken"
        assert block["linguistic_fingerprint"]["go_to_phrases"] == ["Here's the thing", "Bottom line"]
        assert block["linguistic_fingerprint"]["storytelling_style"] == "short, concrete examples"
        assert block["stylistic_constraints"]["punctuation"]["em_dash"] == "frequent"
        assert block["quality_metrics"]["overall_score"] == 82

    def test_excludes_audit_meta(self):
        block = _svc()._build_persona_synthesis(PERSONA_DATA)
        assert "evidence" not in block
        assert "what_was_missing" not in block
        assert "confidence" not in block

    def test_none_when_no_persona(self):
        assert _svc()._build_persona_synthesis(None) is None
        assert _svc()._build_persona_synthesis({}) is None
        assert _svc()._build_persona_synthesis({"core_persona": None}) is None

    def test_platform_personas_verbatim_mirror(self):
        persona_data = {
            "core_persona": CORE_PERSONA,
            "platform_personas": {
                "youtube": {"persona_name": "Fast Explainer", "tone_and_pacing": {"default_tone": "fast"}},
            },
        }
        block = _svc()._build_persona_synthesis(persona_data)
        assert block["platform_personas"] == persona_data["platform_personas"]


class TestBrandVoice:
    def test_maps_structured_summary(self):
        bv = _svc()._build_brand_voice(PERSONA_DATA)
        assert bv["default_tone"] == "direct and plain-spoken"
        assert bv["voice_description"] == "Direct, plain-spoken, no jargon."
        assert bv["go_to_phrases"] == ["Here's the thing", "Bottom line"]
        assert bv["avoid_words"] == ["synergy", "leverage"]
        assert bv["vocabulary_level"] == "plain, accessible"
        assert bv["emotional_range"] == "steady, occasional dry wit"

    def test_none_when_no_persona(self):
        assert _svc()._build_brand_voice(None) is None
        assert _svc()._build_brand_voice({}) is None


class TestCanonicalProfileEnrichment:
    def test_includes_persona_and_brand_voice(self):
        result = _build_profile(persona_data=PERSONA_DATA)
        assert result["persona"]["identity"]["persona_name"] == "The Plain-Spoken Operator"
        assert result["brand_voice"]["default_tone"] == "direct and plain-spoken"
        assert result["sources"]["persona"] == "persona_core"
        assert result["sources"]["brand_voice"] == "persona_core"

    def test_no_persona_leaves_blocks_absent(self):
        result = _build_profile(persona_data={})
        assert result["persona"] is None
        assert result["brand_voice"] is None
        assert result["sources"]["persona"] is None
        assert result["sources"]["brand_voice"] is None

    def test_target_audience_prefers_research(self):
        result = _build_profile(
            website_analysis={"target_audience": {"demographics": "website audience"}},
            research_preferences={"target_audience": {"demographics": "research audience"}},
        )
        assert result["target_audience"] == "research audience"
        assert result["sources"]["target_audience"] == "research_preferences"

    def test_industry_from_website(self):
        result = _build_profile(
            website_analysis={"target_audience": {"industry_focus": "SaaS"}},
        )
        assert result["industry"] == "SaaS"
        assert result["sources"]["industry"] == "website_analysis"

    def test_industry_fallback_research(self):
        result = _build_profile(
            research_preferences={"target_audience": {"industry_focus": "Healthcare"}},
        )
        assert result["industry"] == "Healthcare"
        assert result["sources"]["industry"] == "research_preferences"

    def test_legacy_writing_tone_unchanged(self):
        result = _build_profile(
            website_analysis={"writing_style": {"tone": "professional", "voice": "authoritative"}},
        )
        assert result["writing_tone"] == "professional"
        assert result["writing_voice"] == "authoritative"
