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
    """Single comment on a LinkedIn post."""

    id: str
    text: str
    author: PostCommentAuthor
    created_at: str
    reply_count: int = 0
    reaction_count: int = 0


class PostCommentsListResponse(BaseModel):
    """Response for GET /post-analytics/posts/{social_id}/comments."""

    items: list[PostCommentItem] = Field(default_factory=list)
    cursor: Optional[str] = None
    has_more: bool = False
    total_count: Optional[int] = None


class PostCommentReplyRequest(BaseModel):
    """Request body for POST .../comments/reply."""

    comment_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, max_length=1250)


class PostCommentReplyResponse(BaseModel):
    """Response after posting a comment reply on LinkedIn."""

    success: bool = True
    comment_id: Optional[str] = None
