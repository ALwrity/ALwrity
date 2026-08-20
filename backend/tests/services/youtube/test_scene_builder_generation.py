"""Tests for YouTube LLM scene generation helpers."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _plan() -> dict:
    return {
        "duration_type": "medium",
        "video_summary": "Summary",
        "video_goal": "Educate",
        "key_message": "Key",
        "visual_style": "cinematic",
        "tone": "friendly",
        "hook_strategy": "Ask a question",
        "call_to_action": "Subscribe",
        "content_outline": [
            {"section": "Hook", "description": "Open strong", "duration_estimate": 10},
            {"section": "Body", "description": "Teach tip", "duration_estimate": 40},
        ],
    }


class TestGenerateScenesFromPlan:
    def test_rejects_empty_outline(self):
        from services.youtube.scene_builder_generation import generate_scenes_from_plan

        with pytest.raises(HTTPException) as exc:
            generate_scenes_from_plan(
                video_plan={"duration_type": "medium", "content_outline": []},
                duration_metadata={"scene_duration_range": (5, 15)},
                user_id="user_empty",
            )
        assert exc.value.status_code == 400

    def test_normalizes_list_response(self):
        from services.youtube.scene_builder_generation import generate_scenes_from_plan

        llm_scenes = [
            {
                "scene_number": 1,
                "title": "Hook",
                "narration": "Hello",
                "visual_description": "Wide shot",
                "duration_estimate": 8,
                "emphasis": "hook",
                "visual_cues": ["zoom"],
            }
        ]
        with patch(
            "services.youtube.scene_builder_generation.llm_text_gen",
            return_value=llm_scenes,
        ):
            scenes = generate_scenes_from_plan(
                video_plan=_plan(),
                duration_metadata={"scene_duration_range": (5, 15), "target_seconds": 60},
                user_id="user_ok",
            )

        assert len(scenes) == 1
        assert scenes[0]["visual_prompt"] == "Wide shot"
        assert scenes[0]["narration"] == "Hello"

    def test_raises_on_invalid_llm_payload(self):
        from services.youtube.scene_builder_generation import generate_scenes_from_plan

        with patch(
            "services.youtube.scene_builder_generation.llm_text_gen",
            return_value={"unexpected": True},
        ):
            with pytest.raises(HTTPException) as exc:
                generate_scenes_from_plan(
                    video_plan=_plan(),
                    duration_metadata={"scene_duration_range": (5, 15)},
                    user_id="user_bad",
                )
        assert exc.value.status_code == 500

    def test_passes_built_prompts_to_llm_text_gen(self):
        from services.youtube.scene_builder_generation import generate_scenes_from_plan

        llm_scenes = [
            {
                "scene_number": 1,
                "title": "Hook",
                "narration": "Hello",
                "visual_description": "Wide shot",
                "duration_estimate": 8,
                "emphasis": "hook",
                "visual_cues": [],
            }
        ]
        with patch(
            "services.youtube.scene_builder_generation.llm_text_gen",
            return_value=llm_scenes,
        ) as mock_llm:
            generate_scenes_from_plan(
                video_plan=_plan(),
                duration_metadata={"scene_duration_range": (5, 15), "target_seconds": 60},
                user_id="user_prompts",
            )

        mock_llm.assert_called_once()
        call_kwargs = mock_llm.call_args.kwargs
        assert "Summary" in call_kwargs["prompt"]
        assert "master YouTube scriptwriter" in call_kwargs["system_prompt"]
