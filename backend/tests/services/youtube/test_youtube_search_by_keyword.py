"""YouTube Data API v3 keyword search (TDD).

Locks ``searchByKeyword`` from Google's Search.list sample:
``Search.list('id,snippet', {q, maxResults})`` then ``item.id.videoId``
and ``item.snippet.title``.

Google is mocked. Empty query, disconnected OAuth, and API failures must
return a clear error with no invented videos.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_search_tdd"


def _youtube_client(payload: dict) -> MagicMock:
    youtube = MagicMock()
    youtube.search.return_value.list.return_value.execute.return_value = payload
    return youtube


def _video_item(video_id: str, title: str) -> dict:
    return {
        "kind": "youtube#searchResult",
        "id": {"kind": "youtube#video", "videoId": video_id},
        "snippet": {"title": title},
    }


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_search_service import YouTubeSearchService

    return YouTubeSearchService(oauth or MagicMock())


class TestYouTubeSearchByKeyword:
    def test_maps_video_id_and_title_from_search_list(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = _youtube_client(
            {
                "items": [_video_item("vid123", "How to train dogs")],
                "nextPageToken": "CAUQAA",
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ) as mock_build:
            result = _service(oauth).search_by_keyword(USER_ID, "dogs")

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]
        assert result["next_page_token"] == "CAUQAA"
        mock_build.assert_called_once()
        assert mock_build.call_args.args[:2] == ("youtube", "v3")
        assert mock_build.call_args.kwargs.get("cache_discovery") is False

        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["q"] == "dogs"
        assert list_kwargs["type"] == "video"
        assert list_kwargs["maxResults"] == 25
        assert "snippet" in list_kwargs["part"]
        assert list_kwargs.get("forMine") in (None, False)
        oauth.get_valid_credentials.assert_called_once_with(USER_ID, None)

    def test_skips_channel_and_playlist_results(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = _youtube_client(
            {
                "items": [
                    {
                        "id": {"kind": "youtube#channel", "channelId": "UCdogs"},
                        "snippet": {"title": "Dog Channel"},
                    },
                    _video_item("only-video", "Real dog video"),
                    {
                        "id": {"kind": "youtube#playlist", "playlistId": "PLdogs"},
                        "snippet": {"title": "Dog playlist"},
                    },
                ]
            }
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).search_by_keyword(USER_ID, "dogs")

        assert result["success"] is True
        assert result["items"] == [
            {"video_id": "only-video", "title": "Real dog video"}
        ]

    def test_empty_google_items_are_empty_not_fake_videos(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = _youtube_client({"items": []})

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).search_by_keyword(USER_ID, "dogs")

        assert result["success"] is True
        assert result["items"] == []
        assert result.get("next_page_token") in (None, "")

    def test_rejects_blank_query_without_calling_google(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")

        with patch("services.youtube.youtube_search_service.build") as mock_build:
            result = _service(oauth).search_by_keyword(USER_ID, "   ")

        assert result["success"] is False
        assert result["error_code"] == "invalid_query"
        assert result["items"] == []
        mock_build.assert_not_called()
        oauth.get_valid_credentials.assert_not_called()

    def test_not_connected_returns_error_without_fake_items(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None

        with patch("services.youtube.youtube_search_service.build") as mock_build:
            result = _service(oauth).search_by_keyword(USER_ID, "dogs")

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        assert result["items"] == []
        assert "video_id" not in result
        mock_build.assert_not_called()

    def test_google_failure_returns_error_without_fake_items(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = MagicMock()
        youtube.search.return_value.list.return_value.execute.side_effect = RuntimeError(
            "quotaExceeded"
        )

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).search_by_keyword(USER_ID, "dogs")

        assert result["success"] is False
        assert result["error_code"] == "search_failed"
        assert result["items"] == []

    def test_caps_max_results_at_youtube_limit_and_forwards_page_token(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = _youtube_client({"items": [_video_item("v1", "Title")]})

        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).search_by_keyword(
                USER_ID,
                "dogs",
                max_results=100,
                page_token="CAUQAA",
                token_id=7,
            )

        assert result["success"] is True
        list_kwargs = youtube.search.return_value.list.call_args.kwargs
        assert list_kwargs["maxResults"] == 50
        assert list_kwargs["pageToken"] == "CAUQAA"
        oauth.get_valid_credentials.assert_called_once_with(USER_ID, 7)


def _search_list_http_error(reason: str, status: int = 400):
    """Build a Search.list HttpError with YouTube's error.errors[].reason payload.

    Pytest conftest may stub googleapiclient.errors.HttpError as a bare
    Exception, so always set ``resp`` and ``content`` after construction.
    """
    import json
    from types import SimpleNamespace

    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": reason,
            "errors": [{"reason": reason, "domain": "youtube.parameter"}],
        }
    }
    content = json.dumps(body).encode()
    resp = SimpleNamespace(status=status, reason="Bad Request")
    try:
        exc = HttpError(resp, content)
    except Exception:
        exc = HttpError()
    exc.resp = resp
    exc.content = content
    return exc


class TestYouTubeSearchListDocumentedErrors:
    """Search.list error table: https://developers.google.com/youtube/v3/docs/search/list"""

    def _run(self, reason: str, status: int = 400) -> dict:
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = MagicMock(name="creds")
        youtube = MagicMock()
        youtube.search.return_value.list.return_value.execute.side_effect = (
            _search_list_http_error(reason, status)
        )
        with patch(
            "services.youtube.youtube_search_service.build",
            return_value=youtube,
        ):
            return _service(oauth).search_by_keyword(USER_ID, "dogs")

    def test_invalid_channel_id_returns_documented_error_without_fake_items(self):
        result = self._run("invalidChannelId")
        assert result["success"] is False
        assert result["error_code"] == "invalidChannelId"
        assert "channel ID" in result["message"]
        assert result["items"] == []

    def test_invalid_location_returns_documented_error_without_fake_items(self):
        result = self._run("invalidLocation")
        assert result["success"] is False
        assert result["error_code"] == "invalidLocation"
        assert "location" in result["message"].lower()
        assert result["items"] == []

    def test_invalid_relevance_language_returns_documented_error_without_fake_items(self):
        result = self._run("invalidRelevanceLanguage")
        assert result["success"] is False
        assert result["error_code"] == "invalidRelevanceLanguage"
        assert "relevanceLanguage" in result["message"]
        assert result["items"] == []

    def test_invalid_search_filter_returns_documented_error_without_fake_items(self):
        result = self._run("invalidSearchFilter")
        assert result["success"] is False
        assert result["error_code"] == "invalidSearchFilter"
        assert "type" in result["message"].lower()
        assert result["items"] == []

    def test_unmapped_google_http_error_stays_search_failed_without_fake_items(self):
        result = self._run("quotaExceeded", status=403)
        assert result["success"] is False
        assert result["error_code"] == "search_failed"
        assert result["items"] == []

