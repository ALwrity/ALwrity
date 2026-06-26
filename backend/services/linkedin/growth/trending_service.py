import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from loguru import logger

from models.linkedin_growth_models import (
    TrendingTopicItem,
    TrendingTopicsResponse,
)
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class TrendingService:
    """Identifies trending topics in the user's industry for LinkedIn growth."""

    def __init__(self):
        self._profile_repo = None
        self._exa_provider = None

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
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
        """Resolve the user's industry from profile context or persona."""
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if context and isinstance(context, dict):
            industry = context.get("industry", "").strip()
            if industry:
                logger.info("[TrendingService] Resolved industry from profile context: {}", industry)
                return industry

        raise ValueError("Could not resolve user industry from profile or persona")

    def _build_search_query(self, industry: str) -> str:
        return f"{industry} trends insights news {datetime.now().year}"

    async def _search_trending_articles(
        self, industry: str, user_id: str
    ) -> List[Dict[str, Any]]:
        """Search Exa for recent trending articles in the given industry."""
        query = self._build_search_query(industry)
        cache_key = growth_cache.exa_key(query, 10, user_id)
        cached = growth_cache.get(cache_key)
        if cached is not None:
            logger.info("[TrendingService] Exa cache hit for '{}'", query[:60])
            return cached

        provider = self._get_exa_provider()
        if not provider:
            logger.warning("[TrendingService] Exa provider not available")
            return []

        try:
            results = await provider.simple_search(
                query=query,
                num_results=10,
                user_id=user_id,
            )
            logger.info("[TrendingService] Exa returned {} results for '{}'", len(results), query)
            growth_cache.set(cache_key, results, ttl_seconds=300)
            return results
        except Exception as exc:
            logger.warning("[TrendingService] Exa search failed: {}", exc)
            return []

    async def _llm_extract_topics(
        self, industry: str, articles: List[Dict[str, Any]], user_id: str
    ) -> List[TrendingTopicItem]:
        """Call LLM to extract trending topics from search results."""
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:10], 1):
            title = a.get("title", "Untitled")
            snippet = (a.get("text") or a.get("snippet") or "")[:300]
            articles_text += f"{i}. {title}\n   {snippet}\n\n"

        system_prompt = (
            "You are a LinkedIn growth strategist. "
            "Analyze the search results and identify the top 3 trending topics in the given industry. "
            "For each topic provide:\n"
            "- topic: short label (2-4 words)\n"
            "- emoji: a single relevant emoji\n"
            "- why_now: 1-sentence explanation of why this matters right now\n"
            "- suggested_hook: a LinkedIn post hook the user could write\n"
            "- data_source_detail: brief explanation of what data this comes from\n"
            "- confidence: high/medium/low\n"
            "Output ONLY valid JSON matching the schema."
        )

        prompt = (
            f"Industry: {industry}\n\n"
            f"Recent articles and content:\n{articles_text}\n\n"
            "What are the top 3 trending topics right now? "
            "Return JSON with a 'trending_topics' array."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "trending_topics": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "topic": {"type": "string"},
                            "emoji": {"type": "string"},
                            "why_now": {"type": "string"},
                            "suggested_hook": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                        },
                        "required": [
                            "topic",
                            "emoji",
                            "why_now",
                            "suggested_hook",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                }
            },
            "required": ["trending_topics"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[TrendingService] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "trending_topics" in raw:
                topics_data = raw["trending_topics"]
                result = [TrendingTopicItem(**t) for t in topics_data]
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[TrendingService] LLM returned unexpected shape: {}", type(raw))
            return []
        except Exception as exc:
            logger.error("[TrendingService] LLM extraction failed: {}", exc)
            return []

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    async def get_trending_topics(
        self,
        user_id: str,
        industry_override: Optional[str] = None,
    ) -> TrendingTopicsResponse:
        """
        Main entry point — returns trending topics for the user's industry.
        """
        industry = industry_override or await asyncio.to_thread(self._resolve_industry, user_id)

        articles = await self._search_trending_articles(industry, user_id)
        if not articles:
            logger.warning("[TrendingService] No articles found for industry '{}'", industry)
            return TrendingTopicsResponse(
                industry=industry,
                trending_topics=[],
                data_source_summary="No trending data available at this time. Connect Exa API key to enable.",
                generated_at=datetime.now(timezone.utc),
            )

        topics = await self._llm_extract_topics(industry, articles, user_id)
        if not topics:
            return TrendingTopicsResponse(
                industry=industry,
                trending_topics=[],
                data_source_summary="Could not extract trending topics from search results.",
                generated_at=datetime.now(timezone.utc),
            )

        data_source_summary = (
            f"Exa search of {len(articles)} recent articles in {industry} "
            f"+ AI analysis of posting patterns"
        )

        return TrendingTopicsResponse(
            industry=industry,
            trending_topics=topics,
            data_source_summary=data_source_summary,
            generated_at=datetime.now(timezone.utc),
        )
