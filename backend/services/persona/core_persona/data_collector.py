"""
Onboarding Data Collector

Handles comprehensive collection of onboarding data for persona generation.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from loguru import logger

from services.database import get_db_session
from models.onboarding import OnboardingSession, WebsiteAnalysis, ResearchPreferences, APIKey

# Path tuples used to walk the onboarding_data tree looking for text that
# the deterministic linguistic analyzer can compute metrics on. We keep
# this list in one place (also referenced by prompt_builder._candidate_texts)
# so Phase 2 (linguistic analysis) and Phase 1 (verbatim phrase extraction)
# stay in lockstep.
_TEXT_SAMPLE_PATHS: List[tuple] = [
    ("websiteAnalysis", "crawl_result", "content"),
    ("websiteAnalysis", "crawl_result", "text"),
    ("websiteAnalysis", "crawl_result", "body"),
    ("websiteAnalysis", "crawl_result", "meta_info", "description"),
    ("websiteAnalysis", "crawl_result", "meta_info", "og_description"),
    ("websiteAnalysis", "crawl_result", "meta_info", "twitter_description"),
    ("websiteAnalysis", "crawl_result", "meta_info", "title"),
    ("websiteAnalysis", "meta_info", "description"),
    ("websiteAnalysis", "meta_info", "og_description"),
    ("websiteAnalysis", "meta_info", "title"),
    ("websiteAnalysis", "homepage"),
    ("websiteAnalysis", "samples"),
    ("websiteAnalysis", "content"),
    ("websiteAnalysis", "style_guidelines", "guidelines", "tone_recommendations"),
    ("websiteAnalysis", "style_guidelines", "guidelines", "structure_guidelines"),
    ("websiteAnalysis", "style_guidelines", "guidelines", "vocabulary_suggestions"),
    ("websiteAnalysis", "style_guidelines", "best_practices"),
    ("websiteAnalysis", "style_guidelines", "ai_generation_tips"),
    ("enhanced_analysis", "meta_data", "description"),
    ("enhanced_analysis", "meta_data", "title"),
    ("enhanced_analysis", "comprehensive_style_analysis"),
    ("enhanced_analysis", "brand_voice_analysis"),
    ("enhanced_analysis", "content_strategy_insights", "content_strategy"),
    ("enhanced_analysis", "content_strategy_insights", "tone_recommendations"),
    ("enhanced_analysis", "content_strategy_insights", "best_practices"),
]


class OnboardingDataCollector:
    """Collects comprehensive onboarding data for persona analysis."""
    
    def collect_onboarding_data(self, user_id: str, session_id: int = None) -> Optional[Dict[str, Any]]:
        """Collect comprehensive onboarding data for persona analysis."""
        try:
            session = get_db_session()
            
            # Find onboarding session
            if session_id:
                onboarding_session = session.query(OnboardingSession).filter(
                    OnboardingSession.id == session_id,
                    OnboardingSession.user_id == user_id
                ).first()
            else:
                onboarding_session = session.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(OnboardingSession.updated_at.desc()).first()
            
            if not onboarding_session:
                return None
            
            # Get ALL website analyses (there might be multiple)
            website_analyses = session.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == onboarding_session.id
            ).order_by(WebsiteAnalysis.updated_at.desc()).all()
            
            # Get research preferences
            research_prefs = session.query(ResearchPreferences).filter(
                ResearchPreferences.session_id == onboarding_session.id
            ).first()
            
            # Get API keys
            api_keys = session.query(APIKey).filter(
                APIKey.session_id == onboarding_session.id
            ).all()
            
            # Compile comprehensive data with ALL available information
            onboarding_data = {
                "session_info": {
                    "session_id": onboarding_session.id,
                    "user_id": onboarding_session.user_id,
                    "current_step": onboarding_session.current_step,
                    "progress": onboarding_session.progress,
                    "started_at": onboarding_session.started_at.isoformat() if onboarding_session.started_at else None,
                    "updated_at": onboarding_session.updated_at.isoformat() if onboarding_session.updated_at else None
                },
                "api_keys": [key.to_dict() for key in api_keys] if api_keys else [],
                "website_analyses": [analysis.to_dict() for analysis in website_analyses] if website_analyses else [],
                "research_preferences": research_prefs.to_dict() if research_prefs else None,
                
                # Legacy compatibility - use the latest website analysis
                "website_analysis": website_analyses[0].to_dict() if website_analyses else None,
                
                # Enhanced data extraction for persona generation
                "enhanced_analysis": self._extract_enhanced_analysis_data(website_analyses, research_prefs)
            }
            
            session.close()
            return onboarding_data
            
        except Exception as e:
            logger.error(f"Error collecting onboarding data: {str(e)}")
            return None
    
    def _extract_enhanced_analysis_data(self, website_analyses: List, research_prefs) -> Dict[str, Any]:
        """Extract and structure all the rich AI analysis data for persona generation."""
        enhanced_data = {
            "comprehensive_style_analysis": {},
            "content_insights": {},
            "audience_intelligence": {},
            "brand_voice_analysis": {},
            "technical_writing_metrics": {},
            "competitive_analysis": {},
            "content_strategy_insights": {},
            "sitemap_analysis": {},
            "meta_data": {}
        }
        
        if not website_analyses:
            return enhanced_data
        
        # Use the latest (most comprehensive) website analysis
        latest_analysis = website_analyses[0]
        
        # Extract comprehensive style analysis
        if latest_analysis.writing_style:
            enhanced_data["comprehensive_style_analysis"] = {
                "tone_analysis": latest_analysis.writing_style.get("tone", ""),
                "voice_characteristics": latest_analysis.writing_style.get("voice", ""),
                "complexity_assessment": latest_analysis.writing_style.get("complexity", ""),
                "engagement_level": latest_analysis.writing_style.get("engagement_level", ""),
                "brand_personality": latest_analysis.writing_style.get("brand_personality", ""),
                "formality_level": latest_analysis.writing_style.get("formality_level", ""),
                "emotional_appeal": latest_analysis.writing_style.get("emotional_appeal", "")
            }
        
        # Extract content insights
        if latest_analysis.content_characteristics:
            enhanced_data["content_insights"] = {
                "sentence_structure_analysis": latest_analysis.content_characteristics.get("sentence_structure", ""),
                "vocabulary_level": latest_analysis.content_characteristics.get("vocabulary_level", ""),
                "paragraph_organization": latest_analysis.content_characteristics.get("paragraph_organization", ""),
                "content_flow": latest_analysis.content_characteristics.get("content_flow", ""),
                "readability_score": latest_analysis.content_characteristics.get("readability_score", ""),
                "content_density": latest_analysis.content_characteristics.get("content_density", ""),
                "visual_elements_usage": latest_analysis.content_characteristics.get("visual_elements_usage", "")
            }
        
        # Extract audience intelligence
        if latest_analysis.target_audience:
            enhanced_data["audience_intelligence"] = {
                "demographics": latest_analysis.target_audience.get("demographics", []),
                "expertise_level": latest_analysis.target_audience.get("expertise_level", ""),
                "industry_focus": latest_analysis.target_audience.get("industry_focus", ""),
                "geographic_focus": latest_analysis.target_audience.get("geographic_focus", ""),
                "psychographic_profile": latest_analysis.target_audience.get("psychographic_profile", ""),
                "pain_points": latest_analysis.target_audience.get("pain_points", []),
                "motivations": latest_analysis.target_audience.get("motivations", [])
            }
        
        # Extract brand voice analysis
        if latest_analysis.content_type:
            enhanced_data["brand_voice_analysis"] = {
                "primary_content_type": latest_analysis.content_type.get("primary_type", ""),
                "secondary_content_types": latest_analysis.content_type.get("secondary_types", []),
                "content_purpose": latest_analysis.content_type.get("purpose", ""),
                "call_to_action_style": latest_analysis.content_type.get("call_to_action", ""),
                "conversion_focus": latest_analysis.content_type.get("conversion_focus", ""),
                "educational_value": latest_analysis.content_type.get("educational_value", "")
            }
        
        # Extract technical writing metrics
        if latest_analysis.style_patterns:
            enhanced_data["technical_writing_metrics"] = {
                "sentence_length_preference": latest_analysis.style_patterns.get("patterns", {}).get("sentence_length", ""),
                "vocabulary_patterns": latest_analysis.style_patterns.get("patterns", {}).get("vocabulary_patterns", []),
                "rhetorical_devices": latest_analysis.style_patterns.get("patterns", {}).get("rhetorical_devices", []),
                "paragraph_structure": latest_analysis.style_patterns.get("patterns", {}).get("paragraph_structure", ""),
                "transition_phrases": latest_analysis.style_patterns.get("patterns", {}).get("transition_phrases", []),
                "style_consistency": latest_analysis.style_patterns.get("style_consistency", ""),
                "unique_elements": latest_analysis.style_patterns.get("unique_elements", [])
            }
        
        # Extract competitive analysis from crawl results
        if latest_analysis.crawl_result:
            crawl_data = latest_analysis.crawl_result
            enhanced_data["competitive_analysis"] = {
                "domain_info": crawl_data.get("domain_info", {}),
                "social_media_presence": crawl_data.get("social_media", {}),
                "brand_info": crawl_data.get("brand_info", {}),
                "content_structure": crawl_data.get("content_structure", {}),
                "meta_optimization": crawl_data.get("meta_tags", {})
            }
            
            # Extract meta info if available
            if crawl_data.get("meta_info"):
                enhanced_data["meta_data"] = crawl_data.get("meta_info")
                
            # Extract sitemap analysis if available
            if crawl_data.get("sitemap_analysis"):
                enhanced_data["sitemap_analysis"] = crawl_data.get("sitemap_analysis")
        
        # Extract content strategy insights from style guidelines
        if latest_analysis.style_guidelines:
            guidelines = latest_analysis.style_guidelines
            enhanced_data["content_strategy_insights"] = {
                "tone_recommendations": guidelines.get("guidelines", {}).get("tone_recommendations", []),
                "structure_guidelines": guidelines.get("guidelines", {}).get("structure_guidelines", []),
                "vocabulary_suggestions": guidelines.get("guidelines", {}).get("vocabulary_suggestions", []),
                "engagement_tips": guidelines.get("guidelines", {}).get("engagement_tips", []),
                "audience_considerations": guidelines.get("guidelines", {}).get("audience_considerations", []),
                "brand_alignment": guidelines.get("guidelines", {}).get("brand_alignment", []),
                "seo_optimization": guidelines.get("guidelines", {}).get("seo_optimization", []),
                "conversion_optimization": guidelines.get("guidelines", {}).get("conversion_optimization", []),
                "best_practices": guidelines.get("best_practices", []),
                "avoid_elements": guidelines.get("avoid_elements", []),
                "content_strategy": guidelines.get("content_strategy", ""),
                "ai_generation_tips": guidelines.get("ai_generation_tips", []),
                "competitive_advantages": guidelines.get("competitive_advantages", []),
                "content_calendar_suggestions": guidelines.get("content_calendar_suggestions", [])
            }
        
        # Add research preferences insights
        if research_prefs:
            enhanced_data["research_preferences"] = {
                "research_depth": research_prefs.research_depth,
                "content_types": research_prefs.content_types,
                "auto_research": research_prefs.auto_research,
                "factual_content": research_prefs.factual_content
            }
        
        return enhanced_data
    
    def calculate_data_sufficiency(self, onboarding_data: Dict[str, Any]) -> float:
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

    def extract_text_samples_from_onboarding_data(
        self,
        onboarding_data: Dict[str, Any],
        *,
        max_samples: int = 6,
        max_chars_per_sample: int = 4000,
        min_chars: int = 200,
    ) -> List[str]:
        """Pull a list of text samples from onboarding data for deterministic
        linguistic analysis.

        Used by the persona generation flow to feed the
        ``EnhancedLinguisticAnalyzer.analyze_writing_style`` call — which
        produces the deterministic numbers that ground the LLM's
        ``linguistic_fingerprint`` claims (average sentence length, active
        vs passive ratio, readability, vocabulary sophistication, etc.).

        We walk a known set of paths (frontend-style ``websiteAnalysis``
        keys + backend-style ``enhanced_analysis`` keys) and pull whatever
        text we can find. We dedupe and cap each sample at
        ``max_chars_per_sample`` so a giant meta description doesn't blow
        up NLTK tokenization later.

        Filters out samples shorter than ``min_chars`` (they don't have
        enough signal for a meaningful analysis) and caps the total
        returned at ``max_samples`` (the analyzer's
        ``_calculate_analysis_confidence`` rewards quantity, but we don't
        want to spam it with 50 short snippets).

        On any structural error, returns ``[]`` so callers can fall back
        to the soft-mock path.
        """
        if not isinstance(onboarding_data, dict):
            return []

        try:
            samples: List[str] = []
            seen: set = set()

            def _consider(value: Any) -> None:
                """Add ``value`` to ``samples`` if it looks like usable text."""
                if value is None:
                    return
                if isinstance(value, str):
                    text = value.strip()
                elif isinstance(value, list):
                    for item in value:
                        _consider(item)
                    return
                elif isinstance(value, dict):
                    for v in value.values():
                        _consider(v)
                    return
                else:
                    return

                if len(text) < min_chars:
                    return
                if len(text) > max_chars_per_sample:
                    text = text[:max_chars_per_sample]
                key = text[:120].lower()
                if key in seen:
                    return
                seen.add(key)
                samples.append(text)

            for path in _TEXT_SAMPLE_PATHS:
                if len(samples) >= max_samples:
                    break
                node: Any = onboarding_data
                for key in path:
                    if isinstance(node, dict) and key in node:
                        node = node[key]
                    else:
                        node = None
                        break
                _consider(node)

            logger.debug(
                f"Extracted {len(samples)} text samples from onboarding data "
                f"(min_chars={min_chars}, max_samples={max_samples})"
            )
            return samples
        except Exception as e:
            logger.warning(
                f"Failed to extract text samples for linguistic analysis: {e}. "
                f"Persona will fall back to soft-mock linguistic_fingerprint."
            )
            return []
