"""Video Creator publish service: resolve Creator URLs, empty file, auth, retry.

Creator Render hands ``/api/youtube/videos/<filename>``. The service must
resolve that to a disk file via ``find_youtube_video_file`` and upload it.
Do not invent hits. Hub wedge and Podcast Maker are out of scope.
"""

from __future__ import annotations

import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_creator_publish_tdd"
TOKEN_ID = 7
CREATOR_API_URL = "/api/youtube/videos/final.mp4"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_publish_service import YouTubePublishService

    return YouTubePublishService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _youtube_insert(response: dict | None = None, side_effect=None) -> MagicMock:
    youtube = MagicMock()
    execute = youtube.videos.return_value.insert.return_value.execute
    if side_effect is not None:
        execute.side_effect = side_effect
    else:
        execute.return_value = response or {"id": "vid123"}
    return youtube


def _publish(service, video_source: str, youtube: MagicMock, **kwargs):
    with patch(
        "services.youtube.youtube_publish_service.build",
        return_value=youtube,
    ), patch(
        "services.youtube.youtube_publish_service.MediaFileUpload",
        return_value=MagicMock(name="media"),
    ):
        return service.publish_video(
            user_id=USER_ID,
            token_id=TOKEN_ID,
            video_source=video_source,
            title=kwargs.get("title", "Creator video title"),
            description=kwargs.get("description", ""),
            tags=kwargs.get("tags"),
            privacy_status=kwargs.get("privacy_status", "unlisted"),
            publish_at=kwargs.get("publish_at"),
        )


class TestYouTubePublishServiceAuthAndFile:
    def test_bad_auth_returns_reconnect_error_without_upload(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = _youtube_insert()

        result = _publish(_service(oauth), "/tmp/missing.mp4", youtube)

        assert result["success"] is False
        assert "reconnect" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()

    def test_empty_file_returns_clear_error(self, tmp_path):
        empty = tmp_path / "empty.mp4"
        empty.write_bytes(b"")
        youtube = _youtube_insert()

        result = _publish(_service(_connected_oauth()), str(empty), youtube)

        assert result["success"] is False
        assert "empty" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()

    def test_missing_local_path_returns_not_found(self, tmp_path):
        missing = tmp_path / "does-not-exist.mp4"
        youtube = _youtube_insert()

        result = _publish(_service(_connected_oauth()), str(missing), youtube)

        assert result["success"] is False
        assert "not found" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()


@contextmanager
def _creator_publish_env(youtube: MagicMock, finder: MagicMock):
    with patch(
        "services.youtube.youtube_publish_service.get_session_for_user",
        return_value=None,
    ), patch(
        "services.youtube.youtube_publish_service.find_youtube_video_file",
        finder,
    ), patch(
        "services.youtube.youtube_publish_service.build",
        return_value=youtube,
    ), patch(
        "services.youtube.youtube_publish_service.MediaFileUpload",
        return_value=MagicMock(name="media"),
    ):
        yield


def _called_filename(finder: MagicMock) -> str | None:
    called = finder.call_args
    if not called:
        return None
    if called.kwargs.get("filename") is not None:
        return called.kwargs["filename"]
    if called.args:
        return called.args[0]
    return None


class TestYouTubePublishServiceCreatorUrl:
    def test_resolves_api_youtube_videos_path_and_uploads(self, tmp_path):
        disk_file = tmp_path / "final.mp4"
        disk_file.write_bytes(b"not-empty-mp4-bytes")
        finder = MagicMock(return_value=disk_file)
        youtube = _youtube_insert({"id": "abc123"})

        with patch("os.unlink") as unlink, _creator_publish_env(youtube, finder):
            result = _service(_connected_oauth()).publish_video(
                user_id=USER_ID,
                token_id=TOKEN_ID,
                video_source=CREATOR_API_URL,
                title="Rank Videos in 7 Days",
            )

        assert _called_filename(finder) == "final.mp4"
        assert finder.call_args.kwargs.get("user_id") == USER_ID
        assert result["success"] is True
        assert result["video_id"] == "abc123"
        assert result["video_url"] == "https://youtu.be/abc123"
        youtube.videos.return_value.insert.assert_called_once()
        unlink.assert_not_called()

    def test_strips_query_string_from_creator_api_path(self, tmp_path):
        disk_file = tmp_path / "final.mp4"
        disk_file.write_bytes(b"not-empty-mp4-bytes")
        finder = MagicMock(return_value=disk_file)
        youtube = _youtube_insert({"id": "abc123"})

        with _creator_publish_env(youtube, finder):
            result = _service(_connected_oauth()).publish_video(
                user_id=USER_ID,
                token_id=TOKEN_ID,
                video_source="/api/youtube/videos/final.mp4?token=abc",
                title="Rank Videos in 7 Days",
            )

        assert result["success"] is True
        assert _called_filename(finder) == "final.mp4"

    def test_rejects_path_traversal_in_creator_api_path(self):
        finder = MagicMock()
        youtube = _youtube_insert()

        with _creator_publish_env(youtube, finder):
            result = _service(_connected_oauth()).publish_video(
                user_id=USER_ID,
                token_id=TOKEN_ID,
                video_source="/api/youtube/videos/../secret.mp4",
                title="Creator video title",
            )

        finder.assert_not_called()
        assert result["success"] is False
        assert "not found" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()

    def test_missing_creator_api_file_returns_not_found(self):
        finder = MagicMock(return_value=None)
        youtube = _youtube_insert()

        with _creator_publish_env(youtube, finder):
            result = _service(_connected_oauth()).publish_video(
                user_id=USER_ID,
                token_id=TOKEN_ID,
                video_source=CREATOR_API_URL,
                title="Creator video title",
            )

        finder.assert_called()
        assert result["success"] is False
        assert "not found" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()


class TestYouTubePublishServiceRetry:
    def test_retries_then_succeeds(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert(side_effect=[RuntimeError("429"), {"id": "vid-retry"}])

        with patch("time.sleep"):
            result = _publish(_service(_connected_oauth()), str(video), youtube)

        assert result["success"] is True
        assert result["video_id"] == "vid-retry"
        assert youtube.videos.return_value.insert.return_value.execute.call_count == 2

    def test_exhausted_retries_return_error(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert(
            side_effect=RuntimeError("upload failed"),
        )

        with patch("time.sleep"):
            result = _publish(_service(_connected_oauth()), str(video), youtube)

        assert result["success"] is False
        assert result["error"] == "Upload failed after retries."
        assert youtube.videos.return_value.insert.return_value.execute.call_count == 3
