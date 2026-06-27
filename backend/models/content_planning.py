"""
Content Planning Database Models
Defines the database schema for content strategy, calendar events, and analytics.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ContentStrategy(Base):
    """Content Strategy model."""
    
    __tablename__ = "content_strategies"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    industry = Column(String(100), nullable=True)
    target_audience = Column(JSON, nullable=True)  # Store audience demographics and preferences
    content_pillars = Column(JSON, nullable=True)  # Store content pillar definitions
    ai_recommendations = Column(JSON, nullable=True)  # Store AI-generated recommendations
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    calendar_events = relationship("CalendarEvent", back_populates="strategy")
    analytics = relationship("ContentAnalytics", back_populates="strategy")
    
    def __repr__(self):
        return f"<ContentStrategy(id={self.id}, name='{self.name}', industry='{self.industry}')>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'industry': self.industry,
            'target_audience': self.target_audience,
            'content_pillars': self.content_pillars,
            'ai_recommendations': self.ai_recommendations,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class CalendarEvent(Base):
    """Calendar Event model."""
    
    __tablename__ = "calendar_events"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)  # Clerk user ID
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content_type = Column(String(50), nullable=False)  # blog_post, video, social_post, etc.
    platform = Column(String(50), nullable=False)  # website, linkedin, youtube, etc.
    scheduled_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="draft")  # draft, scheduled, published, cancelled
    ai_recommendations = Column(JSON, nullable=True)  # Store AI recommendations for the event
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_calendar_user_status_date', 'user_id', 'status', 'scheduled_date'),
    )
    
    # Relationships
    strategy = relationship("ContentStrategy", back_populates="calendar_events")
    analytics = relationship("ContentAnalytics", back_populates="event")

    def __repr__(self):
        return f"<CalendarEvent(id={self.id}, title='{self.title}', status='{self.status}')>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'title': self.title,
            'description': self.description,
            'content_type': self.content_type,
            'platform': self.platform,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'status': self.status,
            'ai_recommendations': self.ai_recommendations,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ContentAnalytics(Base):
    """Content Analytics model."""
    
    __tablename__ = "content_analytics"
    
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("calendar_events.id"), nullable=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    platform = Column(String(50), nullable=False)  # website, linkedin, youtube, etc.
    metrics = Column(JSON, nullable=True)  # Store various performance metrics
    performance_score = Column(Float, nullable=True)  # Overall performance score
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    event = relationship("CalendarEvent", back_populates="analytics")
    strategy = relationship("ContentStrategy", back_populates="analytics")
    
    def __repr__(self):
        return f"<ContentAnalytics(id={self.id}, platform='{self.platform}', score={self.performance_score})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'event_id': self.event_id,
            'strategy_id': self.strategy_id,
            'platform': self.platform,
            'metrics': self.metrics,
            'performance_score': self.performance_score,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None
        }

class ContentGapAnalysis(Base):
    """Content Gap Analysis model."""
    
    __tablename__ = "content_gap_analyses"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    website_url = Column(String(500), nullable=False)
    competitor_urls = Column(JSON, nullable=True)  # Store competitor URLs
    target_keywords = Column(JSON, nullable=True)  # Store target keywords
    analysis_results = Column(JSON, nullable=True)  # Store complete analysis results
    recommendations = Column(JSON, nullable=True)  # Store AI recommendations
    opportunities = Column(JSON, nullable=True)  # Store identified opportunities
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<ContentGapAnalysis(id={self.id}, website='{self.website_url}')>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'website_url': self.website_url,
            'competitor_urls': self.competitor_urls,
            'target_keywords': self.target_keywords,
            'analysis_results': self.analysis_results,
            'recommendations': self.recommendations,
            'opportunities': self.opportunities,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ContentRecommendation(Base):
    """Content Recommendation model."""
    
    __tablename__ = "content_recommendations"
    
    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    user_id = Column(Integer, nullable=False)
    recommendation_type = Column(String(50), nullable=False)  # blog_post, video, case_study, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_keywords = Column(JSON, nullable=True)  # Store target keywords
    estimated_length = Column(String(100), nullable=True)  # Estimated content length
    priority = Column(String(20), default="medium")  # low, medium, high
    platforms = Column(JSON, nullable=True)  # Store target platforms
    estimated_performance = Column(String(100), nullable=True)  # Performance prediction
    status = Column(String(20), default="pending")  # pending, accepted, rejected, implemented
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<ContentRecommendation(id={self.id}, title='{self.title}', type='{self.recommendation_type}')>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'strategy_id': self.strategy_id,
            'user_id': self.user_id,
            'recommendation_type': self.recommendation_type,
            'title': self.title,
            'description': self.description,
            'target_keywords': self.target_keywords,
            'estimated_length': self.estimated_length,
            'priority': self.priority,
            'platforms': self.platforms,
            'estimated_performance': self.estimated_performance,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        } 

class AIAnalysisResult(Base):
    """AI Analysis Result model for storing AI-generated insights and recommendations."""
    
    __tablename__ = "ai_analysis_results"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=True)
    analysis_type = Column(String(50), nullable=False)  # performance_trends, strategic_intelligence, content_evolution, gap_analysis
    insights = Column(JSON, nullable=True)  # Store AI-generated insights
    recommendations = Column(JSON, nullable=True)  # Store AI-generated recommendations
    performance_metrics = Column(JSON, nullable=True)  # Store performance data
    personalized_data_used = Column(JSON, nullable=True)  # Store the onboarding data used for personalization
    processing_time = Column(Float, nullable=True)  # Store processing time in seconds
    ai_service_status = Column(String(20), default="operational")  # operational, fallback, error
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    strategy = relationship("ContentStrategy")
    
    def __repr__(self):
        return f"<AIAnalysisResult(id={self.id}, type='{self.analysis_type}', user_id={self.user_id})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'analysis_type': self.analysis_type,
            'insights': self.insights,
            'recommendations': self.recommendations,
            'performance_metrics': self.performance_metrics,
            'personalized_data_used': self.personalized_data_used,
            'processing_time': self.processing_time,
            'ai_service_status': self.ai_service_status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        } 