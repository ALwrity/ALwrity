"""YouTube Comments.setModerationStatus for HITL hide comment / hide user.

https://developers.google.com/youtube/v3/docs/comments/setModerationStatus
Quota 50. Always rejected. banAuthor only when hiding the user.
Never comments.delete. Never accept client moderationStatus.
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

USER_ID = "user_yt_comment_moderate"


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


class TestSetModerationStatusFollowsDocs:
    def test_hides_comment_as_rejected_without_ban_author(self):
        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.return_value = (
            b""
        )
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=False
            )
        assert result["success"] is True
        kwargs = youtube.comments.return_value.setModerationStatus.call_args.kwargs
        assert kwargs["id"] == "c-1"
        assert kwargs["moderationStatus"] == "rejected"
        assert kwargs.get("banAuthor") in (None, False)
        youtube.comments.return_value.delete.assert_not_called()

    def test_hides_user_with_ban_author_and_rejected(self):
        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.return_value = (
            b""
        )
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=True
            )
        assert result["success"] is True
        kwargs = youtube.comments.return_value.setModerationStatus.call_args.kwargs
        assert kwargs["id"] == "c-1"
        assert kwargs["moderationStatus"] == "rejected"
        assert kwargs["banAuthor"] is True
        youtube.comments.return_value.delete.assert_not_called()

    def test_quota_constant_is_fifty(self):
        from services.youtube.youtube_comments_set_moderation_errors import (
            YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST,
        )

        assert YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST == 50

    def test_logs_quota_ban_flag_and_never_leaks_comment_id(self):
        from services.youtube import youtube_comment_set_moderation as mod

        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.return_value = (
            b""
        )
        with patch.object(mod.logger, "info") as mock_info, patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="secret-parent-id", ban_author=True
            )
        assert result["success"] is True
        info_templates = " ".join(str(call.args[0]) for call in mock_info.call_args_list)
        info_values = [
            part for call in mock_info.call_args_list for part in call.args[1:]
        ]
        leak_text = " ".join(
            str(part) for call in mock_info.call_args_list for part in call.args
        )
        assert "quota_cost={}" in info_templates
        assert 50 in info_values
        assert True in info_values
        assert "secret-parent-id" not in leak_text

    def test_empty_comment_id_does_not_call_youtube(self):
        youtube = MagicMock()
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="  ", ban_author=False
            )
        assert result["success"] is False
        assert result["error_code"] == "comment_id_required"
        youtube.comments.return_value.setModerationStatus.assert_not_called()

    def test_not_connected_does_not_moderate(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = MagicMock()
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(oauth).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=False
            )
        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        youtube.comments.return_value.setModerationStatus.assert_not_called()


class TestSetModerationDocumentedErrors:
    def test_documented_reasons_are_user_safe(self):
        cases = {
            "processingFailure": (400, "could not process"),
            "forbidden": (403, "would not hide"),
            "commentNotFound": (404, "could not be found"),
            "banWithoutReject": (400, "hide that user"),
            "operationNotSupported": (400, "cannot moderate"),
        }
        for reason, (status, needle) in cases.items():
            youtube = MagicMock()
            youtube.comments.return_value.setModerationStatus.return_value.execute.side_effect = (
                _http_error(reason, status)
            )
            with patch(
                "services.youtube.youtube_comment_set_moderation.build",
                return_value=youtube,
            ):
                result = _service(_connected_oauth()).set_comment_moderation(
                    USER_ID, comment_id="c-1", ban_author=reason == "banWithoutReject"
                )
            assert result["success"] is False, reason
            assert result["error_code"] == reason
            assert needle in (result.get("message") or "").lower(), reason
            assert "secret-google" not in (result.get("message") or "")

    def test_unmapped_reason_is_generic(self):
        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.side_effect = (
            _http_error("quotaExceeded", 403)
        )
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=False
            )
        assert result["success"] is False
        assert result["error_code"] == "moderate_failed"
        assert result["message"] == "Could not hide that comment. Please try again."
        assert "secret-google" not in result["message"]

    def test_failed_moderate_logs_reason_without_google_body(self):
        from services.youtube import youtube_comment_set_moderation as mod

        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.side_effect = (
            _http_error("forbidden", 403)
        )
        with patch.object(mod.logger, "error") as mock_error, patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="secret-parent-id", ban_author=False
            )
        assert result["success"] is False
        error_args = mock_error.call_args.args
        leak_text = " ".join(str(part) for part in error_args)
        assert "quota_cost={}" in str(error_args[0])
        assert 50 in error_args
        assert "forbidden" in error_args
        assert False in error_args
        assert "secret-parent-id" not in leak_text
        assert "secret-google" not in leak_text

    def test_auth_failure_asks_to_reconnect_without_leak(self):
        youtube = MagicMock()
        youtube.comments.return_value.setModerationStatus.return_value.execute.side_effect = (
            _http_error("authError", 401)
        )
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=False
            )
        assert result["success"] is False
        assert "reconnect" in (result.get("message") or "").lower()
        assert "secret-google" not in (result.get("message") or "")

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
        youtube.comments.return_value.setModerationStatus.return_value.execute.side_effect = (
            http_error
        )
        with patch(
            "services.youtube.youtube_comment_set_moderation.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).set_comment_moderation(
                USER_ID, comment_id="c-1", ban_author=True
            )
        assert result["success"] is False
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")


class TestInboxDoesNotCallSetModerationStatus:
    def test_inbox_does_not_moderate(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "UC123"}]
        }
        youtube.commentThreads.return_value.list.return_value.execute.return_value = {
            "items": []
        }
        youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)
        assert result["success"] is True
        youtube.comments.return_value.setModerationStatus.assert_not_called()
        youtube.comments.return_value.delete.assert_not_called()
