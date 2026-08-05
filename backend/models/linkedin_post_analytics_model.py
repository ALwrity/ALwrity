"""LinkedIn Post Analytics Model — DB persistence for fetched post metrics."""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, Index, UniqueConstraint, JSON
from datetime import datetime

from models.base import Base


class LinkedInPostAnalytics(Base):
    """Persistent store for LinkedIn post analytics fetched from Unipile."""

    __tablename__ = "linkedin_post_analytics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)

    post_id = Column(String(255), nullable=False, comment="Unipile post URN")
    social_id = Column(String(255), nullable=True)
    text = Column(Text, nullable=True)
    title = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=True, comment="Post publish datetime")

    reactions = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    followers_gained = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)
    # Optional Unipile analytics.* fields (null when provider omitted them)
    engagements = Column(Integer, nullable=True)
    clickthrough_rate = Column(Float, nullable=True)
    page_viewers = Column(Integer, nullable=True)
    members_reached = Column(Integer, nullable=True)

    author_name = Column(String(255), nullable=True)
    author_headline = Column(String(500), nullable=True)
    author_public_identifier = Column(String(255), nullable=True)
    author_avatar_url = Column(String(1000), nullable=True)

    share_url = Column(String(1000), nullable=True)
    attachments_json = Column(JSON, nullable=True, comment="Post media attachments from Unipile")
    is_repost = Column(Boolean, default=False)
    is_company_post = Column(Boolean, default=False)

    last_synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    stored_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post"),
        Index("ix_linkedin_post_analytics_user_synced", "user_id", "last_synced_at"),
    )
