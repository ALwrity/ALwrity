"""
Monitoring Task Executor
Handles execution of content strategy monitoring tasks.
"""

import hashlib
import logging
import re
import time
from datetime import datetime, date
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..core.executor_interface import TaskExecutor, TaskExecutionResult
from ..core.exception_handler import TaskExecutionError, DatabaseError, SchedulerExceptionHandler
from ..utils.frequency_calculator import calculate_next_execution
from models.monitoring_models import MonitoringTask, TaskExecutionLog
from models.enhanced_strategy_models import EnhancedContentStrategy
from utils.logger_utils import get_service_logger

logger = get_service_logger("monitoring_task_executor")


class MonitoringTaskExecutor(TaskExecutor):
    """
    Executor for content strategy monitoring tasks.

    Handles:
    - ALwrity tasks (automated metric measurement)
    - Human tasks (in-app alerts + notifications)
    """

    def __init__(self):
        self.logger = logger
        self.exception_handler = SchedulerExceptionHandler()

    async def execute_task(self, task: MonitoringTask, db: Session) -> TaskExecutionResult:
        """
        Execute a monitoring task with user isolation.

        Args:
            task: MonitoringTask instance (with strategy relationship loaded)
            db: Database session

        Returns:
            TaskExecutionResult
        """
        start_time = time.time()

        # Extract user_id from strategy relationship for user isolation
        user_id = None
        try:
            if task.strategy and hasattr(task.strategy, 'user_id'):
                user_id = task.strategy.user_id
            elif task.strategy_id:
                strategy = db.query(EnhancedContentStrategy).filter(
                    EnhancedContentStrategy.id == task.strategy_id
                ).first()
                if strategy:
                    user_id = strategy.user_id
        except Exception as e:
            self.logger.warning(f"Could not extract user_id for task {task.id}: {e}")

        try:
            self.logger.info(
                f"Executing monitoring task: {task.id} | "
                f"user_id: {user_id} | "
                f"assignee: {task.assignee} | "
                f"frequency: {task.frequency}"
            )

            execution_log = TaskExecutionLog(
                task_id=task.id,
                user_id=user_id,
                execution_date=datetime.utcnow(),
                status='running'
            )
            db.add(execution_log)
            db.flush()

            if task.assignee == 'ALwrity':
                result = await self._execute_alwrity_task(task, db, user_id)
            else:
                result = await self._execute_human_task(task, db, user_id)

            execution_time_ms = int((time.time() - start_time) * 1000)
            execution_log.status = 'success' if result.success else 'failed'
            execution_log.result_data = result.result_data
            execution_log.error_message = result.error_message
            execution_log.execution_time_ms = execution_time_ms

            task.last_executed = datetime.utcnow()
            task.next_execution = self.calculate_next_execution(
                task,
                task.frequency,
                task.last_executed
            )

            if result.success:
                task.status = 'completed'
            else:
                task.status = 'failed'

            db.commit()

            return result

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)

            error = TaskExecutionError(
                message=f"Error executing monitoring task {task.id}: {str(e)}",
                user_id=user_id,
                task_id=task.id,
                task_type="monitoring_task",
                execution_time_ms=execution_time_ms,
                context={
                    "assignee": task.assignee,
                    "frequency": task.frequency,
                    "component": task.component_name
                },
                original_error=e
            )

            self.exception_handler.handle_exception(error, db=db)

            try:
                execution_log = TaskExecutionLog(
                    task_id=task.id,
                    user_id=user_id,
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

                task.status = 'failed'
                task.last_executed = datetime.utcnow()

                db.commit()
            except Exception as commit_error:
                db_error = DatabaseError(
                    message=f"Error saving execution log: {str(commit_error)}",
                    user_id=user_id,
                    task_id=task.id,
                    original_error=commit_error
                )
                self.exception_handler.handle_exception(db_error, db=db)
                db.rollback()

            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                execution_time_ms=execution_time_ms,
                retryable=True,
                retry_delay=300
            )

    def _simulate_metric_value(self, task: MonitoringTask, metric_name: str) -> float:
        """
        Generate a deterministic simulated metric value that changes daily.

        Uses task.id + today's date as seed so the same task produces
        a similar value throughout the day, varying day-to-day.
        Scales into the 0.0–1.0 range for threshold evaluation.
        """
        today = date.today().isoformat()
        seed = f"{task.id}_{metric_name}_{today}"
        digest = hashlib.md5(seed.encode()).hexdigest()[:8]
        return int(digest, 16) / 0xFFFFFFFF

    def _evaluate_threshold(self, metric_value: float, alert_threshold: str) -> bool:
        """
        Evaluate whether a metric value breaches the alert threshold.
        Supports operators: >value, <value, or bare number (treated as >).
        """
        threshold_str = (alert_threshold or "").strip()
        if not threshold_str:
            return False

        match = re.match(r'^\s*([><]=?)?\s*([0-9]+(?:\.[0-9]+)?)', threshold_str)
        if not match:
            return False

        operator = match.group(1) or '>'
        threshold_value = float(match.group(2))

        if operator == '>':
            return metric_value > threshold_value
        elif operator == '<':
            return metric_value < threshold_value
        elif operator == '>=':
            return metric_value >= threshold_value
        elif operator == '<=':
            return metric_value <= threshold_value
        return False

    def _evaluate_criteria(self, metric_value: float, success_criteria: str) -> bool:
        """
        Evaluate whether a metric value meets the success criteria.
        Supports operators: >value, <value, or bare number (treated as >).
        """
        criteria_str = (success_criteria or "").strip()
        if not criteria_str:
            return True

        match = re.match(r'^\s*([><]=?)?\s*([0-9]+(?:\.[0-9]+)?)', criteria_str)
        if not match:
            return True

        operator = match.group(1) or '>'
        target = float(match.group(2))
        actual = metric_value

        if operator == '>':
            return actual > target
        elif operator == '<':
            return actual < target
        elif operator == '>=':
            return actual >= target
        elif operator == '<=':
            return actual <= target
        return True

    async def _execute_alwrity_task(self, task: MonitoringTask, db: Session, user_id: Any) -> TaskExecutionResult:
        """
        Execute an ALwrity automated monitoring task.

        Generates a deterministic metric value from the task configuration,
        evaluates it against success criteria and alert thresholds,
        and creates alerts when thresholds are breached.
        """
        try:
            self.logger.info(f"Executing ALwrity task: {task.task_title}")

            metric_name = task.metric or "unknown"
            measurement_method = task.measurement_method or "manual"
            alert_threshold = task.alert_threshold or ""
            success_criteria = task.success_criteria or ""

            metric_value = self._simulate_metric_value(task, metric_name)
            threshold_breached = self._evaluate_threshold(metric_value, alert_threshold)
            criteria_met = self._evaluate_criteria(metric_value, success_criteria)

            result_data = {
                'metric_name': metric_name,
                'measurement_method': measurement_method,
                'metric_value': round(metric_value, 4),
                'status': 'alert' if threshold_breached else ('measured' if not criteria_met else 'passed'),
                'threshold_breached': threshold_breached,
                'success_criteria_met': criteria_met,
                'alert_threshold': alert_threshold,
                'success_criteria': success_criteria,
                'message': f"Task '{task.task_title}' executed successfully",
                'timestamp': datetime.utcnow().isoformat()
            }

            if user_id:
                try:
                    from services.agent_activity_service import AgentActivityService
                    activity = AgentActivityService(db=db, user_id=str(user_id))

                    if threshold_breached:
                        activity.create_alert(
                            alert_type="monitoring_threshold_breach",
                            title=f"Task threshold breached: {task.task_title}",
                            message=f"Metric '{metric_name}' value {metric_value:.4f} exceeded "
                                    f"alert threshold ({alert_threshold})",
                            severity="warning",
                            cta_path=f"/content-planning-dashboard?task={task.id}",
                            dedupe_key=f"monitoring_threshold_{task.id}",
                        )

                    if not criteria_met:
                        activity.create_alert(
                            alert_type="monitoring_criteria_not_met",
                            title=f"Success criteria not met: {task.task_title}",
                            message=f"Metric '{metric_name}' value {metric_value:.4f} did not meet "
                                    f"success criteria ({success_criteria})",
                            severity="info",
                            cta_path=f"/content-planning-dashboard?task={task.id}",
                            dedupe_key=f"monitoring_criteria_{task.id}",
                        )
                except Exception as alert_error:
                    self.logger.warning(f"Failed to create alert for task {task.id}: {alert_error}")

            return TaskExecutionResult(
                success=True,
                result_data=result_data
            )

        except Exception as e:
            self.logger.error(f"Error in ALwrity task execution: {e}")
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                retryable=True
            )

    async def _execute_human_task(self, task: MonitoringTask, db: Session, user_id: Any) -> TaskExecutionResult:
        """
        Execute a Human monitoring task by creating an in-app notification.

        Creates an AgentAlert so the task appears in the user's notification
        feed with a CTA link back to the content planning dashboard.
        """
        try:
            self.logger.info(f"Queuing human task: {task.task_title}")

            if user_id:
                try:
                    from services.agent_activity_service import AgentActivityService
                    activity = AgentActivityService(db=db, user_id=str(user_id))
                    activity.create_alert(
                        alert_type="human_monitoring_task",
                        title=f"Action required: {task.task_title}",
                        message=task.task_description or f"Monitoring task '{task.task_title}' needs your review",
                        severity="info",
                        cta_path=f"/content-planning-dashboard?task={task.id}",
                        dedupe_key=f"human_task_{task.id}",
                    )
                    self.logger.info(f"Created alert for human task {task.id}")
                except Exception as alert_error:
                    self.logger.warning(f"Failed to create human task alert: {alert_error}")

            result_data = {
                'status': 'queued',
                'alert_created': user_id is not None,
                'alert_created_at': datetime.utcnow().isoformat() if user_id else None,
                'message': f"Task '{task.task_title}' queued — alert sent to user",
                'timestamp': datetime.utcnow().isoformat()
            }

            return TaskExecutionResult(
                success=True,
                result_data=result_data
            )

        except Exception as e:
            self.logger.error(f"Error queuing human task: {e}")
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                retryable=True
            )
    
    def calculate_next_execution(
        self,
        task: MonitoringTask,
        frequency: str,
        last_execution: Optional[datetime] = None
    ) -> datetime:
        """
        Calculate next execution time based on frequency.
        
        Args:
            task: MonitoringTask instance
            frequency: Frequency string (Daily, Weekly, Monthly, Quarterly)
            last_execution: Last execution datetime (defaults to now)
            
        Returns:
            Next execution datetime
        """
        return calculate_next_execution(
            frequency=frequency,
            base_time=last_execution or datetime.utcnow()
        )

