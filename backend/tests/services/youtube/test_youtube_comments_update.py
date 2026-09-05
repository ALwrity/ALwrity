"""YouTube Comments.update for HITL edit of the creator's own replies.

https://developers.google.com/youtube/v3/docs/comments/update
Quota 50. PUT part=snippet. No parentId. Inbox must not call update.
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

USER_ID = "user_yt_comment_update"


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


def _reply_resource(
    *,
    comment_id: str,
    author: str,
    text: str,
    channel_id: str | None = None,
) -> dict:
    snippet: dict = {
        "authorDisplayName": author,
        "textDisplay": text,
        "publishedAt": "2026-01-02T00:00:00Z",
    }
    if channel_id:
        snippet["authorChannelId"] = {"value": channel_id}
    return {"id": comment_id, "snippet": snippet}


def _thread(*, replies: list[dict] | None = None) -> dict:
    return {
        "id": "thread-1",
        "snippet": {
            "totalReplyCount": len(replies or []),
            "canReply": True,
            "topLevelComment": {
                "id": "c-1",
                "snippet": {
                    "videoId": "vid-1",
                    "authorDisplayName": "Sam",
                    "textDisplay": "Loved the intro",
                },
            },
        },
        "replies": {"comments": replies or []},
    }


def _inbox_youtube(threads: list[dict] | None = None) -> MagicMock:
    youtube = MagicMock()
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [{"id": "UC123"}]
    }
    youtube.commentThreads.return_value.list.return_value.execute.return_value = {
        "items": threads if threads is not None else [_thread()]
    }
    youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
    return youtube


class TestMapCanEditFromAuthorChannelId:
    def test_can_edit_true_only_when_author_channel_matches_mine(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_comment_reply_items,
        )

        mapped = map_youtube_comment_reply_items(
            [
                _reply_resource(
                    comment_id="r-own",
                    author="MyChannel",
                    text="Thanks",
                    channel_id="UC123",
                ),
                _reply_resource(
                    comment_id="r-viewer",
                    author="Pat",
                    text="Me too",
                    channel_id="UCother",
                ),
                _reply_resource(comment_id="r-none", author="Lee", text="Hi"),
            ],
            mine_channel_id="UC123",
        )
        by_id = {row["comment_id"]: row for row in mapped}
        assert by_id["r-own"]["can_edit"] is True
        assert by_id["r-own"]["author_channel_id"] == "UC123"
        assert by_id["r-viewer"]["can_edit"] is False
        assert by_id["r-none"]["can_edit"] is False
        assert "Untitled" not in by_id["r-own"]["text"]

    def test_can_edit_false_without_mine_channel(self):
        from services.youtube.youtube_comment_thread_replies import (
            map_youtube_comment_reply_items,
        )

        mapped = map_youtube_comment_reply_items(
            [
                _reply_resource(
                    comment_id="r-own",
                    author="MyChannel",
                    text="Thanks",
                    channel_id="UC123",
                )
            ]
        )
        assert mapped[0]["can_edit"] is False


class TestInboxDoesNotCallCommentsUpdate:
    def test_inbox_maps_can_edit_and_does_not_update(self):
        youtube = _inbox_youtube(
            [
                _thread(
                    replies=[
                        _reply_resource(
                            comment_id="r-1",
                            author="MyChannel",
                            text="Thanks",
                            channel_id="UC123",
                        )
                    ]
                )
            ]
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        reply = result["comments"][0]["replies"][0]
        assert reply["can_edit"] is True
        youtube.comments.return_value.update.assert_not_called()
        youtube.comments.return_value.insert.assert_not_called()


class TestListRepliesMapsCanEdit:
    def test_list_replies_sets_can_edit_from_mine_channel(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "UC123"}]
        }
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "items": [
                _reply_resource(
                    comment_id="r-own",
                    author="MyChannel",
                    text="Thanks",
                    channel_id="UC123",
                ),
                _reply_resource(
                    comment_id="r-viewer",
                    author="Pat",
                    text="Me too",
                    channel_id="UCother",
                ),
            ]
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is True
        by_id = {row["comment_id"]: row for row in result["replies"]}
        assert by_id["r-own"]["can_edit"] is True
        assert by_id["r-viewer"]["can_edit"] is False
        kwargs = youtube.comments.return_value.list.call_args.kwargs
        assert kwargs["parentId"] == "c-1"
        youtube.comments.return_value.update.assert_not_called()

    def test_list_replies_still_succeeds_if_mine_channel_lookup_fails(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.side_effect = RuntimeError(
            "secret-channel"
        )
        youtube.comments.return_value.list.return_value.execute.return_value = {
            "items": [
                _reply_resource(
                    comment_id="r-own",
                    author="MyChannel",
                    text="Thanks",
                    channel_id="UC123",
                )
            ]
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_replies(USER_ID, parent_id="c-1")

        assert result["success"] is True
        assert result["replies"][0]["text"] == "Thanks"
        assert result["replies"][0]["can_edit"] is False
        assert "secret-channel" not in (result.get("message") or "")
        youtube.comments.return_value.list.assert_called_once()


class TestUpdateReplyFollowsCommentsUpdateDocs:
    def test_updates_snippet_text_original_without_parent_id(self):
        youtube = MagicMock()
        youtube.comments.return_value.update.return_value.execute.return_value = {
            "id": "r-1",
            "snippet": {
                "textOriginal": "Thanks for watching",
                "textDisplay": "Thanks for watching",
            },
        }

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="Thanks for watching"
            )

        assert result["success"] is True
        assert result["comment_id"] == "r-1"
        assert result["text"] == "Thanks for watching"
        kwargs = youtube.comments.return_value.update.call_args.kwargs
        assert kwargs["part"] == "snippet"
        assert kwargs["body"]["id"] == "r-1"
        assert kwargs["body"]["snippet"]["textOriginal"] == "Thanks for watching"
        assert "parentId" not in kwargs["body"].get("snippet", {})
        youtube.comments.return_value.insert.assert_not_called()

    def test_uses_submitted_text_when_response_omits_snippet_text(self):
        youtube = MagicMock()
        youtube.comments.return_value.update.return_value.execute.return_value = {"id": "r-1"}

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="Saved copy"
            )

        assert result["success"] is True
        assert result["text"] == "Saved copy"

    def test_empty_text_does_not_call_youtube(self):
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="   "
            )

        assert result["success"] is False
        assert result["error_code"] == "empty_text"
        youtube.comments.return_value.update.assert_not_called()

    def test_empty_comment_id_does_not_call_youtube(self):
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="  ", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "comment_id_required"
        youtube.comments.return_value.update.assert_not_called()

    def test_not_connected_does_not_update(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(oauth).update_reply(
                USER_ID, comment_id="r-1", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        assert "edit" in (result.get("message") or "").lower()
        youtube.comments.return_value.update.assert_not_called()


class TestUpdateReplyDocumentedErrors:
    def test_documented_reasons_are_user_safe(self):
        cases = {
            "commentTextTooLong": (400, "too long"),
            "invalidCommentMetadata": (400, "could not accept that edit"),
            "operationNotSupported": (400, "would not allow that comment to be edited"),
            "processingFailure": (400, "could not process that edit"),
            "forbidden": (403, "would not save that edit"),
            "ineligibleAccount": (403, "merging"),
            "commentNotFound": (404, "could not be found"),
        }
        for reason, (status, needle) in cases.items():
            youtube = MagicMock()
            youtube.comments.return_value.update.return_value.execute.side_effect = (
                _http_error(reason, status)
            )
            with patch(
                "services.youtube.youtube_comment_update.build",
                return_value=youtube,
            ):
                result = _service(_connected_oauth()).update_reply(
                    USER_ID, comment_id="r-1", text="Thanks"
                )
            assert result["success"] is False, reason
            assert result["error_code"] == reason
            assert needle in (result.get("message") or "").lower(), reason
            assert "secret-google" not in (result.get("message") or "")
            assert "would not allow a reply" not in (result.get("message") or "").lower()

    def test_unmapped_reason_is_generic(self):
        youtube = MagicMock()
        youtube.comments.return_value.update.return_value.execute.side_effect = (
            _http_error("quotaExceeded", 403)
        )

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "update_failed"
        assert result["message"] == "Could not save that edit. Please try again."
        assert "quotaExceeded" not in result["message"]
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
        youtube.comments.return_value.update.return_value.execute.side_effect = http_error

        with patch(
            "services.youtube.youtube_comment_update.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).update_reply(
                USER_ID, comment_id="r-1", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "update_failed"
        assert "secret-stack" not in (result.get("message") or "")
        assert "not-json" not in (result.get("message") or "")

