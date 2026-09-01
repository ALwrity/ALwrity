"""TDD: YouTube Search.list DURATION filter.

Documented ``videoDuration`` (requires ``type=video``):

- short  → less than four minutes (UI: Under 4 minutes)
- medium → four to 20 minutes inclusive (UI: 4–20 minutes)
- long   → longer than 20 minutes (UI: Over 20 minutes)

There is no 3-minute Search.list value. Do not invent hits.
Duration short is not TYPE/chip Shorts — no hashtag filtering here.

Channel/playlist Search.list cannot take videoDuration.
This slice is tests only; medium/long are not applied yet.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_duration_tdd"


def _youtube_client(payload: dict) -> MagicMock:
    youtube = MagicMock()
    youtube.search.return_value.list.return_value.execute.return_value = payload
    return youtube


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_search_service import YouTubeSearchService

    return YouTubeSearchService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _video_payload(video_id: str = "vid123", title: str = "How to train dogs") -> dict:
    return {
        "items": [
            {
                "id": {"kind": "youtube#video", "videoId": video_id},
                "snippet": {"title": title},
            }
        ]
    }


class TestYouTubeSearchDurationFilters:
    def test_short_uses_video_duration_short_and_type_video(self):
        youtube = _youtube_client(_video_payload())

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="short",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "short"
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]

    def test_medium_uses_video_duration_medium_and_type_video(self):
        youtube = _youtube_client(_video_payload("vid20", "Twenty minute dogs"))

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="medium",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "medium"
        assert result["items"] == [
            {"video_id": "vid20", "title": "Twenty minute dogs"}
        ]

    def test_long_uses_video_duration_long_and_type_video(self):
        youtube = _youtube_client(_video_payload("vidlong", "Long dog documentary"))

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="long",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "long"
        assert result["items"] == [
            {"video_id": "vidlong", "title": "Long dog documentary"}
        ]

    def test_duration_is_stripped_for_channel_search_type(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {
                            "kind": "youtube#channel",
                            "channelId": "UCdogs",
                        },
                        "snippet": {"title": "Dog Channel"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="medium",
                search_type="channel",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "channel"
        assert "videoDuration" not in list_kwargs
        assert result["items"] == [
            {"channel_id": "UCdogs", "title": "Dog Channel"}
        ]
        assert "video_id" not in result["items"][0]

    def test_duration_is_stripped_for_playlist_search_type(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {
                            "kind": "youtube#playlist",
                            "playlistId": "PLdogs",
                        },
                        "snippet": {"title": "Dog playlist"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="long",
                search_type="playlist",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "playlist"
        assert "videoDuration" not in list_kwargs
        assert result["items"] == [
            {"playlist_id": "PLdogs", "title": "Dog playlist"}
        ]
        assert "video_id" not in result["items"][0]

    def test_unsupported_duration_is_ignored(self):
        youtube = _youtube_client(_video_payload())

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="tiny",
            )

        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert "videoDuration" not in list_kwargs

    def test_empty_duration_results_are_empty_not_fake_hits(self):
        youtube = _youtube_client({"items": []})

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="medium",
            )

        assert result["success"] is True
        assert result["items"] == []
        assert "video_id" not in result

    def test_duration_does_not_filter_shorts_hashtags(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "plain"},
                        "snippet": {"title": "How to train dogs"},
                    }
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_duration="short",
            )

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "plain", "title": "How to train dogs"}
        ]
