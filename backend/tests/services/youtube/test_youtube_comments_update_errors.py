"""Documented Comments.update errors for HITL reply edit.

https://developers.google.com/youtube/v3/docs/comments/update
Never put Google bodies in user copy. Do not reuse insert parentId reasons.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _http_error(reason: str, status: int) -> Exception:
    from googleapiclient.errors import HttpError

    body = {
        "error": {
            "code": status,
            "message": "secret-google",
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


class TestYoutubeCommentsUpdateErrors:
    def test_maps_documented_reasons_only(self):
        from services.youtube.youtube_comments_update_errors import (
            user_safe_youtube_comments_update_error,
            youtube_comments_update_error_code,
        )

        cases = {
            "commentTextTooLong": "too long",
            "invalidCommentMetadata": "could not accept that edit",
            "operationNotSupported": "would not allow that comment to be edited",
            "processingFailure": "could not process that edit",
            "forbidden": "would not save that edit",
            "ineligibleAccount": "merging",
            "commentNotFound": "could not be found",
        }
        for reason, needle in cases.items():
            exc = _http_error(reason, 400)
            assert youtube_comments_update_error_code(exc) == reason
            copy = user_safe_youtube_comments_update_error(exc) or ""
            assert needle in copy.lower()
            assert "secret-google" not in copy
            assert "would not allow a reply" not in copy.lower()

    def test_does_not_map_insert_parent_reasons(self):
        from services.youtube.youtube_comments_update_errors import (
            user_safe_youtube_comments_update_error,
            youtube_comments_update_error_code,
        )

        exc = _http_error("parentIdMissing", 400)
        assert youtube_comments_update_error_code(exc) is None
        assert user_safe_youtube_comments_update_error(exc) is None
