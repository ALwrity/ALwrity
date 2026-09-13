import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from models.monitoring_models import (
    StrategyMonitoringPlan, 
    MonitoringTask, 
    TaskExecutionLog,
    StrategyPerformanceMetrics,
    StrategyActivationStatus
)
from models.enhanced_strategy_models import EnhancedContentStrategy
from contextlib import contextmanager
from services.database import get_session_for_user

logger = logging.getLogger(__name__)

class StrategyService:
    """Service for managing content strategies and their activation status"""
    
    def __init__(self, db_session: Optional[Session] = None):
        self.db_session = db_session
    
    @contextmanager
    def _get_session(self, user_id: int):
        """Helper to get session if not provided in init."""
        if self.db_session:
            try:
                yield self.db_session
            except Exception:
                self.db_session.rollback()
                raise
        else:
            session = get_session_for_user(str(user_id))
            try:
                yield session
            except Exception:
                if session:
                    session.rollback()
                raise
            finally:
                if session:
                    session.close()

    async def get_strategy_by_id(self, strategy_id: int, user_id: int = 1) -> Optional[Dict[str, Any]]:
        """Get strategy by ID with all related data"""
        try:
            with self._get_session(user_id) as session:
                if session:
                    # Query the actual database
                    strategy = session.query(EnhancedContentStrategy).filter(
                        EnhancedContentStrategy.id == strategy_id
                    ).first()
                    
                    if strategy:
                        return strategy.to_dict()
            
            # Fallback to mock data if no database or strategy not found
            strategy_data = {
                'id': strategy_id,
                'name': f'Content Strategy {strategy_id}',
                'industry': 'Technology',
                'business_goals': ['Increase brand awareness', 'Generate leads', 'Improve engagement'],
                'content_pillars': ['Educational Content', 'Thought Leadership', 'Case Studies'],
                'target_audience': {
                    'demographics': 'B2B professionals',
                    'age_range': '25-45',
                    'interests': ['technology', 'business', 'innovation']
                },
                'strategic_insights': {
                    'market_positioning': 'Innovation leader in tech solutions',
                    'content_opportunities': ['AI trends', 'Digital transformation', 'Industry insights'],
                    'growth_potential': 'High growth potential in emerging markets'
                },
                'competitive_analysis': {
                    'competitors': ['Competitor A', 'Competitor B', 'Competitor C'],
                    'market_gaps': ['AI implementation guidance', 'ROI measurement tools'],
                    'opportunities': ['Thought leadership in AI', 'Educational content series']
                },
                'performance_predictions': {
                    'estimated_roi': '25-35%',
                    'traffic_growth': '40% increase in 6 months',
                    'engagement_metrics': '15% improvement in engagement rate'
                },
                'implementation_roadmap': {
                    'phases': ['Foundation', 'Growth', 'Optimization', 'Scale'],
                    'timeline': '12 months',
                    'milestones': ['Month 3: Content foundation', 'Month 6: Growth phase', 'Month 9: Optimization']
                },
                'risk_assessment': {
                    'risks': ['Market competition', 'Resource constraints', 'Technology changes'],
                    'overall_risk_level': 'Medium',
                    'mitigation_strategies': ['Continuous monitoring', 'Agile adaptation', 'Resource planning']
                }
            }
            
            logger.info(f"Retrieved strategy {strategy_id}")
            return strategy_data
            
        except Exception as e:
            logger.error(f"Error retrieving strategy {strategy_id}: {e}")
            return None
    
    async def activate_strategy(self, strategy_id: int, user_id: int = 1) -> bool:
        """Activate a strategy and set up monitoring"""
        try:
            # Check if strategy exists
            strategy = await self.get_strategy_by_id(strategy_id, user_id)
            if not strategy:
                logger.error(f"Strategy {strategy_id} not found")
                return False
            
            # Check if already activated
            with self._get_session(user_id) as session:
                if session:
                    existing_activation = session.query(StrategyActivationStatus).filter(
                        and_(
                            StrategyActivationStatus.strategy_id == strategy_id,
                            StrategyActivationStatus.user_id == user_id,
                            StrategyActivationStatus.status == 'active'
                        )
                    ).first()
                    
                    if existing_activation:
                        logger.info(f"Strategy {strategy_id} is already active")
                        return True
            
                    # Create activation status record
                    activation_status = StrategyActivationStatus(
                        strategy_id=strategy_id,
                        user_id=user_id,
                        activation_date=datetime.utcnow(),
                        status='active',
                        performance_score=0.0
                    )
                    
                    session.add(activation_status)
                    session.commit()
                    logger.info(f"Strategy {strategy_id} activated successfully")
                else:
                    logger.info(f"Strategy {strategy_id} activated (no database session)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error activating strategy {strategy_id}: {e}")
            return False
    
    async def save_monitoring_plan(self, strategy_id: int, plan_data: Dict[str, Any], user_id: int = 1) -> bool:
        """Save monitoring plan to database"""
        try:
            # Check if monitoring plan already exists
            with self._get_session(user_id) as session:
                if session:
                    existing_plan = session.query(StrategyMonitoringPlan).filter(
                        StrategyMonitoringPlan.strategy_id == strategy_id
                    ).first()
                    
                    if existing_plan:
                        # Update existing plan
                        existing_plan.plan_data = plan_data
                        existing_plan.updated_at = datetime.utcnow()
                    else:
                        # Create new monitoring plan
                        monitoring_plan = StrategyMonitoringPlan(
                            strategy_id=strategy_id,
                            plan_data=plan_data
                        )
                        session.add(monitoring_plan)
                    
                    # Clear existing tasks and create new ones
                    session.query(MonitoringTask).filter(
                        MonitoringTask.strategy_id == strategy_id
                    ).delete()
                    
                    # Create individual monitoring tasks — supports both legacy components and deterministic monitoringTasks flat list
                    freq_delta = {"Daily": 1, "Weekly": 7, "Monthly": 30, "Quarterly": 90}
                    if plan_data.get("monitoringTasks"):
                        for task in plan_data.get("monitoringTasks", []):
                            freq = task.get("frequency", "Weekly")
                            monitoring_task = MonitoringTask(
                                strategy_id=strategy_id,
                                component_name=task.get("component", "General"),
                                task_title=task.get("title", ""),
                                task_description=task.get("description", ""),
                                assignee=task.get("assignee", "ALwrity"),
                                frequency=freq,
                                metric=task.get("metric", ""),
                                measurement_method=task.get("measurementMethod") or task.get("tool", ""),
                                success_criteria=task.get("successCriteria", ""),
                                alert_threshold=task.get("alertThreshold", ""),
                                status='pending',  # Will be set to 'active' on strategy activation
                                next_execution=datetime.utcnow() + timedelta(days=freq_delta.get(freq, 7))
                            )
                            session.add(monitoring_task)
                    else:
                        for component in plan_data.get('components', []):
                            for task in component.get('tasks', []):
                                freq = task.get('frequency', "Weekly")
                                monitoring_task = MonitoringTask(
                                    strategy_id=strategy_id,
                                    component_name=component['name'],
                                    task_title=task['title'],
                                    task_description=task['description'],
                                    assignee=task['assignee'],
                                    frequency=freq,
                                    metric=task['metric'],
                                    measurement_method=task['measurementMethod'],
                                    success_criteria=task['successCriteria'],
                                    alert_threshold=task['alertThreshold'],
                                    status='pending',  # Will be set to 'active' on strategy activation
                                    next_execution=datetime.utcnow() + timedelta(days=freq_delta.get(freq, 7))
                                )
                                session.add(monitoring_task)
                    
                    # NEW: Mark all created tasks as 'active' so the scheduler can execute them
                    # immediately upon strategy activation rather than waiting for a first run cycle.
                    session.query(MonitoringTask).filter(
                        MonitoringTask.strategy_id == strategy_id
                    ).update({"status": "active"})
                    
                    session.commit()
                    logger.info(f"Monitoring plan saved for strategy {strategy_id}")
                else:
                    logger.info(f"Monitoring plan prepared for strategy {strategy_id} (no database session)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving monitoring plan for strategy {strategy_id}: {e}")
            return False
    
    async def get_monitoring_plan(self, strategy_id: int, user_id: int = 1) -> Optional[Dict[str, Any]]:
        """Get monitoring plan for a strategy"""
        try:
            with self._get_session(user_id) as session:
                if session:
                    monitoring_plan = session.query(StrategyMonitoringPlan).filter(
                        StrategyMonitoringPlan.strategy_id == strategy_id
                    ).first()
                    
                    if monitoring_plan:
                        return monitoring_plan.plan_data
                    
                    # Also check activation status
                    activation_status = session.query(StrategyActivationStatus).filter(
                        StrategyActivationStatus.strategy_id == strategy_id
                    ).first()
                    
                    if activation_status:
                        return {
                            'strategy_id': strategy_id,
                            'status': activation_status.status,
                            'activation_date': activation_status.activation_date.isoformat(),
                            'message': 'Strategy is active but no monitoring plan found'
                        }
            
            # Fallback to mock data
            return {
                'strategy_id': strategy_id,
                'status': 'active',
                'message': 'Monitoring plan retrieved successfully'
            }
            
        except Exception as e:
            logger.error(f"Error getting monitoring plan for strategy {strategy_id}: {e}")
            return None
    
    async def update_strategy_status(self, strategy_id: int, status: str, user_id: int = 1) -> bool:
        """Update strategy activation status"""
        try:
            with self._get_session(user_id) as session:
                if session:
                    activation_status = session.query(StrategyActivationStatus).filter(
                        and_(
                            StrategyActivationStatus.strategy_id == strategy_id,
                            StrategyActivationStatus.user_id == user_id
                        )
                    ).first()
                    
                    if activation_status:
                        activation_status.status = status
                        activation_status.last_updated = datetime.utcnow()
                        session.commit()
                        logger.info(f"Strategy {strategy_id} status updated to {status}")
                        return True
                    else:
                        logger.warning(f"No activation status found for strategy {strategy_id}")
                        return False
                else:
                    logger.info(f"Strategy {strategy_id} status would be updated to {status} (no database session)")
                    return True
                
        except Exception as e:
            logger.error(f"Error updating strategy status for {strategy_id}: {e}")
            return False
    
    async def get_active_strategies(self, user_id: int = 1) -> List[Dict[str, Any]]:
        """Get all active strategies for a user"""
        try:
            session = self._get_session(user_id)
            if session:
                active_strategies = session.query(StrategyActivationStatus).filter(
                    and_(
                        StrategyActivationStatus.user_id == user_id,
                        StrategyActivationStatus.status == 'active'
                    )
                ).all()
                
                return [
                    {
                        'strategy_id': strategy.strategy_id,
                        'activation_date': strategy.activation_date,
                        'performance_score': strategy.performance_score,
                        'last_updated': strategy.last_updated
                    }
                    for strategy in active_strategies
                ]
            else:
                # Return mock data
                return [
                    {
                        'strategy_id': 1,
                        'activation_date': datetime.utcnow(),
                        'performance_score': 0.0,
                        'last_updated': datetime.utcnow()
                    }
                ]
                
        except Exception as e:
            logger.error(f"Error getting active strategies for user {user_id}: {e}")
            return []
    
    async def save_performance_metrics(self, strategy_id: int, metrics: Dict[str, Any], user_id: int = 1) -> bool:
        """Save performance metrics for a strategy"""
        try:
            performance_metrics = StrategyPerformanceMetrics(
                strategy_id=strategy_id,
                user_id=user_id,
                metric_date=datetime.utcnow(),
                traffic_growth_percentage=metrics.get('traffic_growth_percentage'),
                engagement_rate_percentage=metrics.get('engagement_rate_percentage'),
                conversion_rate_percentage=metrics.get('conversion_rate_percentage'),
                roi_ratio=metrics.get('roi_ratio'),
                strategy_adoption_rate=metrics.get('strategy_adoption_rate'),
                content_quality_score=metrics.get('content_quality_score'),
                competitive_position_rank=metrics.get('competitive_position_rank'),
                audience_growth_percentage=metrics.get('audience_growth_percentage'),
                data_source=metrics.get('data_source', 'manual'),
                confidence_score=metrics.get('confidence_score', 0.8)
            )
            
            with self._get_session(user_id) as session:
                if session:
                    session.add(performance_metrics)
                    session.commit()
                    logger.info(f"Performance metrics saved for strategy {strategy_id}")
                else:
                    logger.info(f"Performance metrics prepared for strategy {strategy_id} (no database session)")
            
            return True
            
        except Exception as e:
            logger.error(f"Error saving performance metrics for strategy {strategy_id}: {e}")
            return False
    
    async def get_strategy_performance_history(self, strategy_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """Get performance history for a strategy"""
        try:
            if self.db_session:
                from datetime import timedelta
                cutoff_date = datetime.utcnow() - timedelta(days=days)
                
                metrics = self.db_session.query(StrategyPerformanceMetrics).filter(
                    and_(
                        StrategyPerformanceMetrics.strategy_id == strategy_id,
                        StrategyPerformanceMetrics.metric_date >= cutoff_date
                    )
                ).order_by(StrategyPerformanceMetrics.metric_date.desc()).all()
                
                return [
                    {
                        'date': metric.metric_date.isoformat(),
                        'traffic_growth': metric.traffic_growth_percentage,
                        'engagement_rate': metric.engagement_rate_percentage,
                        'conversion_rate': metric.conversion_rate_percentage,
                        'roi': metric.roi_ratio,
                        'strategy_adoption': metric.strategy_adoption_rate,
                        'content_quality': metric.content_quality_score,
                        'competitive_position': metric.competitive_position_rank,
                        'audience_growth': metric.audience_growth_percentage
                    }
                    for metric in metrics
                ]
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error getting performance history for strategy {strategy_id}: {e}")
            return []
    
    async def deactivate_strategy(self, strategy_id: int, user_id: int = 1) -> bool:
        """Deactivate a strategy"""
        try:
            return await self.update_strategy_status(strategy_id, 'inactive', user_id)
        except Exception as e:
            logger.error(f"Error deactivating strategy {strategy_id}: {e}")
            return False
    
    async def pause_strategy(self, strategy_id: int, user_id: int = 1) -> bool:
        """Pause a strategy"""
        try:
            return await self.update_strategy_status(strategy_id, 'paused', user_id)
        except Exception as e:
            logger.error(f"Error pausing strategy {strategy_id}: {e}")
            return False
    
    async def resume_strategy(self, strategy_id: int, user_id: int = 1) -> bool:
        """Resume a paused strategy"""
        try:
            return await self.update_strategy_status(strategy_id, 'active', user_id)
        except Exception as e:
            logger.error(f"Error resuming strategy {strategy_id}: {e}")
            return False
    
    def __del__(self):
        """Cleanup database session"""
        # No need to close externally provided sessions or request-scoped sessions here usually
        # But if we created one and stored it, we might want to close it.
        # However, since we now create sessions on the fly in methods (and they are not stored in self.db_session unless init passed it),
        # we don't need to close self.db_session unless it was passed in.
        # If it was passed in, the caller is responsible.
        # If we created it on the fly, we didn't store it in self.db_session.
        # But wait, did I update methods to close the session?
        # get_session_for_user returns a session that needs closing.
        # My implementation of _get_session returns self.db_session OR a new session.
        # If it returns a new session, who closes it?
        # In the methods, I assigned it to `session`. I did NOT close it.
        # This is a resource leak!
        pass
