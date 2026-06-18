"""
Comprehensive Exception Handling and Logging for Task Scheduler
Provides robust error handling, logging, and monitoring for the scheduler system.
"""

import traceback
import sys
from datetime import datetime
from typing import Dict, Any, Optional, Union
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError, IntegrityError

from utils.logger_utils import get_service_logger

logger = get_service_logger("scheduler_exception_handler")


class SchedulerErrorType(Enum):
    """Error types for scheduler system."""
    DATABASE_ERROR = "database_error"
    TASK_EXECUTION_ERROR = "task_execution_error"
    TASK_LOADER_ERROR = "task_loader_error"
    SCHEDULER_CONFIG_ERROR = "scheduler_config_error"
    RETRY_ERROR = "retry_error"
    CONCURRENCY_ERROR = "concurrency_error"
    TIMEOUT_ERROR = "timeout_error"


class SchedulerErrorSeverity(Enum):
    """Severity levels for scheduler errors."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SchedulerException(Exception):
    """Base exception for scheduler system errors."""
    
    def __init__(
        self,
        message: str,
        error_type: SchedulerErrorType,
        severity: SchedulerErrorSeverity = SchedulerErrorSeverity.MEDIUM,
        user_id: Optional[int] = None,
        task_id: Optional[int] = None,
        task_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        original_error: Optional[Exception] = None
    ):
        self.message = message
        self.error_type = error_type
        self.severity = severity
        self.user_id = user_id
        self.task_id = task_id
        self.task_type = task_type
        self.context = context or {}
        self.original_error = original_error
        self.timestamp = datetime.utcnow()
        
        # Capture stack trace if original error provided
        self.stack_trace = None
        if self.original_error:
            try:
                exc_type, exc_value, exc_traceback = sys.exc_info()
                if exc_traceback:
                    self.stack_trace = ''.join(traceback.format_exception(
                        exc_type, exc_value, exc_traceback
                    ))
                else:
                    self.stack_trace = traceback.format_exception(
                        type(self.original_error),
                        self.original_error,
                        self.original_error.__traceback__
                    )
            except Exception:
                self.stack_trace = str(self.original_error)
        
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for logging/storage."""
        return {
            "message": self.message,
            "error_type": self.error_type.value,
            "severity": self.severity.value,
            "user_id": self.user_id,
            "task_id": self.task_id,
            "task_type": self.task_type,
            "context": self.context,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
            "original_error": str(self.original_error) if self.original_error else None,
            "stack_trace": self.stack_trace
        }
    
    def __str__(self):
        return f"[{self.error_type.value}] {self.message}"


class DatabaseError(SchedulerException):
    """Exception raised for database-related errors."""
    
    def __init__(
        self,
        message: str,
        user_id: Optional[int] = None,
        task_id: Optional[int] = None,
        task_type: Optional[str] = None,
        context: Dict[str, Any] = None,
        original_error: Exception = None
    ):
        super().__init__(
            message=message,
            error_type=SchedulerErrorType.DATABASE_ERROR,
            severity=SchedulerErrorSeverity.CRITICAL,
            user_id=user_id,
            task_id=task_id,
            task_type=task_type,
            context=context or {},
            original_error=original_error
        )


class TaskExecutionError(SchedulerException):
    """Exception raised for task execution failures."""
    
    def __init__(
        self,
        message: str,
        user_id: Optional[int] = None,
        task_id: Optional[int] = None,
        task_type: Optional[str] = None,
        retry_count: int = 0,
        execution_time_ms: Optional[int] = None,
        context: Dict[str, Any] = None,
        original_error: Exception = None
    ):
        context = context or {}
        context.update({
            "retry_count": retry_count,
            "execution_time_ms": execution_time_ms
        })
        
        super().__init__(
            message=message,
            error_type=SchedulerErrorType.TASK_EXECUTION_ERROR,
            severity=SchedulerErrorSeverity.HIGH,
            user_id=user_id,
            task_id=task_id,
            task_type=task_type,
            context=context,
            original_error=original_error
        )


class TaskLoaderError(SchedulerException):
    """Exception raised for task loading failures."""
    
    def __init__(
        self,
        message: str,
        task_type: Optional[str] = None,
        user_id: Optional[int] = None,
        context: Dict[str, Any] = None,
        original_error: Exception = None
    ):
        super().__init__(
            message=message,
            error_type=SchedulerErrorType.TASK_LOADER_ERROR,
            severity=SchedulerErrorSeverity.HIGH,
            user_id=user_id,
            task_type=task_type,
            context=context or {},
            original_error=original_error
        )


class SchedulerConfigError(SchedulerException):
    """Exception raised for scheduler configuration errors."""
    
    def __init__(
        self,
        message: str,
        user_id: Optional[int] = None,
        task_id: Optional[int] = None,
        task_type: Optional[str] = None,
        context: Dict[str, Any] = None,
        original_error: Exception = None
    ):
        super().__init__(
            message=message,
            error_type=SchedulerErrorType.SCHEDULER_CONFIG_ERROR,
            severity=SchedulerErrorSeverity.CRITICAL,
            user_id=user_id,
            task_id=task_id,
            task_type=task_type,
            context=context or {},
            original_error=original_error
        )


class SchedulerExceptionHandler:
    """Comprehensive exception handler for the scheduler system."""
    
    def __init__(self, db: Session = None):
        self.db = db
        self.logger = logger
    
    def handle_exception(
        self,
        error: Union[Exception, SchedulerException],
        context: Dict[str, Any] = None,
        log_level: str = "error",
        db: Session = None
    ) -> Dict[str, Any]:
        """Handle and log scheduler exceptions."""
        
        context = context or {}
        
        # Convert regular exceptions to SchedulerException
        if not isinstance(error, SchedulerException):
            error = SchedulerException(
                message=str(error),
                error_type=self._classify_error(error),
                severity=self._determine_severity(error),
                context=context,
                original_error=error
            )
        
        # Log the error
        error_data = error.to_dict()
        error_data.update(context)
        
        log_message = f"Scheduler Error: {error.message}"
        
        if log_level == "critical" or error.severity == SchedulerErrorSeverity.CRITICAL:
            self.logger.critical(log_message, extra={"error_data": error_data})
        elif log_level == "error" or error.severity == SchedulerErrorSeverity.HIGH:
            self.logger.error(log_message, extra={"error_data": error_data})
        elif log_level == "warning" or error.severity == SchedulerErrorSeverity.MEDIUM:
            self.logger.warning(log_message, extra={"error_data": error_data})
        else:
            self.logger.info(log_message, extra={"error_data": error_data})
        
        # Store critical errors in database for alerting
        if error.severity in [SchedulerErrorSeverity.HIGH, SchedulerErrorSeverity.CRITICAL]:
            self._store_error_alert(error, db=db)
        
        # Return formatted error response
        return self._format_error_response(error)
    
    def _classify_error(self, error: Exception) -> SchedulerErrorType:
        """Classify an exception into a scheduler error type."""
        
        error_str = str(error).lower()
        error_type_name = type(error).__name__.lower()
        
        # Database errors
        if isinstance(error, (SQLAlchemyError, OperationalError, IntegrityError)):
            return SchedulerErrorType.DATABASE_ERROR
        if "database" in error_str or "sql" in error_type_name or "connection" in error_str:
            return SchedulerErrorType.DATABASE_ERROR
        
        # Timeout errors
        if "timeout" in error_str or "timed out" in error_str:
            return SchedulerErrorType.TIMEOUT_ERROR
        
        # Concurrency errors
        if "concurrent" in error_str or "race" in error_str or "lock" in error_str:
            return SchedulerErrorType.CONCURRENCY_ERROR
        
        # Task execution errors
        if "task" in error_str and "execut" in error_str:
            return SchedulerErrorType.TASK_EXECUTION_ERROR
        
        # Task loader errors
        if "load" in error_str and "task" in error_str:
            return SchedulerErrorType.TASK_LOADER_ERROR
        
        # Retry errors
        if "retry" in error_str:
            return SchedulerErrorType.RETRY_ERROR
        
        # Config errors
        if "config" in error_str or "scheduler" in error_str and "init" in error_str:
            return SchedulerErrorType.SCHEDULER_CONFIG_ERROR
        
        # Default to task execution error for unknown errors
        return SchedulerErrorType.TASK_EXECUTION_ERROR
    
    def _determine_severity(self, error: Exception) -> SchedulerErrorSeverity:
        """Determine the severity of an error."""
        
        error_str = str(error).lower()
        error_type = type(error)
        
        # Critical errors
        if isinstance(error, (SQLAlchemyError, OperationalError, ConnectionError)):
            return SchedulerErrorSeverity.CRITICAL
        if "database" in error_str or "connection" in error_str:
            return SchedulerErrorSeverity.CRITICAL
        
        # High severity errors
        if "timeout" in error_str or "concurrent" in error_str:
            return SchedulerErrorSeverity.HIGH
        if isinstance(error, (KeyError, AttributeError)) and "config" in error_str:
            return SchedulerErrorSeverity.HIGH
        
        # Medium severity errors
        if "task" in error_str or "execution" in error_str:
            return SchedulerErrorSeverity.MEDIUM
        
        # Default to low
        return SchedulerErrorSeverity.LOW
    
    def _store_error_alert(self, error: SchedulerException, db: Session = None):
        """Store critical errors in database for alerting."""
        
        session = db or self.db
        if not session:
            return
        
        try:
            # Import here to avoid circular dependencies
            from models.monitoring_models import TaskExecutionLog
            
            # Store as failed execution log if we have task_id (even without user_id for system errors)
            if error.task_id:
                try:
                    execution_log = TaskExecutionLog(
                        task_id=error.task_id,
                        user_id=error.user_id,  # Can be None for system-level errors
                        execution_date=error.timestamp,
                        status='failed',
                        error_message=error.message,
                        result_data={
                            "error_type": error.error_type.value,
                            "severity": error.severity.value,
                            "context": error.context,
                            "stack_trace": error.stack_trace,
                            "task_type": error.task_type
                        }
                    )
                    session.add(execution_log)
                    session.commit()
                    self.logger.info(f"Stored error alert in execution log for task {error.task_id}")
                except Exception as e:
                    self.logger.error(f"Failed to store error in execution log: {e}", exc_info=True)
                    session.rollback()
            # Note: For errors without task_id, we rely on structured logging only
            # Future: Could create a separate scheduler_error_logs table for system-level errors
        
        except Exception as e:
            self.logger.error(f"Failed to store error alert: {e}", exc_info=True)
    
    def _format_error_response(self, error: SchedulerException) -> Dict[str, Any]:
        """Format error for API response or logging."""
        
        response = {
            "success": False,
            "error": {
                "type": error.error_type.value,
                "message": error.message,
                "severity": error.severity.value,
                "timestamp": error.timestamp.isoformat() if isinstance(error.timestamp, datetime) else str(error.timestamp),
                "user_id": error.user_id,
                "task_id": error.task_id,
                "task_type": error.task_type
            }
        }
        
        # Add context for debugging (non-sensitive info only)
        if error.context:
            safe_context = {
                k: v for k, v in error.context.items()
                if k not in ["password", "token", "key", "secret", "credential"]
            }
            response["error"]["context"] = safe_context
        
        # Add user-friendly message based on error type
        user_messages = {
            SchedulerErrorType.DATABASE_ERROR:
                "A database error occurred while processing the task. Please try again later.",
            SchedulerErrorType.TASK_EXECUTION_ERROR:
                "The task failed to execute. Please check the task configuration and try again.",
            SchedulerErrorType.TASK_LOADER_ERROR:
                "Failed to load tasks. The scheduler may be experiencing issues.",
            SchedulerErrorType.SCHEDULER_CONFIG_ERROR:
                "The scheduler configuration is invalid. Contact support.",
            SchedulerErrorType.RETRY_ERROR:
                "Task retry failed. The task will be rescheduled.",
            SchedulerErrorType.CONCURRENCY_ERROR:
                "A concurrency issue occurred. The task will be retried.",
            SchedulerErrorType.TIMEOUT_ERROR:
                "The task execution timed out. The task will be retried."
        }
        
        response["error"]["user_message"] = user_messages.get(
            error.error_type,
            "An error occurred while processing the task."
        )
        
        return response

