"""TDD: YouTube Search.list TYPE filter (Videos, Shorts, Channels, Playlists, Movies).

Google has no Search.list ``type=shorts``. Documented mappings:

- videos    → type=video
- shorts    → type=video + videoDuration=short (hashtag keep stays on Hub)
- channel   → type=channel
- playlist  → type=playlist
- movie     → type=video + videoType=movie

Channels/playlists must map channelId/playlistId — never invent a video_id.
This slice is tests only; search_by_keyword does not take search_type yet.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_type_tdd"


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


class TestYouTubeSearchTypeFilters:
    def test_videos_uses_search_list_type_video(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "vid123"},
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
                search_type="videos",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert "videoType" not in list_kwargs
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]

    def test_shorts_uses_type_video_and_video_duration_short(self):
        youtube = _youtube_client({"items": []})

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "goa",
                search_type="shorts",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "short"
        assert result["items"] == []

    def test_channel_uses_type_channel_and_maps_channel_id(self):
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
                search_type="channel",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "channel"
        assert result["items"] == [
            {"channel_id": "UCdogs", "title": "Dog Channel"}
        ]
        assert "video_id" not in result["items"][0]

    def test_playlist_uses_type_playlist_and_maps_playlist_id(self):
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
                search_type="playlist",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "playlist"
        assert result["items"] == [
            {"playlist_id": "PLdogs", "title": "Dog playlist"}
        ]
        assert "video_id" not in result["items"][0]

    def test_movie_uses_type_video_and_video_type_movie(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#video", "videoId": "movie1"},
                        "snippet": {"title": "A Dog Movie"},
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
                search_type="movie",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoType"] == "movie"
        assert result["items"] == [
            {"video_id": "movie1", "title": "A Dog Movie"}
        ]

    def test_empty_type_results_are_empty_not_fake_hits(self):
        youtube = _youtube_client({"items": []})

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                search_type="channel",
            )

        assert result["success"] is True
        assert result["items"] == []
        assert "video_id" not in result
        assert "channel_id" not in result
