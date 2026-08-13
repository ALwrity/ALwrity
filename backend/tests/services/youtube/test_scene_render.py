"""
Tests for YouTube scene render orchestration (Phase 3 wiring).
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


def _scene(**overrides) -> dict:
    scene = {
        "scene_number": 1,
        "title": "Scene 1",
        "narration": "Narration text",
        "visual_prompt": "A detailed visual description for the scene",
        "duration_estimate": 5,
        "enabled": True,
        "imageUrl": "/api/youtube/images/scenes/s1.png",
        "audioUrl": "/api/youtube/audio/s1.mp3",
    }
    scene.update(overrides)
    return scene


class TestExecuteSceneVideoRender:
    def test_rejects_missing_visual_prompt(self):
        from services.youtube.scene_render import execute_scene_video_render

        with pytest.raises(HTTPException) as exc:
            execute_scene_video_render(
                scene=_scene(visual_prompt=""),
                user_id="user_render",
                resolution="720p",
                generate_audio_enabled=False,
                voice_id="Wise_Woman",
                db=None,
                wavespeed_client=MagicMock(),
            )

        assert exc.value.status_code == 400

    def test_renderer_delegates_to_scene_render(self):
        from services.youtube.renderer import YouTubeVideoRendererService

        expected = {
            "scene_number": 1,
            "video_url": "/api/youtube/videos/scene_1.mp4",
            "generation_mode": "i2v",
        }

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=Path("/tmp/yt")), \
             patch(
                 "services.youtube.renderer.execute_scene_video_render",
                 return_value=dict(expected),
             ) as mock_execute:
            svc = YouTubeVideoRendererService()
            result = svc.render_scene_video(
                scene=_scene(),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        mock_execute.assert_called_once()
        assert "generation_mode" not in result
        assert result["video_url"] == expected["video_url"]

    def test_raises_when_audio_url_fails_and_generation_disabled(self):
        from services.youtube.scene_render import execute_scene_video_render

        with patch("services.youtube.scene_render.resolve_scene_audio_base64", return_value=None), \
             patch("services.youtube.scene_render.generate_youtube_scene_video") as mock_generate:
            with pytest.raises(HTTPException) as exc:
                execute_scene_video_render(
                    scene=_scene(),
                    user_id="user_render",
                    resolution="720p",
                    generate_audio_enabled=False,
                    voice_id="Wise_Woman",
                    db=None,
                    wavespeed_client=MagicMock(),
                )

        assert exc.value.status_code == 400
        assert "audio could not be loaded" in str(exc.value.detail)
        mock_generate.assert_not_called()

    def test_logs_prediction_id_when_wavespeed_rejects(self):
        from services.youtube.scene_render import execute_scene_video_render

        rejected = HTTPException(
            status_code=502,
            detail={"error": "WaveSpeed failed", "prediction_id": "pred-abc"},
        )

        with patch("services.youtube.scene_render.resolve_scene_audio_base64", return_value="audio-b64"), \
             patch("services.youtube.scene_render.resolve_scene_image_base64", return_value=None), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 side_effect=rejected,
             ):
            with pytest.raises(HTTPException) as exc:
                execute_scene_video_render(
                    scene=_scene(imageUrl=None),
                    user_id="user_render",
                    resolution="720p",
                    generate_audio_enabled=False,
                    voice_id="Wise_Woman",
                    db=None,
                    wavespeed_client=MagicMock(),
                )

        assert exc.value.status_code == 502
        assert exc.value.detail.get("prediction_id") == "pred-abc"
