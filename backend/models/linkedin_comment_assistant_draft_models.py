"""Pydantic models for Comment Assistant Draft with ALwrity (Issue #188)."""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator

CommentAssistantDraftTone = Literal[
    "professional",
    "friendly",
    "appreciative",
    "value_add",
    "clarifying",
]


class CommentAssistantDraftReplyRequest(BaseModel):
    """Request to draft a reply to a LinkedIn comment with ALwrity."""

    social_id: str = Field(
        ...,
        description="LinkedIn social_id of the post containing the comment",
        min_length=3,
        max_length=500,
    )
    comment_id: str = Field(
        ...,
        description="LinkedIn comment or reply id to respond to",
        min_length=3,
        max_length=500,
    )
    post_text: str = Field(
        ...,
        description="Full text of the original LinkedIn post",
        min_length=10,
        max_length=8000,
    )
    comment_text: str = Field(
        ...,
        description="Text of the comment or reply to respond to",
        min_length=3,
        max_length=2000,
    )
    parent_comment_text: Optional[str] = Field(
        default=None,
        description="When drafting a reply to a nested reply, the parent top-level comment text",
        max_length=2000,
    )
    tone: CommentAssistantDraftTone = Field(
        default="professional",
        description="Desired tone of the drafted reply",
    )
    include_question: bool = Field(
        default=False,
        description="Whether the reply should end with an engaging question",
    )
    refresh: bool = Field(
        default=False,
        description="Bypass workspace draft cache and regenerate",
    )

    @field_validator("post_text", "comment_text", "parent_comment_text")
    @classmethod
    def _strip_whitespace(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            return v.strip()
        return v


class CommentAssistantDraftReplyResponse(BaseModel):
    """Response from drafting a reply to a LinkedIn comment with ALwrity."""

    success: bool = Field(default=True, description="Whether the draft was generated")
    reply: Optional[str] = Field(
        default=None, description="Primary drafted reply text"
    )
    alternative_replies: list[str] = Field(
        default_factory=list,
        description="Alternative reply options (optional, may be empty)",
    )
    from_cache: bool = Field(
        default=False, description="True when served from workspace draft cache"
    )
    generation_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Model, timing, and flow metadata for observability",
    )
    error: Optional[str] = Field(
        default=None, description="Plain-language error when success is False"
    )
