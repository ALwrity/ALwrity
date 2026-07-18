"""
Content Asset Models
Unified database models for tracking all AI-generated content assets across all modules.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Text, ForeignKey, Enum, Index, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

# Use the same Base as subscription models for consistency
from models.subscription_models import Base


class AssetType(enum.Enum):
    """Types of content assets."""
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class AssetSource(enum.Enum):
    # Add youtube_creator to the enum
    """Source module/tool that generated the asset."""
    # Core Content Generation
    STORY_WRITER = "story_writer"
    IMAGE_STUDIO = "image_studio"
    MAIN_TEXT_GENERATION = "main_text_generation"
    MAIN_IMAGE_GENERATION = "main_image_generation"
    MAIN_VIDEO_GENERATION = "main_video_generation"
    MAIN_AUDIO_GENERATION = "main_audio_generation"
    
    # Social Media Writers
    BLOG_WRITER = "blog_writer"
    LINKEDIN_WRITER = "linkedin_writer"
    FACEBOOK_WRITER = "facebook_writer"
    
    # SEO & Content Tools
    SEO_TOOLS = "seo_tools"
    CONTENT_PLANNING = "content_planning"
    WRITING_ASSISTANT = "writing_assistant"
    
    # Research & Strategy
    RESEARCH_TOOLS = "research_tools"
    CONTENT_STRATEGY = "content_strategy"
    
    # Product Marketing Suite
    PRODUCT_MARKETING = "product_marketing"

    # Podcast Maker
    PODCAST_MAKER = "podcast_maker"
    
    # YouTube Creator
    YOUTUBE_CREATOR = "youtube_creator"

    # Brand Avatar Generator
    BRAND_AVATAR_GENERATOR = "brand_avatar_generator"

    # Video Studio
    VIDEO_STUDIO = "video_studio"

    # Voice Cloner
    VOICE_CLONER = "voice_cloner"

    # GIF Maker
    GIF_MAKER = "gif_maker"


class ContentAsset(Base):
    """
    Unified model for tracking all AI-generated content assets.
    Similar to subscription tracking, this provides a centralized way to manage all content.
    """
    
    __tablename__ = "content_assets"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    
    # Asset identification
    asset_type = Column(Enum(AssetType), nullable=False, index=True)
    source_module = Column(Enum(AssetSource), nullable=False, index=True)
    
    # File information
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=True)  # Server file path
    file_url = Column(String(1000), nullable=False)  # Public URL
    file_size = Column(Integer, nullable=True)  # Size in bytes
    mime_type = Column(String(100), nullable=True)  # MIME type
    
    # Asset metadata
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    prompt = Column(Text, nullable=True)  # Original prompt used for generation
    tags = Column(JSON, nullable=True)  # Array of tags for search/filtering
    asset_metadata = Column(JSON, nullable=True)  # Additional module-specific metadata (renamed from 'metadata' to avoid SQLAlchemy conflict)
    
    # Generation details
    provider = Column(String(100), nullable=True)  # AI provider used (e.g., "stability", "gemini")
    model = Column(String(100), nullable=True)  # Model used
    cost = Column(Float, nullable=True, default=0.0)  # Generation cost in USD
    generation_time = Column(Float, nullable=True)  # Time taken in seconds
    
    # Organization
    is_favorite = Column(Boolean, default=False, index=True)
    collection_id = Column(Integer, ForeignKey('asset_collections.id'), nullable=True)
    
    # Usage tracking
    download_count = Column(Integer, default=0)
    share_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    collection = relationship(
        "AssetCollection", 
        back_populates="assets", 
        foreign_keys=[collection_id]
    )
    
    # Composite indexes for common query patterns
    __table_args__ = (
        Index('idx_user_type_source', 'user_id', 'asset_type', 'source_module'),
        Index('idx_user_favorite_created', 'user_id', 'is_favorite', 'created_at'),
        Index('idx_user_tags', 'user_id', 'tags'),
    )


class AssetCollection(Base):
    """
    Collections/albums for organizing assets.
    """
    
    __tablename__ = "asset_collections"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False)
    cover_asset_id = Column(Integer, ForeignKey('content_assets.id'), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    assets = relationship(
        "ContentAsset", 
        back_populates="collection", 
        foreign_keys="[ContentAsset.collection_id]",
        cascade="all, delete-orphan"  # Cascade delete on the "one" side (one-to-many)
    )
    cover_asset = relationship(
        "ContentAsset", 
        foreign_keys=[cover_asset_id], 
        uselist=False
    )

