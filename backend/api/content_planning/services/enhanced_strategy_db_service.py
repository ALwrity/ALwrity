"""
Enhanced Strategy Database Service
Handles database operations for enhanced content strategy functionality.
"""

import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

# Import database models
from models.enhanced_strategy_models import EnhancedContentStrategy, EnhancedAIAnalysisResult, OnboardingDataIntegration
from models.enhanced_strategy_models import ContentStrategyAutofillInsights

logger = logging.getLogger(__name__)

class EnhancedStrategyDBService:
    """Database service for enhanced content strategy operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def get_enhanced_strategy(self, strategy_id: int, user_id: Optional[str] = None) -> Optional[EnhancedContentStrategy]:
        """
        Get an enhanced strategy by ID.
        
        Args:
            strategy_id: Strategy ID
            user_id: User ID for ownership verification (REQUIRED for security)
            
        Returns:
            Strategy if found and user_id matches, None otherwise
        """
        try:
            query = self.db.query(EnhancedContentStrategy).filter(EnhancedContentStrategy.id == strategy_id)
            
            # CRITICAL: Always filter by user_id for security
            if user_id:
                query = query.filter(EnhancedContentStrategy.user_id == user_id)
            else:
                logger.warning(f"⚠️ get_enhanced_strategy called without user_id for strategy {strategy_id} - security risk")
            
            strategy = query.first()
            
            # Additional ownership check
            if strategy and user_id and strategy.user_id != user_id:
                logger.warning(f"⚠️ User {user_id} attempted to access strategy {strategy_id} owned by {strategy.user_id}")
                return None
            
            return strategy
        except Exception as e:
            logger.error(f"Error getting enhanced strategy {strategy_id}: {str(e)}")
            return None
    
    async def get_enhanced_strategies(self, user_id: Optional[str] = None, strategy_id: Optional[int] = None) -> List[EnhancedContentStrategy]:
        """Get enhanced strategies with optional filtering."""
        try:
            query = self.db.query(EnhancedContentStrategy)
            
            if user_id:
                query = query.filter(EnhancedContentStrategy.user_id == user_id)
            
            if strategy_id:
                query = query.filter(EnhancedContentStrategy.id == strategy_id)
            
            return query.all()
        except Exception as e:
            logger.error(f"Error getting enhanced strategies: {str(e)}")
            return []
    
    async def create_enhanced_strategy(self, strategy_data: Dict[str, Any]) -> Optional[EnhancedContentStrategy]:
        """Create a new enhanced strategy."""
        try:
            strategy = EnhancedContentStrategy(**strategy_data)
            self.db.add(strategy)
            self.db.commit()
            self.db.refresh(strategy)
            return strategy
        except Exception as e:
            logger.error(f"Error creating enhanced strategy: {str(e)}")
            self.db.rollback()
            return None
    
    async def update_enhanced_strategy(
        self,
        strategy_id: int,
        update_data: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> Optional[EnhancedContentStrategy]:
        """Update an enhanced strategy.

        The ``user_id`` argument enforces tenant ownership. When
        provided, the strategy is loaded through
        ``get_enhanced_strategy(strategy_id, user_id)`` which
        returns ``None`` if the record does not exist OR does not
        belong to the user. Either case surfaces as a 404 at the
        route, which is the right behaviour -- the caller cannot
        distinguish "not yours" from "not real" because doing so
        would leak the existence of other users' strategy IDs.

        Pass ``user_id=None`` to skip the ownership check (admin
        / internal flows only). Production routes must always
        pass a real user id.
        """
        try:
            strategy = await self.get_enhanced_strategy(strategy_id, user_id=user_id)
            if not strategy:
                return None

            for key, value in update_data.items():
                if hasattr(strategy, key):
                    setattr(strategy, key, value)

            strategy.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(strategy)
            return strategy
        except Exception as e:
            logger.error(f"Error updating enhanced strategy {strategy_id}: {str(e)}")
            self.db.rollback()
            return None

    async def delete_enhanced_strategy(
        self,
        strategy_id: int,
        user_id: Optional[str] = None,
    ) -> bool:
        """Delete an enhanced strategy.

        Same ownership semantics as ``update_enhanced_strategy``.
        """
        try:
            strategy = await self.get_enhanced_strategy(strategy_id, user_id=user_id)
            if not strategy:
                return False

            self.db.delete(strategy)
            self.db.commit()
            return True
        except Exception as e:
            logger.error(f"Error deleting enhanced strategy {strategy_id}: {str(e)}")
            self.db.rollback()
            return False
    
    async def get_enhanced_strategies_with_analytics(self, strategy_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get enhanced strategies with analytics data."""
        try:
            strategies = await self.get_enhanced_strategies(strategy_id=strategy_id)
            result = []
            
            for strategy in strategies:
                strategy_dict = strategy.to_dict() if hasattr(strategy, 'to_dict') else {
                    'id': strategy.id,
                    'name': strategy.name,
                    'industry': strategy.industry,
                    'user_id': strategy.user_id,
                    'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                    'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None
                }
                
                # Add analytics data
                analytics = await self.get_ai_analysis_history(strategy.id, limit=5)
                strategy_dict['analytics'] = analytics
                
                result.append(strategy_dict)
            
            return result
        except Exception as e:
            logger.error(f"Error getting enhanced strategies with analytics: {str(e)}")
            return []
    
    async def get_ai_analysis_history(self, strategy_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get AI analysis history for a strategy."""
        try:
            analyses = self.db.query(EnhancedAIAnalysisResult).filter(
                EnhancedAIAnalysisResult.strategy_id == strategy_id
            ).order_by(EnhancedAIAnalysisResult.created_at.desc()).limit(limit).all()
            
            return [analysis.to_dict() if hasattr(analysis, 'to_dict') else {
                'id': analysis.id,
                'analysis_type': analysis.analysis_type,
                'insights': analysis.insights,
                'recommendations': analysis.recommendations,
                'created_at': analysis.created_at.isoformat() if analysis.created_at else None
            } for analysis in analyses]
        except Exception as e:
            logger.error(f"Error getting AI analysis history for strategy {strategy_id}: {str(e)}")
            return []
    
    async def get_onboarding_integration(self, strategy_id: int) -> Optional[Dict[str, Any]]:
        """Get onboarding integration data for a strategy."""
        try:
            integration = self.db.query(OnboardingDataIntegration).filter(
                OnboardingDataIntegration.strategy_id == strategy_id
            ).first()
            
            if integration:
                return integration.to_dict() if hasattr(integration, 'to_dict') else {
                    'id': integration.id,
                    'strategy_id': integration.strategy_id,
                    'data_sources': integration.data_sources,
                    'confidence_scores': integration.confidence_scores,
                    'created_at': integration.created_at.isoformat() if integration.created_at else None
                }
            return None
        except Exception as e:
            logger.error(f"Error getting onboarding integration for strategy {strategy_id}: {str(e)}")
            return None
    
    async def get_strategy_completion_stats(self, user_id: str) -> Dict[str, Any]:
        """Get completion statistics for all strategies of a user."""
        try:
            strategies = await self.get_enhanced_strategies(user_id=user_id)
            
            total_strategies = len(strategies)
            completed_strategies = sum(1 for s in strategies if s.completion_percentage >= 80)
            avg_completion = sum(s.completion_percentage for s in strategies) / total_strategies if total_strategies > 0 else 0
            
            return {
                'total_strategies': total_strategies,
                'completed_strategies': completed_strategies,
                'avg_completion_percentage': avg_completion,
                'user_id': user_id
            }
        except Exception as e:
            logger.error(f"Error getting strategy completion stats for user {user_id}: {str(e)}")
            return {
                'total_strategies': 0,
                'completed_strategies': 0,
                'avg_completion_percentage': 0,
                'user_id': user_id
            }
    
    async def search_enhanced_strategies(self, user_id: str, search_term: str) -> List[EnhancedContentStrategy]:
        """Search enhanced strategies by name or industry."""
        try:
            return self.db.query(EnhancedContentStrategy).filter(
                and_(
                    EnhancedContentStrategy.user_id == user_id,
                    or_(
                        EnhancedContentStrategy.name.ilike(f"%{search_term}%"),
                        EnhancedContentStrategy.industry.ilike(f"%{search_term}%")
                    )
                )
            ).all()
        except Exception as e:
            logger.error(f"Error searching enhanced strategies: {str(e)}")
            return []
    
    async def get_strategy_export_data(self, strategy_id: int) -> Optional[Dict[str, Any]]:
        """Get comprehensive export data for a strategy."""
        try:
            strategy = await self.get_enhanced_strategy(strategy_id)
            if not strategy:
                return None
            
            # Get strategy data
            strategy_data = strategy.to_dict() if hasattr(strategy, 'to_dict') else {
                'id': strategy.id,
                'name': strategy.name,
                'industry': strategy.industry,
                'user_id': strategy.user_id,
                'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None
            }
            
            # Get analytics data
            analytics = await self.get_ai_analysis_history(strategy_id, limit=10)
            
            # Get onboarding integration
            onboarding = await self.get_onboarding_integration(strategy_id)
            
            return {
                'strategy': strategy_data,
                'analytics': analytics,
                'onboarding_integration': onboarding,
                'exported_at': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting strategy export data for strategy {strategy_id}: {str(e)}")
            return None 

    async def save_autofill_insights(self, *, strategy_id: int, user_id: str, payload: Dict[str, Any]) -> Optional[ContentStrategyAutofillInsights]:
        """Persist accepted auto-fill inputs used to create a strategy."""
        try:
            record = ContentStrategyAutofillInsights(
                strategy_id=strategy_id,
                user_id=user_id,
                accepted_fields=payload.get('accepted_fields') or {},
                sources=payload.get('sources') or {},
                input_data_points=payload.get('input_data_points') or {},
                quality_scores=payload.get('quality_scores') or {},
                confidence_levels=payload.get('confidence_levels') or {},
                data_freshness=payload.get('data_freshness') or {}
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record
        except Exception as e:
            logger.error(f"Error saving autofill insights for strategy {strategy_id}: {str(e)}")
            self.db.rollback()
            return None

    async def get_latest_autofill_insights(self, strategy_id: int) -> Optional[Dict[str, Any]]:
        """Fetch the most recent accepted auto-fill snapshot for a strategy."""
        try:
            record = self.db.query(ContentStrategyAutofillInsights).filter(
                ContentStrategyAutofillInsights.strategy_id == strategy_id
            ).order_by(ContentStrategyAutofillInsights.created_at.desc()).first()
            if not record:
                return None
            return {
                'id': record.id,
                'strategy_id': record.strategy_id,
                'user_id': record.user_id,
                'accepted_fields': record.accepted_fields,
                'sources': record.sources,
                'input_data_points': record.input_data_points,
                'quality_scores': record.quality_scores,
                'confidence_levels': record.confidence_levels,
                'data_freshness': record.data_freshness,
                'created_at': record.created_at.isoformat() if record.created_at else None
            }
        except Exception as e:
            logger.error(f"Error fetching latest autofill insights for strategy {strategy_id}: {str(e)}")
            return None 
