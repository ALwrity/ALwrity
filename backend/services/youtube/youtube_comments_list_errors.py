"""Documented CommentThreads.list errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/commentThreads/list

Used by existing list_inbox only. Reuses Comments.insert HTTP reason parsing.
Never put Google error bodies in user copy.
"""

from __future__ import annotations

from typing import Mapping, Optional

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)

# Documented CommentThreads.list quota cost and maxResults range.
YOUTUBE_COMMENT_THREADS_LIST_QUOTA_COST = 1
YOUTUBE_COMMENT_THREADS_MAX_RESULTS = 100
YOUTUBE_COMMENT_THREADS_DEFAULT_RESULTS = 20

_COMMENT_THREADS_LIST_ERRORS: Mapping[str, str] = {
    "operationNotSupported": (
        "YouTube could not list comments with this filter. Please try again."
    ),
    "processingFailure": (
        "YouTube could not process the comment list request. Please try again."
    ),
    "commentsDisabled": "Comments are disabled on that video.",
    "forbidden": (
        "YouTube would not load comments. Check comment permissions and try again."
    ),
    "channelNotFound": "That YouTube channel could not be found.",
    "commentThreadNotFound": "Those comment threads could not be found.",
    "videoNotFound": "That video could not be found.",
}


def youtube_comment_threads_list_error_code(exc: BaseException) -> Optional[str]:
    """Documented CommentThreads.list reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENT_THREADS_LIST_ERRORS:
        return reason
    return None


def user_safe_youtube_comment_threads_list_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented CommentThreads.list reason."""
    code = youtube_comment_threads_list_error_code(exc)
    if not code:
        return None
    return _COMMENT_THREADS_LIST_ERRORS[code]
