"""Tenant-level controls for task repetition and retry behavior."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from models.base import Base


class TaskMemorySettings(Base):
    __tablename__ = "task_memory_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), nullable=False, unique=True, index=True)
    exact_duplicate_window_days = Column(Integer, nullable=False, default=7)
    completed_repeat_window_days = Column(Integer, nullable=False, default=7)
    rejected_repeat_window_days = Column(Integer, nullable=False, default=30)
    failed_retry_window_days = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
