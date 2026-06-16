"""
OAuth Token Monitoring Task Executor
Handles execution of OAuth token monitoring tasks for connected platforms.
"""

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..core.executor_interface import TaskExecutor, TaskExecutionResult
from ..core.exception_handler import TaskExecutionError, DatabaseError, SchedulerExceptionHandler
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask, OAuthTokenExecutionLog
from models.subscription_models import UsageAlert
from utils.logger_utils import get_service_logger

# Import platform-specific services
from services.gsc_service import GSCService
from services.integrations.bing_oauth import BingOAuthService
from services.integrations.wordpress_oauth import WordPressOAuthService
from services.wix_service import WixService
from services.database import get_user_db_path

logger = get_service_logger("oauth_token_monitoring_executor")


class OAuthTokenMonitoringExecutor(TaskExecutor):
    """
    Executor for OAuth token monitoring tasks.
    
    Handles:
    - Checking token validity and expiration
    - Attempting automatic token refresh
    - Logging results and updating task status
    - One-time refresh attempt (no automatic retries on failure)
    """
    
    def __init__(self):
        self.logger = logger
        self.exception_handler = SchedulerExceptionHandler()
        # Expiration warning window (7 days before expiration)
        self.expiration_warning_days = 7
        self.max_refresh_retries = 3
        self.base_retry_backoff_minutes = 15
    
    async def execute_task(self, task: OAuthTokenMonitoringTask, db: Session) -> TaskExecutionResult:
        """
        Execute an OAuth token monitoring task.
        
        This checks token status and attempts refresh if needed.
        If refresh fails, marks task as failed and does not retry automatically.
        
        Args:
            task: OAuthTokenMonitoringTask instance
            db: Database session
            
        Returns:
            TaskExecutionResult
        """
        start_time = time.time()
        user_id = task.user_id
        platform = task.platform
        
        try:
            self.logger.info(
                f"Executing OAuth token monitoring: task_id={task.id} | "
                f"user_id={user_id} | platform={platform}"
            )
            
            # Create execution log
            execution_log = OAuthTokenExecutionLog(
                task_id=task.id,
                execution_date=datetime.utcnow(),
                status='running'
            )
            db.add(execution_log)
            db.flush()
            
            # Check and refresh token
            result = await self._check_and_refresh_token(task, db)
            
            # Update execution log
            execution_time_ms = int((time.time() - start_time) * 1000)
            execution_log.status = 'success' if result.success else 'failed'
            execution_log.result_data = result.result_data
            execution_log.error_message = result.error_message
            execution_log.execution_time_ms = execution_time_ms
            
            # Update task based on result
            task.last_check = datetime.utcnow()
            
            if result.success:
                task.last_success = datetime.utcnow()
                task.status = 'active'
                task.failure_reason = None
                task.terminal_failure_reason = None
                task.channel_status = 'connected'
                task.refresh_attempts = 0
                task.next_retry_at = None
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
                    task.id, "oauth_token_monitoring", task.user_id
                )
                
                task.last_failure = datetime.utcnow()
                task.failure_reason = result.error_message
                task.refresh_attempts = (task.refresh_attempts or 0) + 1
                
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
                    task.next_retry_at = None
                    task.channel_status = "disconnected"
                    task.terminal_failure_reason = result.error_message
                    
                    self.logger.warning(
                        f"Task {task.id} marked for human intervention: "
                        f"{pattern.consecutive_failures} consecutive failures, "
                        f"reason: {pattern.failure_reason.value}"
                    )
                else:
                    task.consecutive_failures = (task.consecutive_failures or 0) + 1
                    if task.refresh_attempts >= self.max_refresh_retries:
                        task.status = 'failed'
                        task.channel_status = 'disconnected'
                        task.terminal_failure_reason = result.error_message
                        task.next_retry_at = None
                    else:
                        task.status = 'degraded'
                        task.channel_status = 'degraded'
                        delay_minutes = self.base_retry_backoff_minutes * (2 ** (task.refresh_attempts - 1))
                        task.next_retry_at = datetime.utcnow() + timedelta(minutes=delay_minutes)
                
                self.logger.warning(
                    f"OAuth token refresh failed for user {user_id}, platform {platform}. "
                    f"{'Task marked for human intervention' if pattern and pattern.should_cool_off else 'Task marked as failed. No automatic retry will be scheduled.'}"
                )
                
                # Create UsageAlert notification for the user
                self._create_failure_alert(user_id, platform, result.error_message, result.result_data, db, task)
            
            task.updated_at = datetime.utcnow()
            db.commit()
            
            return result
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # Set database session for exception handler
            self.exception_handler.db = db
            
            # Create structured error
            error = TaskExecutionError(
                message=f"Error executing OAuth token monitoring task {task.id}: {str(e)}",
                user_id=user_id,
                task_id=task.id,
                task_type="oauth_token_monitoring",
                execution_time_ms=execution_time_ms,
                context={
                    "platform": platform,
                    "user_id": user_id
                },
                original_error=e
            )
            
            # Handle exception with structured logging
            self.exception_handler.handle_exception(error)
            
            # Update execution log with error
            try:
                execution_log = OAuthTokenExecutionLog(
                    task_id=task.id,
                    execution_date=datetime.utcnow(),
                    status='failed',
                    error_message=str(e),
                    execution_time_ms=execution_time_ms,
                    result_data={
                        "error_type": error.error_type.value,
                        "severity": error.severity.value,
                        "context": error.context
                    }
                )
                db.add(execution_log)
                
                task.last_failure = datetime.utcnow()
                task.failure_reason = str(e)
                task.status = 'failed'
                task.channel_status = 'disconnected'
                task.terminal_failure_reason = str(e)
                task.last_check = datetime.utcnow()
                task.updated_at = datetime.utcnow()
                task.next_retry_at = None
                
                # Create UsageAlert notification for the user
                self._create_failure_alert(user_id, task.platform, str(e), None, db, task)
                
                db.commit()
            except Exception as commit_error:
                db_error = DatabaseError(
                    message=f"Error saving execution log: {str(commit_error)}",
                    user_id=user_id,
                    task_id=task.id,
                    original_error=commit_error
                )
                self.exception_handler.handle_exception(db_error)
                db.rollback()
            
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=execution_time_ms,
                retryable=False,  # Do not retry automatically
                retry_delay=0
            )
    
    async def _check_and_refresh_token(
        self,
        task: OAuthTokenMonitoringTask,
        db: Session
    ) -> TaskExecutionResult:
        """
        Check token status and attempt refresh if needed.
        
        Tokens are stored in the database from onboarding step 5:
        - GSC: gsc_credentials table (via GSCService)
        - Bing: bing_oauth_tokens table (via BingOAuthService)
        - WordPress: wordpress_oauth_tokens table (via WordPressOAuthService)
        - Wix: wix_oauth_tokens table (via WixOAuthService)
        
        Args:
            task: OAuthTokenMonitoringTask instance
            db: Database session
            
        Returns:
            TaskExecutionResult with success status and details
        """
        platform = task.platform
        user_id = task.user_id
        
        try:
            self.logger.info(f"Checking token for platform: {platform}, user: {user_id}")
            
            # Route to platform-specific checking logic
            if platform == 'gsc':
                return await self._check_gsc_token(user_id)
            elif platform == 'bing':
                return await self._check_bing_token(user_id)
            elif platform == 'wordpress':
                return await self._check_wordpress_token(user_id)
            elif platform == 'wix':
                return await self._check_wix_token(user_id)
            else:
                return TaskExecutionResult(
                    success=False,
                    error_message=f"Unsupported platform: {platform}",
                    result_data={
                        'platform': platform,
                        'user_id': user_id,
                        'error': 'Unsupported platform'
                    },
                    retryable=False
                )
            
        except Exception as e:
            self.logger.error(
                f"Error checking/refreshing token for platform {platform}, user {user_id}: {e}",
                exc_info=True
            )
            return TaskExecutionResult(
                success=False,
                error_message=f"Token check failed: {str(e)}",
                result_data={
                    'platform': platform,
                    'user_id': user_id,
                    'error': str(e)
                },
                retryable=False  # Do not retry automatically
            )
    
    async def _check_gsc_token(self, user_id: str) -> TaskExecutionResult:
        """
        Check and refresh GSC (Google Search Console) token.
        
        GSC service auto-refreshes tokens if expired when loading credentials.
        """
        try:
            # Use dynamic database path
            db_path = get_user_db_path(user_id)
            gsc_service = GSCService(db_path=db_path)
            credentials = gsc_service.load_user_credentials(user_id)
            
            if not credentials:
                return TaskExecutionResult(
                    success=False,
                    error_message="GSC credentials not found or could not be loaded",
                    result_data={
                        'platform': 'gsc',
                        'user_id': user_id,
                        'status': 'not_found',
                        'check_time': datetime.utcnow().isoformat()
                    },
                    retryable=False
                )
            
            # GSC service auto-refreshes if expired, so if we get here, token is valid
            result_data = {
                'platform': 'gsc',
                'user_id': user_id,
                'status': 'valid',
                'check_time': datetime.utcnow().isoformat(),
                'message': 'GSC token is valid (auto-refreshed if expired)'
            }
            
            return TaskExecutionResult(
                success=True,
                result_data=result_data
            )
            
        except Exception as e:
            self.logger.error(f"Error checking GSC token for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"GSC token check failed: {str(e)}",
                result_data={
                    'platform': 'gsc',
                    'user_id': user_id,
                    'error': str(e)
                },
                retryable=False
            )
    
    async def _check_bing_token(self, user_id: str) -> TaskExecutionResult:
        """
        Check and refresh Bing Webmaster Tools token.
        
        Checks token expiration and attempts refresh if needed.
        """
        try:
            # Initialize Bing service
            bing_service = BingOAuthService()
            
            # Get token status (includes expired tokens)
            token_status = bing_service.get_user_token_status(user_id)
            
            if not token_status.get('has_tokens'):
                return TaskExecutionResult(
                    success=False,
                    error_message="No Bing tokens found for user",
                    result_data={
                        'platform': 'bing',
                        'user_id': user_id,
                        'status': 'not_found',
                        'check_time': datetime.utcnow().isoformat()
                    },
                    retryable=False
                )
            
            active_tokens = token_status.get('active_tokens', [])
            expired_tokens = token_status.get('expired_tokens', [])
            
            # If we have active tokens, check if any are expiring soon (< 7 days)
            if active_tokens:
                now = datetime.utcnow()
                needs_refresh = False
                token_to_refresh = None
                
                for token in active_tokens:
                    expires_at_str = token.get('expires_at')
                    if expires_at_str:
                        try:
                            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                            # Check if expires within warning window (7 days)
                            days_until_expiry = (expires_at - now).days
                            if days_until_expiry < self.expiration_warning_days:
                                needs_refresh = True
                                token_to_refresh = token
                                break
                        except Exception:
                            # If parsing fails, assume token is valid
                            pass
                
                if needs_refresh and token_to_refresh:
                    # Attempt to refresh
                    refresh_token = token_to_refresh.get('refresh_token')
                    if refresh_token:
                        refresh_result = bing_service.refresh_access_token(user_id, refresh_token)
                        if refresh_result:
                            return TaskExecutionResult(
                                success=True,
                                result_data={
                                    'platform': 'bing',
                                    'user_id': user_id,
                                    'status': 'refreshed',
                                    'check_time': datetime.utcnow().isoformat(),
                                    'message': 'Bing token refreshed successfully'
                                }
                            )
                        else:
                            return TaskExecutionResult(
                                success=False,
                                error_message="Failed to refresh Bing token",
                                result_data={
                                    'platform': 'bing',
                                    'user_id': user_id,
                                    'status': 'refresh_failed',
                                    'check_time': datetime.utcnow().isoformat()
                                },
                                retryable=False
                            )
                
                # Token is valid and not expiring soon
                return TaskExecutionResult(
                    success=True,
                    result_data={
                        'platform': 'bing',
                        'user_id': user_id,
                        'status': 'valid',
                        'check_time': datetime.utcnow().isoformat(),
                        'message': 'Bing token is valid'
                    }
                )
            
            # No active tokens, check if we can refresh expired ones
            if expired_tokens:
                # Try to refresh the most recent expired token
                latest_token = expired_tokens[0]  # Already sorted by created_at DESC
                refresh_token = latest_token.get('refresh_token')
                
                if refresh_token:
                    # Check if token expired recently (within grace period)
                    expires_at_str = latest_token.get('expires_at')
                    if expires_at_str:
                        try:
                            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                            # Only refresh if expired within last 24 hours (grace period)
                            hours_since_expiry = (datetime.utcnow() - expires_at).total_seconds() / 3600
                            if hours_since_expiry < 24:
                                refresh_result = bing_service.refresh_access_token(user_id, refresh_token)
                                if refresh_result:
                                    return TaskExecutionResult(
                                        success=True,
                                        result_data={
                                            'platform': 'bing',
                                            'user_id': user_id,
                                            'status': 'refreshed',
                                            'check_time': datetime.utcnow().isoformat(),
                                            'message': 'Bing token refreshed from expired state'
                                        }
                                    )
                        except Exception:
                            pass
                
                return TaskExecutionResult(
                    success=False,
                    error_message="Bing token expired and could not be refreshed",
                    result_data={
                        'platform': 'bing',
                        'user_id': user_id,
                        'status': 'expired',
                        'check_time': datetime.utcnow().isoformat(),
                        'message': 'Bing token expired. User needs to reconnect.'
                    },
                    retryable=False
                )
            
            return TaskExecutionResult(
                success=False,
                error_message="No valid Bing tokens found",
                result_data={
                    'platform': 'bing',
                    'user_id': user_id,
                    'status': 'invalid',
                    'check_time': datetime.utcnow().isoformat()
                },
                retryable=False
            )
            
        except Exception as e:
            self.logger.error(f"Error checking Bing token for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"Bing token check failed: {str(e)}",
                result_data={
                    'platform': 'bing',
                    'user_id': user_id,
                    'error': str(e)
                },
                retryable=False
            )
    
    async def _check_wordpress_token(self, user_id: str) -> TaskExecutionResult:
        """
        Check WordPress token validity.
        
        Note: WordPress tokens cannot be refreshed. They expire after 2 weeks
        and require user re-authorization. We only check if token is valid.
        """
        try:
            # Use dynamic database path
            db_path = get_user_db_path(user_id)
            wordpress_service = WordPressOAuthService(db_path=db_path)
            tokens = wordpress_service.get_user_tokens(user_id)
            
            if not tokens:
                return TaskExecutionResult(
                    success=False,
                    error_message="No WordPress tokens found for user",
                    result_data={
                        'platform': 'wordpress',
                        'user_id': user_id,
                        'status': 'not_found',
                        'check_time': datetime.utcnow().isoformat()
                    },
                    retryable=False
                )
            
            # Check each token - WordPress tokens expire in 2 weeks
            now = datetime.utcnow()
            valid_tokens = []
            expiring_soon = []
            expired_tokens = []
            
            for token in tokens:
                expires_at_str = token.get('expires_at')
                if expires_at_str:
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                        days_until_expiry = (expires_at - now).days
                        
                        if days_until_expiry < 0:
                            expired_tokens.append(token)
                        elif days_until_expiry < self.expiration_warning_days:
                            expiring_soon.append(token)
                        else:
                            valid_tokens.append(token)
                    except Exception:
                        # If parsing fails, test token validity via API
                        access_token = token.get('access_token')
                        if access_token and wordpress_service.test_token(access_token):
                            valid_tokens.append(token)
                        else:
                            expired_tokens.append(token)
                else:
                    # No expiration date - test token validity
                    access_token = token.get('access_token')
                    if access_token and wordpress_service.test_token(access_token):
                        valid_tokens.append(token)
                    else:
                        expired_tokens.append(token)
            
            if valid_tokens:
                return TaskExecutionResult(
                    success=True,
                    result_data={
                        'platform': 'wordpress',
                        'user_id': user_id,
                        'status': 'valid',
                        'check_time': datetime.utcnow().isoformat(),
                        'message': 'WordPress token is valid',
                        'valid_tokens_count': len(valid_tokens)
                    }
                )
            elif expiring_soon:
                # WordPress tokens cannot be refreshed - user needs to reconnect
                return TaskExecutionResult(
                    success=False,
                    error_message="WordPress token expiring soon and cannot be auto-refreshed",
                    result_data={
                        'platform': 'wordpress',
                        'user_id': user_id,
                        'status': 'expiring_soon',
                        'check_time': datetime.utcnow().isoformat(),
                        'message': 'WordPress token expires soon. User needs to reconnect (WordPress tokens cannot be auto-refreshed).'
                    },
                    retryable=False
                )
            else:
                return TaskExecutionResult(
                    success=False,
                    error_message="WordPress token expired and cannot be refreshed",
                    result_data={
                        'platform': 'wordpress',
                        'user_id': user_id,
                        'status': 'expired',
                        'check_time': datetime.utcnow().isoformat(),
                        'message': 'WordPress token expired. User needs to reconnect (WordPress tokens cannot be auto-refreshed).'
                    },
                    retryable=False
                )
            
        except Exception as e:
            self.logger.error(f"Error checking WordPress token for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"WordPress token check failed: {str(e)}",
                result_data={
                    'platform': 'wordpress',
                    'user_id': user_id,
                    'error': str(e)
                },
                retryable=False
            )
    
    async def _check_wix_token(self, user_id: str) -> TaskExecutionResult:
        """
        Check Wix token validity.
        
        Note: Wix tokens are currently stored in frontend sessionStorage.
        Backend storage needs to be implemented for automated checking.
        """
        try:
            # TODO: Wix tokens are stored in frontend sessionStorage, not backend database
            # Once backend storage is implemented, we can check tokens here
            # For now, return not supported
            
            return TaskExecutionResult(
                success=False,
                error_message="Wix token monitoring not yet supported - tokens stored in frontend sessionStorage",
                result_data={
                    'platform': 'wix',
                    'user_id': user_id,
                    'status': 'not_supported',
                    'check_time': datetime.utcnow().isoformat(),
                    'message': 'Wix token monitoring requires backend token storage implementation'
                },
                retryable=False
            )
            
        except Exception as e:
            self.logger.error(f"Error checking Wix token for user {user_id}: {e}", exc_info=True)
            return TaskExecutionResult(
                success=False,
                error_message=f"Wix token check failed: {str(e)}",
                result_data={
                    'platform': 'wix',
                    'user_id': user_id,
                    'error': str(e)
                },
                retryable=False
            )
    
    def _create_failure_alert(
        self,
        user_id: str,
        platform: str,
        error_message: str,
        result_data: Optional[Dict[str, Any]],
        db: Session,
        task: Optional[OAuthTokenMonitoringTask] = None
    ):
        """
        Create a UsageAlert notification when OAuth token refresh fails.
        
        Args:
            user_id: User ID
            platform: Platform identifier (gsc, bing, wordpress, wix)
            error_message: Error message from token check
            result_data: Optional result data from token check
            db: Database session
        """
        try:
            # Determine severity based on error type
            status = result_data.get('status', 'unknown') if result_data else 'unknown'
            
            if status in ['expired', 'refresh_failed']:
                severity = 'error'
                alert_type = 'oauth_token_failure'
            elif status in ['expiring_soon', 'not_found']:
                severity = 'warning'
                alert_type = 'oauth_token_warning'
            else:
                severity = 'error'
                alert_type = 'oauth_token_failure'
            
            # Format platform name for display
            platform_names = {
                'gsc': 'Google Search Console',
                'bing': 'Bing Webmaster Tools',
                'wordpress': 'WordPress',
                'wix': 'Wix'
            }
            platform_display = platform_names.get(platform, platform.upper())
            
            # Create alert title and message
            if status == 'expired':
                title = f"{platform_display} Token Expired"
                message = (
                    f"Your {platform_display} access token has expired and could not be automatically renewed. "
                    f"Please reconnect your {platform_display} account to continue using this integration."
                )
            elif status == 'expiring_soon':
                title = f"{platform_display} Token Expiring Soon"
                message = (
                    f"Your {platform_display} access token will expire soon. "
                    f"Please reconnect your {platform_display} account to avoid interruption."
                )
            elif status == 'refresh_failed':
                title = f"{platform_display} Token Renewal Failed"
                message = (
                    f"Failed to automatically renew your {platform_display} access token. "
                    f"Please reconnect your {platform_display} account. "
                    f"Error: {error_message}"
                )
            elif status == 'not_found':
                title = f"{platform_display} Token Not Found"
                message = (
                    f"No {platform_display} access token found. "
                    f"Please connect your {platform_display} account in the onboarding settings."
                )
            else:
                title = f"{platform_display} Token Error"
                message = (
                    f"An error occurred while checking your {platform_display} access token. "
                    f"Please reconnect your {platform_display} account. "
                    f"Error: {error_message}"
                )
            
            # Get current billing period (YYYY-MM format)
            from datetime import datetime
            billing_period = datetime.utcnow().strftime("%Y-%m")

            alert_payload = {
                "requires_user_action": True,
                "platform": platform,
                "channel_status": getattr(task, "channel_status", "disconnected"),
                "terminal_failure_reason": getattr(task, "terminal_failure_reason", error_message),
                "next_retry_at": (
                    task.next_retry_at.isoformat() if task and task.next_retry_at else None
                ),
                "refresh_attempts": getattr(task, "refresh_attempts", 0),
                "max_refresh_retries": self.max_refresh_retries,
            }

            message = f"{message} [ALERT_PAYLOAD] {alert_payload}"
            
            # Create UsageAlert
            alert = UsageAlert(
                user_id=user_id,
                alert_type=alert_type,
                threshold_percentage=0,  # Not applicable for OAuth alerts
                provider=None,  # Not applicable for OAuth alerts
                title=title,
                message=message,
                severity=severity,
                is_sent=False,  # Will be marked as sent when frontend polls
                is_read=False,
                billing_period=billing_period
            )
            
            db.add(alert)
            # Note: We don't commit here - let the caller commit
            # This allows the alert to be created atomically with the task update
            
            self.logger.info(
                f"Created UsageAlert for OAuth token failure: user={user_id}, "
                f"platform={platform}, severity={severity}"
            )
            
        except Exception as e:
            # Don't fail the entire task execution if alert creation fails
            self.logger.error(
                f"Failed to create UsageAlert for OAuth token failure: {e}",
                exc_info=True
            )
    
    def calculate_next_execution(
        self,
        task: OAuthTokenMonitoringTask,
        frequency: str,
        last_execution: Optional[datetime] = None
    ) -> datetime:
        """
        Calculate next execution time based on frequency.
        
        For OAuth token monitoring, frequency is always 'Weekly' (7 days).
        
        Args:
            task: OAuthTokenMonitoringTask instance
            frequency: Frequency string (should be 'Weekly' for token monitoring)
            last_execution: Last execution datetime (defaults to task.last_check or now)
            
        Returns:
            Next execution datetime
        """
        if last_execution is None:
            last_execution = task.last_check if task.last_check else datetime.utcnow()
        
        # OAuth token monitoring is always weekly (7 days)
        if frequency == 'Weekly':
            return last_execution + timedelta(days=7)
        else:
            # Default to weekly if frequency is not recognized
            self.logger.warning(
                f"Unknown frequency '{frequency}' for OAuth token monitoring task {task.id}. "
                f"Defaulting to Weekly (7 days)."
            )
            return last_execution + timedelta(days=7)
