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
        assert "Failed to generate pitch" in result.message

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
        assert "Failed to expand pitch" in result.message
