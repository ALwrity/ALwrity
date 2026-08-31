"""Tavily-backed TrendProvider.

Reuses the existing ``TavilyService`` research infrastructure. Each platform
maps to a tailored Tavily news/web search (domains, query suffix, images) so
web, YouTube, podcast, news, images, and shopping trends surface the right
kind of results.
"""
from __future__ import annotations

from typing import List, Optional

from loguru import logger

from services.research.tavily_service import TavilyService
from services.research.trends.trend_provider import TrendItem, TrendPlatform, TrendProvider

# Query suffix appended to each keyword to bias toward the platform.
_PLATFORM_SUFFIX: dict = {
    TrendPlatform.WEB: "",
    TrendPlatform.NEWS: "",
    TrendPlatform.YOUTUBE: " youtube",
    TrendPlatform.PODCAST: " podcast",
    TrendPlatform.SHOPPING: " best",
    TrendPlatform.IMAGES: "",
}

# Domain targeting for platforms that live on a specific site.
_PLATFORM_DOMAINS: dict = {
    TrendPlatform.YOUTUBE: ["youtube.com"],
}

# Use the news topic for platforms where recency matters most.
_NEWS_PLATFORMS = {
    TrendPlatform.WEB,
    TrendPlatform.NEWS,
    TrendPlatform.YOUTUBE,
    TrendPlatform.PODCAST,
}

# Cap the number of Tavily searches per fetch (inexpensive but bounded).
_MAX_QUERIES = 3


class TavilyTrendProvider(TrendProvider):
    """Trend surfacing backed by Tavily search."""

    def __init__(self, service: Optional[TavilyService] = None):
        self.service = service or TavilyService()

    @property
    def available(self) -> bool:
        return bool(
            getattr(self.service, "enabled", False)
            and getattr(self.service, "api_key", None)
        )

    async def fetch_trends(
        self,
        platform: TrendPlatform,
        industry: str = "",
        keywords: Optional[List[str]] = None,
        max_results: int = 10,
        user_id: Optional[str] = None,
    ) -> List[TrendItem]:
        if not self.available:
            logger.warning(
                "TavilyTrendProvider: TAVILY_API_KEY not configured; returning no trends"
            )
            return []

        queries = self._build_queries(platform, industry, keywords)
        items: List[TrendItem] = []
        for query in queries[:_MAX_QUERIES]:
            result = await self.service.search(
                query=query,
                topic="news" if platform in _NEWS_PLATFORMS else "general",
                search_depth="basic",
                max_results=max_results,
                include_domains=_PLATFORM_DOMAINS.get(platform),
                time_range="week" if platform in _NEWS_PLATFORMS else None,
                include_images=(platform == TrendPlatform.IMAGES),
            )
            if result.get("success"):
                items.extend(self._to_items(result, platform))
        return self._dedupe(items)

    def _build_queries(self, platform: TrendPlatform, industry: str, keywords: Optional[List[str]]) -> List[str]:
        suffix = _PLATFORM_SUFFIX.get(platform, "")
        terms = [k.strip() for k in (keywords or []) if k and k.strip()]
        if not terms:
            terms = [industry.strip()] if industry and industry.strip() else ["trending topics"]

        queries = [f"{term}{suffix} trends" for term in terms]
        if industry and industry.strip() and industry.strip() not in terms:
            queries.insert(0, f"{industry} {platform.value} trends")
        return queries

    def _to_items(self, result: dict, platform: TrendPlatform) -> List[TrendItem]:
        items: List[TrendItem] = []
        for raw in result.get("results", []):
            title = (raw.get("title") or "").strip()
            if not title:
                continue
            try:
                score = float(raw.get("score") or raw.get("relevance_score") or 0.0)
            except (TypeError, ValueError):
                score = 0.0
            items.append(
                TrendItem(
                    topic=title,
                    title=title,
                    url=raw.get("url") or "",
                    domain=raw.get("domain") or "",
                    published_date=raw.get("published_date"),
                    score=score,
                    snippet=(raw.get("content") or "").strip(),
                    platform=platform.value,
                )
            )
        return items

    @staticmethod
    def _dedupe(items: List[TrendItem]) -> List[TrendItem]:
        seen = set()
        unique: List[TrendItem] = []
        for item in items:
            key = (item.url or item.title).lower()
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        unique.sort(key=lambda i: i.score, reverse=True)
        return unique
