"""
Comment Assistant progressive shell — post headers from analytics only (no Unipile).
"""

from __future__ import annotations

from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_comment_assistant_models import (
    CommentAssistantInboxResponse,
    CommentAssistantPostGroup,
    CommentAssistantPriority,
)
from services.linkedin_comment_assistant_cache_service import mask_user_id
from services.linkedin_comment_assistant_service import (
    OLDER_DAYS,
    post_snippet,
    select_candidate_posts,
)
from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService


def build_comment_assistant_inbox_shell(
    user_id: str,
    db: Session,
    *,
    priority: CommentAssistantPriority = "needs_reply",
) -> CommentAssistantInboxResponse:
    """
    Fast inbox shell: candidate posts with ``comments_pending=True``.

    Used so the UI can show post headers while the full Unipile inbox loads.
    Does not call Unipile and does not read/write the comment cache.
    """
    analytics = LinkedInPostAnalyticsService(db)
    stored = analytics.get_stored_analytics(user_id)
    candidates = select_candidate_posts(stored.posts)

    if not candidates:
        empty_reason = "no_analytics" if len(stored.posts) == 0 else "no_candidates"
        logger.info(
            "[CommentAssistant] shell empty user={} reason={}",
            mask_user_id(user_id),
            empty_reason,
        )
        return CommentAssistantInboxResponse(
            groups=[],
            priority=priority,
            posts_considered=0,
            older_days=OLDER_DAYS,
            counts={"needs_reply": 0, "active": 0, "older": 0},
            from_cache=False,
            empty_reason=empty_reason,
        )

    groups = [
        CommentAssistantPostGroup(
            post_id=post.id,
            social_id=(post.social_id or "").strip(),
            post_snippet=post_snippet(post.text or ""),
            post_text=(post.text or "").strip(),
            comment_count_hint=int(post.engagement.comments or 0),
            comments=[],
            comments_pending=True,
        )
        for post in candidates
    ]

    logger.info(
        "[CommentAssistant] shell ok user={} groups={}",
        mask_user_id(user_id),
        len(groups),
    )
    return CommentAssistantInboxResponse(
        groups=groups,
        priority=priority,
        posts_considered=len(candidates),
        older_days=OLDER_DAYS,
        counts={"needs_reply": 0, "active": 0, "older": 0},
        from_cache=False,
    )
