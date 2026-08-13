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
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=Path("/tmp/yt")):
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
        video_result = {
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
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value=video_result,
             ) as mock_generate, \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 return_value=None,
             ), \
             patch(
                 "services.youtube.scene_render.save_youtube_scene_video",
                 return_value=save_result,
             ) as mock_save, \
             patch(
                 "services.youtube.scene_render.track_video_usage",
                 return_value={"tracked": True},
             ):
            svc = YouTubeVideoRendererService()
            result = svc.render_scene_video(
                scene=_scene(audioUrl=None, imageUrl=None),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        assert result["video_url"] == save_result["video_url"]
        assert result["cost"] == 0.5
        mock_generate.assert_called_once()
        mock_save.assert_called_once()
        call_kwargs = mock_generate.call_args.kwargs
        assert call_kwargs["image_base64"] is None
        assert call_kwargs["wavespeed_client"] is mock_ws_cls.return_value

    def test_uses_i2v_when_scene_image_resolves(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 32)
        video_result = {
            "video_bytes": video_bytes,
            "provider": "wavespeed",
            "model_name": "alibaba/wan-2.5/image-to-video",
            "cost": 0.5,
            "duration": 5,
            "width": 1280,
            "height": 720,
            "prediction_id": "pred-i2v",
        }
        save_result = {
            "video_filename": "scene_1_user_abc.mp4",
            "video_url": "/api/youtube/videos/scene_1_user_abc.mp4",
            "video_path": str(tmp_path / "scene_1_user_abc.mp4"),
            "file_size": len(video_bytes),
        }

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 return_value="image-b64",
             ) as mock_image, \
             patch(
                 "services.youtube.scene_render.resolve_scene_audio_base64",
                 return_value="audio-b64",
             ), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value=video_result,
             ) as mock_generate, \
             patch(
                 "services.youtube.scene_render.save_youtube_scene_video",
                 return_value=save_result,
             ), \
             patch(
                 "services.youtube.scene_render.track_video_usage",
                 return_value={"tracked": True},
             ):
            svc = YouTubeVideoRendererService()
            svc.render_scene_video(
                scene=_scene(),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        mock_image.assert_called_once()
        call_kwargs = mock_generate.call_args.kwargs
        assert call_kwargs["image_base64"] == "image-b64"
        assert call_kwargs["audio_base64"] == "audio-b64"

    def test_falls_back_to_t2v_when_image_load_fails_but_keeps_audio(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 32)
        video_result = {
            "video_bytes": video_bytes,
            "provider": "wavespeed",
            "model_name": "alibaba/wan-2.5/text-to-video",
            "cost": 0.5,
            "duration": 5,
            "width": 1280,
            "height": 720,
            "prediction_id": "pred-t2v",
        }
        save_result = {
            "video_filename": "scene_1_user_abc.mp4",
            "video_url": "/api/youtube/videos/scene_1_user_abc.mp4",
            "video_path": str(tmp_path / "scene_1_user_abc.mp4"),
            "file_size": len(video_bytes),
        }

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 return_value=None,
             ), \
             patch(
                 "services.youtube.scene_render.resolve_scene_audio_base64",
                 return_value="audio-b64",
             ), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value=video_result,
             ) as mock_generate, \
             patch(
                 "services.youtube.scene_render.save_youtube_scene_video",
                 return_value=save_result,
             ), \
             patch(
                 "services.youtube.scene_render.track_video_usage",
                 return_value={"tracked": True},
             ):
            svc = YouTubeVideoRendererService()
            svc.render_scene_video(
                scene=_scene(),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        call_kwargs = mock_generate.call_args.kwargs
        assert call_kwargs["image_base64"] is None
        assert call_kwargs["audio_base64"] == "audio-b64"

    def test_image_resolution_error_falls_back_to_t2v_with_audio(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 32)
        video_result = {
            "video_bytes": video_bytes,
            "provider": "wavespeed",
            "model_name": "alibaba/wan-2.5/text-to-video",
            "cost": 0.5,
            "duration": 5,
            "width": 1280,
            "height": 720,
            "prediction_id": "pred-t2v",
        }
        save_result = {
            "video_filename": "scene_1_user_abc.mp4",
            "video_url": "/api/youtube/videos/scene_1_user_abc.mp4",
            "video_path": str(tmp_path / "scene_1_user_abc.mp4"),
            "file_size": len(video_bytes),
        }

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 side_effect=RuntimeError("image resolver crashed"),
             ), \
             patch(
                 "services.youtube.scene_render.resolve_scene_audio_base64",
                 return_value="audio-b64",
             ), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value=video_result,
             ) as mock_generate, \
             patch(
                 "services.youtube.scene_render.save_youtube_scene_video",
                 return_value=save_result,
             ), \
             patch(
                 "services.youtube.scene_render.track_video_usage",
                 return_value={"tracked": True},
             ):
            svc = YouTubeVideoRendererService()
            svc.render_scene_video(
                scene=_scene(),
                video_plan={"video_summary": "Plan"},
                user_id="user_render",
                generate_audio_enabled=False,
                db=MagicMock(),
            )

        call_kwargs = mock_generate.call_args.kwargs
        assert call_kwargs["image_base64"] is None
        assert call_kwargs["audio_base64"] == "audio-b64"

    def test_raises_when_generation_returns_empty_video_bytes(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 return_value=None,
             ), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value={
                     "video_bytes": b"",
                     "provider": "wavespeed",
                     "model_name": "alibaba/wan-2.5/text-to-video",
                     "cost": 0.0,
                     "duration": 5,
                     "width": 1280,
                     "height": 720,
                 },
             ), \
             patch("services.youtube.scene_render.save_youtube_scene_video") as mock_save:
            svc = YouTubeVideoRendererService()
            with pytest.raises(HTTPException) as exc:
                svc.render_scene_video(
                    scene=_scene(audioUrl=None, imageUrl=None),
                    video_plan={"video_summary": "Plan"},
                    user_id="user_render",
                    generate_audio_enabled=False,
                    db=MagicMock(),
                )

        assert exc.value.status_code == 502
        mock_save.assert_not_called()

    def test_raises_when_save_fails_after_generation(self, tmp_path):
        from services.youtube.renderer import YouTubeVideoRendererService

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 32)
        with patch("services.youtube.renderer.WaveSpeedClient"), \
             patch("services.youtube.renderer.get_youtube_video_dir", return_value=tmp_path), \
             patch(
                 "services.youtube.scene_render.resolve_scene_image_base64",
                 return_value=None,
             ), \
             patch(
                 "services.youtube.scene_render.generate_youtube_scene_video",
                 return_value={
                     "video_bytes": video_bytes,
                     "provider": "wavespeed",
                     "model_name": "alibaba/wan-2.5/text-to-video",
                     "cost": 0.5,
                     "duration": 5,
                     "width": 1280,
                     "height": 720,
                 },
             ), \
             patch(
                 "services.youtube.scene_render.save_youtube_scene_video",
                 side_effect=OSError("disk full"),
             ), \
             patch("services.youtube.scene_render.track_video_usage"):
            svc = YouTubeVideoRendererService()
            with pytest.raises(HTTPException) as exc:
                svc.render_scene_video(
                    scene=_scene(audioUrl=None, imageUrl=None),
                    video_plan={"video_summary": "Plan"},
                    user_id="user_render",
                    generate_audio_enabled=False,
                    db=MagicMock(),
                )

        assert exc.value.status_code == 500
        detail = exc.value.detail
        assert isinstance(detail, dict)
        assert detail.get("error") == "Failed to save rendered scene video"


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
