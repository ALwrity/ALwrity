"""Tests for YouTube Plan idea enhance parse and prompts."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _three_ideas() -> dict:
    return {
        "enhanced_ideas": [
            "Tokyo weekend packing without a suitcase.",
            "A 48-hour Tokyo packing checklist for first-timers.",
            "What to leave at home for a Tokyo weekend.",
        ],
        "rationales": ["Angle A", "Angle B", "Angle C"],
    }


class TestParseEnhancedIdeaPayload:
    def test_accepts_exactly_three_string_ideas(self):
        from services.youtube.planner_idea_enhance import parse_enhanced_idea_payload

        parsed = parse_enhanced_idea_payload(_three_ideas())
        assert parsed["enhanced_ideas"] == _three_ideas()["enhanced_ideas"]
        assert parsed["rationales"] == ["Angle A", "Angle B", "Angle C"]

    def test_normalizes_object_ideas_to_strings(self):
        from services.youtube.planner_idea_enhance import parse_enhanced_idea_payload

        parsed = parse_enhanced_idea_payload(
            {
                "enhanced_ideas": [
                    {"idea": "One"},
                    {"text": "Two"},
                    "Three",
                ],
                "rationales": ["a", "b", "c"],
            }
        )
        assert parsed["enhanced_ideas"] == ["One", "Two", "Three"]

    def test_fails_when_not_exactly_three_ideas(self):
        from services.youtube.planner_idea_enhance import (
            IdeaEnhanceError,
            parse_enhanced_idea_payload,
        )

        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload(
                {
                    "enhanced_ideas": ["One", "Two"],
                    "rationales": ["a", "b"],
                }
            )
        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload(
                {
                    "enhanced_ideas": ["One", "Two", "Three", "Four"],
                    "rationales": ["a", "b", "c", "d"],
                }
            )

    def test_fails_on_empty_or_malformed_payload(self):
        from services.youtube.planner_idea_enhance import (
            IdeaEnhanceError,
            parse_enhanced_idea_payload,
        )

        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload({})
        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload(
                {"enhanced_ideas": ["", "Two", "Three"], "rationales": ["a", "b", "c"]}
            )
        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload("not json")

    def test_does_not_invent_copies_of_the_original_idea(self):
        from services.youtube.planner_idea_enhance import (
            IdeaEnhanceError,
            parse_enhanced_idea_payload,
        )

        with pytest.raises(IdeaEnhanceError):
            parse_enhanced_idea_payload(
                {
                    "enhanced_ideas": ["Budget travel packing"],
                    "original_idea": "Budget travel packing",
                }
            )


class TestIdeaEnhancePrompts:
    def test_user_prompt_includes_language_and_duration(self):
        from services.youtube.planner_idea_enhance_prompts import (
            build_idea_enhance_user_prompt,
        )

        prompt = build_idea_enhance_user_prompt(
            user_idea="Budget travel packing",
            language_label="Hindi",
            duration_description="YouTube Shorts (15-60 seconds)",
            channel_bible_context="Niche: travel",
        )
        assert "Hindi" in prompt
        assert "YouTube Shorts" in prompt
        assert "Budget travel packing" in prompt
        assert "Niche: travel" in prompt
        assert "exactly 3" in prompt.lower() or "exactly three" in prompt.lower()


class TestEnhanceYoutubePlanIdea:
    def test_calls_llm_text_gen_with_enhance_flow_type(self):
        from services.youtube.planner_idea_enhance import enhance_youtube_plan_idea

        with patch(
            "services.youtube.planner_idea_enhance.llm_text_gen",
            return_value=_three_ideas(),
        ) as mock_llm:
            result = enhance_youtube_plan_idea(
                user_idea="Budget travel packing",
                duration_type="shorts",
                language="hi",
                user_id="user-1",
            )
        assert mock_llm.call_args.kwargs["flow_type"] == "youtube_plan_idea_enhance"
        assert result["enhanced_ideas"] == _three_ideas()["enhanced_ideas"]

    def test_llm_failure_does_not_invent_fallback_ideas(self):
        from services.youtube.planner_idea_enhance import (
            IdeaEnhanceError,
            enhance_youtube_plan_idea,
        )

        with patch(
            "services.youtube.planner_idea_enhance.llm_text_gen",
            side_effect=RuntimeError("provider down"),
        ):
            with pytest.raises(IdeaEnhanceError, match="Could not enhance"):
                enhance_youtube_plan_idea(user_idea="Budget travel packing")
