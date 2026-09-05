"""Documented Comments.update errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/comments/update

Used by HITL edit of the creator's own replies only.
Do not copy Comments.insert parentId reasons.
Never put Google error bodies in user copy.
"""

from __future__ import annotations

from typing import Mapping, Optional

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)

YOUTUBE_COMMENTS_UPDATE_QUOTA_COST = 50

_COMMENTS_UPDATE_ERRORS: Mapping[str, str] = {
    "commentTextTooLong": (
        "That reply is too long for YouTube. Shorten it and try again."
    ),
    "invalidCommentMetadata": "YouTube could not accept that edit. Please try again.",
    "operationNotSupported": "YouTube would not allow that comment to be edited.",
    "processingFailure": "YouTube could not process that edit. Please try again.",
    "forbidden": (
        "YouTube would not save that edit. Check comment permissions and try again."
    ),
    "ineligibleAccount": (
        "Reconnect YouTube after merging your YouTube and Google accounts."
    ),
    "commentNotFound": (
        "That comment could not be found. It may have been removed."
    ),
}


def youtube_comments_update_error_code(exc: BaseException) -> Optional[str]:
    """Documented Comments.update reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENTS_UPDATE_ERRORS:
        return reason
    return None


def user_safe_youtube_comments_update_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented Comments.update reason."""
    code = youtube_comments_update_error_code(exc)
    if not code:
        return None
    return _COMMENTS_UPDATE_ERRORS[code]
