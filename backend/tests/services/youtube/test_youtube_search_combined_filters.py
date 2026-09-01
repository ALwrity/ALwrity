"""Combined Search filters: TYPE + Duration + Upload Date + FEATURES.

One Search.list call. Do not invent hits. Do not invent 4K / 360 / Prioritise.

Illegal pairs (strip, never send an invalid mix):

- channel / playlist + Duration or FEATURES → keep type, drop video-only params
- shorts TYPE + overlay Duration → shorts owns videoDuration=short
- Upload Date stays with channel / playlist / video filters
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_combined_tdd"
FROZEN_NOW = datetime(2026, 8, 26, 12, 0, 0, tzinfo=timezone.utc)
PUBLISHED_AFTER_TODAY = "2026-08-26T00:00:00Z"


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


def _search(youtube: MagicMock, **kwargs):
    with patch(
        "services.youtube.youtube_search_service.build",
        return_value=youtube,
    ), patch(
        "services.youtube.youtube_search_service._youtube_search_utc_now",
        return_value=FROZEN_NOW,
        create=True,
    ):
        return _service(_connected_oauth()).search_by_keyword(
            USER_ID,
            "dogs",
            **kwargs,
        )


class TestYouTubeSearchCombinedFilters:
    def test_videos_duration_upload_date_and_hd_in_one_search_list(self):
        youtube = _youtube_client(_video_payload())
        result = _search(
            youtube,
            search_type="videos",
            video_duration="medium",
            upload_date="today",
            video_feature="hd",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "medium"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert list_kwargs["videoDefinition"] == "high"
        assert "publishedBefore" not in list_kwargs
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]

    def test_movie_duration_and_subtitles_in_one_search_list(self):
        youtube = _youtube_client(_video_payload("vidmv", "Movie dogs"))
        result = _search(
            youtube,
            search_type="movie",
            video_duration="long",
            video_feature="subtitles",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoType"] == "movie"
        assert list_kwargs["videoDuration"] == "long"
        assert list_kwargs["videoCaption"] == "closedCaption"
        assert result["items"] == [{"video_id": "vidmv", "title": "Movie dogs"}]

    def test_shorts_keeps_short_duration_and_hd_drops_overlay_long(self):
        youtube = _youtube_client(_video_payload("vidsh", "Dogs #shorts"))
        result = _search(
            youtube,
            search_type="shorts",
            video_duration="long",
            video_feature="hd",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "short"
        assert list_kwargs["videoDefinition"] == "high"
        assert result["items"] == [
            {"video_id": "vidsh", "title": "Dogs #shorts"}
        ]

    def test_channel_keeps_upload_date_and_strips_duration_and_feature(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#channel", "channelId": "UCdogs"},
                        "snippet": {"title": "Dog Channel"},
                    }
                ]
            }
        )
        result = _search(
            youtube,
            search_type="channel",
            video_duration="medium",
            upload_date="today",
            video_feature="hd",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "channel"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert "videoDuration" not in list_kwargs
        assert "videoDefinition" not in list_kwargs
        assert "eventType" not in list_kwargs
        assert result["items"] == [
            {"channel_id": "UCdogs", "title": "Dog Channel"}
        ]

    def test_playlist_keeps_upload_date_and_strips_feature(self):
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {
                            "kind": "youtube#playlist",
                            "playlistId": "PLdogs",
                        },
                        "snippet": {"title": "Dog Playlist"},
                    }
                ]
            }
        )
        result = _search(
            youtube,
            search_type="playlist",
            upload_date="today",
            video_feature="subtitles",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "playlist"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert "videoCaption" not in list_kwargs
        assert result["items"] == [
            {"playlist_id": "PLdogs", "title": "Dog Playlist"}
        ]

    def test_live_feature_and_duration_in_one_search_list(self):
        youtube = _youtube_client(_video_payload("vidlive", "Live dogs"))
        result = _search(
            youtube,
            video_duration="medium",
            video_feature="live",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDuration"] == "medium"
        assert list_kwargs["eventType"] == "live"
        assert result["items"] == [{"video_id": "vidlive", "title": "Live dogs"}]

    def test_3d_and_upload_date_in_one_search_list(self):
        youtube = _youtube_client(_video_payload("vid3d", "3D dogs"))
        result = _search(
            youtube,
            upload_date="today",
            video_feature="3d",
        )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDimension"] == "3d"
        assert list_kwargs["publishedAfter"] == PUBLISHED_AFTER_TODAY
        assert result["items"] == [{"video_id": "vid3d", "title": "3D dogs"}]

    def test_empty_combined_results_are_empty_not_fake_hits(self):
        youtube = _youtube_client({"items": []})
        result = _search(
            youtube,
            search_type="videos",
            video_duration="short",
            upload_date="today",
            video_feature="creative_commons",
        )

        assert result["success"] is True
        assert result["items"] == []
        assert "video_id" not in result

    def test_combined_video_search_does_not_filter_shorts_hashtags(self):
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
        result = _search(
            youtube,
            video_duration="medium",
            video_feature="hd",
            upload_date="today",
        )

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "plain", "title": "How to train dogs"}
        ]


class TestYouTubeSearchCombinedRouter:
    def test_forwards_type_duration_upload_date_and_feature(self):
        from tests.api.youtube_studio_test_client import youtube_studio_client

        def _get_search_service():
            from api.youtube.search_router import get_search_service

            return get_search_service

        service = MagicMock()
        service.search_by_keyword.return_value = {
            "success": True,
            "items": [],
            "next_page_token": None,
        }
        client = youtube_studio_client({_get_search_service(): lambda: service})

        resp = client.get(
            "/api/youtube/search",
            params={
                "q": "dogs",
                "search_type": "videos",
                "video_duration": "medium",
                "upload_date": "today",
                "time_zone": "UTC",
                "video_feature": "hd",
            },
        )
        assert resp.status_code == 200
        kwargs = service.search_by_keyword.call_args.kwargs
        assert kwargs.get("search_type") == "videos"
        assert kwargs.get("video_duration") == "medium"
        assert kwargs.get("upload_date") == "today"
        assert kwargs.get("time_zone") == "UTC"
        assert kwargs.get("video_feature") == "hd"
