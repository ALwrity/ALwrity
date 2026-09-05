"""Map commentThreads replies.comments and Comments.list (parentId) per YouTube docs.

https://developers.google.com/youtube/v3/docs/comments/list
Show more uses Comments.list only. Inbox must not N+1 comments.list.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_comment_thread_replies"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_comments_service import YouTubeCommentsService

    return YouTubeCommentsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _reply_resource(
    *,
    comment_id: str,
    author: str,
    text: str,
    published_at: str = "2026-01-02T00:00:00Z",
) -> dict:
    return {
        "id": comment_id,
        "snippet": {
            "authorDisplayName": author,
            "textDisplay": text,
            "publishedAt": published_at,
        },
    }


def _thread_with_replies() -> dict:
    return {
        "id": "thread-1",
        "snippet": {
            "totalReplyCount": 2,
            "canReply": True,
            "topLevelComment": {
                "id": "c-1",
                "snippet": {
                    "videoId": "vid-1",
                    "authorDisplayName": "Sam",
                    "textDisplay": "Loved the intro",
                    "likeCount": 3,
                    "publishedAt": "2026-01-01T00:00:00Z",
                },
            },
        },
        "replies": {
            "comments": [
                _reply_resource(comment_id="r-1", author="Pat", text="Me too"),
                _reply_resource(comment_id="r-2", author="Lee", text="Same here"),
            ]
        },
    }


def _inbox_youtube(threads: list[dict] | None = None) -> MagicMock:
    youtube = MagicMock()
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [{"id": "UC123"}]
    }
    youtube.commentThreads.return_value.list.return_value.execute.return_value = {
        "items": threads if threads is not None else [_thread_with_replies()]
    }
    youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
    return youtube


def _list_http_error(reason: str, status: int) -> Exception:
    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": f"secret-google-{reason}",
            "errors": [{"reason": reason, "domain": "youtube.comment"}],
        }
    }
    content = json.dumps(body).encode()
    resp = SimpleNamespace(status=status, reason="error")
    try:
        exc = HttpError(resp, content)
    except Exception:
        exc = HttpError()
    exc.resp = resp
    exc.content = content
    return exc


class TestMapYoutubeCommentReplies:
    def test_maps_two_thread_replies_without_fake_title(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_thread_replies,
        )

        mapped = map_youtube_thread_replies(_thread_with_replies())

        assert len(mapped) == 2
        assert mapped[0]["comment_id"] == "r-1"
        assert mapped[0]["author"] == "Pat"
        assert mapped[0]["text"] == "Me too"
        assert mapped[1]["comment_id"] == "r-2"
        assert mapped[1]["author"] == "Lee"
        joined = " ".join(row["text"] for row in mapped)
        assert "Untitled" not in joined

    def test_missing_replies_returns_empty_list(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_thread_replies,
        )

        thread = {
            "id": "thread-1",
            "snippet": {"topLevelComment": {"id": "c-1", "snippet": {}}},
        }
        assert map_youtube_thread_replies(thread) == []

    def test_skips_malformed_items_and_duplicate_ids(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_comment_reply_items,
        )

        items = [
            {},
            _reply_resource(comment_id="r-1", author="Pat", text="Me too"),
            _reply_resource(comment_id="r-1", author="Pat", text="dup"),
            {"id": "r-empty", "snippet": {"authorDisplayName": "X"}},
        ]
        mapped = map_youtube_comment_reply_items(items)
        assert [row["comment_id"] for row in mapped] == ["r-1"]

    def test_maps_text_original_when_display_missing(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_comment_reply_items,
        )

        mapped = map_youtube_comment_reply_items(
            [
                {
                    "id": "r-1",
                    "snippet": {
                        "authorDisplayName": "Pat",
                        "textOriginal": "From original",
                    },
                }
            ]
        )
        assert mapped[0]["text"] == "From original"
        assert mapped[0]["author"] == "Pat"

    def test_non_list_items_and_non_dict_thread_are_empty(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_comment_reply_items,
            map_youtube_thread_replies,
        )

        assert map_youtube_comment_reply_items(None) == []
        assert map_youtube_thread_replies(None) == []
        assert map_youtube_thread_replies([]) == []


class TestListInboxMapsThreadReplies:
    def test_inbox_attaches_replies_and_does_not_call_comments_list(self):
        youtube = _inbox_youtube()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        parent = result["comments"][0]
        assert parent["comment_id"] == "c-1"
        assert parent["author"] == "Sam"
        assert len(parent["replies"]) == 2
        assert parent["replies"][0]["author"] == "Pat"
        assert parent["replies"][0]["text"] == "Me too"
        assert parent["total_reply_count"] == 2
        youtube.comments.return_value.list.assert_not_called()
        youtube.videos.return_value.list.assert_called_once()

    def test_inbox_missing_replies_is_empty_list(self):
        thread = _thread_with_replies()
        del thread["replies"]
        youtube = _inbox_youtube([thread])

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        assert result["comments"][0]["replies"] == []


class TestListRepliesFollowsCommentsListDocs:
    def test_list_replies_uses_parent_id_not_id_filter(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "kind": "youtube#commentListResponse",
            "items": [
                _reply_resource(comment_id="r-3", author="Kim", text="Thanks"),
            ],
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(
                USER_ID, parent_id="c-1", max_results=20
            )

        assert result["success"] is True
        assert result["replies"][0]["comment_id"] == "r-3"
        assert result["replies"][0]["author"] == "Kim"
        kwargs = youtube.comments.return_value.list.call_args.kwargs
        assert kwargs["part"] == "snippet"
        assert kwargs["parentId"] == "c-1"
        assert kwargs["textFormat"] == "plainText"
        assert kwargs["maxResults"] == 20
        assert "id" not in kwargs
        assert "pageToken" not in kwargs
        assert "body" not in kwargs
        youtube.commentThreads.return_value.list.assert_not_called()

    def test_list_replies_defaults_max_results_to_twenty(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "items": []
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is True
        assert result["replies"] == []
        assert youtube.comments.return_value.list.call_args.kwargs["maxResults"] == 20

    def test_list_replies_caps_max_results_at_100(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "items": []
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            _service(_connected_oauth()).list_replies(
                USER_ID, parent_id="c-1", max_results=200
            )

        assert youtube.comments.return_value.list.call_args.kwargs["maxResults"] == 100

    def test_list_replies_not_connected(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        youtube.comments.return_value.list.assert_not_called()

    def test_list_replies_empty_parent_does_not_call_youtube(self):
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="  ")

        assert result["success"] is False
        assert result["error_code"] == "parent_id_required"
        youtube.comments.return_value.list.assert_not_called()


class TestListRepliesDocumentedErrors:
    def test_operation_not_supported(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.side_effect = (
            _list_http_error("operationNotSupported", 400)
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "operationNotSupported"
        assert result["replies"] == []
        assert "secret-google" not in (result.get("message") or "")
        assert "could not list those replies" in (result.get("message") or "").lower()

    def test_forbidden(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.side_effect = (
            _list_http_error("forbidden", 403)
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "forbidden"
        assert "secret-google" not in (result.get("message") or "")

    def test_comment_not_found(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.side_effect = (
            _list_http_error("commentNotFound", 404)
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "commentNotFound"
        assert "could not be found" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_unmapped_reason_is_generic(self):
        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.side_effect = (
            _list_http_error("commentsDisabled", 403)
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "replies_failed"
        assert result["message"] == "Could not load replies. Please try again."
        assert "secret-google" not in result["message"]
        assert "disabled" not in result["message"].lower()

    def test_malformed_google_body_does_not_leak(self):
        from googleapiclient.errors import HttpError

        resp = SimpleNamespace(status=400, reason="error")
        try:
            http_error = HttpError(resp, b"not-json <html>secret-stack")
        except Exception:
            http_error = HttpError()
        http_error.resp = resp
        http_error.content = b"not-json <html>secret-stack"

        youtube = MagicMock()
        youtube.comments.return_value.list.return_value.execute.side_effect = http_error

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is False
        assert result["error_code"] == "replies_failed"
        assert result["replies"] == []
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")

