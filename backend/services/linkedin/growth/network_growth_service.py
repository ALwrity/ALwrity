import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from loguru import logger

from models.linkedin_growth_models import (
    NetworkSuggestionItem,
    NetworkSuggestionsResponse,
)
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class NetworkGrowthService:
    """Suggests people for the user to connect with on LinkedIn."""

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

    def _resolve_profile(self, user_id: str) -> Dict[str, Any]:
        """Resolve the user's profile context."""
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if not context or not isinstance(context, dict):
            raise ValueError("Could not resolve profile context")

        industry = context.get("industry", "").strip()
        if not industry:
            raise ValueError("Could not resolve user industry from profile context")

        personal = context.get("personal_information", {}) or {}
        professional = context.get("professional_information", {}) or {}
        result = {
            "industry": industry,
            "title": (professional.get("title", "") if isinstance(professional, dict) else "") or "",
            "headline": (personal.get("headline", "") if isinstance(personal, dict) else "") or "",
        }
        logger.info("[NetworkGrowth] Resolved profile: industry={} title={}", result["industry"], result["title"])
        return result

    async def _search_people(
        self, industry: str, title: str, user_id: str
    ) -> List[Dict[str, Any]]:
        """Search Exa for people-related content in this industry."""
        provider = self._get_exa_provider()
        if not provider:
            logger.warning("[NetworkGrowth] Exa provider not available")
            return []

        queries = [
            f"leading {industry} {title} professionals thought leadership",
            f"top voices in {industry} LinkedIn",
        ]
        all_results: List[Dict[str, Any]] = []
        for query in queries:
            cache_key = growth_cache.exa_key(query, 5, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                logger.info("[NetworkGrowth] Exa cache hit for '{}'", query[:50])
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
                logger.info("[NetworkGrowth] Exa returned {} results for '{}'", len(results), query[:50])
            except Exception as exc:
                logger.warning("[NetworkGrowth] Exa search failed for '{}': {}", query[:50], exc)
        return all_results

    async def _llm_generate_suggestions(
        self, industry: str, title: str, headline: str, articles: List[Dict[str, Any]], user_id: str
    ) -> List[NetworkSuggestionItem]:
        """Call LLM to generate connection suggestions from search results."""
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:8], 1):
            title_text = a.get("title", "Untitled")
            snippet = (a.get("text") or a.get("snippet") or "")[:250]
            author = a.get("author") or ""
            articles_text += f"{i}. \"{title_text}\""
            if author:
                articles_text += f" by {author}"
            articles_text += f"\n   {snippet}\n\n"

        system_prompt = (
            "You are a LinkedIn network growth strategist. "
            "Based on the user's profile and recent industry content, "
            "suggest 3 people they should connect with on LinkedIn.\n\n"
            "For each suggestion provide:\n"
            "- name: Full name\n"
            "- title: Professional title/role\n"
            "- company: Company or organization\n"
            "- why_connect: 1 sentence explaining why this connection is valuable\n"
            "- suggested_note: A personalized LinkedIn connection note (1-2 sentences, "
            "conversational, references shared interests)\n"
            "- data_source_detail: What data this suggestion is based on\n"
            "- confidence: high/medium/low\n"
            "Output ONLY valid JSON matching the schema."
        )

        prompt = (
            f"User profile:\nIndustry: {industry}\n"
            f"Title: {title}\n"
            f"Headline: {headline}\n\n"
            f"Recent industry content:\n{articles_text}\n\n"
            "Who should this user connect with? Return JSON with a 'suggestions' array "
            "of exactly 3 people."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "title": {"type": "string"},
                            "company": {"type": "string"},
                            "why_connect": {"type": "string"},
                            "suggested_note": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "name",
                            "title",
                            "company",
                            "why_connect",
                            "suggested_note",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                }
            },
            "required": ["suggestions"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[NetworkGrowth] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "suggestions" in raw:
                result = [NetworkSuggestionItem(**s) for s in raw["suggestions"]]
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[NetworkGrowth] LLM returned unexpected shape: {}", type(raw))
            return []
        except Exception as exc:
            logger.error("[NetworkGrowth] LLM generation failed: {}", exc)
            return []

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    async def get_network_suggestions(
        self,
        user_id: str,
    ) -> NetworkSuggestionsResponse:
        """Return people the user should connect with this week."""
        profile = await asyncio.to_thread(self._resolve_profile, user_id)
        industry = profile["industry"]
        title = profile["title"]
        headline = profile["headline"]

        articles = await self._search_people(industry, title, user_id)
        if not articles:
            logger.warning("[NetworkGrowth] No content found for industry '{}'", industry)
            return NetworkSuggestionsResponse(
                suggestions=[],
                data_source_summary="No LinkedIn profile or Exa data available yet. "
                "Connect your LinkedIn account to get personalized network suggestions.",
                generated_at=datetime.now(timezone.utc),
            )

        suggestions = await self._llm_generate_suggestions(industry, title, headline, articles, user_id)
        data_source_summary = (
            f"Based on your LinkedIn profile ({title} in {industry}) "
            f"+ {len(articles)} industry articles and thought leadership content"
        )

        return NetworkSuggestionsResponse(
            suggestions=suggestions,
            data_source_summary=data_source_summary,
            generated_at=datetime.now(timezone.utc),
        )
