"""
Image Alt Text Generation Service

Phase 10 (plan Phase B / B3b): previously returned canned alt text with a
hardcoded confidence ("AI-generated alt text...", 0.85). It now uses the real
Gemini vision seam (`describe_image`) and derives `confidence` from actual
keyword coverage. When vision is unavailable (no API key, unreadable image,
download failure) it returns an explicit status/data_source="unavailable" —
never fabricated copy.
"""

import asyncio
import os
import tempfile
from typing import Dict, Any, List, Optional
from datetime import datetime

import aiohttp
from loguru import logger

from services.llm_providers.image_to_text_gen.gemini_image_describe import (
    describe_image,
)

SHARED_USER_AGENT = "Mozilla/5.0 (compatible; ALwritySEO/1.0; +https://alwrity.com)"


class ImageAltService:
    """Service for generating SEO-optimized alt text with a real vision model"""

    def __init__(self):
        """Initialize the image alt service"""
        self.service_name = "image_alt_generator"
        logger.info(f"Initialized {self.service_name}")

    @staticmethod
    def _build_prompt(context: Optional[str], keywords: Optional[List[str]]) -> str:
        parts = [
            "Describe this image for an SEO alt attribute.",
            "Return one concise sentence (max ~125 characters).",
        ]
        if context:
            parts.append(f"Context: {context}.")
        if keywords:
            parts.append(
                "Naturally include these keywords where accurate: "
                + ", ".join(keywords)
                + "."
            )
        parts.append("Do not start with 'Image of' or 'Picture of'.")
        return " ".join(parts)

    @staticmethod
    def _confidence(alt_text: str, keywords: Optional[List[str]]) -> Optional[float]:
        """Derived confidence: fraction of requested keywords actually present."""
        if not keywords:
            return None
        matched = sum(1 for k in keywords if k and k.lower() in alt_text.lower())
        return round(matched / len(keywords), 2)

    @staticmethod
    def _unavailable(context: Optional[str], keywords: Optional[List[str]], reason: str) -> Dict[str, Any]:
        logger.info(f"Image alt text unavailable: {reason}")
        return {
            "status": "unavailable",
            "data_source": "unavailable",
            "alt_text": "",
            "context_used": context,
            "keywords_included": keywords or [],
            "confidence": None,
            "suggestions": [],
            "message": reason,
        }

    async def _download_image_to_temp(self, image_url: str) -> Optional[str]:
        """Download a remote image to a temp file. Returns None on failure."""
        temp_path = None
        try:
            async with aiohttp.ClientSession(
                headers={"User-Agent": SHARED_USER_AGENT}
            ) as session:
                async with session.get(image_url, timeout=15) as response:
                    if response.status != 200:
                        logger.warning(f"Image download non-200: {image_url} -> {response.status}")
                        return None
                    data = await response.read()

            suffix = os.path.splitext(image_url.split("?")[0])[1] or ".img"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(data)
                temp_path = tmp.name
            return temp_path
        except Exception as e:
            logger.error(f"Image download failed: {image_url}: {e}")
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            return None

    async def generate_alt_text_from_file(
        self,
        image_path: str,
        context: Optional[str] = None,
        keywords: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate alt text for a local image file using the vision model."""
        if not image_path or not os.path.exists(image_path):
            return self._unavailable(context, keywords, f"Image file not found: {image_path}")

        prompt = self._build_prompt(context, keywords)
        try:
            # describe_image is synchronous (blocking SDK); keep the loop free.
            description = await asyncio.to_thread(describe_image, image_path, prompt)
        except Exception as e:
            return self._unavailable(context, keywords, f"Vision analysis failed: {e}")

        if not description or not description.strip():
            return self._unavailable(
                context, keywords, "Vision model returned no description (provider unavailable?)"
            )

        alt_text = description.strip()
        keyword_list = keywords or []
        suggestions = []
        if keyword_list:
            missing = [k for k in keyword_list if k.lower() not in alt_text.lower()]
            if missing:
                suggestions.append(f"Keywords not reflected in the description: {', '.join(missing)}")

        return {
            "alt_text": alt_text,
            "context_used": context,
            "keywords_included": keyword_list,
            "confidence": self._confidence(alt_text, keyword_list),
            "suggestions": suggestions,
            "data_source": "vision",
        }

    async def generate_alt_text_from_url(
        self,
        image_url: str,
        context: Optional[str] = None,
        keywords: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate alt text for a remote image URL via a temp download + vision."""
        temp_path = await self._download_image_to_temp(image_url)
        if not temp_path:
            return self._unavailable(context, keywords, f"Could not download image: {image_url}")
        try:
            return await self.generate_alt_text_from_file(temp_path, context, keywords)
        finally:
            try:
                os.remove(temp_path)
            except OSError:
                pass

    async def health_check(self) -> Dict[str, Any]:
        """Health check for the image alt service"""
        return {
            "status": "operational",
            "service": self.service_name,
            "last_check": datetime.utcnow().isoformat(),
        }
