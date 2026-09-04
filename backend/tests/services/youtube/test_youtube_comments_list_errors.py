"""YouTube CommentThreads.list documented errors for existing inbox.

https://developers.google.com/youtube/v3/docs/commentThreads/list

Inbox must use CommentThreads.list (not Comments.list). No new inbox features.
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

USER_ID = "user_yt_comment_threads_list_docs"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_comments_service import YouTubeCommentsService

    return YouTubeCommentsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _list_http_error(reason: str, status: int) -> Exception:
    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": f"secret-google-{reason}",
            "errors": [{"reason": reason, "domain": "youtube.commentThread"}],
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


def _inbox_youtube(*, thread_error: Exception | None = None) -> MagicMock:
    youtube = MagicMock()
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [{"id": "UC123"}]
    }
    execute = youtube.commentThreads.return_value.list.return_value.execute
    if thread_error is not None:
        execute.side_effect = thread_error
    else:
        execute.return_value = {"items": []}
    return youtube


def _inbox_result(reason: str, status: int) -> dict:
    youtube = _inbox_youtube(thread_error=_list_http_error(reason, status))
    with patch(
        "services.youtube.youtube_comments_service.build",
        return_value=youtube,
    ):
        return _service(_connected_oauth()).list_inbox(USER_ID)


class TestYouTubeCommentInboxFollowsCommentThreadsList:
    def test_inbox_calls_comment_threads_not_comments_list(self):
        youtube = _inbox_youtube()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID, max_results=20)

        assert result["success"] is True
        youtube.comments.return_value.list.assert_not_called()
        kwargs = youtube.commentThreads.return_value.list.call_args.kwargs
        assert kwargs["allThreadsRelatedToChannelId"] == "UC123"
        assert "id" not in kwargs
        assert "videoId" not in kwargs
        assert kwargs["maxResults"] == 20
        assert kwargs["order"] == "time"
        assert kwargs["textFormat"] == "plainText"
        assert "snippet" in kwargs["part"]
        assert "body" not in kwargs

    def test_inbox_caps_max_results_at_youtube_limit_of_100(self):
        youtube = _inbox_youtube()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            _service(_connected_oauth()).list_inbox(USER_ID, max_results=200)

        assert youtube.commentThreads.return_value.list.call_args.kwargs["maxResults"] == 100


class TestYouTubeCommentThreadsListDocumentedErrors:
    def test_operation_not_supported(self):
        result = _inbox_result("operationNotSupported", 400)
        assert result["success"] is False
        assert result["error_code"] == "operationNotSupported"
        assert result["comments"] == []
        assert "secret-google" not in (result.get("message") or "")
        assert "filter" in (result.get("message") or "").lower()

    def test_processing_failure(self):
        result = _inbox_result("processingFailure", 400)
        assert result["success"] is False
        assert result["error_code"] == "processingFailure"
        assert "secret-google" not in (result.get("message") or "")

    def test_comments_disabled(self):
        result = _inbox_result("commentsDisabled", 403)
        assert result["success"] is False
        assert result["error_code"] == "commentsDisabled"
        assert "disabled" in (result.get("message") or "").lower()

    def test_forbidden(self):
        result = _inbox_result("forbidden", 403)
        assert result["success"] is False
        assert result["error_code"] == "forbidden"
        assert "permissions" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_channel_not_found(self):
        result = _inbox_result("channelNotFound", 404)
        assert result["success"] is False
        assert result["error_code"] == "channelNotFound"
        assert "channel" in (result.get("message") or "").lower()

    def test_comment_thread_not_found(self):
        result = _inbox_result("commentThreadNotFound", 404)
        assert result["success"] is False
        assert result["error_code"] == "commentThreadNotFound"
        assert "secret-google" not in (result.get("message") or "")

    def test_video_not_found(self):
        result = _inbox_result("videoNotFound", 404)
        assert result["success"] is False
        assert result["error_code"] == "videoNotFound"

    def test_unmapped_reason_stays_inbox_failed_without_leak(self):
        result = _inbox_result("quotaExceeded", 403)
        assert result["success"] is False
        assert result["error_code"] == "inbox_failed"
        assert result["comments"] == []
        assert "quotaExceeded" not in (result.get("message") or "")
        assert "secret-google" not in (result.get("message") or "")

    def test_malformed_google_body_does_not_leak_and_stays_inbox_failed(self):
        from googleapiclient.errors import HttpError

        resp = SimpleNamespace(status=400, reason="error")
        try:
            http_error = HttpError(resp, b"not-json <html>secret-stack")
        except Exception:
            http_error = HttpError()
        http_error.resp = resp
        http_error.content = b"not-json <html>secret-stack"

        youtube = _inbox_youtube(thread_error=http_error)
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "inbox_failed"
        assert result["comments"] == []
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")
