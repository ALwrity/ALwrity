"""Tests for the curated persona context extractor (Phase B)."""

from services.persona.persona_context import get_persona_context_for_generation


FULL_CORE = {
    "identity": {
        "persona_name": "The Plain-Spoken Operator",
        "archetype": "No-fluff operator for B2B founders",
        "core_belief": "Tools should be free and honest",
        "brand_voice_description": "Direct, plain, no buzzwords",
    },
    "tonal_range": {
        "default_tone": "confident",
        "permissible_tones": ["direct", "wry"],
        "forbidden_tones": ["corporate"],
    },
    "linguistic_fingerprint": {
        "lexical_features": {
            "go_to_phrases": ["ship it", "no fluff"],
            "go_to_words": ["build", "ship"],
            "avoid_words": ["synergy", "leverage"],
            "vocabulary_level": "plain",
        },
        "sentence_metrics": {
            "average_sentence_length_words": 14,
            "preferred_sentence_type": "declarative",
            "active_to_passive_ratio": "mostly active",
            "complexity_level": "simple",
        },
        "rhetorical_devices": {"storytelling_style": "first-principles"},
    },
    "stylistic_constraints": {
        "punctuation": {"em_dash": "frequent", "ellipses": "never", "exclamation_points": "rare"},
        "formatting": {"markdown": "headers", "lists": "bulleted", "paragraphs": "short"},
    },
    "evidence": {"tone_basis": "website copy"},
    "confidence": 0.8,
}

PLATFORMS = {
    "linkedin": {
        "persona_name": "Thought Leader",
        "archetype": "B2B operator",
        "core_belief": "Share what works",
        "default_tone": "professional",
    },
    "facebook": {
        "persona_name": "Community Builder",
        "facebook_audience_targeting": {
            "demographic_targeting": ["marketers aged 25-45"],
            "interest_targeting": ["SaaS tools"],
        },
    },
}


class TestGetPersonaContext:
    def test_full_persona_with_platform(self):
        out = get_persona_context_for_generation(
            {"core_persona": FULL_CORE, "platform_personas": PLATFORMS},
            platform="linkedin",
        )
        assert "# Brand Voice" in out
        assert "The Plain-Spoken Operator" in out
        assert "B2B founders" in out
        assert "# Tone" in out and "confident" in out
        assert "# Language" in out and "ship it" in out
        assert "# Style" in out and "declarative" in out and "em_dash=frequent" in out
        assert "# LinkedIn Guidance" in out and "Thought Leader" in out

    def test_no_platform_omits_platform_section(self):
        out = get_persona_context_for_generation(
            {"core_persona": FULL_CORE, "platform_personas": PLATFORMS}
        )
        assert "Guidance" not in out
        assert "# Brand Voice" in out

    def test_excludes_meta_fields(self):
        out = get_persona_context_for_generation(
            {"core_persona": FULL_CORE, "platform_personas": PLATFORMS}, platform="linkedin"
        )
        assert "evidence" not in out
        assert "tone_basis" not in out
        assert "confidence" not in out
        assert "what_was_missing" not in out

    def test_audience_param_surfaces(self):
        out = get_persona_context_for_generation(
            {"core_persona": FULL_CORE}, platform=None, audience="B2B founders and indie hackers"
        )
        assert "# Audience" in out
        assert "B2B founders and indie hackers" in out

    def test_facebook_audience_targeting_surfaces(self):
        out = get_persona_context_for_generation(
            {"core_persona": FULL_CORE, "platform_personas": PLATFORMS}, platform="facebook"
        )
        assert "# Facebook Guidance" in out
        assert "# Audience" in out
        assert "marketers aged 25-45" in out

    def test_empty_persona_returns_empty(self):
        assert get_persona_context_for_generation({}) == ""
        assert get_persona_context_for_generation({"core_persona": None}) == ""
        assert get_persona_context_for_generation(None) == ""

    def test_missing_sections_omitted(self):
        minimal = {"core_persona": {"identity": {"persona_name": "X"}}}
        out = get_persona_context_for_generation(minimal)
        assert "# Brand Voice" in out
        assert "# Tone" not in out
        assert "# Language" not in out
        assert "# Style" not in out
