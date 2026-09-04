"""YouTube Comments.insert documented errors for existing HITL send.

https://developers.google.com/youtube/v3/docs/comments/insert

Does not change inbox (CommentThreads.list) or add new send/draft features.
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

USER_ID = "user_yt_comment_insert_docs"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_comments_service import YouTubeCommentsService

    return YouTubeCommentsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _insert_http_error(reason: str, status: int) -> Exception:
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


def _send_result(reason: str, status: int) -> dict:
    youtube = MagicMock()
    youtube.comments.return_value.insert.return_value.execute.side_effect = (
        _insert_http_error(reason, status)
    )
    with patch(
        "services.youtube.youtube_comments_service.build",
        return_value=youtube,
    ):
        return _service(_connected_oauth()).send_reply(
            USER_ID, parent_id="c-1", text="Thanks for watching"
        )


class TestYouTubeCommentsInsertDocumentedErrors:
    def test_comment_text_required(self):
        result = _send_result("commentTextRequired", 400)
        assert result["success"] is False
        assert result["error_code"] == "commentTextRequired"
        assert "required" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_comment_text_too_long(self):
        result = _send_result("commentTextTooLong", 400)
        assert result["success"] is False
        assert result["error_code"] == "commentTextTooLong"
        assert "long" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_invalid_custom_emoji(self):
        result = _send_result("invalidCustomEmoji", 400)
        assert result["success"] is False
        assert result["error_code"] == "invalidCustomEmoji"
        assert "emoji" in (result.get("message") or "").lower()

    def test_invalid_comment_metadata(self):
        result = _send_result("invalidCommentMetadata", 400)
        assert result["success"] is False
        assert result["error_code"] == "invalidCommentMetadata"
        assert "secret-google" not in (result.get("message") or "")

    def test_operation_not_supported(self):
        result = _send_result("operationNotSupported", 400)
        assert result["success"] is False
        assert result["error_code"] == "operationNotSupported"
        assert "reply" in (result.get("message") or "").lower()

    def test_parent_comment_is_private(self):
        result = _send_result("parentCommentIsPrivate", 400)
        assert result["success"] is False
        assert result["error_code"] == "parentCommentIsPrivate"
        assert "private" in (result.get("message") or "").lower()

    def test_parent_id_missing(self):
        result = _send_result("parentIdMissing", 400)
        assert result["success"] is False
        assert result["error_code"] == "parentIdMissing"

    def test_processing_failure(self):
        result = _send_result("processingFailure", 400)
        assert result["success"] is False
        assert result["error_code"] == "processingFailure"
        assert "secret-google" not in (result.get("message") or "")

    def test_forbidden(self):
        result = _send_result("forbidden", 403)
        assert result["success"] is False
        assert result["error_code"] == "forbidden"
        assert "permissions" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_ineligible_account(self):
        result = _send_result("ineligibleAccount", 403)
        assert result["success"] is False
        assert result["error_code"] == "ineligibleAccount"
        assert "account" in (result.get("message") or "").lower()

    def test_parent_comment_not_found(self):
        result = _send_result("parentCommentNotFound", 404)
        assert result["success"] is False
        assert result["error_code"] == "parentCommentNotFound"
        assert "found" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_unmapped_insert_reason_stays_reply_failed_without_leak(self):
        result = _send_result("quotaExceeded", 403)
        assert result["success"] is False
        assert result["error_code"] == "reply_failed"
        assert "quotaExceeded" not in (result.get("message") or "")
        assert "secret-google" not in (result.get("message") or "")

    def test_malformed_google_body_does_not_leak_and_stays_reply_failed(self):
        from googleapiclient.errors import HttpError

        resp = SimpleNamespace(status=400, reason="error")
        try:
            http_error = HttpError(resp, b"not-json <html>secret-stack")
        except Exception:
            http_error = HttpError()
        http_error.resp = resp
        http_error.content = b"not-json <html>secret-stack"

        youtube = MagicMock()
        youtube.comments.return_value.insert.return_value.execute.side_effect = http_error
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "reply_failed"
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")
