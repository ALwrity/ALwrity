"""
Exa Content Research Provider

Shared Exa neural search provider for content research across ALwrity modules.
Provides simple_search() for fact-checking, content grounding, and research.

Used by:
- LinkedIn Writer (content generation research)
- Blog Writer (fact-checking and writing assistance)

This is the content-research variant. For competitor discovery/analysis,
use ExaService in exa_service.py.
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from loguru import logger


class ExaContentResearchProvider:
    """Exa neural search provider for content research."""
    
    def __init__(self):
        """Initialize the Exa content research provider."""
        self.api_key = os.getenv("EXA_API_KEY")
        if not self.api_key:
            raise RuntimeError("EXA_API_KEY not configured")
        
        from exa_py import Exa
        self.exa = Exa(self.api_key)
        logger.info("✅ Exa Content Research Provider initialized")
    
    async def simple_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Simple Exa search for content research and fact-checking.
        Handles subscription preflight check and usage tracking.
        
        Args:
            query: Search query string
            num_results: Number of results to return (default 5)
            user_id: Optional user ID for subscription checking
            include_domains: Only return results from these domains
            exclude_domains: Exclude results from these domains
            
        Returns:
            List of source dicts with title, url, text, publishedDate, author, score keys
            
        Raises:
            HTTPException(429): If user has exceeded subscription limits
            Exception: If Exa API key not configured or search fails
        """
        # Preflight subscription check
        if user_id:
            from models.subscription_models import APIProvider
            from services.subscription import PricingService
            from services.database import get_session_for_user
            from fastapi import HTTPException
            
            db = get_session_for_user(user_id)
            if db:
                try:
                    pricing_service = PricingService(db)
                    can_proceed, message, usage_info = pricing_service.check_usage_limits(
                        user_id=user_id,
                        provider=APIProvider.EXA,
                        tokens_requested=0,
                        actual_provider_name="exa",
                    )
                    if not can_proceed:
                        raise HTTPException(status_code=429, detail={
                            'error': 'insufficient_balance',
                            'message': message,
                            'provider': 'exa',
                            'usage_info': usage_info or {}
                        })
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"[Exa simple_search] Preflight check failed: {e}")
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

        search_kwargs = {
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
            # Retry with simpler parameters
            retry_kwargs = {"type": "auto", "num_results": num_results, "text": True}
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
            sources.append({
                'title': getattr(result, 'title', 'Untitled'),
                'url': getattr(result, 'url', ''),
                'text': getattr(result, 'text', ''),
                'publishedDate': getattr(result, 'publishedDate', ''),
                'author': getattr(result, 'author', ''),
                'score': (lambda v: v if v is not None else 0.5)(getattr(result, 'score', 0.5)),
            })
        
        # Track usage
        if user_id:
            cost = 0.005  # ~0.5 cents per search
            try:
                self.track_usage(user_id, cost)
            except Exception as e:
                logger.warning(f"[Exa simple_search] Failed to track usage: {e}")
        
        logger.info(f"[Exa simple_search] Found {len(sources)} sources for query: {query[:80]}...")
        return sources

    async def news_search(
        self,
        query: str,
        num_results: int = 10,
        user_id: str = None,
        start_published_date: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Exa news search with recency filtering.
        Searches the general web index with optional date range and domain filters.

        Args:
            query: Search query string
            num_results: Number of results to return (default 10)
            user_id: Optional user ID for subscription checking
            start_published_date: ISO 8601 date string to filter for recent articles
            include_domains: Only return results from these domains
            exclude_domains: Exclude results from these domains

        Returns:
            List of source dicts with title, url, text, publishedDate, author, score keys

        Raises:
            HTTPException(429): If user has exceeded subscription limits
            Exception: If Exa API key not configured or search fails
        """
        if user_id:
            from models.subscription_models import APIProvider
            from services.subscription import PricingService
            from services.database import get_session_for_user
            from fastapi import HTTPException

            db = get_session_for_user(user_id)
            if db:
                try:
                    pricing_service = PricingService(db)
                    can_proceed, message, usage_info = pricing_service.check_usage_limits(
                        user_id=user_id,
                        provider=APIProvider.EXA,
                        tokens_requested=0,
                        actual_provider_name="exa",
                    )
                    if not can_proceed:
                        raise HTTPException(status_code=429, detail={
                            'error': 'insufficient_balance',
                            'message': message,
                            'provider': 'exa',
                            'usage_info': usage_info or {}
                        })
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"[Exa news_search] Preflight check failed: {e}")
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

        search_kwargs = {
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
            retry_kwargs = {"type": "auto", "num_results": num_results, "text": True}
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
                'title': getattr(result, 'title', 'Untitled'),
                'url': getattr(result, 'url', ''),
                'text': getattr(result, 'text', ''),
                'publishedDate': getattr(result, 'publishedDate', ''),
                'author': getattr(result, 'author', ''),
                'score': (lambda v: v if v is not None else 0.5)(getattr(result, 'score', 0.5)),
            })

        if user_id:
            cost = 0.005
            try:
                self.track_usage(user_id, cost)
            except Exception as e:
                logger.warning(f"[Exa news_search] Failed to track usage: {e}")

        logger.info(f"[Exa news_search] Found {len(sources)} sources for query: {query[:80]}...")
        return sources

    async def company_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Exa company vertical search.
        Searches 50M+ company pages with structured metadata (industry, funding, headcount, geography).

        Args:
            query: Natural language query (e.g. "fintech companies in Switzerland")
            num_results: Number of results to return (default 5, max 100)
            user_id: Optional user ID for subscription checking

        Returns:
            List of dicts with title, url, text, publishedDate, author, score, and entities

        Raises:
            HTTPException(429): If user has exceeded subscription limits
            Exception: If Exa API key not configured or search fails
        """
        if user_id:
            from models.subscription_models import APIProvider
            from services.subscription import PricingService
            from services.database import get_session_for_user
            from fastapi import HTTPException

            db = get_session_for_user(user_id)
            if db:
                try:
                    pricing_service = PricingService(db)
                    can_proceed, message, usage_info = pricing_service.check_usage_limits(
                        user_id=user_id,
                        provider=APIProvider.EXA,
                        tokens_requested=0,
                        actual_provider_name="exa",
                    )
                    if not can_proceed:
                        raise HTTPException(status_code=429, detail={
                            'error': 'insufficient_balance',
                            'message': message,
                            'provider': 'exa',
                            'usage_info': usage_info or {}
                        })
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"[Exa company_search] Preflight check failed: {e}")
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

        search_kwargs = {
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
            retry_kwargs = {
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
                'title': getattr(result, 'title', 'Untitled'),
                'url': getattr(result, 'url', ''),
                'text': getattr(result, 'text', ''),
                'publishedDate': getattr(result, 'publishedDate', ''),
                'author': getattr(result, 'author', ''),
                'score': (lambda v: v if v is not None else 0.5)(getattr(result, 'score', 0.5)),
            }
            # Attach structured company entity metadata if available
            entities = getattr(result, 'entities', None)
            if entities:
                entry['entities'] = [
                    {
                        'id': e.id,
                        'type': e.type,
                        'properties': {
                            k: v for k, v in e.properties.items() if v is not None
                        } if e.properties else {},
                    }
                    for e in entities
                ]
            sources.append(entry)

        if user_id:
            cost = 0.005
            try:
                self.track_usage(user_id, cost)
            except Exception as e:
                logger.warning(f"[Exa company_search] Failed to track usage: {e}")

        logger.info(f"[Exa company_search] Found {len(sources)} sources for query: {query[:80]}...")
        return sources

    async def people_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        """
        Exa people vertical search.
        Searches 1B+ professional profiles with structured metadata (name, role, company, location, skills).

        Args:
            query: Natural language query (e.g. "senior ML engineers at fintech companies")
            num_results: Number of results to return (default 5, max 100)
            user_id: Optional user ID for subscription checking

        Returns:
            List of dicts with title, url, text, publishedDate, author, score, and entities (person metadata)

        Raises:
            HTTPException(429): If user has exceeded subscription limits
            Exception: If Exa API key not configured or search fails
        """
        if user_id:
            from models.subscription_models import APIProvider
            from services.subscription import PricingService
            from services.database import get_session_for_user
            from fastapi import HTTPException

            db = get_session_for_user(user_id)
            if db:
                try:
                    pricing_service = PricingService(db)
                    can_proceed, message, usage_info = pricing_service.check_usage_limits(
                        user_id=user_id,
                        provider=APIProvider.EXA,
                        tokens_requested=0,
                        actual_provider_name="exa",
                    )
                    if not can_proceed:
                        raise HTTPException(status_code=429, detail={
                            'error': 'insufficient_balance',
                            'message': message,
                            'provider': 'exa',
                            'usage_info': usage_info or {}
                        })
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"[Exa people_search] Preflight check failed: {e}")
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

        search_kwargs = {
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
            retry_kwargs = {
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
                'title': getattr(result, 'title', 'Untitled'),
                'url': getattr(result, 'url', ''),
                'text': getattr(result, 'text', ''),
                'publishedDate': getattr(result, 'publishedDate', ''),
                'author': getattr(result, 'author', ''),
                'score': (lambda v: v if v is not None else 0.5)(getattr(result, 'score', 0.5)),
            }
            entities = getattr(result, 'entities', None)
            if entities:
                entry['entities'] = [
                    {
                        'id': e.id,
                        'type': e.type,
                        'properties': {
                            k: v for k, v in e.properties.items() if v is not None
                        } if e.properties else {},
                    }
                    for e in entities
                ]
            sources.append(entry)

        if user_id:
            cost = 0.005
            try:
                self.track_usage(user_id, cost)
            except Exception as e:
                logger.warning(f"[Exa people_search] Failed to track usage: {e}")

        logger.info(f"[Exa people_search] Found {len(sources)} sources for query: {query[:80]}...")
        return sources

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
            
            # Update exa_calls and exa_cost via SQL UPDATE
            update_query = text("""
                UPDATE usage_summaries 
                SET exa_calls = COALESCE(exa_calls, 0) + 1,
                    exa_cost = COALESCE(exa_cost, 0) + :cost,
                    total_calls = total_calls + 1,
                    total_cost = total_cost + :cost
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db.execute(update_query, {
                'cost': cost,
                'user_id': user_id,
                'period': current_period
            })
            db.commit()
            
            logger.info(f"[Exa] Tracked usage: user={user_id}, cost=${cost}")
        except Exception as e:
            logger.error(f"[Exa] Failed to track usage: {e}")
            db.rollback()
        finally:
            db.close()


# Global singleton instance
_exa_content_provider: Optional[ExaContentResearchProvider] = None


def get_exa_content_provider() -> ExaContentResearchProvider:
    """Get or create the global Exa content research provider instance."""
    global _exa_content_provider
    if _exa_content_provider is None:
        _exa_content_provider = ExaContentResearchProvider()
    return _exa_content_provider
