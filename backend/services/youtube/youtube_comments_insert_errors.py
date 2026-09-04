"""Documented Comments.insert errors (YouTube Data API v3).

https://developers.google.com/youtube/v3/docs/comments/insert

Used by existing HITL send_reply only. Never put Google error bodies in user copy.
Reasons are safe to log.
"""

from __future__ import annotations

import json
from typing import Mapping, Optional, Tuple

from loguru import logger

from services.youtube.youtube_publish_log import youtube_publish_error_status

# Documented Comments.insert quota cost (YouTube Data API v3 getting started).
YOUTUBE_COMMENTS_INSERT_QUOTA_COST = 50

_COMMENTS_INSERT_ERRORS: Mapping[str, str] = {
    "commentTextRequired": "Reply text is required.",
    "commentTextTooLong": "That reply is too long for YouTube. Shorten it and try again.",
    "invalidCustomEmoji": (
        "YouTube rejected an emoji in that reply. Remove it and try again."
    ),
    "invalidCommentMetadata": "YouTube could not accept that reply. Please try again.",
    "operationNotSupported": "YouTube would not allow a reply on that comment.",
    "parentCommentIsPrivate": "YouTube does not allow replies to private comments.",
    "parentIdMissing": (
        "That reply is missing a parent comment. Refresh the inbox and try again."
    ),
    "processingFailure": "YouTube could not process that reply. Please try again.",
    "forbidden": (
        "YouTube would not post that reply. Check comment permissions and try again."
    ),
    "ineligibleAccount": (
        "Reconnect YouTube after merging your YouTube and Google accounts."
    ),
    "parentCommentNotFound": (
        "That comment could not be found. It may have been removed."
    ),
}


def youtube_comment_http_error_reason(
    exc: BaseException,
) -> Tuple[Optional[int], Optional[str]]:
    """Return (http_status, errors[0].reason). Never returns the Google message body."""
    status = youtube_publish_error_status(exc)
    raw = getattr(exc, "content", b"") or b""
    text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
    reason: Optional[str] = None
    try:
        payload = json.loads(text) if text else {}
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            errors = error.get("errors") or []
            if errors and isinstance(errors[0], dict):
                raw_reason = errors[0].get("reason")
                if isinstance(raw_reason, str) and raw_reason.strip():
                    reason = raw_reason.strip()
    except (json.JSONDecodeError, TypeError, ValueError) as parse_exc:
        logger.warning(
            "[youtube_comments] HttpError body was not JSON http_status={} parse_error_type={}",
            status,
            type(parse_exc).__name__,
        )
    if not reason:
        details = getattr(exc, "error_details", None)
        if isinstance(details, list) and details and isinstance(details[0], dict):
            raw_reason = details[0].get("reason")
            if isinstance(raw_reason, str) and raw_reason.strip():
                reason = raw_reason.strip()
    return status, reason


def youtube_comment_insert_error_code(exc: BaseException) -> Optional[str]:
    """Documented Comments.insert reason, or None when unmapped."""
    _status, reason = youtube_comment_http_error_reason(exc)
    if reason and reason in _COMMENTS_INSERT_ERRORS:
        return reason
    return None


def user_safe_youtube_comment_insert_error(exc: BaseException) -> Optional[str]:
    """User copy for a documented Comments.insert reason."""
    code = youtube_comment_insert_error_code(exc)
    if not code:
        return None
    return _COMMENTS_INSERT_ERRORS[code]
