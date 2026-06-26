import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List
from loguru import logger

from models.linkedin_growth_models import ViralPattern, ViralAnalysisResponse
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class ViralAnalysisService:
    """Analyzes viral content patterns in the user's industry."""

    def __init__(self):
        self._profile_repo = None
        self._exa_provider = None

    def _get_profile_repo(self):
        if self._profile_repo is None:
            from services.integrations.linkedin.profile_repository import ProfileRepository
            self._profile_repo = ProfileRepository()
        return self._profile_repo

    def _get_exa_provider(self):
        if self._exa_provider is None:
            from services.research import get_exa_content_provider
            self._exa_provider = get_exa_content_provider()
        return self._exa_provider

    def _resolve_industry(self, user_id: str) -> str:
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if context and isinstance(context, dict):
            industry = context.get("industry", "").strip()
            if industry:
                return industry
        raise ValueError("Could not resolve user industry from profile context")

    async def _search_viral_content(self, industry: str, user_id: str) -> List[Dict[str, Any]]:
        """Search Exa for high-engagement LinkedIn posts in this industry."""
        provider = self._get_exa_provider()
        if not provider:
            logger.warning("[ViralAnalysis] Exa provider not available")
            return []

        queries = [
            f"viral LinkedIn post {industry} high engagement",
            f"trending LinkedIn content {industry} strategy",
            f"LinkedIn post that went viral {industry}",
        ]
        all_results: List[Dict[str, Any]] = []
        for query in queries:
            cache_key = growth_cache.exa_key(query, 5, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                logger.info("[ViralAnalysis] Exa cache hit for '{}'", query[:50])
                all_results.extend(cached)
                continue
            try:
                results = await provider.simple_search(
                    query=query,
                    num_results=5,
                    user_id=user_id,
                )
                all_results.extend(results)
                growth_cache.set(cache_key, results, ttl_seconds=300)
            except Exception as exc:
                logger.warning("[ViralAnalysis] Exa search failed: {}", exc)
        return all_results

    async def _llm_extract_patterns(
        self,
        industry: str,
        articles: List[Dict[str, Any]],
        user_id: str,
    ) -> List[ViralPattern]:
        """Call LLM to identify viral content patterns from search results."""
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:10], 1):
            title = a.get("title", "Untitled")
            snippet = (a.get("text") or a.get("snippet") or "")[:300]
            author = a.get("author") or ""
            articles_text += f'{i}. "{title}" by {author}\n   {snippet}\n\n'

        system_prompt = (
            "You are a LinkedIn viral content analyst. Analyze the given articles "
            "and identify 3-4 content patterns that drive high engagement in the "
            "user's industry.\n\n"
            "For each pattern provide:\n"
            "- pattern_name: short label (e.g. 'Hot take + data point')\n"
            "- description: 1-2 sentences explaining the pattern and why it works\n"
            "- engagement_multiplier: estimated impact (e.g. '3x engagement')\n"
            "- example_headline: a real example post headline\n"
            "- example_author: who posted the example\n"
            "- data_source_detail: what data this is based on\n"
            "- confidence: high/medium/low\n\n"
            "Also provide:\n"
            "- top_recommendation: which single pattern the user should use right now (1 sentence)\n\n"
            "Output ONLY valid JSON. Be specific and actionable."
        )

        prompt = (
            f"Industry: {industry}\n\n"
            f"Recent high-engagement content:\n{articles_text}\n\n"
            "Identify viral content patterns. Return JSON with a 'patterns' array "
            "of exactly 4 items and a 'top_recommendation' string."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "patterns": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "pattern_name": {"type": "string"},
                            "description": {"type": "string"},
                            "engagement_multiplier": {"type": "string"},
                            "example_headline": {"type": "string"},
                            "example_author": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "pattern_name",
                            "description",
                            "engagement_multiplier",
                            "example_headline",
                            "example_author",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                },
                "top_recommendation": {"type": "string"},
            },
            "required": ["patterns", "top_recommendation"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[ViralAnalysis] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "patterns" in raw:
                result = [ViralPattern(**p) for p in raw["patterns"]]
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[ViralAnalysis] LLM returned unexpected shape: {}", type(raw))
            return []
        except Exception as exc:
            logger.error("[ViralAnalysis] LLM generation failed: {}", exc)
            return []

    async def analyze(
        self,
        user_id: str,
    ) -> ViralAnalysisResponse:
        """Return viral content patterns for the user's industry."""
        industry = await asyncio.to_thread(self._resolve_industry, user_id)

        articles = await self._search_viral_content(industry, user_id)
        if not articles:
            return ViralAnalysisResponse(
                industry=industry,
                patterns=[],
                top_recommendation="No viral content data found for your industry yet.",
                data_source_summary="No content found. Connect your LinkedIn account for personalized analysis.",
                generated_at=datetime.now(timezone.utc),
            )

        patterns = await self._llm_extract_patterns(industry, articles, user_id)
        data_source_summary = (
            f"Based on {len(articles)} high-engagement posts in {industry} "
            f"+ AI pattern recognition"
        )

        return ViralAnalysisResponse(
            industry=industry,
            patterns=patterns,
            top_recommendation=patterns[0].pattern_name if patterns else "No patterns identified.",
            data_source_summary=data_source_summary,
            generated_at=datetime.now(timezone.utc),
        )
