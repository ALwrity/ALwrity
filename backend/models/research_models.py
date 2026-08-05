"""
Research Project Models

Database models for research project persistence and state management.
Similar to PodcastProject, but for research projects.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Index
from datetime import datetime

# Use the same Base as subscription models for consistency
from models.base import Base


class ResearchProject(Base):
    """
    Database model for research project state.
    Stores complete research project state to enable cross-device resume.
    """
    
    __tablename__ = "research_projects"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String(255), unique=True, nullable=False, index=True)  # User-facing project ID
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    
    # Project metadata
    title = Column(String(500), nullable=True)  # Project title
    keywords = Column(JSON, nullable=False)  # List of keywords
    industry = Column(String(255), nullable=True)
    target_audience = Column(String(255), nullable=True)
    research_mode = Column(String(50), nullable=True, default="comprehensive")  # basic, comprehensive, expert
    
    # Project state (stored as JSON)
    config = Column(JSON, nullable=True)  # ResearchConfig
    intent_analysis = Column(JSON, nullable=True)  # AnalyzeIntentResponse
    confirmed_intent = Column(JSON, nullable=True)  # ResearchIntent
    intent_result = Column(JSON, nullable=True)  # IntentDrivenResearchResponse
    legacy_result = Column(JSON, nullable=True)  # BlogResearchResponse (for backward compatibility)
    trends_config = Column(JSON, nullable=True)  # Google Trends configuration
    
    # UI state
    current_step = Column(Integer, default=1, nullable=False)  # 1=Input, 2=Progress, 3=Results
    
    # Status
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, in_progress, completed, archived
    is_favorite = Column(Boolean, default=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, index=True)
    
    # Composite indexes for common query patterns
    __table_args__ = (
        Index('idx_research_user_status_created', 'user_id', 'status', 'created_at'),
        Index('idx_research_user_favorite_updated', 'user_id', 'is_favorite', 'updated_at'),
    )
