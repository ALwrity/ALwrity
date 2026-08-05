"""
Product Marketing Campaign Models
Database models for storing campaign blueprints and asset proposals.
"""

from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, JSON, Text, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from models.base import Base


class CampaignStatus(enum.Enum):
    """Campaign status enum."""
    DRAFT = "draft"
    GENERATING = "generating"
    READY = "ready"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class AssetNodeStatus(enum.Enum):
    """Asset node status enum."""
    DRAFT = "draft"
    PROPOSED = "proposed"
    GENERATING = "generating"
    READY = "ready"
    APPROVED = "approved"
    REJECTED = "rejected"


class Campaign(Base):
    """
    Campaign blueprint model.
    Stores campaign information, phases, and asset nodes.
    """
    
    __tablename__ = "product_marketing_campaigns"
    
    # Primary fields
    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    
    # Campaign details
    campaign_name = Column(String(500), nullable=False)
    goal = Column(String(100), nullable=False)  # product_launch, awareness, conversion, etc.
    kpi = Column(String(500), nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)
    
    # Campaign structure
    phases = Column(JSON, nullable=True)  # Array of phase objects
    channels = Column(JSON, nullable=False)  # Array of channel strings
    asset_nodes = Column(JSON, nullable=True)  # Array of asset node objects
    
    # Product context
    product_context = Column(JSON, nullable=True)  # Product information
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    proposals = relationship("CampaignProposal", back_populates="campaign", cascade="all, delete-orphan")
    generated_assets = relationship("CampaignAsset", back_populates="campaign", cascade="all, delete-orphan")
    
    # Composite indexes
    __table_args__ = (
        Index('idx_pm_campaign_user_status', 'user_id', 'status'),
        Index('idx_pm_campaign_user_created', 'user_id', 'created_at'),
    )


class CampaignProposal(Base):
    """
    Asset proposals for a campaign.
    Stores AI-generated proposals for each asset node.
    """
    
    __tablename__ = "product_marketing_proposals"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(String(255), ForeignKey('product_marketing_campaigns.campaign_id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    
    # Asset node reference
    asset_node_id = Column(String(255), nullable=False, index=True)
    asset_type = Column(String(50), nullable=False)  # image, text, video, audio
    channel = Column(String(50), nullable=False)
    
    # Proposal details
    proposed_prompt = Column(Text, nullable=False)
    recommended_template = Column(String(255), nullable=True)
    recommended_provider = Column(String(100), nullable=True)
    recommended_model = Column(String(100), nullable=True)
    cost_estimate = Column(Float, default=0.0)
    concept_summary = Column(Text, nullable=True)
    
    # Status
    status = Column(String(50), default="proposed", nullable=False)  # proposed, approved, rejected, generating
    approved_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="proposals")
    generated_asset = relationship("CampaignAsset", back_populates="proposal", uselist=False)
    
    ## Composite indexes
    __table_args__ = (
        Index('idx_pm_proposal_campaign_node', 'campaign_id', 'asset_node_id'),
        Index('idx_pm_proposal_user_status', 'user_id', 'status'),
    )


class CampaignAsset(Base):
    """
    Generated assets for a campaign.
    Links to ContentAsset and stores campaign-specific metadata.
    """
    
    __tablename__ = "product_marketing_assets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(String(255), ForeignKey('product_marketing_campaigns.campaign_id', ondelete='CASCADE'), nullable=False, index=True)
    proposal_id = Column(Integer, ForeignKey('product_marketing_proposals.id', ondelete='SET NULL'), nullable=True)
    user_id = Column(String(255), nullable=False, index=True)
    
    # Asset node reference
    asset_node_id = Column(String(255), nullable=False, index=True)
    
    # Link to ContentAsset
    content_asset_id = Column(Integer, ForeignKey('content_assets.id', ondelete='SET NULL'), nullable=True)
    
    # Generation details
    provider = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    cost = Column(Float, default=0.0)
    generation_time = Column(Float, nullable=True)
    
    # Status
    status = Column(String(50), default="generating", nullable=False)  # generating, ready, approved, published
    approved_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="generated_assets")
    proposal = relationship("CampaignProposal", back_populates="generated_asset")
    
    # Composite indexes
    __table_args__ = (
        Index('idx_pm_asset_campaign_node', 'campaign_id', 'asset_node_id'),
        Index('idx_pm_asset_user_status', 'user_id', 'status'),
    )

