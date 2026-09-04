"""YouTube Comment Reply Assistant service — existing inbox, draft, and HITL send.

Documents current list_inbox / draft_reply / send_reply behavior.
Video titles come from videos.list after commentThreads.list.
Hub wedge chrome and Podcast Maker are out of scope.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_comment_assistant"


def _service(oauth: MagicMock | None = None):
    from services.youtube.youtube_comments_service import YouTubeCommentsService

    return YouTubeCommentsService(oauth or MagicMock())


def _connected_oauth() -> MagicMock:
    oauth = MagicMock()
    oauth.get_valid_credentials.return_value = MagicMock(name="creds")
    return oauth


def _thread(
    *,
    thread_id: str = "thread-1",
    comment_id: str = "comment-1",
    video_id: str = "vid-abc",
    author: str = "Alex",
    text: str = "Great video",
) -> dict:
    return {
        "id": thread_id,
        "snippet": {
            "totalReplyCount": 2,
            "canReply": True,
            "topLevelComment": {
                "id": comment_id,
                "snippet": {
                    "videoId": video_id,
                    "authorDisplayName": author,
                    "textDisplay": text,
                    "likeCount": 3,
                    "publishedAt": "2026-01-01T00:00:00Z",
                },
            },
        },
    }


def _youtube_inbox(threads: list[dict] | None = None) -> MagicMock:
    youtube = MagicMock()
    youtube.channels.return_value.list.return_value.execute.return_value = {
        "items": [{"id": "UC123"}]
    }
    youtube.commentThreads.return_value.list.return_value.execute.return_value = {
        "items": threads if threads is not None else [_thread()]
    }
    youtube.videos.return_value.list.return_value.execute.return_value = {"items": []}
    return youtube


class TestYouTubeCommentsServiceInbox:
    def test_not_connected_returns_error_without_youtube_calls(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = _youtube_inbox()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).list_inbox(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        youtube.channels.return_value.list.assert_not_called()

    def test_no_channel_returns_error_without_comment_threads(self):
        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.return_value = {"items": []}

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "no_channel"
        youtube.commentThreads.return_value.list.assert_not_called()

    def test_inbox_maps_author_text_and_video_id(self):
        youtube = _youtube_inbox(
            [
                _thread(
                    comment_id="c-1",
                    video_id="vid-1",
                    author="Sam",
                    text="Loved the intro",
                )
            ]
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID, max_results=20)

        assert result["success"] is True
        assert len(result["comments"]) == 1
        comment = result["comments"][0]
        assert comment["comment_id"] == "c-1"
        assert comment["video_id"] == "vid-1"
        assert comment["author"] == "Sam"
        assert comment["text"] == "Loved the intro"
        assert comment["thread_id"] == "thread-1"
        assert comment["video_title"] == "vid-1"
        list_kwargs = youtube.commentThreads.return_value.list.call_args.kwargs
        assert list_kwargs["allThreadsRelatedToChannelId"] == "UC123"
        assert list_kwargs["maxResults"] == 20
        assert list_kwargs["order"] == "time"
        assert "snippet" in list_kwargs["part"]

    def test_inbox_caps_max_results_at_one_hundred(self):
        youtube = _youtube_inbox([])

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            _service(_connected_oauth()).list_inbox(USER_ID, max_results=99)

        assert youtube.commentThreads.return_value.list.call_args.kwargs["maxResults"] == 99
        youtube.videos.return_value.list.assert_not_called()

    def test_inbox_attaches_video_title_from_videos_list(self):
        youtube = _youtube_inbox(
            [
                _thread(
                    comment_id="c-1",
                    video_id="vid-1",
                    author="Sam",
                    text="Loved the intro",
                )
            ]
        )
        youtube.videos.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "vid-1", "snippet": {"title": "Rank Videos in 7 Days"}}]
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        assert result["comments"][0]["video_title"] == "Rank Videos in 7 Days"
        video_kwargs = youtube.videos.return_value.list.call_args.kwargs
        assert video_kwargs["part"] == "snippet"
        assert "vid-1" in video_kwargs["id"]

    def test_inbox_videos_list_uses_unique_video_ids(self):
        youtube = _youtube_inbox(
            [
                _thread(comment_id="c-1", video_id="vid-1", author="Sam", text="A"),
                _thread(
                    thread_id="thread-2",
                    comment_id="c-2",
                    video_id="vid-1",
                    author="Pat",
                    text="B",
                ),
                _thread(
                    thread_id="thread-3",
                    comment_id="c-3",
                    video_id="vid-2",
                    author="Lee",
                    text="C",
                ),
            ]
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        assert youtube.videos.return_value.list.call_count == 1
        ids = set(youtube.videos.return_value.list.call_args.kwargs["id"].split(","))
        assert ids == {"vid-1", "vid-2"}
        assert youtube.videos.return_value.list.call_args.kwargs["part"] == "snippet"

    def test_inbox_videos_list_failure_still_returns_comments(self):
        youtube = _youtube_inbox(
            [
                _thread(comment_id="c-1", video_id="abcdefghijk", author="Sam", text="Hi")
            ]
        )
        youtube.videos.return_value.list.return_value.execute.side_effect = RuntimeError(
            "secret-title-lookup"
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is True
        assert result["comments"][0]["text"] == "Hi"
        assert result["comments"][0]["video_title"] == "abcdefgh"
        assert "secret-title-lookup" not in (result.get("message") or "")

    def test_inbox_failure_returns_error_not_fake_comments(self):
        oauth = _connected_oauth()
        oauth.get_valid_credentials.side_effect = RuntimeError("quota")

        result = _service(oauth).list_inbox(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "inbox_failed"
        assert result["comments"] == []
        assert result.get("author") is None
        assert "quota" not in (result.get("message") or "").lower()

    def test_inbox_http_403_does_not_leak_google_text(self):
        from types import SimpleNamespace

        from googleapiclient.errors import HttpError

        resp = SimpleNamespace(status=403, reason="forbidden")
        content = b'{"error":{"message":"secret-google-body"}}'
        try:
            http_error = HttpError(resp, content)
        except Exception:
            http_error = HttpError()
        http_error.resp = resp
        http_error.content = content

        youtube = MagicMock()
        youtube.channels.return_value.list.return_value.execute.side_effect = http_error

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).list_inbox(USER_ID)

        assert result["success"] is False
        assert result["error_code"] == "inbox_failed"
        assert "secret-google-body" not in (result.get("message") or "")
        assert "forbidden" not in (result.get("message") or "").lower()


class TestYouTubeCommentsServiceDraft:
    def test_draft_returns_llm_text_for_hitl_review(self):
        with patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            return_value="Thanks for watching — what did you try first?",
        ) as llm:
            result = _service().draft_reply(
                USER_ID,
                comment_text="How do I start?",
                channel_niche="seo",
            )

        assert result["success"] is True
        assert "Thanks for watching" in result["draft"]
        llm.assert_called_once()
        assert llm.call_args.kwargs["user_id"] == USER_ID
        assert llm.call_args.kwargs["flow_type"] == "youtube_comment_draft"
        assert "How do I start?" in llm.call_args.kwargs["prompt"]

    def test_empty_llm_draft_is_not_success(self):
        with patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            return_value="   ",
        ):
            result = _service().draft_reply(USER_ID, comment_text="Nice video")

        assert result["success"] is False
        assert result["error_code"] == "empty_draft"

    def test_draft_failure_returns_error(self):
        with patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            side_effect=RuntimeError("provider down"),
        ):
            result = _service().draft_reply(USER_ID, comment_text="Nice video")

        assert result["success"] is False
        assert result["error_code"] == "draft_failed"
        assert "provider down" not in (result.get("message") or "").lower()

    def test_draft_does_not_call_comments_insert(self):
        youtube = MagicMock()
        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ), patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            return_value="Thanks",
        ):
            _service(_connected_oauth()).draft_reply(USER_ID, comment_text="Nice")

        youtube.comments.return_value.insert.assert_not_called()

    def test_draft_strips_surrounding_quotes_for_hitl_box(self):
        with patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            return_value='"Thanks for watching"',
        ):
            result = _service().draft_reply(USER_ID, comment_text="Nice video")

        assert result["success"] is True
        assert result["draft"] == "Thanks for watching"

    def test_draft_includes_optional_video_title_in_prompt_not_insert(self):
        with patch(
            "services.youtube.youtube_comments_service.llm_text_gen",
            return_value="Thanks",
        ) as llm:
            result = _service().draft_reply(
                USER_ID,
                comment_text="How do I start?",
                video_title="Rank Videos in 7 Days",
            )

        assert result["success"] is True
        assert "Rank Videos in 7 Days" in llm.call_args.kwargs["prompt"]


class TestYouTubeCommentsServiceSend:
    def test_empty_text_does_not_call_youtube(self):
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text="   "
            )

        assert result["success"] is False
        assert result["error_code"] == "empty_text"
        youtube.comments.return_value.insert.assert_not_called()

    def test_not_connected_does_not_insert(self):
        oauth = MagicMock()
        oauth.get_valid_credentials.return_value = None
        youtube = MagicMock()

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(oauth).send_reply(USER_ID, parent_id="c-1", text="Thanks")

        assert result["success"] is False
        assert result["error_code"] == "not_connected"
        youtube.comments.return_value.insert.assert_not_called()

    def test_inserts_approved_reply_under_parent_comment(self):
        youtube = MagicMock()
        youtube.comments.return_value.insert.return_value.execute.return_value = {
            "id": "reply-9"
        }

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text="Thanks for watching"
            )

        assert result["success"] is True
        assert result["comment_id"] == "reply-9"
        insert_kwargs = youtube.comments.return_value.insert.call_args.kwargs
        assert insert_kwargs["part"] == "snippet"
        assert insert_kwargs["body"]["snippet"]["parentId"] == "c-1"
        assert insert_kwargs["body"]["snippet"]["textOriginal"] == "Thanks for watching"
        youtube.commentThreads.return_value.insert.assert_not_called()

    def test_send_does_not_silently_truncate_approved_hitl_text(self):
        youtube = MagicMock()
        youtube.comments.return_value.insert.return_value.execute.return_value = {
            "id": "reply-long"
        }
        approved = "A" * 9001

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text=approved
            )

        assert result["success"] is True
        sent = youtube.comments.return_value.insert.call_args.kwargs["body"]["snippet"][
            "textOriginal"
        ]
        assert sent == approved
        assert len(sent) == 9001

    def test_send_failure_does_not_leak_exception_text(self):
        youtube = MagicMock()
        youtube.comments.return_value.insert.return_value.execute.side_effect = RuntimeError(
            "token-leak"
        )

        with patch(
            "services.youtube.youtube_comments_service.build",
            return_value=youtube,
        ):
            result = _service(_connected_oauth()).send_reply(
                USER_ID, parent_id="c-1", text="Thanks"
            )

        assert result["success"] is False
        assert result["error_code"] == "reply_failed"
        assert "token-leak" not in (result.get("message") or "")
