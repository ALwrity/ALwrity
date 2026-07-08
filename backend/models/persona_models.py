"""
Writing Persona Database Models
Defines database schema for storing writing personas based on onboarding data analysis.
Each persona represents a platform-specific writing style derived from user's onboarding data.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class WritingPersona(Base):
    """Main writing persona model that stores the core persona profile."""
    
    __tablename__ = "writing_personas"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)  # Changed to String to support Clerk user IDs
    persona_name = Column(String(255), nullable=False)  # e.g., "Professional LinkedIn Voice", "Casual Blog Writer"
    
    # Core Identity
    archetype = Column(String(100), nullable=True)  # e.g., "The Pragmatic Futurist", "The Thoughtful Educator"
    core_belief = Column(Text, nullable=True)  # Central philosophy or belief system
    brand_voice_description = Column(Text, nullable=True)  # Detailed brand voice description
    
    # Linguistic Fingerprint - Quantitative Analysis
    linguistic_fingerprint = Column(JSON, nullable=True)  # Complete linguistic analysis
    
    # Platform-specific adaptations
    platform_adaptations = Column(JSON, nullable=True)  # How persona adapts across platforms
    
    # Source data tracking
    onboarding_session_id = Column(Integer, nullable=True)  # Link to onboarding session
    source_website_analysis = Column(JSON, nullable=True)  # Website analysis data used
    source_research_preferences = Column(JSON, nullable=True)  # Research preferences used
    
    # AI Analysis metadata
    ai_analysis_version = Column(String(50), nullable=True)  # Version of AI analysis used
    confidence_score = Column(Float, nullable=True)  # AI confidence in persona accuracy
    analysis_date = Column(DateTime, default=datetime.utcnow)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    platform_personas = relationship("PlatformPersona", back_populates="writing_persona", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<WritingPersona(id={self.id}, name='{self.persona_name}', user_id={self.user_id})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'persona_name': self.persona_name,
            'archetype': self.archetype,
            'core_belief': self.core_belief,
            'brand_voice_description': self.brand_voice_description,
            'linguistic_fingerprint': self.linguistic_fingerprint,
            'platform_adaptations': self.platform_adaptations,
            'onboarding_session_id': self.onboarding_session_id,
            'source_website_analysis': self.source_website_analysis,
            'source_research_preferences': self.source_research_preferences,
            'ai_analysis_version': self.ai_analysis_version,
            'confidence_score': self.confidence_score,
            'analysis_date': self.analysis_date.isoformat() if self.analysis_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active
        }

class PlatformPersona(Base):
    """Platform-specific persona adaptations for different social media platforms and blogging."""
    
    __tablename__ = "platform_personas"
    
    # Primary fields
    id = Column(Integer, primary_key=True)
    writing_persona_id = Column(Integer, ForeignKey("writing_personas.id"), nullable=False)
    platform_type = Column(String(50), nullable=False)  # twitter, linkedin, instagram, facebook, blog, medium, substack
    
    # Platform-specific linguistic constraints
    sentence_metrics = Column(JSON, nullable=True)  # Platform-optimized sentence structure
    lexical_features = Column(JSON, nullable=True)  # Platform-specific vocabulary and phrases
    rhetorical_devices = Column(JSON, nullable=True)  # Platform-appropriate rhetorical patterns
    tonal_range = Column(JSON, nullable=True)  # Permitted tones for this platform
    stylistic_constraints = Column(JSON, nullable=True)  # Platform formatting rules
    
    # Platform-specific content guidelines
    content_format_rules = Column(JSON, nullable=True)  # Character limits, hashtag usage, etc.
    engagement_patterns = Column(JSON, nullable=True)  # How to engage on this platform
    posting_frequency = Column(JSON, nullable=True)  # Optimal posting schedule
    content_types = Column(JSON, nullable=True)  # Preferred content types for platform
    
    # Performance optimization
    platform_best_practices = Column(JSON, nullable=True)  # Platform-specific best practices
    algorithm_considerations = Column(JSON, nullable=True)  # Platform algorithm optimization
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    writing_persona = relationship("WritingPersona", back_populates="platform_personas")
    
    def __repr__(self):
        return f"<PlatformPersona(id={self.id}, platform='{self.platform_type}', persona_id={self.writing_persona_id})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        result = {
            'id': self.id,
            'writing_persona_id': self.writing_persona_id,
            'platform_type': self.platform_type,
            'sentence_metrics': self.sentence_metrics,
            'lexical_features': self.lexical_features,
            'rhetorical_devices': self.rhetorical_devices,
            'tonal_range': self.tonal_range,
            'stylistic_constraints': self.stylistic_constraints,
            'content_format_rules': self.content_format_rules,
            'engagement_patterns': self.engagement_patterns,
            'posting_frequency': self.posting_frequency,
            'content_types': self.content_types,
            'platform_best_practices': self.platform_best_practices,
            'algorithm_considerations': self.algorithm_considerations,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active
        }
        
        # Add LinkedIn-specific fields if this is a LinkedIn persona
        if self.platform_type.lower() == "linkedin" and self.algorithm_considerations:
            linkedin_data = self.algorithm_considerations
            if isinstance(linkedin_data, dict):
                result.update({
                    'professional_networking': linkedin_data.get('professional_networking', {}),
                    'linkedin_features': linkedin_data.get('linkedin_features', {}),
                    'algorithm_optimization': linkedin_data.get('algorithm_optimization', {}),
                    'professional_context_optimization': linkedin_data.get('professional_context_optimization', {})
                })
        
        return result

class PersonaAnalysisResult(Base):
    """Stores AI analysis results used to generate personas."""
    
    __tablename__ = "persona_analysis_results"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    writing_persona_id = Column(Integer, ForeignKey("writing_personas.id"), nullable=True)
    
    # Analysis input data
    analysis_prompt = Column(Text, nullable=True)  # The prompt used for analysis
    input_data = Column(JSON, nullable=True)  # Raw input data from onboarding
    
    # AI Analysis results
    linguistic_analysis = Column(JSON, nullable=True)  # Detailed linguistic fingerprint analysis
    personality_analysis = Column(JSON, nullable=True)  # Personality and archetype analysis
    platform_recommendations = Column(JSON, nullable=True)  # Platform-specific recommendations
    style_guidelines = Column(JSON, nullable=True)  # Generated style guidelines
    
    # Quality metrics
    analysis_confidence = Column(Float, nullable=True)  # AI confidence in analysis
    data_sufficiency_score = Column(Float, nullable=True)  # How much data was available for analysis
    recommendation_quality = Column(Float, nullable=True)  # Quality of generated recommendations
    
    # AI service metadata
    ai_provider = Column(String(50), nullable=True)  # gemini, openai, anthropic
    model_version = Column(String(100), nullable=True)  # Specific model version used
    processing_time = Column(Float, nullable=True)  # Processing time in seconds
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<PersonaAnalysisResult(id={self.id}, user_id={self.user_id}, provider='{self.ai_provider}')>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'writing_persona_id': self.writing_persona_id,
            'analysis_prompt': self.analysis_prompt,
            'input_data': self.input_data,
            'linguistic_analysis': self.linguistic_analysis,
            'personality_analysis': self.personality_analysis,
            'platform_recommendations': self.platform_recommendations,
            'style_guidelines': self.style_guidelines,
            'analysis_confidence': self.analysis_confidence,
            'data_sufficiency_score': self.data_sufficiency_score,
            'recommendation_quality': self.recommendation_quality,
            'ai_provider': self.ai_provider,
            'model_version': self.model_version,
            'processing_time': self.processing_time,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PersonaValidationResult(Base):
    """Stores validation results for generated personas."""
    
    __tablename__ = "persona_validation_results"
    
    id = Column(Integer, primary_key=True)
    writing_persona_id = Column(Integer, ForeignKey("writing_personas.id"), nullable=False)
    platform_persona_id = Column(Integer, ForeignKey("platform_personas.id"), nullable=True)
    
    # Validation metrics
    stylometric_accuracy = Column(Float, nullable=True)  # How well persona matches original style
    consistency_score = Column(Float, nullable=True)  # Consistency across generated content
    platform_compliance = Column(Float, nullable=True)  # How well adapted to platform constraints
    
    # Test results
    sample_outputs = Column(JSON, nullable=True)  # Sample content generated with persona
    validation_feedback = Column(JSON, nullable=True)  # User or automated feedback
    improvement_suggestions = Column(JSON, nullable=True)  # Suggestions for persona refinement
    
    # Metadata
    validation_date = Column(DateTime, default=datetime.utcnow)
    validator_type = Column(String(50), nullable=True)  # automated, user, ai_review
    
    def __repr__(self):
        return f"<PersonaValidationResult(id={self.id}, persona_id={self.writing_persona_id}, accuracy={self.stylometric_accuracy})>"
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            'id': self.id,
            'writing_persona_id': self.writing_persona_id,
            'platform_persona_id': self.platform_persona_id,
            'stylometric_accuracy': self.stylometric_accuracy,
            'consistency_score': self.consistency_score,
            'platform_compliance': self.platform_compliance,
            'sample_outputs': self.sample_outputs,
            'validation_feedback': self.validation_feedback,
            'improvement_suggestions': self.improvement_suggestions,
            'validation_date': self.validation_date.isoformat() if self.validation_date else None,
            'validator_type': self.validator_type
        }