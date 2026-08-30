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

        assert len(scenes["scenes"]) == 2
        assert scenes["scenes"][0]["narration"] == "Start here"
        assert scenes["generation"]["system_prompt"]
        assert scenes["generation"]["llm_called"] is False
        assert scenes["generation"]["scenes_reused_from_plan"] is True
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

        assert len(scenes["scenes"]) == 3
        assert "Intro tip one" in scenes["scenes"][0]["narration"]
        assert scenes["generation"]["custom_script_used"] is True
        assert scenes["generation"]["llm_called"] is False
        assert all(s["title"] != f"Scene {s['scene_number']}" for s in scenes["scenes"])

    def test_shorts_custom_script_not_two_second_duplicates(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        hook = "Stop booking weekend flights."
        beat = "Midweek fares drop because offices stay empty."
        outro = "That is the whole system."
        cta = "Follow for the alert setup."
        plan = {
            "duration_type": "shorts",
            "duration_metadata": {
                "max_scenes": 4,
                "scene_duration_range": (2, 8),
                "target_seconds": 30,
                "hook_seconds": 3,
                "cta_seconds": 3,
            },
            "hook_strategy": hook,
            "outro": outro,
            "call_to_action": cta,
            "content_outline": [
                {
                    "section": "Why midweek is cheaper",
                    "description": beat,
                    "duration_estimate": 8,
                    "visual": "Calendar highlighting Tuesday",
                },
            ],
        }
        script = "\n\n".join([hook, beat, outro, cta])

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            with patch.object(
                svc,
                "_enhance_visual_prompts_batch",
                side_effect=lambda scenes, *a, **k: scenes,
            ):
                result = svc.build_scenes_from_plan(
                    video_plan=plan,
                    user_id="user_scenes",
                    custom_script=script,
                )

        scenes = result["scenes"]
        durations = [s["duration_estimate"] for s in scenes]
        assert len(scenes) == 4
        assert not all(d == 2 for d in durations)
        assert abs(sum(durations) - 30) <= 30 * 0.20
        assert scenes[1]["visual_prompt"] == "Calendar highlighting Tuesday"
        assert scenes[1]["visual_prompt"] != scenes[1]["narration"]
        assert scenes[1]["title"] == "Why midweek is cheaper"
        assert all(s["title"] != f"Scene {s['scene_number']}" for s in scenes)

    def test_shorts_skip_prompt_enhancement_when_visual_is_distinct(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            scenes = [
                {
                    "scene_number": 1,
                    "narration": "Book midweek",
                    "visual_prompt": "Airport scene",
                    "visual_description": "Airport scene",
                }
            ]
            with patch.object(svc, "_batch_enhance_prompts") as mock_batch:
                enhanced = svc._enhance_visual_prompts_batch(
                    scenes=scenes,
                    video_plan={"duration_type": "shorts"},
                    user_id="user_scenes",
                    duration_type="shorts",
                )

        mock_batch.assert_not_called()
        assert enhanced[0]["enhanced_visual_prompt"] == "Airport scene"

    def test_shorts_enhance_when_visual_empty_or_copied(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            scenes = [
                {
                    "scene_number": 1,
                    "title": "Hook",
                    "narration": "Stop booking weekend flights.",
                    "visual_prompt": "Stop booking weekend flights.",
                    "visual_description": "Stop booking weekend flights.",
                }
            ]
            with patch.object(
                svc,
                "_batch_enhance_prompts",
                return_value={0: "Wide shot of a busy departure hall"},
            ) as mock_batch:
                enhanced = svc._enhance_visual_prompts_batch(
                    scenes=scenes,
                    video_plan={"duration_type": "shorts", "visual_style": "clean"},
                    user_id="user_scenes",
                    duration_type="shorts",
                )

        mock_batch.assert_called_once()
        assert enhanced[0]["enhanced_visual_prompt"] == "Wide shot of a busy departure hall"
        assert enhanced[0]["visual_prompt"] == "Wide shot of a busy departure hall"
        assert enhanced[0]["visual_prompt"] != enhanced[0]["narration"]

    def test_seeds_hook_visual_when_enhance_returns_empty(self):
        from services.youtube.scene_builder import YouTubeSceneBuilderService

        with patch("services.youtube.scene_builder.PromptEnhancerService"):
            svc = YouTubeSceneBuilderService()
            scenes = [
                {
                    "scene_number": 1,
                    "title": "Hook",
                    "emphasis": "hook",
                    "narration": "Want titles that explode clicks? Watch this!",
                    "visual_prompt": "",
                    "visual_description": "",
                },
                {
                    "scene_number": 2,
                    "title": "Why midweek is cheaper",
                    "emphasis": "main_content",
                    "narration": "Book midweek",
                    "visual_prompt": "Calendar highlighting Tuesday",
                    "visual_description": "Calendar highlighting Tuesday",
                },
            ]
            with patch.object(
                svc,
                "_batch_enhance_prompts",
                return_value={0: "", 1: "Calendar highlighting Tuesday"},
            ):
                enhanced = svc._enhance_visual_prompts_batch(
                    scenes=scenes,
                    video_plan={"duration_type": "shorts"},
                    user_id="user_scenes",
                    duration_type="shorts",
                )

        assert "Calendar highlighting Tuesday" in enhanced[0]["visual_prompt"]
        assert enhanced[0]["visual_prompt"] != enhanced[0]["narration"]
        assert enhanced[1]["visual_prompt"] == "Calendar highlighting Tuesday"

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


class TestMapYoutubeEnhanceResponse:
    def test_accepts_list_of_strings(self):
        from services.youtube.youtube_scene_enhance_response import map_youtube_enhance_response

        mapped = map_youtube_enhance_response(
            ["Opening kitchen shot", "Calendar close-up"],
            [
                {"image_prompt": ""},
                {"image_prompt": "seed"},
            ],
        )
        assert mapped[0] == "Opening kitchen shot"
        assert mapped[1] == "Calendar close-up"

    def test_accepts_one_based_scene_index(self):
        from services.youtube.youtube_scene_enhance_response import map_youtube_enhance_response

        mapped = map_youtube_enhance_response(
            [
                {"scene_index": 1, "enhanced_prompt": "Hook shot"},
                {"scene_index": 2, "enhanced_prompt": "Beat shot"},
            ],
            [{"image_prompt": ""}, {"image_prompt": ""}],
        )
        assert mapped[0] == "Hook shot"
        assert mapped[1] == "Beat shot"
