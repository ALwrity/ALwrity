"""Tests for POST /api/youtube/plan/idea/enhance."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _user(uid: str = "user_idea_enhance") -> dict:
    return {"id": uid, "email": "test@example.com"}


def _three() -> dict:
    return {
        "enhanced_ideas": ["Idea one", "Idea two", "Idea three"],
        "rationales": ["A", "B", "C"],
    }


class TestPlanIdeaEnhanceRequestSchema:
    def test_requires_user_idea(self):
        from api.youtube.router import PlanIdeaEnhanceRequest

        with pytest.raises(ValidationError):
            PlanIdeaEnhanceRequest(duration_type="shorts")

    def test_accepts_idea_duration_and_language(self):
        from api.youtube.router import PlanIdeaEnhanceRequest

        request = PlanIdeaEnhanceRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            language="hi",
        )
        assert request.user_idea == "Budget travel"
        assert request.duration_type == "shorts"
        assert request.language == "hi"


class TestEnhancePlanIdea:
    def test_unauthenticated_returns_401(self):
        from api.youtube.router import PlanIdeaEnhanceRequest, enhance_plan_idea

        request = PlanIdeaEnhanceRequest(user_idea="Budget travel", duration_type="medium")
        with pytest.raises(HTTPException) as exc:
            asyncio.run(enhance_plan_idea(request, {}))
        assert exc.value.status_code == 401

    def test_success_returns_three_ideas(self):
        from api.youtube.router import PlanIdeaEnhanceRequest, enhance_plan_idea

        request = PlanIdeaEnhanceRequest(
            user_idea="Budget travel",
            duration_type="shorts",
            language="en",
        )
        with patch(
            "api.youtube.handlers.plan_idea_enhance.enhance_youtube_plan_idea",
            return_value=_three(),
        ), patch(
            "api.youtube.handlers.plan_idea_enhance._load_channel_bible_context",
            return_value="",
        ):
            result = asyncio.run(enhance_plan_idea(request, _user()))
        assert result.success is True
        assert result.enhanced_ideas == _three()["enhanced_ideas"]
        assert result.rationales == _three()["rationales"]

    def test_not_three_ideas_returns_502(self):
        from api.youtube.router import PlanIdeaEnhanceRequest, enhance_plan_idea
        from services.youtube.planner_idea_enhance import IdeaEnhanceError

        request = PlanIdeaEnhanceRequest(user_idea="Budget travel")
        with patch(
            "api.youtube.handlers.plan_idea_enhance.enhance_youtube_plan_idea",
            side_effect=IdeaEnhanceError("Expected exactly 3 enhanced ideas."),
        ), patch(
            "api.youtube.handlers.plan_idea_enhance._load_channel_bible_context",
            return_value="",
        ):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(enhance_plan_idea(request, _user()))
        assert exc.value.status_code == 502

    def test_blank_idea_returns_400(self):
        from api.youtube.router import PlanIdeaEnhanceRequest, enhance_plan_idea

        request = PlanIdeaEnhanceRequest(user_idea="   ")
        with pytest.raises(HTTPException) as exc:
            asyncio.run(enhance_plan_idea(request, _user()))
        assert exc.value.status_code == 400
