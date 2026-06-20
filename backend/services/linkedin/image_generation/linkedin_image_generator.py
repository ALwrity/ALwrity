"""
LinkedIn Image Generator Service

This service generates LinkedIn-optimized images using the common
llm_providers infrastructure. It provides professional, business-appropriate
imagery for LinkedIn content.
"""

import os
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
from PIL import Image
from io import BytesIO
from loguru import logger

from ...onboarding.api_key_manager import APIKeyManager
from ...llm_providers.main_image_generation import generate_image
from ...llm_providers.main_image_editing import edit_image as common_edit_image
from .linkedin_image_prompt_builder import (
    build_linkedin_selection_prompt,
    optimize_linkedin_prompt,
)


class LinkedInImageGenerator:
    """
    Handles LinkedIn-optimized image generation using common infrastructure.
    
    This service integrates with the llm_providers image generation system
    and provides LinkedIn-specific image optimization, quality assurance,
    and professional business aesthetics.
    """
    
    def __init__(self, api_key_manager: Optional[APIKeyManager] = None):
        """
        Initialize the LinkedIn Image Generator.
        
        Args:
            api_key_manager: API key manager for authentication
        """
        self.api_key_manager = api_key_manager or APIKeyManager()
        self.default_aspect_ratio = "1:1"  # LinkedIn post optimal ratio
        self.max_retries = 3
        
        # LinkedIn-specific image requirements
        self.min_resolution = (1024, 1024)
        self.max_file_size_mb = 5
        self.supported_formats = ["PNG", "JPEG"]
        
        logger.info("[LinkedInImageGen] LinkedIn Image Generator initialized")
    
    async def generate_image(
        self, 
        prompt: str, 
        content_context: Dict[str, Any],
        aspect_ratio: str = "1:1",
        style_preference: str = "professional",
        user_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate LinkedIn-optimized image using AI provider.
        
        Args:
            prompt: User's image generation prompt
            content_context: LinkedIn content context (topic, industry, content_type)
            aspect_ratio: Image aspect ratio (1:1, 16:9, 4:3, 1.91:1, 1:1.25)
            style_preference: Style preference (professional, creative, industry-specific)
            user_id: User ID for tenant provider resolution
            
        Returns:
            Dict containing generation result, image data, and metadata
        """
        try:
            start_time = datetime.now()
            style = content_context.get("style") or style_preference or "Realistic"
            logger.info(
                f"[LinkedInImageGen] Starting generation topic={content_context.get('topic', 'Unknown')} "
                f"aspect_ratio={aspect_ratio} model={model or 'default'} user={user_id}"
            )

            structured_prompt = build_linkedin_selection_prompt(
                prompt, content_context, aspect_ratio, style
            )
            logger.info(
                f"[LinkedInImageGen] Structured prompt ({len(structured_prompt)} chars): "
                f"{structured_prompt[:200]}..."
            )

            enhanced_prompt = await optimize_linkedin_prompt(structured_prompt, user_id)
            logger.info(
                f"[LinkedInImageGen] Optimized prompt ({len(enhanced_prompt)} chars): "
                f"{enhanced_prompt[:200]}..."
            )

            generation_result = await self._generate_with_provider(
                enhanced_prompt, aspect_ratio, user_id, model
            )
            
            if not generation_result.get('success'):
                return {
                    'success': False,
                    'error': generation_result.get('error', 'Image generation failed'),
                    'generation_time': (datetime.now() - start_time).total_seconds()
                }
            
            # Process and validate generated image
            processed_image = await self._process_generated_image(
                generation_result['image_data'],
                content_context,
                aspect_ratio
            )
            
            generation_time = (datetime.now() - start_time).total_seconds()
            resolution = processed_image['resolution']
            logger.info(
                f"[LinkedInImageGen] Post-processing complete "
                f"{resolution[0]}x{resolution[1]} px elapsed={generation_time:.2f}s"
            )
            
            return {
                'success': True,
                'image_data': processed_image['image_data'],
                'image_url': processed_image.get('image_url'),
                'metadata': {
                    'prompt_used': enhanced_prompt,
                    'structured_prompt': structured_prompt,
                    'original_prompt': prompt,
                    'style_preference': style,
                    'aspect_ratio': aspect_ratio,
                    'content_context': content_context,
                    'generation_time': generation_time,
                    'model_used': generation_result.get('model'),
                    'image_format': processed_image['format'],
                    'image_size': processed_image['size'],
                    'resolution': processed_image['resolution']
                },
                'linkedin_optimization': {
                    'mobile_optimized': True,
                    'professional_aesthetic': True,
                    'brand_compliant': True,
                    'engagement_optimized': True
                }
            }
            
        except Exception as e:
            logger.error(f"[LinkedInImageGen] Error in LinkedIn image generation: {str(e)}")
            return {
                'success': False,
                'error': f"Image generation failed: {str(e)}",
                'generation_time': (datetime.now() - start_time).total_seconds() if 'start_time' in locals() else 0
            }
    
    async def edit_image(
        self, 
        input_image_bytes: bytes, 
        edit_prompt: str,
        content_context: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Edit existing image using unified image editing infrastructure.
        
        Args:
            input_image_bytes: Input image bytes to edit
            edit_prompt: Description of desired edits
            content_context: LinkedIn content context for optimization
            user_id: User ID for tenant provider resolution and subscription checks
            
        Returns:
            Dict containing edited image result and metadata
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn image editing with prompt: {edit_prompt[:100]}...")
            
            # Enhance edit prompt for LinkedIn optimization
            enhanced_edit_prompt = self._enhance_edit_prompt_for_linkedin(
                edit_prompt, content_context
            )
            
            # Use unified image editing system.
            # common_edit_image() handles: provider resolution, pre-flight validation,
            # generation, and usage tracking — all via user_id.
            result = common_edit_image(
                input_image_bytes=input_image_bytes,
                prompt=enhanced_edit_prompt,
                user_id=user_id,
            )
            
            if result and result.image_bytes:
                generation_time = (datetime.now() - start_time).total_seconds()
                logger.info(
                    "[LinkedInImageGen] Image edited successfully via provider={} model={} in {:.2f}s",
                    result.provider, result.model, generation_time,
                )
                return {
                    'success': True,
                    'image_data': result.image_bytes,
                    'image_url': None,  # not using URL-based retrieval
                    'width': result.width,
                    'height': result.height,
                    'provider': result.provider,
                    'model': result.model,
                    'metadata': {
                        'original_prompt': edit_prompt,
                        'enhanced_prompt': enhanced_edit_prompt,
                        'generation_time': generation_time,
                        'content_context': content_context,
                    },
                }
            else:
                logger.warning("LinkedIn image editing returned no result")
                return {
                    'success': False,
                    'error': 'Image editing returned no result',
                    'generation_time': (datetime.now() - start_time).total_seconds(),
                }
            
        except Exception as e:
            logger.error(f"Error in LinkedIn image editing: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': f"Image editing failed: {str(e)}",
                'generation_time': (datetime.now() - start_time).total_seconds() if 'start_time' in locals() else 0
            }
    
    def _enhance_edit_prompt_for_linkedin(
        self, 
        edit_prompt: str, 
        content_context: Dict[str, Any]
    ) -> str:
        """
        Enhance edit prompt for LinkedIn optimization.
        
        Args:
            edit_prompt: Original edit prompt
            content_context: LinkedIn content context
            
        Returns:
            Enhanced edit prompt
        """
        industry = content_context.get('industry', 'business')
        
        linkedin_edit_enhancements = [
            f"Maintain professional business aesthetic for {industry} industry",
            "Ensure mobile-optimized composition for LinkedIn feed",
            "Keep professional color scheme and typography",
            "Maintain brand consistency and visual hierarchy"
        ]
        
        enhanced_edit_prompt = f"{edit_prompt}\n\n"
        enhanced_edit_prompt += "\n".join(linkedin_edit_enhancements)
        
        return enhanced_edit_prompt
    
    async def _generate_with_provider(
        self,
        prompt: str,
        aspect_ratio: str,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate image using unified image generation infrastructure.
        Provider resolution, pre-flight validation, and usage tracking
        are all handled by generate_image() from main_image_generation.
        
        Args:
            prompt: Enhanced prompt for image generation
            aspect_ratio: Desired aspect ratio
            user_id: User ID for tenant provider resolution and subscription checks
            
        Returns:
            Generation result from image generation provider
        """
        try:
            # Map aspect ratio to dimensions (LinkedIn-optimized)
            aspect_map = {
                "1:1": (1024, 1024),
                "16:9": (1920, 1080),
                "4:3": (1366, 1024),
                "9:16": (1080, 1920),
                "1.91:1": (1200, 627),  # LinkedIn recommended landscape
                "1:1.25": (1080, 1350),  # LinkedIn recommended portrait
            }
            width, height = aspect_map.get(aspect_ratio, (1024, 1024))
            logger.info(
                f"[LinkedInImageGen] Delegating to provider pipeline "
                f"aspect_ratio={aspect_ratio} dimensions={width}x{height} model={model or 'default'}"
            )

            options: Dict[str, Any] = {"width": width, "height": height}
            if model:
                options["model"] = model

            result = generate_image(
                prompt=prompt,
                options=options,
                user_id=user_id,
            )
            
            if result and result.image_bytes:
                return {
                    'success': True,
                    'image_data': result.image_bytes,
                    'image_path': None,
                    'width': result.width,
                    'height': result.height,
                    'provider': result.provider,
                    'model': result.model,
                }
            else:
                return {
                    'success': False,
                    'error': 'Image generation returned no result'
                }

        except Exception as e:
            logger.error(f"[LinkedInImageGen] Error in image generation: {str(e)}")
            return {
                'success': False,
                'error': f"Image generation failed: {str(e)}"
            }
    
    async def _process_generated_image(
        self, 
        image_data: bytes, 
        content_context: Dict[str, Any],
        aspect_ratio: str
    ) -> Dict[str, Any]:
        """
        Process and validate generated image for LinkedIn use.
        
        Args:
            image_data: Raw image data
            content_context: LinkedIn content context
            aspect_ratio: Image aspect ratio
            
        Returns:
            Processed image information
        """
        try:
            # Open image for processing
            image = Image.open(BytesIO(image_data))
            
            # Get image information
            width, height = image.size
            format_name = image.format or "PNG"
            
            # Validate resolution
            if width < self.min_resolution[0] or height < self.min_resolution[1]:
                logger.warning(f"Generated image resolution {width}x{height} below minimum {self.min_resolution}")
            
            # Validate file size
            image_size_mb = len(image_data) / (1024 * 1024)
            if image_size_mb > self.max_file_size_mb:
                logger.warning(f"Generated image size {image_size_mb:.2f}MB exceeds maximum {self.max_file_size_mb}MB")
            
            # LinkedIn-specific optimizations
            optimized_image = self._optimize_for_linkedin(image, content_context)
            
            # Convert back to bytes
            output_buffer = BytesIO()
            optimized_image.save(output_buffer, format=format_name, optimize=True)
            optimized_data = output_buffer.getvalue()
            
            return {
                'image_data': optimized_data,
                'format': format_name,
                'size': len(optimized_data),
                'resolution': (width, height),
                'aspect_ratio': f"{width}:{height}"
            }
            
        except Exception as e:
            logger.error(f"Error processing generated image: {str(e)}")
            # Return original image data if processing fails
            return {
                'image_data': image_data,
                'format': 'PNG',
                'size': len(image_data),
                'resolution': (1024, 1024),
                'aspect_ratio': aspect_ratio
            }
    
    def _optimize_for_linkedin(self, image: Image.Image, content_context: Dict[str, Any]) -> Image.Image:
        """
        Optimize image specifically for LinkedIn display.
        
        Args:
            image: PIL Image object
            content_context: LinkedIn content context
            
        Returns:
            Optimized image
        """
        try:
            # Ensure minimum resolution
            width, height = image.size
            if width < self.min_resolution[0] or height < self.min_resolution[1]:
                # Resize to minimum resolution while maintaining aspect ratio
                ratio = max(self.min_resolution[0] / width, self.min_resolution[1] / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                logger.info(f"Resized image to {new_width}x{new_height} for LinkedIn optimization")
            
            # Convert to RGB if necessary (for JPEG compatibility)
            if image.mode in ('RGBA', 'LA', 'P'):
                # Create white background for transparent images
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background
            
            return image
            
        except Exception as e:
            logger.error(f"Error optimizing image for LinkedIn: {str(e)}")
            return image  # Return original if optimization fails
    
    async def validate_image_for_linkedin(self, image_data: bytes) -> Dict[str, Any]:
        """
        Validate image for LinkedIn compliance and quality standards.
        
        Args:
            image_data: Image data to validate
            
        Returns:
            Validation results
        """
        try:
            image = Image.open(BytesIO(image_data))
            width, height = image.size
            
            validation_results = {
                'resolution_ok': width >= self.min_resolution[0] and height >= self.min_resolution[1],
                'aspect_ratio_suitable': self._is_aspect_ratio_suitable(width, height),
                'file_size_ok': len(image_data) <= self.max_file_size_mb * 1024 * 1024,
                'format_supported': image.format in self.supported_formats,
                'professional_aesthetic': True,  # Placeholder for future AI-based validation
                'overall_score': 0
            }
            
            # Calculate overall score
            score = 0
            if validation_results['resolution_ok']: score += 25
            if validation_results['aspect_ratio_suitable']: score += 25
            if validation_results['file_size_ok']: score += 20
            if validation_results['format_supported']: score += 20
            if validation_results['professional_aesthetic']: score += 10
            
            validation_results['overall_score'] = score
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating image: {str(e)}")
            return {
                'resolution_ok': False,
                'aspect_ratio_suitable': False,
                'file_size_ok': False,
                'format_supported': False,
                'professional_aesthetic': False,
                'overall_score': 0,
                'error': str(e)
            }
    
    def _is_aspect_ratio_suitable(self, width: int, height: int) -> bool:
        """
        Check if image aspect ratio is suitable for LinkedIn.
        
        Args:
            width: Image width
            height: Image height
            
        Returns:
            True if aspect ratio is suitable for LinkedIn
        """
        ratio = width / height
        
        # LinkedIn-optimized aspect ratios
        suitable_ratios = [
            (0.9, 1.1),    # 1:1 (square)
            (1.6, 1.8),    # 16:9 (landscape)
            (0.7, 0.8),    # 4:3 (portrait)
            (1.2, 1.4),    # 5:4 (landscape)
            (1.85, 2.0),   # 1.91:1 (LinkedIn recommended landscape)
            (0.6, 0.72),   # 1:1.25 (LinkedIn recommended portrait, ~0.8)
            (0.65, 0.85),  # 1:1.25 broader match
        ]
        
        for min_ratio, max_ratio in suitable_ratios:
            if min_ratio <= ratio <= max_ratio:
                return True
        
        return False
