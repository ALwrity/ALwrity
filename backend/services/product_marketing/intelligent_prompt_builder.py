"""
Intelligent Prompt Builder
Infers complete requirements from minimal user input using onboarding data.
"""

from typing import Dict, Any, Optional, List
from loguru import logger
import json

from services.database import SessionLocal
from services.llm_providers.main_text_generation import llm_text_gen
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from .product_marketing_templates import (
    ProductMarketingTemplates,
    TemplateCategory,
    ProductImageTemplate,
    ProductVideoTemplate,
    ProductAvatarTemplate,
)


class IntelligentPromptBuilder:
    """
    Intelligent prompt builder that infers requirements from minimal user input.
    
    Example:
        Input: "iPhone case for my store"
        Output: Complete configuration with all fields pre-filled
    """
    
    def __init__(self):
        """Initialize Intelligent Prompt Builder."""
        self.logger = logger
        logger.info("[Intelligent Prompt Builder] Initialized")
    
    def infer_requirements(
        self,
        user_input: str,
        user_id: str,
        asset_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Infer complete requirements from minimal user input.
        
        Args:
            user_input: Minimal user input (e.g., "iPhone case for my store")
            user_id: User ID to fetch onboarding data
            asset_type: Optional asset type hint (image, video, animation, avatar)
            
        Returns:
            Complete configuration dictionary with all fields pre-filled
        """
        try:
            # 1. Parse user input
            parsed_input = self._parse_user_input(user_input, asset_type)
            
            # 2. Get onboarding data
            onboarding_data = self._get_onboarding_data(user_id)
            
            # 3. Infer requirements from context
            requirements = self._infer_from_context(parsed_input, onboarding_data, asset_type)
            
            # 4. Match template
            template = self._match_template(requirements, asset_type)
            
            # 5. Generate smart defaults
            defaults = self._generate_defaults(requirements, template, onboarding_data)
            
            logger.info(f"[Intelligent Prompt Builder] Inferred requirements: {defaults.get('product_name', 'Unknown')}")
            return defaults
            
        except Exception as e:
            logger.error(f"[Intelligent Prompt Builder] Error inferring requirements: {str(e)}", exc_info=True)
            # Return basic defaults on error
            return self._get_basic_defaults(user_input, asset_type)
    
    def _parse_user_input(
        self,
        user_input: str,
        user_id: str,
        asset_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Parse minimal user input to extract entities.
        
        Uses LLM with few-shot prompting to extract:
        - Product name
        - Product type
        - Use case (e-commerce, marketing, social media, etc.)
        - Platform hints (store, Instagram, Shopify, Amazon, etc.)
        - Style preferences
        """
        try:
            # Build system prompt for entity extraction
            system_prompt = """You are an expert at parsing product marketing requests. 
Extract key information from user input and return structured JSON.

Extract:
- product_name: The product name or description
- product_type: Type of product (phone_case, clothing, electronics, food, etc.)
- use_case: Primary use case (ecommerce, social_media, marketing_campaign, documentation, etc.)
- platform_hints: Platforms mentioned (shopify, amazon, instagram, facebook, etc.)
- style_hints: Style preferences mentioned (professional, casual, luxury, minimalist, etc.)
- asset_type_hint: Type of asset needed (image, video, animation, avatar) if mentioned

Return JSON only, no explanations."""
            
            # Few-shot examples
            examples = """
Examples:
Input: "iPhone case for my store"
Output: {"product_name": "iPhone case", "product_type": "phone_case", "use_case": "ecommerce", "platform_hints": ["shopify"], "style_hints": [], "asset_type_hint": "image"}

Input: "Create a video for my new product launch on Instagram"
Output: {"product_name": "new product", "product_type": "unknown", "use_case": "social_media", "platform_hints": ["instagram"], "style_hints": [], "asset_type_hint": "video"}

Input: "Luxury watch photoshoot"
Output: {"product_name": "luxury watch", "product_type": "watch", "use_case": "marketing_campaign", "platform_hints": [], "style_hints": ["luxury"], "asset_type_hint": "image"}
"""
            
            prompt = f"{examples}\n\nInput: {user_input}\nOutput:"
            
            # Call LLM for parsing
            json_struct = {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string"},
                    "product_type": {"type": "string"},
                    "use_case": {"type": "string"},
                    "platform_hints": {"type": "array", "items": {"type": "string"}},
                    "style_hints": {"type": "array", "items": {"type": "string"}},
                    "asset_type_hint": {"type": "string"}
                },
                "required": ["product_name", "use_case"]
            }
            
            # Call LLM synchronously (llm_text_gen is synchronous)
            result_text = llm_text_gen(
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_struct,
                user_id=user_id  # Pass user_id for subscription checking
            )
            
            # Parse JSON response
            try:
                parsed = json.loads(result_text) if isinstance(result_text, str) else result_text
            except json.JSONDecodeError:
                # Fallback: try to extract JSON from text
                import re
                json_match = re.search(r'\{[^}]+\}', result_text)
                if json_match:
                    parsed = json.loads(json_match.group())
                else:
                    # Ultimate fallback: basic extraction
                    parsed = {
                        "product_name": user_input,
                        "product_type": "unknown",
                        "use_case": "marketing_campaign",
                        "platform_hints": [],
                        "style_hints": [],
                        "asset_type_hint": asset_type or "image"
                    }
            
            # Override asset_type_hint if provided
            if asset_type:
                parsed["asset_type_hint"] = asset_type
            
            logger.info(f"[Intelligent Prompt Builder] Parsed input: {parsed}")
            return parsed
            
        except Exception as e:
            logger.error(f"[Intelligent Prompt Builder] Error parsing input: {str(e)}")
            # Fallback: basic extraction
            return {
                "product_name": user_input,
                "product_type": "unknown",
                "use_case": "marketing_campaign",
                "platform_hints": [],
                "style_hints": [],
                "asset_type_hint": asset_type or "image"
            }
    
    def _get_onboarding_data(self, user_id: str) -> Dict[str, Any]:
        """
        Get all onboarding data for user.
        
        Returns:
            Dictionary with canonical_profile only (Single Source of Truth)
        """
        db = SessionLocal()
        try:
            integration_service = OnboardingDataIntegrationService()
            integrated_data = integration_service.get_integrated_data_sync(user_id, db)
            canonical_profile = integrated_data.get('canonical_profile', {})

            return {
                "canonical_profile": canonical_profile,
            }
        except Exception as e:
            logger.error(f"[Intelligent Prompt Builder] Error getting onboarding data: {str(e)}")
            return {
                "canonical_profile": {},
            }
        finally:
            db.close()
    
    def _infer_from_context(
        self,
        parsed_input: Dict[str, Any],
        onboarding_data: Dict[str, Any],
        asset_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Infer requirements from parsed input and onboarding context.
        
        Uses canonical profile for:
        - Style (aesthetic)
        - Target audience
        - Brand colors
        - Tone/Voice
        """
        requirements = parsed_input.copy()
        
        # We rely strictly on canonical_profile now
        canonical_profile = onboarding_data.get("canonical_profile", {}) or {}
        
        # Infer platform from onboarding
        if not requirements.get("platform_hints"):
            # Check if user has e-commerce setup (from website analysis)
            # This logic was: if use_case == ecommerce -> shopify. 
            # We can keep this simple inference or check if industry is ecommerce.
            if requirements.get("use_case") == "ecommerce":
                requirements["platform_hints"] = ["shopify"]  # Default e-commerce platform
        
        # Infer style from brand DNA (canonical)
        if not requirements.get("style_hints"):
            visual_style = canonical_profile.get("visual_style", {})
            aesthetic = visual_style.get("aesthetic")
            if aesthetic:
                requirements["style_hints"] = [aesthetic.lower()]
        
        # Target Audience (canonical)
        target_audience = canonical_profile.get("target_audience")
        if target_audience:
            requirements["target_audience"] = target_audience
        
        # Brand colors (canonical)
        brand_colors = canonical_profile.get("brand_colors", [])
        if brand_colors:
            requirements["brand_colors"] = brand_colors[:5]  # Top 5 colors
        
        # E.3 (deferred): PROMPT consumer — render prose from the unified
        # canonical_profile.brand_voice (persona-or-website, §2.2), NOT raw PersonaData.
        # Legacy writing_tone/voice below is the migration shim, removed at E.4.
        # Tone/Voice (canonical)
        tone = canonical_profile.get("writing_tone") or "professional"
        requirements["tone"] = tone
        
        voice = canonical_profile.get("writing_voice")
        if voice:
            requirements["voice"] = voice
        
        return requirements
    
    def _match_template(
        self,
        requirements: Dict[str, Any],
        asset_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Match requirements to appropriate template.
        
        Returns:
            Template dictionary or None
        """
        asset_type_hint = asset_type or requirements.get("asset_type_hint", "image")
        use_case = requirements.get("use_case", "marketing_campaign")
        style_hints = requirements.get("style_hints", [])
        
        if asset_type_hint == "image":
            templates = ProductMarketingTemplates.get_product_image_templates()
            
            # Match by use case
            if use_case == "ecommerce":
                # Match e-commerce template
                for template in templates:
                    if "ecommerce" in template.id.lower() or "e-commerce" in template.name.lower():
                        return {
                            "id": template.id,
                            "name": template.name,
                            "category": template.category.value,
                            "environment": template.environment,
                            "background_style": template.background_style,
                            "lighting": template.lighting,
                            "style": template.style,
                            "angle": template.angle,
                            "recommended_resolution": template.recommended_resolution,
                        }
            
            # Match by style
            if style_hints:
                style_lower = style_hints[0].lower()
                for template in templates:
                    if style_lower in template.style.lower() or style_lower in template.name.lower():
                        return {
                            "id": template.id,
                            "name": template.name,
                            "category": template.category.value,
                            "environment": template.environment,
                            "background_style": template.background_style,
                            "lighting": template.lighting,
                            "style": template.style,
                            "angle": template.angle,
                            "recommended_resolution": template.recommended_resolution,
                        }
            
            # Default: e-commerce product shot
            default_template = templates[0]  # ecommerce_product_shot
            return {
                "id": default_template.id,
                "name": default_template.name,
                "category": default_template.category.value,
                "environment": default_template.environment,
                "background_style": default_template.background_style,
                "lighting": default_template.lighting,
                "style": default_template.style,
                "angle": default_template.angle,
                "recommended_resolution": default_template.recommended_resolution,
            }
        
        elif asset_type_hint == "video":
            templates = ProductMarketingTemplates.get_product_video_templates()
            # Default: product demo video
            default_template = templates[0]
            return {
                "id": default_template.id,
                "name": default_template.name,
                "category": default_template.category.value,
                "video_type": default_template.video_type,
                "resolution": default_template.resolution,
                "duration": default_template.duration,
            }
        
        elif asset_type_hint == "avatar":
            templates = ProductMarketingTemplates.get_product_avatar_templates()
            # Default: product overview
            default_template = templates[0]
            return {
                "id": default_template.id,
                "name": default_template.name,
                "category": default_template.category.value,
                "explainer_type": default_template.explainer_type,
                "resolution": default_template.resolution,
            }
        
        return None
    
    def _generate_defaults(
        self,
        requirements: Dict[str, Any],
        template: Optional[Dict[str, Any]],
        onboarding_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate complete configuration with smart defaults.
        
        Combines:
        - Parsed requirements
        - Matched template
        - Onboarding data
        """
        defaults = {}
        
        # Product information
        defaults["product_name"] = requirements.get("product_name", "Product")
        defaults["product_description"] = requirements.get("product_description", f"Professional {requirements.get('product_name', 'product')}")
        
        # Asset type
        asset_type = requirements.get("asset_type_hint", "image")
        defaults["asset_type"] = asset_type
        
        # Template information
        if template:
            defaults["template_id"] = template.get("id")
            defaults["template_name"] = template.get("name")
        
        # Image-specific defaults
        if asset_type == "image" and template:
            defaults["environment"] = template.get("environment", "studio")
            defaults["background_style"] = template.get("background_style", "white")
            defaults["lighting"] = template.get("lighting", "studio")
            defaults["style"] = template.get("style", "photorealistic")
            defaults["angle"] = template.get("angle", "front")
            defaults["resolution"] = template.get("recommended_resolution", "1024x1024")
            defaults["num_variations"] = 1
            
            # Override with style hints if available
            if requirements.get("style_hints"):
                style_hint = requirements["style_hints"][0].lower()
                if "luxury" in style_hint:
                    defaults["style"] = "luxury"
                    defaults["lighting"] = "dramatic"
                elif "minimalist" in style_hint:
                    defaults["style"] = "minimalist"
                    defaults["background_style"] = "white"
                elif "lifestyle" in style_hint:
                    defaults["environment"] = "lifestyle"
                    defaults["background_style"] = "lifestyle"
        
        # Video-specific defaults
        elif asset_type == "video" and template:
            defaults["video_type"] = template.get("video_type", "demo")
            defaults["resolution"] = template.get("resolution", "720p")
            defaults["duration"] = template.get("duration", 10)
        
        # Avatar-specific defaults
        elif asset_type == "avatar" and template:
            defaults["explainer_type"] = template.get("explainer_type", "product_overview")
            defaults["resolution"] = template.get("resolution", "720p")
        
        # Brand colors from onboarding
        if requirements.get("brand_colors"):
            defaults["brand_colors"] = requirements["brand_colors"]

        # Pass through other inferred context
        if requirements.get("tone"):
            defaults["tone"] = requirements["tone"]
        if requirements.get("voice"):
            defaults["voice"] = requirements["voice"]
        if requirements.get("target_audience"):
            defaults["target_audience"] = requirements["target_audience"]
        if requirements.get("industry"):
            defaults["industry"] = requirements["industry"]
        
        # Additional context
        defaults["additional_context"] = requirements.get("additional_context", "")
        
        # Confidence score (how well we matched)
        defaults["confidence"] = 0.8 if template else 0.5
        defaults["inferred_fields"] = list(defaults.keys())
        
        return defaults
    
    def _get_basic_defaults(
        self,
        user_input: str,
        asset_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get basic defaults when parsing fails."""
        return {
            "product_name": user_input,
            "product_description": f"Professional {user_input}",
            "asset_type": asset_type or "image",
            "environment": "studio",
            "background_style": "white",
            "lighting": "studio",
            "style": "photorealistic",
            "resolution": "1024x1024",
            "num_variations": 1,
            "confidence": 0.3,
            "inferred_fields": ["product_name", "product_description"],
        }
