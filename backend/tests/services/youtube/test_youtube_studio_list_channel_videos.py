"""YouTubeStudioOpsService.list_channel_videos — uploads playlist + public stats.

Used by Stale Refresh and Video Performance. No Analytics API.
https://developers.google.com/youtube/v3/docs/playlistItems/list
https://developers.google.com/youtube/v3/docs/videos/list
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_studio_list_videos"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_studio_ops_service import YouTubeStudioOpsService

    return YouTubeStudioOpsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _youtube_uploads(*, playlist_items=None, stats_items=None, no_uploads=False):
    youtube = MagicMock()
    if no_uploads:
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": [{"contentDetails": {"relatedPlaylists": {}}}]
        }
        return youtube
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [
            {"contentDetails": {"relatedPlaylists": {"uploads": "UU123"}}}
        ]
    }
    youtube.playlistItems.return_value.list.return_value.execute.return_value = {
        "items": playlist_items
        if playlist_items is not None
        else [
            {
                "contentDetails": {"videoId": "vid-1"},
                "snippet": {
                    "title": "Rank Videos in 7 Days",
                    "description": "Playlist desc",
                    "publishedAt": "2024-01-01T00:00:00Z",
                    "thumbnails": {"medium": {"url": "https://i.ytimg.com/x.jpg"}},
                },
            }
        ]
    }
    youtube.videos.return_value.list.return_value.execute.return_value = {
        "items": stats_items
        if stats_items is not None
        else [
            {
                "id": "vid-1",
                "statistics": {
                    "viewCount": "1200",
                    "likeCount": "10",
                    "commentCount": "2",
                },
                "snippet": {"tags": ["seo"], "description": "Full description"},
            }
        ]
    }
    return youtube


class TestYouTubeStudioListChannelVideos:
    def test_not_connected_returns_error_without_videos(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        result = _service(oauth).list_channel_videos(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        assert result.get("videos") is None or result.get("videos") == []

    def test_no_uploads_playlist_returns_empty_videos(self):
        youtube = _youtube_uploads(no_uploads=True)
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_channel_videos(USER_ID)

        assert result["success"] is True
        assert result["videos"] == []
        youtube.playlistItems.return_value.list.assert_not_called()

    def test_merges_playlist_snippet_with_public_statistics(self):
        youtube = _youtube_uploads()
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_channel_videos(
                USER_ID, max_results=12
            )

        assert result["success"] is True
        video = result["videos"][0]
        assert video["video_id"] == "vid-1"
        assert video["title"] == "Rank Videos in 7 Days"
        assert video["view_count"] == 1200
        assert video["like_count"] == 10
        assert video["comment_count"] == 2
        assert video["tags"] == ["seo"]
        assert video["description"] == "Full description"
        youtube.playlistItems.return_value.list.assert_called_once()
        pl_kwargs = youtube.playlistItems.return_value.list.call_args.kwargs
        assert pl_kwargs["playlistId"] == "UU123"
        assert pl_kwargs["maxResults"] == 12
        assert pl_kwargs["part"] == "snippet,contentDetails"
        vid_kwargs = youtube.videos.return_value.list.call_args.kwargs
        assert vid_kwargs["part"] == "statistics,snippet"
        assert vid_kwargs["id"] == "vid-1"

    def test_empty_playlist_skips_videos_list(self):
        youtube = _youtube_uploads(playlist_items=[])
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_channel_videos(USER_ID)

        assert result["success"] is True
        assert result["videos"] == []
        youtube.videos.return_value.list.assert_not_called()

    def test_no_channel_returns_error(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": []
        }
        with patch(
            "services.youtube.youtube_studio_ops_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_channel_videos(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "no_channel"

    def test_list_failure_does_not_invent_videos(self):
        oauth = _connected_oauth()
        oauth.get_valid_credentials.side_effect = RuntimeError("quota")
        result = _service(oauth).list_channel_videos(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "list_failed"
        assert result["videos"] == []
