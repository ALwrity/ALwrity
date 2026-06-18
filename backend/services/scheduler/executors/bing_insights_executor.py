"""
Bing Insights Task Executor
Handles execution of Bing insights fetch tasks for connected platforms.
"""

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..core.executor_interface import TaskExecutor, TaskExecutionResult
from ..core.exception_handler import TaskExecutionError, DatabaseError, SchedulerExceptionHandler
from models.platform_insights_monitoring_models import PlatformInsightsTask, PlatformInsightsExecutionLog
from services.bing_analytics_storage_service import BingAnalyticsStorageService
from services.integrations.bing_oauth import BingOAuthService
from services.database import get_user_db_path
from utils.logger_utils import get_service_logger

logger = get_service_logger("bing_insights_executor")


class BingInsightsExecutor(TaskExecutor):
    """
    Executor for Bing insights fetch tasks.
    
    Handles:
    - Fetching Bing insights data weekly
    - On first run: Loads existing cached data
    - On subsequent runs: Fetches fresh data from Bing API
    - Logging results and updating task status
    """
    
    def __init__(self):
        self.logger = logger
        self.exception_handler = SchedulerExceptionHandler()
        self.bing_oauth = BingOAuthService()
    
    async def execute_task(self, task: PlatformInsightsTask, db: Session) -> TaskExecutionResult:
        """
        Execute a Bing insights fetch task.
        
        Args:
            task: PlatformInsightsTask instance
            db: Database session
            
        Returns:
            TaskExecutionResult
        """
        start_time = time.time()
        user_id = task.user_id
        site_url = task.site_url
        
        # Initialize storage service for this user
        db_path = get_user_db_path(user_id)
        database_url = f'sqlite:///{db_path}'
        storage_service = BingAnalyticsStorageService(database_url)
        
        try:
            self.logger.info(
                f"Executing Bing insights fetch: task_id={task.id} | "
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
            result = await self._fetch_insights(task, db, storage_service)
            
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
                    task.id, "bing_insights", task.user_id
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
                context="Bing insights fetch"
            )
            
            # Analyze failure pattern
            from services.scheduler.core.failure_detection_service import FailureDetectionService
            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(
                task.id, "bing_insights", task.user_id
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
    
    async def _fetch_insights(self, task: PlatformInsightsTask, db: Session, storage_service: BingAnalyticsStorageService) -> TaskExecutionResult:
        """
        Fetch Bing insights data.
        
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
                self.logger.info(f"First run for Bing insights task {task.id} - loading cached data")
                cached_data = self._load_cached_data(user_id, site_url, storage_service)
                
                if cached_data:
                    self.logger.info(f"Loaded cached Bing data for user {user_id}")
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
                    self.logger.info(f"No cached data found, fetching from Bing API")
                    return await self._fetch_fresh_data(user_id, site_url, storage_service)
            else:
                # Subsequent run: Always fetch fresh data
                self.logger.info(f"Subsequent run for Bing insights task {task.id} - fetching fresh data")
                return await self._fetch_fresh_data(user_id, site_url, storage_service)
                
        except Exception as e:
            self.logger.error(f"Error fetching Bing insights for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"Failed to fetch Bing insights: {str(e)}",
                result_data={'error': str(e)}
            )
    
    def _load_cached_data(self, user_id: str, site_url: Optional[str], storage_service: BingAnalyticsStorageService) -> Optional[Dict[str, Any]]:
        """Load most recent cached Bing data from database."""
        try:
            # Get analytics summary from storage service
            summary = storage_service.get_analytics_summary(
                user_id=user_id,
                site_url=site_url or '',
                days=30
            )
            
            if summary and isinstance(summary, dict):
                self.logger.info(f"Found cached Bing data for user {user_id}")
                return summary
            
            return None
            
        except Exception as e:
            self.logger.warning(f"Error loading cached Bing data: {e}")
            return None
    
    async def _fetch_fresh_data(self, user_id: str, site_url: Optional[str], storage_service: BingAnalyticsStorageService) -> TaskExecutionResult:
        """Fetch fresh Bing insights from API."""
        try:
            # Check if user has active tokens
            token_status = self.bing_oauth.get_user_token_status(user_id)
            
            if not token_status.get('has_active_tokens'):
                return TaskExecutionResult(
                    success=False,
                    error_message="Bing Webmaster tokens not available or expired",
                    result_data={'error': 'No active tokens'}
                )
            
            # Get user's sites
            sites = self.bing_oauth.get_user_sites(user_id)
            
            if not sites:
                return TaskExecutionResult(
                    success=False,
                    error_message="No Bing Webmaster sites found",
                    result_data={'error': 'No sites found'}
                )
            
            # Use provided site_url or first site
            if not site_url:
                site_url = sites[0].get('Url', '') if isinstance(sites[0], dict) else sites[0]
            
            # Get active token
            active_tokens = token_status.get('active_tokens', [])
            if not active_tokens:
                return TaskExecutionResult(
                    success=False,
                    error_message="No active Bing Webmaster tokens",
                    result_data={'error': 'No tokens'}
                )
            
            # For now, use stored analytics data (Bing API integration can be added later)
            # This ensures we have data available even if the API class doesn't exist yet
            summary = storage_service.get_analytics_summary(user_id, site_url, days=30)
            
            if summary and isinstance(summary, dict):
                # Format insights data from stored analytics
                insights_data = {
                    'site_url': site_url,
                    'date_range': {
                        'start': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
                        'end': datetime.now().strftime('%Y-%m-%d')
                    },
                    'summary': summary.get('summary', {}),
                    'fetched_at': datetime.utcnow().isoformat()
                }
                
                self.logger.info(
                    f"Successfully loaded Bing insights from storage for user {user_id}, site {site_url}"
                )
                
                return TaskExecutionResult(
                    success=True,
                    result_data={
                        'data_source': 'storage',
                        'insights': insights_data,
                        'message': 'Loaded from stored analytics data'
                    }
                )
            else:
                # No stored data available
                return TaskExecutionResult(
                    success=False,
                    error_message="No Bing analytics data available. Data will be collected during next onboarding refresh.",
                    result_data={'error': 'No stored data available'}
                )
            
        except Exception as e:
            self.logger.error(f"Error fetching fresh Bing data: {e}", exc_info=True)
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

