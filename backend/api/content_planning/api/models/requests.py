"""
Request Models for Content Planning API
Extracted from the main content_planning.py file for better organization.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

# Content Strategy Request Models
class ContentStrategyRequest(BaseModel):
    industry: str
    target_audience: Dict[str, Any]
    business_goals: List[str]
    content_preferences: Dict[str, Any]
    competitor_urls: Optional[List[str]] = None

class ContentStrategyCreate(BaseModel):
    user_id: Optional[str] = None
    name: str
    industry: str
    target_audience: Dict[str, Any]
    content_pillars: Optional[List[Dict[str, Any]]] = None
    ai_recommendations: Optional[Dict[str, Any]] = None

# Calendar Event Request Models
class CalendarEventCreate(BaseModel):
    strategy_id: int
    title: str
    description: str
    content_type: str
    platform: str
    scheduled_date: datetime
    ai_recommendations: Optional[Dict[str, Any]] = None

# Content Gap Analysis Request Models
class ContentGapAnalysisCreate(BaseModel):
    user_id: Optional[str] = None
    website_url: str
    competitor_urls: List[str]
    target_keywords: Optional[List[str]] = None
    industry: Optional[str] = None
    analysis_results: Optional[Dict[str, Any]] = None
    recommendations: Optional[Dict[str, Any]] = None
    opportunities: Optional[Dict[str, Any]] = None

class ContentGapAnalysisRequest(BaseModel):
    website_url: str
    competitor_urls: List[str]
    target_keywords: Optional[List[str]] = None
    industry: Optional[str] = None

# AI Analytics Request Models
class ContentEvolutionRequest(BaseModel):
    strategy_id: int
    time_period: str = "30d"  # 7d, 30d, 90d, 1y

class PerformanceTrendsRequest(BaseModel):
    strategy_id: int
    metrics: Optional[List[str]] = None

class ContentPerformancePredictionRequest(BaseModel):
    strategy_id: int
    content_data: Dict[str, Any]

class StrategicIntelligenceRequest(BaseModel):
    strategy_id: int
    market_data: Optional[Dict[str, Any]] = None

# Calendar Generation Request Models
class CalendarGenerationRequest(BaseModel):
    user_id: Optional[str] = None
    strategy_id: Optional[int] = None
    calendar_type: str = Field("monthly", description="Type of calendar: monthly, weekly, custom")
    industry: Optional[str] = None
    business_size: str = Field("sme", description="Business size: startup, sme, enterprise")
    force_refresh: bool = Field(False, description="Force refresh calendar generation")

class ContentOptimizationRequest(BaseModel):
    user_id: Optional[str] = None
    event_id: Optional[int] = None
    title: str
    description: str
    content_type: str
    target_platform: str
    original_content: Optional[Dict[str, Any]] = None

class PerformancePredictionRequest(BaseModel):
    user_id: Optional[str] = None
    strategy_id: Optional[int] = None
    content_type: str
    platform: str
    content_data: Dict[str, Any]

class ContentRepurposingRequest(BaseModel):
    user_id: Optional[str] = None
    strategy_id: Optional[int] = None
    original_content: Dict[str, Any]
    target_platforms: List[str]

class TrendingTopicsRequest(BaseModel):
    user_id: Optional[str] = None
    industry: str
    limit: int = Field(10, description="Number of trending topics to return") 