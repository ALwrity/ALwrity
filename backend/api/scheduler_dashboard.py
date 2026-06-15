"""
Scheduler Dashboard API
Provides endpoints for scheduler dashboard UI.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from datetime import datetime
from loguru import logger

from services.scheduler import get_scheduler
from services.scheduler.utils.user_job_store import get_user_job_store_name
from services.monitoring_data_service import MonitoringDataService
from services.database import get_db
from middleware.auth_middleware import get_current_user
from models.monitoring_models import TaskExecutionLog, MonitoringTask
from models.scheduler_models import SchedulerEventLog
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from models.platform_insights_monitoring_models import PlatformInsightsTask, PlatformInsightsExecutionLog
from models.website_analysis_monitoring_models import (
    WebsiteAnalysisTask, WebsiteAnalysisExecutionLog, DeepWebsiteCrawlTask,
    OnboardingFullWebsiteAnalysisTask, DeepCompetitorAnalysisTask,
    SIFIndexingTask, MarketTrendsTask,
)
from models.advertools_monitoring_models import AdvertoolsTask

router = APIRouter(prefix="/api/scheduler", tags=["scheduler-dashboard"])


def _rebuild_cumulative_stats_from_events(db: Session) -> Dict[str, int]:
    """
    Rebuild cumulative stats by aggregating all check_cycle events from event logs.
    This is used as a fallback when the cumulative stats table doesn't exist or is invalid.
    
    Args:
        db: Database session
        
    Returns:
        Dictionary with cumulative stats
    """
    try:
        # Aggregate check cycle events for cumulative totals
        result = db.query(
            func.count(SchedulerEventLog.id),
            func.sum(SchedulerEventLog.tasks_found),
            func.sum(SchedulerEventLog.tasks_executed),
            func.sum(SchedulerEventLog.tasks_failed)
        ).filter(
            SchedulerEventLog.event_type == 'check_cycle'
        ).first()
        
        if result:
            # SQLAlchemy returns tuple for multi-column queries
            # SUM returns NULL when no rows, handle that
            total_cycles = result[0] if result[0] is not None else 0
            total_found = result[1] if result[1] is not None else 0
            total_executed = result[2] if result[2] is not None else 0
            total_failed = result[3] if result[3] is not None else 0
            
            return {
                'total_check_cycles': int(total_cycles),
                'cumulative_tasks_found': int(total_found),
                'cumulative_tasks_executed': int(total_executed),
                'cumulative_tasks_failed': int(total_failed),
                'cumulative_tasks_skipped': 0  # Not tracked in event logs currently
            }
        else:
            return {
                'total_check_cycles': 0,
                'cumulative_tasks_found': 0,
                'cumulative_tasks_executed': 0,
                'cumulative_tasks_failed': 0,
                'cumulative_tasks_skipped': 0
            }
    except Exception as e:
        logger.error(f"[Dashboard] Error rebuilding cumulative stats from events: {e}", exc_info=True)
        return {
            'total_check_cycles': 0,
            'cumulative_tasks_found': 0,
            'cumulative_tasks_executed': 0,
            'cumulative_tasks_failed': 0,
            'cumulative_tasks_skipped': 0
        }


@router.get("/dashboard")
async def get_scheduler_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get scheduler dashboard statistics and current state.
    
    Returns:
        - Scheduler stats (total checks, tasks executed, failed, etc.)
        - Current scheduled jobs
        - Active strategies count
        - Check interval
        - User isolation status
        - Last check timestamp
    """
    try:
        scheduler = get_scheduler()
        
        # Get user_id from current_user (Clerk format)
        user_id_str = str(current_user.get('id', '')) if current_user else None
        
        # Get scheduler stats
        stats = scheduler.get_stats(user_id=None)  # Get all stats for dashboard
        
        # Get all scheduled jobs
        all_jobs = scheduler.scheduler.get_jobs()
        
        # Format jobs with user context
        formatted_jobs = []
        for job in all_jobs:
            job_info = {
                'id': job.id,
                'trigger_type': type(job.trigger).__name__,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'user_id': None,
                'job_store': 'default',
                'user_job_store': 'default'
            }
            
            # Extract user_id from job
            user_id_from_job = None
            if hasattr(job, 'kwargs') and job.kwargs and job.kwargs.get('user_id'):
                user_id_from_job = job.kwargs.get('user_id')
            elif job.id and ('research_persona_' in job.id or 'facebook_persona_' in job.id):
                parts = job.id.split('_')
                if len(parts) >= 3:
                    user_id_from_job = parts[2]
            
            if user_id_from_job:
                job_info['user_id'] = user_id_from_job
                try:
                    user_job_store = get_user_job_store_name(user_id_from_job, db)
                    job_info['user_job_store'] = user_job_store
                except Exception as e:
                    logger.debug(f"Could not get job store for user {user_id_from_job}: {e}")
            
            formatted_jobs.append(job_info)
        
        # Add OAuth token monitoring tasks from database (these are recurring weekly tasks)
        try:
            oauth_tasks = db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.status == 'active'
            ).all()
            
            oauth_tasks_count = len(oauth_tasks)
            if oauth_tasks_count > 0:
                # Log platform breakdown for debugging
                platforms = {}
                for task in oauth_tasks:
                    platforms[task.platform] = platforms.get(task.platform, 0) + 1
                
                platform_summary = ", ".join([f"{platform}: {count}" for platform, count in platforms.items()])
                logger.warning(
                    f"[Dashboard] OAuth Monitoring: Found {oauth_tasks_count} active OAuth token monitoring tasks "
                    f"({platform_summary})"
                )
            else:
                # Check if there are any inactive tasks
                all_oauth_tasks = db.query(OAuthTokenMonitoringTask).all()
                if all_oauth_tasks:
                    inactive_by_status = {}
                    for task in all_oauth_tasks:
                        status = task.status
                        inactive_by_status[status] = inactive_by_status.get(status, 0) + 1
                    logger.warning(
                        f"[Dashboard] OAuth Monitoring: Found {len(all_oauth_tasks)} total OAuth tasks, "
                        f"but {oauth_tasks_count} are active. Status breakdown: {inactive_by_status}"
                    )
            
            for task in oauth_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception as e:
                    user_job_store = 'default'
                    logger.debug(f"Could not get job store for user {task.user_id}: {e}")
                
                # Format as recurring weekly job
                job_info = {
                    'id': f"oauth_token_monitoring_{task.platform}_{task.user_id}",
                    'trigger_type': 'CronTrigger',  # Weekly recurring
                    'next_run_time': task.next_check.isoformat() if task.next_check else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'oauth_token_monitoring_executor.execute_task',
                    'platform': task.platform,
                    'task_id': task.id,
                    'is_database_task': True,  # Flag to indicate this is a DB task, not APScheduler job
                    'frequency': 'Weekly'
                }
                
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading OAuth token monitoring tasks: {e}", exc_info=True)
        
        # Load website analysis tasks
        try:
            website_analysis_tasks = db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.status == 'active'
            ).all()
            
            # Filter by user if user_id_str is provided
            if user_id_str:
                website_analysis_tasks = [t for t in website_analysis_tasks if t.user_id == user_id_str]
            
            for task in website_analysis_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception as e:
                    user_job_store = 'default'
                    logger.debug(f"Could not get job store for user {task.user_id}: {e}")
                
                # Format as recurring job
                job_info = {
                    'id': f"website_analysis_{task.task_type}_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger',  # Recurring based on frequency_days
                    'next_run_time': task.next_check.isoformat() if task.next_check else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'website_analysis_executor.execute_task',
                    'task_type': task.task_type,  # 'user_website' or 'competitor'
                    'website_url': task.website_url,
                    'competitor_id': task.competitor_id,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': f'Every {task.frequency_days} days',
                    'task_category': 'website_analysis'
                }
                
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading website analysis tasks: {e}", exc_info=True)
        
        # Load platform insights tasks (GSC and Bing)
        try:
            insights_tasks = db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.status == 'active'
            ).all()
            
            # Filter by user if user_id_str is provided
            if user_id_str:
                insights_tasks = [t for t in insights_tasks if t.user_id == user_id_str]
            
            for task in insights_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception as e:
                    user_job_store = 'default'
                    logger.debug(f"Could not get job store for user {task.user_id}: {e}")
                
                # Format as recurring weekly job
                job_info = {
                    'id': f"platform_insights_{task.platform}_{task.user_id}",
                    'trigger_type': 'CronTrigger',  # Weekly recurring
                    'next_run_time': task.next_check.isoformat() if task.next_check else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': f'{task.platform}_insights_executor.execute_task',
                    'platform': task.platform,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': 'Weekly',
                    'task_category': 'platform_insights'
                }
                
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading platform insights tasks: {e}", exc_info=True)
            
        # Load deep website crawl tasks
        try:
            crawl_tasks = db.query(DeepWebsiteCrawlTask).filter(
                DeepWebsiteCrawlTask.status.in_(['active', 'retry'])
            ).all()
            
            # Filter by user if user_id_str is provided
            if user_id_str:
                crawl_tasks = [t for t in crawl_tasks if t.user_id == user_id_str]
            
            for task in crawl_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception as e:
                    user_job_store = 'default'
                    logger.debug(f"Could not get job store for user {task.user_id}: {e}")
                
                # Format as recurring weekly job
                job_info = {
                    'id': f"deep_website_crawl_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger',  # Weekly recurring
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'deep_website_crawl_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': 'Weekly',
                    'task_category': 'deep_website_crawl'
                }
                
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading deep website crawl tasks: {e}", exc_info=True)
        
        # Load onboarding full website analysis tasks
        try:
            onboarding_tasks = db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.status.in_(['active', 'failed', 'needs_intervention'])
            ).all()
            
            if user_id_str:
                onboarding_tasks = [t for t in onboarding_tasks if t.user_id == user_id_str]
            
            for task in onboarding_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception:
                    user_job_store = 'default'
                
                job_info = {
                    'id': f"onboarding_full_website_analysis_{task.user_id}_{task.id}",
                    'trigger_type': 'DateTrigger' if task.status != 'active' else 'CronTrigger',
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'onboarding_full_website_analysis_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': 'One-time' if task.status == 'completed' else 'Once',
                    'task_category': 'onboarding_full_website_analysis',
                    'status': task.status,
                    'last_success': task.last_success.isoformat() if task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                    'failure_reason': task.failure_reason,
                    'consecutive_failures': task.consecutive_failures,
                }
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading onboarding full website analysis tasks: {e}", exc_info=True)
        
        # Load deep competitor analysis tasks
        try:
            competitor_tasks = db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.status.in_(['active', 'failed', 'needs_intervention'])
            ).all()
            
            if user_id_str:
                competitor_tasks = [t for t in competitor_tasks if t.user_id == user_id_str]
            
            for task in competitor_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception:
                    user_job_store = 'default'
                
                payload = task.payload or {}
                frequency_label = 'Weekly' if payload.get('mode') == 'strategic_insights' else 'One-time'
                job_info = {
                    'id': f"deep_competitor_analysis_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger' if frequency_label == 'Weekly' else 'DateTrigger',
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'deep_competitor_analysis_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': frequency_label,
                    'task_category': 'deep_competitor_analysis',
                    'status': task.status,
                    'last_success': task.last_success.isoformat() if task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                    'failure_reason': task.failure_reason,
                    'consecutive_failures': task.consecutive_failures,
                }
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading deep competitor analysis tasks: {e}", exc_info=True)
        
        # Load SIF indexing tasks
        try:
            sif_tasks = db.query(SIFIndexingTask).filter(
                SIFIndexingTask.status.in_(['active', 'failed', 'needs_intervention'])
            ).all()
            
            if user_id_str:
                sif_tasks = [t for t in sif_tasks if t.user_id == user_id_str]
            
            for task in sif_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception:
                    user_job_store = 'default'
                
                job_info = {
                    'id': f"sif_indexing_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger',
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'sif_indexing_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': f'Every {task.frequency_hours}h' if task.frequency_hours else 'Every 48h',
                    'task_category': 'sif_indexing',
                    'status': task.status,
                    'last_success': task.last_success.isoformat() if task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                    'failure_reason': task.failure_reason,
                    'consecutive_failures': task.consecutive_failures,
                }
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading SIF indexing tasks: {e}", exc_info=True)
        
        # Load market trends tasks
        try:
            trends_tasks = db.query(MarketTrendsTask).filter(
                MarketTrendsTask.status.in_(['active', 'failed', 'needs_intervention'])
            ).all()
            
            if user_id_str:
                trends_tasks = [t for t in trends_tasks if t.user_id == user_id_str]
            
            for task in trends_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception:
                    user_job_store = 'default'
                
                job_info = {
                    'id': f"market_trends_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger',
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'market_trends_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': f'Every {task.frequency_hours}h' if task.frequency_hours else 'Every 72h',
                    'task_category': 'market_trends',
                    'status': task.status,
                    'last_success': task.last_success.isoformat() if task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                    'failure_reason': task.failure_reason,
                    'consecutive_failures': task.consecutive_failures,
                }
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading market trends tasks: {e}", exc_info=True)
        
        # Load advertools tasks
        try:
            advertools_tasks = db.query(AdvertoolsTask).filter(
                AdvertoolsTask.status.in_(['active', 'failed', 'paused'])
            ).all()
            
            if user_id_str:
                advertools_tasks = [t for t in advertools_tasks if t.user_id == user_id_str]
            
            for task in advertools_tasks:
                try:
                    user_job_store = get_user_job_store_name(task.user_id, db)
                except Exception:
                    user_job_store = 'default'
                
                job_info = {
                    'id': f"advertools_{task.user_id}_{task.id}",
                    'trigger_type': 'CronTrigger',
                    'next_run_time': task.next_execution.isoformat() if task.next_execution else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': user_job_store,
                    'function_name': 'advertools_executor.execute_task',
                    'website_url': task.website_url,
                    'task_id': task.id,
                    'is_database_task': True,
                    'frequency': f'Every {task.frequency_days}d' if task.frequency_days else 'Weekly',
                    'task_category': 'advertools',
                    'status': task.status,
                    'last_success': task.last_success.isoformat() if task.last_success else None,
                    'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                    'failure_reason': task.failure_reason,
                    'consecutive_failures': task.consecutive_failures,
                }
                formatted_jobs.append(job_info)
        except Exception as e:
            logger.error(f"Error loading advertools tasks: {e}", exc_info=True)
        
        # Get active strategies count
        active_strategies = stats.get('active_strategies_count', 0)
        
        # Get last_update from stats (added by scheduler for frontend polling)
        last_update = stats.get('last_update')
        
        # Calculate cumulative/historical values from persistent cumulative stats table
        # Fallback to event logs aggregation if cumulative stats table doesn't exist or is invalid
        cumulative_stats = {}
        try:
            from models.scheduler_cumulative_stats_model import SchedulerCumulativeStats
            
            # Try to get cumulative stats from dedicated table (persistent across restarts)
            cumulative_stats_row = db.query(SchedulerCumulativeStats).filter(
                SchedulerCumulativeStats.id == 1
            ).first()
            
            if cumulative_stats_row:
                # Use persistent cumulative stats
                cumulative_stats = {
                    'total_check_cycles': int(cumulative_stats_row.total_check_cycles or 0),
                    'cumulative_tasks_found': int(cumulative_stats_row.cumulative_tasks_found or 0),
                    'cumulative_tasks_executed': int(cumulative_stats_row.cumulative_tasks_executed or 0),
                    'cumulative_tasks_failed': int(cumulative_stats_row.cumulative_tasks_failed or 0),
                    'cumulative_tasks_skipped': int(cumulative_stats_row.cumulative_tasks_skipped or 0),
                    'cumulative_job_completed': int(cumulative_stats_row.cumulative_job_completed or 0),
                    'cumulative_job_failed': int(cumulative_stats_row.cumulative_job_failed or 0)
                }
                
                logger.debug(
                    f"[Dashboard] Using persistent cumulative stats: "
                    f"cycles={cumulative_stats['total_check_cycles']}, "
                    f"found={cumulative_stats['cumulative_tasks_found']}, "
                    f"executed={cumulative_stats['cumulative_tasks_executed']}, "
                    f"failed={cumulative_stats['cumulative_tasks_failed']}"
                )
                
                # Validate cumulative stats by comparing with event logs (for verification)
                check_cycle_count = db.query(func.count(SchedulerEventLog.id)).filter(
                    SchedulerEventLog.event_type == 'check_cycle'
                ).scalar() or 0
                
                if cumulative_stats['total_check_cycles'] != check_cycle_count:
                    logger.warning(
                        f"[Dashboard] ⚠️ Cumulative stats validation mismatch: "
                        f"cumulative_stats.total_check_cycles={cumulative_stats['total_check_cycles']} "
                        f"vs event_logs.count={check_cycle_count}. "
                        f"Rebuilding cumulative stats from event logs..."
                    )
                    # Rebuild cumulative stats from event logs
                    cumulative_stats = _rebuild_cumulative_stats_from_events(db)
                    # Update the persistent table
                    if cumulative_stats_row:
                        cumulative_stats_row.total_check_cycles = cumulative_stats['total_check_cycles']
                        cumulative_stats_row.cumulative_tasks_found = cumulative_stats['cumulative_tasks_found']
                        cumulative_stats_row.cumulative_tasks_executed = cumulative_stats['cumulative_tasks_executed']
                        cumulative_stats_row.cumulative_tasks_failed = cumulative_stats['cumulative_tasks_failed']
                        cumulative_stats_row.cumulative_tasks_skipped = cumulative_stats.get('cumulative_tasks_skipped', 0)
                        db.commit()
                    logger.warning(f"[Dashboard] ✅ Rebuilt cumulative stats: {cumulative_stats}")
            else:
                # Cumulative stats table doesn't exist or is empty, rebuild from event logs
                logger.warning(
                    "[Dashboard] Cumulative stats table not found or empty. "
                    "Rebuilding from event logs..."
                )
                cumulative_stats = _rebuild_cumulative_stats_from_events(db)
                
                # Create/update the persistent table
                cumulative_stats_row = SchedulerCumulativeStats.get_or_create(db)
                cumulative_stats_row.total_check_cycles = cumulative_stats['total_check_cycles']
                cumulative_stats_row.cumulative_tasks_found = cumulative_stats['cumulative_tasks_found']
                cumulative_stats_row.cumulative_tasks_executed = cumulative_stats['cumulative_tasks_executed']
                cumulative_stats_row.cumulative_tasks_failed = cumulative_stats['cumulative_tasks_failed']
                cumulative_stats_row.cumulative_tasks_skipped = cumulative_stats.get('cumulative_tasks_skipped', 0)
                db.commit()
                logger.warning(f"[Dashboard] ✅ Created/updated cumulative stats: {cumulative_stats}")
                
        except ImportError:
            # Cumulative stats model doesn't exist yet (migration not run)
            logger.warning(
                "[Dashboard] Cumulative stats model not found. "
                "Falling back to event logs aggregation. "
                "Run migration: create_scheduler_cumulative_stats.sql"
            )
            cumulative_stats = _rebuild_cumulative_stats_from_events(db)
        except Exception as e:
            logger.error(f"[Dashboard] Error getting cumulative stats: {e}", exc_info=True)
            # Fallback to event logs aggregation
            cumulative_stats = _rebuild_cumulative_stats_from_events(db)
        
        return {
            'stats': {
                # Current session stats (from scheduler memory)
                'total_checks': stats.get('total_checks', 0),
                'tasks_found': stats.get('tasks_found', 0),
                'tasks_executed': stats.get('tasks_executed', 0),
                'tasks_failed': stats.get('tasks_failed', 0),
                'tasks_skipped': stats.get('tasks_skipped', 0),
                'last_check': stats.get('last_check'),
                'last_update': last_update,  # Include for frontend polling
                'active_executions': stats.get('active_executions', 0),
                'running': stats.get('running', False),
                'check_interval_minutes': stats.get('check_interval_minutes', 60),
                'min_check_interval_minutes': stats.get('min_check_interval_minutes', 15),
                'max_check_interval_minutes': stats.get('max_check_interval_minutes', 60),
                'intelligent_scheduling': stats.get('intelligent_scheduling', True),
                'active_strategies_count': active_strategies,
                'last_interval_adjustment': stats.get('last_interval_adjustment'),
                'registered_types': stats.get('registered_types', []),
                # Cumulative/historical stats (from database)
                'cumulative_total_check_cycles': cumulative_stats.get('total_check_cycles', 0),
                'cumulative_tasks_found': cumulative_stats.get('cumulative_tasks_found', 0),
                'cumulative_tasks_executed': cumulative_stats.get('cumulative_tasks_executed', 0),
                'cumulative_tasks_failed': cumulative_stats.get('cumulative_tasks_failed', 0)
            },
            'jobs': formatted_jobs,
            'job_count': len(formatted_jobs),
            'recurring_jobs': 1 + len([j for j in formatted_jobs if j.get('is_database_task')]),  # check_due_tasks + all DB tasks
            'one_time_jobs': len([j for j in formatted_jobs if not j.get('is_database_task') and j.get('trigger_type') == 'DateTrigger']),
            'registered_task_types': stats.get('registered_types', []),  # Include registered task types
            'user_isolation': {
                'enabled': True,
                'current_user_id': user_id_str
            },
            'last_updated': datetime.utcnow().isoformat()  # Keep for backward compatibility
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler dashboard: {str(e)}")


@router.get("/execution-logs")
async def get_execution_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, regex="^(success|failed|running|skipped)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get task execution logs from database.
    
    Query Params:
        - limit: Number of logs to return (1-500, default: 50)
        - offset: Pagination offset (default: 0)
        - status: Filter by status (success, failed, running, skipped)
    
    Returns:
        - List of execution logs with task details
        - Total count for pagination
    """
    try:
        # Get user_id from current_user (Clerk format - convert to int if needed)
        user_id_str = str(current_user.get('id', '')) if current_user else None
        
        # Check if user_id column exists in the database
        from sqlalchemy import inspect
        inspector = inspect(db.bind)
        columns = [col['name'] for col in inspector.get_columns('task_execution_logs')]
        has_user_id_column = 'user_id' in columns
        
        # If user_id column doesn't exist, we need to handle the query differently
        # to avoid SQLAlchemy trying to access a non-existent column
        if not has_user_id_column:
            # Query without user_id column - use explicit column selection
            from sqlalchemy import func
            
            # Build query for count
            count_query = db.query(func.count(TaskExecutionLog.id)).join(
                MonitoringTask,
                TaskExecutionLog.task_id == MonitoringTask.id
            )
            
            # Filter by status if provided
            if status:
                count_query = count_query.filter(TaskExecutionLog.status == status)
            
            total_count = count_query.scalar() or 0
            
            # Build query for data - select specific columns to avoid user_id
            query = db.query(
                TaskExecutionLog.id,
                TaskExecutionLog.task_id,
                TaskExecutionLog.execution_date,
                TaskExecutionLog.status,
                TaskExecutionLog.result_data,
                TaskExecutionLog.error_message,
                TaskExecutionLog.execution_time_ms,
                TaskExecutionLog.created_at,
                MonitoringTask
            ).join(
                MonitoringTask,
                TaskExecutionLog.task_id == MonitoringTask.id
            )
            
            # Filter by status if provided
            if status:
                query = query.filter(TaskExecutionLog.status == status)
            
            # Get paginated results
            logs = query.order_by(TaskExecutionLog.execution_date.desc()).offset(offset).limit(limit).all()
            
            # Format results for compatibility
            formatted_logs = []
            for log_tuple in logs:
                # Unpack the tuple
                log_id, task_id, execution_date, log_status, result_data, error_message, execution_time_ms, created_at, task = log_tuple
                
                log_data = {
                    'id': log_id,
                    'task_id': task_id,
                    'user_id': None,  # No user_id column in database
                    'execution_date': execution_date.isoformat() if execution_date else None,
                    'status': log_status,
                    'error_message': error_message,
                    'execution_time_ms': execution_time_ms,
                    'result_data': result_data,
                    'created_at': created_at.isoformat() if created_at else None
                }
                
                # Add task details
                if task:
                    log_data['task'] = {
                        'id': task.id,
                        'task_title': task.task_title,
                        'component_name': task.component_name,
                        'metric': task.metric,
                        'frequency': task.frequency
                    }
                
                formatted_logs.append(log_data)
            
            return {
                'logs': formatted_logs,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': (offset + limit) < total_count,
                'is_scheduler_logs': False  # Explicitly mark as execution logs, not scheduler logs
            }
        
        # If user_id column exists, use the normal query path
        # Build query with eager loading of task relationship
        query = db.query(TaskExecutionLog).join(
            MonitoringTask,
            TaskExecutionLog.task_id == MonitoringTask.id
        ).options(
            joinedload(TaskExecutionLog.task)
        )
        
        # Filter by status if provided
        if status:
            query = query.filter(TaskExecutionLog.status == status)
        
        # Filter by user_id if provided (for user isolation)
        if user_id_str and has_user_id_column:
            # Note: user_id in TaskExecutionLog is Integer, but we have Clerk string
            # For now, get all logs - can enhance later with user_id mapping
            pass
        
        # Get total count
        total_count = query.count()
        
        # Get paginated results
        logs = query.order_by(desc(TaskExecutionLog.execution_date)).offset(offset).limit(limit).all()
        
        # Format results
        formatted_logs = []
        for log in logs:
            log_data = {
                'id': log.id,
                'task_id': log.task_id,
                'user_id': log.user_id if has_user_id_column else None,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'result_data': log.result_data,
                'created_at': log.created_at.isoformat() if log.created_at else None
            }
            
            # Add task details if available
            if log.task:
                log_data['task'] = {
                    'id': log.task.id,
                    'task_title': log.task.task_title,
                    'component_name': log.task.component_name,
                    'metric': log.task.metric,
                    'frequency': log.task.frequency
                }
            
            formatted_logs.append(log_data)
        
        return {
            'logs': formatted_logs,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count,
            'is_scheduler_logs': False  # Explicitly mark as execution logs, not scheduler logs
        }
        
    except Exception as e:
        logger.error(f"Error getting execution logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get execution logs: {str(e)}")


@router.get("/jobs")
async def get_scheduler_jobs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about all scheduled jobs.
    
    Returns:
        - List of jobs with detailed information
        - Job ID, trigger type, next run time
        - User context (extracted from job ID/kwargs)
        - Job store name (from user's website root)
    """
    try:
        scheduler = get_scheduler()
        all_jobs = scheduler.scheduler.get_jobs()
        
        formatted_jobs = []
        for job in all_jobs:
            job_info = {
                'id': job.id,
                'trigger_type': type(job.trigger).__name__,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'jobstore': getattr(job, 'jobstore', 'default'),
                'user_id': None,
                'user_job_store': 'default',
                'function_name': None
            }
            
            # Extract user_id from job
            user_id_from_job = None
            if hasattr(job, 'kwargs') and job.kwargs and job.kwargs.get('user_id'):
                user_id_from_job = job.kwargs.get('user_id')
            elif job.id and ('research_persona_' in job.id or 'facebook_persona_' in job.id):
                parts = job.id.split('_')
                if len(parts) >= 3:
                    user_id_from_job = parts[2]
            
            if user_id_from_job:
                job_info['user_id'] = user_id_from_job
                try:
                    user_job_store = get_user_job_store_name(user_id_from_job, db)
                    job_info['user_job_store'] = user_job_store
                except Exception as e:
                    logger.debug(f"Could not get job store for user {user_id_from_job}: {e}")
            
            # Get function name if available
            if hasattr(job, 'func') and hasattr(job.func, '__name__'):
                job_info['function_name'] = job.func.__name__
            elif hasattr(job, 'func_ref'):
                job_info['function_name'] = str(job.func_ref)
            
            formatted_jobs.append(job_info)
        
        return {
            'jobs': formatted_jobs,
            'total_jobs': len(formatted_jobs),
            'recurring_jobs': 1,  # check_due_tasks
            'one_time_jobs': len(formatted_jobs) - 1
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler jobs: {str(e)}")


@router.get("/event-history")
async def get_scheduler_event_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, regex="^(check_cycle|interval_adjustment|start|stop|job_scheduled|job_cancelled|job_completed|job_failed)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get scheduler event history from database.
    
    This endpoint returns historical scheduler events such as:
    - Check cycles (when scheduler runs and checks for due tasks)
    - Interval adjustments (when check interval changes)
    - Scheduler start/stop events
    - Job scheduled/cancelled events
    
    Query Params:
        - limit: Number of events to return (1-1000, default: 100)
        - offset: Pagination offset (default: 0)
        - event_type: Filter by event type (check_cycle, interval_adjustment, start, stop, etc.)
    
    Returns:
        - List of scheduler events with details
        - Total count for pagination
    """
    try:
        # Build query
        query = db.query(SchedulerEventLog)
        
        # Filter by event type if provided
        if event_type:
            query = query.filter(SchedulerEventLog.event_type == event_type)
        
        # Get total count
        total_count = query.count()
        
        # Get paginated results (most recent first)
        events = query.order_by(desc(SchedulerEventLog.event_date)).offset(offset).limit(limit).all()
        
        # Format results
        formatted_events = []
        for event in events:
            event_data = {
                'id': event.id,
                'event_type': event.event_type,
                'event_date': event.event_date.isoformat() if event.event_date else None,
                'check_cycle_number': event.check_cycle_number,
                'check_interval_minutes': event.check_interval_minutes,
                'previous_interval_minutes': event.previous_interval_minutes,
                'new_interval_minutes': event.new_interval_minutes,
                'tasks_found': event.tasks_found,
                'tasks_executed': event.tasks_executed,
                'tasks_failed': event.tasks_failed,
                'tasks_by_type': event.tasks_by_type,
                'check_duration_seconds': event.check_duration_seconds,
                'active_strategies_count': event.active_strategies_count,
                'active_executions': event.active_executions,
                'job_id': event.job_id,
                'job_type': event.job_type,
                'user_id': event.user_id,
                'event_data': event.event_data,
                'error_message': event.error_message,
                'created_at': event.created_at.isoformat() if event.created_at else None
            }
            formatted_events.append(event_data)
        
        return {
            'events': formatted_events,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count
        }
        
    except Exception as e:
        logger.error(f"Error getting scheduler event history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler event history: {str(e)}")


@router.get("/recent-scheduler-logs")
async def get_recent_scheduler_logs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent scheduler logs (restoration, job scheduling, etc.) for display in Execution Logs.
    These are informational logs that show scheduler activity when actual execution logs are not available.
    
    Returns only the latest 5 logs (rolling window, not accumulating).
    
    Returns:
        - List of latest 5 scheduler events (job_scheduled, job_completed, job_failed)
        - Formatted as execution log-like entries for display
    """
    try:
        # Get only the latest 5 scheduler events - simple rolling window
        # Focus on job-related events that indicate scheduler activity
        query = db.query(SchedulerEventLog).filter(
            SchedulerEventLog.event_type.in_(['job_scheduled', 'job_completed', 'job_failed'])
        ).order_by(desc(SchedulerEventLog.event_date)).limit(5)
        
        events = query.all()
        
        # Log for debugging - show more details
        logger.warning(
            f"[Dashboard] Recent scheduler logs query: found {len(events)} events"
        )
        if events:
            for e in events:
                logger.warning(
                    f"[Dashboard]   - Event: {e.event_type} | "
                    f"Job ID: {e.job_id} | User: {e.user_id} | "
                    f"Date: {e.event_date} | Error: {bool(e.error_message)}"
                )
        else:
            # Check if there are ANY events of these types
            total_count = db.query(func.count(SchedulerEventLog.id)).filter(
                SchedulerEventLog.event_type.in_(['job_scheduled', 'job_completed', 'job_failed'])
            ).scalar() or 0
            logger.warning(
                f"[Dashboard] No recent scheduler logs found (query returned 0). "
                f"Total events of these types in DB: {total_count}"
            )
        
        # Format as execution log-like entries
        formatted_logs = []
        for event in events:
            event_data = event.event_data or {}
            
            # Determine status based on event type
            status = 'running'
            if event.event_type == 'job_completed':
                status = 'success'
            elif event.event_type == 'job_failed':
                status = 'failed'
            
            # Extract job function name
            job_function = event_data.get('job_function') or event_data.get('function_name') or 'unknown'
            
            # Extract execution time if available
            execution_time_ms = None
            if event_data.get('execution_time_seconds'):
                execution_time_ms = int(event_data.get('execution_time_seconds', 0) * 1000)
            
            log_entry = {
                'id': f"scheduler_event_{event.id}",
                'task_id': None,
                'user_id': event.user_id,
                'execution_date': event.event_date.isoformat() if event.event_date else None,
                'status': status,
                'error_message': event.error_message,
                'execution_time_ms': execution_time_ms,
                'result_data': None,
                'created_at': event.created_at.isoformat() if event.created_at else None,
                'task': {
                    'id': None,
                    'task_title': f"{event.event_type.replace('_', ' ').title()}: {event.job_id or 'N/A'}",
                    'component_name': 'Scheduler',
                    'metric': job_function,
                    'frequency': 'one-time'
                },
                'is_scheduler_log': True,  # Flag to indicate this is a scheduler log, not execution log
                'event_type': event.event_type,
                'job_id': event.job_id
            }
            
            formatted_logs.append(log_entry)
        
        # Log the formatted response for debugging
        logger.warning(
            f"[Dashboard] Formatted {len(formatted_logs)} scheduler logs for response. "
            f"Sample log entry keys: {list(formatted_logs[0].keys()) if formatted_logs else 'none'}"
        )
        
        return {
            'logs': formatted_logs,
            'total_count': len(formatted_logs),
            'limit': 5,
            'offset': 0,
            'has_more': False,
            'is_scheduler_logs': True  # Indicate these are scheduler logs, not execution logs
        }
        
    except Exception as e:
        logger.error(f"Error getting recent scheduler logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recent scheduler logs: {str(e)}")


@router.get("/platform-insights/status/{user_id}")
async def get_platform_insights_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get platform insights task status for a user.
    
    Returns:
        - GSC insights tasks
        - Bing insights tasks
        - Task details and execution logs
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.debug(f"[Platform Insights Status] Getting status for user: {user_id}")
        
        # Get all insights tasks for user
        tasks = db.query(PlatformInsightsTask).filter(
            PlatformInsightsTask.user_id == user_id
        ).order_by(PlatformInsightsTask.platform, PlatformInsightsTask.created_at).all()
        
        # Check if user has connected platforms but missing insights tasks
        # Auto-create missing tasks for connected platforms
        from services.oauth_token_monitoring_service import get_connected_platforms
        from services.platform_insights_monitoring_service import create_platform_insights_task
        
        connected_platforms = get_connected_platforms(user_id)
        insights_platforms = ['gsc', 'bing']
        connected_insights = [p for p in connected_platforms if p in insights_platforms]
        
        existing_platforms = {task.platform for task in tasks}
        missing_platforms = [p for p in connected_insights if p not in existing_platforms]
        
        if missing_platforms:
            logger.info(
                f"[Platform Insights Status] User {user_id} has connected platforms {missing_platforms} "
                f"but missing insights tasks. Creating tasks..."
            )
            
            for platform in missing_platforms:
                try:
                    # Don't fetch site_url here - it requires API calls
                    # The executor will fetch it when the task runs
                    # Create task without site_url to avoid API calls during status checks
                    result = create_platform_insights_task(
                        user_id=user_id,
                        platform=platform,
                        site_url=None,  # Will be fetched by executor when task runs
                        db=db
                    )
                    
                    if result.get('success'):
                        logger.info(f"[Platform Insights Status] Created {platform.upper()} insights task for user {user_id}")
                    else:
                        logger.warning(f"[Platform Insights Status] Failed to create {platform} task: {result.get('error')}")
                except Exception as e:
                    logger.warning(f"[Platform Insights Status] Error creating {platform} task: {e}", exc_info=True)
            
            # Re-query tasks after creation
            tasks = db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.user_id == user_id
            ).order_by(PlatformInsightsTask.platform, PlatformInsightsTask.created_at).all()
        
        # Group tasks by platform
        gsc_tasks = [t for t in tasks if t.platform == 'gsc']
        bing_tasks = [t for t in tasks if t.platform == 'bing']
        
        logger.debug(
            f"[Platform Insights Status] Found {len(tasks)} total tasks: "
            f"{len(gsc_tasks)} GSC, {len(bing_tasks)} Bing"
        )
        
        # Format tasks
        def format_task(task: PlatformInsightsTask) -> Dict[str, Any]:
            return {
                'id': task.id,
                'platform': task.platform,
                'site_url': task.site_url,
                'status': task.status,
                'last_check': task.last_check.isoformat() if task.last_check else None,
                'last_success': task.last_success.isoformat() if task.last_success else None,
                'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                'failure_reason': task.failure_reason,
                'next_check': task.next_check.isoformat() if task.next_check else None,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None
            }
        
        return {
            'success': True,
            'user_id': user_id,
            'gsc_tasks': [format_task(t) for t in gsc_tasks],
            'bing_tasks': [format_task(t) for t in bing_tasks],
            'total_tasks': len(tasks)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform insights status for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get platform insights status: {str(e)}")


@router.get("/website-analysis/status/{user_id}")
async def get_website_analysis_status(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get website analysis task status for a user.
    
    Returns:
        - User website tasks
        - Competitor website tasks
        - Task details and execution logs
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.debug(f"[Website Analysis Status] Getting status for user: {user_id}")
        
        # Get all website analysis tasks for user
        tasks = db.query(WebsiteAnalysisTask).filter(
            WebsiteAnalysisTask.user_id == user_id
        ).order_by(WebsiteAnalysisTask.task_type, WebsiteAnalysisTask.created_at).all()
        
        # Separate user website and competitor tasks
        user_website_tasks = [t for t in tasks if t.task_type == 'user_website']
        competitor_tasks = [t for t in tasks if t.task_type == 'competitor']
        
        logger.debug(
            f"[Website Analysis Status] Found {len(tasks)} tasks for user {user_id}: "
            f"{len(user_website_tasks)} user website, {len(competitor_tasks)} competitors"
        )
        
        # Format tasks
        def format_task(task: WebsiteAnalysisTask) -> Dict[str, Any]:
            return {
                'id': task.id,
                'website_url': task.website_url,
                'task_type': task.task_type,
                'competitor_id': task.competitor_id,
                'status': task.status,
                'last_check': task.last_check.isoformat() if task.last_check else None,
                'last_success': task.last_success.isoformat() if task.last_success else None,
                'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                'failure_reason': task.failure_reason,
                'next_check': task.next_check.isoformat() if task.next_check else None,
                'frequency_days': task.frequency_days,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None
            }
        
        active_tasks = len([t for t in tasks if t.status == 'active'])
        failed_tasks = len([t for t in tasks if t.status == 'failed'])
        
        return {
            'success': True,
            'data': {
                'user_id': user_id,
                'user_website_tasks': [format_task(t) for t in user_website_tasks],
                'competitor_tasks': [format_task(t) for t in competitor_tasks],
                'total_tasks': len(tasks),
                'active_tasks': active_tasks,
                'failed_tasks': failed_tasks
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting website analysis status for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get website analysis status: {str(e)}")


@router.get("/website-analysis/logs/{user_id}")
async def get_website_analysis_logs(
    user_id: str,
    task_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get execution logs for website analysis tasks.
    
    Args:
        user_id: User ID
        task_id: Optional task ID to filter logs
        limit: Maximum number of logs to return
        offset: Pagination offset
        
    Returns:
        List of execution logs
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        query = db.query(WebsiteAnalysisExecutionLog).join(
            WebsiteAnalysisTask,
            WebsiteAnalysisExecutionLog.task_id == WebsiteAnalysisTask.id
        ).filter(
            WebsiteAnalysisTask.user_id == user_id
        )
        
        if task_id:
            query = query.filter(WebsiteAnalysisExecutionLog.task_id == task_id)
        
        # Get total count
        total_count = query.count()
        
        logs = query.order_by(
            desc(WebsiteAnalysisExecutionLog.execution_date)
        ).offset(offset).limit(limit).all()
        
        # Format logs
        formatted_logs = []
        for log in logs:
            # Get task details
            task = db.query(WebsiteAnalysisTask).filter(WebsiteAnalysisTask.id == log.task_id).first()
            
            formatted_logs.append({
                'id': log.id,
                'task_id': log.task_id,
                'website_url': task.website_url if task else None,
                'task_type': task.task_type if task else None,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'result_data': log.result_data,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'created_at': log.created_at.isoformat() if log.created_at else None
            })
        
        return {
            'logs': formatted_logs,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting website analysis logs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get website analysis logs: {str(e)}")


@router.post("/website-analysis/retry/{task_id}")
async def retry_website_analysis(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually retry a failed website analysis task.
    
    Args:
        task_id: Task ID to retry
        
    Returns:
        Success status and updated task details
    """
    try:
        # Get task
        task = db.query(WebsiteAnalysisTask).filter(WebsiteAnalysisTask.id == task_id).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Verify user can only access their own tasks
        if str(current_user.get('id')) != task.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Reset task status and schedule immediate execution
        task.status = 'active'
        task.failure_reason = None
        task.next_check = datetime.utcnow()  # Schedule immediately
        task.updated_at = datetime.utcnow()
        
        db.commit()
        
        logger.info(f"Manually retried website analysis task {task_id} for user {task.user_id}")
        
        return {
            'success': True,
            'message': f'Website analysis task {task_id} scheduled for immediate execution',
            'task': {
                'id': task.id,
                'website_url': task.website_url,
                'status': task.status,
                'next_check': task.next_check.isoformat() if task.next_check else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrying website analysis task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retry website analysis: {str(e)}")


@router.get("/tasks-needing-intervention/{user_id}")
async def get_tasks_needing_intervention(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all tasks that need human intervention.
    
    Args:
        user_id: User ID
        
    Returns:
        List of tasks needing intervention with failure pattern details
    """
    try:
        # Verify user access
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        from services.scheduler.core.failure_detection_service import FailureDetectionService
        detection_service = FailureDetectionService(db)
        
        tasks = detection_service.get_tasks_needing_intervention(user_id=user_id)
        
        return {
            "success": True,
            "tasks": tasks,
            "count": len(tasks)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tasks needing intervention: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get tasks needing intervention: {str(e)}")


@router.post("/tasks/{task_type}/{task_id}/manual-trigger")
async def manual_trigger_task(
    task_type: str,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually trigger a task that is in cool-off or needs intervention.
    This bypasses the cool-off check and executes the task immediately.
    
    Args:
        task_type: Task type (oauth_token_monitoring, website_analysis, gsc_insights, bing_insights,
                    onboarding_full_website_analysis, deep_competitor_analysis, sif_indexing,
                    market_trends, advertools)
        task_id: Task ID
        
    Returns:
        Success status and execution result
    """
    try:
        from services.scheduler.core.task_execution_handler import execute_task_async
        scheduler = get_scheduler()
        
        # Load task based on type
        task = None
        if task_type == "oauth_token_monitoring":
            task = db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.id == task_id
            ).first()
        elif task_type == "website_analysis":
            task = db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.id == task_id
            ).first()
        elif task_type in ["gsc_insights", "bing_insights"]:
            task = db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.id == task_id
            ).first()
        elif task_type == "onboarding_full_website_analysis":
            task = db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.id == task_id
            ).first()
        elif task_type == "deep_competitor_analysis":
            task = db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.id == task_id
            ).first()
        elif task_type == "sif_indexing":
            task = db.query(SIFIndexingTask).filter(
                SIFIndexingTask.id == task_id
            ).first()
        elif task_type == "market_trends":
            task = db.query(MarketTrendsTask).filter(
                MarketTrendsTask.id == task_id
            ).first()
        elif task_type == "advertools":
            task = db.query(AdvertoolsTask).filter(
                AdvertoolsTask.id == task_id
            ).first()
        elif task_type == "deep_website_crawl":
            task = db.query(DeepWebsiteCrawlTask).filter(
                DeepWebsiteCrawlTask.id == task_id
            ).first()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown task type: {task_type}")
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Verify user access
        if str(current_user.get('id')) != task.user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Clear cool-off status and reset failure count
        task.status = "active"
        task.consecutive_failures = 0
        task.failure_pattern = None
        
        # Execute task manually (bypasses cool-off check)
        # Task types are registered as: oauth_token_monitoring, website_analysis, gsc_insights, bing_insights
        await execute_task_async(scheduler, task_type, task, execution_source="manual")
        
        db.commit()
        
        logger.info(f"Manually triggered task {task_id} ({task_type}) for user {task.user_id}")
        
        return {
            "success": True,
            "message": "Task triggered successfully",
            "task": {
                "id": task.id,
                "status": task.status,
                "last_check": task.last_check.isoformat() if task.last_check else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error manually triggering task {task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to trigger task: {str(e)}")


@router.get("/platform-insights/logs/{user_id}")
async def get_platform_insights_logs(
    user_id: str,
    task_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get execution logs for platform insights tasks.
    
    Args:
        user_id: User ID
        task_id: Optional task ID to filter logs
        limit: Maximum number of logs to return
        
    Returns:
        List of execution logs
    """
    try:
        # Verify user can only access their own data
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        query = db.query(PlatformInsightsExecutionLog).join(
            PlatformInsightsTask,
            PlatformInsightsExecutionLog.task_id == PlatformInsightsTask.id
        ).filter(
            PlatformInsightsTask.user_id == user_id
        )
        
        if task_id:
            query = query.filter(PlatformInsightsExecutionLog.task_id == task_id)
        
        logs = query.order_by(
            desc(PlatformInsightsExecutionLog.execution_date)
        ).limit(limit).all()
        
        def format_log(log: PlatformInsightsExecutionLog) -> Dict[str, Any]:
            return {
                'id': log.id,
                'task_id': log.task_id,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'result_data': log.result_data,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'data_source': log.data_source,
                'created_at': log.created_at.isoformat() if log.created_at else None
            }
        
        return {
            'success': True,
            'logs': [format_log(log) for log in logs],
            'total_count': len(logs)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting platform insights logs for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get platform insights logs: {str(e)}")


TASK_DISPLAY_INFO = {
    "onboarding_full_website_analysis": {"label": "Full-Site SEO Audit", "description": "Crawls your entire website and generates per-page SEO audit results.", "frequency": "One-time"},
    "deep_competitor_analysis": {"label": "Deep Competitor Analysis", "description": "Analyzes competitors' content strategy, keywords, and positioning.", "frequency": "Weekly (strategic insights) or One-time"},
    "sif_indexing": {"label": "SIF Content Indexing", "description": "Indexes your website content into the Semantic Intelligence Framework for agent-powered recommendations.", "frequency": "Every 48 hours"},
    "market_trends": {"label": "Market Trends", "description": "Monitors search trends and surfaces high-impact content opportunities.", "frequency": "Every 72 hours"},
    "advertools": {"label": "Advertools Analysis", "description": "Runs brand analysis and site health audits using Advertools.", "frequency": "Weekly"},
    "oauth_token_monitoring": {"label": "OAuth Token Health", "description": "Monitors and refreshes OAuth tokens for connected platforms (GSC, Bing, WordPress, Wix).", "frequency": "Weekly"},
    "website_analysis": {"label": "Website Analysis", "description": "Periodically re-crawls your website and updates style analysis, content pillars, and SEO data.", "frequency": "Every 10 days"},
    "gsc_insights": {"label": "Google Search Console Insights", "description": "Pulls search performance data from Google Search Console.", "frequency": "Weekly"},
    "bing_insights": {"label": "Bing Insights", "description": "Pulls search performance data from Bing Webmaster Tools.", "frequency": "Weekly"},
    "deep_website_crawl": {"label": "Deep Website Crawl", "description": "Performs deep crawl of your website for technical SEO issues.", "frequency": "Weekly"},
    "platform_insights": {"label": "Platform Insights", "description": "Aggregates search performance data from connected platforms.", "frequency": "Weekly"},
}


@router.get("/onboarding-tasks/{user_id}")
async def get_onboarding_tasks(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all tasks created during onboarding for a user, with status and human-readable descriptions.
    """
    try:
        if str(current_user.get('id')) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        tasks = []

        def _fmt_status(s):
            return s.replace('_', ' ').title() if s else 'Unknown'

        def _fmt_dt(dt):
            return dt.isoformat() if dt else None

        # Onboarding full-site SEO audit
        for t in db.query(OnboardingFullWebsiteAnalysisTask).filter(
            OnboardingFullWebsiteAnalysisTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("onboarding_full_website_analysis", {})
            tasks.append({
                "task_type": "onboarding_full_website_analysis",
                "label": info.get("label", "Full-Site SEO Audit"),
                "description": info.get("description", ""),
                "frequency": info.get("frequency", "One-time"),
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_execution),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        # Deep competitor analysis
        for t in db.query(DeepCompetitorAnalysisTask).filter(
            DeepCompetitorAnalysisTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("deep_competitor_analysis", {})
            payload = t.payload or {}
            freq_label = info.get("frequency", "One-time")
            if payload.get("mode") == "strategic_insights":
                freq_label = "Weekly"
            tasks.append({
                "task_type": "deep_competitor_analysis",
                "label": info.get("label", "Deep Competitor Analysis"),
                "description": info.get("description", ""),
                "frequency": freq_label,
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_execution),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        # SIF indexing
        for t in db.query(SIFIndexingTask).filter(
            SIFIndexingTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("sif_indexing", {})
            tasks.append({
                "task_type": "sif_indexing",
                "label": info.get("label", "SIF Content Indexing"),
                "description": info.get("description", ""),
                "frequency": f"Every {t.frequency_hours or 48}h",
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_execution),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        # Market trends
        for t in db.query(MarketTrendsTask).filter(
            MarketTrendsTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("market_trends", {})
            tasks.append({
                "task_type": "market_trends",
                "label": info.get("label", "Market Trends"),
                "description": info.get("description", ""),
                "frequency": f"Every {t.frequency_hours or 72}h",
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_execution),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        # Advertools
        for t in db.query(AdvertoolsTask).filter(
            AdvertoolsTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("advertools", {})
            tasks.append({
                "task_type": "advertools",
                "label": info.get("label", "Advertools Analysis"),
                "description": info.get("description", ""),
                "frequency": f"Every {t.frequency_days or 7}d",
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_execution),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        # Also include website analysis & OAuth tasks created during onboarding
        for t in db.query(WebsiteAnalysisTask).filter(
            WebsiteAnalysisTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("website_analysis", {})
            tasks.append({
                "task_type": "website_analysis",
                "label": info.get("label", "Website Analysis") + (f" ({t.task_type})" if t.task_type == 'competitor' else ""),
                "description": info.get("description", ""),
                "frequency": f"Every {t.frequency_days or 10}d",
                "task_id": t.id,
                "website_url": t.website_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_check),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        for t in db.query(OAuthTokenMonitoringTask).filter(
            OAuthTokenMonitoringTask.user_id == user_id
        ).all():
            info = TASK_DISPLAY_INFO.get("oauth_token_monitoring", {})
            tasks.append({
                "task_type": "oauth_token_monitoring",
                "label": info.get("label", "OAuth Token Health") + f" ({t.platform})",
                "description": info.get("description", ""),
                "frequency": info.get("frequency", "Weekly"),
                "task_id": t.id,
                "website_url": None,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_check),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        for t in db.query(PlatformInsightsTask).filter(
            PlatformInsightsTask.user_id == user_id
        ).all():
            task_key = f"{t.platform}_insights"
            info = TASK_DISPLAY_INFO.get(task_key, {})
            tasks.append({
                "task_type": task_key,
                "label": info.get("label", "Platform Insights") + f" ({t.platform})",
                "description": info.get("description", ""),
                "frequency": info.get("frequency", "Weekly"),
                "task_id": t.id,
                "website_url": t.site_url,
                "status": t.status,
                "status_label": _fmt_status(t.status),
                "last_success": _fmt_dt(t.last_success),
                "last_failure": _fmt_dt(t.last_failure),
                "next_execution": _fmt_dt(t.next_check),
                "failure_reason": t.failure_reason,
                "consecutive_failures": t.consecutive_failures,
            })

        return {"success": True, "tasks": tasks, "count": len(tasks)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting onboarding tasks for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get onboarding tasks: {str(e)}")

