"""
Exa Content Research Provider (Legacy Wrapper)

DEPRECATED — New code should import ExaResearchProvider directly from
services.research.exa_research_provider.

This module wraps the canonical ExaResearchProvider for backward compatibility.
All methods delegate to the underlying provider. get_exa_content_provider()
returns an instance that growth services and watchdog can use unchanged.
"""

import os
from typing import List, Dict, Any, Optional
from loguru import logger

from services.research.exa_research_provider import ExaResearchProvider


class ExaContentResearchProvider:
    """DEPRECATED — Wraps ExaResearchProvider for backward compatibility."""

    def __init__(self, provider: Optional[ExaResearchProvider] = None):
        self._provider = provider or ExaResearchProvider()

    async def simple_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        return await self._provider.simple_search(
            query=query,
            num_results=num_results,
            user_id=user_id,
            include_domains=include_domains,
            exclude_domains=exclude_domains,
        )

    async def news_search(
        self,
        query: str,
        num_results: int = 10,
        user_id: str = None,
        start_published_date: str = None,
        include_domains: List[str] = None,
        exclude_domains: List[str] = None,
    ) -> List[Dict[str, Any]]:
        return await self._provider.news_search(
            query=query,
            num_results=num_results,
            user_id=user_id,
            start_published_date=start_published_date,
            include_domains=include_domains,
            exclude_domains=exclude_domains,
        )

    async def company_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        return await self._provider.company_search(
            query=query,
            num_results=num_results,
            user_id=user_id,
        )

    async def people_search(
        self,
        query: str,
        num_results: int = 5,
        user_id: str = None,
    ) -> List[Dict[str, Any]]:
        return await self._provider.people_search(
            query=query,
            num_results=num_results,
            user_id=user_id,
        )

    def track_usage(self, user_id: str, cost: float):
        self._provider.track_usage(user_id, cost)


# Global singleton accessor — unchanged signature, returns upgraded provider
_exa_content_provider: Optional[ExaContentResearchProvider] = None


def get_exa_content_provider() -> ExaContentResearchProvider:
    """Get or create the global Exa content research provider instance."""
    global _exa_content_provider
    if _exa_content_provider is None:
        _exa_content_provider = ExaContentResearchProvider()
    return _exa_content_provider
