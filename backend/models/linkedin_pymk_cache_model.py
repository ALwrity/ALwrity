"""LinkedIn PYMK cache model — workspace DB persistence for suggestion lists."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text, UniqueConstraint

from models.subscription_models import Base


class LinkedInPymkCache(Base):
    """Cached People You May Know response per user, cohort, and cohort id."""

    __tablename__ = "linkedin_pymk_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    cohort = Column(String(50), nullable=False)
    cohort_id = Column(String(255), nullable=False, default="", comment="Resolved cohort id or empty")
    response_json = Column(Text, nullable=False, comment="Serialized PymkListResponse JSON")
    last_synced_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    stored_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "cohort", "cohort_id", name="uq_user_pymk_cohort"),
        Index("ix_linkedin_pymk_cache_user_synced", "user_id", "last_synced_at"),
    )
