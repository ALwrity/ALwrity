"""
Tests for YouTube Creator scene image generation background task execution.

Verifies that:
- _execute_image_generation_task uses get_session_for_user(user_id) instead of get_db()
- Background task completes successfully without raising 'Depends' object has no attribute 'get'
- Task status in task_manager is updated to completed upon success
- DB session is properly closed in the finally block
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestExecuteImageGenerationTask:
    """Test suite for _execute_image_generation_task background task."""

    def test_task_uses_get_session_for_user_and_succeeds(self, tmp_path):
        """Task should acquire session via get_session_for_user(user_id) and avoid 'Depends' error."""
        from api.youtube.handlers import images as images_module
        from api.youtube.handlers.images import _execute_image_generation_task
        from services.youtube.youtube_task_manager import task_manager

        user_id = "user_test_image_task"
        task_id = task_manager.create_task("youtube_image_generation")

        request_data = {
            "scene_id": "1",
            "scene_title": "Test Scene 1",
            "scene_content": "A test scene description",
            "idea": "Test video idea",
            "width": 1024,
            "height": 576,
        }

        mock_db = MagicMock()
        image_bytes = b"\x89PNG\r\n\x1a\n" + (b"x" * 64)
        image_path = tmp_path / "yt_scene_1_12345678.png"
        image_path.write_bytes(image_bytes)

        mock_result = SimpleNamespace(
            image_bytes=image_bytes,
            provider="wavespeed",
            model="ideogram-v3-turbo",
        )

        # Force MagicMock (not AsyncMock): conftest may stub generate_image as async.
        mock_generate = MagicMock(return_value=mock_result)

        with patch("services.database.get_session_for_user", return_value=mock_db) as mock_get_session, \
             patch.object(images_module, "generate_image", new=mock_generate), \
             patch.object(
                 images_module,
                 "_save_scene_image",
                 return_value={
                     "image_filename": "yt_scene_1_12345678.png",
                     "image_path": str(image_path),
                     "image_url": "/api/youtube/images/scenes/yt_scene_1_12345678.png",
                 },
             ), \
             patch.object(images_module, "save_asset_to_library"):

            _execute_image_generation_task(
                task_id=task_id,
                request_data=request_data,
                user_id=user_id,
            )

            mock_get_session.assert_called_once_with(user_id)
            mock_generate.assert_called_once()
            mock_db.close.assert_called_once()

            status = task_manager.get_task_status(task_id)
            assert status is not None
            assert status["status"] == "completed", (
                f"Expected completed, got {status['status']}: {status.get('error')}"
            )
            assert status["progress"] == 100.0
            assert status["result"]["image_filename"] == "yt_scene_1_12345678.png"
            assert status["result"]["generation"]["image_prompt"]
            assert "Depends" not in str(status.get("error") or "")

    def test_task_handles_missing_db_session_gracefully(self):
        """Task should handle get_session_for_user returning None without crashing."""
        from api.youtube.handlers.images import _execute_image_generation_task
        from services.youtube.youtube_task_manager import task_manager

        user_id = "user_no_db"
        task_id = task_manager.create_task("youtube_image_generation")

        request_data = {
            "scene_id": "2",
            "scene_title": "Scene Without DB",
        }

        with patch("services.database.get_session_for_user", return_value=None):
            _execute_image_generation_task(
                task_id=task_id,
                request_data=request_data,
                user_id=user_id,
            )

            status = task_manager.get_task_status(task_id)
            assert status is not None
            assert status["status"] == "failed"
            assert "Database session unavailable" in status["error"]
            assert "Depends" not in status["error"]
