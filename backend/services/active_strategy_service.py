"""
Active Strategy Service

Manages active content strategies with 3-tier caching for optimal performance
in content calendar generation. Ensures Phase 1 and Phase 2 use the correct
active strategy from the database.
"""

from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from loguru import logger

# Import database models
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus

class ActiveStrategyService:
    """
    Service for managing active content strategies with 3-tier caching.
    
    Tier 1: Memory cache (fastest)
    Tier 2: Database query with activation status
    Tier 3: Fallback to most recent strategy
    """
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db_session = db_session
        self._memory_cache = {}  # Tier 1: Memory cache
        self._cache_ttl = 300  # 5 minutes cache TTL
        self._last_cache_update = {}
    
    async def get_active_strategy(self, user_id: int, force_refresh: bool = False) -> Optional[Dict[str, Any]]:
        """
        Get the active content strategy for a user with 3-tier caching.
        
        Args:
            user_id: User ID
            force_refresh: Force refresh cache
            
        Returns:
            Active strategy data or None if not found
        """
        try:
            cache_key = f"active_strategy_{user_id}"
            
            # Tier 1: Memory Cache Check
            if not force_refresh and self._is_cache_valid(cache_key):
                cached_strategy = self._memory_cache.get(cache_key)
                if cached_strategy:
                    logger.debug(f"Tier 1 cache hit for user {user_id}")
                    return cached_strategy
            
            # Tier 2: Database Query with Activation Status
            active_strategy = await self._get_active_strategy_from_db(user_id)
            if active_strategy:
                # Cache the result
                self._cache_strategy(cache_key, active_strategy)
                logger.debug(f"Active strategy {active_strategy.get('id')} loaded from DB for user {user_id}")
                return active_strategy
            
            # Tier 3: Fallback to Most Recent Strategy
            fallback_strategy = await self._get_most_recent_strategy(user_id)
            if fallback_strategy:
                # Cache the fallback result
                self._cache_strategy(cache_key, fallback_strategy)
                logger.warning(f"Active strategy not found, falling back to most recent strategy {fallback_strategy.get('id')} for user {user_id}")
                return fallback_strategy
            
            logger.error(f"No strategy found for user {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting active strategy for user {user_id}: {str(e)}")
            return None
    
    async def _get_active_strategy_from_db(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get active strategy from database using activation status.
        
        Args:
            user_id: User ID
            
        Returns:
            Active strategy data or None
        """
        try:
            if not self.db_session:
                logger.warning("Database session not available")
                return None
            
            # Query for active strategy using activation status
            active_status = self.db_session.query(StrategyActivationStatus).filter(
                and_(
                    StrategyActivationStatus.user_id == user_id,
                    StrategyActivationStatus.status == 'active'
                )
            ).order_by(desc(StrategyActivationStatus.activation_date)).first()
            
            if not active_status:
                logger.debug(f"No active strategy status found for user {user_id}")
                return None
            
            # Get the strategy details
            strategy = self.db_session.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.id == active_status.strategy_id
            ).first()
            
            if not strategy:
                logger.warning(f"Active strategy {active_status.strategy_id} not found in database")
                return None
            
            # Convert to dictionary
            strategy_data = self._convert_strategy_to_dict(strategy)
            strategy_data['activation_status'] = {
                'activation_date': active_status.activation_date.isoformat() if active_status.activation_date else None,
                'performance_score': active_status.performance_score,
                'last_updated': active_status.last_updated.isoformat() if active_status.last_updated else None
            }
            
            logger.debug(f"Found active strategy {strategy.id} for user {user_id}")
            return strategy_data
            
        except Exception as e:
            logger.error(f"Error querying active strategy from database: {str(e)}")
            return None
    
    async def _get_most_recent_strategy(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get the most recent strategy as fallback.
        
        Args:
            user_id: User ID
            
        Returns:
            Most recent strategy data or None
        """
        try:
            if not self.db_session:
                logger.warning("Database session not available")
                return None
            
            # Get the most recent strategy with comprehensive AI analysis
            strategy = self.db_session.query(EnhancedContentStrategy).filter(
                and_(
                    EnhancedContentStrategy.user_id == user_id,
                    EnhancedContentStrategy.comprehensive_ai_analysis.isnot(None)
                )
            ).order_by(desc(EnhancedContentStrategy.created_at)).first()
            
            if not strategy:
                # Fallback to any strategy
                strategy = self.db_session.query(EnhancedContentStrategy).filter(
                    EnhancedContentStrategy.user_id == user_id
                ).order_by(desc(EnhancedContentStrategy.created_at)).first()
            
            if strategy:
                strategy_data = self._convert_strategy_to_dict(strategy)
                strategy_data['activation_status'] = {
                    'activation_date': None,
                    'performance_score': None,
                    'last_updated': None,
                    'note': 'Fallback to most recent strategy'
                }
                
                logger.debug(f"Found fallback strategy {strategy.id} for user {user_id}")
                return strategy_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting most recent strategy: {str(e)}")
            return None
    
    def _convert_strategy_to_dict(self, strategy: EnhancedContentStrategy) -> Dict[str, Any]:
        """
        Convert strategy model to dictionary.
        
        Args:
            strategy: EnhancedContentStrategy model
            
        Returns:
            Strategy dictionary
        """
        try:
            strategy_dict = {
                'id': strategy.id,
                'user_id': strategy.user_id,
                'name': strategy.name,
                'industry': strategy.industry,
                'target_audience': strategy.target_audience,
                'content_pillars': strategy.content_pillars,
                'business_objectives': strategy.business_objectives,
                'brand_voice': strategy.brand_voice,
                'editorial_guidelines': strategy.editorial_guidelines,
                'content_frequency': strategy.content_frequency,
                'preferred_formats': strategy.preferred_formats,
                'content_mix': strategy.content_mix,
                'competitive_analysis': strategy.competitive_analysis,
                'market_positioning': strategy.market_positioning,
                'kpi_targets': strategy.kpi_targets,
                'success_metrics': strategy.success_metrics,
                'audience_segments': strategy.audience_segments,
                'content_themes': strategy.content_themes,
                'seasonal_focus': strategy.seasonal_focus,
                'campaign_integration': strategy.campaign_integration,
                'platform_strategy': strategy.platform_strategy,
                'engagement_goals': strategy.engagement_goals,
                'conversion_objectives': strategy.conversion_objectives,
                'brand_guidelines': strategy.brand_guidelines,
                'content_standards': strategy.content_standards,
                'quality_thresholds': strategy.quality_thresholds,
                'performance_benchmarks': strategy.performance_benchmarks,
                'optimization_focus': strategy.optimization_focus,
                'trend_alignment': strategy.trend_alignment,
                'innovation_areas': strategy.innovation_areas,
                'risk_mitigation': strategy.risk_mitigation,
                'scalability_plans': strategy.scalability_plans,
                'measurement_framework': strategy.measurement_framework,
                'continuous_improvement': strategy.continuous_improvement,
                'ai_recommendations': strategy.ai_recommendations,
                'comprehensive_ai_analysis': strategy.comprehensive_ai_analysis,
                'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None,
                'completion_percentage': getattr(strategy, 'completion_percentage', 0)
            }
            
            return strategy_dict
            
        except Exception as e:
            logger.error(f"Error converting strategy to dictionary: {str(e)}")
            return {}
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """
        Check if cache is still valid.
        
        Args:
            cache_key: Cache key
            
        Returns:
            True if cache is valid, False otherwise
        """
        if cache_key not in self._last_cache_update:
            return False
        
        last_update = self._last_cache_update[cache_key]
        return (datetime.now() - last_update).total_seconds() < self._cache_ttl
    
    def _cache_strategy(self, cache_key: str, strategy_data: Dict[str, Any]):
        """
        Cache strategy data.
        
        Args:
            cache_key: Cache key
            strategy_data: Strategy data to cache
        """
        self._memory_cache[cache_key] = strategy_data
        self._last_cache_update[cache_key] = datetime.now()
        logger.debug(f"Cached strategy data for key: {cache_key}")
    
    async def clear_cache(self, user_id: Optional[int] = None):
        """
        Clear cache for specific user or all users.
        
        Args:
            user_id: User ID to clear cache for, or None for all users
        """
        if user_id:
            cache_key = f"active_strategy_{user_id}"
            if cache_key in self._memory_cache:
                del self._memory_cache[cache_key]
            if cache_key in self._last_cache_update:
                del self._last_cache_update[cache_key]
            logger.debug(f"Cleared cache for user {user_id}")
        else:
            self._memory_cache.clear()
            self._last_cache_update.clear()
            logger.debug("Cleared all cache")
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Cache statistics
        """
        return {
            'total_cached_items': len(self._memory_cache),
            'cache_ttl_seconds': self._cache_ttl,
            'cached_users': list(self._memory_cache.keys()),
            'last_updates': {k: v.isoformat() for k, v in self._last_cache_update.items()}
        }
    
    def count_active_strategies_with_tasks(self) -> int:
        """
        Count how many active strategies have monitoring tasks.
        
        This is used for intelligent scheduling - if there are no active strategies
        with tasks, the scheduler can check less frequently.
        
        Returns:
            Number of active strategies that have at least one active monitoring task
        """
        try:
            if not self.db_session:
                logger.warning("Database session not available")
                return 0
            
            from sqlalchemy import func, and_
            from models.monitoring_models import MonitoringTask
            
            # Count distinct strategies that:
            # 1. Have activation status = 'active'
            # 2. Have at least one active monitoring task
            count = self.db_session.query(
                func.count(func.distinct(EnhancedContentStrategy.id))
            ).join(
                StrategyActivationStatus,
                EnhancedContentStrategy.id == StrategyActivationStatus.strategy_id
            ).join(
                MonitoringTask,
                EnhancedContentStrategy.id == MonitoringTask.strategy_id
            ).filter(
                and_(
                    StrategyActivationStatus.status == 'active',
                    MonitoringTask.status == 'active'
                )
            ).scalar()
            
            return count or 0
            
        except Exception as e:
            logger.error(f"Error counting active strategies with tasks: {e}")
            # On error, assume there are active strategies (safer to check more frequently)
            return 1
    
    def has_active_strategies_with_tasks(self) -> bool:
        """
        Check if this user has any active strategies with monitoring tasks.

        Uses SQL EXISTS for efficiency instead of COUNT.

        Returns:
            True if there are active strategies with tasks, False otherwise
        """
        try:
            if not self.db_session:
                logger.warning("Database session not available")
                return False

            from sqlalchemy import exists, and_
            from models.monitoring_models import MonitoringTask

            # Use EXISTS for efficiency: short-circuits on first match.
            # SQLAlchemy infers FROM clause from the column references in WHERE.
            stmt = exists().where(
                and_(
                    StrategyActivationStatus.strategy_id == EnhancedContentStrategy.id,
                    MonitoringTask.strategy_id == EnhancedContentStrategy.id,
                    StrategyActivationStatus.status == 'active',
                    MonitoringTask.status == 'active',
                )
            )

            result = self.db_session.query(stmt).scalar()
            return bool(result)

        except Exception as e:
            logger.error(f"Error checking active strategies with tasks: {e}")
            return True  # safer to over-check on error