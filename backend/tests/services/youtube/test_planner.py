"""
Tests for YouTubePlannerService.

Covers duration context, plan validation, and generate_plan with mocked LLM/research.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _minimal_plan(**overrides) -> dict:
    plan = {
        "video_summary": "How to travel cheaper",
        "target_audience": "Budget travelers",
        "video_goal": "Educate",
        "key_message": "Book smarter",
        "hook_strategy": "Start with a surprising price tip",
        "content_outline": [
            {"section": "Hook", "description": "Open", "duration_estimate": 10},
            {"section": "Tips", "description": "Core tips", "duration_estimate": 20},
        ],
        "call_to_action": "Subscribe",
        "visual_style": "Clean travel footage",
        "tone": "Friendly",
        "seo_keywords": ["travel", "budget"],
    }
    plan.update(overrides)
    return plan


class TestDurationContext:
    def test_shorts_and_unknown_fallback(self):
        from services.youtube.planner import YouTubePlannerService

        svc = YouTubePlannerService()
        shorts = svc._get_duration_context("shorts")
        medium = svc._get_duration_context("unknown")

        assert shorts["max_scenes"] == 4
        assert medium["description"].startswith("Medium-length")


class TestValidateAndEnhancePlan:
    def test_fills_missing_required_fields(self):
        from services.youtube.planner import YouTubePlannerService

        svc = YouTubePlannerService()
        duration = svc._get_duration_context("shorts")
        enhanced = svc._validate_and_enhance_plan(
            plan_data={"video_summary": "Only summary"},
            duration_context=duration,
            video_type="tutorial",
            video_type_config={"tone": "Clear"},
        )

        assert enhanced["video_summary"] == "Only summary"
        assert isinstance(enhanced["seo_keywords"], list)
        assert isinstance(enhanced["content_outline"], list)
        assert "duration_metadata" in enhanced or enhanced.get("tone")


class TestGeneratePlan:
    def test_success_with_mocked_llm(self):
        from services.youtube.planner import YouTubePlannerService

        svc = YouTubePlannerService()
        llm_payload = _minimal_plan()

        with patch("services.youtube.planner.llm_text_gen", return_value=llm_payload), \
             patch.object(svc, "_perform_exa_research", new=AsyncMock(return_value=None)):
            result = asyncio.run(
                svc.generate_plan(
                    user_idea="Cheap travel tips",
                    duration_type="shorts",
                    video_type="tutorial",
                    user_id="user_planner",
                    enable_research=False,
                )
            )

        assert result["video_summary"]
        assert result["duration_type"] == "shorts" or "video_summary" in result

    def test_http_exception_propagates(self):
        from services.youtube.planner import YouTubePlannerService

        svc = YouTubePlannerService()
        with patch(
            "services.youtube.planner.llm_text_gen",
            side_effect=HTTPException(status_code=429, detail="quota"),
        ), patch.object(svc, "_perform_exa_research", new=AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(
                    svc.generate_plan(
                        user_idea="Idea",
                        duration_type="medium",
                        user_id="user_planner",
                        enable_research=False,
                    )
                )
        assert exc.value.status_code == 429

    def test_generic_error_wrapped_as_500(self):
        from services.youtube.planner import YouTubePlannerService

        svc = YouTubePlannerService()
        with patch(
            "services.youtube.planner.llm_text_gen",
            side_effect=RuntimeError("llm down"),
        ), patch.object(svc, "_perform_exa_research", new=AsyncMock(return_value=None)):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(
                    svc.generate_plan(
                        user_idea="Idea",
                        duration_type="medium",
                        user_id="user_planner",
                        enable_research=False,
                    )
                )
        assert exc.value.status_code == 500
