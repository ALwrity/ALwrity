"""
Unit tests for assistive writing assistant citation stripping and prompts.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from services.writing_assistant import (
    strip_assistive_citation_markers,
    WritingAssistantService,
)


class TestStripAssistiveCitationMarkers:
    """Server-side cleanup of LLM suggestions before they reach the editor."""

    def test_strips_url_citation_hints(self):
        raw = (
            "Shares doubled ((Arclen, 2023)[https://arclen.io/blog/headlines]) "
            "last quarter."
        )
        cleaned = strip_assistive_citation_markers(raw)
        assert "https://" not in cleaned
        assert "((" not in cleaned
        assert "Shares doubled last quarter." == cleaned

    def test_strips_source_number_markers(self):
        raw = "Great insight [Source 1] for leaders."
        assert strip_assistive_citation_markers(raw) == "Great insight for leaders."

    def test_strips_parenthesized_source_markers(self):
        raw = "Tip ([Source 2]) here."
        assert strip_assistive_citation_markers(raw) == "Tip here."

    def test_strips_mixed_markers_and_collapses_whitespace(self):
        raw = "Rise  ((Author)[https://example.com/x])  [Source 1]  today."
        cleaned = strip_assistive_citation_markers(raw)
        assert cleaned == "Rise today."
        assert "[Source" not in cleaned
        assert "https://" not in cleaned

    def test_empty_input_returns_empty_string(self):
        assert strip_assistive_citation_markers("") == ""


class TestWritingAssistantGenerateContinuation:
    """_generate_continuation applies stripping and prompt constraints."""

    @pytest.mark.anyio
    async def test_generate_continuation_strips_citations_from_llm_output(self):
        service = WritingAssistantService()
        dirty = (
            "More reach ((Arclen)[https://arclen.io/x]) [Source 1] this week."
        )

        with patch(
            "services.writing_assistant.llm_text_gen",
            return_value={"text": dirty},
        ):
            text, confidence = await service._generate_continuation(
                "User stub about LinkedIn growth.",
                sources=[{"title": "Arclen", "url": "https://arclen.io/x", "score": 0.9}],
                user_id="user-1",
            )

        assert text == "More reach this week."
        assert "[Source" not in text
        assert "https://" not in text
        assert 0.0 <= confidence <= 1.0

    @pytest.mark.anyio
    async def test_generate_continuation_prompt_has_no_citation_instruction(self):
        service = WritingAssistantService()
        captured: dict = {}

        def fake_llm(**kwargs):
            captured.update(kwargs)
            return {"text": "Clean continuation sentence."}

        with patch("services.writing_assistant.llm_text_gen", side_effect=fake_llm):
            await service._generate_continuation(
                "Long enough user context for assistive writing.",
                sources=[],
                user_id=None,
            )

        system_prompt = captured.get("system_prompt", "")
        user_prompt = captured.get("prompt", "")
        assert "no citation markers" in system_prompt.lower()
        assert "[Source N]" in system_prompt
        assert "no citations or urls" in user_prompt.lower()
