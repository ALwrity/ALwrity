"""
GSC Insights Task Executor
Handles execution of GSC insights fetch tasks for connected platforms.
"""

import logging
import os
import time
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import sqlite3

from ..core.executor_interface import TaskExecutor, TaskExecutionResult
from ..core.exception_handler import TaskExecutionError, DatabaseError, SchedulerExceptionHandler
from models.platform_insights_monitoring_models import PlatformInsightsTask, PlatformInsightsExecutionLog
from services.gsc_service import GSCService
from utils.logger_utils import get_service_logger

logger = get_service_logger("gsc_insights_executor")


class GSCInsightsExecutor(TaskExecutor):
    """
    Executor for GSC insights fetch tasks.
    
    Handles:
    - Fetching GSC insights data weekly
    - On first run: Loads existing cached data
    - On subsequent runs: Fetches fresh data from GSC API
    - Logging results and updating task status
    """
    
    def __init__(self):
        self.logger = logger
        self.exception_handler = SchedulerExceptionHandler()
        self.gsc_service = GSCService()
    
    async def execute_task(self, task: PlatformInsightsTask, db: Session) -> TaskExecutionResult:
        """
        Execute a GSC insights fetch task.
        
        Args:
            task: PlatformInsightsTask instance
            db: Database session
            
        Returns:
            TaskExecutionResult
        """
        start_time = time.time()
        user_id = task.user_id
        site_url = task.site_url
        
        try:
            self.logger.info(
                f"Executing GSC insights fetch: task_id={task.id} | "
                f"user_id={user_id} | site_url={site_url}"
            )
            
            # Create execution log
            execution_log = PlatformInsightsExecutionLog(
                task_id=task.id,
                execution_date=datetime.utcnow(),
                status='running'
            )
            db.add(execution_log)
            db.flush()
            
            # Fetch insights
            result = await self._fetch_insights(task, db)
            
            # Update execution log
            execution_time_ms = int((time.time() - start_time) * 1000)
            execution_log.status = 'success' if result.success else 'failed'
            execution_log.result_data = result.result_data
            execution_log.error_message = result.error_message
            execution_log.execution_time_ms = execution_time_ms
            execution_log.data_source = result.result_data.get('data_source') if result.success else None
            
            # Update task based on result
            task.last_check = datetime.utcnow()
            
            if result.success:
                task.last_success = datetime.utcnow()
                task.status = 'active'
                task.failure_reason = None
                # Reset failure tracking on success
                task.consecutive_failures = 0
                task.failure_pattern = None
                # Schedule next check (7 days from now)
                task.next_check = self.calculate_next_execution(
                    task=task,
                    frequency='Weekly',
                    last_execution=task.last_check
                )
            else:
                # Analyze failure pattern
                from services.scheduler.core.failure_detection_service import FailureDetectionService
                failure_detection = FailureDetectionService(db)
                pattern = failure_detection.analyze_task_failures(
                    task.id, "gsc_insights", task.user_id
                )
                
                task.last_failure = datetime.utcnow()
                task.failure_reason = result.error_message
                
                if pattern and pattern.should_cool_off:
                    # Mark task for human intervention
                    task.status = "needs_intervention"
                    task.consecutive_failures = pattern.consecutive_failures
                    task.failure_pattern = {
                        "consecutive_failures": pattern.consecutive_failures,
                        "recent_failures": pattern.recent_failures,
                        "failure_reason": pattern.failure_reason.value,
                        "error_patterns": pattern.error_patterns,
                        "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                    }
                    # Clear next_check - task won't run automatically
                    task.next_check = None
                    
                    self.logger.warning(
                        f"Task {task.id} marked for human intervention: "
                        f"{pattern.consecutive_failures} consecutive failures, "
                        f"reason: {pattern.failure_reason.value}"
                    )
                else:
                    # Normal failure handling
                    task.status = 'failed'
                    task.consecutive_failures = (task.consecutive_failures or 0) + 1
                    # Schedule retry in 1 day
                    task.next_check = datetime.utcnow() + timedelta(days=1)
            
            task.updated_at = datetime.utcnow()
            db.commit()
            
            return result
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            error_result = self.exception_handler.handle_task_execution_error(
                task=task,
                error=e,
                execution_time_ms=execution_time_ms,
                context="GSC insights fetch"
            )
            
            # Analyze failure pattern
            from services.scheduler.core.failure_detection_service import FailureDetectionService
            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(
                task.id, "gsc_insights", task.user_id
            )
            
            # Update task
            task.last_check = datetime.utcnow()
            task.last_failure = datetime.utcnow()
            task.failure_reason = str(e)
            
            if pattern and pattern.should_cool_off:
                # Mark task for human intervention
                task.status = "needs_intervention"
                task.consecutive_failures = pattern.consecutive_failures
                task.failure_pattern = {
                    "consecutive_failures": pattern.consecutive_failures,
                    "recent_failures": pattern.recent_failures,
                    "failure_reason": pattern.failure_reason.value,
                    "error_patterns": pattern.error_patterns,
                    "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                }
                task.next_check = None
            else:
                task.status = 'failed'
                task.consecutive_failures = (task.consecutive_failures or 0) + 1
                task.next_check = datetime.utcnow() + timedelta(days=1)
            
            task.updated_at = datetime.utcnow()
            db.commit()
            
            return error_result
    
    async def _fetch_insights(self, task: PlatformInsightsTask, db: Session) -> TaskExecutionResult:
        """
        Fetch GSC insights data.
        
        On first run (no last_success), loads cached data.
        On subsequent runs, fetches fresh data from API.
        """
        user_id = task.user_id
        site_url = task.site_url
        
        try:
            # Check if this is first run (no previous success)
            is_first_run = task.last_success is None
            
            if is_first_run:
                # First run: Try to load from cache
                self.logger.info(f"First run for GSC insights task {task.id} - loading cached data")
                cached_data = self._load_cached_data(user_id, site_url)
                
                if cached_data:
                    self.logger.info(f"Loaded cached GSC data for user {user_id}")
                    return TaskExecutionResult(
                        success=True,
                        result_data={
                            'data_source': 'cached',
                            'insights': cached_data,
                            'message': 'Loaded from cached data (first run)'
                        }
                    )
                else:
                    # No cached data - try to fetch from API
                    self.logger.info(f"No cached data found, fetching from GSC API")
                    return await self._fetch_fresh_data(user_id, site_url)
            else:
                # Subsequent run: Always fetch fresh data
                self.logger.info(f"Subsequent run for GSC insights task {task.id} - fetching fresh data")
                return await self._fetch_fresh_data(user_id, site_url)
                
        except Exception as e:
            self.logger.error(f"Error fetching GSC insights for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"Failed to fetch GSC insights: {str(e)}",
                result_data={'error': str(e)}
            )
    
    def _load_cached_data(self, user_id: str, site_url: Optional[str]) -> Optional[Dict[str, Any]]:
        """Load most recent cached GSC data from database."""
        try:
            db_path = self.gsc_service.db_path
            
            with sqlite3.connect(db_path) as conn:
                cursor = conn.cursor()
                
                # Find most recent cached data
                if site_url:
                    cursor.execute('''
                        SELECT data_json, created_at
                        FROM gsc_data_cache
                        WHERE user_id = ? AND site_url = ? AND data_type = 'analytics'
                        ORDER BY created_at DESC
                        LIMIT 1
                    ''', (user_id, site_url))
                else:
                    cursor.execute('''
                        SELECT data_json, created_at
                        FROM gsc_data_cache
                        WHERE user_id = ? AND data_type = 'analytics'
                        ORDER BY created_at DESC
                        LIMIT 1
                    ''', (user_id,))
                
                result = cursor.fetchone()
                
                if result:
                    data_json, created_at = result
                    insights_data = json.loads(data_json) if isinstance(data_json, str) else data_json
                    
                    self.logger.info(
                        f"Found cached GSC data from {created_at} for user {user_id}"
                    )
                    
                    return insights_data
                
                return None
                
        except Exception as e:
            self.logger.warning(f"Error loading cached GSC data: {e}")
            return None
    
    async def _fetch_fresh_data(self, user_id: str, site_url: Optional[str]) -> TaskExecutionResult:
        """Fetch fresh GSC insights from API."""
        try:
            # If no site_url, get first site
            if not site_url:
                sites = self.gsc_service.get_site_list(user_id)
                if not sites:
                    return TaskExecutionResult(
                        success=False,
                        error_message="No GSC sites found for user",
                        result_data={'error': 'No sites found'}
                    )
                site_url = sites[0]['siteUrl']
            
            # Get analytics for last 30 days
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            # Fetch search analytics
            search_analytics = self.gsc_service.get_search_analytics(
                user_id=user_id,
                site_url=site_url,
                start_date=start_date,
                end_date=end_date
            )
            
            if 'error' in search_analytics:
                return TaskExecutionResult(
                    success=False,
                    error_message=search_analytics.get('error', 'Unknown error'),
                    result_data=search_analytics
                )
            
            # Format insights data
            insights_data = {
                'site_url': site_url,
                'date_range': {
                    'start': start_date,
                    'end': end_date
                },
                'overall_metrics': search_analytics.get('overall_metrics', {}),
                'query_data': search_analytics.get('query_data', {}),
                'fetched_at': datetime.utcnow().isoformat()
            }
            
            self.logger.info(
                f"Successfully fetched GSC insights for user {user_id}, site {site_url}"
            )
            
            return TaskExecutionResult(
                success=True,
                result_data={
                    'data_source': 'api',
                    'insights': insights_data,
                    'message': 'Fetched fresh data from GSC API'
                }
            )
            
        except Exception as e:
            self.logger.error(f"Error fetching fresh GSC data: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"API fetch failed: {str(e)}",
                result_data={'error': str(e)}
            )
    
    def calculate_next_execution(
        self,
        task: PlatformInsightsTask,
        frequency: str,
        last_execution: Optional[datetime] = None
    ) -> datetime:
        """
        Calculate next execution time based on frequency.
        
        For platform insights, frequency is always 'Weekly' (7 days).
        """
        if last_execution is None:
            last_execution = datetime.utcnow()
        
        if frequency == 'Weekly':
            return last_execution + timedelta(days=7)
        elif frequency == 'Daily':
            return last_execution + timedelta(days=1)
        else:
            # Default to weekly
            return last_execution + timedelta(days=7)

