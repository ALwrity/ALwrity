"""Tests for YouTube scene generation prompt builders."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _plan() -> dict:
    return {
        "video_summary": "Budget travel tips",
        "video_goal": "Educate",
        "key_message": "Save money",
        "visual_style": "cinematic",
        "tone": "friendly",
        "hook_strategy": "Ask a question",
        "call_to_action": "Subscribe",
        "content_outline": [
            {"section": "Hook", "description": "Open strong", "duration_estimate": 10},
        ],
    }


class TestBuildSceneGenerationPrompts:
    def test_includes_plan_fields(self):
        from services.youtube.scene_builder_prompts import build_scene_generation_prompts

        system_prompt, user_prompt = build_scene_generation_prompts(
            _plan(),
            {"scene_duration_range": (5, 15), "target_seconds": 90, "hook_seconds": 8},
        )

        assert "master YouTube scriptwriter" in system_prompt
        assert "Budget travel tips" in user_prompt
        assert "Open strong" in user_prompt
        assert "5-15 seconds" in user_prompt

    def test_includes_hindi_language_and_spoken_word_budget(self):
        from services.youtube.scene_builder_prompts import build_scene_generation_prompts

        plan = _plan()
        plan["language"] = "hi"
        plan["duration_type"] = "shorts"
        _, user_prompt = build_scene_generation_prompts(
            plan,
            {"scene_duration_range": (2, 8), "target_seconds": 30, "hook_seconds": 3},
        )

        assert "CONTENT LANGUAGE:** Hindi" in user_prompt
        assert "Write every narration field in Hindi" in user_prompt
        assert "Spoken word budget: 75 words" in user_prompt

    def test_normalizes_string_outline_items(self):
        from services.youtube.scene_builder_prompts import build_scene_generation_prompts

        _, user_prompt = build_scene_generation_prompts(
            {"content_outline": ["Intro section"]},
            {"scene_duration_range": (5, 15)},
        )

        assert "Intro section" in user_prompt
