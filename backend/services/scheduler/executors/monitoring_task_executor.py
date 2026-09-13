"""
Monitoring Task Executor
Handles execution of content strategy monitoring tasks.
"""

import logging
import re
import time
from datetime import datetime
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
                task.status = 'active'
                task.last_executed = datetime.utcnow()
                task.next_execution = self.calculate_next_execution(
                    task,
                    task.frequency,
                    task.last_executed
                )
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
        """Execute an ALwrity automated monitoring task on REAL tools.

        Delegates to ``monitoring_bridge.execute_alwrity_orm`` (Phase 3a):
        ORM row -> deterministic task dict -> ``MonitoringExecutor``
        real tool dispatch. Fail-fast — any tool error raises and is
        returned as ``success=False`` with ``retryable=True``; no
        simulated values, no stub payloads.
        """
        try:
            self.logger.info(
                f"Executing ALwrity task: {task.task_title} | "
                f"task_id={task.id} user_id={user_id} metric={task.metric}"
            )
            from .monitoring_bridge import execute_alwrity_orm
            tool_result = await execute_alwrity_orm(task, db, user_id)
            metric_name = task.metric or "unknown"
            result_data = {
                "metric_name": metric_name,
                "measurement_method": task.measurement_method or "unknown",
                "tool_result": tool_result,
                "status": "measured",
                "message": f"Task '{task.task_title}' executed on real tools",
                "timestamp": datetime.utcnow().isoformat(),
            }
            return TaskExecutionResult(success=True, result_data=result_data)
        except Exception as e:
            # Fail fast: surface the real error, never a fake value.
            self.logger.error(
                f"Real tool execution failed for task {task.id} "
                f"metric={task.metric}: {e}"
            )
            return TaskExecutionResult(
                success=False,
                error_message=str(e),
                retryable=True,
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

