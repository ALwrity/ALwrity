"""
Story Project Models

Database models for Story Studio project persistence and state management.
Modeled after PodcastProject and ResearchProject for cross-device resume.
"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Index

from models.base import Base


class StoryProject(Base):
    """
    Database model for Story Studio project state.
    Stores complete story project state to enable cross-device resume.
    """

    __tablename__ = "story_projects"

    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)

    # Project metadata
    title = Column(String(500), nullable=True)
    story_mode = Column(String(50), nullable=True)
    story_template = Column(String(100), nullable=True)

    # Story state (stored as JSON)
    setup = Column(JSON, nullable=True)
    outline = Column(JSON, nullable=True)
    scenes = Column(JSON, nullable=True)
    story_content = Column(JSON, nullable=True)
    anime_bible = Column(JSON, nullable=True)
    media_state = Column(JSON, nullable=True)

    # UI/progress state
    current_phase = Column(String(50), nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)
    is_favorite = Column(Boolean, default=False, index=True)
    is_complete = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index("idx_story_user_status_created", "user_id", "status", "created_at"),
        Index("idx_story_user_favorite_updated", "user_id", "is_favorite", "updated_at"),
    )

