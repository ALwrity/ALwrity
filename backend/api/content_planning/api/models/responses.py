"""
Response Models for Content Planning API
Extracted from the main content_planning.py file for better organization.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

# Content Strategy Response Models
class ContentStrategyResponse(BaseModel):
    id: int
    name: str
    industry: str
    target_audience: Dict[str, Any]
    content_pillars: List[Dict[str, Any]]
    ai_recommendations: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

# Calendar Event Response Models
class CalendarEventResponse(BaseModel):
    id: int
    user_id: str
    strategy_id: int
    title: str
    description: str
    content_type: str
    platform: str
    scheduled_date: datetime
    status: str
    ai_recommendations: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

# Content Gap Analysis Response Models
class ContentGapAnalysisResponse(BaseModel):
    id: int
    user_id: str
    website_url: str
    competitor_urls: List[str]
    target_keywords: Optional[List[str]] = None
    industry: Optional[str] = None
    analysis_results: Optional[Dict[str, Any]] = None
    recommendations: Optional[Dict[str, Any]] = None
    opportunities: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

class ContentGapAnalysisFullResponse(BaseModel):
    website_analysis: Dict[str, Any]
    competitor_analysis: Dict[str, Any]
    gap_analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    opportunities: List[Dict[str, Any]]
    created_at: datetime

# AI Analytics Response Models
class AIAnalyticsResponse(BaseModel):
    analysis_type: str
    strategy_id: int
    results: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    analysis_date: datetime

# Calendar Generation Response Models
class CalendarGenerationResponse(BaseModel):
    user_id: str
    strategy_id: Optional[int]
    calendar_type: str
    industry: str
    business_size: str
    generated_at: datetime
    content_pillars: List[str]
    platform_strategies: Dict[str, Any]
    content_mix: Dict[str, float]
    daily_schedule: List[Dict[str, Any]]
    weekly_themes: List[Dict[str, Any]]
    content_recommendations: List[Dict[str, Any]]
    optimal_timing: Dict[str, Any]
    performance_predictions: Dict[str, Any]
    trending_topics: List[Dict[str, Any]]
    repurposing_opportunities: List[Dict[str, Any]]
    ai_insights: List[Dict[str, Any]]
    competitor_analysis: Dict[str, Any]
    gap_analysis_insights: Dict[str, Any]
    strategy_insights: Dict[str, Any]
    onboarding_insights: Dict[str, Any]
    processing_time: float
    ai_confidence: float

class ContentOptimizationResponse(BaseModel):
    user_id: str
    event_id: Optional[int]
    original_content: Dict[str, Any]
    optimized_content: Dict[str, Any]
    platform_adaptations: List[str]
    visual_recommendations: List[str]
    hashtag_suggestions: List[str]
    keyword_optimization: Dict[str, Any]
    tone_adjustments: Dict[str, Any]
    length_optimization: Dict[str, Any]
    performance_prediction: Dict[str, Any]
    optimization_score: float
    created_at: datetime

class PerformancePredictionResponse(BaseModel):
    user_id: str
    strategy_id: Optional[int]
    content_type: str
    platform: str
    predicted_engagement_rate: float
    predicted_reach: int
    predicted_conversions: int
    predicted_roi: float
    confidence_score: float
    recommendations: List[str]
    created_at: datetime

class ContentRepurposingResponse(BaseModel):
    user_id: str
    strategy_id: Optional[int]
    original_content: Dict[str, Any]
    platform_adaptations: List[Dict[str, Any]]
    transformations: List[Dict[str, Any]]
    implementation_tips: List[str]
    gap_addresses: List[str]
    created_at: datetime

class TrendingTopicsResponse(BaseModel):
    user_id: str
    industry: str
    trending_topics: List[Dict[str, Any]]
    gap_relevance_scores: Dict[str, float]
    audience_alignment_scores: Dict[str, float]
    created_at: datetime 