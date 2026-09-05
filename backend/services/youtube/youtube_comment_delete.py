"""Execute Comments.delete for HITL reply deletes (YouTube Data API v3).

Keeps youtube_comments_service.py under 500 lines.
DELETE with id only. No request body.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.youtube.youtube_comments_delete_errors import (
    YOUTUBE_COMMENTS_DELETE_QUOTA_COST,
    user_safe_youtube_comments_delete_error,
    youtube_comments_delete_error_code,
)
from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_log import (
    youtube_publish_error_log_fields,
    youtube_publish_error_status,
)


def _user_safe_delete_error(exc: BaseException) -> str:
    documented = user_safe_youtube_comments_delete_error(exc)
    if documented:
        return documented
    status = youtube_publish_error_status(exc)
    if status in (401,):
        return "YouTube auth failed. Please reconnect your YouTube channel."
    return "Could not delete that reply. Please try again."


def execute_youtube_comment_delete(
    oauth_service: YouTubeOAuthService,
    user_id: str,
    comment_id: str,
    token_id: Optional[int] = None,
) -> Dict[str, Any]:
    """DELETE comments.delete with id only. Never send a body."""
    comment = (comment_id or "").strip()
    logger.info(
        "[youtube_comments] Delete start user_id={} has_comment_id={} "
        "has_token_id={} quota_cost={}",
        user_id,
        bool(comment),
        bool(token_id),
        YOUTUBE_COMMENTS_DELETE_QUOTA_COST,
    )
    if not comment:
        logger.warning(
            "[youtube_comments] Delete skipped empty_comment_id user_id={}",
            user_id,
        )
        return {
            "success": False,
            "error_code": "comment_id_required",
            "message": "That comment could not be found. It may have been removed.",
        }
    try:
        creds = oauth_service.get_valid_credentials(user_id, token_id)
        if not creds:
            logger.warning(
                "[youtube_comments] Delete skipped not_connected user_id={}",
                user_id,
            )
            return {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube to delete that reply.",
            }

        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        youtube.comments().delete(id=comment).execute()
        logger.info(
            "[youtube_comments] Delete complete user_id={} has_comment_id={} quota_cost={}",
            user_id,
            True,
            YOUTUBE_COMMENTS_DELETE_QUOTA_COST,
        )
        return {"success": True, "message": "Reply deleted."}
    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        _status, youtube_reason = youtube_comment_http_error_reason(e)
        logger.error(
            "[youtube_comments] Delete failed user_id={} error_type={} "
            "http_status={} youtube_reason={} has_comment_id={} quota_cost={}",
            user_id,
            fields["error_type"],
            fields["http_status"],
            youtube_reason,
            True,
            YOUTUBE_COMMENTS_DELETE_QUOTA_COST,
        )
        return {
            "success": False,
            "error_code": youtube_comments_delete_error_code(e) or "delete_failed",
            "message": _user_safe_delete_error(e),
        }
