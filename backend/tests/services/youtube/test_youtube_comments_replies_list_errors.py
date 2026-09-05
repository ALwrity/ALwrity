"""Documented Comments.list errors for Show more replies.

https://developers.google.com/youtube/v3/docs/comments/list
Never put Google bodies in user copy. Do not reuse CommentThreads.list reasons.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _http_error(reason: str, status: int, message: str = "secret-google") -> Exception:
    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": message,
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


class TestYoutubeCommentsListErrors:
    def test_maps_documented_reasons_only(self):
        from services.youtube.youtube_comments_replies_list_errors import (
            user_safe_youtube_comments_list_error,
            youtube_comments_list_error_code,
        )

        cases = {
            "operationNotSupported": (
                400,
                "YouTube could not list those replies with this request. Please try again.",
            ),
            "forbidden": (
                403,
                "YouTube would not load those replies. Check comment permissions and try again.",
            ),
            "commentNotFound": (
                404,
                "That comment could not be found. It may have been removed.",
            ),
        }
        for reason, (status, copy) in cases.items():
            exc = _http_error(reason, status)
            assert youtube_comments_list_error_code(exc) == reason
            assert user_safe_youtube_comments_list_error(exc) == copy
            assert "secret-google" not in copy

    def test_does_not_map_comment_threads_reasons(self):
        from services.youtube.youtube_comments_replies_list_errors import (
            user_safe_youtube_comments_list_error,
            youtube_comments_list_error_code,
        )

        exc = _http_error("commentsDisabled", 403)
        assert youtube_comments_list_error_code(exc) is None
        assert user_safe_youtube_comments_list_error(exc) is None
