"""
Tests for YouTube audio storage helpers.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestGetYouTubeAudioDir:
    def test_uses_user_workspace_media_youtube_audio(self, tmp_path):
        from services.youtube.audio_storage import get_youtube_audio_dir

        workspace_path = tmp_path / "user_ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            result = get_youtube_audio_dir(user_id="user_abc", db=mock_db)

        expected = workspace_path / "media" / "youtube_audio"
        assert result == expected
        assert expected.exists()

    def test_falls_back_to_global_dir_without_workspace(self):
        from api.youtube.paths import YOUTUBE_AUDIO_DIR
        from services.youtube.audio_storage import get_youtube_audio_dir

        result = get_youtube_audio_dir(user_id=None, db=None)
        assert result == YOUTUBE_AUDIO_DIR


class TestFindYouTubeAudioFile:
    def test_finds_in_canonical_dir(self, tmp_path):
        from services.youtube import audio_storage as storage

        workspace_path = tmp_path / "ws"
        audio_dir = workspace_path / "media" / "youtube_audio"
        audio_dir.mkdir(parents=True)
        filename = "scene_1_title_abcd1234.mp3"
        (audio_dir / filename).write_bytes(b"mp3data")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_audio_file(filename, user_id="user_abc", db=mock_db)

        assert found is not None
        assert found.name == filename

    def test_finds_legacy_repo_root_location(self, tmp_path):
        from services.youtube import audio_storage as storage

        legacy_dir = tmp_path / "legacy_audio"
        legacy_dir.mkdir()
        filename = "scene_2_legacy_deadbeef.mp3"
        (legacy_dir / filename).write_bytes(b"legacy")

        with patch.object(storage, "_LEGACY_YOUTUBE_AUDIO_DIR", legacy_dir):
            found = storage.find_youtube_audio_file(filename, user_id=None, db=None)

        assert found is not None
        assert found == legacy_dir / filename

    def test_rejects_path_traversal_filename(self):
        from services.youtube.audio_storage import find_youtube_audio_file

        assert find_youtube_audio_file("../etc/passwd", user_id="u", db=None) is None
        assert find_youtube_audio_file("a/b.mp3", user_id="u", db=None) is None

    def test_returns_none_when_missing(self, tmp_path):
        from services.youtube import audio_storage as storage

        workspace_path = tmp_path / "ws"
        workspace_path.mkdir()
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            found = storage.find_youtube_audio_file(
                "missing_scene.mp3", user_id="user_missing", db=mock_db
            )

        assert found is None
