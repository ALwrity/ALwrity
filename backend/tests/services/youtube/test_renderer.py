"""
Tests for YouTubeVideoRendererService.

Covers cost estimation, directory helpers, scene validation, and mocked render path.
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


class TestEstimateRenderCost:
    def test_computes_cost_for_enabled_scenes_only(self):
        from services.youtube.renderer import YouTubeVideoRendererService

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=Path("/tmp/yt")):
            svc = YouTubeVideoRendererService()
            estimate = svc.estimate_render_cost(
                scenes=[
                    _scene(scene_number=1, duration_estimate=5),
                    _scene(scene_number=2, duration_estimate=8, enabled=False),
                    _scene(scene_number=3, duration_estimate=9),
                ],
                resolution="720p",
                image_model="ideogram-v3-turbo",
            )

        assert estimate["num_scenes"] == 2
        assert estimate["resolution"] == "720p"
        assert estimate["total_cost"] > 0
        assert len(estimate["scene_costs"]) == 2
        # 9s clamps to 10s duration for pricing
        assert estimate["scene_costs"][1]["actual_duration"] == 10


class TestUserDirs:
    def test_get_user_video_dir_delegates_to_storage_helper(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path) as mock_get:
            svc = YouTubeVideoRendererService()
            result = svc._get_user_video_dir("user_x", db=MagicMock())

        assert result == tmp_path
        mock_get.assert_called()

    def test_get_user_audio_dir_uses_workspace(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        workspace = tmp_path / "ws"
        workspace.mkdir()
        mock_db = MagicMock()

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch("services.youtube.renderer.UserWorkspaceManager") as mock_mgr:
            mock_mgr.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace),
            }
            svc = YouTubeVideoRendererService()
            audio_dir = svc._get_user_audio_dir("user_x", db=mock_db)

        assert audio_dir == workspace / "media" / "youtube_audio"
        assert audio_dir.exists()


class TestRenderSceneVideo:
    def test_rejects_missing_visual_prompt(self):
        from services.youtube.renderer import YouTubeVideoRendererService

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=Path("/tmp/yt")), \
             patch("services.youtube.renderer.validate_scene_animation_operation"), \
             patch("services.youtube.renderer.PricingService"):
            svc = YouTubeVideoRendererService()
            with pytest.raises(HTTPException) as exc:
                svc.render_scene_video(
                    scene=_scene(visual_prompt=""),
                    video_plan={"video_summary": "Plan"},
                    user_id="user_render",
                    generate_audio_enabled=False,
                )
        assert exc.value.status_code == 400

    def test_happy_path_saves_via_youtube_storage(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 32)
        wavespeed_result = {
            "video_bytes": video_bytes,
            "provider": "wavespeed",
            "model_name": "alibaba/wan-2.5/text-to-video",
            "cost": 0.5,
            "duration": 5,
            "width": 1280,
            "height": 720,
            "prediction_id": "pred-1",
        }
        save_result = {
            "video_filename": "scene_1_user_abc.mp4",
            "video_url": "/api/youtube/videos/scene_1_user_abc.mp4",
            "video_path": str(tmp_path / "scene_1_user_abc.mp4"),
            "file_size": len(video_bytes),
        }

        with patch("services.youtube.renderer.WaveSpeedClient") as mock_ws_cls, \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch("services.youtube.renderer.validate_scene_animation_operation"), \
             patch("services.youtube.renderer.PricingService"), \
             patch(
                 "services.youtube.renderer.save_youtube_scene_video",
                 return_value=save_result,
             ) as mock_save, \
             patch(
                 "services.youtube.renderer.track_video_usage",
                 return_value={"tracked": True},
             ):
            mock_ws_cls.return_value.generate_text_video.return_value = wavespeed_result
            svc = YouTubeVideoRendererService()
            result = svc.render_scene_video(
                scene=_scene(audioUrl=None),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        assert result["video_url"] == save_result["video_url"]
        assert result["cost"] == 0.5
        mock_save.assert_called_once()


class TestRenderFullVideo:
    def test_combine_uses_podcast_service(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        scene_result = {
            "scene_number": 1,
            "video_path": str(tmp_path / "s1.mp4"),
            "video_url": "/api/youtube/videos/s1.mp4",
            "cost": 0.2,
        }
        scene_result_2 = {
            "scene_number": 2,
            "video_path": str(tmp_path / "s2.mp4"),
            "video_url": "/api/youtube/videos/s2.mp4",
            "cost": 0.3,
        }
        combined = {
            "video_path": str(tmp_path / "final.mp4"),
            "video_filename": "final.mp4",
            "video_url": "/api/podcast/final-videos/final.mp4",
        }

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch.object(
                 YouTubeVideoRendererService,
                 "render_scene_video",
                 side_effect=[scene_result, scene_result_2],
             ), \
             patch("services.youtube.renderer.PodcastVideoCombinationService") as mock_combine_cls:
            mock_combine_cls.return_value.combine_videos.return_value = combined
            svc = YouTubeVideoRendererService()
            result = svc.render_full_video(
                scenes=[_scene(scene_number=1), _scene(scene_number=2)],
                video_plan={"video_summary": "My Video"},
                user_id="user_render",
                combine_scenes=True,
                db=MagicMock(),
            )

        assert result["success"] is True
        assert result["final_video_url"] == "/api/youtube/videos/final.mp4"
        mock_combine_cls.return_value.combine_videos.assert_called_once()
