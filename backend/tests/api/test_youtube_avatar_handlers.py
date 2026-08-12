"""
Tests for YouTube avatar handlers.

Covers auth helper, local avatar loading, upload, generate, and regenerate flows.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _user(uid: str = "user_avatar") -> dict:
    return {"id": uid, "email": "a@example.com"}


class TestAvatarHelpers:
    def test_require_authenticated_user(self):
        from api.youtube.handlers.avatar import require_authenticated_user

        assert require_authenticated_user(_user("abc")) == "abc"
        with pytest.raises(HTTPException) as exc:
            require_authenticated_user({})
        assert exc.value.status_code == 401

    def test_load_youtube_image_bytes(self, tmp_path):
        from api.youtube.handlers import avatar as avatar_mod

        image = tmp_path / "avatar.png"
        image.write_bytes(b"png-bytes")
        with patch.object(avatar_mod, "YOUTUBE_AVATARS_DIR", tmp_path):
            data = avatar_mod._load_youtube_image_bytes("/api/youtube/images/avatars/avatar.png")
        assert data == b"png-bytes"

    def test_load_missing_avatar_raises_404(self, tmp_path):
        from api.youtube.handlers import avatar as avatar_mod

        with patch.object(avatar_mod, "YOUTUBE_AVATARS_DIR", tmp_path):
            with pytest.raises(HTTPException) as exc:
                avatar_mod._load_youtube_image_bytes("/api/youtube/images/avatars/missing.png")
        assert exc.value.status_code == 404


class TestUploadAvatar:
    def test_upload_writes_file_and_returns_url(self, tmp_path):
        from api.youtube.handlers import avatar as avatar_mod

        upload = MagicMock(spec=UploadFile)
        upload.filename = "face.png"
        upload.content_type = "image/png"
        upload.read = AsyncMock(return_value=b"avatar-bytes")

        with patch.object(avatar_mod, "YOUTUBE_AVATARS_DIR", tmp_path), \
             patch.object(avatar_mod, "ensure_youtube_media_dirs"), \
             patch.object(avatar_mod, "save_asset_to_library"):
            result = asyncio.run(
                avatar_mod.upload_youtube_avatar(
                    file=upload,
                    project_id="proj1",
                    current_user=_user(),
                    db=MagicMock(),
                )
            )

        assert result["avatar_url"].startswith("/api/youtube/images/avatars/")
        assert result["avatar_filename"].startswith("yt_avatar_proj1_")
        written = list(tmp_path.glob("yt_avatar_proj1_*.png"))
        assert len(written) == 1
        assert written[0].read_bytes() == b"avatar-bytes"

    def test_upload_rejects_large_file(self):
        from api.youtube.handlers import avatar as avatar_mod

        upload = MagicMock(spec=UploadFile)
        upload.filename = "big.png"
        upload.read = AsyncMock(return_value=b"x" * (5 * 1024 * 1024 + 1))

        with patch.object(avatar_mod, "ensure_youtube_media_dirs"):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(
                    avatar_mod.upload_youtube_avatar(
                        file=upload,
                        project_id=None,
                        current_user=_user(),
                        db=MagicMock(),
                    )
                )
        assert exc.value.status_code == 400
        assert "5MB" in str(exc.value.detail)


class TestGenerateAvatar:
    def test_generate_from_context_writes_avatar(self, tmp_path):
        from api.youtube.handlers import avatar as avatar_mod

        image_result = SimpleNamespace(
            image_bytes=b"generated-png",
            provider="wavespeed",
            model="ideogram-v3-turbo",
        )
        # Force MagicMock (not AsyncMock): conftest may stub generate_image as async.
        mock_generate = MagicMock(return_value=image_result)

        with patch.object(avatar_mod, "YOUTUBE_AVATARS_DIR", tmp_path), \
             patch.object(avatar_mod, "generate_image", new=mock_generate), \
             patch.object(avatar_mod, "save_asset_to_library"):
            result = asyncio.run(
                avatar_mod._generate_avatar_from_context(
                    user_id="user_avatar",
                    project_id="proj1",
                    audience="Creators",
                    content_type="tutorial",
                    brand_style="modern",
                    db=MagicMock(),
                )
            )

        assert result["avatar_url"].startswith("/api/youtube/images/avatars/")
        assert "Avatar generated successfully" in result["message"]
        assert "avatar_prompt" in result
        written = list(tmp_path.glob("yt_generated_proj1_*.png"))
        assert len(written) == 1

    def test_generate_route_delegates_to_context_helper(self):
        from api.youtube.handlers import avatar as avatar_mod

        with patch.object(avatar_mod, "ensure_youtube_media_dirs"), \
             patch.object(
                 avatar_mod,
                 "_generate_avatar_from_context",
                 new=AsyncMock(return_value={"avatar_url": "/x.png"}),
             ) as mock_gen:
            result = asyncio.run(
                avatar_mod.generate_creator_avatar(
                    project_id="p1",
                    audience="a",
                    content_type="tutorial",
                    video_plan_json=None,
                    brand_style="clean",
                    current_user=_user(),
                    db=MagicMock(),
                )
            )

        assert result["avatar_url"] == "/x.png"
        mock_gen.assert_awaited_once()

    def test_regenerate_extracts_plan_context(self):
        from api.youtube.handlers import avatar as avatar_mod

        plan_json = (
            '{"target_audience":"Developers","video_type":"educational",'
            '"visual_style":"clean"}'
        )
        with patch.object(avatar_mod, "ensure_youtube_media_dirs"), \
             patch.object(
                 avatar_mod,
                 "_generate_avatar_from_context",
                 new=AsyncMock(
                     return_value={
                         "avatar_url": "/api/youtube/images/avatars/r.png",
                         "avatar_filename": "r.png",
                         "avatar_prompt": "prompt",
                     }
                 ),
             ) as mock_gen:
            result = asyncio.run(
                avatar_mod.regenerate_creator_avatar(
                    video_plan_json=plan_json,
                    project_id="p1",
                    current_user=_user(),
                    db=MagicMock(),
                )
            )

        assert result["message"] == "Avatar regenerated successfully"
        kwargs = mock_gen.await_args.kwargs
        assert kwargs["audience"] == "Developers"
        assert kwargs["content_type"] == "educational"
        assert kwargs["brand_style"] == "clean"
