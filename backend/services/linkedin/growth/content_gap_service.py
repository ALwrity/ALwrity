import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List
from loguru import logger

from models.linkedin_growth_models import ContentGapItem, ContentGapsResponse
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class ContentGapService:
    """Analyzes content gaps — topics the user should be covering."""

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

    def _resolve_industry_and_title(self, user_id: str) -> tuple[str, str]:
        repo = self._get_profile_repo()
        context = repo.get_profile_context(user_id)
        if not context or not isinstance(context, dict):
            raise ValueError("Could not resolve profile context")

        industry = context.get("industry", "").strip()
        title = (
            context.get("professional_information", {})
            .get("title", "")
            .strip()
        ) if isinstance(context.get("professional_information"), dict) else ""
        if not industry:
            raise ValueError("Could not resolve user industry from profile context")
        return industry, title or ""

    async def _search_trends(self, industry: str, title: str, user_id: str) -> List[Dict[str, Any]]:
        provider = self._get_exa_provider()
        if not provider:
            return []

        queries = [
            f"hot topics {industry} {title} 2026",
            f"underrated LinkedIn topics {industry} professionals should post about",
        ]
        all_results: List[Dict[str, Any]] = []
        for query in queries:
            cache_key = growth_cache.exa_key(query, 5, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                logger.info("[ContentGap] Exa cache hit for '{}'", query[:50])
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
                logger.warning("[ContentGap] Exa search failed: {}", exc)
        return all_results

    async def _llm_identify_gaps(
        self,
        industry: str,
        title: str,
        articles: List[Dict[str, Any]],
        user_id: str,
    ) -> List[ContentGapItem]:
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:8], 1):
            s = (a.get("text") or a.get("snippet") or "")[:250]
            articles_text += f'{i}. "{a.get("title", "Untitled")}"\n   {s}\n\n'

        system_prompt = (
            "You are a LinkedIn content strategist specializing in gap analysis. "
            "Analyze the user's industry and role, and identify 3-4 content gaps — "
            "topics that are highly relevant to their audience but that "
            "professionals in this space commonly overlook.\n\n"
            "For each gap provide:\n"
            "- gap_topic: short topic label (e.g. 'AI/ML applications in SaaS')\n"
            "- why_gap: why professionals in this space miss this topic (1 sentence)\n"
            "- why_it_matters: why this topic matters right now (1 sentence)\n"
            "- suggested_angle: a specific post angle they could use today\n"
            "- data_source_detail: what data this is based on\n"
            "- confidence: high/medium/low\n\n"
            "Output ONLY valid JSON. Be specific and actionable."
        )

        prompt = (
            f"Industry: {industry}\n"
            f"Role: {title}\n\n"
            f"Current trends:\n{articles_text}\n\n"
            "Identify content gaps. Return JSON with a 'gaps' array of exactly 4 items."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "gaps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "gap_topic": {"type": "string"},
                            "why_gap": {"type": "string"},
                            "why_it_matters": {"type": "string"},
                            "suggested_angle": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "gap_topic",
                            "why_gap",
                            "why_it_matters",
                            "suggested_angle",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                },
            },
            "required": ["gaps"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[ContentGap] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "gaps" in raw:
                result = [ContentGapItem(**g) for g in raw["gaps"]]
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[ContentGap] LLM returned unexpected shape: {}", type(raw))
            return []
        except Exception as exc:
            logger.error("[ContentGap] LLM generation failed: {}", exc)
            return []

    async def analyze(
        self,
        user_id: str,
    ) -> ContentGapsResponse:
        industry, title = await asyncio.to_thread(self._resolve_industry_and_title, user_id)
        articles = await self._search_trends(industry, title, user_id)

        gaps = await self._llm_identify_gaps(industry, title, articles, user_id)
        data_source_summary = (
            f"Based on your LinkedIn profile ({title} in {industry}) "
            f"+ industry trend analysis"
        )

        return ContentGapsResponse(
            gaps=gaps,
            data_source_summary=data_source_summary,
            generated_at=datetime.now(timezone.utc),
        )
