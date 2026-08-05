"""
Product Asset Models
Database models for storing product-specific assets (separate from campaign assets).
These models are for the Product Marketing Suite (product asset creation).
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from models.base import Base


class ProductAssetType(enum.Enum):
    """Product asset type enum."""
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    ANIMATION = "animation"


class ProductImageStyle(enum.Enum):
    """Product image style enum."""
    STUDIO = "studio"
    LIFESTYLE = "lifestyle"
    OUTDOOR = "outdoor"
    MINIMALIST = "minimalist"
    LUXURY = "luxury"
    TECHNICAL = "technical"


class ProductAsset(Base):
    """
    Product asset model.
    Stores product-specific assets (images, videos, audio) generated for product marketing.
    """
    
    __tablename__ = "product_assets"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(255), nullable=False, index=True)  # User-defined product ID
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    
    # Product information
    product_name = Column(String(500), nullable=False)
    product_description = Column(Text, nullable=True)
    
    # Asset details
    asset_type = Column(String(50), nullable=False, index=True)  # image, video, audio, animation
    variant = Column(String(100), nullable=True)  # color, size, angle, etc.
    style = Column(String(50), nullable=True)  # studio, lifestyle, minimalist, etc.
    environment = Column(String(50), nullable=True)  # studio, lifestyle, outdoor, etc.
    
    # Link to ContentAsset (unified asset library)
    content_asset_id = Column(Integer, ForeignKey('content_assets.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Generation details
    provider = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    cost = Column(Float, default=0.0)
    generation_time = Column(Float, nullable=True)
    prompt_used = Column(Text, nullable=True)
    
    # E-commerce integration
    ecommerce_exported = Column(Boolean, default=False)
    exported_to = Column(JSON, nullable=True)  # Array of platform names
    
    # Status
    status = Column(String(50), default="completed", nullable=False)  # completed, processing, failed
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional metadata (renamed from 'metadata' to avoid SQLAlchemy reserved name conflict)
    # Using 'product_metadata' as column name in DB to avoid conflict with SQLAlchemy's reserved 'metadata' attribute
    product_metadata = Column('product_metadata', JSON, nullable=True)  # Additional product-specific metadata
    
    # Composite indexes
    __table_args__ = (
        Index('idx_user_product', 'user_id', 'product_id'),
        Index('idx_user_type', 'user_id', 'asset_type'),
        Index('idx_product_type', 'product_id', 'asset_type'),
    )


class ProductStyleTemplate(Base):
    """
    Brand style template for products.
    Stores reusable brand style configurations for product asset generation.
    """
    
    __tablename__ = "product_style_templates"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    template_name = Column(String(255), nullable=False)
    
    # Style configuration
    color_palette = Column(JSON, nullable=True)  # Array of brand colors
    background_style = Column(String(50), nullable=True)  # white, transparent, lifestyle, branded
    lighting_preset = Column(String(50), nullable=True)  # natural, studio, dramatic, soft
    preferred_style = Column(String(50), nullable=True)  # photorealistic, minimalist, luxury, technical
    preferred_environment = Column(String(50), nullable=True)  # studio, lifestyle, outdoor
    
    # Brand integration
    use_brand_colors = Column(Boolean, default=True)
    use_brand_logo = Column(Boolean, default=False)
    
    # Metadata
    is_default = Column(Boolean, default=False)  # Default template for user
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Composite indexes
    __table_args__ = (
        Index('idx_user_template', 'user_id', 'template_name'),
    )


class EcommerceExport(Base):
    """
    E-commerce platform export tracking.
    Tracks product asset exports to e-commerce platforms.
    """
    
    __tablename__ = "product_ecommerce_exports"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    product_id = Column(String(255), nullable=False, index=True)
    
    # Platform information
    platform = Column(String(50), nullable=False)  # shopify, amazon, woocommerce
    platform_product_id = Column(String(255), nullable=True)  # Product ID on the platform
    
    # Export details
    exported_assets = Column(JSON, nullable=False)  # Array of asset IDs exported
    export_status = Column(String(50), default="pending", nullable=False)  # pending, completed, failed
    error_message = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    exported_at = Column(DateTime, nullable=True)
    
    # Composite indexes
    __table_args__ = (
        Index('idx_user_platform', 'user_id', 'platform'),
        Index('idx_product_platform', 'product_id', 'platform'),
    )

