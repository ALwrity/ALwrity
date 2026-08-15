"""
Persona Analysis Service
Uses Gemini structured responses to analyze onboarding data and create writing personas.

NOTE: This service uses the legacy WritingPersona/PlatformPersona models.
For new code, use PersonaDataService instead, which works with the PersonaData table
and provides richer persona data from onboarding.

DEPRECATED: Consider migrating to PersonaDataService for better data richness.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime
import json

from services.database import get_db_session
from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences
from models.persona_models import WritingPersona, PlatformPersona, PersonaAnalysisResult
from services.persona.platform_registry import get_platform_constraints

def _is_feature_limited_mode():
    """Check if running in feature-limited mode to skip heavy initialization."""
    import os
    env_val = os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower()
    return env_val not in ("", "all")

class PersonaAnalysisService:
    """Service for analyzing onboarding data and generating writing personas using Gemini AI."""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """Implement singleton pattern to prevent multiple initializations."""
        if cls._instance is None:
            cls._instance = super(PersonaAnalysisService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the persona analysis service (only once)."""
        if not self._initialized:
            # Skip heavy initialization in feature-limited mode
            if _is_feature_limited_mode():
                logger.debug(f"PersonaAnalysisService: Skipping heavy init in feature-limited mode")
                self._initialized = True
                return
            
            # Only initialize heavy services when needed (not at import time)
            self._heavy_init_done = False
    
    def _ensure_heavy_init(self):
        """Lazily initialize heavy services only when first used."""
        if self._heavy_init_done:
            return
            
        # Check again in case mode changed
        if _is_feature_limited_mode():
            logger.debug("PersonaAnalysisService: Skipping heavy init in feature-limited mode")
            self._heavy_init_done = True
            return
            
        try:
            from services.persona.core_persona import CorePersonaService, OnboardingDataCollector
            from services.persona.linkedin.linkedin_persona_service import LinkedInPersonaService
            from services.persona.facebook.facebook_persona_service import FacebookPersonaService
            
            self.core_persona_service = CorePersonaService()
            self.data_collector = OnboardingDataCollector()
            self.linkedin_service = LinkedInPersonaService()
            self.facebook_service = FacebookPersonaService()
            self._heavy_init_done = True
            logger.debug("PersonaAnalysisService initialized (lazy)")
        except Exception as e:
            logger.warning(f"PersonaAnalysisService: Failed to initialize heavy services: {e}")
            self._heavy_init_done = True
    
    def generate_persona_from_onboarding(self, user_id: str, onboarding_session_id: int = None) -> Dict[str, Any]:
        """
        Generate a comprehensive writing persona from user's onboarding data.
        
        Args:
            user_id: User ID to generate persona for
            onboarding_session_id: Optional specific onboarding session ID
            
        Returns:
            Generated persona data with platform adaptations
        """
        # Ensure heavy services are initialized
        self._ensure_heavy_init()
        
        # Check if heavy init failed (feature-limited mode)
        if not getattr(self, '_heavy_init_done', False):
            return {"error": "Persona service unavailable in feature-limited mode"}
            
        try:
            logger.info(f"Generating persona for user {user_id}")
            
            # Get onboarding data
            onboarding_data = self.data_collector.collect_onboarding_data(user_id, onboarding_session_id)
            
            if not onboarding_data:
                logger.warning(f"No onboarding data found for user {user_id}")
                return {"error": "No onboarding data available for persona generation"}
            
            # Generate core persona using Gemini
            core_persona = self.core_persona_service.generate_core_persona(onboarding_data)
            
            if "error" in core_persona:
                return core_persona
            
            # Generate platform-specific adaptations
            platform_personas = self.core_persona_service.generate_platform_adaptations(core_persona, onboarding_data)
            
            # Save to database
            saved_persona = self._save_persona_to_db(user_id, core_persona, platform_personas, onboarding_data)
            
            return {
                "persona_id": saved_persona.id,
                "core_persona": core_persona,
                "platform_personas": platform_personas,
                "analysis_metadata": {
                    "confidence_score": core_persona.get("confidence_score", 0.0),
                    "data_sufficiency": self.data_collector.calculate_data_sufficiency(onboarding_data),
                    "generated_at": datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating persona for user {user_id}: {str(e)}")
            return {"error": f"Failed to generate persona: {str(e)}"}
    
    
    def _build_persona_analysis_prompt(self, onboarding_data: Dict[str, Any]) -> str:
        """Build the main persona analysis prompt with comprehensive data."""
        
        # Get enhanced analysis data
        enhanced_analysis = onboarding_data.get("enhanced_analysis", {})
        website_analysis = onboarding_data.get("website_analysis", {}) or {}
        research_prefs = onboarding_data.get("research_preferences", {}) or {}
        
        prompt = f"""
COMPREHENSIVE PERSONA GENERATION TASK: Create a highly detailed, data-driven writing persona based on extensive AI analysis of user's website and content strategy.

=== COMPREHENSIVE ONBOARDING DATA ANALYSIS ===

WEBSITE ANALYSIS OVERVIEW:
- URL: {website_analysis.get('website_url', 'Not provided')}
- Analysis Date: {website_analysis.get('analysis_date', 'Not provided')}
- Status: {website_analysis.get('status', 'Not provided')}

=== DETAILED STYLE ANALYSIS ===
{json.dumps(enhanced_analysis.get('comprehensive_style_analysis', {}), indent=2)}

=== CONTENT INSIGHTS ===
{json.dumps(enhanced_analysis.get('content_insights', {}), indent=2)}

=== AUDIENCE INTELLIGENCE ===
{json.dumps(enhanced_analysis.get('audience_intelligence', {}), indent=2)}

=== BRAND VOICE ANALYSIS ===
{json.dumps(enhanced_analysis.get('brand_voice_analysis', {}), indent=2)}

=== TECHNICAL WRITING METRICS ===
{json.dumps(enhanced_analysis.get('technical_writing_metrics', {}), indent=2)}

=== COMPETITIVE ANALYSIS ===
{json.dumps(enhanced_analysis.get('competitive_analysis', {}), indent=2)}

=== CONTENT STRATEGY INSIGHTS ===
{json.dumps(enhanced_analysis.get('content_strategy_insights', {}), indent=2)}

=== RESEARCH PREFERENCES ===
{json.dumps(enhanced_analysis.get('research_preferences', {}), indent=2)}

=== LEGACY DATA (for compatibility) ===
Website Analysis: {json.dumps(website_analysis.get('writing_style', {}), indent=2)}
Content Characteristics: {json.dumps(website_analysis.get('content_characteristics', {}) or {}, indent=2)}
Target Audience: {json.dumps(website_analysis.get('target_audience', {}), indent=2)}
Style Patterns: {json.dumps(website_analysis.get('style_patterns', {}), indent=2)}

=== COMPREHENSIVE PERSONA GENERATION REQUIREMENTS ===

1. IDENTITY CREATION (Based on Brand Analysis):
   - Create a memorable persona name that captures the essence of the brand personality and writing style
   - Define a clear archetype that reflects the brand's positioning and audience appeal
   - Articulate a core belief that drives the writing philosophy and brand values
   - Write a comprehensive brand voice description incorporating all style elements

2. LINGUISTIC FINGERPRINT (Quantitative Analysis from Technical Metrics):
   - Calculate precise average sentence length from sentence structure analysis
   - Determine preferred sentence types based on paragraph organization patterns
   - Analyze active vs passive voice ratio from voice characteristics
   - Extract go-to words and phrases from vocabulary patterns and style analysis
   - List words and phrases to avoid based on brand alignment guidelines
   - Determine contraction usage patterns from formality level
   - Assess vocabulary complexity level from readability scores

3. RHETORICAL ANALYSIS (From Style Patterns):
   - Identify metaphor patterns and themes from rhetorical devices
   - Analyze analogy usage from content strategy insights
   - Assess rhetorical question frequency from engagement tips
   - Determine storytelling approach from content flow analysis

4. TONAL RANGE (From Comprehensive Style Analysis):
   - Define the default tone from tone analysis and brand personality
   - List permissible tones based on emotional appeal and audience considerations
   - Identify forbidden tones from avoid elements and brand alignment
   - Describe emotional range from psychographic profile and engagement level

5. STYLISTIC CONSTRAINTS (From Technical Writing Metrics):
   - Define punctuation preferences from paragraph structure analysis
   - Set formatting guidelines from content structure insights
   - Establish paragraph structure preferences from organization patterns
   - Include transition phrase preferences from style patterns

6. PLATFORM-SPECIFIC ADAPTATIONS (From Content Strategy):
   - Incorporate SEO optimization strategies
   - Include conversion optimization techniques
   - Apply engagement tips for different platforms
   - Use competitive advantages for differentiation

7. CONTENT STRATEGY INTEGRATION:
   - Incorporate best practices from content strategy insights
   - Include AI generation tips for consistent output
   - Apply content calendar suggestions for timing
   - Use competitive advantages for positioning

=== ENHANCED ANALYSIS INSTRUCTIONS ===
- Base your analysis on ALL the comprehensive data provided above
- Use the detailed technical metrics for precise linguistic analysis
- Incorporate brand voice analysis for authentic personality
- Apply audience intelligence for targeted communication
- Include competitive analysis for market positioning
- Use content strategy insights for practical application
- Ensure the persona reflects the brand's unique elements and competitive advantages
- Provide a confidence score (0-100) based on data richness and quality
- Include detailed analysis notes explaining your reasoning and data sources

Generate a comprehensive, data-driven persona profile that can be used to replicate this writing style across different platforms while maintaining brand authenticity and competitive positioning.
"""
        
        return prompt
    
    def _build_platform_adaptation_prompt(self, core_persona: Dict[str, Any], platform: str, onboarding_data: Dict[str, Any]) -> str:
        """Build prompt for platform-specific persona adaptation."""
        
        platform_constraints = get_platform_constraints(platform)
        
        prompt = f"""
PLATFORM ADAPTATION TASK: Adapt the core writing persona for {platform.upper()}.

CORE PERSONA:
{json.dumps(core_persona, indent=2)}

PLATFORM: {platform.upper()}

PLATFORM CONSTRAINTS:
{json.dumps(platform_constraints, indent=2)}

ADAPTATION REQUIREMENTS:

1. SENTENCE METRICS:
   - Adjust sentence length for platform optimal performance
   - Adapt sentence variety for platform engagement
   - Consider platform reading patterns

2. LEXICAL ADAPTATIONS:
   - Identify platform-specific vocabulary and slang
   - Define hashtag strategy (if applicable)
   - Set emoji usage guidelines
   - Establish mention and tagging strategy

3. CONTENT FORMAT RULES:
   - Respect character/word limits
   - Optimize paragraph structure for platform
   - Define call-to-action style
   - Set link placement strategy

4. ENGAGEMENT PATTERNS:
   - Determine optimal posting frequency
   - Identify best posting times for audience
   - Define engagement tactics
   - Set community interaction guidelines

5. PLATFORM BEST PRACTICES:
   - List platform-specific optimization techniques
   - Consider algorithm preferences
   - Include trending format adaptations

INSTRUCTIONS:
- Maintain the core persona identity while optimizing for platform performance
- Ensure all adaptations align with the original brand voice
- Consider platform-specific audience behavior
- Provide actionable, specific guidelines

Generate a platform-optimized persona adaptation that maintains brand consistency while maximizing platform performance.
"""
        
        return prompt
    
    
    def _save_persona_to_db(self, user_id: int, core_persona: Dict[str, Any], platform_personas: Dict[str, Any], onboarding_data: Dict[str, Any]) -> WritingPersona:
        """Save generated persona to database."""
        try:
            session = get_db_session()
            
            # Create main persona record
            writing_persona = WritingPersona(
                user_id=user_id,
                persona_name=core_persona.get("identity", {}).get("persona_name", "Generated Persona"),
                archetype=core_persona.get("identity", {}).get("archetype"),
                core_belief=core_persona.get("identity", {}).get("core_belief"),
                brand_voice_description=core_persona.get("identity", {}).get("brand_voice_description"),
                linguistic_fingerprint=core_persona.get("linguistic_fingerprint", {}),
                platform_adaptations={"platforms": list(platform_personas.keys())},
                onboarding_session_id=onboarding_data.get("session_info", {}).get("session_id"),
                source_website_analysis=onboarding_data.get("website_analysis") or {},
                source_research_preferences=onboarding_data.get("research_preferences") or {},
                ai_analysis_version="gemini_v1.0",
                confidence_score=core_persona.get("confidence_score", 0.0)
            )
            
            session.add(writing_persona)
            session.commit()
            session.refresh(writing_persona)
            
            # Create platform-specific persona records
            for platform, platform_data in platform_personas.items():
                # Prepare platform-specific data
                platform_specific_data = {}
                if platform.lower() == "linkedin":
                    platform_specific_data = {
                        "professional_networking": platform_data.get("professional_networking", {}),
                        "linkedin_features": platform_data.get("linkedin_features", {}),
                        "algorithm_optimization": platform_data.get("algorithm_optimization", {}),
                        "professional_context_optimization": platform_data.get("professional_context_optimization", {})
                    }
                elif platform.lower() == "facebook":
                    platform_specific_data = {
                        "facebook_algorithm_optimization": platform_data.get("facebook_algorithm_optimization", {}),
                        "facebook_engagement_strategies": platform_data.get("facebook_engagement_strategies", {}),
                        "facebook_content_formats": platform_data.get("facebook_content_formats", {}),
                        "facebook_audience_targeting": platform_data.get("facebook_audience_targeting", {}),
                        "facebook_community_building": platform_data.get("facebook_community_building", {})
                    }
                
                platform_persona = PlatformPersona(
                    writing_persona_id=writing_persona.id,
                    platform_type=platform,
                    sentence_metrics=platform_data.get("sentence_metrics", {}),
                    lexical_features=platform_data.get("lexical_adaptations", {}),
                    rhetorical_devices=core_persona.get("linguistic_fingerprint", {}).get("rhetorical_devices", {}),
                    tonal_range=core_persona.get("tonal_range", {}),
                    stylistic_constraints=core_persona.get("stylistic_constraints", {}),
                    content_format_rules=platform_data.get("content_format_rules", {}),
                    engagement_patterns=platform_data.get("engagement_patterns", {}),
                    platform_best_practices={"practices": platform_data.get("platform_best_practices", [])},
                    algorithm_considerations=platform_specific_data if platform_specific_data else platform_data.get("algorithm_considerations", {})
                )
                session.add(platform_persona)
            
            # Save analysis result
            analysis_result = PersonaAnalysisResult(
                user_id=user_id,
                writing_persona_id=writing_persona.id,
                analysis_prompt=self._build_persona_analysis_prompt(onboarding_data)[:5000],  # Truncate for storage
                input_data=onboarding_data,
                linguistic_analysis=core_persona.get("linguistic_fingerprint", {}),
                personality_analysis=core_persona.get("identity", {}),
                platform_recommendations=platform_personas,
                style_guidelines=core_persona.get("stylistic_constraints", {}),
                analysis_confidence=core_persona.get("confidence_score", 0.0),
                data_sufficiency_score=self._calculate_data_sufficiency(onboarding_data),
                ai_provider="gemini",
                model_version="gemini-2.5-flash"
            )
            session.add(analysis_result)
            
            session.commit()
            persona_id = writing_persona.id
            session.close()
            
            logger.info(f"✅ Persona saved to database with ID: {persona_id}")
            return writing_persona
            
        except Exception as e:
            logger.error(f"Error saving persona to database: {str(e)}")
            if session:
                session.rollback()
                session.close()
            raise
    
    def _calculate_data_sufficiency(self, onboarding_data: Dict[str, Any]) -> float:
        """Calculate how sufficient the onboarding data is for persona generation."""
        score = 0.0
        
        # Get enhanced analysis data
        enhanced_analysis = onboarding_data.get("enhanced_analysis", {})
        website_analysis = onboarding_data.get("website_analysis", {}) or {}
        research_prefs = onboarding_data.get("research_preferences", {}) or {}
        
        # Enhanced scoring based on comprehensive data availability
        
        # Comprehensive Style Analysis (25% of score)
        style_analysis = enhanced_analysis.get("comprehensive_style_analysis", {})
        if style_analysis.get("tone_analysis"):
            score += 5
        if style_analysis.get("voice_characteristics"):
            score += 5
        if style_analysis.get("brand_personality"):
            score += 5
        if style_analysis.get("formality_level"):
            score += 5
        if style_analysis.get("emotional_appeal"):
            score += 5
        
        # Content Insights (20% of score)
        content_insights = enhanced_analysis.get("content_insights", {})
        if content_insights.get("sentence_structure_analysis"):
            score += 4
        if content_insights.get("vocabulary_level"):
            score += 4
        if content_insights.get("readability_score"):
            score += 4
        if content_insights.get("content_flow"):
            score += 4
        if content_insights.get("visual_elements_usage"):
            score += 4
        
        # Audience Intelligence (15% of score)
        audience_intel = enhanced_analysis.get("audience_intelligence", {})
        if audience_intel.get("demographics"):
            score += 3
        if audience_intel.get("expertise_level"):
            score += 3
        if audience_intel.get("industry_focus"):
            score += 3
        if audience_intel.get("psychographic_profile"):
            score += 3
        if audience_intel.get("pain_points"):
            score += 3
        
        # Technical Writing Metrics (15% of score)
        tech_metrics = enhanced_analysis.get("technical_writing_metrics", {})
        if tech_metrics.get("vocabulary_patterns"):
            score += 3
        if tech_metrics.get("rhetorical_devices"):
            score += 3
        if tech_metrics.get("paragraph_structure"):
            score += 3
        if tech_metrics.get("style_consistency"):
            score += 3
        if tech_metrics.get("unique_elements"):
            score += 3
        
        # Content Strategy Insights (15% of score)
        strategy_insights = enhanced_analysis.get("content_strategy_insights", {})
        if strategy_insights.get("tone_recommendations"):
            score += 3
        if strategy_insights.get("best_practices"):
            score += 3
        if strategy_insights.get("competitive_advantages"):
            score += 3
        if strategy_insights.get("content_strategy"):
            score += 3
        if strategy_insights.get("ai_generation_tips"):
            score += 3
        
        # Research Preferences (10% of score)
        if research_prefs.get("research_depth"):
            score += 5
        if research_prefs.get("content_types"):
            score += 5
        
        # Legacy compatibility - add points for basic data if enhanced data is missing
        if score < 50:  # If enhanced data is insufficient, fall back to legacy scoring
            legacy_score = 0.0
            
            # Website analysis components (70% of legacy score)
            if website_analysis.get("writing_style"):
                legacy_score += 25
            if website_analysis.get("content_characteristics"):
                legacy_score += 20
            if website_analysis.get("target_audience"):
                legacy_score += 15
            if website_analysis.get("style_patterns"):
                legacy_score += 10
            
            # Research preferences components (30% of legacy score)
            if research_prefs.get("research_depth"):
                legacy_score += 10
            if research_prefs.get("content_types"):
                legacy_score += 10
            if research_prefs.get("writing_style"):
                legacy_score += 10
            
            # Use the higher of enhanced or legacy score
            score = max(score, legacy_score)
        
        return min(score, 100.0)
    
    def get_user_personas(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all personas for a user."""
        try:
            session = get_db_session()
            
            personas = session.query(WritingPersona).filter(
                WritingPersona.user_id == user_id,
                WritingPersona.is_active == True
            ).all()
            
            result = []
            for persona in personas:
                persona_dict = persona.to_dict()
                
                # Get platform personas
                platform_personas = session.query(PlatformPersona).filter(
                    PlatformPersona.writing_persona_id == persona.id,
                    PlatformPersona.is_active == True
                ).all()
                
                persona_dict["platforms"] = [pp.to_dict() for pp in platform_personas]
                result.append(persona_dict)
            
            session.close()
            return result
            
        except Exception as e:
            logger.error(f"Error getting user personas: {str(e)}")
            return []
    
    def get_persona_for_platform(self, user_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """Get the best persona for a specific platform."""
        try:
            session = get_db_session(user_id)
            
            # Get the most recent active persona
            persona = session.query(WritingPersona).filter(
                WritingPersona.user_id == user_id,
                WritingPersona.is_active == True
            ).order_by(WritingPersona.created_at.desc()).first()
            
            if not persona:
                return None
            
            # Get platform-specific adaptation
            platform_persona = session.query(PlatformPersona).filter(
                PlatformPersona.writing_persona_id == persona.id,
                PlatformPersona.platform_type == platform,
                PlatformPersona.is_active == True
            ).first()
            
            result = {
                "core_persona": persona.to_dict(),
                "platform_adaptation": platform_persona.to_dict() if platform_persona else None
            }
            
            session.close()
            return result
            
        except Exception as e:
            logger.error(f"Error getting persona for platform {platform}: {str(e)}")
            return None
