"""
Tests for YouTube video storage helpers.

Covers canonical save path, find across legacy dirs, and unsafe filename rejection.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestGetYouTubeVideoDir:
    def test_uses_user_workspace_media_youtube_videos(self, tmp_path):
        from services.youtube.video_storage import get_youtube_video_dir

        workspace_path = tmp_path / "user_ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            result = get_youtube_video_dir(user_id="user_abc", db=mock_db)

        expected = workspace_path / "media" / "youtube_videos"
        assert result == expected
        assert expected.exists()

    def test_falls_back_to_global_dir_without_workspace(self):
        from api.youtube.paths import YOUTUBE_VIDEO_DIR
        from services.youtube.video_storage import get_youtube_video_dir

        result = get_youtube_video_dir(user_id=None, db=None)
        assert result == YOUTUBE_VIDEO_DIR


class TestSaveYouTubeSceneVideo:
    def test_saves_into_canonical_dir_and_returns_youtube_url(self, tmp_path):
        from services.youtube import video_storage as storage

        video_bytes = b"\x00\x00\x00\x18ftypmp42" + (b"x" * 64)
        mock_db = MagicMock()
        workspace_path = tmp_path / "ws"
        workspace_path.mkdir()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            result = storage.save_youtube_scene_video(
                video_bytes=video_bytes,
                scene_number=2,
                user_id="user_test_save",
                db=mock_db,
            )

        out_dir = workspace_path / "media" / "youtube_videos"
        assert Path(result["video_path"]).parent == out_dir
        assert Path(result["video_path"]).exists()
        assert result["video_filename"].startswith("scene_2_")
        assert result["video_url"] == f"/api/youtube/videos/{result['video_filename']}"
        assert result["file_size"] > 0

    def test_rejects_empty_bytes(self):
        from services.youtube.video_storage import save_youtube_scene_video

        with pytest.raises(ValueError, match="empty"):
            save_youtube_scene_video(b"", scene_number=1, user_id="user_x", db=None)


class TestFindYouTubeVideoFile:
    def test_finds_in_canonical_dir(self, tmp_path):
        from services.youtube import video_storage as storage

        workspace_path = tmp_path / "ws"
        video_dir = workspace_path / "media" / "youtube_videos"
        video_dir.mkdir(parents=True)
        filename = "scene_1_user_abcdef_abcd1234.mp4"
        (video_dir / filename).write_bytes(b"mp4data")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_video_file(filename, user_id="user_abcdef", db=mock_db)

        assert found is not None
        assert found.name == filename

    def test_finds_legacy_story_videos_location(self, tmp_path):
        """Previously mis-saved files under media/story_videos must still resolve."""
        from services.youtube import video_storage as storage

        workspace_path = tmp_path / "ws"
        legacy_dir = workspace_path / "media" / "story_videos"
        legacy_dir.mkdir(parents=True)
        filename = "scene_2_user_legacy_deadbeef.mp4"
        (legacy_dir / filename).write_bytes(b"legacy")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_video_file(filename, user_id="user_legacy", db=mock_db)

        assert found is not None
        assert found == legacy_dir / filename

    def test_finds_legacy_content_videos_location(self, tmp_path):
        from services.youtube import video_storage as storage

        workspace_path = tmp_path / "ws"
        legacy_dir = workspace_path / "content" / "videos"
        legacy_dir.mkdir(parents=True)
        filename = "scene_3_user_content_cafebabe.mp4"
        (legacy_dir / filename).write_bytes(b"content")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_video_file(filename, user_id="user_content", db=mock_db)

        assert found is not None
        assert found == legacy_dir / filename

    def test_rejects_path_traversal_filename(self):
        from services.youtube.video_storage import find_youtube_video_file

        assert find_youtube_video_file("../etc/passwd", user_id="u", db=None) is None
        assert find_youtube_video_file("a/b.mp4", user_id="u", db=None) is None
        assert find_youtube_video_file("a\\b.mp4", user_id="u", db=None) is None

    def test_returns_none_when_missing(self, tmp_path):
        from services.youtube import video_storage as storage

        workspace_path = tmp_path / "ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_video_file(
                "missing_scene.mp4", user_id="user_missing", db=mock_db
            )

        assert found is None


class TestRendererUsesYouTubeStorage:
    def test_scene_render_uses_save_youtube_scene_video(self):
        """Regression: scene save must route through YouTube video storage helper."""
        import inspect

        from services.youtube import scene_render as scene_render_module

        source = inspect.getsource(scene_render_module.execute_scene_video_render)
        assert "save_youtube_scene_video" in source
        assert "video_service.save_scene_video" not in source
        assert ".save_scene_video(" not in source
