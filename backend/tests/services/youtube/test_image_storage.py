"""
Tests for YouTube image storage helpers.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestGetYouTubeImageDir:
    def test_uses_user_workspace_media_youtube_images(self, tmp_path):
        from services.youtube.image_storage import get_youtube_image_dir

        workspace_path = tmp_path / "user_ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            result = get_youtube_image_dir(user_id="user_abc", db=mock_db)

        expected = workspace_path / "media" / "youtube_images"
        assert result == expected
        assert expected.exists()

    def test_falls_back_to_global_dir_without_workspace(self):
        from api.youtube.paths import YOUTUBE_IMAGES_DIR
        from services.youtube.image_storage import get_youtube_image_dir

        result = get_youtube_image_dir(user_id=None, db=None)
        assert result == YOUTUBE_IMAGES_DIR


class TestFindYouTubeImageFile:
    def test_finds_in_canonical_dir(self, tmp_path):
        from services.youtube import image_storage as storage

        workspace_path = tmp_path / "ws"
        image_dir = workspace_path / "media" / "youtube_images"
        image_dir.mkdir(parents=True)
        filename = "yt_scene_abc12345.png"
        (image_dir / filename).write_bytes(b"pngdata")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_image_file(filename, user_id="user_abc", db=mock_db)

        assert found is not None
        assert found.name == filename

    def test_rejects_path_traversal_filename(self):
        from services.youtube.image_storage import find_youtube_image_file

        assert find_youtube_image_file("../etc/passwd", user_id="u", db=None) is None
        assert find_youtube_image_file("a/b.png", user_id="u", db=None) is None

    def test_returns_none_when_missing(self, tmp_path):
        from services.youtube import image_storage as storage

        workspace_path = tmp_path / "ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_image_file(
                "missing_scene.png", user_id="user_missing", db=mock_db
            )

        assert found is None
