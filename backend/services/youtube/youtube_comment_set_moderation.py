"""Execute Comments.setModerationStatus for HITL parent hide / hide-user.

Keeps youtube_comments_service.py under 500 lines.
Always moderationStatus=rejected. banAuthor only when True.
Never comments.delete. Never log comment ids or author names.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.youtube.youtube_comments_insert_errors import (
    youtube_comment_http_error_reason,
)
from services.youtube.youtube_comments_set_moderation_errors import (
    YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST,
    user_safe_youtube_comments_set_moderation_error,
    youtube_comments_set_moderation_error_code,
)
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_log import (
    youtube_publish_error_log_fields,
    youtube_publish_error_status,
)

_REJECTED = "rejected"


def _user_safe_moderate_error(exc: BaseException) -> str:
    documented = user_safe_youtube_comments_set_moderation_error(exc)
    if documented:
        return documented
    status = youtube_publish_error_status(exc)
    if status in (401,):
        return "YouTube auth failed. Please reconnect your YouTube channel."
    return "Could not hide that comment. Please try again."


def execute_youtube_comment_set_moderation(
    oauth_service: YouTubeOAuthService,
    user_id: str,
    comment_id: str,
    ban_author: bool = False,
    token_id: Optional[int] = None,
) -> Dict[str, Any]:
    """POST comments.setModerationStatus rejected. banAuthor only if True."""
    comment = (comment_id or "").strip()
    hide_user = bool(ban_author)
    logger.info(
        "[youtube_comments] Moderate start user_id={} has_comment_id={} "
        "ban_author={} has_token_id={} quota_cost={}",
        user_id,
        bool(comment),
        hide_user,
        bool(token_id),
        YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST,
    )
    if not comment:
        logger.warning(
            "[youtube_comments] Moderate skipped empty_comment_id user_id={}",
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
                "[youtube_comments] Moderate skipped not_connected user_id={}",
                user_id,
            )
            return {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube to hide that comment.",
            }

        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        request_kwargs: Dict[str, Any] = {
            "id": comment,
            "moderationStatus": _REJECTED,
        }
        if hide_user:
            request_kwargs["banAuthor"] = True
        youtube.comments().setModerationStatus(**request_kwargs).execute()
        logger.info(
            "[youtube_comments] Moderate complete user_id={} has_comment_id={} "
            "ban_author={} quota_cost={}",
            user_id,
            True,
            hide_user,
            YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST,
        )
        return {
            "success": True,
            "message": (
                "User hidden from the channel."
                if hide_user
                else "Comment hidden."
            ),
        }
    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        _status, youtube_reason = youtube_comment_http_error_reason(e)
        logger.error(
            "[youtube_comments] Moderate failed user_id={} error_type={} "
            "http_status={} youtube_reason={} ban_author={} has_comment_id={} "
            "quota_cost={}",
            user_id,
            fields["error_type"],
            fields["http_status"],
            youtube_reason,
            hide_user,
            True,
            YOUTUBE_COMMENTS_SET_MODERATION_QUOTA_COST,
        )
        return {
            "success": False,
            "error_code": youtube_comments_set_moderation_error_code(e)
            or "moderate_failed",
            "message": _user_safe_moderate_error(e),
        }
