"""
Pydantic models for Comment Assistant inbox API (Issue #73).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from models.linkedin_post_comments_models import PostCommentAuthor


CommentAssistantPriority = Literal["needs_reply", "active", "older", "all"]


class CommentAssistantReplyPreview(BaseModel):
    """Nested reply preview (often the connected user's reply)."""

    id: str
    text: str
    author_name: str = "You"
    author_id: Optional[str] = Field(
        default=None,
        description="Author provider id for mentions when replying to this reply",
    )
    created_at: str = ""
    is_mine: bool = False
    image_url: Optional[str] = Field(
        default=None,
        description="Attached image URL when the reply includes media",
    )
    reaction_count: int = 0
    user_reacted: Optional[str] = None


class CommentAssistantCommentItem(BaseModel):
    """Inbox comment with priority flags for triage tabs."""

    id: str
    text: str
    author: PostCommentAuthor
    author_id: Optional[str] = Field(
        default=None,
        description="LinkedIn/Unipile author id when available (for self-detection)",
    )
    created_at: str = ""
    reply_count: int = 0
    reaction_count: int = 0
    user_reacted: Optional[str] = None
    image_url: Optional[str] = Field(
        default=None,
        description="Attached image URL when the comment includes media",
    )
    needs_reply: bool = False
    priority: Literal["needs_reply", "active", "older"] = "needs_reply"
    my_replies: list[CommentAssistantReplyPreview] = Field(
        default_factory=list,
        description="Replies authored by the connected user (best-effort first page)",
    )


class CommentAssistantPostGroup(BaseModel):
    """One of the user's posts with its inbox comments (or a soft error)."""

    post_id: str
    social_id: str
    post_snippet: str
    post_text: str = Field(
        default="",
        description="Full post text for See more expand in the UI",
    )
    comment_count_hint: int = Field(
        default=0,
        description="Engagement comment count from post analytics (hint only)",
    )
    comments: list[CommentAssistantCommentItem] = Field(default_factory=list)
    has_more_comments: bool = False
    comments_cursor: Optional[str] = None
    error: Optional[str] = Field(
        default=None,
        description="Soft-fail message when this post's comments could not load",
    )


class CommentAssistantInboxResponse(BaseModel):
    """Response for GET /comment-assistant/inbox."""

    groups: list[CommentAssistantPostGroup] = Field(default_factory=list)
    priority: CommentAssistantPriority = "needs_reply"
    posts_considered: int = 0
    older_days: int = 14
    counts: dict[str, int] = Field(
        default_factory=dict,
        description="Totals across loaded comments: needs_reply, active, older",
    )


class CommentAssistantLikeRequest(BaseModel):
    """Request body for liking a comment (Unipile v1 needs post social_id)."""

    post_social_id: str = Field(..., min_length=1)
    reaction_type: str = Field(default="like", min_length=1)


class CommentAssistantLikeResponse(BaseModel):
    """Response after liking a comment via Unipile v1."""

    success: bool = True
    comment_id: str
    reaction_type: str = "like"
