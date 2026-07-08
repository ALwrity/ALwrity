"""
Enhanced Persona Database Models
Improved schema for better writing style mimicry and quality tracking.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey, Boolean, Index
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class EnhancedWritingPersona(Base):
    """Enhanced writing persona model with improved linguistic analysis."""
    
    __tablename__ = "enhanced_writing_personas"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, index=True)
    persona_name = Column(String(255), nullable=False)
    
    # Core Identity
    archetype = Column(String(100), nullable=True)
    core_belief = Column(Text, nullable=True)
    brand_voice_description = Column(Text, nullable=True)
    
    # Enhanced Linguistic Fingerprint
    linguistic_fingerprint = Column(JSON, nullable=True)  # More detailed analysis
    writing_style_signature = Column(JSON, nullable=True)  # Unique style markers
    vocabulary_profile = Column(JSON, nullable=True)  # Detailed vocabulary analysis
    sentence_patterns = Column(JSON, nullable=True)  # Sentence structure patterns
    rhetorical_style = Column(JSON, nullable=True)  # Rhetorical device preferences
    
    # Quality Metrics
    style_consistency_score = Column(Float, nullable=True)  # 0-100
    authenticity_score = Column(Float, nullable=True)  # 0-100
    readability_score = Column(Float, nullable=True)  # 0-100
    engagement_potential = Column(Float, nullable=True)  # 0-100
    
    # Learning & Adaptation
    feedback_history = Column(JSON, nullable=True)  # User feedback over time
    performance_metrics = Column(JSON, nullable=True)  # Content performance data
    adaptation_history = Column(JSON, nullable=True)  # How persona evolved
    
    # Source data tracking
    onboarding_session_id = Column(Integer, nullable=True)
    source_website_analysis = Column(JSON, nullable=True)
    source_research_preferences = Column(JSON, nullable=True)
    
    # AI Analysis metadata
    ai_analysis_version = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    analysis_date = Column(DateTime, default=datetime.utcnow)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_active', 'user_id', 'is_active'),
        Index('idx_created_at', 'created_at'),
    )

class EnhancedPlatformPersona(Base):
    """Enhanced platform-specific persona with detailed optimization."""
    
    __tablename__ = "enhanced_platform_personas"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    writing_persona_id = Column(Integer, ForeignKey("enhanced_writing_personas.id"), nullable=False)
    platform_type = Column(String(50), nullable=False, index=True)
    
    # Enhanced Platform-specific Analysis
    platform_linguistic_adaptation = Column(JSON, nullable=True)  # How language adapts to platform
    platform_engagement_patterns = Column(JSON, nullable=True)  # Detailed engagement analysis
    platform_content_optimization = Column(JSON, nullable=True)  # Content optimization rules
    platform_algorithm_insights = Column(JSON, nullable=True)  # Algorithm-specific insights
    
    # Performance Tracking
    content_performance_history = Column(JSON, nullable=True)  # Historical performance data
    engagement_metrics = Column(JSON, nullable=True)  # Engagement statistics
    optimization_suggestions = Column(JSON, nullable=True)  # AI-generated optimization tips
    
    # Quality Assurance
    platform_compliance_score = Column(Float, nullable=True)  # 0-100
    optimization_effectiveness = Column(Float, nullable=True)  # 0-100
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    writing_persona = relationship("EnhancedWritingPersona", back_populates="platform_personas")
    
    # Indexes
    __table_args__ = (
        Index('idx_platform_active', 'platform_type', 'is_active'),
        Index('idx_persona_platform', 'writing_persona_id', 'platform_type'),
    )

class PersonaQualityMetrics(Base):
    """Tracks persona quality and improvement over time."""
    
    __tablename__ = "persona_quality_metrics"
    
    id = Column(Integer, primary_key=True)
    writing_persona_id = Column(Integer, ForeignKey("enhanced_writing_personas.id"), nullable=False)
    platform_persona_id = Column(Integer, ForeignKey("enhanced_platform_personas.id"), nullable=True)
    
    # Quality Scores
    style_accuracy = Column(Float, nullable=True)  # How well it mimics user style
    content_quality = Column(Float, nullable=True)  # Overall content quality
    engagement_rate = Column(Float, nullable=True)  # Engagement performance
    consistency_score = Column(Float, nullable=True)  # Consistency across content
    
    # User Feedback
    user_satisfaction = Column(Float, nullable=True)  # User rating
    user_feedback = Column(Text, nullable=True)  # Qualitative feedback
    improvement_requests = Column(JSON, nullable=True)  # Specific improvement requests
    
    # AI Analysis
    ai_quality_assessment = Column(JSON, nullable=True)  # AI's quality analysis
    improvement_suggestions = Column(JSON, nullable=True)  # AI suggestions for improvement
    
    # Metadata
    assessment_date = Column(DateTime, default=datetime.utcnow)
    assessor_type = Column(String(50), nullable=True)  # user, ai, automated
    
    # Relationships
    writing_persona = relationship("EnhancedWritingPersona")
    platform_persona = relationship("EnhancedPlatformPersona")

class PersonaLearningData(Base):
    """Stores learning data for persona improvement."""
    
    __tablename__ = "persona_learning_data"
    
    id = Column(Integer, primary_key=True)
    writing_persona_id = Column(Integer, ForeignKey("enhanced_writing_personas.id"), nullable=False)
    
    # Learning Inputs
    user_writing_samples = Column(JSON, nullable=True)  # Additional user writing samples
    successful_content_examples = Column(JSON, nullable=True)  # High-performing content
    user_preferences = Column(JSON, nullable=True)  # User preferences and adjustments
    
    # Learning Outputs
    style_refinements = Column(JSON, nullable=True)  # Refinements made to persona
    vocabulary_updates = Column(JSON, nullable=True)  # Vocabulary additions/removals
    pattern_adjustments = Column(JSON, nullable=True)  # Pattern adjustments
    
    # Metadata
    learning_date = Column(DateTime, default=datetime.utcnow)
    learning_type = Column(String(50), nullable=True)  # feedback, sample, preference
    
    # Relationships
    writing_persona = relationship("EnhancedWritingPersona")

# Add relationships
EnhancedWritingPersona.platform_personas = relationship("EnhancedPlatformPersona", back_populates="writing_persona", cascade="all, delete-orphan")
