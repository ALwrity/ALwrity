"""
LinkedIn Growth Reanalysis Executor
Re-runs ConsolidatedGrowthService.analyze_all() on a recurring schedule
to capture trending topic and strategy drift.
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.linkedin_monitoring_models import (
    LinkedInGrowthReanalysisTask,
    LinkedInGrowthReanalysisExecutionLog,
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.linkedin.types import LinkedInNotConnectedError
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_growth_reanalysis_executor")


class LinkedInGrowthReanalysisExecutor(TaskExecutor):
    """Executor for recurring LinkedIn growth reanalysis."""

    def __init__(self):
        pass

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, LinkedInGrowthReanalysisTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for LinkedIn growth reanalysis",
                retryable=False,
            )

        task_log = LinkedInGrowthReanalysisExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow(),
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)

        try:
            logger.info(f"Executing LinkedIn growth reanalysis for user {user_id}")

            oauth = LinkedInOAuthService()
            try:
                oauth.resolve_credentials(user_id)
            except LinkedInNotConnectedError as e:
                logger.warning(f"[linkedin_growth_reanalysis] User {user_id} not connected: {e}")
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

            from services.linkedin.growth.consolidated_growth_service import ConsolidatedGrowthService

            service = ConsolidatedGrowthService()
            response = await service.analyze_all(user_id)

            try:
                growth_data = response.model_dump(mode="json")
            except AttributeError:
                growth_data = response.dict()

            result_data = {
                "generated_at": growth_data.get("generated_at"),
                "trending_industry": (
                    growth_data.get("trending", {}).get("industry")
                    if isinstance(growth_data.get("trending"), dict)
                    else None
                ),
                "brand_overall_score": (
                    growth_data.get("brand_scorecard", {}).get("overall_score")
                    if isinstance(growth_data.get("brand_scorecard"), dict)
                    else None
                ),
            }

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None
            frequency_hours = task.frequency_hours or 72
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
            logger.warning(f"[linkedin_growth_reanalysis] Task failed for user {user_id}: {e}")

            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "linkedin_growth_reanalysis", user_id)

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
        hours = getattr(task, "frequency_hours", 72) or 72
        return base + timedelta(hours=hours)
