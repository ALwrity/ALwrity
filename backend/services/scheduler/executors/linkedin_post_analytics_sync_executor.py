"""
LinkedIn Post Analytics Sync Executor
Syncs the user's last LinkedIn posts and engagement metrics from Unipile
on a recurring schedule.
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.linkedin_monitoring_models import (
    LinkedInPostAnalyticsSyncTask,
    LinkedInPostAnalyticsSyncExecutionLog,
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.linkedin.types import LinkedInNotConnectedError
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_post_analytics_sync_executor")


class LinkedInPostAnalyticsSyncExecutor(TaskExecutor):
    """Executor for recurring LinkedIn post analytics syncs."""

    def __init__(self):
        pass

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, LinkedInPostAnalyticsSyncTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for LinkedIn post analytics sync",
                retryable=False,
            )

        task_log = LinkedInPostAnalyticsSyncExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow(),
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)
        payload = task.payload or {}
        post_limit = int(payload.get("post_limit", 50))

        try:
            logger.info(f"Executing LinkedIn post analytics sync for user {user_id}")

            oauth = LinkedInOAuthService()
            try:
                creds = oauth.resolve_credentials(user_id)
            except LinkedInNotConnectedError as e:
                logger.warning(f"[linkedin_post_analytics_sync] User {user_id} not connected: {e}")
                task.last_executed = datetime.utcnow()
                task.status = "active"
                task.next_execution = datetime.utcnow() + timedelta(hours=24)

                task_log.status = "skipped"
                task_log.result_data = {"reason": "not_connected", "retry_at": task.next_execution.isoformat()}
                task_log.execution_time_ms = int((time.time() - start_time) * 1000)
                db.commit()

                return TaskExecutionResult(
                    success=True,
                    result_data=task_log.result_data,
                    execution_time_ms=task_log.execution_time_ms,
                    retryable=True,
                )

            from services.integrations.linkedin.unipile_client import (
                UnipileClient,
                personal_profile_provider_id_from_owner,
            )
            from services.integrations.linkedin.posts_service import get_posts_service
            from services.linkedin_post_analytics_service import LinkedInPostAnalyticsService

            account_id = creds.unipile_account_id
            client = UnipileClient()

            profile = await client.get_own_profile(account_id)
            identifier = personal_profile_provider_id_from_owner(profile)
            if not identifier:
                raise ValueError("Could not resolve personal profile identifier from Unipile")

            posts_service = get_posts_service()
            result = await posts_service.fetch_user_posts(
                account_id=account_id,
                identifier=identifier,
                limit=post_limit,
            )

            analytics_service = LinkedInPostAnalyticsService(db)
            count = analytics_service.store_posts(user_id, result.posts)

            result_data = {
                "posts_synced": count,
                "post_limit": post_limit,
                "has_more": result.has_more,
            }

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None
            frequency_hours = task.frequency_hours or 24
            task.next_execution = datetime.utcnow() + timedelta(hours=frequency_hours)
            task.status = "active"

            task_log.status = "success"
            task_log.result_data = result_data
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.commit()

            return TaskExecutionResult(
                success=True,
                result_data=result_data,
                execution_time_ms=task_log.execution_time_ms,
                retryable=False,
            )

        except Exception as e:
            db.rollback()
            logger.warning(f"[linkedin_post_analytics_sync] Task failed for user {user_id}: {e}")

            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "linkedin_post_analytics_sync", user_id)

            task.last_executed = datetime.utcnow()
            task.last_failure = datetime.utcnow()
            task.failure_reason = str(e)
            task.consecutive_failures = (task.consecutive_failures or 0) + 1

            if pattern and pattern.should_cool_off:
                task.status = "needs_intervention"
                task.failure_pattern = {
                    "consecutive_failures": pattern.consecutive_failures,
                    "recent_failures": pattern.recent_failures,
                    "failure_reason": pattern.failure_reason.value,
                    "error_patterns": pattern.error_patterns,
                    "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat(),
                }
                task.next_execution = None
            else:
                task.status = "active"
                task.next_execution = datetime.utcnow() + timedelta(minutes=60)

            task_log.status = "failed"
            task_log.error_message = str(e)
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.add(task_log)
            db.commit()

            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=task_log.execution_time_ms,
                retryable=(task.status != "needs_intervention"),
                retry_delay=3600,
            )

    def calculate_next_execution(
        self,
        task: Any,
        frequency: str,
        last_execution: Optional[datetime] = None,
    ) -> datetime:
        base = last_execution or datetime.utcnow()
        hours = getattr(task, "frequency_hours", 24) or 24
        return base + timedelta(hours=hours)
