"""
Canonical Exa Research Provider

Feature-rich Exa API provider used by Blog Writer, LinkedIn Writer, and
all LinkedIn growth/watchdog services. Combines deep research (config-driven),
lightweight simple_search for fact-checking, and vertical searches
(news, company, people).

Deprecation path: ExaContentResearchProvider in exa_content_research.py
now wraps this class. New code should import ExaResearchProvider directly.
"""

import os
import asyncio
from datetime import datetime
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional
from loguru import logger
from exa_py import Exa
from models.subscription_models import APIProvider
from fastapi import HTTPException


class ExaResearchProvider:
    """Canonical Exa neural search provider for all ALwrity content tools."""

    def __init__(self):
        self.api_key = os.getenv("EXA_API_KEY")
        if not self.api_key:
            raise RuntimeError("EXA_API_KEY not configured")
        self.exa = Exa(self.api_key)
        logger.info("ExaResearchProvider initialized")

    # ═══════════════════════════════════════════════════════════════
    # Public: Deep research (config-driven, blog-writer-style)
    # ═══════════════════════════════════════════════════════════════

    async def search(
        self,
        prompt: str,
        topic: str,
        industry: str,
        target_audience: str,
        config: Any,
        user_id: str,
    ) -> Dict[str, Any]:
        """Execute Exa neural search with full ResearchConfig and return standardized results."""
        query = f"{topic} {industry} {target_audience}"
        category = (
            config.exa_category
            if config.exa_category
            else self._map_source_type_to_category(config.source_types)
        )

        num_results = (
            config.exa_num_results
            if hasattr(config, "exa_num_results") and config.exa_num_results
            else min(config.max_sources, 25)
        )
        num_results = min(num_results, 100)

        search_kwargs: Dict[str, Any] = {
            "type": config.exa_search_type or "auto",
            "num_results": num_results,
        }

        if category:
            search_kwargs["category"] = category
        if config.exa_include_domains:
            search_kwargs["include_domains"] = config.exa_include_domains
        if config.exa_exclude_domains:
            search_kwargs["exclude_domains"] = config.exa_exclude_domains
        if hasattr(config, "exa_date_filter") and config.exa_date_filter:
            search_kwargs["start_published_date"] = config.exa_date_filter
        if hasattr(config, "exa_end_published_date") and config.exa_end_published_date:
            search_kwargs["end_published_date"] = config.exa_end_published_date
        if hasattr(config, "exa_start_crawl_date") and config.exa_start_crawl_date:
            search_kwargs["start_crawl_date"] = config.exa_start_crawl_date
        if hasattr(config, "exa_end_crawl_date") and config.exa_end_crawl_date:
            search_kwargs["end_crawl_date"] = config.exa_end_crawl_date
        if hasattr(config, "exa_context") and config.exa_context:
            if (
                hasattr(config, "exa_context_max_characters")
                and config.exa_context_max_characters
            ):
                search_kwargs["context"] = {
                    "maxCharacters": config.exa_context_max_characters
                }
            else:
                search_kwargs["context"] = True
        if hasattr(config, "exa_include_text") and config.exa_include_text:
            search_kwargs["include_text"] = config.exa_include_text
        if hasattr(config, "exa_exclude_text") and config.exa_exclude_text:
            search_kwargs["exclude_text"] = config.exa_exclude_text

        logger.info(f"[ExaResearch] Executing search: {query}")

        text_params = {"max_characters": getattr(config, "exa_text_max_characters", None) or 1000}
        summary_query = getattr(config, "exa_summary_query", None) or f"Key insights about {topic}"
        highlights_params = {}
        if getattr(config, "exa_highlights", None):
            highlights_params["num_sentences"] = (
                getattr(config, "exa_highlights_num_sentences", None) or 2
            )
            highlights_params["highlights_per_url"] = (
                getattr(config, "exa_highlights_per_url", None) or 3
            )

        try:
            results = self.exa.search_and_contents(
                query,
                text=text_params,
                summary={"query": summary_query},
                highlights=highlights_params or None,
                type=config.exa_search_type or "auto",
                num_results=num_results,
                **search_kwargs,
            )
        except Exception as e:
            logger.error(f"[ExaResearch] API call failed: {e}")
            try:
                logger.info("[ExaResearch] Retrying with simplified parameters")
                results = self.exa.search_and_contents(
                    query,
                    type=config.exa_search_type or "auto",
                    num_results=num_results,
                    **search_kwargs,
                )
            except Exception as retry_error:
                logger.error(f"[ExaResearch] Retry also failed: {retry_error}")
                raise RuntimeError(f"Exa search failed: {str(retry_error)}") from retry_error

        sources = self._transform_sources(results.results)
        content = self._aggregate_content(results.results)
        search_type = (
            getattr(results, "resolvedSearchType", "neural")
            if hasattr(results, "resolvedSearchType")
            else "neural"
        )

        cost = 0.005
        if hasattr(results, "costDollars"):
            if hasattr(results.costDollars, "total"):
                cost = results.costDollars.total

        logger.info(f"[ExaResearch] Search completed: {len(sources)} sources, type: {search_type}")
        return {
            "sources": sources,
            "content": content,
            "search_type": search_type,
            "provider": "exa",
            "search_queries": [query],
            "cost": {"total": cost},
        }

    # ═══════════════════════════════════════════════════════════════
    # Public: Simple search (lightweight, for fact-checking / content gen)
    # ═══════════════════════════════════════════════════════════════

    async def simple_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Lightweight Exa search for fact-checking, content research, and writing assistance.
        Includes subscription preflight check and usage tracking.
        """
        self._preflight_check(user_id)

        search_kwargs: Dict[str, Any] = {
            "type": "auto",
            "num_results": num_results,
            "text": {"max_characters": 1000},
            "highlights": {"num_sentences": 2, "highlights_per_url": 2},
        }
        if include_domains:
            search_kwargs["include_domains"] = include_domains
        if exclude_domains:
            search_kwargs["exclude_domains"] = exclude_domains

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.exa.search_and_contents(query, **search_kwargs),
            )
        except Exception as e:
            logger.error(f"[Exa simple_search] API call failed: {e}")
            retry_kwargs: Dict[str, Any] = {
                "type": "auto",
                "num_results": num_results,
                "text": True,
            }
            if include_domains:
                retry_kwargs["include_domains"] = include_domains
            if exclude_domains:
                retry_kwargs["exclude_domains"] = exclude_domains
            try:
                logger.info("[Exa simple_search] Retrying with simplified parameters")
                results = await loop.run_in_executor(
                    None,
                    lambda: self.exa.search_and_contents(query, **retry_kwargs),
                )
            except Exception as retry_error:
                logger.error(f"[Exa simple_search] Retry also failed: {retry_error}")
                raise RuntimeError(f"Exa search failed: {str(retry_error)}") from retry_error

        sources = []
        for result in results.results:
            highlights = getattr(result, "highlights", [])
            sources.append({
                "title": getattr(result, "title", "Untitled"),
                "url": getattr(result, "url", ""),
                "text": getattr(result, "text", ""),
                "publishedDate": getattr(result, "publishedDate", ""),
                "author": getattr(result, "author", ""),
                "score": (lambda v: v if v is not None else 0.5)(
                    getattr(result, "score", 0.5)
                ),
                "highlights": highlights if isinstance(highlights, list) else [],
                "summary": getattr(result, "summary", ""),
            })

        if user_id:
            self.track_usage(user_id, 0.005)

        logger.info(f"[Exa simple_search] Found {len(sources)} sources for: {query[:80]}...")
        return sources

    # ═══════════════════════════════════════════════════════════════
    # Public: Vertical searches (news, company, people)
    # ═══════════════════════════════════════════════════════════════

    async def news_search(
        self,
        query: str,
        num_results: int = 10,
        user_id: str = None,
        start_published_date: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        """Exa news-style search with recency filtering."""
        self._preflight_check(user_id)

        search_kwargs: Dict[str, Any] = {
            "type": "auto",
            "num_results": num_results,
            "text": {"max_characters": 1000},
            "highlights": {"num_sentences": 3, "highlights_per_url": 2},
        }
        if start_published_date:
            search_kwargs["start_published_date"] = start_published_date
        if include_domains:
            search_kwargs["include_domains"] = include_domains
        if exclude_domains:
            search_kwargs["exclude_domains"] = exclude_domains

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.exa.search_and_contents(query, **search_kwargs),
            )
        except Exception as e:
            logger.error(f"[Exa news_search] API call failed: {e}")
            retry_kwargs: Dict[str, Any] = {
                "type": "auto",
                "num_results": num_results,
                "text": True,
            }
            if start_published_date:
                retry_kwargs["start_published_date"] = start_published_date
            if include_domains:
                retry_kwargs["include_domains"] = include_domains
            if exclude_domains:
                retry_kwargs["exclude_domains"] = exclude_domains
            try:
                logger.info("[Exa news_search] Retrying with simplified parameters")
                results = await loop.run_in_executor(
                    None,
                    lambda: self.exa.search_and_contents(query, **retry_kwargs),
                )
            except Exception as retry_error:
                logger.error(f"[Exa news_search] Retry also failed: {retry_error}")
                raise RuntimeError(f"Exa news search failed: {str(retry_error)}") from retry_error

        sources = []
        for result in results.results:
            sources.append({
                "title": getattr(result, "title", "Untitled"),
                "url": getattr(result, "url", ""),
                "text": getattr(result, "text", ""),
                "publishedDate": getattr(result, "publishedDate", ""),
                "author": getattr(result, "author", ""),
                "score": (lambda v: v if v is not None else 0.5)(
                    getattr(result, "score", 0.5)
                ),
            })

        if user_id:
            self.track_usage(user_id, 0.005)
        logger.info(f"[Exa news_search] Found {len(sources)} sources for: {query[:80]}...")
        return sources

    async def company_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        """Exa company vertical search (50M+ company pages with structured metadata)."""
        self._preflight_check(user_id)

        search_kwargs: Dict[str, Any] = {
            "category": "company",
            "type": "auto",
            "num_results": num_results,
            "text": {"max_characters": 1000},
            "highlights": {"num_sentences": 2, "highlights_per_url": 2},
        }

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.exa.search_and_contents(query, **search_kwargs),
            )
        except Exception as e:
            logger.error(f"[Exa company_search] API call failed: {e}")
            retry_kwargs: Dict[str, Any] = {
                "category": "company",
                "type": "auto",
                "num_results": num_results,
                "text": True,
            }
            try:
                logger.info("[Exa company_search] Retrying with simplified parameters")
                results = await loop.run_in_executor(
                    None,
                    lambda: self.exa.search_and_contents(query, **retry_kwargs),
                )
            except Exception as retry_error:
                logger.error(f"[Exa company_search] Retry also failed: {retry_error}")
                raise RuntimeError(f"Exa company search failed: {str(retry_error)}") from retry_error

        sources = []
        for result in results.results:
            entry = {
                "title": getattr(result, "title", "Untitled"),
                "url": getattr(result, "url", ""),
                "text": getattr(result, "text", ""),
                "publishedDate": getattr(result, "publishedDate", ""),
                "author": getattr(result, "author", ""),
                "score": (lambda v: v if v is not None else 0.5)(
                    getattr(result, "score", 0.5)
                ),
            }
            entities = getattr(result, "entities", None)
            if entities:
                entry["entities"] = [
                    {
                        "id": e.id,
                        "type": e.type,
                        "properties": {
                            k: v for k, v in e.properties.items() if v is not None
                        }
                        if e.properties
                        else {},
                    }
                    for e in entities
                ]
            sources.append(entry)

        if user_id:
            self.track_usage(user_id, 0.005)
        logger.info(f"[Exa company_search] Found {len(sources)} sources for: {query[:80]}...")
        return sources

    async def people_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        """Exa people vertical search (1B+ professional profiles with structured metadata)."""
        self._preflight_check(user_id)

        search_kwargs: Dict[str, Any] = {
            "category": "people",
            "type": "auto",
            "num_results": num_results,
            "text": {"max_characters": 1000},
            "highlights": {"num_sentences": 2, "highlights_per_url": 2},
        }

        try:
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                lambda: self.exa.search_and_contents(query, **search_kwargs),
            )
        except Exception as e:
            logger.error(f"[Exa people_search] API call failed: {e}")
            retry_kwargs: Dict[str, Any] = {
                "category": "people",
                "type": "auto",
                "num_results": num_results,
                "text": True,
            }
            try:
                logger.info("[Exa people_search] Retrying with simplified parameters")
                results = await loop.run_in_executor(
                    None,
                    lambda: self.exa.search_and_contents(query, **retry_kwargs),
                )
            except Exception as retry_error:
                logger.error(f"[Exa people_search] Retry also failed: {retry_error}")
                raise RuntimeError(f"Exa people search failed: {str(retry_error)}") from retry_error

        sources = []
        for result in results.results:
            entry = {
                "title": getattr(result, "title", "Untitled"),
                "url": getattr(result, "url", ""),
                "text": getattr(result, "text", ""),
                "publishedDate": getattr(result, "publishedDate", ""),
                "author": getattr(result, "author", ""),
                "score": (lambda v: v if v is not None else 0.5)(
                    getattr(result, "score", 0.5)
                ),
            }
            entities = getattr(result, "entities", None)
            if entities:
                entry["entities"] = [
                    {
                        "id": e.id,
                        "type": e.type,
                        "properties": {
                            k: v for k, v in e.properties.items() if v is not None
                        }
                        if e.properties
                        else {},
                    }
                    for e in entities
                ]
            sources.append(entry)

        if user_id:
            self.track_usage(user_id, 0.005)
        logger.info(f"[Exa people_search] Found {len(sources)} sources for: {query[:80]}...")
        return sources

    # ═══════════════════════════════════════════════════════════════
    # Usage tracking
    # ═══════════════════════════════════════════════════════════════

    def track_usage(self, user_id: str, cost: float):
        """Track Exa API usage after successful call."""
        from services.database import get_session_for_user
        from services.subscription import PricingService
        from sqlalchemy import text

        db = get_session_for_user(user_id)
        if not db:
            logger.warning(f"[track_usage] Could not get DB session for user {user_id}")
            return
        try:
            pricing_service = PricingService(db)
            current_period = pricing_service.get_current_billing_period(user_id)

            update_query = text("""
                UPDATE usage_summaries
                SET exa_calls = COALESCE(exa_calls, 0) + 1,
                    exa_cost = COALESCE(exa_cost, 0) + :cost,
                    total_calls = total_calls + 1,
                    total_cost = total_cost + :cost
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db.execute(
                update_query,
                {"cost": cost, "user_id": user_id, "period": current_period},
            )
            db.commit()
            logger.info(f"[Exa] Tracked usage: user={user_id}, cost=${cost}")
        except Exception as e:
            logger.error(f"[Exa] Failed to track usage: {e}")
            db.rollback()
        finally:
            db.close()

    # ═══════════════════════════════════════════════════════════════
    # Internal helpers
    # ═══════════════════════════════════════════════════════════════

    def _preflight_check(self, user_id: Optional[str]):
        """Subscription preflight check. Raises HTTPException(429) if over limit."""
        if not user_id:
            return
        from services.subscription import PricingService
        from services.database import get_session_for_user

        db = get_session_for_user(user_id)
        if not db:
            return
        try:
            pricing_service = PricingService(db)
            can_proceed, message, usage_info = pricing_service.check_usage_limits(
                user_id=user_id,
                provider=APIProvider.EXA,
                tokens_requested=0,
                actual_provider_name="exa",
            )
            if not can_proceed:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "insufficient_balance",
                        "message": message,
                        "provider": "exa",
                        "usage_info": usage_info or {},
                    },
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[Exa preflight] Check failed: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

    def _map_source_type_to_category(self, source_types) -> Optional[str]:
        """Map SourceType enum to Exa category parameter."""
        if not source_types:
            return None
        category_map = {
            "research paper": "research paper",
            "news": "news",
            "web": "personal site",
            "industry": "company",
            "expert": "linkedin profile",
        }
        for st in source_types:
            if st.value in category_map:
                return category_map[st.value]
        return None

    def _calculate_credibility_score(self, result) -> float:
        """Dynamic credibility score based on domain authority, recency, and substance."""
        scores = []
        weights = []

        url = getattr(result, "url", "")
        domain_score = self._score_domain_authority(url)
        scores.append(domain_score)
        weights.append(3)

        recency_score = self._score_recency(result)
        scores.append(recency_score)
        weights.append(2)

        substance_score = self._score_substance(result)
        scores.append(substance_score)
        weights.append(2)

        exa_score = 0.5
        if hasattr(result, "score") and result.score is not None:
            exa_score = float(result.score)
        scores.append(exa_score)
        weights.append(2)

        total = sum(s * w for s, w in zip(scores, weights))
        total_weight = sum(weights)
        return round(total / total_weight, 3)

    @staticmethod
    def _score_domain_authority(url: str) -> float:
        if not url:
            return 0.5
        try:
            domain = urlparse(url).netloc.lower()
        except Exception:
            return 0.5
        if domain.startswith("www."):
            domain = domain[4:]

        if domain.endswith(".gov") or domain.endswith(".edu"):
            return 0.95
        tier1 = {
            "arxiv.org",
            "pubmed.ncbi.nlm.nih.gov",
            "ncbi.nlm.nih.gov",
            "scholar.google.com",
            "researchgate.net",
            "sciencedaily.com",
            "nature.com",
            "science.org",
            "pnas.org",
        }
        if domain in tier1:
            return 0.92

        tier2 = {
            "reuters.com",
            "apnews.com",
            "bbc.com",
            "bbc.co.uk",
            "npr.org",
            "wsj.com",
            "nytimes.com",
            "economist.com",
            "bloomberg.com",
            "theguardian.com",
            "ft.com",
            "washingtonpost.com",
            "forbes.com",
            "hbr.org",
            "techcrunch.com",
            "wired.com",
            "cnn.com",
            "nbcnews.com",
            "cbsnews.com",
            "abcnews.go.com",
        }
        parts = domain.split(".")
        base = ".".join(parts[-2:]) if len(parts) >= 2 else domain
        if base in tier2:
            return 0.88

        tier3 = {
            "statista.com",
            "pewresearch.org",
            "gartner.com",
            "mckinsey.com",
            "deloitte.com",
            "pwc.com",
            "ey.com",
            "kpmg.com",
            "hubspot.com",
            "moz.com",
            "searchengineland.com",
            "neilpatel.com",
            "backlinko.com",
            "copyblogger.com",
        }
        if base in tier3:
            return 0.80
        if domain.endswith(".org"):
            return 0.75
        return 0.60

    def _score_recency(self, result) -> float:
        if not hasattr(result, "publishedDate") or not result.publishedDate:
            return 0.70
        try:
            published = datetime.strptime(result.publishedDate[:10], "%Y-%m-%d")
            days_old = (datetime.now() - published).days
            if days_old < 30:
                return 1.0
            elif days_old < 180:
                return 0.90
            elif days_old < 365:
                return 0.80
            elif days_old < 730:
                return 0.65
            elif days_old < 1825:
                return 0.45
            else:
                return 0.25
        except Exception:
            return 0.70

    def _score_substance(self, result) -> float:
        total_chars = 0
        if hasattr(result, "highlights") and result.highlights:
            total_chars += sum(len(h or "") for h in result.highlights)
        if hasattr(result, "summary") and result.summary:
            total_chars += len(result.summary)
        if hasattr(result, "text") and result.text:
            total_chars += len(result.text)

        if total_chars > 2000:
            return 0.95
        elif total_chars > 1000:
            return 0.85
        elif total_chars > 500:
            return 0.75
        elif total_chars > 100:
            return 0.60
        return 0.40

    def _transform_sources(self, results) -> List[Dict[str, Any]]:
        """Transform Exa results to ResearchSource-compatible format with credibility scoring."""
        sources = []
        for idx, result in enumerate(results):
            source_type = self._determine_source_type(
                getattr(result, "url", "")
            )
            sources.append({
                "title": getattr(result, "title", ""),
                "url": getattr(result, "url", ""),
                "excerpt": self._get_excerpt(result),
                "credibility_score": self._calculate_credibility_score(result),
                "published_at": getattr(result, "publishedDate", None),
                "index": idx,
                "source_type": source_type,
                "content": getattr(result, "text", ""),
                "highlights": getattr(result, "highlights", []),
                "summary": getattr(result, "summary", ""),
                "image": getattr(result, "image", None),
                "author": getattr(result, "author", None),
            })
        return sources

    @staticmethod
    def _get_excerpt(result) -> str:
        """Extract excerpt preferring highlights, then summary, then text."""
        if hasattr(result, "highlights") and result.highlights and len(result.highlights) > 0:
            return result.highlights[0]
        if hasattr(result, "summary") and result.summary:
            return result.summary
        if hasattr(result, "text") and result.text:
            return result.text[:1000]
        return ""

    @staticmethod
    def _determine_source_type(url: str) -> str:
        if not url:
            return "web"
        url_lower = url.lower()
        if "arxiv.org" in url_lower or "research" in url_lower:
            return "academic"
        elif any(
            news in url_lower
            for news in ["cnn.com", "bbc.com", "reuters.com", "theguardian.com"]
        ):
            return "news"
        elif "linkedin.com" in url_lower:
            return "expert"
        else:
            return "web"

    def _aggregate_content(self, results) -> str:
        """Aggregate content from Exa results for LLM analysis, including highlights."""
        content_parts = []
        for idx, result in enumerate(results):
            part = [
                f"Source {idx + 1}: {getattr(result, 'title', 'Untitled')}"
            ]
            if hasattr(result, "url") and result.url:
                part.append(f"URL: {result.url}")
            if hasattr(result, "highlights") and result.highlights:
                highlights_text = "\n".join(f"- {h}" for h in result.highlights)
                part.append(f"Key Highlights:\n{highlights_text}")
            if hasattr(result, "summary") and result.summary:
                part.append(f"Summary: {result.summary}")
            elif hasattr(result, "text") and result.text:
                part.append(f"Excerpt: {result.text[:1000]}")
            content_parts.append("\n".join(part))
        return "\n\n---\n\n".join(content_parts)

    def get_provider_enum(self):
        """Return EXA provider enum for subscription tracking."""
        return APIProvider.EXA

    def estimate_tokens(self) -> int:
        """Exa is per-search, not token-based."""
        return 0
