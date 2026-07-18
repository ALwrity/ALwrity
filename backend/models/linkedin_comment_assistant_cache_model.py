"""Comment Assistant inbox cache — workspace DB persistence (post-analytics / PYMK pattern)."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint

from models.subscription_models import Base


class LinkedInCommentAssistantCache(Base):
    """Cached Comment Assistant inbox snapshot per workspace user."""

    __tablename__ = "comment_assistant_inbox_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    cache_key = Column(
        String(50),
        nullable=False,
        default="inbox",
        comment="Fixed key for full inbox snapshot (priority filtered in memory)",
    )
    response_json = Column(
        Text,
        nullable=False,
        comment="Serialized CommentAssistantInboxResponse JSON (priority=all groups)",
    )
    last_synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    stored_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "cache_key", name="uq_user_comment_assistant_cache"),
        Index(
            "ix_comment_assistant_inbox_cache_user_synced",
            "user_id",
            "last_synced_at",
        ),
    )
