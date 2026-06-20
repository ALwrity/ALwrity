"""
LinkedIn Video Generator Service

Generates LinkedIn-optimized videos using the unified video generation infrastructure.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from ...onboarding.api_key_manager import APIKeyManager
from ...llm_providers.main_video_generation import ai_video_generate

logger = logging.getLogger(__name__)

VALID_ASPECT_RATIOS = {"16:9", "1:1", "9:16"}
DEFAULT_MODEL = "hunyuan-video-1.5"
DEFAULT_PROVIDER = "wavespeed"


class LinkedInVideoGenerator:
    """Handles LinkedIn-optimized text-to-video generation."""

    def __init__(self, api_key_manager: Optional[APIKeyManager] = None):
        self.api_key_manager = api_key_manager or APIKeyManager()

    def _enhance_prompt_for_linkedin(
        self,
        prompt: str,
        content_context: Dict[str, Any],
        aspect_ratio: str,
        motion_preset: str,
    ) -> str:
        topic = content_context.get("topic", "business")
        industry = content_context.get("industry", "business")
        content_type = content_context.get("content_type", "post")
        content_snippet = (content_context.get("content") or "")[:300]

        parts = [
            f"Create a professional LinkedIn {content_type} video for {topic}.",
            f"Industry: {industry}.",
            prompt.strip(),
        ]
        if content_snippet:
            parts.append(f"Context from post: {content_snippet}")
        parts.extend([
            f"Aspect ratio: {aspect_ratio}.",
            f"Motion style: {motion_preset}.",
            "Professional business aesthetic, cinematic quality, mobile-optimized.",
            "No text overlays, watermarks, or logos.",
        ])
        return " ".join(parts)

    def _validate_aspect_ratio(self, aspect_ratio: str) -> str:
        if aspect_ratio not in VALID_ASPECT_RATIOS:
            logger.warning(f"Invalid aspect ratio {aspect_ratio}, defaulting to 16:9")
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
    ) -> Dict[str, Any]:
        try:
            start_time = datetime.now()
            aspect_ratio = self._validate_aspect_ratio(aspect_ratio)
            enhanced_prompt = self._enhance_prompt_for_linkedin(
                prompt, content_context, aspect_ratio, motion_preset
            )

            result = await ai_video_generate(
                prompt=enhanced_prompt,
                operation_type="text-to-video",
                provider=DEFAULT_PROVIDER,
                user_id=user_id,
                model=DEFAULT_MODEL,
                duration=duration,
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                motion_preset=motion_preset,
                enable_prompt_expansion=True,
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
                    "original_prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "duration": duration,
                    "resolution": resolution,
                    "motion_preset": motion_preset,
                    "content_context": content_context,
                    "generation_time": generation_time,
                    "model_used": result.get("model_name", DEFAULT_MODEL),
                    "provider": result.get("provider", DEFAULT_PROVIDER),
                    "cost": result.get("cost", 0.0),
                },
            }
        except Exception as e:
            logger.error(f"LinkedIn video generation failed: {e}", exc_info=True)
            return {"success": False, "error": f"Video generation failed: {e}"}
