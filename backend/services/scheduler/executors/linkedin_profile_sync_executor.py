"""
LinkedIn Profile Sync Executor
Re-runs the LinkedIn profile pipeline (Phases 1-5) on a recurring schedule
to catch external profile changes.
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.linkedin_monitoring_models import (
    LinkedInProfileSyncTask,
    LinkedInProfileSyncExecutionLog,
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.integrations.linkedin.types import LinkedInNotConnectedError
from utils.logger_utils import get_service_logger

logger = get_service_logger("linkedin_profile_sync_executor")


class LinkedInProfileSyncExecutor(TaskExecutor):
    """Executor for recurring LinkedIn profile pipeline syncs."""

    def __init__(self):
        pass

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, LinkedInProfileSyncTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for LinkedIn profile sync",
                retryable=False,
            )

        task_log = LinkedInProfileSyncExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow(),
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)

        try:
            logger.info(f"Executing LinkedIn profile sync for user {user_id}")

            oauth = LinkedInOAuthService()
            try:
                oauth.resolve_credentials(user_id)
            except LinkedInNotConnectedError as e:
                logger.warning(f"[linkedin_profile_sync] User {user_id} not connected: {e}")
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

            from services.integrations.linkedin.profile_repository import ProfileRepository
            from services.integrations.linkedin.profile_service import get_or_fetch_profile
            from services.integrations.linkedin.profile_context_service import get_or_build_profile_context
            from services.integrations.linkedin.profile_validation_service import get_or_validate_profile_context
            from services.integrations.linkedin.profile_intelligence_service import get_or_generate_profile_intelligence

            repository = ProfileRepository(oauth=oauth)

            # Phase 1: Acquire profile
            profile, meta = await get_or_fetch_profile(
                user_id, refresh=True, oauth=oauth
            )

            # Phase 2: Build context
            profile_context, _ = get_or_build_profile_context(
                user_id,
                profile,
                profile_content_hash=meta.get("profile_content_hash"),
                repository=repository,
            )

            # Phase 3: Validate
            profile_validation, _ = get_or_validate_profile_context(
                user_id, profile_context, repository=repository
            )

            # Phase 5: AI intelligence
            ai_intelligence = None
            if profile_validation and profile_validation.get("is_profile_complete"):
                try:
                    ai_intelligence, _ = get_or_generate_profile_intelligence(
                        user_id,
                        profile_context,
                        profile_validation=profile_validation,
                        repository=repository,
                    )
                except Exception as e:
                    logger.warning(f"[linkedin_profile_sync] AI intelligence generation failed: {e}")

            result_data = {
                "name": profile.get("name", ""),
                "headline": profile.get("headline", ""),
                "industry": profile_context.get("industry", ""),
                "profile_content_hash": meta.get("profile_content_hash"),
                "is_profile_complete": bool(profile_validation.get("is_profile_complete", False)) if profile_validation else False,
                "completeness_score": float(profile_validation.get("completeness_score", 0)) if profile_validation else 0.0,
                "optimization_score": float(profile_validation.get("optimization_score", 0)) if profile_validation else 0.0,
                "missing_fields": list(profile_validation.get("missing_fields", [])) if profile_validation else [],
                "ai_intelligence_generated": bool(ai_intelligence),
            }

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None
            frequency_days = task.frequency_days or 7
            task.next_execution = datetime.utcnow() + timedelta(days=frequency_days)
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
            logger.warning(f"[linkedin_profile_sync] Task failed for user {user_id}: {e}")

            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "linkedin_profile_sync", user_id)

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
        days = getattr(task, "frequency_days", 7) or 7
        return base + timedelta(days=days)
