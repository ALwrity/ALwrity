"""
Exa Research Provider (Blog Writer)

Thin wrapper around the canonical ExaResearchProvider that satisfies the
ResearchProvider ABC interface. All search logic lives in
services.research.exa_research_provider.
"""

from typing import List, Dict, Any
from loguru import logger
from models.subscription_models import APIProvider
from .base_provider import ResearchProvider as BaseProvider
from services.research.exa_research_provider import (
    ExaResearchProvider as SharedExaProvider,
)


class ExaResearchProvider(BaseProvider):
    """Exa neural search provider — delegates to the canonical shared provider."""

    def __init__(self):
        self._provider = SharedExaProvider()
        self.api_key = self._provider.api_key
        self.exa = self._provider.exa
        logger.info("Blog Writer ExaResearchProvider initialized (shared backend)")

    async def search(
        self, prompt, topic, industry, target_audience, config, user_id
    ) -> Dict[str, Any]:
        return await self._provider.search(
            prompt, topic, industry, target_audience, config, user_id
        )

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

    def track_exa_usage(self, user_id: str, cost: float):
        self._provider.track_usage(user_id, cost)

    def get_provider_enum(self):
        return APIProvider.EXA

    def estimate_tokens(self) -> int:
        return 0
