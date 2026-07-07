import json
from datetime import datetime, timezone
from loguru import logger

from models.linkedin_growth_models import (
    PreviewScoreRequest,
    PostPreviewScoreResponse,
    PostPreviewDimension,
)
from .cache import growth_cache


class PreviewScoreService:
    """Analyzes a LinkedIn post draft and returns scores across dimensions."""

    def score_post(
        self,
        request: PreviewScoreRequest,
        user_id: str,
    ) -> PostPreviewScoreResponse:
        """Score a post draft across multiple quality dimensions."""
        result = self._llm_score_post(request, user_id)
        if result is None:
            raise RuntimeError("Preview score LLM generation returned no result")

        dimensions_raw = result.get("dimensions", [])
        if not dimensions_raw or not isinstance(dimensions_raw, list):
            raise RuntimeError("Preview score LLM returned invalid dimensions")

        try:
            dimensions = [PostPreviewDimension(**d) for d in dimensions_raw]
        except Exception as e:
            raise RuntimeError(f"Failed to parse preview score dimensions: {e}") from e

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

    def _llm_score_post(
        self,
        request: PreviewScoreRequest,
        user_id: str,
    ) -> dict | None:
        """Call LLM to score the post. Returns raw dict or None."""
        from services.llm_providers.main_text_generation import llm_text_gen

        system_prompt = (
            "You are a LinkedIn content strategist with expert-level knowledge of the "
            "LinkedIn platform, its algorithm, and what drives engagement on the feed.\n\n"
            "Analyze the given text as a LinkedIn post. **Infer** what quality means "
            "for THIS post based on its topic, tone, and structure — do not apply "
            "generic copywriting rules. Evaluate how well it would perform natively on "
            "LinkedIn's feed.\n\n"
            "Score it across 6 dimensions (0-100 each). **Infer** which dimensions are "
            "most relevant for THIS post — the list below is a starting point, but you "
            "may adapt the dimension names slightly if the post warrants it:\n\n"
            "1. Hook & First Impression — Does the opening stop the scroll?\n"
            "2. Message Clarity — Is the core insight immediately graspable?\n"
            "3. Engagement Triggers — Does it invite reaction, comment, or save?\n"
            "4. Value & Originality — Does it teach, challenge, or inspire?\n"
            "5. Structure & Scannability — Is it formatted for a mobile feed?\n"
            "6. Authenticity & Voice — Does it sound like a person, not a brand?\n\n"
            "For each dimension, provide:\n"
            "- dimension: name you inferred (match the spirit of the guidelines above)\n"
            "- score: integer 0-100\n"
            "- feedback: specific, actionable advice with a concrete rewrite example or "
            "excerpt from the post — quote the exact text you are critiquing\n"
            "- data_source_detail: briefly explain what feature of the post informed "
            "this score (e.g., 'Opening uses a statistic but buries it in the second "
            "paragraph')\n"
            "- confidence: high/medium/low\n\n"
            "Also provide:\n"
            "- overall_score: integer 0-100 (weighted, prioritizing dimensions that "
            "matter most for this specific post)\n"
            "- top_improvement: the single highest-leverage change the author could "
            "make — be specific and mention exact text from the post\n\n"
            "Output ONLY valid JSON. Be critical — a score of 80+ should mean this "
            "dimension is genuinely excellent, not merely adequate."
        )

        context_block = f"\nTopic / context: {request.context}\n" if request.context else ""
        prompt = (
            f"LinkedIn post to evaluate:\n\n{request.content}\n\n"
            f"{context_block}"
            f"Word count: {len(request.content.split())}\n\n"
            "Score this as a native LinkedIn post. Consider its topic, tone, "
            "target reader, and how it would perform in the LinkedIn feed. "
            "Return JSON with 'dimensions' array (exactly 6 items), "
            "'overall_score' (integer 0-100), and 'top_improvement' (string)."
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
            raw = llm_text_gen(
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
                flow_type="preview_score",
            )
        except Exception as exc:
            logger.error("[PreviewScore] LLM generation failed: {}", exc)
            return None

        # Normalize: llm_text_gen with json_struct returns dict, but
        # some providers may return a JSON string (standard blog writer pattern)
        if isinstance(raw, str):
            cleaned = raw.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            try:
                raw = json.loads(cleaned)
            except json.JSONDecodeError as e:
                logger.warning("[PreviewScore] Failed to parse LLM string response as JSON: {}", e)
                return None

        if not isinstance(raw, dict):
            logger.warning("[PreviewScore] LLM returned unexpected type: {}", type(raw))
            return None

        # Normalize key variants (some providers may use slightly different keys)
        dims = raw.get("dimensions", raw.get("scores", raw.get("dimension_scores", [])))
        overall = raw.get("overall_score", raw.get("overall", raw.get("total_score")))
        improvement = raw.get("top_improvement", raw.get("improvement", ""))

        if not isinstance(dims, list) or overall is None:
            logger.warning("[PreviewScore] LLM response missing required fields: dims={} overall={}", bool(dims), overall)
            return None

        normalized = {
            "dimensions": dims,
            "overall_score": overall,
            "top_improvement": improvement or "",
        }
        growth_cache.set(llm_cache_key, normalized, ttl_seconds=3600)
        return normalized
