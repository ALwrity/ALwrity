"""
Podcast Maker Models

Database models for podcast project persistence and state management.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Text, Index
from sqlalchemy.orm import declarative_base
from datetime import datetime

# Use the same Base as subscription models for consistency
from models.subscription_models import Base


class PodcastProject(Base):
    """
    Database model for podcast project state.
    Stores complete project state to enable cross-device resume.
    """
    
    __tablename__ = "podcast_projects"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(255), unique=True, nullable=False, index=True)  # User-facing project ID
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    
    # Project metadata
    idea = Column(String(1000), nullable=False)  # Episode idea or URL
    duration = Column(Integer, nullable=False)  # Duration in minutes
    speakers = Column(Integer, nullable=False, default=1)  # Number of speakers
    budget_cap = Column(Float, nullable=False, default=50.0)  # Budget cap in USD
    
    # Project state (stored as JSON)
    # This mirrors the PodcastProjectState interface from frontend
    bible = Column(JSON, nullable=True)  # PodcastBible structured data
    analysis = Column(JSON, nullable=True)  # PodcastAnalysis
    queries = Column(JSON, nullable=True)  # List[Query]
    selected_queries = Column(JSON, nullable=True)  # Array of query IDs
    research = Column(JSON, nullable=True)  # Research object
    raw_research = Column(JSON, nullable=True)  # BlogResearchResponse
    estimate = Column(JSON, nullable=True)  # PodcastEstimate
    script_data = Column(JSON, nullable=True)  # Script object
    render_jobs = Column(JSON, nullable=True)  # List[Job]
    knobs = Column(JSON, nullable=True)  # Knobs settings
    research_provider = Column(String(50), nullable=True, default="google")  # Research provider
    
    # Project-specific topic context (category research, selected topics)
    topic_context = Column(JSON, nullable=True)  # { category: "news"|"finance", topics: [...], selected_topic: {...} }
    
    # UI state
    show_script_editor = Column(Boolean, default=False)
    show_render_queue = Column(Boolean, default=False)
    current_step = Column(String(50), nullable=True)  # 'create' | 'analysis' | 'research' | 'script' | 'render'
    
    # Status
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, in_progress, completed, archived
    is_favorite = Column(Boolean, default=False, index=True)
    
    # Final combined video URL (persisted for reloads)
    final_video_url = Column(String(1000), nullable=True)  # URL to final combined podcast video
    
    # Avatar details
    avatar_url = Column(String(1000), nullable=True)
    avatar_prompt = Column(Text, nullable=True)
    avatar_persona_id = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)
    
    # Composite indexes for common query patterns
    __table_args__ = (
        Index('idx_podcast_user_status_created', 'user_id', 'status', 'created_at'),
        Index('idx_podcast_user_favorite_updated', 'user_id', 'is_favorite', 'updated_at'),
    )

