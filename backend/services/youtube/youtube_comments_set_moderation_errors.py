"""Documented Comments.setModerationStatus errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/comments/setModerationStatus

HITL hide comment / hide user only. Always rejected on the executor.
Never put Google error bodies in user copy.
"""

from __future__ import annotations

from typing import Mapping, Optional

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)

YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST = 50

_COMMENTS_SET_MODERATION_ERRORS: Mapping[str, str] = {
    "processingFailure": "YouTube could not process that hide. Please try again.",
    "forbidden": (
        "YouTube would not hide that comment. Check comment permissions and try again."
    ),
    "commentNotFound": (
        "That comment could not be found. It may have been removed."
    ),
    "banWithoutReject": (
        "YouTube would not hide that user. Hide the comment to hide the user."
    ),
    "operationNotSupported": "YouTube cannot moderate that comment.",
}


def youtube_comments_set_moderation_error_code(exc: BaseException) -> Optional[str]:
    """Documented Comments.setModerationStatus reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENTS_SET_MODERATION_ERRORS:
        return reason
    return None


def user_safe_youtube_comments_set_moderation_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented Comments.setModerationStatus reason."""
    code = youtube_comments_set_moderation_error_code(exc)
    if not code:
        return None
    return _COMMENTS_SET_MODERATION_ERRORS[code]
