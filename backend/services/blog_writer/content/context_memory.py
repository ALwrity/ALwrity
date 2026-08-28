"""
ContextMemory - maintains intelligent continuity context across sections using LLM-enhanced summarization.

Stores smart per-section summaries and thread keywords for use in prompts with cost optimization.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple
from collections import deque
from loguru import logger
import hashlib

# Import the common gemini provider
from services.llm_providers.gemini_provider import gemini_text_response


class ContextMemory:
    """In-memory continuity store for recent sections with LLM-enhanced summarization.

    Notes:
    - Keeps an ordered deque of recent (section_id, summary) pairs
    - Uses LLM for intelligent summarization when content is substantial
    - Provides utilities to build a compact previous-sections summary
    - Implements caching to minimize LLM calls
    """

    def __init__(self, max_entries: int = 10):
        self.max_entries = max_entries
        self._recent: deque[Tuple[str, str]] = deque(maxlen=max_entries)
        # Cache for LLM-generated summaries
        self._summary_cache: Dict[str, str] = {}
        logger.debug("✅ ContextMemory initialized with LLM-enhanced summarization")

    def update_with_section(self, section_id: str, full_text: str, use_llm: bool = True) -> None:
        """Create a compact summary and store it for continuity usage."""
        summary = self._summarize_text_intelligently(full_text, use_llm=use_llm)
        self._recent.append((section_id, summary))

    def get_recent_summaries(self, limit: int = 2) -> List[str]:
        """Return the last N stored summaries (most recent first)."""
        return [s for (_sid, s) in list(self._recent)[-limit:]]

    def build_previous_sections_summary(self, limit: int = 2) -> str:
        """Join recent summaries for prompt injection."""
        recents = self.get_recent_summaries(limit=limit)
        if not recents:
            return ""
        return "\n\n".join(recents)

    def _summarize_text_intelligently(self, text: str, target_words: int = 80, use_llm: bool = True) -> str:
        """Create intelligent summary using LLM when appropriate, fallback to truncation."""
        
        # Create cache key
        cache_key = self._get_cache_key(text)
        
        # Check cache first
        if cache_key in self._summary_cache:
            logger.debug("Summary cache hit")
            return self._summary_cache[cache_key]

        # Determine if we should use LLM
        should_use_llm = use_llm and self._should_use_llm_summarization(text)
        
        if should_use_llm:
            try:
                summary = self._llm_summarize_text(text, target_words)
                self._summary_cache[cache_key] = summary
                logger.info("LLM-based summarization completed")
                return summary
            except Exception as e:
                logger.warning(f"LLM summarization failed, using fallback: {e}")
                # Fall through to local summarization
        
        # Local fallback
        summary = self._summarize_text_locally(text, target_words)
        self._summary_cache[cache_key] = summary
        return summary

    def _should_use_llm_summarization(self, text: str) -> bool:
        """Determine if content is substantial enough to warrant LLM summarization."""
        word_count = len(text.split())
        # Use LLM for substantial content (>150 words) or complex structure
        has_complex_structure = any(marker in text for marker in ['##', '###', '**', '*', '-', '1.', '2.'])
        
        return word_count > 150 or has_complex_structure

    def _llm_summarize_text(self, text: str, target_words: int = 80) -> str:
        """Use Gemini API for intelligent text summarization."""
        
        # Truncate text to minimize tokens while keeping key content
        truncated_text = text[:800]  # First 800 chars usually contain the main points
        
        prompt = f"""
Summarize the following content in approximately {target_words} words, focusing on key concepts and main points.

Content: {truncated_text}

Requirements:
- Capture the main ideas and key concepts
- Maintain the original tone and style
- Keep it concise but informative
- Focus on what's most important for continuity

Generate only the summary, no explanations or formatting.
"""

        try:
            result = gemini_text_response(
                prompt=prompt,
                temperature=0.3,  # Low temperature for consistent summarization
                max_tokens=500,   # Increased tokens for better summaries
                system_prompt="You are an expert at creating concise, informative summaries."
            )
            
            if result and result.strip():
                summary = result.strip()
                # Ensure it's not too long
                words = summary.split()
                if len(words) > target_words + 20:  # Allow some flexibility
                    summary = " ".join(words[:target_words]) + "..."
                return summary
            else:
                logger.warning("LLM summary response empty, using fallback")
                return self._summarize_text_locally(text, target_words)
                
        except Exception as e:
            logger.error(f"LLM summarization error: {e}")
            return self._summarize_text_locally(text, target_words)

    def _summarize_text_locally(self, text: str, target_words: int = 80) -> str:
        """Very lightweight, deterministic truncation-based summary.

        This deliberately avoids extra LLM calls. It collects the first
        sentences up to approximately target_words.
        """
        words = text.split()
        if len(words) <= target_words:
            return text.strip()
        return " ".join(words[:target_words]).strip() + " …"

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key from text hash."""
        # Use first 200 chars for cache key to balance uniqueness vs memory
        return hashlib.md5(text[:200].encode()).hexdigest()[:12]

    def clear_cache(self):
        """Clear summary cache (useful for testing or memory management)."""
        self._summary_cache.clear()
        logger.info("ContextMemory cache cleared")


