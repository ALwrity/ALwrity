"""Tests for YouTube scene image prompt builders."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestBuildYoutubeSceneImagePrompt:
    def test_scene_mode_uses_custom_prompt(self):
        from services.youtube.youtube_scene_image_prompts import build_youtube_scene_image_prompt

        payload = build_youtube_scene_image_prompt(
            scene_title="Hook",
            scene_content="Open with energy",
            idea="Travel tips",
            custom_prompt="Custom visual prompt",
            has_base_avatar=False,
        )

        assert payload["image_prompt"] == "Custom visual prompt"
        assert payload["custom_prompt_used"] is True
        assert payload["generation_type"] == "scene"

    def test_character_mode_ignores_custom_prompt(self):
        from services.youtube.youtube_scene_image_prompts import build_youtube_scene_image_prompt

        payload = build_youtube_scene_image_prompt(
            scene_title="Hook",
            scene_content="Open with energy",
            custom_prompt="Custom visual prompt",
            has_base_avatar=True,
        )

        assert "Scene: Hook" in payload["image_prompt"]
        assert payload["custom_prompt_used"] is False
        assert payload["generation_type"] == "character"
