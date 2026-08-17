"""Tests for the persona context resolver (Phase C.1)."""

from unittest.mock import patch

from services.persona.persona_resolver import resolve_persona_context


SAMPLE_PERSONA = {
    "core_persona": {
        "identity": {
            "persona_name": "The Plain-Spoken Operator",
            "archetype": "No-fluff operator for B2B founders",
            "core_belief": "Tools should be free and honest",
            "brand_voice_description": "Direct, plain, no buzzwords",
        },
        "tonal_range": {"default_tone": "confident", "forbidden_tones": ["corporate"]},
        "linguistic_fingerprint": {
            "lexical_features": {"go_to_phrases": ["ship it"]},
        },
    },
    "platform_personas": {
        "linkedin": {"persona_name": "Thought Leader", "default_tone": "professional"},
    },
}


def test_resolves_from_db_with_platform():
    with patch(
        "services.persona_data_service.PersonaDataService.get_user_persona_data",
        return_value=SAMPLE_PERSONA,
    ):
        out = resolve_persona_context("u1", platform="linkedin")
    assert "The Plain-Spoken Operator" in out
    assert "# LinkedIn Guidance" in out
    assert "Thought Leader" in out


def test_returns_empty_when_no_persona():
    with patch(
        "services.persona_data_service.PersonaDataService.get_user_persona_data",
        return_value=None,
    ), patch(
        "services.intelligence.agent_flat_context.AgentFlatContextStore.load_step4_persona_data",
        return_value=None,
    ):
        out = resolve_persona_context("u1")
    assert out == ""


def test_falls_back_to_flat_context():
    with patch(
        "services.persona_data_service.PersonaDataService.get_user_persona_data",
        side_effect=RuntimeError("db down"),
    ), patch(
        "services.intelligence.agent_flat_context.AgentFlatContextStore.load_step4_persona_data",
        return_value=SAMPLE_PERSONA,
    ):
        out = resolve_persona_context("u1")
    assert "The Plain-Spoken Operator" in out


def test_no_platform_omits_guidance():
    with patch(
        "services.persona_data_service.PersonaDataService.get_user_persona_data",
        return_value=SAMPLE_PERSONA,
    ):
        out = resolve_persona_context("u1")
    assert "Guidance" not in out
    assert "# Brand Voice" in out
