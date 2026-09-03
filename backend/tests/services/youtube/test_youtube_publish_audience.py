"""TDD: Video Creator publish audience — Made for Kids and 18+ rating.

Kids True → status.selfDeclaredMadeForKids True.
18+ True → status.contentRating.ytRating ytAgeRestricted.
Both together → error, no YouTube insert.
Legacy call (no age_restricted) → kids False and no contentRating.

Hub wedge and Podcast Maker are out of scope.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_creator_audience_tdd"
TOKEN_ID = 7


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_publish_service import YouTubePublishService

    return YouTubePublishService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _youtube_insert(response: dict | None = None) -> MagicMock:
    youtube = MagicMock()
    youtube.videos.return_value.insert.return_value.execute.return_value = response or {
        "id": "vid123"
    }
    return youtube


def _insert_status(youtube: MagicMock) -> dict:
    return youtube.videos.return_value.insert.call_args.kwargs["body"]["status"]


def _publish(service, video_source: str, youtube: MagicMock, **kwargs):
    publish_kwargs = {
        "user_id": USER_ID,
        "token_id": TOKEN_ID,
        "video_source": video_source,
        "title": kwargs.get("title", "Creator video title"),
        "description": kwargs.get("description", ""),
        "tags": kwargs.get("tags"),
        "privacy_status": kwargs.get("privacy_status", "unlisted"),
        "made_for_kids": kwargs.get("made_for_kids", False),
    }
    if "age_restricted" in kwargs:
        publish_kwargs["age_restricted"] = kwargs["age_restricted"]
    with patch(
        "services.youtube.youtube_publish_service.build",
        return_value=youtube,
    ), patch(
        "services.youtube.youtube_publish_service.MediaFileUpload",
        return_value=MagicMock(name="media"),
    ):
        return service.publish_video(**publish_kwargs)


class TestYouTubePublishServiceAudience:
    def test_made_for_kids_sets_self_declared_made_for_kids(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert({"id": "kids-vid"})

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            made_for_kids=True,
        )

        assert result["success"] is True
        status = _insert_status(youtube)
        assert status["selfDeclaredMadeForKids"] is True
        assert "contentRating" not in status

    def test_age_restricted_sets_yt_age_restricted_rating(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert({"id": "adult-vid"})

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            made_for_kids=False,
            age_restricted=True,
        )

        assert result["success"] is True
        status = _insert_status(youtube)
        assert status["selfDeclaredMadeForKids"] is False
        assert status["contentRating"]["ytRating"] == "ytAgeRestricted"

    def test_made_for_kids_and_age_restricted_together_returns_error(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert()

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
            made_for_kids=True,
            age_restricted=True,
        )

        assert result["success"] is False
        assert result.get("error")
        assert "kids" in result["error"].lower()
        assert "age" in result["error"].lower()
        youtube.videos.return_value.insert.assert_not_called()

    def test_legacy_publish_sends_not_for_kids_and_no_age_rating(self, tmp_path):
        video = tmp_path / "ok.mp4"
        video.write_bytes(b"not-empty-mp4-bytes")
        youtube = _youtube_insert({"id": "legacy-vid"})

        result = _publish(
            _service(_connected_oauth()),
            str(video),
            youtube,
        )

        assert result["success"] is True
        status = _insert_status(youtube)
        assert status["selfDeclaredMadeForKids"] is False
        assert "contentRating" not in status
        assert status.get("contentRating", {}).get("ytRating") != "ytAgeRestricted"
