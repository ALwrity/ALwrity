"""
Tests for YouTube scene video generation model selection.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestGenerateYouTubeSceneVideo:
    def test_uses_text_to_video_when_no_image(self):
        from services.youtube.scene_video_generate import generate_youtube_scene_video

        mock_client = MagicMock()
        mock_client.generate_text_video.return_value = {
            "video_bytes": b"t2v-bytes",
            "model_name": "alibaba/wan-2.5/text-to-video",
        }

        result = generate_youtube_scene_video(
            visual_prompt="A cinematic sunset over mountains",
            resolution="720p",
            duration=5,
            audio_base64="audio-b64",
            image_base64=None,
            wavespeed_client=mock_client,
        )

        assert result["video_bytes"] == b"t2v-bytes"
        mock_client.generate_text_video.assert_called_once_with(
            prompt="A cinematic sunset over mountains",
            resolution="720p",
            duration=5,
            audio_base64="audio-b64",
            enable_prompt_expansion=True,
            enable_sync_mode=True,
            timeout=600,
        )

    def test_uses_image_to_video_when_image_present(self):
        from services.youtube import scene_video_generate as gen_mod

        i2v_result = {
            "video_bytes": b"i2v-bytes",
            "model_name": "alibaba/wan-2.5/image-to-video",
        }

        with patch.object(
            gen_mod,
            "_run_async_coro",
            return_value=i2v_result,
        ) as mock_run:
            result = gen_mod.generate_youtube_scene_video(
                visual_prompt="Character walks forward",
                resolution="720p",
                duration=5,
                audio_base64="audio-b64",
                image_base64="image-b64",
            )

        assert result == i2v_result
        mock_run.assert_called_once()

    def test_run_async_coro_uses_asyncio_run_without_active_loop(self):
        from services.youtube.scene_video_generate import _run_async_coro

        async def _sample():
            return "ok"

        assert _run_async_coro(_sample()) == "ok"
