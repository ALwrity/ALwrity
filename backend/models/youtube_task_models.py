"""
YouTube Video Task Models

Database models for persistent tracking of YouTube video render,
combine, and publish tasks. Replaces the in-memory dict approach
so tasks survive server restarts.
"""

import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Float, Enum, Index
from models.base import Base


class YouTubeTaskType(enum.Enum):
    RENDER = "render"
    SCENE_RENDER = "scene_render"
    COMBINE = "combine"
    PUBLISH = "publish"
    IMAGE_GENERATION = "image_generation"
    AUDIO_GENERATION = "audio_generation"


class YouTubeTaskStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class YouTubeVideoTask(Base):
    """
    Persistent task tracking for YouTube Creator operations.

    Stores task state in PostgreSQL so that in-progress renders,
    combines, and publishes survive server restarts. The frontend
    can resume polling after a restart and recover results.
    """
    __tablename__ = "youtube_video_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(36), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    task_type = Column(Enum(YouTubeTaskType), nullable=False, default=YouTubeTaskType.RENDER)
    status = Column(Enum(YouTubeTaskStatus), nullable=False, default=YouTubeTaskStatus.PENDING)

    progress = Column(Float, default=0.0)
    message = Column(String(500), nullable=True)

    request_data = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index('idx_youtube_task_user_status', 'user_id', 'status'),
        Index('idx_youtube_task_user_type', 'user_id', 'task_type'),
        Index('idx_youtube_task_created', 'created_at'),
    )