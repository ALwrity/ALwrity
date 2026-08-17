"""
Brand DNA Sync Service
Normalizes persona data and onboarding information into reusable brand tokens.
"""

from typing import Dict, Any, Optional
from loguru import logger

from services.database import SessionLocal
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService


class BrandDNASyncService:
    """Service to sync and normalize brand DNA from onboarding and persona data."""
    
    def __init__(self):
        """Initialize Brand DNA Sync Service."""
        self.logger = logger
        self.integration_service = OnboardingDataIntegrationService()
        logger.info("[Brand DNA Sync] Service initialized")
    
    def get_brand_dna_tokens(self, user_id: str) -> Dict[str, Any]:
        """
        Extract and normalize brand DNA tokens from onboarding and persona data.
        
        Args:
            user_id: User ID to fetch data for
            
        Returns:
            Dictionary of brand DNA tokens ready for prompt injection
        """
        try:
            db = SessionLocal()
            try:
                # Use SSOT Integration Service
                integrated_data = self.integration_service.get_integrated_data_sync(user_id, db)
                
                # Get canonical profile as primary source
                canonical_profile = integrated_data.get('canonical_profile', {})
                
                # Get raw data for deep fields
                website_analysis = integrated_data.get('website_analysis', {})
                persona_data = integrated_data.get('persona_data', {})
                competitor_analyses = integrated_data.get('competitor_analysis', [])
            finally:
                db.close()
            
            brand_tokens = {
                "writing_style": {},
                "target_audience": {},
                "visual_identity": {},
                "persona": {},
                "competitive_positioning": {},
            }
            
            # E.3 (deferred): STRUCTURED consumer — read canonical_profile.brand_voice ONLY
            # (unified persona-or-website, §2.2); legacy writing_tone/voice below is the
            # migration shim, removed at E.4.
            # Layer 1: Canonical Profile (Priority)
            brand_tokens["writing_style"] = {
                "tone": canonical_profile.get('writing_tone', 'professional'),
                "voice": canonical_profile.get('writing_voice', 'authoritative'),
                "complexity": canonical_profile.get('writing_complexity', 'intermediate'),
                "engagement_level": canonical_profile.get('writing_engagement', 'moderate'),
            }
            
            target_audience_raw = canonical_profile.get('target_audience')
            if isinstance(target_audience_raw, dict):
                brand_tokens["target_audience"] = {
                    "demographics": target_audience_raw.get('demographics', []),
                    "industry_focus": canonical_profile.get('industry', 'general'),
                    "expertise_level": target_audience_raw.get('expertise_level', 'intermediate'),
                }
            
            brand_tokens["visual_identity"] = {
                "color_palette": canonical_profile.get('brand_colors', []),
                "brand_values": canonical_profile.get('brand_values', []),
                "positioning": "",  # To be filled from website analysis
            }
            
            # Layer 2: Raw Website Analysis (Fallback/Enrichment)
            if website_analysis:
                writing_style = website_analysis.get('writing_style') or {}
                target_audience = website_analysis.get('target_audience') or {}
                brand_analysis = website_analysis.get('brand_analysis') or {}
                style_guidelines = website_analysis.get('style_guidelines') or {}
                
                # Enrich visual identity if missing
                if not brand_tokens["visual_identity"]["color_palette"] and isinstance(brand_analysis, dict):
                    brand_tokens["visual_identity"]["color_palette"] = brand_analysis.get('color_palette', [])
                    brand_tokens["visual_identity"]["brand_values"] = brand_analysis.get('brand_values', [])
                    brand_tokens["visual_identity"]["positioning"] = brand_analysis.get('positioning', '')
                
                # Add style_guidelines if available
                if style_guidelines and isinstance(style_guidelines, dict):
                    brand_tokens["visual_identity"]["style_guidelines"] = style_guidelines
            
            # Extract persona data
            # E.3 (deferred) follow-up #2: `corePersona`/`platformPersonas` here are
            # camelCase, but PersonaData.to_dict() emits `core_persona`/`platform_personas`
            # (snake_case) — this read silently yields {}. Fix as a SEPARATE labeled commit.
            if persona_data:
                core_persona = persona_data.get('corePersona') or {}
                platform_personas = persona_data.get('platformPersonas') or {}
                
                # Ensure core_persona is a dict before accessing
                if isinstance(core_persona, dict) and core_persona:
                    brand_tokens["persona"] = {
                        "persona_name": core_persona.get('persona_name', ''),
                        "archetype": core_persona.get('archetype', ''),
                        "core_belief": core_persona.get('core_belief', ''),
                        "linguistic_fingerprint": core_persona.get('linguistic_fingerprint', {}),
                    }
                
                # Ensure persona dict exists before setting platform_personas
                if "persona" not in brand_tokens:
                    brand_tokens["persona"] = {}
                
                # Only set platform_personas if it's a valid dict
                if isinstance(platform_personas, dict):
                    brand_tokens["persona"]["platform_personas"] = platform_personas
            
            # Extract competitive positioning
            if competitor_analyses and isinstance(competitor_analyses, list) and len(competitor_analyses) > 0:
                # Extract differentiation points
                brand_tokens["competitive_positioning"] = {
                    "differentiators": [],
                    "unique_value_props": [],
                    "market_position": "",
                    "competitor_insights": []
                }
                
                # Enrich with SSOT competitor analysis data
                for competitor in competitor_analyses[:3]:  # Top 3 competitors
                    if not isinstance(competitor, dict):
                        continue
                    
                    analysis_data = competitor.get('analysis_data') or {}
                    if isinstance(analysis_data, dict) and analysis_data:
                        # Extract insights
                        competitive_insights = analysis_data.get('competitive_analysis') or {}
                        if isinstance(competitive_insights, dict) and competitive_insights:
                            # Differentiators
                            differentiators = competitive_insights.get('differentiators', [])
                            if isinstance(differentiators, list) and differentiators:
                                brand_tokens["competitive_positioning"]["differentiators"].extend(
                                    differentiators[:2]
                                )
                            
                            # Value Props
                            uvp = competitive_insights.get('unique_value_propositions', [])
                            if isinstance(uvp, list) and uvp:
                                brand_tokens["competitive_positioning"]["unique_value_props"].extend(
                                    uvp[:2]
                                )
                                
                            # Market Position (take from first valid competitor or aggregate)
                            if not brand_tokens["competitive_positioning"]["market_position"]:
                                brand_tokens["competitive_positioning"]["market_position"] = competitive_insights.get('market_position', '')
                                
                        # Store simplified competitor insight
                        brand_tokens["competitive_positioning"]["competitor_insights"].append({
                            "name": competitor.get('competitor_url', 'Unknown'),
                            "strengths": analysis_data.get('strengths', [])[:3],
                            "weaknesses": analysis_data.get('weaknesses', [])[:3]
                        })

                # Deduplicate lists
                brand_tokens["competitive_positioning"]["differentiators"] = list(set(brand_tokens["competitive_positioning"]["differentiators"]))
                brand_tokens["competitive_positioning"]["unique_value_props"] = list(set(brand_tokens["competitive_positioning"]["unique_value_props"]))
            
            logger.info(f"[Brand DNA Sync] Extracted brand tokens for user {user_id}")
            return brand_tokens
            
        except Exception as e:
            logger.error(f"[Brand DNA Sync] Error extracting brand tokens: {str(e)}")
            return {
                "writing_style": {"tone": "professional", "voice": "authoritative"},
                "target_audience": {"demographics": [], "expertise_level": "intermediate"},
                "visual_identity": {},
                "persona": {},
                "competitive_positioning": {},
            }
    
    def get_channel_specific_dna(
        self,
        user_id: str,
        channel: str
    ) -> Dict[str, Any]:
        """
        Get channel-specific brand DNA adaptations.
        
        Args:
            user_id: User ID
            channel: Target channel (instagram, linkedin, tiktok, etc.)
            
        Returns:
            Channel-specific brand DNA tokens
        """
        brand_tokens = self.get_brand_dna_tokens(user_id)
        channel_dna = brand_tokens.copy()
        
        # Get platform-specific persona if available
        persona = brand_tokens.get("persona") or {}
        platform_personas = persona.get("platform_personas") or {}
        
        if isinstance(platform_personas, dict) and channel in platform_personas:
            platform_persona = platform_personas[channel]
            if isinstance(platform_persona, dict):
                channel_dna["platform_adaptation"] = {
                    "content_format_rules": platform_persona.get('content_format_rules') or {},
                    "engagement_patterns": platform_persona.get('engagement_patterns') or {},
                    "visual_identity": platform_persona.get('visual_identity') or {},
                }
        
        return channel_dna

