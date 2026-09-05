"""Documented Comments.delete errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/comments/delete

Used by HITL delete of the creator's own replies only.
Never put Google error bodies in user copy.
"""

from __future__ import annotations

from typing import Mapping, Optional

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)

YOUTUBE_COMMENTS_DELETE_QUOTA_COST = 50

_COMMENTS_DELETE_ERRORS: Mapping[str, str] = {
    "processingFailure": "YouTube could not process that delete. Please try again.",
    "forbidden": (
        "YouTube would not delete that comment. Check comment permissions and try again."
    ),
    "commentNotFound": (
        "That comment could not be found. It may have been removed."
    ),
}


def youtube_comments_delete_error_code(exc: BaseException) -> Optional[str]:
    """Documented Comments.delete reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENTS_DELETE_ERRORS:
        return reason
    return None


def user_safe_youtube_comments_delete_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented Comments.delete reason."""
    code = youtube_comments_delete_error_code(exc)
    if not code:
        return None
    return _COMMENTS_DELETE_ERRORS[code]
