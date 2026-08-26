"""Tests for YouTube pitch expansion schema, duration, and assemble_full_script."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _n_words(count: int) -> str:
    return " ".join(["word"] * count)


def _beat(scene_number: int, seconds: float, **overrides) -> dict:
    beat = {
        "scene_number": scene_number,
        "section_title": f"Beat {scene_number}",
        "context": "What it is",
        "application": "How to do it",
        "frame": "Why it matters",
        "mini_hook_out": "Wait until you hear the next part.",
        "spoken_script": f"Spoken beat {scene_number}.",
        "visual": "On-screen demo",
        "estimated_duration_seconds": seconds,
    }
    beat.update(overrides)
    return beat


def _valid_expansion(*, duration_type: str = "shorts") -> dict:
    # shorts target 30s ±20% and 75 spoken words ±20% (60–90).
    return {
        "hook": {
            "context": "Packing for a weekend trip",
            "common_belief": "You need a big suitcase",
            "contrarian_turn": "Three items beat a packed bag",
            "proof": "I did this for 12 trips",
            "plan_statement": "I'll show the three-item rule",
            "spoken_script": _n_words(8),
        },
        "main_content_outline": [
            _beat(1, 10, spoken_script=_n_words(20)),
            _beat(2, 10, spoken_script=_n_words(20)),
            _beat(3, 10, spoken_script=_n_words(20)),
        ],
        "outro": _n_words(4),
        "call_to_action": _n_words(3),
        "key_message": "Pack less, enjoy more.",
        "seo_keywords": ["packing", "travel"],
    }


class TestSpokenWordBudget:
    def test_shorts_budget_is_seventy_five_words_and_three_beats(self):
        from services.youtube.planner_config import get_spoken_word_budget

        budget = get_spoken_word_budget("shorts")
        assert budget["max_spoken_words"] == round(30 * 150 / 60)
        assert budget["beat_count"] == 3

    def test_medium_and_long_beat_counts(self):
        from services.youtube.planner_config import get_main_beat_count

        assert get_main_beat_count("medium") == 4
        assert get_main_beat_count("long") == 5


class TestExpansionJsonStruct:
    def test_schema_has_no_full_script_or_echoed_fields(self):
        from services.youtube.planner_pitch_prompts import build_expansion_json_struct

        schema = build_expansion_json_struct()
        props = schema["properties"]
        assert "full_script" not in props
        for echoed in ("target_audience", "tone", "visual_style", "video_goal"):
            assert echoed not in props
        assert "hook" in props
        assert "main_content_outline" in props
        assert "spoken_script" in props["hook"]["properties"]

    def test_system_prompt_is_finalized_expansion_copy(self):
        from services.youtube.planner_pitch_prompts import EXPANSION_SYSTEM_PROMPT

        assert "YouTube Script Architect" in EXPANSION_SYSTEM_PROMPT
        assert "EXPECTATION < REALITY" in EXPANSION_SYSTEM_PROMPT
        assert "spoken_script" in EXPANSION_SYSTEM_PROMPT
        assert "mini_hook_out" in EXPANSION_SYSTEM_PROMPT
        assert "director notes" in EXPANSION_SYSTEM_PROMPT
        assert "150 words per minute" in EXPANSION_SYSTEM_PROMPT
        assert "Do NOT output echoed inputs" in EXPANSION_SYSTEM_PROMPT
        assert "Do NOT output a separate full_script" in EXPANSION_SYSTEM_PROMPT
        assert '"hook"' not in EXPANSION_SYSTEM_PROMPT
        assert "full_script" in EXPANSION_SYSTEM_PROMPT.lower()
        assert "Content language from the user message" in EXPANSION_SYSTEM_PROMPT

    def test_user_prompt_uses_hindi_label_for_hi(self):
        from services.youtube.planner_pitch_prompts import build_expansion_user_prompt

        prompt = build_expansion_user_prompt(
            user_idea="Budget travel",
            approved_pitch={
                "selected_title": "Stop Overpacking",
                "video_summary": "Pack three items.",
                "hook_concept": "Skip the suitcase.",
                "main_content_beats": ["Rule one"],
                "angle_used": "Contrarian",
            },
            duration_type="shorts",
            language="hi",
        )
        assert "**Content language:** Hindi" in prompt
        assert "Write every field in Hindi." in prompt
        assert "Spoken word budget" in prompt
        assert "75 words" in prompt
        assert "director notes" in prompt
        assert "exactly 3 outline beats" in prompt


class TestAssembleFullScript:
    def test_stitches_hook_beats_outro_cta(self):
        from services.youtube.planner_pitch_validate import assemble_full_script

        script = assemble_full_script(_valid_expansion())
        assert script.startswith("word ")
        assert "word" in script
        assert len(script.split()) == 75

    def test_rejects_empty_spoken_parts(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            assemble_full_script,
        )

        with pytest.raises(PitchValidationError, match="assemble"):
            assemble_full_script({"hook": {}, "main_content_outline": []})


class TestValidateExpansion:
    def test_accepts_duration_within_tolerance(self):
        from services.youtube.planner_pitch_validate import validate_expansion

        result = validate_expansion(_valid_expansion(), duration_type="shorts")
        assert len(result["main_content_outline"]) == 3
        assert result["key_message"] == "Pack less, enjoy more."

    def test_rejects_duration_outside_tolerance(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["main_content_outline"] = [
            _beat(1, 5, spoken_script=_n_words(20)),
            _beat(2, 5, spoken_script=_n_words(20)),
            _beat(3, 5, spoken_script=_n_words(20)),
        ]
        with pytest.raises(PitchValidationError, match="±20%"):
            validate_expansion(payload, duration_type="shorts")

    def test_rejects_shorts_script_over_ninety_words(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["hook"]["spoken_script"] = _n_words(40)
        with pytest.raises(PitchValidationError, match="words"):
            validate_expansion(payload, duration_type="shorts")

    def test_rejects_wrong_beat_count_for_shorts(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["main_content_outline"] = [
            _beat(1, 8, spoken_script=_n_words(18)),
            _beat(2, 8, spoken_script=_n_words(18)),
            _beat(3, 7, spoken_script=_n_words(18)),
            _beat(4, 7, spoken_script=_n_words(18)),
        ]
        with pytest.raises(PitchValidationError, match="exactly 3"):
            validate_expansion(payload, duration_type="shorts")

    def test_rejects_missing_hook_spoken_script(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["hook"]["spoken_script"] = "  "
        with pytest.raises(PitchValidationError, match="spoken_script"):
            validate_expansion(payload, duration_type="shorts")


class TestExpandPitchToScript:
    def test_success_assembles_full_script(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import expand_pitch_to_script

        svc = YouTubePlannerService()
        approved = {
            "selected_title": "Stop Planning Trips Like This",
            "video_summary": "Pack less.",
            "hook_concept": "Three-item rule",
            "main_content_beats": ["One", "Two", "Three"],
            "angle_used": "Contrarian",
        }
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            return_value=_valid_expansion(),
        ) as llm_mock:
            result = asyncio.run(
                expand_pitch_to_script(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    approved_pitch=approved,
                    user_id="user_expand",
                    enable_research=False,
                )
            )

        assert "word" in result["full_script"]
        assert result["generation"]["text_gateway"] == "llm_text_gen"
        llm_mock.assert_called_once()
        assert llm_mock.call_args.kwargs["flow_type"] == "youtube_script_expand"
        assert "max_tokens" not in llm_mock.call_args.kwargs

    def test_reuses_research_prompt_block_without_calling_exa(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import expand_pitch_to_script

        svc = YouTubePlannerService()
        block = (
            "Use only these facts. Do not invent statistics or numbers.\n\n"
            "1. Carry-on packing\n   Pack three items."
        )
        approved = {
            "selected_title": "Stop Planning Trips Like This",
            "video_summary": "Pack less.",
            "hook_concept": "Three-item rule",
            "main_content_beats": ["One", "Two", "Three"],
            "angle_used": "Contrarian",
            "research_prompt_block": block,
            "research_sources": [{"title": "Guide", "url": "https://example.com/a"}],
        }
        exa = AsyncMock(return_value=("", []))
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            return_value=_valid_expansion(),
        ), patch.object(svc, "_perform_exa_research", exa):
            result = asyncio.run(
                expand_pitch_to_script(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    approved_pitch=approved,
                    user_id="user_expand",
                    enable_research=True,
                )
            )

        exa.assert_not_called()
        assert block in result["generation"]["user_prompt"]
        assert "https://example.com/a" not in result["generation"]["user_prompt"]
        assert result["research_sources"][0]["url"] == "https://example.com/a"

    def test_missing_approved_pitch_returns_clear_error(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import expand_pitch_to_script

        svc = YouTubePlannerService()
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                expand_pitch_to_script(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    approved_pitch={},
                    enable_research=False,
                )
            )
        assert exc.value.status_code == 400
        assert "pitch" in str(exc.value.detail).lower()
