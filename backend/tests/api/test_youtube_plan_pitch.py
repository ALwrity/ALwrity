"""Tests for YouTube pitch/expand API handlers (Issue #434 Phase 3)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _user(uid: str = "user_pitch_test") -> dict:
    return {"id": uid, "email": "test@example.com"}


def _personalization():
    return (None, None, None, None, "", None)


class TestPitchRequestSchema:
    def test_requires_creative_angle(self):
        from api.youtube.router import PitchRequest

        with pytest.raises(ValidationError):
            PitchRequest(user_idea="Budget travel", duration_type="shorts")

    def test_accepts_angle_and_idea(self):
        from api.youtube.router import PitchRequest

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
        )
        assert request.creative_angle == "Contrarian"

    def test_accepts_optional_language_code(self):
        from api.youtube.router import PitchRequest

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
            language="hi",
        )
        assert request.language == "hi"

    def test_strips_blank_language_to_none(self):
        from api.youtube.router import PitchRequest

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
            language="   ",
        )
        assert request.language is None

    def test_strips_language_whitespace(self):
        from api.youtube.router import PitchRequest

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
            language="  hi  ",
        )
        assert request.language == "hi"


class TestCreateVideoPitch:
    def test_success_returns_pitch(self):
        from api.youtube.router import PitchRequest, create_video_pitch

        request = PitchRequest(
            user_idea="How to travel cheap",
            duration_type="shorts",
            creative_angle="Contrarian",
        )
        pitch = {
            "selected_title": "Stop Overpacking",
            "video_summary": "Pack three items.",
            "hook_concept": "You do not need a suitcase.",
            "main_content_beats": ["Rule one", "Rule two", "Rule three"],
            "angle_used": "Contrarian",
            "generation": {
                "text_gateway": "llm_text_gen",
                "json_schema_applied": True,
            },
        }

        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            new_callable=AsyncMock,
            return_value=pitch,
        ):
            result = asyncio.run(create_video_pitch(request=request, current_user=_user()))

        assert result.success is True
        assert result.pitch == pitch
        assert result.pitch["generation"]["json_schema_applied"] is True

    def test_forwards_language_to_generate_youtube_pitch(self):
        from api.youtube.router import PitchRequest, create_video_pitch

        request = PitchRequest(
            user_idea="How to travel cheap",
            duration_type="shorts",
            creative_angle="Contrarian",
            language="hi",
        )
        pitch = {
            "selected_title": "Stop Overpacking",
            "video_summary": "Pack three items.",
            "hook_concept": "You do not need a suitcase.",
            "main_content_beats": ["Rule one", "Rule two", "Rule three"],
            "angle_used": "Contrarian",
        }
        generate = AsyncMock(return_value=pitch)

        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            generate,
        ):
            result = asyncio.run(create_video_pitch(request=request, current_user=_user()))

        assert result.success is True
        assert generate.await_args.kwargs["language"] == "hi"

    def test_http_exception_is_reraised(self):
        from api.youtube.router import PitchRequest, create_video_pitch

        request = PitchRequest(
            user_idea="How to travel cheap",
            duration_type="shorts",
            creative_angle="Contrarian",
        )
        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=400, detail="Please enter your video idea."),
        ):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(create_video_pitch(request=request, current_user=_user()))

        assert exc.value.status_code == 400

    def test_failure_returns_error_response(self):
        from api.youtube.router import PitchRequest, create_video_pitch

        request = PitchRequest(
            user_idea="Broken pitch",
            duration_type="shorts",
            creative_angle="Storytelling",
        )
        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            result = asyncio.run(create_video_pitch(request=request, current_user=_user()))

        assert result.success is False
        assert result.message == "Failed to generate pitch. Please try again."
        assert "boom" not in result.message

    def test_validation_error_returns_error_response_not_http_500(self):
        from api.youtube.router import PitchRequest, create_video_pitch
        from services.youtube.planner_pitch_validate import PitchValidationError

        request = PitchRequest(
            user_idea="Broken pitch",
            duration_type="shorts",
            creative_angle="Storytelling",
        )
        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            new_callable=AsyncMock,
            side_effect=PitchValidationError("Failed to parse pitch response as JSON."),
        ):
            result = asyncio.run(create_video_pitch(request=request, current_user=_user()))

        assert result.success is False
        assert "Failed to parse pitch response as JSON" in result.message


class TestExpandVideoPitch:
    def test_success_returns_expansion_and_full_script(self):
        from api.youtube.router import ExpandRequest, expand_video_pitch

        request = ExpandRequest(
            user_idea="How to travel cheap",
            duration_type="shorts",
            approved_pitch={
                "selected_title": "Stop Overpacking",
                "video_summary": "Pack three items.",
                "hook_concept": "Skip the suitcase.",
                "main_content_beats": ["Rule one", "Rule two", "Rule three"],
                "angle_used": "Contrarian",
            },
        )
        expansion = {
            "hook": {"spoken_script": "Hook spoken."},
            "main_content_outline": [{"section_title": "Beat 1", "spoken_script": "Body."}],
            "full_script": "Hook spoken.\n\nBody.",
            "generation": {"text_gateway": "llm_text_gen"},
        }

        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.expand_pitch_to_script",
            new_callable=AsyncMock,
            return_value=expansion,
        ):
            result = asyncio.run(expand_video_pitch(request=request, current_user=_user()))

        assert result.success is True
        assert result.expansion == expansion
        assert result.full_script == "Hook spoken.\n\nBody."

    def test_forwards_language_to_expand_pitch_to_script(self):
        from api.youtube.router import ExpandRequest, expand_video_pitch

        request = ExpandRequest(
            user_idea="How to travel cheap",
            duration_type="shorts",
            language="hi",
            approved_pitch={"selected_title": "Stop Overpacking"},
        )
        expansion = {
            "hook": {"spoken_script": "Hook spoken."},
            "main_content_outline": [{"section_title": "Beat 1", "spoken_script": "Body."}],
            "full_script": "Hook spoken.\n\nBody.",
        }
        expand = AsyncMock(return_value=expansion)

        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.expand_pitch_to_script",
            expand,
        ):
            result = asyncio.run(expand_video_pitch(request=request, current_user=_user()))

        assert result.success is True
        assert expand.await_args.kwargs["language"] == "hi"

    def test_failure_returns_error_response(self):
        from api.youtube.router import ExpandRequest, expand_video_pitch

        request = ExpandRequest(
            user_idea="Broken expand",
            duration_type="shorts",
            approved_pitch={"selected_title": "Title"},
        )
        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch("api.youtube.handlers.plan_pitch.YouTubePlannerService"), patch(
            "api.youtube.handlers.plan_pitch.expand_pitch_to_script",
            new_callable=AsyncMock,
            side_effect=RuntimeError("fail"),
        ):
            result = asyncio.run(expand_video_pitch(request=request, current_user=_user()))

        assert result.success is False
        assert result.message == "Failed to expand pitch. Please try again."


class TestPreviewVideoPitch:
    def test_returns_same_builder_prompts_without_exa(self):
        from api.youtube.router import PitchRequest, preview_video_pitch
        from services.youtube.planner_pitch_prompts import (
            PITCH_RESEARCH_PLACEHOLDER,
            PITCH_SYSTEM_PROMPT,
        )

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
            language="hi",
            enable_research=True,
        )
        research = AsyncMock(return_value=("", []))

        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch(
            "api.youtube.handlers.plan_pitch.YouTubePersonaService.build_prompt_context",
            return_value="",
        ), patch(
            "services.youtube.planner_research.perform_exa_research",
            research,
        ), patch(
            "api.youtube.handlers.plan_pitch.generate_youtube_pitch",
            new_callable=AsyncMock,
        ) as generate:
            result = asyncio.run(preview_video_pitch(request=request, current_user=_user()))

        assert result.success is True
        assert result.system_prompt == PITCH_SYSTEM_PROMPT
        assert "Create ONE short video pitch" in (result.user_prompt or "")
        assert "Contrarian" in (result.user_prompt or "")
        assert "**Content language:** Hindi" in (result.user_prompt or "")
        assert PITCH_RESEARCH_PLACEHOLDER in (result.user_prompt or "")
        assert "Create a YouTube video plan" not in (result.user_prompt or "")
        research.assert_not_called()
        generate.assert_not_called()

    def test_empty_idea_raises_http_400(self):
        from api.youtube.router import PitchRequest, preview_video_pitch

        request = PitchRequest(
            user_idea="   ",
            duration_type="shorts",
            creative_angle="Contrarian",
        )
        with pytest.raises(HTTPException) as exc:
            asyncio.run(preview_video_pitch(request=request, current_user=_user()))
        assert exc.value.status_code == 400
        assert "idea" in str(exc.value.detail).lower()

    def test_invalid_builder_payload_raises_http_500(self):
        from api.youtube.router import PitchRequest, preview_video_pitch

        request = PitchRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            creative_angle="Contrarian",
        )
        with patch(
            "api.youtube.handlers.plan_pitch._load_plan_personalization",
            return_value=_personalization(),
        ), patch(
            "api.youtube.handlers.plan_pitch.YouTubePersonaService.build_prompt_context",
            return_value="",
        ), patch(
            "api.youtube.handlers.plan_pitch.build_pitch_preview_prompts",
            return_value={},
        ):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(preview_video_pitch(request=request, current_user=_user()))
        assert exc.value.status_code == 500
