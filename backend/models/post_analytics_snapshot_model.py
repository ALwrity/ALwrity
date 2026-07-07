"""Post Analytics Snapshot Model — time-series log of per-post metric values."""

from sqlalchemy import Column, Integer, String, DateTime, Float, Index, UniqueConstraint
from datetime import datetime

from models.subscription_models import Base


class PostAnalyticsSnapshot(Base):
    __tablename__ = "post_analytics_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    post_id = Column(String(255), nullable=False)

    snapshot_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    reactions = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    followers_gained = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)

    def __repr__(self) -> str:
        return (
            f"<PostAnalyticsSnapshot(post_id={self.post_id!r}, "
            f"snapshot_at={self.snapshot_at}, "
            f"reactions={self.reactions}, comments={self.comments})>"
        )

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", "snapshot_at", name="uq_user_post_snapshot"),
        Index("ix_snapshot_user_time", "user_id", "snapshot_at"),
    )
