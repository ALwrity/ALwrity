"""
FlowAnalyzer - evaluates narrative flow using LLM-based analysis with cost optimization.

Uses Gemini API for intelligent analysis while minimizing API calls through caching and smart triggers.
"""

from typing import Dict, Optional
from loguru import logger
import hashlib

# Provider-agnostic LLM dispatcher (respects GPT_PROVIDER env var)
from services.llm_providers.main_text_generation import llm_text_gen


class FlowAnalyzer:
    def __init__(self):
        # Simple in-memory cache to avoid redundant LLM calls
        self._cache: Dict[str, Dict[str, float]] = {}
        # Cache for rule-based fallback when LLM analysis isn't needed
        self._rule_cache: Dict[str, Dict[str, float]] = {}
        logger.debug("✅ FlowAnalyzer initialized with LLM-based analysis")

    def assess_flow(self, previous_text: str, current_text: str, use_llm: bool = True, user_id: str = None) -> Dict[str, float]:
        """
        Return flow metrics in range 0..1.
        
        Args:
            previous_text: Previous section content
            current_text: Current section content  
            use_llm: Whether to use LLM analysis (default: True for significant content)
            user_id: Clerk user ID for subscription checking
        """
        if not current_text:
            return {"flow": 0.0, "consistency": 0.0, "progression": 0.0}

        # Create cache key from content hashes
        cache_key = self._get_cache_key(previous_text, current_text)
        
        # Check cache first
        if cache_key in self._cache:
            logger.debug("Flow analysis cache hit")
            return self._cache[cache_key]

        # Determine if we should use LLM analysis
        should_use_llm = use_llm and self._should_use_llm_analysis(previous_text, current_text)
        
        if should_use_llm:
            try:
                metrics = self._llm_flow_analysis(previous_text, current_text, user_id=user_id)
                self._cache[cache_key] = metrics
                logger.info("LLM-based flow analysis completed")
                return metrics
            except Exception as e:
                logger.warning(f"LLM flow analysis failed, falling back to rules: {e}")
                # Fall through to rule-based analysis
        
        # Rule-based fallback (cached separately)
        if cache_key in self._rule_cache:
            return self._rule_cache[cache_key]
            
        metrics = self._rule_based_analysis(previous_text, current_text)
        self._rule_cache[cache_key] = metrics
        return metrics

    def _should_use_llm_analysis(self, previous_text: str, current_text: str) -> bool:
        """Determine if content is significant enough to warrant LLM analysis."""
        # Use LLM for substantial content or when previous context exists
        word_count = len(current_text.split())
        has_previous = bool(previous_text and len(previous_text.strip()) > 50)
        
        # Use LLM if: substantial content (>100 words) OR has meaningful previous context
        return word_count > 100 or has_previous

    def _llm_flow_analysis(self, previous_text: str, current_text: str, user_id: str = None) -> Dict[str, float]:
        """Use LLM for intelligent flow analysis (provider-agnostic)."""
        
        # Truncate content to minimize tokens while keeping context
        prev_truncated = (previous_text[-300:] if previous_text else "") if previous_text else ""
        curr_truncated = current_text[:500]  # First 500 chars usually contain the key content
        
        prompt = f"""
Analyze the narrative flow between these two content sections. Rate each aspect from 0.0 to 1.0.

PREVIOUS SECTION (end): {prev_truncated}
CURRENT SECTION (start): {curr_truncated}

Evaluate:
1. Flow Quality (0.0-1.0): How smoothly does the content transition? Are there logical connections?
2. Consistency (0.0-1.0): Do key themes, terminology, and tone remain consistent?
3. Progression (0.0-1.0): Does the content logically build upon previous ideas?

Return ONLY a JSON object with these exact keys: flow, consistency, progression
"""

        schema = {
            "type": "object",
            "properties": {
                "flow": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                "consistency": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                "progression": {"type": "number", "minimum": 0.0, "maximum": 1.0}
            },
            "required": ["flow", "consistency", "progression"]
        }

        try:
            result = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt=None,
                user_id=user_id,
                temperature=0.2,
                max_tokens=1000
            )
            
            return {
                "flow": float(result.get("flow", 0.6)),
                "consistency": float(result.get("consistency", 0.6)),
                "progression": float(result.get("progression", 0.6))
            }
                
        except Exception as e:
            logger.error(f"LLM flow analysis error: {e}")
            return self._rule_based_analysis(previous_text, current_text)

    def _rule_based_analysis(self, previous_text: str, current_text: str) -> Dict[str, float]:
        """Fallback rule-based analysis for cost efficiency."""
        flow = 0.6
        consistency = 0.6
        progression = 0.6

        # Enhanced heuristics
        if previous_text and previous_text[-1] in ".!?":
            flow += 0.1
        if any(k in current_text.lower() for k in ["therefore", "next", "building on", "as a result", "furthermore", "additionally"]):
            progression += 0.2
        if len(current_text.split()) > 120:
            consistency += 0.1
        if any(k in current_text.lower() for k in ["however", "but", "although", "despite"]):
            flow += 0.1  # Good use of contrast words

        return {
            "flow": min(flow, 1.0),
            "consistency": min(consistency, 1.0),
            "progression": min(progression, 1.0),
        }

    def _get_cache_key(self, previous_text: str, current_text: str) -> str:
        """Generate cache key from content hashes."""
        # Use first 100 chars of each for cache key to balance uniqueness vs memory
        prev_hash = hashlib.md5((previous_text[:100] if previous_text else "").encode()).hexdigest()[:8]
        curr_hash = hashlib.md5(current_text[:100].encode()).hexdigest()[:8]
        return f"{prev_hash}_{curr_hash}"

    def clear_cache(self):
        """Clear analysis cache (useful for testing or memory management)."""
        self._cache.clear()
        self._rule_cache.clear()
        logger.info("FlowAnalyzer cache cleared")


