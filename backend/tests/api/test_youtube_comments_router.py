"""YouTube comments router — HITL inbox/reply error paths, no dummy comments."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.comments_router import get_comments_service
from tests.api.youtube_studio_test_client import youtube_studio_client


class TestYouTubeCommentsRouter:
    def test_inbox_path_is_mounted(self):
        from api.youtube.router import router as youtube_router

        paths = {getattr(r, "path", "") for r in youtube_router.routes}
        assert "/youtube/comments/inbox" in paths
        assert "/youtube/comments/draft-reply" in paths
        assert "/youtube/comments/reply" in paths

    def test_inbox_returns_empty_list_on_not_connected(self):
        service = MagicMock()
        service.list_inbox.return_value = {
            "success": False,
            "error_code": "not_connected",
            "message": "Connect YouTube to load comments.",
            "comments": [],
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.get("/api/youtube/comments/inbox")

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["comments"] == []
        assert "author" not in body

    def test_draft_reply_requires_comment_text(self):
        service = MagicMock()
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post("/api/youtube/comments/draft-reply", json={"comment_text": ""})

        assert resp.status_code == 422
        service.draft_reply.assert_not_called()

    def test_send_reply_returns_service_failure(self):
        service = MagicMock()
        service.send_reply.return_value = {
            "success": False,
            "message": "Connect YouTube to reply.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/reply",
            json={"parent_id": "abc", "text": "Thanks for watching"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body.get("comment_id") is None
