"""
LinkedIn Video Generator Service

Generates LinkedIn-optimized videos using the unified video generation infrastructure.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from loguru import logger

from ...onboarding.api_key_manager import APIKeyManager
from ...llm_providers.main_video_generation import ai_video_generate
from .linkedin_video_prompt_builder import (
    build_linkedin_selection_video_prompt,
    optimize_linkedin_video_prompt,
)

VALID_ASPECT_RATIOS = {"16:9", "1:1", "9:16"}
DEFAULT_MODEL = "hunyuan-video-1.5"
DEFAULT_PROVIDER = "wavespeed"


class LinkedInVideoGenerator:
    """Handles LinkedIn-optimized text-to-video generation."""

    def __init__(self, api_key_manager: Optional[APIKeyManager] = None):
        self.api_key_manager = api_key_manager or APIKeyManager()

    def _validate_aspect_ratio(self, aspect_ratio: str) -> str:
        if aspect_ratio not in VALID_ASPECT_RATIOS:
            logger.warning(
                "[LinkedInVideoGen] Invalid aspect ratio {}, defaulting to 16:9",
                aspect_ratio,
            )
            return "16:9"
        return aspect_ratio

    async def generate_video(
        self,
        prompt: str,
        content_context: Dict[str, Any],
        aspect_ratio: str = "16:9",
        duration: int = 5,
        resolution: str = "720p",
        motion_preset: str = "medium",
        user_id: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            start_time = datetime.now()
            aspect_ratio = self._validate_aspect_ratio(aspect_ratio)
            selected_model = model or DEFAULT_MODEL

            logger.info(
                "[LinkedInVideoGen] Starting generation topic={} aspect_ratio={} model={} user={}",
                content_context.get("topic", "Unknown"),
                aspect_ratio,
                selected_model,
                user_id,
            )

            structured_prompt = build_linkedin_selection_video_prompt(
                prompt, content_context, aspect_ratio, motion_preset
            )
            logger.info(
                "[LinkedInVideoGen] Structured prompt ({} chars): {}",
                len(structured_prompt),
                structured_prompt,
            )

            enhanced_prompt = await optimize_linkedin_video_prompt(structured_prompt, user_id)
            logger.info(
                "[LinkedInVideoGen] Optimized prompt ({} chars): {}",
                len(enhanced_prompt),
                enhanced_prompt,
            )

            result = await ai_video_generate(
                prompt=enhanced_prompt,
                operation_type="text-to-video",
                provider=DEFAULT_PROVIDER,
                user_id=user_id,
                model=selected_model,
                duration=duration,
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                motion_preset=motion_preset,
                enable_prompt_expansion=False,
                negative_prompt=(
                    "blurry, low quality, distorted, deformed, ugly, bad anatomy, "
                    "watermark, text overlay, logo, signature"
                ),
            )

            video_bytes = result.get("video_bytes")
            if not video_bytes:
                return {
                    "success": False,
                    "error": "Video generation returned no video bytes",
                }

            generation_time = (datetime.now() - start_time).total_seconds()
            return {
                "success": True,
                "video_bytes": video_bytes,
                "metadata": {
                    "prompt_used": enhanced_prompt,
                    "structured_prompt": structured_prompt,
                    "original_prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "duration": duration,
                    "resolution": resolution,
                    "motion_preset": motion_preset,
                    "content_context": content_context,
                    "generation_time": generation_time,
                    "model_used": result.get("model_name", selected_model),
                    "provider": result.get("provider", DEFAULT_PROVIDER),
                    "cost": result.get("cost", 0.0),
                },
            }
        except Exception as e:
            logger.error("[LinkedInVideoGen] Video generation failed: {}", e)
            return {"success": False, "error": f"Video generation failed: {e}"}
