"""YouTube comments router — HITL inbox/reply error paths, no dummy comments."""

from __future__ import annotations

from unittest.mock import MagicMock

from api.youtube.comments_router import get_comments_service
from tests.api.youtube_studio_test_client import youtube_studio_client


class TestYouTubeCommentsRouter:
    def test_inbox_path_is_mounted(self):
        service = MagicMock()
        service.list_inbox.return_value = {"success": True, "comments": []}
        client = youtube_studio_client({get_comments_service: lambda: service})

        inbox = client.get("/api/youtube/comments/inbox")
        draft = client.post(
            "/api/youtube/comments/draft-reply",
            json={"comment_text": "Nice video"},
        )
        reply = client.post(
            "/api/youtube/comments/reply",
            json={"parent_id": "c-1", "text": "Thanks"},
        )

        assert inbox.status_code == 200
        assert draft.status_code == 200
        assert reply.status_code == 200

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

    def test_draft_route_returns_service_failure_without_500(self):
        service = MagicMock()
        service.draft_reply.return_value = {
            "success": False,
            "error_code": "empty_draft",
            "message": "Could not draft a reply. Try again.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/draft-reply",
            json={"comment_text": "Nice video"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "empty_draft"
        assert "Try again" in body["message"]

    def test_send_route_returns_documented_insert_error_without_500(self):
        service = MagicMock()
        service.send_reply.return_value = {
            "success": False,
            "error_code": "parentCommentNotFound",
            "message": "That comment could not be found. It may have been removed.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/reply",
            json={"parent_id": "c-1", "text": "Thanks"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is False
        assert body["error_code"] == "parentCommentNotFound"
        assert "secret" not in (body.get("message") or "").lower()

    def test_inbox_returns_service_comments_including_video_id(self):
        service = MagicMock()
        service.list_inbox.return_value = {
            "success": True,
            "comments": [
                {
                    "comment_id": "c-1",
                    "video_id": "vid-1",
                    "author": "Sam",
                    "text": "Loved the intro",
                }
            ],
            "message": "Loaded 1 recent comments.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.get("/api/youtube/comments/inbox", params={"max_results": 20})

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["comments"][0]["video_id"] == "vid-1"
        assert body["comments"][0]["author"] == "Sam"
        service.list_inbox.assert_called_once()
        assert service.list_inbox.call_args.kwargs["max_results"] == 20

    def test_draft_reply_forwards_comment_text_and_optional_video_title(self):
        service = MagicMock()
        service.draft_reply.return_value = {
            "success": True,
            "draft": "Thanks for watching.",
            "message": "Draft ready for HITL review.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/draft-reply",
            json={
                "comment_text": "How do I start?",
                "video_title": "Rank Videos in 7 Days",
                "channel_niche": "seo",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["draft"] == "Thanks for watching."
        service.draft_reply.assert_called_once()
        kwargs = service.draft_reply.call_args.kwargs
        assert kwargs["comment_text"] == "How do I start?"
        assert kwargs["video_title"] == "Rank Videos in 7 Days"
        assert kwargs["channel_niche"] == "seo"

    def test_send_reply_forwards_parent_id_and_text(self):
        service = MagicMock()
        service.send_reply.return_value = {
            "success": True,
            "comment_id": "reply-9",
            "message": "Reply published.",
        }
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/reply",
            json={"parent_id": "c-1", "text": "Thanks for watching"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["comment_id"] == "reply-9"
        service.send_reply.assert_called_once()
        kwargs = service.send_reply.call_args.kwargs
        assert kwargs["parent_id"] == "c-1"
        assert kwargs["text"] == "Thanks for watching"

    def test_inbox_route_unexpected_error_does_not_leak_detail(self):
        service = MagicMock()
        service.list_inbox.side_effect = RuntimeError("secret-stack")
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.get("/api/youtube/comments/inbox")

        assert resp.status_code == 500
        detail = str(resp.json().get("detail") or "")
        assert "secret-stack" not in detail
        assert "comments" in detail.lower() or "try again" in detail.lower()

    def test_draft_route_unexpected_error_does_not_leak_detail(self):
        service = MagicMock()
        service.draft_reply.side_effect = RuntimeError("llm-secret")
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/draft-reply",
            json={"comment_text": "Nice video"},
        )

        assert resp.status_code == 500
        detail = str(resp.json().get("detail") or "")
        assert "llm-secret" not in detail

    def test_send_route_unexpected_error_does_not_leak_detail(self):
        service = MagicMock()
        service.send_reply.side_effect = RuntimeError("token-secret")
        client = youtube_studio_client({get_comments_service: lambda: service})

        resp = client.post(
            "/api/youtube/comments/reply",
            json={"parent_id": "c-1", "text": "Thanks"},
        )

        assert resp.status_code == 500
        detail = str(resp.json().get("detail") or "")
        assert "token-secret" not in detail
