"""
Pydantic models for LinkedIn post comments API (Unipile proxy).
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PostCommentAuthor(BaseModel):
    """Comment author profile fields normalized for the frontend."""

    name: str
    headline: Optional[str] = None
    avatar_url: Optional[str] = None
    profile_url: Optional[str] = None


class PostCommentItem(BaseModel):
    """Single comment on a LinkedIn post (or a nested reply)."""

    id: str
    text: str
    author: PostCommentAuthor
    created_at: str
    reply_count: int = 0
    reaction_count: int = 0
    impressions_count: int = 0
    user_reacted: Optional[str] = Field(
        default=None,
        description="Reaction type if the connected account reacted (e.g. LIKE)",
    )
    parent_comment_id: Optional[str] = Field(
        default=None,
        description="Parent comment id when this item is a nested reply",
    )
    image_url: Optional[str] = Field(
        default=None,
        description="Attached image URL when the comment includes media",
    )


class PostCommentsListResponse(BaseModel):
    """Response for GET /post-analytics/posts/{social_id}/comments."""

    items: list[PostCommentItem] = Field(default_factory=list)
    cursor: Optional[str] = None
    has_more: bool = False
    total_count: Optional[int] = None


class PostCommentMention(BaseModel):
    """LinkedIn mention entry for Unipile comment text ``{{n}}`` placeholders."""

    name: str = Field(..., min_length=1)
    profile_id: str = Field(..., min_length=1)


class PostCommentReplyRequest(BaseModel):
    """Request body for POST .../comments/reply."""

    comment_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, max_length=1250)
    mentions: Optional[list[PostCommentMention]] = Field(
        default=None,
        description="Optional LinkedIn mentions matching {{0}}, {{1}}, … in text",
    )


class PostCommentReplyResponse(BaseModel):
    """Response after posting a comment reply on LinkedIn."""

    success: bool = True
    comment_id: Optional[str] = None
