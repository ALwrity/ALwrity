"""Documented Comments.list errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/comments/list

Used by Show more replies only. Do not copy CommentThreads.list reasons.
Never put Google error bodies in user copy.
"""

from __future__ import annotations

from typing import Mapping, Optional

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)

# Documented Comments.list quota cost and maxResults range.
YOUTUBE_COMMENTS_LIST_QUOTA_COST = 1
YOUTUBE_COMMENTS_LIST_MAX_RESULTS = 100
YOUTUBE_COMMENTS_LIST_DEFAULT_RESULTS = 20

_COMMENTS_LIST_ERRORS: Mapping[str, str] = {
    "operationNotSupported": (
        "YouTube could not list those replies with this request. Please try again."
    ),
    "forbidden": (
        "YouTube would not load those replies. Check comment permissions and try again."
    ),
    "commentNotFound": (
        "That comment could not be found. It may have been removed."
    ),
}


def youtube_comments_list_error_code(exc: BaseException) -> Optional[str]:
    """Documented Comments.list reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENTS_LIST_ERRORS:
        return reason
    return None


def user_safe_youtube_comments_list_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented Comments.list reason."""
    code = youtube_comments_list_error_code(exc)
    if not code:
        return None
    return _COMMENTS_LIST_ERRORS[code]
