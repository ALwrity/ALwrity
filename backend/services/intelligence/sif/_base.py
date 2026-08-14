"""SIF integration service core (shared state, lazy agents, cache helpers).

This mixin holds the instance state and the small, low-churn helpers that
every other part of :class:`SIFIntegrationService` relies on. It is split
out of ``sif_integration.py`` so the facade stays focused on orchestration.
See the facade's module docstring for the SIF failure-mode contract.
"""

from typing import Dict, Any, Optional
from loguru import logger

from services.intelligence.txtai_service import TxtaiIntelligenceService
from services.intelligence.semantic_cache import semantic_cache_manager
from services.intelligence.harvester import SemanticHarvesterService


class SIFBase:
    """Core state + lazy agent loaders + cache helpers.

    Serves as the root of ``SIFIntegrationService``'s inheritance chain.
    Only this class defines ``__init__`` so the MRO runs it exactly once.
    """

    def __init__(self, user_id: str, enable_caching: bool = True):
        self.user_id = user_id
        self.enable_caching = enable_caching
        self.cache_manager = semantic_cache_manager if enable_caching else None

        # Initialize core services with caching
        self.intelligence_service = TxtaiIntelligenceService(
            user_id=user_id,
            enable_caching=enable_caching
        )
        self.harvester = SemanticHarvesterService()

        # Initialize agents (will be created when needed to avoid circular imports)
        self.strategy_agent = None
        self.guardian_agent = None
        self.trend_surfer_agent = None

        logger.info(f"SIF Integration Service initialized for user {user_id}")

    def get_trend_surfer_agent(self):
        """Lazy load TrendSurferAgent.

        Phase 5 / Issue #12: pre-#12 this raised whatever the
        ``TrendSurferAgent`` constructor raised (txtai not
        available, LLM init failure, etc.) directly to the caller.
        That bubbled up as a 500 from every API endpoint that
        touches the agent. Now we catch construction failures,
        set ``self.trend_surfer_agent = None`` to force a retry
        on the next call, and raise a descriptive error.
        """
        if not self.trend_surfer_agent:
            try:
                from services.intelligence.agents.trend_surfer_agent import TrendSurferAgent
                self.trend_surfer_agent = TrendSurferAgent(
                    intelligence_service=self.intelligence_service,
                    user_id=self.user_id
                )
            except Exception as e:
                # Reset to None so a future call retries construction
                # (transient failures like a missing optional LLM
                # provider may resolve on the next request).
                self.trend_surfer_agent = None
                logger.error(
                    f"Failed to construct TrendSurferAgent for user {self.user_id}: {e}",
                    exc_info=True,
                )
                raise RuntimeError(
                    f"TrendSurferAgent unavailable for user {self.user_id}: {e}"
                ) from e
        return self.trend_surfer_agent

    def get_strategy_agent(self):
        """Lazy load StrategyArchitectAgent. See Issue #12.

        Same try/except pattern as ``get_trend_surfer_agent`` so
        that a single failure here does not permanently wedge the
        service: the next call retries construction.
        """
        if not self.strategy_agent:
            try:
                from services.intelligence.sif_agents import StrategyArchitectAgent
                self.strategy_agent = StrategyArchitectAgent(
                    self.intelligence_service, user_id=self.user_id
                )
            except Exception as e:
                self.strategy_agent = None
                logger.error(
                    f"Failed to construct StrategyArchitectAgent for user {self.user_id}: {e}",
                    exc_info=True,
                )
                raise RuntimeError(
                    f"StrategyArchitectAgent unavailable for user {self.user_id}: {e}"
                ) from e
        return self.strategy_agent

    def get_guardian_agent(self):
        """Lazy load ContentGuardianAgent. See Issue #12."""
        if not self.guardian_agent:
            try:
                from services.intelligence.agents.specialized import ContentGuardianAgent
                self.guardian_agent = ContentGuardianAgent(
                    self.intelligence_service,
                    user_id=self.user_id,
                    sif_service=self,
                )
            except Exception as e:
                self.guardian_agent = None
                logger.error(
                    f"Failed to construct ContentGuardianAgent for user {self.user_id}: {e}",
                    exc_info=True,
                )
                raise RuntimeError(
                    f"ContentGuardianAgent unavailable for user {self.user_id}: {e}"
                ) from e
        return self.guardian_agent

    def get_cache_performance_stats(self) -> Optional[Dict[str, Any]]:
        """Get cache performance statistics."""
        if not self.enable_caching or not self.cache_manager:
            return None

        try:
            stats = self.cache_manager.get_cache_stats()
            return {
                "hit_rate": stats.hit_rate,
                "total_hits": stats.total_hits,
                "total_misses": stats.total_misses,
                "cache_size": stats.cache_size,
                "memory_usage_mb": stats.memory_usage_mb,
                "average_hit_time_ms": stats.average_hit_time_ms,
                "total_invalidations": stats.total_invalidations
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return None

    async def invalidate_user_cache(self, reason: str = "user_request") -> bool:
        """Invalidate cache for the current user."""
        try:
            if self.enable_caching and self.cache_manager:
                self.cache_manager.invalidate_user_cache(self.user_id)
                logger.info(f"Invalidated cache for user {self.user_id}. Reason: {reason}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to invalidate user cache: {e}")
            return False
