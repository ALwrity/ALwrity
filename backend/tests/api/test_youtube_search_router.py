"""YouTube keyword search router HTTP contract (TDD).

GET /api/youtube/search?q= mirrors comments/analytics: auth required,
thin router, no invented search hits. Service is stubbed.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from fastapi import HTTPException

from middleware.auth_middleware import get_current_user
from tests.api.youtube_studio_test_client import youtube_studio_client


def _get_search_service():
    from api.youtube.search_router import get_search_service

    return get_search_service


class TestYouTubeSearchRouterMount:
    def test_search_path_is_mounted(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/search" in paths
        assert "/youtube/youtube/search" not in paths


class TestYouTubeSearchRouter:
    def test_returns_video_id_and_title_for_keyword(self):
        service = MagicMock()
        service.search_by_keyword.return_value = {
            "success": True,
            "items": [{"video_id": "vid123", "title": "How to train dogs"}],
            "next_page_token": "CAUQAA",
        }
        client = youtube_studio_client(
            {_get_search_service(): lambda: service}
        )

        resp = client.get("/api/youtube/search", params={"q": "dogs"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["items"] == [
            {"video_id": "vid123", "title": "How to train dogs"}
        ]
        assert body["next_page_token"] == "CAUQAA"
        service.search_by_keyword.assert_called_once()
        call_kwargs = service.search_by_keyword.call_args
        assert call_kwargs.args[0] == "user_studio_hardening"
        assert call_kwargs.kwargs.get("query") == "dogs" or call_kwargs.args[1] == "dogs"

    def test_missing_query_is_rejected_without_calling_service(self):
        service = MagicMock()
        client = youtube_studio_client(
            {_get_search_service(): lambda: service}
        )

        resp = client.get("/api/youtube/search")

        assert resp.status_code == 422
        service.search_by_keyword.assert_not_called()

    def test_empty_query_is_rejected_without_calling_service(self):
        service = MagicMock()
        client = youtube_studio_client(
            {_get_search_service(): lambda: service}
        )

        resp = client.get("/api/youtube/search", params={"q": ""})

        assert resp.status_code == 422
        service.search_by_keyword.assert_not_called()

    def test_not_connected_returns_empty_items_not_fake_videos(self):
        service = MagicMock()
        service.search_by_keyword.return_value = {
            "success": False,
            "error_code": "not_connected",
            "message": "Connect YouTube to search videos.",
            "items": [],
        }
        client = youtube_studio_client(
            {_get_search_service(): lambda: service}
        )

        resp = client.get("/api/youtube/search", params={"q": "dogs"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["items"] == []
        assert body.get("video_id") is None

    def test_forwards_max_results_and_page_token(self):
        service = MagicMock()
        service.search_by_keyword.return_value = {
            "success": True,
            "items": [],
            "next_page_token": None,
        }
        client = youtube_studio_client(
            {_get_search_service(): lambda: service}
        )

        resp = client.get(
            "/api/youtube/search",
            params={"q": "dogs", "max_results": 10, "page_token": "CAUQAA"},
        )

        assert resp.status_code == 200
        kwargs = service.search_by_keyword.call_args.kwargs
        assert kwargs.get("max_results") == 10
        assert kwargs.get("page_token") == "CAUQAA"

    def test_requires_authentication(self):
        service = MagicMock()

        def _deny():
            raise HTTPException(status_code=401, detail="Authentication required")

        client = youtube_studio_client(
            {
                _get_search_service(): lambda: service,
                get_current_user: _deny,
            }
        )
        resp = client.get("/api/youtube/search", params={"q": "dogs"})
        assert resp.status_code == 401
        service.search_by_keyword.assert_not_called()
