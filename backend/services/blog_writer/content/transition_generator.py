"""
TransitionGenerator - produces intelligent transitions between sections using LLM analysis.

Uses Gemini API for natural transitions while maintaining cost efficiency through smart caching.
"""

from typing import Optional, Dict
from loguru import logger
import hashlib

# Import the common gemini provider
from services.llm_providers.gemini_provider import gemini_text_response


class TransitionGenerator:
    def __init__(self):
        # Simple cache to avoid redundant LLM calls for similar transitions
        self._cache: Dict[str, str] = {}
        logger.debug("✅ TransitionGenerator initialized with LLM-based generation")

    def generate_transition(self, previous_text: str, current_heading: str, use_llm: bool = True) -> str:
        """
        Return a 1–2 sentence bridge from previous_text into current_heading.
        
        Args:
            previous_text: Previous section content
            current_heading: Current section heading
            use_llm: Whether to use LLM generation (default: True for substantial content)
        """
        prev = (previous_text or "").strip()
        if not prev:
            return f"Let's explore {current_heading.lower()} next."

        # Create cache key
        cache_key = self._get_cache_key(prev, current_heading)
        
        # Check cache first
        if cache_key in self._cache:
            logger.debug("Transition generation cache hit")
            return self._cache[cache_key]

        # Determine if we should use LLM
        should_use_llm = use_llm and self._should_use_llm_generation(prev, current_heading)
        
        if should_use_llm:
            try:
                transition = self._llm_generate_transition(prev, current_heading)
                self._cache[cache_key] = transition
                logger.info("LLM-based transition generated")
                return transition
            except Exception as e:
                logger.warning(f"LLM transition generation failed, using fallback: {e}")
                # Fall through to heuristic generation
        
        # Heuristic fallback
        transition = self._heuristic_transition(prev, current_heading)
        self._cache[cache_key] = transition
        return transition

    def _should_use_llm_generation(self, previous_text: str, current_heading: str) -> bool:
        """Determine if content is substantial enough to warrant LLM generation."""
        # Use LLM for substantial previous content (>100 words) or complex headings
        word_count = len(previous_text.split())
        complex_heading = len(current_heading.split()) > 2 or any(char in current_heading for char in [':', '-', '&'])
        
        return word_count > 100 or complex_heading

    def _llm_generate_transition(self, previous_text: str, current_heading: str) -> str:
        """Use Gemini API for intelligent transition generation."""
        
        # Truncate previous text to minimize tokens while keeping context
        prev_truncated = previous_text[-200:]  # Last 200 chars usually contain the conclusion
        
        prompt = f"""
Create a smooth, natural 1-2 sentence transition from the previous content to the new section.

PREVIOUS CONTENT (ending): {prev_truncated}
NEW SECTION HEADING: {current_heading}

Requirements:
- Write exactly 1-2 sentences
- Create a logical bridge between the topics
- Use natural, engaging language
- Avoid repetition of the previous content
- Lead smoothly into the new section topic

Generate only the transition text, no explanations or formatting.
"""

        # PHASE C SKIP (persona voice): transitions are structural glue between
        # sections (1-2 sentences), not brand-voice content — and this generator is
        # sync with no user_id to resolve the persona. Style/topic separation:
        # persona belongs in section content, not in the transition.
        try:
            result = gemini_text_response(
                prompt=prompt,
                temperature=0.6,  # Balanced creativity and consistency
                max_tokens=300,   # Increased tokens for better transitions
                system_prompt="You are an expert content writer creating smooth transitions between sections."
            )
            
            if result and result.strip():
                # Clean up the response
                transition = result.strip()
                # Ensure it's 1-2 sentences
                sentences = transition.split('. ')
                if len(sentences) > 2:
                    transition = '. '.join(sentences[:2]) + '.'
                return transition
            else:
                logger.warning("LLM transition response empty, using fallback")
                return self._heuristic_transition(previous_text, current_heading)
                
        except Exception as e:
            logger.error(f"LLM transition generation error: {e}")
            return self._heuristic_transition(previous_text, current_heading)

    def _heuristic_transition(self, previous_text: str, current_heading: str) -> str:
        """Fallback heuristic-based transition generation."""
        tail = previous_text[-240:]
        
        # Enhanced heuristics based on content patterns
        if any(word in tail.lower() for word in ["problem", "issue", "challenge"]):
            return f"Now that we've identified the challenges, let's explore {current_heading.lower()} to find solutions."
        elif any(word in tail.lower() for word in ["solution", "approach", "method"]):
            return f"Building on this approach, {current_heading.lower()} provides the next step in our analysis."
        elif any(word in tail.lower() for word in ["important", "crucial", "essential"]):
            return f"Given this importance, {current_heading.lower()} becomes our next focus area."
        else:
            return (
                f"Building on the discussion above, this leads us into {current_heading.lower()}, "
                f"where we focus on practical implications and what to do next."
            )

    def _get_cache_key(self, previous_text: str, current_heading: str) -> str:
        """Generate cache key from content hashes."""
        # Use last 100 chars of previous text and heading for cache key
        prev_hash = hashlib.md5(previous_text[-100:].encode()).hexdigest()[:8]
        heading_hash = hashlib.md5(current_heading.encode()).hexdigest()[:8]
        return f"{prev_hash}_{heading_hash}"

    def clear_cache(self):
        """Clear transition cache (useful for testing or memory management)."""
        self._cache.clear()
        logger.info("TransitionGenerator cache cleared")


