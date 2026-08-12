"""
Tests: YouTube combine uses PodcastVideoCombinationService (video-only).

Regression for: Scenes and audio paths are required
when combine passed empty audio_paths into StoryVideoGenerationService.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYouTubeCombineUsesPodcastWorkflow:
    def test_execute_combine_calls_podcast_combine_videos(self, tmp_path):
        from api.youtube.router import _execute_combine_video_task
        from services.youtube.youtube_task_manager import task_manager

        user_id = "user_combine_test"
        task_id = task_manager.create_task("youtube_video_combine")

        scene1 = tmp_path / "scene_1.mp4"
        scene2 = tmp_path / "scene_2.mp4"
        scene1.write_bytes(b"mp4-one")
        scene2.write_bytes(b"mp4-two")

        final_path = tmp_path / "youtube_final.mp4"
        final_path.write_bytes(b"combined")

        mock_db = MagicMock()
        mock_combine = MagicMock(
            return_value={
                "video_path": str(final_path),
                "video_filename": final_path.name,
                "video_url": f"/api/podcast/final-videos/{final_path.name}",
                "file_size": final_path.stat().st_size,
                "duration": 12.0,
                "num_scenes": 2,
            }
        )

        with patch("services.database.get_session_for_user", return_value=mock_db), \
             patch(
                 "api.youtube.router.find_youtube_video_file",
                 side_effect=lambda name, user_id=None, db=None: {
                     "scene_1.mp4": scene1,
                     "scene_2.mp4": scene2,
                 }.get(name),
             ), \
             patch(
                 "api.youtube.router.get_youtube_video_dir",
                 return_value=tmp_path,
             ), \
             patch(
                 "api.youtube.router.PodcastVideoCombinationService"
             ) as mock_svc_cls, \
             patch("api.youtube.router.save_asset_to_library"):
            mock_svc_cls.return_value.combine_videos = mock_combine

            _execute_combine_video_task(
                task_id=task_id,
                scene_video_urls=[
                    "/api/youtube/videos/scene_1.mp4",
                    "/api/youtube/videos/scene_2.mp4",
                ],
                user_id=user_id,
                resolution="720p",
                title="Test Combine",
            )

        mock_svc_cls.assert_called_once_with(output_dir=str(tmp_path))
        mock_combine.assert_called_once()
        call_kwargs = mock_combine.call_args.kwargs
        assert call_kwargs["video_paths"] == [str(scene1), str(scene2)]
        assert call_kwargs["podcast_title"] == "Test Combine"
        assert "audio_paths" not in call_kwargs

        status = task_manager.get_task_status(task_id)
        assert status is not None
        assert status["status"] == "completed"
        assert status["result"]["video_url"] == f"/api/youtube/videos/{final_path.name}"
        mock_db.close.assert_called_once()

    def test_execute_combine_does_not_use_story_generate_story_video(self):
        import inspect

        from api.youtube.router import _execute_combine_video_task

        source = inspect.getsource(_execute_combine_video_task)
        assert "PodcastVideoCombinationService" in source
        assert "generate_story_video" not in source
        assert "StoryVideoGenerationService" not in source
