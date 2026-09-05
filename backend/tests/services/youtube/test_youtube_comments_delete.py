"""YouTube Comments.delete for HITL delete of the creator's own replies.

https://developers.google.com/youtube/v3/docs/comments/delete
Quota 50. DELETE id only. No request body. Inbox must not call delete.
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

USER_ID = "user_yt_comment_delete"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_comments_service import YouTubeCommentsService

    return YouTubeCommentsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _http_error(reason: str, status: int) -> Exception:
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


def _inbox_youtube() -> MagicMock:
    youtube = MagicMock()
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [{"id": "UC123"}]
    }
    youtube.commentThreads.return_value.list.return_value.execute.return_value = {
        "items": []
    }
    youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
    return youtube


class TestInboxDoesNotCallCommentsDelete:
    def test_inbox_does_not_delete(self):
        youtube = _inbox_youtube()
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)
        assert result["success"] is True
        youtube.comments.return_value.delete.assert_not_called()

    def test_update_does_not_delete(self):
        youtube = MagicMock()
        youtube.comments.return_value.update.return_value.execute.return_value = {
            "id": "r-1",
            "snippet": {"textOriginal": "Thanks"},
        }
        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="Thanks"
            )
        assert result["success"] is True
        youtube.comments.return_value.delete.assert_not_called()

    def test_insert_does_not_delete(self):
        youtube = MagicMock()
        youtube.comments.return_value.insert.return_value.execute.return_value = {
            "id": "r-new",
            "snippet": {"textOriginal": "Thanks"},
        }
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text="Thanks"
            )
        assert result["success"] is True
        youtube.comments.return_value.delete.assert_not_called()

    def test_list_replies_does_not_delete(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "UC123"}]
        }
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "items": []
        }
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(
                USER_ID, parent_id="c-1"
            )
        assert result["success"] is True
        youtube.comments.return_value.delete.assert_not_called()


class TestDeleteReplyFollowsCommentsDeleteDocs:
    def test_deletes_by_id_without_body(self):
        youtube = MagicMock()
        youtube.comments.return_value.delete.return_value.execute.return_value = b""

        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="r-1"
            )

        assert result["success"] is True
        kwargs = youtube.comments.return_value.delete.call_args.kwargs
        assert kwargs["id"] == "r-1"
        assert "body" not in kwargs
        assert "parentId" not in kwargs
        youtube.comments.return_value.update.assert_not_called()
        youtube.comments.return_value.insert.assert_not_called()

    def test_logs_quota_and_never_leaks_comment_id(self):
        from services.youtube import youtube_comment_delete as delete_mod

        youtube = MagicMock()
        youtube.comments.return_value.delete.return_value.execute.return_value = b""
        with patch.object(delete_mod.logger, "info") as mock_info, patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="secret-reply-id"
            )
        assert result["success"] is True
        info_templates = " ".join(str(call.args[0]) for call in mock_info.call_args_list)
        info_values = [
            part for call in mock_info.call_args_list for part in call.args[1:]
        ]
        leak_text = " ".join(str(part) for call in mock_info.call_args_list for part in call.args)
        assert "quota_cost={}" in info_templates
        assert 50 in info_values
        assert "secret-reply-id" not in leak_text

    def test_empty_comment_id_does_not_call_youtube(self):
        youtube = MagicMock()
        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="  "
            )
        assert result["success"] is False
        assert result["error_code"] == "comment_id_required"
        youtube.comments.return_value.delete.assert_not_called()

    def test_not_connected_does_not_delete(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = MagicMock()
        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(oauth).delete_reply(USER_ID, comment_id="r-1")
        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        youtube.comments.return_value.delete.assert_not_called()


class TestDeleteReplyDocumentedErrors:
    def test_documented_reasons_are_user_safe(self):
        cases = {
            "processingFailure": (400, "could not process that delete"),
            "forbidden": (403, "would not delete that comment"),
            "commentNotFound": (404, "could not be found"),
        }
        for reason, (status, needle) in cases.items():
            youtube = MagicMock()
            youtube.comments.return_value.delete.return_value.execute.side_effect = (
                _http_error(reason, status)
            )
            with patch(
                "services.youtube.youtube_comment_delete.build",
                return_value=youtube,
            ):
                result = _service(_connected_oauth()).delete_reply(
                    USER_ID, comment_id="r-1"
                )
            assert result["success"] is False, reason
            assert result["error_code"] == reason
            assert needle in (result.get("message") or "").lower(), reason
            assert "secret-google" not in (result.get("message") or "")

    def test_unmapped_reason_is_generic(self):
        youtube = MagicMock()
        youtube.comments.return_value.delete.return_value.execute.side_effect = (
            _http_error("quotaExceeded", 403)
        )
        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="r-1"
            )
        assert result["success"] is False
        assert result["error_code"] == "delete_failed"
        assert result["message"] == "Could not delete that reply. Please try again."
        assert "secret-google" not in result["message"]

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
        youtube.comments.return_value.delete.return_value.execute.side_effect = http_error
        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="r-1"
            )
        assert result["success"] is False
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")

    def test_auth_failure_asks_to_reconnect_without_leak(self):
        youtube = MagicMock()
        youtube.comments.return_value.delete.return_value.execute.side_effect = (
            _http_error("authError", 401)
        )
        with patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="r-1"
            )
        assert result["success"] is False
        assert "reconnect" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

    def test_failed_delete_logs_reason_without_google_body(self):
        from services.youtube import youtube_comment_delete as delete_mod

        youtube = MagicMock()
        youtube.comments.return_value.delete.return_value.execute.side_effect = (
            _http_error("forbidden", 403)
        )
        with patch.object(delete_mod.logger, "error") as mock_error, patch(
            "services.youtube.youtube_comment_delete.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).delete_reply(
                USER_ID, comment_id="secret-reply-id"
            )
        assert result["success"] is False
        error_args = mock_error.call_args.args
        leak_text = " ".join(str(part) for part in error_args)
        assert "quota_cost={}" in str(error_args[0])
        assert 50 in error_args
        assert "forbidden" in error_args
        assert 403 in error_args
        assert "secret-reply-id" not in leak_text
        assert "secret-google" not in leak_text
