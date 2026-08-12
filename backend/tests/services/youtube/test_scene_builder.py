"""
Tests for YouTubeSceneBuilderService.

Covers reuse of plan scenes, custom-script parsing, and shorts enhancement skip.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _plan_with_scenes() -> dict:
    return {
        "duration_type": "shorts",
        "_scenes_included": True,
        "duration_metadata": {
            "max_scenes": 4,
            "scene_duration_range": (2, 8),
            "target_seconds": 30,
        },
        "scenes": [
            {
                "scene_number": 1,
                "title": "Hook",
                "narration": "Start here",
                "visual_description": "Traveler at airport",
                "duration_estimate": 3,
                "emphasis": "hook",
                "visual_cues": [],
            },
            {
                "scene_number": 2,
                "title": "Tip",
                "narration": "Book midweek",
                "visual_description": "Calendar closeup",
                "duration_estimate": 5,
                "emphasis": "main_content",
                "visual_cues": [],
            },
        ],
        "content_outline": [],
        "visual_style": "clean",
        "tone": "friendly",
    }


class TestBuildScenesFromPlan:
    def test_reuses_existing_plan_scenes_without_llm(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            with patch.object(svc, "_generate_scenes_from_plan") as mock_generate, \
                 patch.object(svc, "_enhance_visual_prompts_batch", side_effect=lambda scenes, *a, **k: scenes):
                scenes = svc.build_scenes_from_plan(
                    video_plan=_plan_with_scenes(),
                    user_id="user_scenes",
                )

        assert len(scenes) == 2
        assert scenes[0]["narration"] == "Start here"
        mock_generate.assert_not_called()

    def test_parses_custom_script_paragraphs(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        plan = {
            "duration_type": "medium",
            "duration_metadata": {
                "max_scenes": 10,
                "scene_duration_range": (5, 15),
                "target_seconds": 150,
            },
            "content_outline": [],
        }
        script = "Intro tip one.\n\nMain tip two.\n\nClosing tip three."

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            with patch.object(
                svc,
                "_enhance_visual_prompts_batch",
                side_effect=lambda scenes, *a, **k: scenes,
            ):
                scenes = svc.build_scenes_from_plan(
                    video_plan=plan,
                    user_id="user_scenes",
                    custom_script=script,
                )

        assert len(scenes) == 3
        assert "Intro tip one" in scenes[0]["narration"]

    def test_shorts_skip_prompt_enhancement(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            scenes = [
                {
                    "scene_number": 1,
                    "visual_prompt": "Airport scene",
                    "visual_description": "Airport scene",
                }
            ]
            enhanced = svc._enhance_visual_prompts_batch(
                scenes=scenes,
                video_plan={"duration_type": "shorts"},
                user_id="user_scenes",
                duration_type="shorts",
            )

        assert enhanced[0]["enhanced_visual_prompt"] == "Airport scene"

    def test_error_is_wrapped_as_http_500(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            with patch.object(
                svc,
                "_generate_scenes_from_plan",
                side_effect=RuntimeError("llm failed"),
            ):
                with pytest.raises(HTTPException) as exc:
                    svc.build_scenes_from_plan(
                        video_plan={
                            "duration_type": "medium",
                            "duration_metadata": {"max_scenes": 5},
                            "content_outline": [],
                        },
                        user_id="user_scenes",
                    )
        assert exc.value.status_code == 500
