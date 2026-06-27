"""
Enhanced Calendar Models for AI-Powered Content Planning
Defines additional database schema for intelligent calendar generation and optimization.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ContentCalendarTemplate(Base):
    """Template for industry-specific content calendars."""
    
    __tablename__ = "content_calendar_templates"
    
    id = Column(Integer, primary_key=True)
    industry = Column(String(100), nullable=False)
    business_size = Column(String(50), nullable=True)  # startup, sme, enterprise
    content_pillars = Column(JSON, nullable=True)  # Core content themes
    posting_frequency = Column(JSON, nullable=True)  # Platform-specific frequency
    platform_strategies = Column(JSON, nullable=True)  # Platform-specific content types
    optimal_timing = Column(JSON, nullable=True)  # Best posting times per platform
    content_mix = Column(JSON, nullable=True)  # Content type distribution
    seasonal_themes = Column(JSON, nullable=True)  # Seasonal content opportunities
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ContentCalendarTemplate(id={self.id}, industry='{self.industry}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'industry': self.industry,
            'business_size': self.business_size,
            'content_pillars': self.content_pillars,
            'posting_frequency': self.posting_frequency,
            'platform_strategies': self.platform_strategies,
            'optimal_timing': self.optimal_timing,
            'content_mix': self.content_mix,
            'seasonal_themes': self.seasonal_themes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class AICalendarRecommendation(Base):
    """AI-generated calendar recommendations and suggestions."""
    
    __tablename__ = "ai_calendar_recommendations"
    
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    user_id = Column(String(255), nullable=False, index=True)
    recommendation_type = Column(String(50), nullable=False)  # calendar_generation, content_optimization, performance_analysis
    content_suggestions = Column(JSON, nullable=True)  # Suggested content topics and themes
    optimal_timing = Column(JSON, nullable=True)  # Recommended posting times
    performance_prediction = Column(JSON, nullable=True)  # Predicted performance metrics
    platform_recommendations = Column(JSON, nullable=True)  # Platform-specific suggestions
    content_repurposing = Column(JSON, nullable=True)  # Repurposing opportunities
    trending_topics = Column(JSON, nullable=True)  # Trending topics to incorporate
    competitor_insights = Column(JSON, nullable=True)  # Competitor analysis insights
    ai_confidence = Column(Float, nullable=True)  # AI confidence score
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<AICalendarRecommendation(id={self.id}, type='{self.recommendation_type}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'strategy_id': self.strategy_id,
            'user_id': self.user_id,
            'recommendation_type': self.recommendation_type,
            'content_suggestions': self.content_suggestions,
            'optimal_timing': self.optimal_timing,
            'performance_prediction': self.performance_prediction,
            'platform_recommendations': self.platform_recommendations,
            'content_repurposing': self.content_repurposing,
            'trending_topics': self.trending_topics,
            'competitor_insights': self.competitor_insights,
            'ai_confidence': self.ai_confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ContentPerformanceTracking(Base):
    """Detailed content performance tracking and analytics."""
    
    __tablename__ = "content_performance_tracking"
    
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id"), nullable=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    platform = Column(String(50), nullable=False)  # website, linkedin, instagram, etc.
    content_type = Column(String(50), nullable=False)  # blog_post, video, social_post, etc.
    metrics = Column(JSON, nullable=True)  # Engagement, reach, clicks, conversions, etc.
    performance_score = Column(Float, nullable=True)  # Overall performance score (0-100)
    audience_demographics = Column(JSON, nullable=True)  # Audience insights
    engagement_rate = Column(Float, nullable=True)  # Engagement rate percentage
    reach_count = Column(Integer, nullable=True)  # Total reach
    click_count = Column(Integer, nullable=True)  # Total clicks
    conversion_count = Column(Integer, nullable=True)  # Total conversions
    roi = Column(Float, nullable=True)  # Return on investment
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event = relationship("CalendarEvent")
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<ContentPerformanceTracking(id={self.id}, platform='{self.platform}', score={self.performance_score})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'strategy_id': self.strategy_id,
            'platform': self.platform,
            'content_type': self.content_type,
            'metrics': self.metrics,
            'performance_score': self.performance_score,
            'audience_demographics': self.audience_demographics,
            'engagement_rate': self.engagement_rate,
            'reach_count': self.reach_count,
            'click_count': self.click_count,
            'conversion_count': self.conversion_count,
            'roi': self.roi,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

class ContentTrendAnalysis(Base):
    """Trend analysis and topic recommendations."""
    
    __tablename__ = "content_trend_analysis"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    industry = Column(String(100), nullable=False)
    trending_topics = Column(JSON, nullable=True)  # Trending topics in the industry
    keyword_opportunities = Column(JSON, nullable=True)  # High-value keywords
    content_gaps = Column(JSON, nullable=True)  # Identified content gaps
    seasonal_opportunities = Column(JSON, nullable=True)  # Seasonal content opportunities
    competitor_analysis = Column(JSON, nullable=True)  # Competitor content analysis
    viral_potential = Column(JSON, nullable=True)  # Content with viral potential
    audience_interests = Column(JSON, nullable=True)  # Current audience interests
    analysis_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<ContentTrendAnalysis(id={self.id}, industry='{self.industry}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'industry': self.industry,
            'trending_topics': self.trending_topics,
            'keyword_opportunities': self.keyword_opportunities,
            'content_gaps': self.content_gaps,
            'seasonal_opportunities': self.seasonal_opportunities,
            'competitor_analysis': self.competitor_analysis,
            'viral_potential': self.viral_potential,
            'audience_interests': self.audience_interests,
            'analysis_date': self.analysis_date.isoformat() if self.analysis_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ContentOptimization(Base):
    """Content optimization recommendations and suggestions."""
    
    __tablename__ = "content_optimizations"
    
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id"), nullable=True)
    user_id = Column(String(255), nullable=False, index=True)
    original_content = Column(JSON, nullable=True)  # Original content details
    optimized_content = Column(JSON, nullable=True)  # Optimized content suggestions
    platform_adaptations = Column(JSON, nullable=True)  # Platform-specific adaptations
    visual_recommendations = Column(JSON, nullable=True)  # Visual content suggestions
    hashtag_suggestions = Column(JSON, nullable=True)  # Hashtag recommendations
    keyword_optimization = Column(JSON, nullable=True)  # SEO keyword optimization
    tone_adjustments = Column(JSON, nullable=True)  # Tone and style adjustments
    length_optimization = Column(JSON, nullable=True)  # Content length optimization
    performance_prediction = Column(JSON, nullable=True)  # Predicted performance
    optimization_score = Column(Float, nullable=True)  # Optimization effectiveness score
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event = relationship("CalendarEvent")
    
    def __repr__(self):
        return f"<ContentOptimization(id={self.id}, score={self.optimization_score})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'event_id': self.event_id,
            'user_id': self.user_id,
            'original_content': self.original_content,
            'optimized_content': self.optimized_content,
            'platform_adaptations': self.platform_adaptations,
            'visual_recommendations': self.visual_recommendations,
            'hashtag_suggestions': self.hashtag_suggestions,
            'keyword_optimization': self.keyword_optimization,
            'tone_adjustments': self.tone_adjustments,
            'length_optimization': self.length_optimization,
            'performance_prediction': self.performance_prediction,
            'optimization_score': self.optimization_score,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class CalendarGenerationSession(Base):
    """AI calendar generation sessions and results."""
    
    __tablename__ = "calendar_generation_sessions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    session_type = Column(String(50), nullable=False)  # monthly, weekly, custom
    generation_params = Column(JSON, nullable=True)  # Parameters used for generation
    generated_calendar = Column(JSON, nullable=True)  # Generated calendar data
    ai_insights = Column(JSON, nullable=True)  # AI insights and recommendations
    performance_predictions = Column(JSON, nullable=True)  # Performance predictions
    content_themes = Column(JSON, nullable=True)  # Content themes and pillars
    platform_distribution = Column(JSON, nullable=True)  # Platform content distribution
    optimal_schedule = Column(JSON, nullable=True)  # Optimal posting schedule
    repurposing_opportunities = Column(JSON, nullable=True)  # Content repurposing
    generation_status = Column(String(20), default="processing")  # processing, completed, failed
    ai_confidence = Column(Float, nullable=True)  # Overall AI confidence
    processing_time = Column(Float, nullable=True)  # Processing time in seconds
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<CalendarGenerationSession(id={self.id}, type='{self.session_type}', status='{self.generation_status}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'session_type': self.session_type,
            'generation_params': self.generation_params,
            'generated_calendar': self.generated_calendar,
            'ai_insights': self.ai_insights,
            'performance_predictions': self.performance_predictions,
            'content_themes': self.content_themes,
            'platform_distribution': self.platform_distribution,
            'optimal_schedule': self.optimal_schedule,
            'repurposing_opportunities': self.repurposing_opportunities,
            'generation_status': self.generation_status,
            'ai_confidence': self.ai_confidence,
            'processing_time': self.processing_time,
            'created_at': self.created_at.isoformat() if self.created_at else None
        } 