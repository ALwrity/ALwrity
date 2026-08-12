"""
Background-task coverage for YouTube router.py helpers.

Locks behavior of _execute_video_render_task and _execute_scene_video_render_task
before router refactor so session handling and task status updates stay intact.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _sample_scene(num: int = 1) -> dict:
    return {
        "scene_number": num,
        "title": f"Scene {num}",
        "visual_prompt": "A clear visual description for rendering",
        "duration_estimate": 5,
        "imageUrl": f"/api/youtube/images/scenes/scene_{num}.png",
        "audioUrl": f"/api/youtube/audio/scene_{num}.mp3",
    }


class TestExecuteSceneVideoRenderTask:
    def test_completes_and_closes_db(self):
        from api.youtube.router import _execute_scene_video_render_task
        from services.youtube.youtube_task_manager import task_manager

        user_id = "user_bg_scene"
        task_id = task_manager.create_task("youtube_scene_video_render")
        mock_db = MagicMock()
        scene_result = {
            "scene_number": 1,
            "video_url": "/api/youtube/videos/scene_1.mp4",
            "video_filename": "scene_1.mp4",
            "cost": 0.42,
        }

        with patch("services.database.get_session_for_user", return_value=mock_db), \
             patch("api.youtube.render_tasks.YouTubeVideoRendererService") as mock_renderer_cls:
            mock_renderer_cls.return_value.render_scene_video.return_value = scene_result
            _execute_scene_video_render_task(
                task_id=task_id,
                scene=_sample_scene(1),
                video_plan={"video_summary": "Plan"},
                user_id=user_id,
                resolution="720p",
                generate_audio_enabled=False,
                voice_id="Wise_Woman",
            )

        status = task_manager.get_task_status(task_id)
        assert status is not None
        assert status["status"] == "completed"
        assert status["result"]["video_url"] == "/api/youtube/videos/scene_1.mp4"
        mock_db.close.assert_called_once()

    def test_fails_when_db_session_unavailable(self):
        from api.youtube.router import _execute_scene_video_render_task
        from services.youtube.youtube_task_manager import task_manager

        task_id = task_manager.create_task("youtube_scene_video_render")
        with patch("services.database.get_session_for_user", return_value=None):
            _execute_scene_video_render_task(
                task_id=task_id,
                scene=_sample_scene(1),
                video_plan={"video_summary": "Plan"},
                user_id="user_no_db",
                resolution="720p",
                generate_audio_enabled=False,
                voice_id="Wise_Woman",
            )

        status = task_manager.get_task_status(task_id)
        assert status is not None
        assert status["status"] == "failed"


class TestExecuteVideoRenderTask:
    def test_fails_fast_on_invalid_scenes(self):
        from api.youtube.router import _execute_video_render_task
        from services.youtube.youtube_task_manager import task_manager

        task_id = task_manager.create_task("youtube_video_render")
        mock_db = MagicMock()
        invalid_scene = {
            "scene_number": 1,
            "visual_prompt": "",
            "duration_estimate": 5,
        }

        with patch("services.database.get_session_for_user", return_value=mock_db), \
             patch("api.youtube.render_tasks.YouTubeVideoRendererService"):
            _execute_video_render_task(
                task_id=task_id,
                scenes=[invalid_scene],
                video_plan={"video_summary": "Plan"},
                user_id="user_bg_full",
                resolution="720p",
                combine_scenes=False,
                voice_id="Wise_Woman",
            )

        status = task_manager.get_task_status(task_id)
        assert status is not None
        assert status["status"] == "failed"
        mock_db.close.assert_called_once()

    def test_completes_when_renderer_returns_results(self):
        from api.youtube.router import _execute_video_render_task
        from services.youtube.youtube_task_manager import task_manager

        task_id = task_manager.create_task("youtube_video_render")
        mock_db = MagicMock()
        scenes = [_sample_scene(1), _sample_scene(2)]
        scene_results = [
            {
                "scene_number": 1,
                "video_url": "/api/youtube/videos/s1.mp4",
                "video_filename": "s1.mp4",
                "video_path": "/tmp/s1.mp4",
                "file_size": 10,
                "duration": 5,
                "cost": 0.2,
            },
            {
                "scene_number": 2,
                "video_url": "/api/youtube/videos/s2.mp4",
                "video_filename": "s2.mp4",
                "video_path": "/tmp/s2.mp4",
                "file_size": 12,
                "duration": 5,
                "cost": 0.3,
            },
        ]

        with patch("services.database.get_session_for_user", return_value=mock_db), \
             patch("api.youtube.render_tasks.YouTubeVideoRendererService") as mock_renderer_cls, \
             patch("api.youtube.render_tasks.save_asset_to_library"):
            mock_renderer = mock_renderer_cls.return_value
            mock_renderer.render_scene_video.side_effect = scene_results
            _execute_video_render_task(
                task_id=task_id,
                scenes=scenes,
                video_plan={"video_summary": "Plan"},
                user_id="user_bg_full_ok",
                resolution="720p",
                combine_scenes=False,
                voice_id="Wise_Woman",
            )

        status = task_manager.get_task_status(task_id)
        assert status is not None
        assert status["status"] == "completed"
        assert status["result"]["num_successful"] == 2
        mock_db.close.assert_called_once()
