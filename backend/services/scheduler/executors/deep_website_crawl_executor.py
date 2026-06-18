import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models.website_analysis_monitoring_models import (
    DeepWebsiteCrawlTask,
    DeepWebsiteCrawlExecutionLog
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.research.deep_crawl_service import DeepCrawlService
from utils.logger_utils import get_service_logger

logger = get_service_logger("deep_website_crawl_executor")


class DeepWebsiteCrawlExecutor(TaskExecutor):
    def __init__(self):
        self.crawl_service = DeepCrawlService()

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, DeepWebsiteCrawlTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for deep website crawl",
                retryable=False
            )

        task_log = DeepWebsiteCrawlExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow()
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)
        website_url = task.website_url

        try:
            logger.info(f"Executing deep website crawl for user {user_id}, url {website_url}")
            
            result = await self.crawl_service.execute_deep_crawl(
                user_id=user_id,
                website_url=website_url
            )

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.status = "active" # Keep active for recurring? Or paused?
            # User said "schedule this task". So likely recurring.
            # But usually crawl is heavy, maybe weekly.
            
            # Calculate next execution
            task.next_execution = self.calculate_next_execution(task, "Weekly", task.last_executed)
            
            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None

            task_log.status = "success"
            task_log.result_data = result
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.commit()

            return TaskExecutionResult(
                success=True,
                result_data=result,
                execution_time_ms=task_log.execution_time_ms,
                retryable=False
            )

        except Exception as e:
            db.rollback()
            logger.warning(f"Deep website crawl task failed for user {user_id}: {e}")

            # Re-merge objects after rollback to avoid DetachedInstanceError
            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "deep_website_crawl", user_id)

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
                    "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                }
                task.next_execution = None
            else:
                task.status = "failed"
                task.next_execution = datetime.utcnow() + timedelta(minutes=60) # Retry in hour

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
                retry_delay=3600
            )

    def calculate_next_execution(
        self,
        task: Any,
        frequency: str,
        last_execution: Optional[datetime] = None
    ) -> datetime:
        """
        Calculate next execution time based on frequency.
        """
        if not last_execution:
            last_execution = datetime.utcnow()
            
        if frequency == 'Daily':
            return last_execution + timedelta(days=1)
        elif frequency == 'Weekly':
            return last_execution + timedelta(weeks=1)
        elif frequency == 'Monthly':
            return last_execution + timedelta(days=30)
        else:
            # Default to weekly if unknown
            return last_execution + timedelta(weeks=1)
