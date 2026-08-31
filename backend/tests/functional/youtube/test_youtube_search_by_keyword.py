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
    ) -> dict:
        assert user_id
        self.calls.append(
            {
                "user_id": user_id,
                "query": query,
                "max_results": max_results,
                "page_token": page_token,
                "token_id": token_id,
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
