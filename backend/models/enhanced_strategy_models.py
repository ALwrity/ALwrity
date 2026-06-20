"""
Enhanced Strategy Database Models
Defines the enhanced database schema for content strategy with 30+ strategic inputs.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class EnhancedContentStrategy(Base):
    """Enhanced Content Strategy model with 30+ strategic inputs."""
    
    __tablename__ = "enhanced_content_strategies"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    industry = Column(String(100), nullable=True)
    
    # Business Context (8 inputs)
    business_objectives = Column(JSON, nullable=True)  # Primary and secondary business goals
    target_metrics = Column(JSON, nullable=True)  # KPIs and success metrics
    content_budget = Column(Float, nullable=True)  # Monthly/annual content budget
    team_size = Column(Integer, nullable=True)  # Content team size
    implementation_timeline = Column(String(100), nullable=True)  # 3 months, 6 months, 1 year, etc.
    market_share = Column(String(50), nullable=True)  # Current market share percentage
    competitive_position = Column(String(50), nullable=True)  # Leader, challenger, niche, emerging
    # Renamed from 'performance_metrics' to 'performance_metrics_data' to
    # avoid colliding with the StrategyPerformanceMetrics relationship
    # (back_populates='performance_metrics') declared later on this class.
    # The original column held a free-form JSON blob of current performance
    # data; the relationship points at the strategy_performance_metrics
    # table that records per-period metrics. They are different concepts
    # and must not share an attribute name.
    performance_metrics_data = Column("performance_metrics", JSON, nullable=True)  # Current performance data
    
    # Audience Intelligence (6 inputs)
    content_preferences = Column(JSON, nullable=True)  # Preferred content formats and topics
    consumption_patterns = Column(JSON, nullable=True)  # When and how audience consumes content
    audience_pain_points = Column(JSON, nullable=True)  # Key challenges and pain points
    buying_journey = Column(JSON, nullable=True)  # Customer journey stages and touchpoints
    seasonal_trends = Column(JSON, nullable=True)  # Seasonal content opportunities
    engagement_metrics = Column(JSON, nullable=True)  # Current engagement data
    
    # Competitive Intelligence (5 inputs)
    top_competitors = Column(JSON, nullable=True)  # List of main competitors
    competitor_content_strategies = Column(JSON, nullable=True)  # Analysis of competitor approaches
    market_gaps = Column(JSON, nullable=True)  # Identified market opportunities
    industry_trends = Column(JSON, nullable=True)  # Current industry trends
    emerging_trends = Column(JSON, nullable=True)  # Upcoming trends and opportunities
    
    # Content Strategy (7 inputs)
    preferred_formats = Column(JSON, nullable=True)  # Blog posts, videos, infographics, etc.
    content_mix = Column(JSON, nullable=True)  # Distribution of content types
    content_frequency = Column(String(50), nullable=True)  # Daily, weekly, monthly, etc.
    optimal_timing = Column(JSON, nullable=True)  # Best times for publishing
    quality_metrics = Column(JSON, nullable=True)  # Content quality standards
    editorial_guidelines = Column(JSON, nullable=True)  # Style and tone guidelines
    brand_voice = Column(JSON, nullable=True)  # Brand personality and voice
    
    # Performance & Analytics (4 inputs)
    traffic_sources = Column(JSON, nullable=True)  # Primary traffic sources
    conversion_rates = Column(JSON, nullable=True)  # Current conversion data
    content_roi_targets = Column(JSON, nullable=True)  # ROI goals and targets
    ab_testing_capabilities = Column(Boolean, default=False)  # A/B testing availability
    
    # Legacy fields for backward compatibility
    target_audience = Column(JSON, nullable=True)  # Store audience demographics and preferences
    content_pillars = Column(JSON, nullable=True)  # Store content pillar definitions
    ai_recommendations = Column(JSON, nullable=True)  # Store AI-generated recommendations
    
    # Enhanced AI Analysis fields
    comprehensive_ai_analysis = Column(JSON, nullable=True)  # Enhanced AI analysis results
    onboarding_data_used = Column(JSON, nullable=True)  # Track onboarding data integration
    strategic_scores = Column(JSON, nullable=True)  # Strategic performance scores
    market_positioning = Column(JSON, nullable=True)  # Market positioning analysis
    competitive_advantages = Column(JSON, nullable=True)  # Identified competitive advantages
    strategic_risks = Column(JSON, nullable=True)  # Risk assessment
    opportunity_analysis = Column(JSON, nullable=True)  # Opportunity identification
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completion_percentage = Column(Float, default=0.0)  # Track input completion
    data_source_transparency = Column(JSON, nullable=True)  # Track data sources for auto-population

    # Relationships
    autofill_insights = relationship("ContentStrategyAutofillInsights", back_populates="strategy", cascade="all, delete-orphan")
    
    # Monitoring relationships.
    # These four collection attributes (monitoring_plans,
    # monitoring_tasks, performance_metrics, activation_status) are
    # auto-created on this class via ``backref`` declared in
    # monitoring_models.py. Declaring them here with
    # ``back_populates=`` would have required a matching
    # ``relationship("EnhancedContentStrategy", back_populates=...)``
    # on the monitoring side, but monitoring_models imports Base from
    # this module -- so a top-level import of EnhancedContentStrategy
    # there would create a circular import and SQLAlchemy would fail
    # with ``InvalidRequestError: expression '...' failed to locate a
    # name`` on the first DB read.
    #
    # The backref form puts the explicit relationship on the monitoring
    # side and uses ``backref(..., cascade="all, delete-orphan")`` to
    # apply the cascade to the auto-created collection on this side
    # -- so deleting a strategy still cascades to delete its
    # monitoring plans / tasks / metrics / activation status, just as
    # the original back_populates configuration did.
    
    def __repr__(self):
        return f"<EnhancedContentStrategy(id={self.id}, name='{self.name}', industry='{self.industry}')>"
    
    def to_dict(self):
        """Convert model to dictionary with enhanced structure."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'industry': self.industry,
            
            # Business Context
            'business_objectives': self.business_objectives,
            'target_metrics': self.target_metrics,
            'content_budget': self.content_budget,
            'team_size': self.team_size,
            'implementation_timeline': self.implementation_timeline,
            'market_share': self.market_share,
            'competitive_position': self.competitive_position,
            'performance_metrics': self.performance_metrics_data,
            
            # Audience Intelligence
            'content_preferences': self.content_preferences,
            'consumption_patterns': self.consumption_patterns,
            'audience_pain_points': self.audience_pain_points,
            'buying_journey': self.buying_journey,
            'seasonal_trends': self.seasonal_trends,
            'engagement_metrics': self.engagement_metrics,
            
            # Competitive Intelligence
            'top_competitors': self.top_competitors,
            'competitor_content_strategies': self.competitor_content_strategies,
            'market_gaps': self.market_gaps,
            'industry_trends': self.industry_trends,
            'emerging_trends': self.emerging_trends,
            
            # Content Strategy
            'preferred_formats': self.preferred_formats,
            'content_mix': self.content_mix,
            'content_frequency': self.content_frequency,
            'optimal_timing': self.optimal_timing,
            'quality_metrics': self.quality_metrics,
            'editorial_guidelines': self.editorial_guidelines,
            'brand_voice': self.brand_voice,
            
            # Performance & Analytics
            'traffic_sources': self.traffic_sources,
            'conversion_rates': self.conversion_rates,
            'content_roi_targets': self.content_roi_targets,
            'ab_testing_capabilities': self.ab_testing_capabilities,
            
            # Legacy fields
            'target_audience': self.target_audience,
            'content_pillars': self.content_pillars,
            'ai_recommendations': self.ai_recommendations,
            
            # Enhanced AI Analysis
            'comprehensive_ai_analysis': self.comprehensive_ai_analysis,
            'onboarding_data_used': self.onboarding_data_used,
            'strategic_scores': self.strategic_scores,
            'market_positioning': self.market_positioning,
            'competitive_advantages': self.competitive_advantages,
            'strategic_risks': self.strategic_risks,
            'opportunity_analysis': self.opportunity_analysis,
            
            # Metadata
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'completion_percentage': self.completion_percentage,
            'data_source_transparency': self.data_source_transparency
        }
    
    def calculate_completion_percentage(self):
        """Calculate the percentage of required fields that have been filled."""
        required_fields = [
            'business_objectives', 'target_metrics', 'content_budget', 'team_size',
            'implementation_timeline', 'market_share', 'competitive_position',
            'content_preferences', 'consumption_patterns', 'audience_pain_points',
            'buying_journey', 'seasonal_trends', 'engagement_metrics',
            'top_competitors', 'competitor_content_strategies', 'market_gaps',
            'industry_trends', 'emerging_trends', 'preferred_formats',
            'content_mix', 'content_frequency', 'optimal_timing',
            'quality_metrics', 'editorial_guidelines', 'brand_voice',
            'traffic_sources', 'conversion_rates', 'content_roi_targets'
        ]
        
        filled_fields = sum(1 for field in required_fields if getattr(self, field) is not None)
        self.completion_percentage = (filled_fields / len(required_fields)) * 100
        return self.completion_percentage

class EnhancedAIAnalysisResult(Base):
    """Enhanced AI Analysis Result model for storing comprehensive AI-generated insights."""
    
    __tablename__ = "enhanced_ai_analysis_results"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=True)
    
    # Analysis type for the 5 specialized prompts
    analysis_type = Column(String(50), nullable=False)  # comprehensive_strategy, audience_intelligence, competitive_intelligence, performance_optimization, content_calendar_optimization
    
    # Comprehensive analysis results
    comprehensive_insights = Column(JSON, nullable=True)  # Holistic strategy insights
    audience_intelligence = Column(JSON, nullable=True)  # Detailed audience analysis
    competitive_intelligence = Column(JSON, nullable=True)  # Competitive landscape analysis
    performance_optimization = Column(JSON, nullable=True)  # Performance improvement recommendations
    content_calendar_optimization = Column(JSON, nullable=True)  # Calendar optimization insights
    
    # Enhanced data tracking
    onboarding_data_used = Column(JSON, nullable=True)  # Track onboarding data integration
    data_confidence_scores = Column(JSON, nullable=True)  # Confidence scores for data sources
    recommendation_quality_scores = Column(JSON, nullable=True)  # Quality scores for recommendations
    
    # Performance metrics
    processing_time = Column(Float, nullable=True)  # Processing time in seconds
    ai_service_status = Column(String(20), default="operational")  # operational, fallback, error
    prompt_version = Column(String(50), nullable=True)  # Version of AI prompt used
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<EnhancedAIAnalysisResult(id={self.id}, type='{self.analysis_type}', user_id={self.user_id})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'analysis_type': self.analysis_type,
            'comprehensive_insights': self.comprehensive_insights,
            'audience_intelligence': self.audience_intelligence,
            'competitive_intelligence': self.competitive_intelligence,
            'performance_optimization': self.performance_optimization,
            'content_calendar_optimization': self.content_calendar_optimization,
            'onboarding_data_used': self.onboarding_data_used,
            'data_confidence_scores': self.data_confidence_scores,
            'recommendation_quality_scores': self.recommendation_quality_scores,
            'processing_time': self.processing_time,
            'ai_service_status': self.ai_service_status,
            'prompt_version': self.prompt_version,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class OnboardingDataIntegration(Base):
    """Model for tracking onboarding data integration with enhanced strategy."""
    
    __tablename__ = "onboarding_data_integrations"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=True)
    
    # Legacy onboarding storage fields (match existing DB schema)
    website_analysis_data = Column(JSON, nullable=True)  # Data from website analysis
    research_preferences_data = Column(JSON, nullable=True)  # Data from research preferences
    api_keys_data = Column(JSON, nullable=True)  # API configuration data
    canonical_profile = Column(JSON, nullable=True)  # Merged canonical profile (SSOT)
    
    # Integration mapping and user edits
    field_mappings = Column(JSON, nullable=True)  # Mapping of onboarding fields to strategy fields
    auto_populated_fields = Column(JSON, nullable=True)  # Fields auto-populated from onboarding
    user_overrides = Column(JSON, nullable=True)  # Fields manually overridden by user
    
    # Data quality and transparency
    data_quality_scores = Column(JSON, nullable=True)  # Quality scores for each data source
    confidence_levels = Column(JSON, nullable=True)  # Confidence levels for auto-populated data
    data_freshness = Column(JSON, nullable=True)  # How recent the onboarding data is
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert model to dictionary (legacy fields)."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'strategy_id': self.strategy_id,
            'website_analysis_data': self.website_analysis_data,
            'research_preferences_data': self.research_preferences_data,
            'api_keys_data': self.api_keys_data,
            'canonical_profile': self.canonical_profile,
            'field_mappings': self.field_mappings,
            'auto_populated_fields': self.auto_populated_fields,
            'user_overrides': self.user_overrides,
            'data_quality_scores': self.data_quality_scores,
            'confidence_levels': self.confidence_levels,
            'data_freshness': self.data_freshness,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

# New model to persist accepted auto-fill inputs used to create a strategy
class ContentStrategyAutofillInsights(Base):
    __tablename__ = "content_strategy_autofill_insights"

    id = Column(Integer, primary_key=True)
    strategy_id = Column(Integer, ForeignKey("enhanced_content_strategies.id"), nullable=False)
    user_id = Column(String(255), nullable=False)

    # Full snapshot of accepted inputs and transparency at time of strategy creation/confirmation
    accepted_fields = Column(JSON, nullable=False)
    sources = Column(JSON, nullable=True)
    input_data_points = Column(JSON, nullable=True)
    quality_scores = Column(JSON, nullable=True)
    confidence_levels = Column(JSON, nullable=True)
    data_freshness = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to strategy
    strategy = relationship("EnhancedContentStrategy", back_populates="autofill_insights") 
