"""TDD: thumbnails.set media POST after processing wait."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYouTubeThumbnailsSetMediaUpload:
    def test_upload_url_uses_documented_media_post(self):
        from services.youtube.youtube_publish_thumbnail_set import youtube_thumbnails_set_upload_url

        url = youtube_thumbnails_set_upload_url("abc123")
        assert url.startswith("https://www.googleapis.com/upload/youtube/v3/thumbnails/set?")
        assert "videoId=abc123" in url
        assert "uploadType=media" in url

    def test_posts_image_bytes_and_png_content_type(self, tmp_path):
        from services.youtube.youtube_publish_thumbnail_set import execute_youtube_thumbnails_set_media

        thumb = tmp_path / "cover.png"
        thumb.write_bytes(b"png-file-bytes")
        youtube = MagicMock()
        youtube._http.request.return_value = (
            {"status": 200},
            json.dumps(
                {
                    "kind": "youtube#thumbnailSetResponse",
                    "items": [{"high": {"url": "https://i.ytimg.com/vi/example/hqdefault.jpg"}}],
                }
            ).encode(),
        )

        payload = execute_youtube_thumbnails_set_media(youtube, "vid-http", thumb)

        assert payload["kind"] == "youtube#thumbnailSetResponse"
        args, kwargs = youtube._http.request.call_args
        assert "uploadType=media" in args[0]
        assert "videoId=vid-http" in args[0]
        assert kwargs["method"] == "POST"
        assert kwargs["body"] == b"png-file-bytes"
        assert kwargs["headers"]["Content-Type"] == "image/png"


class TestYouTubeVideoProcessingReady:
    def test_succeeded_processing_status_is_ready(self):
        from services.youtube.youtube_publish_thumbnail_set import youtube_video_processing_is_ready

        assert youtube_video_processing_is_ready(
            {"items": [{"processingDetails": {"processingStatus": "succeeded"}}]}
        ) is True
        assert youtube_video_processing_is_ready(
            {"items": [{"processingDetails": {"processingStatus": "processing"}}]}
        ) is False
        assert youtube_video_processing_is_ready({"items": []}) is False
        assert youtube_video_processing_is_ready(
            {"items": [{"status": {"uploadStatus": "processed"}}]}
        ) is False


class TestYouTubeThumbnailSetResponseApplied:
    def test_kind_is_required_urls_are_not(self):
        from services.youtube.youtube_publish_thumbnail_set import youtube_thumbnail_set_was_applied

        assert youtube_thumbnail_set_was_applied(None) is False
        assert youtube_thumbnail_set_was_applied({}) is False
        assert youtube_thumbnail_set_was_applied({"items": []}) is False
        assert youtube_thumbnail_set_was_applied({"kind": "youtube#thumbnailSetResponse"}) is True
        assert youtube_thumbnail_set_was_applied(
            {"kind": "youtube#thumbnailSetResponse", "items": []}
        ) is True


class TestYouTubeThumbnailApiErrorHelpers:
    def _http_error(self, reason: str, status: int = 400):
        from types import SimpleNamespace

        from googleapiclient.errors import HttpError

        body = {
            "error": {
                "code": status,
                "message": reason,
                "errors": [{"reason": reason, "domain": "youtube.thumbnail"}],
            }
        }
        content = json.dumps(body).encode()
        resp = SimpleNamespace(status=status, reason=reason)
        try:
            exc = HttpError(resp, content)
        except Exception:
            exc = HttpError()
        exc.resp = resp
        exc.content = content
        return exc

    def test_retryable_on_video_not_found(self):
        from services.youtube.youtube_publish_thumbnail_set import youtube_thumbnail_set_is_retryable

        exc = self._http_error("videoNotFound", status=404)
        assert youtube_thumbnail_set_is_retryable(exc) is True

    def test_not_retryable_on_forbidden(self):
        from services.youtube.youtube_publish_thumbnail_set import youtube_thumbnail_set_is_retryable

        exc = self._http_error("forbidden", status=403)
        assert youtube_thumbnail_set_is_retryable(exc) is False

    def test_user_message_for_forbidden_mentions_verification(self):
        from services.youtube.youtube_publish_thumbnail_set import user_safe_thumbnail_set_error

        exc = self._http_error("forbidden", status=403)
        message = user_safe_thumbnail_set_error(exc, duration_type="shorts")
        assert "phone number" in message.lower()


class TestApplyYouTubePublishThumbnail:
    def _ready_youtube(self) -> MagicMock:
        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.return_value = {
            "items": [{"processingDetails": {"processingStatus": "succeeded"}}]
        }
        youtube._http.request.return_value = (
            {"status": 200},
            json.dumps({"kind": "youtube#thumbnailSetResponse"}).encode(),
        )
        return youtube

    def test_retries_after_http_404_then_succeeds(self, tmp_path):
        from services.youtube.youtube_publish_thumbnail_set import apply_youtube_publish_thumbnail

        thumb = tmp_path / "thumb.jpg"
        thumb.write_bytes(b"jpeg-bytes")
        youtube = self._ready_youtube()
        youtube._http.request.side_effect = [
            (
                {"status": 404},
                json.dumps({"error": {"errors": [{"reason": "videoNotFound"}]}}).encode(),
            ),
            (
                {"status": 200},
                json.dumps({"kind": "youtube#thumbnailSetResponse"}).encode(),
            ),
        ]
        sleeps: list[float] = []

        result = apply_youtube_publish_thumbnail(
            youtube,
            video_id="short-vid",
            thumbnail_path=thumb,
            duration_type="shorts",
            sleeper=lambda seconds: sleeps.append(seconds),
        )

        assert result["applied"] is True
        assert result["error"] is None
        assert youtube._http.request.call_count == 2
        youtube.thumbnails.return_value.set.assert_not_called()
        assert sleeps == [3]

    def test_missing_kind_response_is_not_applied(self, tmp_path):
        from services.youtube.youtube_publish_thumbnail_set import apply_youtube_publish_thumbnail

        thumb = tmp_path / "thumb.jpg"
        thumb.write_bytes(b"jpeg-bytes")
        youtube = self._ready_youtube()
        youtube._http.request.return_value = (
            {"status": 200},
            json.dumps({"items": []}).encode(),
        )
        sleeps: list[float] = []

        result = apply_youtube_publish_thumbnail(
            youtube,
            video_id="vid-empty",
            thumbnail_path=thumb,
            duration_type="medium",
            sleeper=lambda seconds: sleeps.append(seconds),
        )

        assert result["applied"] is False
        assert result["error"]
        assert youtube._http.request.call_count == 4
        assert sleeps == [3, 6, 10]

    def test_reports_wait_and_cover_progress(self, tmp_path):
        from services.youtube.youtube_publish_thumbnail_set import apply_youtube_publish_thumbnail

        thumb = tmp_path / "cover.jpg"
        thumb.write_bytes(b"jpeg-bytes")
        youtube = self._ready_youtube()
        messages: list[str] = []

        result = apply_youtube_publish_thumbnail(
            youtube,
            video_id="vid-progress",
            thumbnail_path=thumb,
            duration_type="medium",
            sleeper=lambda _seconds: None,
            on_progress=messages.append,
        )

        assert result["applied"] is True
        assert "Waiting for YouTube to finish preparing the video..." in messages
        assert "Adding your cover picture..." in messages


class TestYouTubeThumbnailResolveAndSave:
    def test_rejects_file_outside_thumbnails_dir(self, tmp_path, monkeypatch):
        from services.youtube import youtube_publish_thumbnail as mod

        images = tmp_path / "youtube_images"
        (images / "thumbnails").mkdir(parents=True)
        monkeypatch.setattr(mod, "YOUTUBE_IMAGES_DIR", images)
        outsider = tmp_path / "secret.jpg"
        outsider.write_bytes(b"jpeg-bytes")
        assert mod.resolve_youtube_thumbnail_file(str(outsider)) is None

    def test_rejects_unexpected_filename_in_thumbnails_dir(self, tmp_path, monkeypatch):
        from services.youtube import youtube_publish_thumbnail as mod

        images = tmp_path / "youtube_images"
        thumbs = images / "thumbnails"
        thumbs.mkdir(parents=True)
        monkeypatch.setattr(mod, "YOUTUBE_IMAGES_DIR", images)
        other = thumbs / "not-ours.jpg"
        other.write_bytes(b"jpeg-bytes")
        assert mod.resolve_youtube_thumbnail_file(str(other)) is None

    def test_process_saves_valid_landscape_jpeg(self, tmp_path, monkeypatch):
        from io import BytesIO

        from PIL import Image

        from services.youtube import youtube_publish_thumbnail as mod

        images = tmp_path / "youtube_images"
        monkeypatch.setattr(mod, "YOUTUBE_IMAGES_DIR", images)
        monkeypatch.setattr(mod, "ensure_youtube_media_dirs", lambda _user_id: None)
        buffer = BytesIO()
        Image.new("RGB", (1280, 720), "red").save(buffer, format="JPEG")

        saved = Path(
            mod.process_youtube_publish_thumbnail_upload(
                image_bytes=buffer.getvalue(),
                content_type="image/jpeg",
                filename="cover.jpg",
                duration_type="medium",
                user_id="user_thumb_tdd",
            )
        )

        assert saved.is_file()
        assert saved.name.startswith("yt_publish_thumb_")
        assert saved.suffix == ".jpg"
        assert mod.resolve_youtube_thumbnail_file(str(saved)) == saved.resolve()

    def test_process_rejects_empty_bytes(self):
        import pytest

        from services.youtube.youtube_publish_thumbnail import (
            process_youtube_publish_thumbnail_upload,
        )

        with pytest.raises(ValueError, match="JPEG or PNG"):
            process_youtube_publish_thumbnail_upload(
                image_bytes=b"",
                content_type="image/jpeg",
                filename="cover.jpg",
                duration_type="medium",
                user_id="user_thumb_tdd",
            )
