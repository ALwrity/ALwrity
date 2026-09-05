"""Execute Comments.update for HITL reply edits (YouTube Data API v3).

Keeps youtube_comments_service.py under 500 lines.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)
from services.youtube.youtube_comments_update_errors import (
    YOUTUBE_COMMENTS_UPDATE_QUOTA_COST,
    user_safe_youtube_comments_update_error,
    youtube_comments_update_error_code,
)
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_log import (
    youtube_publish_error_log_fields,
    youtube_publish_error_status,
)


def _user_safe_update_error(exc: BaseException) -> str:
    documented = user_safe_youtube_comments_update_error(exc)
    if documented:
        return documented
    status = youtube_publish_error_status(exc)
    if status in (401,):
        return "YouTube auth failed. Please reconnect your YouTube channel."
    return "Could not save that edit. Please try again."


def execute_youtube_comment_update(
    oauth_service: YouTubeOAuthService,
    user_id: str,
    comment_id: str,
    text: str,
    token_id: Optional[int] = None,
) -> Dict[str, Any]:
    """PUT comments.update with part=snippet. Never send parentId."""
    comment = (comment_id or "").strip()
    body_text = (text or "").strip()
    logger.info(
        "[youtube_comments] Update start user_id={} has_comment_id={} text_length={} "
        "has_token_id={} quota_cost={}",
        user_id,
        bool(comment),
        len(body_text),
        bool(token_id),
        YOUTUBE_COMMENTS_UPDATE_QUOTA_COST,
    )
    if not comment:
        logger.warning(
            "[youtube_comments] Update skipped empty_comment_id user_id={}",
            user_id,
        )
        return {
            "success": False,
            "error_code": "comment_id_required",
            "message": "That comment could not be found. It may have been removed.",
        }
    if not body_text:
        logger.warning(
            "[youtube_comments] Update skipped empty_text user_id={}",
            user_id,
        )
        return {
            "success": False,
            "error_code": "empty_text",
            "message": "Reply text is required.",
        }
    try:
        creds = oauth_service.get_valid_credentials(user_id, token_id)
        if not creds:
            logger.warning(
                "[youtube_comments] Update skipped not_connected user_id={}",
                user_id,
            )
            return {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube to edit that reply.",
            }

        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        resp = (
            youtube.comments()
            .update(
                part="snippet",
                body={
                    "id": comment,
                    "snippet": {"textOriginal": body_text},
                },
            )
            .execute()
        )
        snippet = resp.get("snippet") if isinstance(resp.get("snippet"), dict) else {}
        saved = str(snippet.get("textDisplay") or snippet.get("textOriginal") or "").strip()
        text_out = saved or body_text
        logger.info(
            "[youtube_comments] Update complete user_id={} has_comment_id={} "
            "text_length={} quota_cost={}",
            user_id,
            True,
            len(text_out),
            YOUTUBE_COMMENTS_UPDATE_QUOTA_COST,
        )
        return {
            "success": True,
            "comment_id": resp.get("id") or comment,
            "text": text_out,
            "message": "Reply updated.",
        }
    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        _status, youtube_reason = youtube_comment_http_error_reason(e)
        logger.error(
            "[youtube_comments] Update failed user_id={} error_type={} "
            "http_status={} youtube_reason={} has_comment_id={} quota_cost={}",
            user_id,
            fields["error_type"],
            fields["http_status"],
            youtube_reason,
            True,
            YOUTUBE_COMMENTS_UPDATE_QUOTA_COST,
        )
        return {
            "success": False,
            "error_code": youtube_comments_update_error_code(e) or "update_failed",
            "message": _user_safe_update_error(e),
        }
