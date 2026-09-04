"""Attach video titles to existing comment inbox rows (videos.list).

https://developers.google.com/youtube/v3/docs/videos/list

Does not fail inbox when title lookup fails. Never invents fake titles.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

USER_ID = "user_yt_comment_video_titles"


def _http_error(reason: str, status: int) -> Exception:
    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": f"secret-google-{reason}",
            "errors": [{"reason": reason, "domain": "youtube.video"}],
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


def _youtube_with_titles(items: list[dict]) -> MagicMock:
    youtube = MagicMock()
    youtube.videos.return_value.list.return_value.execute.return_value = {"items": items}
    return youtube


class TestYouTubeCommentVideoTitleLabels:
    def test_short_id_uses_first_eight_characters(self):
        from services.youtube.youtube_comment_video_titles import short_youtube_video_id

        assert short_youtube_video_id("dQw4w9WgXcQ") == "dQw4w9Wg"
        assert short_youtube_video_id("abc") == "abc"
        assert short_youtube_video_id("") == ""
        assert short_youtube_video_id(None) == ""

    def test_attaches_snippet_title_for_unique_ids(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = _youtube_with_titles(
            [
                {"id": "vid-1", "snippet": {"title": "Rank Videos in 7 Days"}},
                {"id": "vid-2", "snippet": {"title": "SEO shorts"}},
            ]
        )
        comments = [
            {"comment_id": "c-1", "video_id": "vid-1"},
            {"comment_id": "c-2", "video_id": "vid-1"},
            {"comment_id": "c-3", "video_id": "vid-2"},
        ]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert comments[0]["video_title"] == "Rank Videos in 7 Days"
        assert comments[1]["video_title"] == "Rank Videos in 7 Days"
        assert comments[2]["video_title"] == "SEO shorts"
        list_kwargs = youtube.videos.return_value.list.call_args.kwargs
        assert list_kwargs["part"] == "snippet"
        ids = set(list_kwargs["id"].split(","))
        assert ids == {"vid-1", "vid-2"}
        youtube.videos.return_value.list.assert_called_once()

    def test_empty_or_missing_title_falls_back_to_short_id_not_fake_title(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = _youtube_with_titles(
            [
                {"id": "abcdefghijk", "snippet": {"title": "  "}},
            ]
        )
        comments = [
            {"comment_id": "c-1", "video_id": "abcdefghijk"},
            {"comment_id": "c-2", "video_id": "omittedxxxx"},
        ]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert comments[0]["video_title"] == "abcdefgh"
        assert comments[1]["video_title"] == "omittedx"
        assert "Untitled" not in comments[0]["video_title"]
        assert comments[0]["video_title"] != "abcdefghijk"

    def test_missing_video_id_does_not_invent_a_title(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = _youtube_with_titles([])
        comments = [{"comment_id": "c-1", "video_id": None}]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert comments[0].get("video_title") in (None, "")
        youtube.videos.return_value.list.assert_not_called()

    def test_videos_list_error_keeps_comments_and_uses_short_id(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.side_effect = _http_error(
            "forbidden", 403
        )
        comments = [{"comment_id": "c-1", "video_id": "abcdefghijk"}]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert comments[0]["video_title"] == "abcdefgh"
        assert "secret-google" not in comments[0]["video_title"]

    def test_chunks_unique_ids_into_batches_of_fifty(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = _youtube_with_titles([])
        comments = [
            {"comment_id": f"c-{i}", "video_id": f"id{i:03d}xxxxx"}
            for i in range(51)
        ]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert youtube.videos.return_value.list.call_count == 2
        first_ids = youtube.videos.return_value.list.call_args_list[0].kwargs["id"].split(",")
        second_ids = youtube.videos.return_value.list.call_args_list[1].kwargs["id"].split(",")
        assert len(first_ids) == 50
        assert len(second_ids) == 1

    def test_later_chunk_failure_keeps_titles_from_successful_chunks(self):
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.side_effect = [
            {
                "items": [
                    {"id": "id000xxxxx", "snippet": {"title": "Keep This Title"}},
                ]
            },
            _http_error("quotaExceeded", 403),
        ]
        comments = [
            {"comment_id": f"c-{i}", "video_id": f"id{i:03d}xxxxx", "text": "Loved the intro"}
            for i in range(51)
        ]

        attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        assert comments[0]["video_title"] == "Keep This Title"
        assert comments[50]["video_title"] == "id050xxx"
        assert "Untitled" not in (comments[50]["video_title"] or "")

    def test_videos_list_failure_logs_reason_not_titles_or_google_body(self):
        from unittest.mock import patch

        from services.youtube import youtube_comment_video_titles as titles_mod
        from services.youtube.youtube_comment_video_titles import (
            attach_youtube_comment_video_titles,
        )

        youtube = MagicMock()
        youtube.videos.return_value.list.return_value.execute.side_effect = _http_error(
            "forbidden", 403
        )
        comments = [
            {
                "comment_id": "c-1",
                "video_id": "abcdefghijk",
                "text": "Loved the intro",
                "author": "Sam",
            }
        ]

        with patch.object(titles_mod.logger, "error") as mock_error, patch.object(
            titles_mod.logger, "info"
        ) as mock_info:
            attach_youtube_comment_video_titles(youtube, comments, user_id=USER_ID)

        error_args = mock_error.call_args.args
        assert "videos.list failed" in error_args[0]
        assert USER_ID in error_args
        assert "HttpError" in error_args
        assert 403 in error_args
        assert "forbidden" in error_args
        leak_text = " ".join(str(part) for part in error_args)
        assert "secret-google" not in leak_text
        assert "Loved the intro" not in leak_text
        assert "abcdefghijk" not in leak_text
        info_templates = " ".join(str(call.args[0]) for call in mock_info.call_args_list)
        assert "quota_cost={}" in info_templates
        assert "unique_video_id_count={}" in info_templates
        info_values = [part for call in mock_info.call_args_list for part in call.args[1:]]
        assert 1 in info_values
