"""Shared persistent state models for content strategy runtime state."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, JSON, Index

from models.base import Base


class StrategyGenerationTaskState(Base):
    """Stores task lifecycle/status for polling-based AI generation."""

    __tablename__ = "strategy_generation_task_state"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    task_id = Column(String(255), nullable=False, unique=True, index=True)
    status_payload = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class LatestGeneratedStrategyState(Base):
    """Stores references to latest generated strategy payload per user/resource."""

    __tablename__ = "latest_generated_strategy_state"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    resource_id = Column(String(255), nullable=False, default="comprehensive", index=True)
    strategy_payload = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_latest_generated_strategy_user_resource", "user_id", "resource_id", unique=True),
    )


class StreamingCacheState(Base):
    """Stores short-lived streaming cache entries with TTL semantics."""

    __tablename__ = "streaming_cache_state"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    cache_key = Column(String(255), nullable=False, index=True)
    cache_payload = Column(JSON, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_streaming_cache_user_key", "user_id", "cache_key", unique=True),
    )
