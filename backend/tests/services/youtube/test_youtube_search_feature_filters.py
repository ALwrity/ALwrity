"""TDD slice 1: YouTube Search.list FEATURES filter.

Frontend ``video_feature`` ids → documented Search.list video filters
(requires ``type=video``):

- live             → eventType=live
- hd               → videoDefinition=high
- subtitles        → videoCaption=closedCaption
- creative_commons → videoLicense=creativeCommon

Do not invent params for 4K, 360°, VR180, HDR, Location, or Purchased.
3D (videoDimension=3d) is slice 2.

Channel/playlist Search.list cannot take video feature filters.
Do not invent hits. Do not apply Shorts hashtag keep.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_feature_tdd"


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


def _search_with_feature(youtube: MagicMock, video_feature: str):
    with patch(
        "services.youtube.youtube_search_service.build",
        return_value=youtube,
    ):
        return _service(_connected_oauth()).search_by_keyword(
            USER_ID,
            "dogs",
            video_feature=video_feature,
        )


class TestYouTubeSearchFeatureFiltersSlice1:
    def test_live_uses_event_type_live_and_type_video(self):
        youtube = _youtube_client(_video_payload())
        result = _search_with_feature(youtube, "live")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["eventType"] == "live"
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]

    def test_hd_uses_video_definition_high(self):
        youtube = _youtube_client(_video_payload("vidhd", "HD dogs"))
        result = _search_with_feature(youtube, "hd")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoDefinition"] == "high"
        assert result["items"] == [{"video_id": "vidhd", "title": "HD dogs"}]

    def test_subtitles_uses_video_caption_closed_caption(self):
        youtube = _youtube_client(_video_payload("vidcc", "CC dogs"))
        result = _search_with_feature(youtube, "subtitles")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoCaption"] == "closedCaption"
        assert result["items"] == [{"video_id": "vidcc", "title": "CC dogs"}]

    def test_creative_commons_uses_video_license_creative_common(self):
        youtube = _youtube_client(_video_payload("vidcc0", "CC0 dogs"))
        result = _search_with_feature(youtube, "creative_commons")

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "video"
        assert list_kwargs["videoLicense"] == "creativeCommon"
        assert result["items"] == [{"video_id": "vidcc0", "title": "CC0 dogs"}]

    def test_feature_is_stripped_for_channel_search_type(self):
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
                video_feature="hd",
                search_type="channel",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "channel"
        assert "videoDefinition" not in list_kwargs
        assert "eventType" not in list_kwargs
        assert result["items"] == [
            {"channel_id": "UCdogs", "title": "Dog Channel"}
        ]

    def test_feature_is_stripped_for_playlist_search_type(self):
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

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).search_by_keyword(
                USER_ID,
                "dogs",
                video_feature="subtitles",
                search_type="playlist",
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["type"] == "playlist"
        assert "videoCaption" not in list_kwargs
        assert result["items"] == [
            {"playlist_id": "PLdogs", "title": "Dog Playlist"}
        ]

    def test_unsupported_video_feature_is_ignored(self):
        youtube = _youtube_client(_video_payload())
        _search_with_feature(youtube, "4k")
        _search_with_feature(youtube, "360")
        _search_with_feature(youtube, "vr180")
        _search_with_feature(youtube, "hdr")
        _search_with_feature(youtube, "location")
        _search_with_feature(youtube, "purchased")

        for call in youtube.search.return_value.list.call_args_list:
            list_kwargs = call.kwargs
            assert "videoDefinition" not in list_kwargs
            assert "videoCaption" not in list_kwargs
            assert "videoLicense" not in list_kwargs
            assert "videoDimension" not in list_kwargs
            assert list_kwargs.get("eventType") != "4k"

    def test_empty_feature_results_are_empty_not_fake_hits(self):
        youtube = _youtube_client({"items": []})
        result = _search_with_feature(youtube, "hd")

        assert result["success"] is True
        assert result["items"] == []
        assert "video_id" not in result

    def test_feature_does_not_filter_shorts_hashtags(self):
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
        result = _search_with_feature(youtube, "live")

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "plain", "title": "How to train dogs"}
        ]


class TestYouTubeSearchFeatureRouterSlice1:
    def test_forwards_video_feature(self):
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

        ids = ["live", "hd", "subtitles", "creative_commons"]
        for video_feature in ids:
            resp = client.get(
                "/api/youtube/search",
                params={"q": "dogs", "video_feature": video_feature},
            )
            assert resp.status_code == 200

        forwarded = [
            call.kwargs.get("video_feature")
            for call in service.search_by_keyword.call_args_list
        ]
        assert forwarded == ids
