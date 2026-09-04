"""TDD: Upload custom thumbnail after videos.insert via thumbnails.set.

YouTube accepts JPEG/PNG <= 2MB at any ratio. We require:
- shorts -> 9:16 (1080x1920 target)
- medium/long -> 16:9 (1280x720 target)

No thumbnail -> existing publish path (insert only).
Invalid file -> no insert.
thumbnails.set failure -> video still succeeds with thumbnail_error.

Hub wedge and Podcast Maker are out of scope.
"""

from __future__ import annotations

import json
import sys
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_creator_thumb_tdd"
TOKEN_ID = 7


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_publish_service import YouTubePublishService

    return YouTubePublishService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _thumbnail_set_ok_body() -> bytes:
    return json.dumps(
        {
            "kind": "youtube#thumbnailSetResponse",
            "items": [
                {
                    "default": {"url": "https://i.ytimg.com/vi/example/default.jpg"},
                    "high": {"url": "https://i.ytimg.com/vi/example/hqdefault.jpg"},
                }
            ],
        }
    ).encode()


def _youtube_client(video_id: str = "vid123") -> MagicMock:
    youtube = MagicMock()
    youtube.videos.return_value.insert.return_value.execute.return_value = {"id": video_id}
    youtube.videos.return_value.list.return_value.execute.return_value = {
        "items": [
            {
                "status": {"uploadStatus": "processed"},
                "processingDetails": {"processingStatus": "succeeded"},
            }
        ]
    }
    youtube._http.request.return_value = ({"status": 200}, _thumbnail_set_ok_body())
    return youtube


def _saved_thumb(tmp_path: Path, *, suffix: str = ".jpg", data: bytes = b"jpeg-bytes"):
    images = tmp_path / "youtube_images"
    thumbs = images / "thumbnails"
    thumbs.mkdir(parents=True, exist_ok=True)
    dest = thumbs / f"yt_publish_thumb_tdd{suffix}"
    dest.write_bytes(data)
    return images, dest


def _publish(service, video_source: str, youtube: MagicMock, **kwargs):
    images_dir = kwargs.pop("images_dir", None)
    with ExitStack() as stack:
        stack.enter_context(
            patch(
                "services.youtube.youtube_publish_service.build",
                return_value=youtube,
            )
        )
        stack.enter_context(
            patch(
                "services.youtube.youtube_publish_service.MediaFileUpload",
                return_value=MagicMock(name="media"),
            )
        )
        stack.enter_context(patch("services.youtube.youtube_publish_thumbnail_set.time.sleep"))
        if images_dir is not None:
            stack.enter_context(
                patch(
                    "services.youtube.youtube_publish_thumbnail.YOUTUBE_IMAGES_DIR",
                    images_dir,
                )
            )
        return service.publish_video(
            user_id=USER_ID,
            token_id=TOKEN_ID,
            video_source=video_source,
            title=kwargs.get("title", "Creator video title"),
            description=kwargs.get("description", ""),
            tags=kwargs.get("tags"),
            privacy_status=kwargs.get("privacy_status", "unlisted"),
            thumbnail_path=kwargs.get("thumbnail_path"),
            duration_type=kwargs.get("duration_type", "medium"),
        )


class TestYouTubeThumbnailAspectHelpers:
    def test_duration_type_selects_16_9_or_9_16(self):
        from services.youtube.youtube_publish_thumbnail import (
            YOUTUBE_THUMBNAIL_LANDSCAPE,
            YOUTUBE_THUMBNAIL_SHORTS,
            youtube_thumbnail_aspect_for_duration,
        )

        assert youtube_thumbnail_aspect_for_duration("shorts") == "9:16"
        assert youtube_thumbnail_aspect_for_duration("medium") == "16:9"
        assert youtube_thumbnail_aspect_for_duration("long") == "16:9"
        assert YOUTUBE_THUMBNAIL_LANDSCAPE == {"ratio": "16:9", "width": 1280, "height": 720}
        assert YOUTUBE_THUMBNAIL_SHORTS == {"ratio": "9:16", "width": 1080, "height": 1920}

    def test_ratio_match_accepts_both_youtube_targets(self):
        from services.youtube.youtube_publish_thumbnail import youtube_thumbnail_ratio_matches

        assert youtube_thumbnail_ratio_matches(1280, 720, "16:9") is True
        assert youtube_thumbnail_ratio_matches(1920, 1080, "16:9") is True
        assert youtube_thumbnail_ratio_matches(1080, 1920, "9:16") is True
        assert youtube_thumbnail_ratio_matches(720, 1280, "9:16") is True
        assert youtube_thumbnail_ratio_matches(1280, 720, "9:16") is False
        assert youtube_thumbnail_ratio_matches(1080, 1920, "16:9") is False

    def test_validate_rejects_oversize_wrong_type_and_wrong_ratio(self):
        from services.youtube.youtube_publish_thumbnail import (
            YOUTUBE_THUMBNAIL_MAX_BYTES,
            validate_youtube_publish_thumbnail,
        )

        ok_landscape = validate_youtube_publish_thumbnail(
            mime_type="image/jpeg",
            size_bytes=120_000,
            width=1280,
            height=720,
            duration_type="medium",
        )
        assert ok_landscape["ok"] is True

        ok_shorts = validate_youtube_publish_thumbnail(
            mime_type="image/png",
            size_bytes=200_000,
            width=1080,
            height=1920,
            duration_type="shorts",
        )
        assert ok_shorts["ok"] is True

        assert validate_youtube_publish_thumbnail(
            mime_type="image/jpeg",
            size_bytes=YOUTUBE_THUMBNAIL_MAX_BYTES + 1,
            width=1280,
            height=720,
            duration_type="medium",
        )["ok"] is False
        assert validate_youtube_publish_thumbnail(
            mime_type="image/webp",
            size_bytes=80_000,
            width=1280,
            height=720,
            duration_type="medium",
        )["ok"] is False
        assert validate_youtube_publish_thumbnail(
            mime_type="image/jpeg",
            size_bytes=80_000,
            width=1280,
            height=720,
            duration_type="shorts",
        )["ok"] is False


class TestYouTubePublishRequestThumbnailOptional:
    def test_publish_request_omits_thumbnail_by_default(self):
        from api.youtube.publish_router import PublishRequest

        req = PublishRequest(
            token_id=1,
            video_source="/tmp/video.mp4",
            title="Test video title",
        )
        assert req.thumbnail_path is None
        assert req.duration_type == "medium"

    def test_publish_request_accepts_thumbnail_path_and_shorts_duration(self):
        from api.youtube.publish_router import PublishRequest

        req = PublishRequest(
            token_id=1,
            video_source="/tmp/video.mp4",
            title="Shorts title",
            thumbnail_path="/tmp/thumb.png",
            duration_type="shorts",
        )
        assert req.thumbnail_path == "/tmp/thumb.png"
        assert req.duration_type == "shorts"

    def test_publish_request_rejects_unknown_duration_type(self):
        from api.youtube.publish_router import PublishRequest

        with pytest.raises(ValidationError):
            PublishRequest(
                token_id=1,
                video_source="/tmp/video.mp4",
                title="Bad duration",
                duration_type="vertical",
            )


class TestYouTubePublishServiceThumbnailSet:
    def test_omitted_thumbnail_does_not_call_thumbnails_set(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_client("plain-vid")

        result = _publish(_service(_connected_oauth()), str(video), youtube)

        assert result["success"] is True
        youtube.videos.return_value.insert.assert_called_once()
        youtube.thumbnails.return_value.set.assert_not_called()
        youtube._http.request.assert_not_called()
        assert result.get("thumbnail_error") in (None, "")

    def test_valid_16_9_thumbnail_calls_set_after_insert(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        images, thumb = _saved_thumb(tmp_path)
        youtube = _youtube_client("wide-vid")

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(thumb),
            duration_type="medium",
            images_dir=images,
        )

        assert result["success"] is True
        assert result["video_id"] == "wide-vid"
        youtube.videos.return_value.insert.assert_called_once()
        youtube.thumbnails.return_value.set.assert_not_called()
        assert youtube._http.request.call_count == 1
        args, kwargs = youtube._http.request.call_args
        assert "uploadType=media" in args[0]
        assert "videoId=wide-vid" in args[0]
        assert kwargs["method"] == "POST"
        assert kwargs["body"] == b"jpeg-bytes"
        assert kwargs["headers"]["Content-Type"] == "image/jpeg"
        assert result.get("thumbnail_applied") is True

    def test_waits_until_video_processed_before_thumbnails_set(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        images, thumb = _saved_thumb(tmp_path)
        youtube = _youtube_client("proc-vid")
        order: list[str] = []

        def list_execute(*_args, **_kwargs):
            order.append("list")
            if order.count("list") == 1:
                return {"items": [{"processingDetails": {"processingStatus": "processing"}}]}
            return {"items": [{"processingDetails": {"processingStatus": "succeeded"}}]}

        def http_request(*_args, **_kwargs):
            order.append("set")
            return ({"status": 200}, _thumbnail_set_ok_body())

        youtube.videos.return_value.list.return_value.execute.side_effect = list_execute
        youtube._http.request.side_effect = http_request

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(thumb),
            duration_type="shorts",
            images_dir=images,
        )

        list_kwargs = youtube.videos.return_value.list.call_args.kwargs
        assert "processingDetails" in list_kwargs["part"]
        assert list_kwargs["id"] == "proc-vid"
        assert order.count("list") == 2
        assert order.count("set") == 1
        assert order[-1] == "set"
        assert order.index("list") < order.index("set")
        assert result.get("thumbnail_applied") is True

    def test_missing_kind_is_not_applied(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        images, thumb = _saved_thumb(tmp_path)
        youtube = _youtube_client("empty-items-vid")
        youtube._http.request.return_value = (
            {"status": 200},
            json.dumps({"items": []}).encode(),
        )

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(thumb),
            duration_type="medium",
            images_dir=images,
        )

        assert result["success"] is True
        assert result.get("thumbnail_applied") is False
        assert result.get("thumbnail_error")

    def test_valid_9_16_thumbnail_calls_set_for_shorts(self, tmp_path):
        video = tmp_path / "short.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        images, thumb = _saved_thumb(tmp_path, suffix=".png", data=b"png-bytes")
        youtube = _youtube_client("short-vid")

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(thumb),
            duration_type="shorts",
            images_dir=images,
        )

        assert result["success"] is True
        youtube.thumbnails.return_value.set.assert_not_called()
        assert youtube._http.request.call_count == 1
        args, kwargs = youtube._http.request.call_args
        assert "videoId=short-vid" in args[0]
        assert kwargs["headers"]["Content-Type"] == "image/png"
        assert result.get("thumbnail_applied") is True

    def test_invalid_thumbnail_does_not_insert_video(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_client()

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(tmp_path / "missing.jpg"),
            duration_type="medium",
        )

        assert result["success"] is False
        assert "thumbnail" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()
        youtube.thumbnails.return_value.set.assert_not_called()
        youtube._http.request.assert_not_called()

    def test_thumbnails_set_failure_keeps_video_success(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        images, thumb = _saved_thumb(tmp_path)
        youtube = _youtube_client("ok-vid")
        youtube._http.request.return_value = (
            {"status": 403},
            json.dumps({"error": {"errors": [{"reason": "forbidden"}]}}).encode(),
        )

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            thumbnail_path=str(thumb),
            duration_type="medium",
            images_dir=images,
        )

        assert result["success"] is True
        assert result["video_id"] == "ok-vid"
        assert result.get("thumbnail_error")
        assert result.get("thumbnail_applied") is False
        youtube.videos.return_value.insert.assert_called_once()

