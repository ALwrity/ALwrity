import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List
from loguru import logger

from models.linkedin_growth_models import DailyPostIdea, WeeklyStrategyResponse
from .cache import growth_cache
from .circuit_breaker import protected_llm_call


class WeeklyStrategyService:
    """Generates a weekly content strategy brief."""

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

    def _week_start(self) -> str:
        """Return Monday of the current week as ISO date."""
        today = datetime.now(timezone.utc)
        monday = today - timedelta(days=today.weekday())
        return monday.strftime("%Y-%m-%d")

    async def _search_content(self, industry: str, title: str, user_id: str) -> List[Dict[str, Any]]:
        provider = self._get_exa_provider()
        if not provider:
            return []

        queries = [
            f"LinkedIn content strategy {industry} {title}",
            f"trending LinkedIn posts {industry} this week",
        ]
        all_results: List[Dict[str, Any]] = []
        for query in queries:
            cache_key = growth_cache.exa_key(query, 5, user_id)
            cached = growth_cache.get(cache_key)
            if cached is not None:
                logger.info("[WeeklyStrategy] Exa cache hit for '{}'", query[:50])
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
                logger.warning("[WeeklyStrategy] Exa search failed: {}", exc)
        return all_results

    async def _llm_generate_strategy(
        self,
        industry: str,
        title: str,
        articles: List[Dict[str, Any]],
        user_id: str,
    ) -> WeeklyStrategyResponse | None:
        from services.llm_providers.main_text_generation import llm_text_gen

        articles_text = ""
        for i, a in enumerate(articles[:8], 1):
            s = (a.get("text") or a.get("snippet") or "")[:200]
            articles_text += f'{i}. "{a.get("title", "Untitled")}"\n   {s}\n\n'

        system_prompt = (
            "You are a LinkedIn content strategist. Create a weekly content strategy "
            "for a professional in the given industry.\n\n"
            "For each weekday (Monday-Friday) provide:\n"
            "- day: the day name\n"
            "- content_type: type of post (e.g. How-to, Case study, Hot take, "
            "Personal story, Roundup, Thought leadership, Tutorial)\n"
            "- headline: a catchy, clickable headline\n"
            "- hook: the opening line to grab attention\n"
            "- why_this_works: 1 sentence on why this will perform well\n"
            "- data_source_detail: what data this is based on\n"
            "- confidence: high/medium/low\n\n"
            "Also provide:\n"
            "- theme: overarching weekly theme (3-5 words)\n"
            "- key_topics: 3-5 key topics to cover this week\n"
            "- focus_area: the primary focus (e.g. Authority building, "
            "Thought leadership, Community engagement)\n\n"
            "Output ONLY valid JSON. Make it specific and actionable."
        )

        prompt = (
            f"Industry: {industry}\n"
            f"Role: {title}\n"
            f"Week starting: {self._week_start()}\n\n"
            f"Recent trends:\n{articles_text}\n\n"
            "Create a weekly LinkedIn content strategy. Return JSON with "
            "'theme' (string), 'daily_posts' (array of 5 items for Mon-Fri), "
            "'key_topics' (array of 3-5 strings), and 'focus_area' (string)."
        )

        json_schema = {
            "type": "object",
            "properties": {
                "theme": {"type": "string"},
                "daily_posts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "day": {"type": "string"},
                            "content_type": {"type": "string"},
                            "headline": {"type": "string"},
                            "hook": {"type": "string"},
                            "why_this_works": {"type": "string"},
                            "data_source_detail": {"type": "string"},
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                        },
                        "required": [
                            "day",
                            "content_type",
                            "headline",
                            "hook",
                            "why_this_works",
                            "data_source_detail",
                            "confidence",
                        ],
                    },
                },
                "key_topics": {
                    "type": "array",
                    "items": {"type": "string"},
                },
                "focus_area": {"type": "string"},
            },
            "required": ["theme", "daily_posts", "key_topics", "focus_area"],
        }

        llm_cache_key = growth_cache.llm_key(prompt[:200] + str(json_schema), user_id)
        cached_llm = growth_cache.get(llm_cache_key)
        if cached_llm is not None:
            logger.info("[WeeklyStrategy] LLM cache hit")
            return cached_llm

        try:
            raw = await protected_llm_call(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                json_struct=json_schema,
                user_id=user_id,
            )
            if isinstance(raw, dict) and "daily_posts" in raw:
                result = WeeklyStrategyResponse(
                    theme=raw.get("theme", ""),
                    week_of=self._week_start(),
                    daily_posts=[DailyPostIdea(**p) for p in raw["daily_posts"]],
                    key_topics=raw.get("key_topics", []),
                    focus_area=raw.get("focus_area", ""),
                    data_source_summary=(
                        f"Based on your LinkedIn profile ({title} in {industry}) "
                        f"+ recent content trends"
                    ),
                    generated_at=datetime.now(timezone.utc),
                )
                growth_cache.set(llm_cache_key, result, ttl_seconds=3600)
                return result
            logger.warning("[WeeklyStrategy] LLM returned unexpected shape: {}", type(raw))
            return None
        except Exception as exc:
            logger.error("[WeeklyStrategy] LLM generation failed: {}", exc)
            return None

    async def generate(
        self,
        user_id: str,
    ) -> WeeklyStrategyResponse:
        industry, title = await asyncio.to_thread(self._resolve_industry_and_title, user_id)
        articles = await self._search_content(industry, title, user_id)

        result = await self._llm_generate_strategy(industry, title, articles, user_id)
        if result is not None:
            return result

        raise RuntimeError("LLM strategy generation returned no result")
