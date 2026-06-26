import asyncio
from datetime import datetime, timezone
from loguru import logger

from models.linkedin_growth_models import (
    PreviewScoreRequest,
    PostPreviewScoreResponse,
    PostPreviewDimension,
)
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class PreviewScoreService:
    """Analyzes a LinkedIn post draft and returns scores across dimensions."""

    async def score_post(
        self,
        request: PreviewScoreRequest,
        user_id: str,
    ) -> PostPreviewScoreResponse:
        """Score a post draft across multiple quality dimensions."""
        result = await self._llm_score_post(request, user_id)
        if result is None:
            raise RuntimeError("Preview score LLM generation returned no result")

        dimensions = [PostPreviewDimension(**d) for d in result.get("dimensions", [])]
        return PostPreviewScoreResponse(
            overall_score=result.get("overall_score", 50),
            dimensions=dimensions,
            top_improvement=result.get("top_improvement", ""),
            data_source_summary=(
                f"AI scored your {len(request.content.split())}-word post across "
                f"{len(dimensions)} quality dimensions"
            ),
            generated_at=datetime.now(timezone.utc),
        )

    async def _llm_score_post(
        self,
        request: PreviewScoreRequest,
        user_id: str,
    ) -> dict | None:
        """Call LLM to score the post. Returns raw dict or None."""
        from services.llm_providers.main_text_generation import llm_text_gen

        system_prompt = (
            "You are a LinkedIn content strategist. Analyze the given LinkedIn post "
            "and score it across these dimensions (0-100 each):\n\n"
            "1. Hook Strength — How compelling is the opening?\n"
            "2. Clarity — Is the message easy to understand?\n"
            "3. Engagement Potential — Will it spark comments/shares?\n"
            "4. Value Proposition — Does it provide value to the reader?\n"
            "5. Call to Action — Is there a clear next step?\n"
            "6. Readability — Is it well-structured and scannable?\n\n"
            "For each dimension, provide:\n"
            "- dimension: name exactly as listed above\n"
            "- score: integer 0-100\n"
            "- feedback: 1-2 sentences of actionable advice\n"
            "- data_source_detail: what this score is based on\n"
            "- confidence: high/medium/low\n\n"
            "Also provide:\n"
            "- overall_score: integer 0-100 (weighted average)\n"
            "- top_improvement: the single most impactful suggestion (1 sentence)\n\n"
            "Output ONLY valid JSON. Be critical and specific."
        )

        prompt = (
            f"Post content:\n{request.content}\n\n"
            f"Context: {request.context or ''}\n"
            f"Word count: {len(request.content.split())}\n\n"
            "Score this LinkedIn post. Return JSON with 'dimensions' array of "
            "exactly 6 items, 'overall_score' (integer), and 'top_improvement' (string)."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "dimension": {"type": "string"},
                            "score": {"type": "integer", "minimum": 0, "maximum": 100},
                            "feedback": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "dimension",
                            "score",
                            "feedback",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                },
                "overall_score": {"type": "integer", "minimum": 0, "maximum": 100},
                "top_improvement": {"type": "string"},
            },
            "required": ["dimensions", "overall_score", "top_improvement"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[PreviewScore] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "dimensions" in raw and "overall_score" in raw:
                growth_cache.set(llm_cache_key, raw, ttl_seconds=3600)
                return raw
            logger.warning("[PreviewScore] LLM returned unexpected shape: {}", type(raw))
            return None
        except Exception as exc:
            logger.error("[PreviewScore] LLM generation failed: {}", exc)
            return None
