"""SQLAlchemy model for a per-user YouTube Channel Bible profile."""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String

from models.base import Base


class YouTubeChannelBibleRow(Base):
    """One saved YouTube channel profile per user (JSON profile column)."""

    __tablename__ = "youtube_channel_bibles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), unique=True, nullable=False, index=True)
    profile = Column(JSON, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
