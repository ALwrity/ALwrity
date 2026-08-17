"""
Campaign Creator Prompt Builder
Extends AIPromptOptimizer with campaign-specific prompt enhancement.
"""

from typing import Dict, Any, Optional
from loguru import logger

from services.ai_prompt_optimizer import AIPromptOptimizer
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.persona_data_service import PersonaDataService
from services.database import SessionLocal


class CampaignPromptBuilder(AIPromptOptimizer):
    """Specialized prompt builder for campaign assets with onboarding data integration."""
    
    def __init__(self):
        """Initialize Campaign Prompt Builder."""
        super().__init__()
        self.integration_service = OnboardingDataIntegrationService()
        self.logger = logger
        logger.info("[Campaign Prompt Builder] Initialized")
    
    def build_marketing_image_prompt(
        self,
        base_prompt: str,
        user_id: str,
        channel: Optional[str] = None,
        asset_type: str = "hero_image",
        product_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build enhanced marketing image prompt with brand DNA and persona data.
        
        Args:
            base_prompt: Base product description or image concept
            user_id: User ID to fetch onboarding data
            channel: Target channel (instagram, linkedin, tiktok, etc.)
            asset_type: Type of asset (hero_image, product_photo, lifestyle, etc.)
            product_context: Additional product information
            
        Returns:
            Enhanced prompt with brand DNA, persona style, and marketing context
        """
        try:
            # Get onboarding data via SSOT
            db = SessionLocal()
            try:
                integrated_data = self.integration_service.get_integrated_data_sync(user_id, db)
                # Use canonical profile as primary source
                canonical_profile = integrated_data.get('canonical_profile', {})
                # Keep raw data access for deep fields not yet in canonical
                website_analysis = integrated_data.get('website_analysis', {})
                persona_data = integrated_data.get('persona_data', {})
            finally:
                db.close()
            
            # Build prompt layers
            enhanced_prompt = base_prompt
            
            # E.3 (deferred): PROMPT consumer — render prose from the unified
            # canonical_profile.brand_voice (persona-or-website, §2.2), NOT raw PersonaData.
            # Legacy writing_tone/voice below is the migration shim, removed at E.4.
            # Layer 1: Brand DNA (Prioritize Canonical Profile)
            writing_tone = canonical_profile.get('writing_tone', 'professional')
            writing_voice = canonical_profile.get('writing_voice', 'authoritative')
            brand_colors = canonical_profile.get('brand_colors', [])
            target_audience = canonical_profile.get('target_audience', {})
            
            # Add brand tone and style
            brand_enhancement = f", {writing_tone} tone, {writing_voice} voice"
            enhanced_prompt += brand_enhancement
            
            # Add target audience context
            if isinstance(target_audience, dict):
                demographics = target_audience.get('demographics', [])
                if demographics:
                    audience_context = f", targeting {', '.join(demographics[:2])}"
                    enhanced_prompt += audience_context
            
            # Add brand visual identity
            if brand_colors:
                colors = ', '.join(brand_colors[:3])
                enhanced_prompt += f", brand colors: {colors}"
            
            # Layer 2: Persona Visual Style (from persona_data fallback if needed)
            if persona_data:
                core_persona = persona_data.get('corePersona', {})
                platform_personas = persona_data.get('platformPersonas', {})
                
                if core_persona:
                    persona_name = core_persona.get('persona_name', '')
                    if persona_name:
                        enhanced_prompt += f", {persona_name} style"
                
                # Channel-specific persona adaptation
                if channel and platform_personas:
                    platform_persona = platform_personas.get(channel, {})
                    if platform_persona:
                        visual_identity = platform_persona.get('visual_identity', {})
                        if visual_identity:
                            aesthetic = visual_identity.get('aesthetic_preferences', '')
                            if aesthetic:
                                enhanced_prompt += f", {aesthetic} aesthetic"
            
            # Layer 3: Channel Optimization
            channel_enhancements = {
                'instagram': ', Instagram-optimized composition, vibrant colors, engaging visual',
                'linkedin': ', professional photography, clean composition, business-focused',
                'tiktok': ', dynamic composition, eye-catching, vertical format optimized',
                'facebook': ', social media optimized, engaging, shareable visual',
                'twitter': ', Twitter card optimized, clear focal point, readable at small size',
                'pinterest': ', Pinterest-optimized, vertical format, detailed and informative',
            }
            
            if channel and channel.lower() in channel_enhancements:
                enhanced_prompt += channel_enhancements[channel.lower()]
            
            # Layer 4: Asset Type Specific
            asset_type_enhancements = {
                'hero_image': ', hero image style, prominent product placement, professional photography',
                'product_photo': ', product photography, clean background, detailed product showcase',
                'lifestyle': ', lifestyle photography, natural setting, authentic scene',
                'social_post': ', social media post, engaging composition, optimized for engagement',
            }
            
            if asset_type in asset_type_enhancements:
                enhanced_prompt += asset_type_enhancements[asset_type]
            
            # Layer 5: Competitive Differentiation
            if competitor_analyses and len(competitor_analyses) > 0:
                # Extract unique positioning from competitor analysis
                enhanced_prompt += ", unique positioning, differentiated visual style"
            
            # Layer 6: Quality Descriptors
            enhanced_prompt += ", professional photography, high quality, detailed, sharp focus, natural lighting"
            
            # Layer 7: Marketing Context
            if product_context:
                marketing_goal = product_context.get('marketing_goal', '')
                if marketing_goal:
                    enhanced_prompt += f", {marketing_goal} focused"
            
            logger.info(f"[Campaign Prompt] Enhanced prompt for user {user_id}: {enhanced_prompt[:200]}...")
            return enhanced_prompt
            
        except Exception as e:
            logger.error(f"[Campaign Prompt] Error building prompt: {str(e)}")
            # Return base prompt with minimal enhancement if error
            return f"{base_prompt}, professional photography, high quality"
    
    def build_marketing_copy_prompt(
        self,
        base_request: str,
        user_id: str,
        channel: Optional[str] = None,
        content_type: str = "caption",
        product_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build enhanced marketing copy prompt with persona linguistic fingerprint.
        
        Args:
            base_request: Base content request (e.g., "Write Instagram caption for product launch")
            user_id: User ID to fetch onboarding data
            channel: Target channel (instagram, linkedin, etc.)
            content_type: Type of content (caption, cta, email, ad_copy, etc.)
            product_context: Additional product information
            
        Returns:
            Enhanced prompt with persona style, brand voice, and marketing context
        """
        try:
            # Get onboarding data via SSOT
            db = SessionLocal()
            try:
                integrated_data = self.integration_service.get_integrated_data_sync(user_id, db)
                website_analysis = integrated_data.get('website_analysis', {})
                persona_data = integrated_data.get('persona_data', {})
                competitor_analyses = integrated_data.get('competitor_analysis', {})
            finally:
                db.close()
            
            # Build enhanced prompt
            enhanced_prompt = base_request
            
            # Add persona linguistic fingerprint
            if persona_data:
                core_persona = persona_data.get('corePersona', {})
                platform_personas = persona_data.get('platformPersonas', {})
                
                if core_persona:
                    persona_name = core_persona.get('persona_name', '')
                    linguistic_fingerprint = core_persona.get('linguistic_fingerprint', {})
                    
                    if persona_name:
                        enhanced_prompt += f"\n\nFollow {persona_name} persona style:"
                    
                    if linguistic_fingerprint:
                        sentence_metrics = linguistic_fingerprint.get('sentence_metrics', {})
                        lexical_features = linguistic_fingerprint.get('lexical_features', {})
                        
                        if sentence_metrics:
                            avg_length = sentence_metrics.get('average_sentence_length_words', '')
                            if avg_length:
                                enhanced_prompt += f"\n- Average sentence length: {avg_length} words"
                        
                        if lexical_features:
                            go_to_words = lexical_features.get('go_to_words', [])
                            avoid_words = lexical_features.get('avoid_words', [])
                            vocabulary_level = lexical_features.get('vocabulary_level', '')
                            
                            if go_to_words:
                                enhanced_prompt += f"\n- Use these words: {', '.join(go_to_words[:5])}"
                            if avoid_words:
                                enhanced_prompt += f"\n- Avoid these words: {', '.join(avoid_words[:5])}"
                            if vocabulary_level:
                                enhanced_prompt += f"\n- Vocabulary level: {vocabulary_level}"
                
                # Channel-specific persona adaptation
                if channel and platform_personas:
                    platform_persona = platform_personas.get(channel, {})
                    if platform_persona:
                        content_format_rules = platform_persona.get('content_format_rules', {})
                        engagement_patterns = platform_persona.get('engagement_patterns', {})
                        
                        if content_format_rules:
                            char_limit = content_format_rules.get('character_limit', '')
                            hashtag_strategy = content_format_rules.get('hashtag_strategy', '')
                            
                            if char_limit:
                                enhanced_prompt += f"\n- Character limit: {char_limit}"
                            if hashtag_strategy:
                                enhanced_prompt += f"\n- Hashtag strategy: {hashtag_strategy}"
            
            # Add brand voice
            if website_analysis:
                writing_style = website_analysis.get('writing_style', {})
                target_audience = website_analysis.get('target_audience', {})
                
                tone = writing_style.get('tone', 'professional')
                voice = writing_style.get('voice', 'authoritative')
                enhanced_prompt += f"\n- Brand tone: {tone}, Brand voice: {voice}"
                
                demographics = target_audience.get('demographics', [])
                expertise_level = target_audience.get('expertise_level', 'intermediate')
                if demographics:
                    enhanced_prompt += f"\n- Target audience: {', '.join(demographics[:2])}, {expertise_level} level"
            
            # Add competitive positioning
            if competitor_analyses and len(competitor_analyses) > 0:
                enhanced_prompt += "\n- Differentiate from competitors, highlight unique value propositions"
            
            # Add marketing context
            if product_context:
                marketing_goal = product_context.get('marketing_goal', '')
                if marketing_goal:
                    enhanced_prompt += f"\n- Marketing goal: {marketing_goal}"
            
            logger.info(f"[Campaign Copy Prompt] Enhanced for user {user_id}: {enhanced_prompt[:200]}...")
            return enhanced_prompt
            
        except Exception as e:
            logger.error(f"[Campaign Copy Prompt] Error building prompt: {str(e)}")
            return base_request
    
    def optimize_marketing_prompt(
        self,
        prompt_type: str,
        base_prompt: str,
        user_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Main entry point for marketing prompt optimization.
        
        Args:
            prompt_type: Type of prompt (image, copy, video_script, etc.)
            base_prompt: Base prompt to enhance
            user_id: User ID for personalization
            context: Additional context (channel, asset_type, product_context, etc.)
            
        Returns:
            Optimized marketing prompt
        """
        context = context or {}
        channel = context.get('channel')
        asset_type = context.get('asset_type', 'hero_image')
        content_type = context.get('content_type', 'caption')
        product_context = context.get('product_context')
        
        if prompt_type == 'image':
            return self.build_marketing_image_prompt(
                base_prompt, user_id, channel, asset_type, product_context
            )
        elif prompt_type in ['copy', 'caption', 'cta', 'email', 'ad_copy']:
            return self.build_marketing_copy_prompt(
                base_prompt, user_id, channel, content_type, product_context
            )
        else:
            # Default: minimal enhancement
            return f"{base_prompt}, professional quality, marketing optimized"
