"""Shared persistent state models for content strategy runtime state."""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, JSON, Index

from models.base import Base


class StrategyWizardState(Base):
    """Stores per-user content strategy wizard progress.

    Persisted per user workspace (same schema applied to each user's SQLite DB
    via Alembic), keyed by ``user_id`` — one wizard state per user.
    """

    __tablename__ = "strategy_wizard_state"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, unique=True, index=True)
    current_step = Column(Integer, nullable=False, default=1)
    status = Column(String(50), nullable=False, default="in_progress")
    progress = Column(Integer, nullable=False, default=0)
    step_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "current_step": self.current_step,
            "status": self.status,
            "progress": self.progress,
            "step_data": self.step_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


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
