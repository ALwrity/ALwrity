"""Tests for the LinkedIn post prompt builder persona_context injection (C.2)."""

from types import SimpleNamespace

from services.linkedin.content_generator_prompts.post_prompts import PostPromptBuilder


def _request(**overrides):
    base = {
        "topic": "AI in marketing",
        "industry": "SaaS",
        "tone": "professional",
        "target_audience": "marketers",
        "max_length": 1300,
        "key_points": [],
        "reference_context": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


CURATED = "# Brand Voice\nYou are writing as The Operator.\n\n# Tone\nDefault tone: confident."


def test_persona_context_preferred_over_legacy():
    legacy = {"core_persona": {"persona_name": "Legacy Persona", "tonal_range": {"default_tone": "x"}}}
    prompt = PostPromptBuilder.build_post_prompt(_request(), persona=legacy, persona_context=CURATED)
    assert "# Brand Voice" in prompt
    assert "The Operator" in prompt
    assert "PERSONA CONTEXT" not in prompt  # legacy block not used
    assert "Legacy Persona" not in prompt


def test_legacy_persona_used_when_no_context():
    legacy = {"core_persona": {"persona_name": "Legacy Persona", "tonal_range": {"default_tone": "x"}}}
    prompt = PostPromptBuilder.build_post_prompt(_request(), persona=legacy)
    assert "PERSONA CONTEXT" in prompt
    assert "Legacy Persona" in prompt


def test_no_persona_no_block():
    prompt = PostPromptBuilder.build_post_prompt(_request())
    assert "PERSONA CONTEXT" not in prompt
    assert "# Brand Voice" not in prompt
