from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Boolean, Index
from sqlalchemy.orm import declarative_base, relationship
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

Base = declarative_base()

# ---------------------------------------------------------
# Pydantic Schemas for API Requests/Responses
# ---------------------------------------------------------
class AdCampaignRequest(BaseModel):
    product_name: str
    product_description: str
    target_audience: str
    platform: str = "meta"  # "meta" or "google"
    tone: str = "persuasive"
    num_variations: int = 3

class AdCopyVariation(BaseModel):
    headline: str
    primary_text: str
    call_to_action: str
    description: Optional[str] = None
    predicted_ctr: Optional[float] = None

class AdCampaignResponse(BaseModel):
    campaign_id: str
    platform: str
    variations: List[AdCopyVariation]
    recommended_keywords: List[str] = []
    
class AdCreativeRequest(BaseModel):
    campaign_id: str
    prompt: str
    aspect_ratio: str = "1:1" # e.g. 1:1, 9:16, 1.91:1

class AdCreativeResponse(BaseModel):
    image_url: str
    variation_id: Optional[str] = None

# ---------------------------------------------------------
# Database Models for Storage
# ---------------------------------------------------------
class AdCampaign(Base):
    __tablename__ = "ad_campaigns"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(100), nullable=False, index=True)
    product_name = Column(String(255), nullable=False)
    platform = Column(String(50), default="meta")
    created_at = Column(DateTime, default=datetime.utcnow)
    variations = Column(JSON, default=list) # Store generated variations as JSON
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('idx_ad_campaign_user', 'user_id'),
    )
