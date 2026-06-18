from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, JSON, Text, Boolean, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class OnboardingSession(Base):
    __tablename__ = 'onboarding_sessions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False)  # Clerk user ID (string)
    current_step = Column(Integer, default=1)
    progress = Column(Float, default=0.0)
    started_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    payload = Column(JSON, nullable=True)  # Task scheduling manifest
    api_keys = relationship('APIKey', back_populates='session', cascade="all, delete-orphan")
    website_analyses = relationship('WebsiteAnalysis', back_populates='session', cascade="all, delete-orphan")
    research_preferences = relationship('ResearchPreferences', back_populates='session', cascade="all, delete-orphan", uselist=False)
    persona_data = relationship('PersonaData', back_populates='session', cascade="all, delete-orphan", uselist=False)
    competitor_analyses = relationship('CompetitorAnalysis', back_populates='session', cascade="all, delete-orphan")
    platform_integrations = relationship('PlatformIntegration', back_populates='session', cascade="all, delete-orphan", uselist=False)

    def __repr__(self):
        return f"<OnboardingSession(id={self.id}, user_id={self.user_id}, step={self.current_step}, progress={self.progress})>"

class APIKey(Base):
    __tablename__ = 'api_keys'
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id'))
    provider = Column(String(64), nullable=False)
    key = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    session = relationship('OnboardingSession', back_populates='api_keys')

    def __repr__(self):
        return f"<APIKey(id={self.id}, provider={self.provider}, session_id={self.session_id})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'provider': self.provider,
            'key': self.key,  # Note: In production, you might want to mask this
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class WebsiteAnalysis(Base):
    """Stores website analysis results from onboarding step 2."""
    __tablename__ = 'website_analyses'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'), nullable=False)
    website_url = Column(String(500), nullable=False)
    analysis_date = Column(DateTime, default=func.now())
    
    # Style analysis results
    writing_style = Column(JSON)  # Tone, voice, complexity, engagement_level
    content_characteristics = Column(JSON)  # Sentence structure, vocabulary, paragraph organization
    target_audience = Column(JSON)  # Demographics, expertise level, industry focus
    content_type = Column(JSON)  # Primary type, secondary types, purpose
    recommended_settings = Column(JSON)  # Writing tone, target audience, content type
    brand_analysis = Column(JSON)  # Brand voice, values, positioning, competitive differentiation
    content_strategy_insights = Column(JSON)  # SWOT analysis, strengths, weaknesses, opportunities, threats
    social_media_presence = Column(JSON)  # Social media accounts and metrics
    
    # Crawl results
    crawl_result = Column(JSON)  # Raw crawl data
    style_patterns = Column(JSON)  # Writing patterns analysis
    style_guidelines = Column(JSON)  # Generated guidelines
    seo_audit = Column(JSON)  # Comprehensive SEO audit results
    strategic_insights_history = Column(JSON)  # Weekly strategic intelligence reports history
    
    # Metadata
    status = Column(String(50), default='completed')  # completed, failed, in_progress
    error_message = Column(Text)
    warning_message = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    session = relationship('OnboardingSession', back_populates='website_analyses')
    
    def __repr__(self):
        return f"<WebsiteAnalysis(id={self.id}, url={self.website_url}, status={self.status})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'website_url': self.website_url,
            'analysis_date': self.analysis_date.isoformat() if self.analysis_date else None,
            'writing_style': self.writing_style,
            'content_characteristics': self.content_characteristics,
            'target_audience': self.target_audience,
            'content_type': self.content_type,
            'recommended_settings': self.recommended_settings,
            'brand_analysis': self.brand_analysis,
            'content_strategy_insights': self.content_strategy_insights,
            'social_media_presence': self.social_media_presence,
            'crawl_result': self.crawl_result,
            'style_patterns': self.style_patterns,
            'style_guidelines': self.style_guidelines,
            'seo_audit': self.seo_audit,
            'strategic_insights_history': self.strategic_insights_history,
            'status': self.status,
            'error_message': self.error_message,
            'warning_message': self.warning_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        } 

class SEOPageAudit(Base):
    __tablename__ = 'seo_page_audits'
    __table_args__ = (
        UniqueConstraint('user_id', 'page_url', name='uq_seo_page_audits_user_page'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(255), nullable=False, index=True)
    website_url = Column(String(500), nullable=False, index=True)
    page_url = Column(String(1000), nullable=False, index=True)

    overall_score = Column(Integer, nullable=True)
    status = Column(String(50), default='needs_review', index=True)

    category_scores = Column(JSON)
    issues = Column(JSON)
    warnings = Column(JSON)
    recommendations = Column(JSON)
    audit_data = Column(JSON)

    analysis_source = Column(String(50), default='onboarding_full_site')
    last_analyzed_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'website_url': self.website_url,
            'page_url': self.page_url,
            'overall_score': self.overall_score,
            'status': self.status,
            'category_scores': self.category_scores,
            'issues': self.issues,
            'warnings': self.warnings,
            'recommendations': self.recommendations,
            'audit_data': self.audit_data,
            'analysis_source': self.analysis_source,
            'last_analyzed_at': self.last_analyzed_at.isoformat() if self.last_analyzed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

class ResearchPreferences(Base):
    """Stores research preferences from onboarding step 3."""
    __tablename__ = 'research_preferences'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'), nullable=False)
    
    # Research configuration
    research_depth = Column(String(50), nullable=False)  # Basic, Standard, Comprehensive, Expert
    content_types = Column(JSON, nullable=False)  # Array of content types
    auto_research = Column(Boolean, default=True)
    factual_content = Column(Boolean, default=True)
    
    # Style detection data (from step 2)
    writing_style = Column(JSON)  # Tone, voice, complexity from website analysis
    content_characteristics = Column(JSON)  # Sentence structure, vocabulary from analysis
    target_audience = Column(JSON)  # Demographics, expertise level from analysis
    recommended_settings = Column(JSON)  # AI-generated recommendations from analysis
    
    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    session = relationship('OnboardingSession', back_populates='research_preferences')
    
    def __repr__(self):
        return f"<ResearchPreferences(id={self.id}, session_id={self.session_id}, depth={self.research_depth})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'research_depth': self.research_depth,
            'content_types': self.content_types,
            'auto_research': self.auto_research,
            'factual_content': self.factual_content,
            'writing_style': self.writing_style,
            'content_characteristics': self.content_characteristics,
            'target_audience': self.target_audience,
            'recommended_settings': self.recommended_settings,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        } 

class PersonaData(Base):
    """Stores persona generation data from onboarding step 4."""
    __tablename__ = 'persona_data'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'), nullable=False)
    
        # Persona generation results
    core_persona = Column(JSON)  # Core persona data (demographics, psychographics, etc.)
    platform_personas = Column(JSON)  # Platform-specific personas (LinkedIn, Twitter, etc.)
    quality_metrics = Column(JSON)  # Quality assessment metrics
    selected_platforms = Column(JSON)  # Array of selected platforms
    research_persona = Column(JSON, nullable=True)  # AI-generated research persona with personalized defaults
    research_persona_generated_at = Column(DateTime, nullable=True)  # Timestamp for 7-day TTL cache validation

    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    session = relationship('OnboardingSession', back_populates='persona_data')
    
    def __repr__(self):
        return f"<PersonaData(id={self.id}, session_id={self.session_id})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'core_persona': self.core_persona,
            'platform_personas': self.platform_personas,
            'quality_metrics': self.quality_metrics,
            'selected_platforms': self.selected_platforms,
            'research_persona': self.research_persona,
            'research_persona_generated_at': self.research_persona_generated_at.isoformat() if self.research_persona_generated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class CompetitorAnalysis(Base):
    """Stores competitor website analysis results from scheduled analysis tasks."""
    __tablename__ = 'competitor_analyses'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'), nullable=False)
    competitor_url = Column(Text, nullable=False)
    competitor_domain = Column(String(255), nullable=True)  # Extracted domain for easier queries
    analysis_date = Column(DateTime, default=func.now())
    
    # Complete analysis data (same structure as WebsiteAnalysis)
    analysis_data = Column(JSON)  # Contains style_analysis, crawl_result, style_patterns, style_guidelines
    
    # Metadata
    status = Column(String(50), default='completed')  # completed, failed, in_progress
    error_message = Column(Text, nullable=True)
    warning_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    session = relationship('OnboardingSession', back_populates='competitor_analyses')
    
    def __repr__(self):
        return f"<CompetitorAnalysis(id={self.id}, url={self.competitor_url}, status={self.status})>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'competitor_url': self.competitor_url,
            'competitor_domain': self.competitor_domain,
            'analysis_date': self.analysis_date.isoformat() if self.analysis_date else None,
            'analysis_data': self.analysis_data,
            'status': self.status,
            'error_message': self.error_message,
            'warning_message': self.warning_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class PlatformIntegration(Base):
    """Stores Step 5 integration/platform connection data for onboarding."""
    __tablename__ = 'platform_integrations'

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('onboarding_sessions.id', ondelete='CASCADE'), nullable=False)

    # Integration data
    primary_website = Column(String(512), nullable=True)
    website_platforms = Column(JSON)   # { wix: {...}, wordpress: {...} }
    analytics_platforms = Column(JSON) # { gsc: {...}, bing: {...} }
    social_platforms = Column(JSON)    # { facebook: true, twitter: true, ... }
    connected_platforms = Column(JSON) # ["wix", "gsc", ...]

    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    session = relationship('OnboardingSession', back_populates='platform_integrations')

    def __repr__(self):
        return f"<PlatformIntegration(id={self.id}, session_id={self.session_id}, platforms={len(self.connected_platforms or [])})>"

    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'primary_website': self.primary_website,
            'website_platforms': self.website_platforms,
            'analytics_platforms': self.analytics_platforms,
            'social_platforms': self.social_platforms,
            'connected_platforms': self.connected_platforms,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
