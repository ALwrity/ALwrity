"""Tests for YouTube scene video prompt helpers."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYoutubeSceneVideoPrompts:
    def test_prefers_enhanced_visual_prompt(self):
        from services.youtube.youtube_scene_video_prompts import (
            resolve_youtube_scene_video_prompt,
        )

        prompt, source = resolve_youtube_scene_video_prompt(
            {
                "visual_prompt": "Original",
                "enhanced_visual_prompt": "Enhanced cinematic shot",
            }
        )

        assert prompt == "Enhanced cinematic shot"
        assert source == "enhanced_visual_prompt"

    def test_falls_back_to_visual_prompt(self):
        from services.youtube.youtube_scene_video_prompts import (
            resolve_youtube_scene_video_prompt,
        )

        prompt, source = resolve_youtube_scene_video_prompt({"visual_prompt": "Studio shot"})

        assert prompt == "Studio shot"
        assert source == "visual_prompt"

    def test_duration_maps_to_five_or_ten(self):
        from services.youtube.youtube_scene_video_prompts import (
            resolve_youtube_scene_video_duration,
        )

        assert resolve_youtube_scene_video_duration(5) == 5
        assert resolve_youtube_scene_video_duration(8) == 10
        assert resolve_youtube_scene_video_duration("bad") == 5

    def test_builds_generation_metadata(self):
        from services.youtube.youtube_scene_video_prompts import (
            build_youtube_scene_video_generation_metadata,
        )

        metadata = build_youtube_scene_video_generation_metadata(
            visual_prompt="Studio shot",
            prompt_source="visual_prompt",
            generation_mode="i2v",
            duration=5,
            resolution="720p",
            enable_prompt_expansion=True,
            provider="wavespeed",
            model="wan-2.5",
            image_attached=True,
            audio_attached=True,
            image_url="/api/youtube/images/scenes/s1.png?token=secret",
            audio_url="/api/youtube/audio/scenes/s1.mp3?token=secret",
            duration_estimate=5,
        )

        assert metadata["visual_prompt"] == "Studio shot"
        assert metadata["generation_mode"] == "i2v"
        assert metadata["enable_prompt_expansion"] is True
        assert metadata["gateway"] == "wavespeed_wan25"
        assert metadata["has_system_prompt"] is False
        assert metadata["image_attached"] is True
        assert metadata["audio_attached"] is True
        assert metadata["image_url"] == "/api/youtube/images/scenes/s1.png"
        assert metadata["audio_url"] == "/api/youtube/audio/scenes/s1.mp3"
        assert "clip length is 5s" in metadata["audio_note"]
        assert metadata["negative_prompt_sent"] is False
        assert metadata["seed_sent"] is False

    def test_strips_query_tokens_from_media_refs(self):
        from services.youtube.youtube_scene_video_prompts import safe_youtube_media_ref

        assert safe_youtube_media_ref("/path/file.png?sig=abc") == "/path/file.png"
        assert safe_youtube_media_ref("") == ""
