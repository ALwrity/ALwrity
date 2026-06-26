import asyncio
from datetime import datetime, timezone
from loguru import logger

from models.linkedin_growth_models import BrandDimension, BrandScorecardResponse
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class BrandScorecardService:
    """Evaluates the user's LinkedIn personal brand strength."""

    def __init__(self):
        self._profile_repo = None

    def _get_profile_repo(self):
        if self._profile_repo is None:
            from services.integrations.linkedin.profile_repository import ProfileRepository
            self._profile_repo = ProfileRepository()
        return self._profile_repo

    def _get_context(self, user_id: str) -> dict:
        """Get all available profile context for scoring."""
        repo = self._get_profile_repo()
        ctx = repo.get_profile_context(user_id)
        if ctx and isinstance(ctx, dict):
            return ctx
        raise ValueError("Could not load profile context")

    def _profile_summary(self, ctx: dict) -> str:
        """Build a human-readable summary of profile data."""
        parts = []
        pi = ctx.get("personal_information", {})
        pr = ctx.get("professional_information", {})

        headline = pi.get("headline", "")
        if headline:
            parts.append(f"Headline: {headline}")

        industry = ctx.get("industry", "")
        if industry:
            parts.append(f"Industry: {industry}")

        title = pr.get("title", "")
        if title:
            parts.append(f"Title: {title}")

        geo = pi.get("geo", {})
        location = geo.get("full", geo.get("city", ""))
        if location:
            parts.append(f"Location: {location}")

        return "\n".join(parts) if parts else "Limited profile data available."

    async def score(
        self,
        user_id: str,
    ) -> BrandScorecardResponse:
        """Score the user's personal brand based on profile data."""
        ctx = await asyncio.to_thread(self._get_context, user_id)
        profile_text = self._profile_summary(ctx)

        result = await self._llm_score_brand(profile_text, user_id)
        if result is None:
            raise RuntimeError("Brand scorecard LLM generation returned no result")

        dimensions = [BrandDimension(**d) for d in result.get("dimensions", [])]
        return BrandScorecardResponse(
            overall_score=result.get("overall_score", 50),
            dimensions=dimensions,
            top_recommendation=result.get("top_recommendation", ""),
            data_source_summary=(
                f"Based on your LinkedIn profile data across {len(dimensions)} "
                f"brand dimensions"
            ),
            generated_at=datetime.now(timezone.utc),
        )

    async def _llm_score_brand(self, profile_text: str, user_id: str) -> dict | None:
        from services.llm_providers.main_text_generation import llm_text_gen

        system_prompt = (
            "You are a LinkedIn personal branding analyst. Evaluate the user's "
            "LinkedIn profile and score it across these dimensions (0-100 each):\n\n"
            "1. Profile Completeness — Does the profile have a photo, headline, "
            "about section, featured content?\n"
            "2. Content Consistency — Is there evidence of regular posting?\n"
            "3. Authority Signals — Does the profile show thought leadership?\n"
            "4. Network Quality — Does the profile suggest a strong network?\n"
            "5. Brand Clarity — Is the personal brand message clear?\n\n"
            "For each dimension provide:\n"
            "- dimension: name exactly as listed above\n"
            "- score: integer 0-100\n"
            "- feedback: 1-2 sentences of actionable advice\n"
            "- data_source_detail: what data this is based on\n"
            "- confidence: high/medium/low\n\n"
            "Also provide:\n"
            "- overall_score: integer 0-100 (weighted average)\n"
            "- top_recommendation: single most impactful suggestion (1 sentence)\n\n"
            "Output ONLY valid JSON. Be honest and critical — don't inflate scores."
        )

        prompt = (
            f"User's LinkedIn Profile:\n{profile_text}\n\n"
            "Score this personal brand. Return JSON with 'dimensions' array of "
            "exactly 5 items, 'overall_score' (integer), and "
            "'top_recommendation' (string)."
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
                "top_recommendation": {"type": "string"},
            },
            "required": ["dimensions", "overall_score", "top_recommendation"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[BrandScorecard] LLM cache hit")
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
            logger.warning("[BrandScorecard] LLM returned unexpected shape: {}", type(raw))
            return None
        except Exception as exc:
            logger.error("[BrandScorecard] LLM generation failed: {}", exc)
            return None
