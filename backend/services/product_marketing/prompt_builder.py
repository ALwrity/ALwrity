"""
Product Marketing Prompt Builder
Extends AIPromptOptimizer with marketing-specific prompt enhancement.
"""

from typing import Dict, Any, Optional
from loguru import logger

from services.ai_prompt_optimizer import AIPromptOptimizer
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from services.database import SessionLocal


class ProductMarketingPromptBuilder(AIPromptOptimizer):
    """Specialized prompt builder for marketing assets with onboarding data integration."""
    
    def __init__(self):
        """Initialize Product Marketing Prompt Builder."""
        super().__init__()
        self.onboarding_integration_service = OnboardingDataIntegrationService()
        self.logger = logger
        self.logger.info("[Product Marketing Prompt Builder] Initialized")
    
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
            # Use Canonical Profile (SSOT)
            db = SessionLocal()
            try:
                integrated_data = self.onboarding_integration_service.get_integrated_data_sync(user_id, db)
                canonical_profile = integrated_data.get('canonical_profile', {})
            except Exception as e:
                self.logger.error(f"Error fetching onboarding data: {e}")
                canonical_profile = {}
            finally:
                db.close()
            
            enhanced_prompt = base_prompt
            
            # 1. Brand Voice & Tone (Canonical)
            tone = canonical_profile.get('writing_tone')
            voice = canonical_profile.get('writing_voice')
            if tone or voice:
                parts = []
                if tone: parts.append(f"{tone} tone")
                if voice: parts.append(f"{voice} voice")
                enhanced_prompt += f", {', '.join(parts)}"
            
            # 2. Target Audience (Canonical)
            target_audience = canonical_profile.get('target_audience')
            demographics = []
            
            if isinstance(target_audience, dict):
                demographics = target_audience.get('demographics', [])
                if not demographics:
                     # fallback to checking keys if demographics key is missing but dict acts as demographics
                     pass 
            elif isinstance(target_audience, list):
                demographics = target_audience
            elif isinstance(target_audience, str):
                demographics = [target_audience]

            if demographics:
                audience_str = ', '.join([str(d) for d in demographics[:2]])
                enhanced_prompt += f", targeting {audience_str}"
            
            # 3. Brand Identity (Canonical)
            brand_colors = canonical_profile.get('brand_colors', [])
            if brand_colors:
                colors = ', '.join([str(c) for c in brand_colors[:3]])
                enhanced_prompt += f", brand colors: {colors}"
                
            visual_style = canonical_profile.get('visual_style', {})
            aesthetic = visual_style.get('aesthetic')
            if aesthetic:
                enhanced_prompt += f", {aesthetic} aesthetic"

            # 4. Persona Style (Canonical - derived from Persona Data if available)
            # Note: Canonical profile already merges persona data into tone/voice/style.
            # If we need specific persona name, we might need to check if it's stored in canonical.
            # Currently canonical stores aggregated traits. 
            
            # Channel-specific optimization
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
            
            asset_type_enhancements = {
                'hero_image': ', hero image style, prominent product placement, professional photography',
                'product_photo': ', product photography, clean background, detailed product showcase',
                'lifestyle': ', lifestyle photography, natural setting, authentic scene',
                'social_post': ', social media post, engaging composition, optimized for engagement',
            }
            
            if asset_type in asset_type_enhancements:
                enhanced_prompt += asset_type_enhancements[asset_type]
            
            # Layer 6: Quality Descriptors
            enhanced_prompt += ", professional photography, high quality, detailed, sharp focus, natural lighting"
            
            # Layer 7: Marketing Context
            if product_context:
                marketing_goal = product_context.get('marketing_goal', '')
                if marketing_goal:
                    enhanced_prompt += f", {marketing_goal} focused"
            
            self.logger.info(f"[Marketing Prompt] Enhanced prompt for user {user_id}: {enhanced_prompt[:200]}...")
            return enhanced_prompt
            
        except Exception as e:
            self.logger.error(f"[Marketing Prompt] Error building prompt: {str(e)}")
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
            # Use Canonical Profile (SSOT)
            db = SessionLocal()
            try:
                integrated_data = self.onboarding_integration_service.get_integrated_data_sync(user_id, db)
                canonical_profile = integrated_data.get('canonical_profile', {})
            except Exception as e:
                self.logger.error(f"Error fetching onboarding data: {e}")
                canonical_profile = {}
            finally:
                db.close()
            
            enhanced_prompt = base_request
            
            # 1. Brand Voice & Tone (Canonical)
            tone = canonical_profile.get('writing_tone')
            voice = canonical_profile.get('writing_voice')
            complexity = canonical_profile.get('writing_complexity')
            
            if tone or voice or complexity:
                lines = []
                if tone: lines.append(f"- Tone: {tone}")
                if voice: lines.append(f"- Voice: {voice}")
                if complexity: lines.append(f"- Complexity: {complexity}")
                enhanced_prompt += "\n\nBrand Voice & Tone:\n" + "\n".join(lines)
            
            # 2. Target Audience (Canonical)
            target_audience = canonical_profile.get('target_audience')
            demographics = []
            if isinstance(target_audience, dict):
                demographics = target_audience.get('demographics', [])
            elif isinstance(target_audience, list):
                demographics = target_audience
            elif isinstance(target_audience, str):
                demographics = [target_audience]
                
            if demographics:
                enhanced_prompt += f"\n- Target Audience: {', '.join([str(d) for d in demographics[:3]])}"
                
            # 3. Industry (Canonical)
            business_info = canonical_profile.get('business_info', {})
            industry = business_info.get('industry')
            if industry:
                enhanced_prompt += f"\n- Industry Context: {industry}"
                
            # 4. Platform Preferences / Context
            if channel:
                 enhanced_prompt += f"\n- Platform: {channel}"
                 # Add channel specific constraints if needed, but usually base model handles it well with just platform name
            
            # 5. Marketing Context
            if product_context:
                marketing_goal = product_context.get('marketing_goal', '')
                if marketing_goal:
                    enhanced_prompt += f"\n- Goal: {marketing_goal}"
            
            self.logger.info(f"[Marketing Copy Prompt] Enhanced for user {user_id}: {enhanced_prompt[:200]}...")
            return enhanced_prompt
            
        except Exception as e:
            self.logger.error(f"[Marketing Copy Prompt] Error building prompt: {str(e)}")
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

