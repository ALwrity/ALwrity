import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from loguru import logger

from models.linkedin_growth_models import (
    EngagementOpportunityItem,
    EngagementOpportunitiesResponse,
)
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class EngagementService:
    """Finds posts the user should engage with and suggests comments."""

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
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if context and isinstance(context, dict):
            industry = context.get("industry", "").strip()
            if industry:
                return industry
        raise ValueError("Could not resolve user industry from profile context")

    async def _search_posts(
        self, industry: str, user_id: str
    ) -> List[Dict[str, Any]]:
        """Search Exa for recent thought-provoking posts in this industry."""
        provider = self._get_exa_provider()
        if not provider:
            logger.warning("[Engagement] Exa provider not available")
            return []

        queries = [
            f"{industry} thought leadership insights",
            f"{industry} debate discussion analysis",
        ]
        all_results: List[Dict[str, Any]] = []
        for query in queries:
            cache_key = growth_cache.exa_key(query, 5, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                logger.info("[Engagement] Exa cache hit for '{}'", query[:50])
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
                logger.warning("[Engagement] Exa search failed: {}", exc)
        return all_results

    async def _llm_generate_opportunities(
        self,
        industry: str,
        articles: List[Dict[str, Any]],
        user_id: str,
    ) -> List[EngagementOpportunityItem]:
        """Call LLM to generate engagement opportunities from search results."""
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:8], 1):
            title = a.get("title", "Untitled")
            snippet = (a.get("text") or a.get("snippet") or "")[:250]
            author = a.get("author") or ""
            articles_text += f'{i}. "{title}" by {author}\n   {snippet}\n\n'

        system_prompt = (
            "You are a LinkedIn engagement strategist. "
            "Analyze the recent articles in the user's industry and suggest "
            "3 opportunities where the user could add value by commenting.\n\n"
            "For each opportunity provide:\n"
            "- title: The article/post title\n"
            "- author: The author's name\n"
            "- author_context: Context about the author (e.g. 'thought leader in SaaS', "
            "'your network', 'industry analyst')\n"
            "- why_engage: 1 sentence explaining why commenting is valuable\n"
            "- suggested_comment: A thoughtful, specific comment (2-3 sentences) that "
            "adds value, references the content, and shows expertise\n"
            "- data_source_detail: What data this is based on\n"
            "- confidence: high/medium/low\n"
            "Output ONLY valid JSON matching the schema."
        )

        prompt = (
            f"Industry: {industry}\n\n"
            f"Recent content:\n{articles_text}\n\n"
            "Where should this user engage? Return JSON with an 'opportunities' "
            "array of exactly 3 items."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "opportunities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "author": {"type": "string"},
                            "author_context": {"type": "string"},
                            "why_engage": {"type": "string"},
                            "suggested_comment": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "title",
                            "author",
                            "author_context",
                            "why_engage",
                            "suggested_comment",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                }
            },
            "required": ["opportunities"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[Engagement] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "opportunities" in raw:
                result = [EngagementOpportunityItem(**o) for o in raw["opportunities"]]
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[Engagement] LLM returned unexpected shape: {}", type(raw))
            return []
        except Exception as exc:
            logger.error("[Engagement] LLM generation failed: {}", exc)
            return []

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    async def get_engagement_opportunities(
        self,
        user_id: str,
    ) -> EngagementOpportunitiesResponse:
        """Return posts the user should engage with and suggested comments."""
        industry = await asyncio.to_thread(self._resolve_industry, user_id)

        articles = await self._search_posts(industry, user_id)
        if not articles:
            return EngagementOpportunitiesResponse(
                opportunities=[],
                data_source_summary="No content found in your industry. Connect your LinkedIn account for personalized engagement suggestions.",
                generated_at=datetime.now(timezone.utc),
            )

        opportunities = await self._llm_generate_opportunities(industry, articles, user_id)
        data_source_summary = (
            f"Based on {len(articles)} recent articles in {industry} "
            f"+ AI analysis of engagement opportunities"
        )

        return EngagementOpportunitiesResponse(
            opportunities=opportunities,
            data_source_summary=data_source_summary,
            generated_at=datetime.now(timezone.utc),
        )
