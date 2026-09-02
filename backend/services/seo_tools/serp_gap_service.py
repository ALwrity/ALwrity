"""
SERP Gap Service for ALwrity

Detects which competitors rank for target topics using Google Custom Search
or the optional SerpBase API (opt-in via SERPBASE_API_KEY).
Phase 1 of the Content Gap Radar feature.

Usage:
    service = SerpGapService()
    result = await service.analyze_topic_gaps(
        topics=["AI content strategy", "topic clustering"],
        competitor_domains=["example.com", "competitor.org"]
    )
"""

import asyncio
import hashlib
import json
import os
import time
from typing import Dict, List, Optional, Any
from loguru import logger
from services.research.google_search_service import GoogleSearchService
from services.seo_tools.serpbase_service import SerpBaseService


class SerpGapService:
    """
    SERP Gap Analysis Service.

    Uses Google Custom Search `site:` queries to detect competitor ranking presence
    for specific topics. Results are cached for 24h to stay within free-tier quotas
    (100 queries/day). When SERPBASE_API_KEY is set, SerpBase is used instead of
    Google Custom Search (no 100-query/day cap, returns positions and AI Overview).
    Designed to be consumed by a future ContentGapRadarAgent
    that scores and prioritizes gaps.
    """

    CACHE_TTL = int(os.getenv("SERP_GAP_CACHE_TTL", "86400"))  # 24 hours default

    def __init__(self, google_search_service: Optional[GoogleSearchService] = None):
        self.gcs = google_search_service or GoogleSearchService()
        self.serpbase = SerpBaseService()
        self._cache: Dict[str, Dict[str, Any]] = {}
        provider = "SerpBase" if self.serpbase.enabled else "Google Custom Search"
        logger.info(f"SerpGapService initialized (provider: {provider})")

    def _cache_key(self, topics: List[str], domains: List[str]) -> str:
        """Deterministic cache key from sorted topics + domains."""
        raw = json.dumps(
            {"t": sorted(topics), "d": sorted(domains)}, sort_keys=True
        )
        return hashlib.md5(raw.encode()).hexdigest()

    def _get_cached(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._cache.get(key)
        if entry and (time.time() - entry["ts"]) < self.CACHE_TTL:
            return entry["data"]
        return None

    def _set_cache(self, key: str, data: Dict[str, Any]):
        self._cache[key] = {"data": data, "ts": time.time()}

    async def analyze_topic_gaps(
        self,
        topics: List[str],
        competitor_domains: List[str],
        max_results_per_site: int = 5,
        concurrency: int = 3,
        bypass_cache: bool = False,
    ) -> Dict[str, Any]:
        """
        Analyze SERP gaps for a list of topics across known competitors.

        For each topic, queries Google with `site:competitor_domain topic` for
        each known competitor to detect ranking presence.

        Args:
            topics: Topic phrases to check (e.g. from find_semantic_gaps())
            competitor_domains: Known competitor domains (e.g. ["example.com"])
            max_results_per_site: Max results per site: query (max 10)
            concurrency: Max concurrent API calls to stay under rate limits
            bypass_cache: Force fresh API calls, ignoring cache

        Returns:
            Dict with keys:
                gaps: List of per-topic SERP gap results
                total_topics_analyzed: int
                total_competitors: int
                cached: bool
        """
        if not topics or not competitor_domains:
            return {
                "gaps": [],
                "total_topics_analyzed": 0,
                "total_competitors": 0,
                "cached": False,
            }

        ck = self._cache_key(topics, competitor_domains)
        if not bypass_cache:
            cached = self._get_cached(ck)
            if cached:
                logger.info("Returning cached SERP gap results")
                return {**cached, "cached": True}

        semaphore = asyncio.Semaphore(concurrency)

        async def analyze_topic(topic: str) -> Dict[str, Any]:
            async with semaphore:
                return await self._analyze_single_topic(
                    topic, competitor_domains, max_results_per_site
                )

        tasks = [analyze_topic(topic) for topic in topics]
        results = await asyncio.gather(*tasks)

        output = {
            "gaps": results,
            "total_topics_analyzed": len(topics),
            "total_competitors": len(competitor_domains),
            "cached": False,
        }
        self._set_cache(ck, output)
        return dict(output)

    async def _analyze_single_topic(
        self,
        topic: str,
        competitor_domains: List[str],
        max_results: int,
    ) -> Dict[str, Any]:
        """
        Check SERP presence for a single topic across all competitor domains.

        Removes the dateRestrict and sort=date defaults from Google CSE so we
        see all-time competitor content (not just last month). A per-query
        failure (SerpBase error, CSE error, network timeout) is recorded as a
        failed query for that domain and skipped — it never aborts the batch
        (review feedback on PR #901).
        """
        competitors_found = []
        failed_queries = 0

        for domain in competitor_domains:
            query = f"site:{domain} {topic}"
            try:
                if self.serpbase.enabled:
                    raw_results = await self.serpbase.perform_search(
                        query,
                        max_results,
                    )
                else:
                    raw_results = await self.gcs.perform_search(
                        query,
                        max_results,
                        dateRestrict=None,  # Don't limit to last month
                        sort=None,  # Use relevance sorting, not date
                    )
                for result in raw_results:
                    competitors_found.append({
                        "domain": domain,
                        "title": result.get("title", ""),
                        "url": result.get("link", ""),
                        "snippet": result.get("snippet", ""),
                    })
            except Exception as e:
                logger.warning(
                    f"Search query failed for site:{domain} topic='{topic}': {e}"
                )
                failed_queries += 1
                continue

        seen_urls = set()
        unique_competitors = []
        for entry in competitors_found:
            if entry["url"] not in seen_urls:
                seen_urls.add(entry["url"])
                unique_competitors.append(entry)

        return {
            "topic": topic,
            "competitors_found": unique_competitors,
            "competitor_count": len(unique_competitors),
            "domains_with_content": list(
                set(e["domain"] for e in unique_competitors)
            ),
            "failed_queries": failed_queries,
            "total_domains_checked": len(competitor_domains),
        }
