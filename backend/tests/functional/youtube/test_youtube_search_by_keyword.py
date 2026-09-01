"""Functional journey: authenticated Creator Studio keyword search.

Exercises GET /api/youtube/search used by the Hub search bar.
Google Search.list is not called; the search service is stubbed so this
suite validates HTTP wiring, not live YouTube quota.
"""

from __future__ import annotations

import pytest

from tests.api.youtube_studio_test_client import youtube_studio_client
from tests.framework.http import assert_status

pytestmark = [pytest.mark.functional]


class _StudioYouTubeSearchStub:
    """In-memory stand-in for YouTubeSearchService across one search journey."""

    def __init__(self) -> None:
        self.connected = True
        self.calls: list[dict] = []

    def search_by_keyword(
        self,
        user_id: str,
        query: str,
        max_results: int = 25,
        page_token: str | None = None,
        token_id: int | None = None,
        order: str | None = None,
        event_type: str | None = None,
        video_duration: str | None = None,
        search_type: str | None = None,
        upload_date: str | None = None,
        time_zone: str | None = None,
        video_feature: str | None = None,
    ) -> dict:
        assert user_id
        self.calls.append(
            {
                "user_id": user_id,
                "query": query,
                "max_results": max_results,
                "page_token": page_token,
                "token_id": token_id,
                "order": order,
                "event_type": event_type,
                "video_duration": video_duration,
                "upload_date": upload_date,
                "time_zone": time_zone,
                "video_feature": video_feature,
            }
        )
        if not self.connected:
            return {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube to search videos.",
                "items": [],
            }
        stripped = (query or "").strip()
        if not stripped:
            return {
                "success": False,
                "error_code": "invalid_query",
                "message": "Enter a search keyword.",
                "items": [],
            }
        return {
            "success": True,
            "items": [{"video_id": "vid-dogs", "title": "Dogs 101"}],
            "next_page_token": None,
        }


def _client(stub: _StudioYouTubeSearchStub):
    from api.youtube.search_router import get_search_service

    return youtube_studio_client({get_search_service: lambda: stub})


class TestYouTubeSearchByKeywordJourney:
    def test_keyword_search_returns_video_results(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp = client.get("/api/youtube/search", params={"q": "dogs"})
        assert_status(resp, 200)
        body = resp.json()
        assert body["success"] is True
        assert body["items"][0]["video_id"] == "vid-dogs"
        assert body["items"][0]["title"] == "Dogs 101"
        assert stub.calls[0]["query"] == "dogs"
        assert stub.calls[0]["user_id"] == "user_studio_hardening"

    def test_disconnected_search_does_not_invent_videos(self):
        stub = _StudioYouTubeSearchStub()
        stub.connected = False
        client = _client(stub)

        resp = client.get("/api/youtube/search", params={"q": "dogs"})
        assert_status(resp, 200)
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "not_connected"
        assert body["items"] == []

    def test_missing_keyword_is_rejected(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp = client.get("/api/youtube/search")
        assert_status(resp, 422)
        assert stub.calls == []

    def test_forwards_search_list_filter_params(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp = client.get(
            "/api/youtube/search",
            params={
                "q": "goa",
                "order": "date",
                "event_type": "live",
                "video_duration": "short",
            },
        )
        assert_status(resp, 200)
        call = stub.calls[0]
        assert call["query"] == "goa"
        assert call["order"] == "date"
        assert call["event_type"] == "live"
        assert call["video_duration"] == "short"

    def test_forwards_video_duration_medium_and_long(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp_medium = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "video_duration": "medium"},
        )
        resp_long = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "video_duration": "long"},
        )
        assert_status(resp_medium, 200)
        assert_status(resp_long, 200)
        assert stub.calls[0]["video_duration"] == "medium"
        assert stub.calls[1]["video_duration"] == "long"

    def test_forwards_upload_date(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp_today = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "upload_date": "today"},
        )
        resp_week = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "upload_date": "week"},
        )
        resp_month = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "upload_date": "month"},
        )
        resp_year = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "upload_date": "year"},
        )
        assert_status(resp_today, 200)
        assert_status(resp_week, 200)
        assert_status(resp_month, 200)
        assert_status(resp_year, 200)
        assert stub.calls[0]["upload_date"] == "today"
        assert stub.calls[1]["upload_date"] == "week"
        assert stub.calls[2]["upload_date"] == "month"
        assert stub.calls[3]["upload_date"] == "year"

    def test_forwards_upload_date_time_zone(self):
        stub = _StudioYouTubeSearchStub()
        client = _client(stub)

        resp = client.get(
            "/api/youtube/search",
            params={
                "q": "dogs",
                "upload_date": "today",
                "time_zone": "Asia/Kolkata",
            },
        )
        assert_status(resp, 200)
        assert stub.calls[0]["upload_date"] == "today"
        assert stub.calls[0]["time_zone"] == "Asia/Kolkata"
