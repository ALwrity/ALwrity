"""Tests for YouTube pitch schema, prompts, and generate_youtube_pitch."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _valid_pitch(**overrides) -> dict:
    pitch = {
        "selected_title": "Stop Planning Trips Like This",
        "video_summary": "A contrarian take on packing light. Two sentences of summary.",
        "hook_concept": "Everyone overpacks. The trick is a three-item rule.",
        "main_content_beats": ["Rule one", "Rule two", "Rule three"],
        "angle_used": "Contrarian",
    }
    pitch.update(overrides)
    return pitch


class TestPitchJsonStruct:
    def test_schema_has_generated_fields_only(self):
        from services.youtube.planner_pitch_prompts import build_pitch_json_struct

        schema = build_pitch_json_struct()
        props = schema["properties"]
        assert set(props) == {
            "selected_title",
            "video_summary",
            "hook_concept",
            "main_content_beats",
            "angle_used",
        }
        for echoed in ("target_audience", "tone", "visual_style", "video_goal"):
            assert echoed not in props

    def test_system_prompt_is_finalized_pitch_copy(self):
        from services.youtube.planner_pitch_prompts import PITCH_SYSTEM_PROMPT

        assert "YouTube Script Architect" in PITCH_SYSTEM_PROMPT
        assert "backend JSON engine" in PITCH_SYSTEM_PROMPT
        assert "Do NOT write a full script" in PITCH_SYSTEM_PROMPT
        assert "≤70 characters" in PITCH_SYSTEM_PROMPT
        assert "3–5 main beats" in PITCH_SYSTEM_PROMPT
        assert "never invent statistics" in PITCH_SYSTEM_PROMPT
        assert '"selected_title"' not in PITCH_SYSTEM_PROMPT
        assert '"video_summary"' not in PITCH_SYSTEM_PROMPT

    def test_user_prompt_injects_angle_without_json_example(self):
        from services.youtube.planner_pitch_prompts import build_pitch_user_prompt

        prompt = build_pitch_user_prompt(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="medium",
        )
        assert "Budget travel" in prompt
        assert "Contrarian" in prompt
        assert '"video_summary"' not in prompt
        assert "target_audience" not in prompt.lower() or "do not echo" in prompt.lower()

    def test_user_prompt_uses_hindi_label_for_hi(self):
        from services.youtube.planner_pitch_prompts import build_pitch_user_prompt

        prompt = build_pitch_user_prompt(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="medium",
            language="hi",
        )
        assert "**Content language:** Hindi" in prompt
        assert "Write every field in Hindi." in prompt
        assert "\nhi\n" not in prompt
        assert "**Content language:** English" not in prompt

    def test_user_prompt_uses_english_for_en_and_when_omitted(self):
        from services.youtube.planner_pitch_prompts import build_pitch_user_prompt

        english = build_pitch_user_prompt(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="medium",
            language="en",
        )
        omitted = build_pitch_user_prompt(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="medium",
        )
        assert "**Content language:** English" in english
        assert "Write every field in English." in english
        assert "**Content language:** English" in omitted
        assert "Hindi" not in english
        assert "Hindi" not in omitted

    def test_user_prompt_maps_locale_and_display_name_to_hindi(self):
        from services.youtube.planner_pitch_prompts import build_pitch_user_prompt

        for language in ("hi-IN", "Hindi", "  HI  "):
            prompt = build_pitch_user_prompt(
                user_idea="Budget travel",
                creative_angle="Contrarian",
                duration_type="medium",
                language=language,
            )
            assert "**Content language:** Hindi" in prompt
            assert "**Content language:** English" not in prompt

    def test_system_prompt_requires_user_message_content_language(self):
        from services.youtube.planner_pitch_prompts import PITCH_SYSTEM_PROMPT

        assert "Content language from the user message" in PITCH_SYSTEM_PROMPT


class TestPitchPreviewBuilder:
    def test_preview_uses_pitch_system_prompt_and_creative_angle(self):
        from services.youtube.planner_pitch_prompts import (
            PITCH_RESEARCH_PLACEHOLDER,
            PITCH_SYSTEM_PROMPT,
            build_pitch_preview_prompts,
        )

        preview = build_pitch_preview_prompts(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="medium",
            language="hi",
            enable_research=True,
        )
        assert preview["system_prompt"] == PITCH_SYSTEM_PROMPT
        assert "Create ONE short video pitch" in preview["user_prompt"]
        assert "Create a YouTube video plan" not in preview["user_prompt"]
        assert "**Creative angle (primary lens):** Contrarian" in preview["user_prompt"]
        assert "**Content language:** Hindi" in preview["user_prompt"]
        assert PITCH_RESEARCH_PLACEHOLDER in preview["user_prompt"]

    def test_preview_omits_placeholder_when_research_off(self):
        from services.youtube.planner_pitch_prompts import (
            PITCH_RESEARCH_PLACEHOLDER,
            build_pitch_preview_prompts,
        )

        preview = build_pitch_preview_prompts(
            user_idea="Budget travel",
            creative_angle="Contrarian",
            duration_type="shorts",
            enable_research=False,
        )
        assert PITCH_RESEARCH_PLACEHOLDER not in preview["user_prompt"]

    def test_preview_and_generate_share_non_research_prefix(self):
        from services.youtube.planner_pitch_prompts import (
            build_pitch_preview_prompts,
            build_pitch_user_prompt,
            pitch_user_prompt_non_research_prefix,
        )

        kwargs = {
            "user_idea": "Budget travel",
            "creative_angle": "Contrarian",
            "duration_type": "shorts",
            "video_type": "tutorial",
            "target_audience": "First timers",
            "language": "hi",
        }
        preview = build_pitch_preview_prompts(**kwargs, enable_research=True)
        generated = build_pitch_user_prompt(
            **kwargs,
            research_context="LIVE FACTS FROM EXA — ignore URLs in tests",
        )
        assert pitch_user_prompt_non_research_prefix(preview["user_prompt"]) == (
            pitch_user_prompt_non_research_prefix(generated)
        )
        assert "LIVE FACTS FROM EXA" in generated
        assert "LIVE FACTS FROM EXA" not in preview["user_prompt"]


class TestValidatePitch:
    def test_accepts_valid_pitch_and_strips_echoed_keys(self):
        from services.youtube.planner_pitch_validate import validate_pitch

        result = validate_pitch(
            _valid_pitch(target_audience="Travelers", tone="Fun"),
            creative_angle="Contrarian",
        )
        assert result["selected_title"] == "Stop Planning Trips Like This"
        assert "target_audience" not in result
        assert "tone" not in result
        assert result["main_content_beats"] == ["Rule one", "Rule two", "Rule three"]

    def test_rejects_too_few_beats(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_pitch,
        )

        with pytest.raises(PitchValidationError, match="3–5"):
            validate_pitch(
                _valid_pitch(main_content_beats=["Only one"]),
                creative_angle="Contrarian",
            )

    def test_fills_angle_used_from_requested_angle(self):
        from services.youtube.planner_pitch_validate import validate_pitch

        result = validate_pitch(
            _valid_pitch(angle_used=""),
            creative_angle="Storytelling",
        )
        assert result["angle_used"] == "Storytelling"


class TestGeneratePitch:
    def test_success_with_mocked_llm(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import generate_youtube_pitch

        svc = YouTubePlannerService()
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            return_value=_valid_pitch(),
        ) as llm_mock:
            result = asyncio.run(
                generate_youtube_pitch(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    creative_angle="Contrarian",
                    user_id="user_pitch",
                    enable_research=False,
                )
            )

        assert result["selected_title"]
        assert result["generation"]["text_gateway"] == "llm_text_gen"
        assert "Contrarian" in result["generation"]["user_prompt"]
        assert "**Content language:** English" in result["generation"]["user_prompt"]
        llm_mock.assert_called_once()
        assert llm_mock.call_args.kwargs["flow_type"] == "youtube_pitch"
        assert "max_tokens" not in llm_mock.call_args.kwargs

    def test_accepts_wavespeed_error_wrapper_with_valid_raw_json(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import generate_youtube_pitch

        svc = YouTubePlannerService()
        wrapper = {
            "error": "Failed to parse JSON response",
            "raw_response": json.dumps(_valid_pitch()),
        }
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            return_value=wrapper,
        ):
            result = asyncio.run(
                generate_youtube_pitch(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    creative_angle="Contrarian",
                    user_id="user_pitch",
                    enable_research=False,
                )
            )

        assert result["selected_title"] == "Stop Planning Trips Like This"
        assert result["main_content_beats"] == ["Rule one", "Rule two", "Rule three"]

    def test_retries_once_then_succeeds(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import generate_youtube_pitch

        svc = YouTubePlannerService()
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            side_effect=[
                _valid_pitch(main_content_beats=["one"]),
                _valid_pitch(),
            ],
        ) as llm_mock:
            result = asyncio.run(
                generate_youtube_pitch(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    creative_angle="Contrarian",
                    user_id="user_pitch",
                    enable_research=False,
                )
            )

        assert result["main_content_beats"] == ["Rule one", "Rule two", "Rule three"]
        assert llm_mock.call_count == 2

    def test_missing_angle_returns_clear_error(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import generate_youtube_pitch

        svc = YouTubePlannerService()
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                generate_youtube_pitch(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    creative_angle="  ",
                    enable_research=False,
                )
            )
        assert exc.value.status_code == 400
        assert "angle" in str(exc.value.detail).lower()


class TestContentLanguageLabels:
    def test_hi_maps_to_hindi(self):
        from services.youtube.planner_config import resolve_content_language

        resolved = resolve_content_language("hi")
        assert resolved.code == "hi"
        assert resolved.label == "Hindi"
        assert resolved.used_fallback is False
        assert resolve_content_language("HI").code == "hi"

    def test_locale_and_display_name_map_to_code(self):
        from services.youtube.planner_config import resolve_content_language

        assert resolve_content_language("hi-IN").code == "hi"
        assert resolve_content_language("Hindi").code == "hi"
        assert resolve_content_language("hindi").label == "Hindi"

    def test_empty_and_unknown_map_to_english(self):
        from services.youtube.planner_config import (
            resolve_content_language,
            resolve_content_language_label,
        )

        omitted = resolve_content_language(None)
        unknown = resolve_content_language("xx")
        assert omitted.code == "en"
        assert omitted.label == "English"
        assert omitted.used_fallback is True
        assert unknown.requested == "xx"
        assert unknown.used_fallback is True
        assert resolve_content_language_label("") == "English"
        assert resolve_content_language_label("xx") == "English"
