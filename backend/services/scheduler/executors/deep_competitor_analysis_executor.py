import asyncio
import time
from datetime import datetime, timedelta
from typing import Any, Dict

from sqlalchemy.orm import Session

from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog
)
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.seo.deep_competitor_analysis_service import DeepCompetitorAnalysisService
from utils.logger_utils import get_service_logger

logger = get_service_logger("deep_competitor_analysis_executor")

DEEP_COMPETITOR_TIMEOUT_SECONDS = 300  # 5-minute hard timeout
DEEP_COMPETITOR_MAX_COMPETITORS = 10   # cap to reduce API pressure


class DeepCompetitorAnalysisExecutor(TaskExecutor):
    def __init__(self):
        self.analysis_service = DeepCompetitorAnalysisService()
        self.integration_service = OnboardingDataIntegrationService()

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, DeepCompetitorAnalysisTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for deep competitor analysis",
                retryable=False
            )

        task_log = DeepCompetitorAnalysisExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow()
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)

        try:
            integrated = self.integration_service.get_integrated_data_sync(user_id, db)
            website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}

            payload = task.payload if isinstance(task.payload, dict) else {}
            competitors = payload.get("competitors")
            if not isinstance(competitors, list) or not competitors:
                # Try to get from research_preferences
                research_prefs = integrated.get("research_preferences") if isinstance(integrated, dict) else {}
                if isinstance(research_prefs, dict):
                    competitors = research_prefs.get("competitors")
                
                # If still not found, try to get from competitor_analysis (Step 3 persistence)
                if not isinstance(competitors, list) or not competitors:
                    competitors = integrated.get("competitor_analysis") if isinstance(integrated, dict) else []

            if not isinstance(competitors, list) or not competitors:
                logger.warning(f"Deep competitor analysis skipped for user {user_id}: No competitors found")
                
                task_log.status = "skipped"
                task_log.result_data = {"status": "skipped", "reason": "no_competitors"}
                task_log.execution_time_ms = int((time.time() - start_time) * 1000)
                
                # Mark task as completed but maybe pause it until user adds competitors?
                # Or just treat it as success (empty report) so it doesn't retry endlessly
                task.last_executed = datetime.utcnow()
                task.last_success = datetime.utcnow()
                task.status = "paused" # Pause it so it doesn't run again until triggered manually
                task.next_execution = None
                task.consecutive_failures = 0
                
                db.commit()
                
                return TaskExecutionResult(
                    success=True,
                    result_data={"status": "skipped", "reason": "no_competitors"},
                    execution_time_ms=task_log.execution_time_ms,
                    retryable=False
                )

            max_competitors = min(int(payload.get("max_competitors") or 25), DEEP_COMPETITOR_MAX_COMPETITORS)
            crawl_concurrency = int(payload.get("crawl_concurrency") or 4)
            mode = payload.get("mode", "deep_analysis")

            if mode == "strategic_insights":
                logger.info(f"Executing weekly strategic insights for user {user_id}")
                try:
                    report = await asyncio.wait_for(
                        self.analysis_service.generate_weekly_strategy_brief(
                            user_id=user_id,
                            website_analysis=website_analysis if isinstance(website_analysis, dict) else {},
                            competitors=competitors
                        ),
                        timeout=DEEP_COMPETITOR_TIMEOUT_SECONDS
                    )
                except asyncio.TimeoutError:
                    raise TimeoutError(f"Strategic insights timed out after {DEEP_COMPETITOR_TIMEOUT_SECONDS}s for user {user_id}")
                
                # Persist to WebsiteAnalysis history
                analysis_id = website_analysis.get('id')
                if analysis_id:
                    from models.onboarding import WebsiteAnalysis
                    from sqlalchemy.orm.attributes import flag_modified
                    
                    wa = db.query(WebsiteAnalysis).filter(WebsiteAnalysis.id == analysis_id).first()
                    if wa:
                        history = wa.strategic_insights_history or []
                        if not isinstance(history, list):
                            history = []
                        history.insert(0, report)
                        wa.strategic_insights_history = history[:52]
                        flag_modified(wa, "strategic_insights_history")
                        db.commit()
            else:
                try:
                    report = await asyncio.wait_for(
                        self.analysis_service.run(
                            user_id=user_id,
                            website_analysis=website_analysis if isinstance(website_analysis, dict) else {},
                            competitors=competitors,
                            max_competitors=max_competitors,
                            crawl_concurrency=crawl_concurrency
                        ),
                        timeout=DEEP_COMPETITOR_TIMEOUT_SECONDS
                    )
                except asyncio.TimeoutError:
                    raise TimeoutError(f"Deep competitor analysis timed out after {DEEP_COMPETITOR_TIMEOUT_SECONDS}s for user {user_id}")

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()
            
            # If it's a recurring task (strategic_insights), set next execution
            if mode == "strategic_insights":
                task.status = "active"
                task.next_execution = self.calculate_next_execution(task, "weekly", task.last_executed)
            else:
                task.status = "paused"
                task.next_execution = None

            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None

            task_log.status = "success"
            task_log.result_data = report
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.commit()

            try:
                await self.integration_service.refresh_integrated_data(user_id, db)
            except Exception as e:
                logger.warning(f"Deep competitor analysis SSOT refresh failed for user {user_id}: {e}")

            return TaskExecutionResult(
                success=True,
                result_data=report,
                execution_time_ms=task_log.execution_time_ms,
                retryable=False
            )

        except Exception as e:
            db.rollback()
            logger.warning(f"Deep competitor analysis task failed for user {user_id}: {e}")

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "deep_competitor_analysis", user_id)

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
                task.next_execution = datetime.utcnow() + timedelta(minutes=30)

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
                retry_delay=1800
            )

    def calculate_next_execution(self, task: Any, frequency: str, last_execution: datetime = None) -> datetime:
        base = last_execution or datetime.utcnow()
        if frequency == "weekly":
            return base + timedelta(days=7)
        return base + timedelta(days=365)

