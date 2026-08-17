"""Tests for the blog persona-block resolution (Phase C.3)."""

from types import SimpleNamespace
from unittest.mock import patch

from services.blog_writer.content.medium_blog_generator import _resolve_persona_block


def _req(persona=None):
    return SimpleNamespace(persona=persona)


def _simple_persona():
    return SimpleNamespace(industry="SaaS", tone="professional", audience="marketers")


CURATED = "# Brand Voice\nYou are writing as The Operator."


def test_curated_preferred_over_req_persona():
    with patch(
        "services.persona.persona_resolver.resolve_persona_context",
        return_value=CURATED,
    ):
        block = _resolve_persona_block(_req(_simple_persona()), "u1")
    assert block == CURATED
    assert "PERSONA GUIDELINES" not in block


def test_falls_back_to_req_persona():
    with patch(
        "services.persona.persona_resolver.resolve_persona_context",
        return_value="",
    ):
        block = _resolve_persona_block(_req(_simple_persona()), "u1")
    assert "PERSONA GUIDELINES" in block
    assert "SaaS" in block


def test_no_persona_returns_empty():
    with patch(
        "services.persona.persona_resolver.resolve_persona_context",
        return_value="",
    ):
        block = _resolve_persona_block(_req(None), "u1")
    assert block == ""


def test_resolver_exception_falls_back():
    with patch(
        "services.persona.persona_resolver.resolve_persona_context",
        side_effect=RuntimeError("boom"),
    ):
        block = _resolve_persona_block(_req(_simple_persona()), "u1")
    assert "PERSONA GUIDELINES" in block
