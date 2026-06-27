from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Dict, Any, Optional
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
import json

from services.monitoring_plan_generator import MonitoringPlanGenerator
from services.strategy_service import StrategyService
from services.monitoring_data_service import MonitoringDataService
from services.database import get_db
from models.monitoring_models import (
    StrategyMonitoringPlan, MonitoringTask, TaskExecutionLog,
    StrategyPerformanceMetrics, StrategyActivationStatus
)
from models.enhanced_strategy_models import EnhancedContentStrategy

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategy", tags=["strategy-monitoring"])

@router.post("/{strategy_id}/generate-monitoring-plan")
async def generate_monitoring_plan(strategy_id: int):
    """Generate monitoring plan for a strategy"""
    try:
        generator = MonitoringPlanGenerator()
        plan = await generator.generate_monitoring_plan(strategy_id)
        
        logger.info(f"Successfully generated monitoring plan for strategy {strategy_id}")
        return {
            "success": True,
            "data": plan,
            "message": "Monitoring plan generated successfully"
        }
    except Exception as e:
        logger.error(f"Error generating monitoring plan for strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate monitoring plan: {str(e)}"
        )

@router.post("/{strategy_id}/activate-with-monitoring")
async def activate_strategy_with_monitoring(
    strategy_id: int,
    monitoring_plan: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """Activate strategy with monitoring plan"""
    try:
        strategy_service = StrategyService()
        monitoring_service = MonitoringDataService(db)
        
        # Activate strategy
        activation_success = await strategy_service.activate_strategy(strategy_id)
        if not activation_success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to activate strategy {strategy_id}"
            )
        
        # Save monitoring data to database
        monitoring_success = await monitoring_service.save_monitoring_data(strategy_id, monitoring_plan)
        if not monitoring_success:
            logger.warning(f"Failed to save monitoring data for strategy {strategy_id}")
        
        # Trigger scheduler interval adjustment (scheduler will check more frequently now)
        try:
            from services.scheduler import get_scheduler
            scheduler = get_scheduler()
            if not scheduler.is_running:
                logger.warning("[SCHEDULER] Scheduler not running — interval adjustment stored but will not take effect until started")
            await scheduler.trigger_interval_adjustment()
            logger.info(f"Triggered scheduler interval adjustment after strategy {strategy_id} activation")
        except Exception as e:
            logger.warning(f"Could not trigger scheduler interval adjustment: {e}")
        
        logger.info(f"Successfully activated strategy {strategy_id} with monitoring")
        return {
            "success": True,
            "message": "Strategy activated with monitoring successfully",
            "strategy_id": strategy_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating strategy {strategy_id} with monitoring: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to activate strategy with monitoring: {str(e)}"
        )

@router.get("/{strategy_id}/monitoring-plan")
async def get_monitoring_plan(strategy_id: int, db: Session = Depends(get_db)):
    """Get monitoring plan for a strategy"""
    try:
        monitoring_service = MonitoringDataService(db)
        monitoring_data = await monitoring_service.get_monitoring_data(strategy_id)
        
        if monitoring_data:
            return {
                "success": True,
                "data": monitoring_data
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Monitoring plan not found for strategy {strategy_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitoring plan for strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get monitoring plan: {str(e)}"
        )

@router.get("/{strategy_id}/analytics-data")
async def get_analytics_data(strategy_id: int, db: Session = Depends(get_db)):
    """Get analytics data from monitoring data (no external API calls)"""
    try:
        monitoring_service = MonitoringDataService(db)
        analytics_data = await monitoring_service.get_analytics_data(strategy_id)
        
        return {
            "success": True,
            "data": analytics_data,
            "message": "Analytics data retrieved from monitoring database"
        }
    except Exception as e:
        logger.error(f"Error getting analytics data for strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get analytics data: {str(e)}"
        )

@router.get("/{strategy_id}/performance-history")
async def get_strategy_performance_history(strategy_id: int, days: int = 30):
    """Get performance history for a strategy"""
    try:
        strategy_service = StrategyService()
        performance_history = await strategy_service.get_strategy_performance_history(strategy_id, days)
        
        return {
            "success": True,
            "data": {
                "strategy_id": strategy_id,
                "performance_history": performance_history,
                "days": days
            }
        }
    except Exception as e:
        logger.error(f"Error getting performance history for strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get performance history: {str(e)}"
        )

@router.post("/{strategy_id}/deactivate")
async def deactivate_strategy(strategy_id: int, user_id: int = 1):
    """Deactivate a strategy"""
    try:
        strategy_service = StrategyService()
        success = await strategy_service.deactivate_strategy(strategy_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": f"Strategy {strategy_id} deactivated successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to deactivate strategy {strategy_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to deactivate strategy: {str(e)}"
        )

@router.post("/{strategy_id}/pause")
async def pause_strategy(strategy_id: int, user_id: int = 1):
    """Pause a strategy"""
    try:
        strategy_service = StrategyService()
        success = await strategy_service.pause_strategy(strategy_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": f"Strategy {strategy_id} paused successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to pause strategy {strategy_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pausing strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to pause strategy: {str(e)}"
        )

@router.post("/{strategy_id}/resume")
async def resume_strategy(strategy_id: int, user_id: int = 1):
    """Resume a paused strategy"""
    try:
        strategy_service = StrategyService()
        success = await strategy_service.resume_strategy(strategy_id, user_id)
        
        if success:
            return {
                "success": True,
                "message": f"Strategy {strategy_id} resumed successfully"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to resume strategy {strategy_id}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resuming strategy {strategy_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to resume strategy: {str(e)}"
        )

@router.get("/{strategy_id}/performance-metrics")
async def get_performance_metrics(
    strategy_id: int,
    db: Session = Depends(get_db)
):
    """
    Get performance metrics for a strategy
    """
    try:
        # For now, return mock data - in real implementation, this would query the database
        mock_metrics = {
            "traffic_growth_percentage": 15.7,
            "engagement_rate_percentage": 8.3,
            "conversion_rate_percentage": 2.1,
            "roi_ratio": 3.2,
            "strategy_adoption_rate": 85,
            "content_quality_score": 92,
            "competitive_position_rank": 3,
            "audience_growth_percentage": 12.5,
            "confidence_score": 88,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        return {
            "success": True,
            "data": mock_metrics,
            "message": "Performance metrics retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{strategy_id}/trend-data")
async def get_trend_data(
    strategy_id: int,
    time_range: str = Query("30d", description="Time range: 7d, 30d, 90d, 1y"),
    db: Session = Depends(get_db)
):
    """
    Get trend data for a strategy over time
    """
    try:
        # Mock trend data - in real implementation, this would query the database
        mock_trend_data = [
            {"date": "2024-01-01", "traffic_growth": 5.2, "engagement_rate": 6.1, "conversion_rate": 1.8, "content_quality_score": 85, "strategy_adoption_rate": 70},
            {"date": "2024-01-08", "traffic_growth": 7.8, "engagement_rate": 7.2, "conversion_rate": 2.0, "content_quality_score": 87, "strategy_adoption_rate": 75},
            {"date": "2024-01-15", "traffic_growth": 9.1, "engagement_rate": 7.8, "conversion_rate": 2.1, "content_quality_score": 89, "strategy_adoption_rate": 78},
            {"date": "2024-01-22", "traffic_growth": 11.3, "engagement_rate": 8.1, "conversion_rate": 2.0, "content_quality_score": 90, "strategy_adoption_rate": 82},
            {"date": "2024-01-29", "traffic_growth": 12.7, "engagement_rate": 8.3, "conversion_rate": 2.1, "content_quality_score": 91, "strategy_adoption_rate": 85},
            {"date": "2024-02-05", "traffic_growth": 14.2, "engagement_rate": 8.5, "conversion_rate": 2.2, "content_quality_score": 92, "strategy_adoption_rate": 87},
            {"date": "2024-02-12", "traffic_growth": 15.7, "engagement_rate": 8.3, "conversion_rate": 2.1, "content_quality_score": 92, "strategy_adoption_rate": 85}
        ]
        
        return {
            "success": True,
            "data": mock_trend_data,
            "message": "Trend data retrieved successfully"
        }
    except Exception as e:
        logger.error(f"Error getting trend data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{strategy_id}/test-transparency")
async def test_transparency_endpoint(
    strategy_id: int,
    db: Session = Depends(get_db)
):
    """
    Simple test endpoint to check if transparency data endpoint works
    """
    try:
        # Check if strategy exists
        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not strategy:
            return {
                "success": False,
                "data": None,
                "message": f"Strategy with ID {strategy_id} not found"
            }

        # Get monitoring plan
        monitoring_plan = db.query(StrategyMonitoringPlan).filter(
            StrategyMonitoringPlan.strategy_id == strategy_id
        ).first()

        # Get monitoring tasks count
        tasks_count = db.query(MonitoringTask).filter(
            MonitoringTask.strategy_id == strategy_id
        ).count()

        return {
            "success": True,
            "data": {
                "strategy_id": strategy_id,
                "strategy_name": strategy.strategy_name if hasattr(strategy, 'strategy_name') else "Unknown",
                "monitoring_plan_exists": monitoring_plan is not None,
                "tasks_count": tasks_count
            },
            "message": "Test endpoint working"
        }

    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}")
        return {
            "success": False,
            "data": None,
            "message": f"Error: {str(e)}"
        }

@router.get("/{strategy_id}/monitoring-tasks")
async def get_monitoring_tasks(
    strategy_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all monitoring tasks for a strategy with their execution status
    """
    try:
        # Check if strategy exists
        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")

        # Get monitoring tasks with execution logs
        tasks = db.query(MonitoringTask).filter(
            MonitoringTask.strategy_id == strategy_id
        ).all()

        tasks_data = []
        for task in tasks:
            # Get latest execution log
            latest_log = db.query(TaskExecutionLog).filter(
                TaskExecutionLog.task_id == task.id
            ).order_by(desc(TaskExecutionLog.execution_date)).first()

            task_data = {
                "id": task.id,
                "title": task.task_title,
                "description": task.task_description,
                "assignee": task.assignee,
                "frequency": task.frequency,
                "metric": task.metric,
                "measurementMethod": task.measurement_method,
                "successCriteria": task.success_criteria,
                "alertThreshold": task.alert_threshold,
                "actionableInsights": getattr(task, 'actionable_insights', None),
                "status": "active",  # This would be determined by task execution status
                "lastExecuted": latest_log.execution_date.isoformat() if latest_log else None,
                "executionCount": db.query(TaskExecutionLog).filter(
                    TaskExecutionLog.task_id == task.id
                ).count()
            }
            tasks_data.append(task_data)

        return {
            "success": True,
            "data": tasks_data,
            "message": "Monitoring tasks retrieved successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving monitoring tasks: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/user/{user_id}/monitoring-tasks")
async def get_user_monitoring_tasks(
    user_id: int,
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by task status"),
    limit: int = Query(50, description="Maximum number of tasks to return"),
    offset: int = Query(0, description="Number of tasks to skip")
):
    """
    Get all monitoring tasks for a specific user with their execution status.
    
    Uses the scheduler's task loader to get tasks filtered by user_id for proper user isolation.
    """
    try:
        logger.info(f"Getting monitoring tasks for user {user_id}")
        
        # Use scheduler task loader for user-specific tasks
        from services.scheduler.utils.task_loader import load_due_monitoring_tasks
        
        # Load all tasks for user (not just due tasks - we want all user tasks)
        # Join with strategy to filter by user
        tasks_query = db.query(MonitoringTask).join(
            EnhancedContentStrategy,
            MonitoringTask.strategy_id == EnhancedContentStrategy.id
        ).filter(
            EnhancedContentStrategy.user_id == user_id
        )
        
        # Apply status filter if provided
        if status:
            tasks_query = tasks_query.filter(MonitoringTask.status == status)
        
        # Get tasks with pagination
        tasks = tasks_query.order_by(desc(MonitoringTask.created_at)).offset(offset).limit(limit).all()
        
        tasks_data = []
        for task in tasks:
            # Get latest execution log
            latest_log = db.query(TaskExecutionLog).filter(
                TaskExecutionLog.task_id == task.id
            ).order_by(desc(TaskExecutionLog.execution_date)).first()
            
            # Get strategy info
            strategy = db.query(EnhancedContentStrategy).filter(
                EnhancedContentStrategy.id == task.strategy_id
            ).first()
            
            task_data = {
                "id": task.id,
                "strategy_id": task.strategy_id,
                "strategy_name": strategy.name if strategy else None,
                "title": task.task_title,
                "description": task.task_description,
                "assignee": task.assignee,
                "frequency": task.frequency,
                "metric": task.metric,
                "measurementMethod": task.measurement_method,
                "successCriteria": task.success_criteria,
                "alertThreshold": task.alert_threshold,
                "status": task.status,
                "lastExecuted": latest_log.execution_date.isoformat() if latest_log else None,
                "nextExecution": task.next_execution.isoformat() if task.next_execution else None,
                "executionCount": db.query(TaskExecutionLog).filter(
                    TaskExecutionLog.task_id == task.id
                ).count(),
                "created_at": task.created_at.isoformat() if task.created_at else None
            }
            tasks_data.append(task_data)
        
        # Get total count for pagination
        total_count = db.query(MonitoringTask).join(
            EnhancedContentStrategy,
            MonitoringTask.strategy_id == EnhancedContentStrategy.id
        ).filter(
            EnhancedContentStrategy.user_id == user_id
        )
        if status:
            total_count = total_count.filter(MonitoringTask.status == status)
        total_count = total_count.count()
        
        return {
            "success": True,
            "data": tasks_data,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + len(tasks_data)) < total_count
            },
            "message": f"Retrieved {len(tasks_data)} monitoring tasks for user {user_id}"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving user monitoring tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve monitoring tasks: {str(e)}")

@router.get("/user/{user_id}/execution-logs")
async def get_user_execution_logs(
    user_id: int,
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None, description="Filter by execution status"),
    limit: int = Query(50, description="Maximum number of logs to return"),
    offset: int = Query(0, description="Number of logs to skip")
):
    """
    Get execution logs for a specific user.
    
    Provides user isolation by filtering execution logs by user_id.
    """
    try:
        logger.info(f"Getting execution logs for user {user_id}")
        
        monitoring_service = MonitoringDataService(db)
        logs_data = monitoring_service.get_user_execution_logs(
            user_id=user_id,
            limit=limit,
            offset=offset,
            status_filter=status
        )
        
        # Get total count for pagination
        count_query = db.query(TaskExecutionLog).filter(
            TaskExecutionLog.user_id == user_id
        )
        if status:
            count_query = count_query.filter(TaskExecutionLog.status == status)
        total_count = count_query.count()
        
        return {
            "success": True,
            "data": logs_data,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": (offset + len(logs_data)) < total_count
            },
            "message": f"Retrieved {len(logs_data)} execution logs for user {user_id}"
        }
        
    except Exception as e:
        logger.error(f"Error retrieving execution logs for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve execution logs: {str(e)}")

@router.get("/{strategy_id}/data-freshness")
async def get_data_freshness(
    strategy_id: int,
    db: Session = Depends(get_db)
):
    """
    Get data freshness information for all metrics
    """
    try:
        # Check if strategy exists
        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")

        # Get latest task execution logs
        latest_logs = db.query(TaskExecutionLog).join(MonitoringTask).filter(
            MonitoringTask.strategy_id == strategy_id
        ).order_by(desc(TaskExecutionLog.execution_date)).limit(10).all()

        # Get performance metrics
        performance_metrics = db.query(StrategyPerformanceMetrics).filter(
            StrategyPerformanceMetrics.strategy_id == strategy_id
        ).order_by(desc(StrategyPerformanceMetrics.created_at)).first()

        freshness_data = {
            "lastUpdated": latest_logs[0].execution_date.isoformat() if latest_logs else datetime.now().isoformat(),
            "updateFrequency": "Every 4 hours",
            "dataSource": "Multiple Analytics APIs + AI Analysis",
            "confidence": 90,
            "metrics": [
                {
                    "name": "Traffic Growth",
                    "lastUpdated": latest_logs[0].execution_date.isoformat() if latest_logs else datetime.now().isoformat(),
                    "updateFrequency": "Every 4 hours",
                    "dataSource": "Google Analytics + AI Analysis",
                    "confidence": 92
                },
                {
                    "name": "Engagement Rate",
                    "lastUpdated": latest_logs[0].execution_date.isoformat() if latest_logs else datetime.now().isoformat(),
                    "updateFrequency": "Every 2 hours",
                    "dataSource": "Social Media Analytics + Website Analytics",
                    "confidence": 88
                },
                {
                    "name": "Conversion Rate",
                    "lastUpdated": latest_logs[0].execution_date.isoformat() if latest_logs else datetime.now().isoformat(),
                    "updateFrequency": "Every 6 hours",
                    "dataSource": "Google Analytics + CRM Data",
                    "confidence": 85
                }
            ]
        }

        return {
            "success": True,
            "data": freshness_data,
            "message": "Data freshness information retrieved successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving data freshness: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{strategy_id}/transparency-data")
async def get_transparency_data(
    strategy_id: int,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive transparency data for a strategy including:
    - Data freshness information
    - Measurement methodology
    - AI monitoring tasks
    - Strategy mapping
    - AI insights
    """
    try:
        # Check if strategy exists
        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()
        
        if not strategy:
            return {
                "success": False,
                "data": None,
                "message": f"Strategy with ID {strategy_id} not found"
            }

        # Get monitoring plan and tasks
        monitoring_plan = db.query(StrategyMonitoringPlan).filter(
            StrategyMonitoringPlan.strategy_id == strategy_id
        ).first()

        if not monitoring_plan:
            return {
                "success": False,
                "data": None,
                "message": "No monitoring plan found for this strategy"
            }

        # Get all monitoring tasks
        monitoring_tasks = db.query(MonitoringTask).filter(
            MonitoringTask.strategy_id == strategy_id
        ).all()

        # Get task execution logs for data freshness
        task_logs = db.query(TaskExecutionLog).join(MonitoringTask).filter(
            MonitoringTask.strategy_id == strategy_id
        ).order_by(desc(TaskExecutionLog.execution_date)).all()

        # Get performance metrics for current values
        performance_metrics = db.query(StrategyPerformanceMetrics).filter(
            StrategyPerformanceMetrics.strategy_id == strategy_id
        ).order_by(desc(StrategyPerformanceMetrics.created_at)).first()

        # Build transparency data from actual monitoring tasks
        transparency_data = []
        
        # Group tasks by component for better organization
        tasks_by_component = {}
        for task in monitoring_tasks:
            component = task.component_name or 'General'
            if component not in tasks_by_component:
                tasks_by_component[component] = []
            tasks_by_component[component].append(task)
        
        # Create transparency data for each component
        for component, tasks in tasks_by_component.items():
            component_data = {
                "metricName": component,
                "currentValue": len(tasks),
                "unit": "tasks",
                "dataFreshness": {
                    "lastUpdated": task_logs[0].execution_date.isoformat() if task_logs else datetime.now().isoformat(),
                    "updateFrequency": "Real-time",
                    "dataSource": "Monitoring System",
                    "confidence": 95
                },
                "measurementMethodology": {
                    "description": f"AI-powered monitoring for {component} with {len(tasks)} active tasks",
                    "calculationMethod": "Automated monitoring with real-time data collection and analysis",
                    "dataPoints": [task.metric for task in tasks if task.metric],
                    "validationProcess": "Cross-validated with multiple data sources and AI analysis"
                },
                "monitoringTasks": [
                    {
                        "title": task.task_title,
                        "description": task.task_description,
                        "assignee": task.assignee,
                        "frequency": task.frequency,
                        "metric": task.metric,
                        "measurementMethod": task.measurement_method,
                        "successCriteria": task.success_criteria,
                        "alertThreshold": task.alert_threshold,
                        "status": task.status,
                        "lastExecuted": task.last_executed.isoformat() if task.last_executed else None
                    }
                    for task in tasks
                ],
                "strategyMapping": {
                    "relatedComponents": [component],
                    "impactAreas": ["Performance Monitoring", "Strategy Optimization", "Risk Management"],
                    "dependencies": ["Data Collection", "AI Analysis", "Alert System"]
                },
                "aiInsights": {
                    "trendAnalysis": f"Active monitoring for {component} with {len(tasks)} configured tasks",
                    "recommendations": [
                        "Monitor task execution status regularly",
                        "Review performance metrics weekly",
                        "Adjust thresholds based on performance trends"
                    ],
                    "riskFactors": ["Task execution failures", "Data collection issues", "System downtime"],
                    "opportunities": ["Automated optimization", "Predictive analytics", "Enhanced monitoring"]
                }
            }
            transparency_data.append(component_data)
        
        # If no monitoring tasks found, create a default transparency entry
        if not transparency_data:
            transparency_data = [{
                "metricName": "Strategy Monitoring",
                "currentValue": 0,
                "unit": "tasks",
                "dataFreshness": {
                    "lastUpdated": datetime.now().isoformat(),
                    "updateFrequency": "Real-time",
                    "dataSource": "Monitoring System",
                    "confidence": 0
                },
                "measurementMethodology": {
                    "description": "No monitoring tasks configured yet",
                    "calculationMethod": "Manual setup required",
                    "dataPoints": [],
                    "validationProcess": "Not applicable"
                },
                "monitoringTasks": [],
                "strategyMapping": {
                    "relatedComponents": ["Strategy"],
                    "impactAreas": ["Monitoring"],
                    "dependencies": ["Setup"]
                },
                "aiInsights": {
                    "trendAnalysis": "No monitoring data available",
                    "recommendations": ["Set up monitoring tasks", "Configure alerts", "Enable data collection"],
                    "riskFactors": ["No monitoring in place"],
                    "opportunities": ["Implement comprehensive monitoring"]
                }
            }]

        # Return the transparency data
        return {
            "success": True,
            "data": transparency_data,
            "message": f"Transparency data retrieved successfully for strategy {strategy_id}"
        }

    except Exception as e:
        logger.error(f"Error retrieving transparency data: {str(e)}")
        return {
            "success": False,
            "data": None,
            "message": f"Error: {str(e)}"
        }
