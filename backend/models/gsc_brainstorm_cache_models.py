"""
GSC Brainstorm Cache Model — per-user workspace DB persistence.

Stores serialized brainstorm results keyed by user + keyword-hash,
with a configurable TTL. Follows the WatchdogBase pattern used by
all other per-user workspace DB models.
"""

from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Index
from models.base import Base


class GSCBrainstormCache(Base):
    __tablename__ = "gsc_brainstorm_cache"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    keywords_hash = Column(String(128), nullable=False, index=True)
    keywords = Column(String(512), nullable=False)
    site_url = Column(String(500), nullable=True)
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)

    __table_args__ = (
        Index("ix_gsc_brainstorm_user_kw", "user_id", "keywords_hash", "site_url"),
    )
