"""
Tests for YouTube scene image resolution helpers.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestResolveSceneImageBase64:
    def test_returns_none_for_empty_url(self):
        from services.youtube.scene_image import resolve_scene_image_base64

        assert resolve_scene_image_base64(None, user_id="user_1") is None
        assert resolve_scene_image_base64("", user_id="user_1") is None

    def test_loads_existing_local_image_file(self, tmp_path):
        from services.youtube import image_storage as storage
        from services.youtube.scene_image import resolve_scene_image_base64

        image_dir = tmp_path / "images"
        image_dir.mkdir()
        filename = "yt_scene_scene1_a1b2c3d4.png"
        image_bytes = b"local-png-bytes"
        (image_dir / filename).write_bytes(image_bytes)

        with patch.object(storage, "list_youtube_image_search_dirs", return_value=[image_dir]):
            result = resolve_scene_image_base64(
                f"/api/youtube/images/scenes/{filename}",
                user_id="user_img",
            )

        assert result == base64.b64encode(image_bytes).decode("utf-8")

    def test_falls_back_to_asset_library(self, tmp_path):
        from services.youtube import scene_image as scene_image_mod

        filename = "yt_scene_scene2_e5f6g7h8.png"
        asset_path = tmp_path / filename
        asset_path.write_bytes(b"asset-png")

        mock_asset = SimpleNamespace(filename=filename, file_path=str(asset_path))
        mock_service = MagicMock()
        mock_service.get_user_assets.return_value = ([mock_asset], 1)
        mock_db = MagicMock()

        with patch.object(scene_image_mod, "find_youtube_image_file", return_value=None):
            with patch(
                "services.database.get_session_for_user",
                return_value=mock_db,
            ):
                with patch(
                    "services.content_asset_service.ContentAssetService",
                    return_value=mock_service,
                ):
                    result = scene_image_mod.resolve_scene_image_base64(
                        f"/api/youtube/images/scenes/{filename}",
                        user_id="user_asset",
                    )

        assert result == base64.b64encode(b"asset-png").decode("utf-8")
        mock_db.close.assert_called_once()
