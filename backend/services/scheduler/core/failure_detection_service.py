"""
Failure Detection Service
Analyzes execution logs to detect failure patterns and mark tasks for human intervention.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from enum import Enum
import json

from utils.logger_utils import get_service_logger

logger = get_service_logger("failure_detection")


class FailureReason(Enum):
    """Categories of failure reasons."""
    API_LIMIT = "api_limit"  # 429, rate limits, quota exceeded
    AUTH_ERROR = "auth_error"  # 401, 403, token expired
    NETWORK_ERROR = "network_error"  # Connection errors, timeouts
    CONFIG_ERROR = "config_error"  # Missing config, invalid parameters
    UNKNOWN = "unknown"  # Other errors


class FailurePattern:
    """Represents a failure pattern for a task."""
    
    def __init__(
        self,
        task_id: int,
        task_type: str,
        user_id: str,
        consecutive_failures: int,
        recent_failures: int,
        failure_reason: FailureReason,
        last_failure_time: Optional[datetime],
        error_patterns: List[str],
        should_cool_off: bool
    ):
        self.task_id = task_id
        self.task_type = task_type
        self.user_id = user_id
        self.consecutive_failures = consecutive_failures
        self.recent_failures = recent_failures
        self.failure_reason = failure_reason
        self.last_failure_time = last_failure_time
        self.error_patterns = error_patterns
        self.should_cool_off = should_cool_off


class FailureDetectionService:
    """Service for detecting failure patterns in task execution logs."""
    
    # Cool-off thresholds
    CONSECUTIVE_FAILURE_THRESHOLD = 3  # 3 consecutive failures
    RECENT_FAILURE_THRESHOLD = 5  # 5 failures in last 7 days
    COOL_OFF_PERIOD_DAYS = 7  # Cool-off period after marking for intervention
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logger
    
    def analyze_task_failures(
        self,
        task_id: int,
        task_type: str,
        user_id: str
    ) -> Optional[FailurePattern]:
        """
        Analyze failure patterns for a specific task.
        
        Args:
            task_id: Task ID
            task_type: Task type (oauth_token_monitoring, website_analysis, etc.)
            user_id: User ID
            
        Returns:
            FailurePattern if pattern detected, None otherwise
        """
        try:
            # Get execution logs for this task
            execution_logs = self._get_execution_logs(task_id, task_type)
            
            if not execution_logs:
                return None
            
            # Analyze failure patterns
            consecutive_failures = self._count_consecutive_failures(execution_logs)
            recent_failures = self._count_recent_failures(execution_logs, days=7)
            failure_reason = self._classify_failure_reason(execution_logs)
            error_patterns = self._extract_error_patterns(execution_logs)
            last_failure_time = self._get_last_failure_time(execution_logs)
            
            # Determine if task should be cooled off
            should_cool_off = (
                consecutive_failures >= self.CONSECUTIVE_FAILURE_THRESHOLD or
                recent_failures >= self.RECENT_FAILURE_THRESHOLD
            )
            
            if should_cool_off:
                self.logger.warning(
                    f"Failure pattern detected for task {task_id} ({task_type}): "
                    f"consecutive={consecutive_failures}, recent={recent_failures}, "
                    f"reason={failure_reason.value}"
                )
            
            return FailurePattern(
                task_id=task_id,
                task_type=task_type,
                user_id=user_id,
                consecutive_failures=consecutive_failures,
                recent_failures=recent_failures,
                failure_reason=failure_reason,
                last_failure_time=last_failure_time,
                error_patterns=error_patterns,
                should_cool_off=should_cool_off
            )
            
        except Exception as e:
            self.logger.error(f"Error analyzing task failures for task {task_id}: {e}", exc_info=True)
            return None
    
    def _get_execution_logs(self, task_id: int, task_type: str) -> List[Dict[str, Any]]:
        """Get execution logs for a task."""
        try:
            if task_type == "oauth_token_monitoring":
                from models.oauth_token_monitoring_models import OAuthTokenExecutionLog
                logs = self.db.query(OAuthTokenExecutionLog).filter(
                    OAuthTokenExecutionLog.task_id == task_id
                ).order_by(OAuthTokenExecutionLog.execution_date.desc()).all()
                
                return [
                    {
                        "status": log.status,
                        "error_message": log.error_message,
                        "execution_date": log.execution_date,
                        "result_data": log.result_data
                    }
                    for log in logs
                ]
            elif task_type == "website_analysis":
                from models.website_analysis_monitoring_models import WebsiteAnalysisExecutionLog
                logs = self.db.query(WebsiteAnalysisExecutionLog).filter(
                    WebsiteAnalysisExecutionLog.task_id == task_id
                ).order_by(WebsiteAnalysisExecutionLog.execution_date.desc()).all()
                
                return [
                    {
                        "status": log.status,
                        "error_message": log.error_message,
                        "execution_date": log.execution_date,
                        "result_data": log.result_data
                    }
                    for log in logs
                ]
            elif task_type in ["gsc_insights", "bing_insights", "platform_insights"]:
                from models.platform_insights_monitoring_models import PlatformInsightsExecutionLog
                logs = self.db.query(PlatformInsightsExecutionLog).filter(
                    PlatformInsightsExecutionLog.task_id == task_id
                ).order_by(PlatformInsightsExecutionLog.execution_date.desc()).all()
                
                return [
                    {
                        "status": log.status,
                        "error_message": log.error_message,
                        "execution_date": log.execution_date,
                        "result_data": log.result_data
                    }
                    for log in logs
                ]
            else:
                # Fallback to monitoring_task execution logs
                from models.monitoring_models import TaskExecutionLog
                logs = self.db.query(TaskExecutionLog).filter(
                    TaskExecutionLog.task_id == task_id
                ).order_by(TaskExecutionLog.execution_date.desc()).all()
                
                return [
                    {
                        "status": log.status,
                        "error_message": log.error_message,
                        "execution_date": log.execution_date,
                        "result_data": log.result_data
                    }
                    for log in logs
                ]
        except Exception as e:
            self.logger.error(f"Error getting execution logs for task {task_id}: {e}", exc_info=True)
            return []
    
    def _count_consecutive_failures(self, logs: List[Dict[str, Any]]) -> int:
        """Count consecutive failures from most recent."""
        count = 0
        for log in logs:
            if log["status"] == "failed":
                count += 1
            else:
                break  # Stop at first success
        return count
    
    def _count_recent_failures(self, logs: List[Dict[str, Any]], days: int = 7) -> int:
        """Count failures in the last N days."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        return sum(
            1 for log in logs
            if log["status"] == "failed" and log["execution_date"] >= cutoff
        )
    
    def _classify_failure_reason(self, logs: List[Dict[str, Any]]) -> FailureReason:
        """Classify the primary failure reason from error messages."""
        # Check most recent failures first
        recent_failures = [log for log in logs if log["status"] == "failed"][:5]
        
        for log in recent_failures:
            error_message = (log.get("error_message") or "").lower()
            result_data = log.get("result_data") or {}
            
            # Check for API limits (429)
            if "429" in error_message or "rate limit" in error_message or "limit reached" in error_message:
                return FailureReason.API_LIMIT
            
            # Check result_data for API limit info
            if isinstance(result_data, dict):
                if result_data.get("error_status") == 429:
                    return FailureReason.API_LIMIT
                if "limit" in str(result_data).lower() and "reached" in str(result_data).lower():
                    return FailureReason.API_LIMIT
                # Check for usage info indicating limits
                usage_info = result_data.get("usage_info", {})
                if isinstance(usage_info, dict):
                    if usage_info.get("usage_percentage", 0) >= 100:
                        return FailureReason.API_LIMIT
            
            # Check for auth errors
            if "401" in error_message or "403" in error_message or "unauthorized" in error_message or "forbidden" in error_message:
                return FailureReason.AUTH_ERROR
            if "token" in error_message and ("expired" in error_message or "invalid" in error_message):
                return FailureReason.AUTH_ERROR
            
            # Check for network errors
            if "timeout" in error_message or "connection" in error_message or "network" in error_message:
                return FailureReason.NETWORK_ERROR
            
            # Check for config errors
            if "config" in error_message or "missing" in error_message or "invalid" in error_message:
                return FailureReason.CONFIG_ERROR
        
        return FailureReason.UNKNOWN
    
    def _extract_error_patterns(self, logs: List[Dict[str, Any]]) -> List[str]:
        """Extract common error patterns from failure logs."""
        patterns = []
        recent_failures = [log for log in logs if log["status"] == "failed"][:5]
        
        for log in recent_failures:
            error_message = log.get("error_message") or ""
            if error_message:
                # Extract key phrases (first 100 chars)
                pattern = error_message[:100].strip()
                if pattern and pattern not in patterns:
                    patterns.append(pattern)
        
        return patterns[:3]  # Return top 3 patterns
    
    def _get_last_failure_time(self, logs: List[Dict[str, Any]]) -> Optional[datetime]:
        """Get the timestamp of the most recent failure."""
        for log in logs:
            if log["status"] == "failed":
                return log["execution_date"]
        return None
    
    def get_tasks_needing_intervention(
        self,
        user_id: Optional[str] = None,
        task_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all tasks that need human intervention.
        
        Args:
            user_id: Optional user ID filter
            task_type: Optional task type filter
            
        Returns:
            List of task dictionaries with failure pattern info
        """
        try:
            tasks_needing_intervention = []
            
            # Check OAuth token monitoring tasks
            from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
            oauth_tasks = self.db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.status == "needs_intervention"
            )
            if user_id:
                oauth_tasks = oauth_tasks.filter(OAuthTokenMonitoringTask.user_id == user_id)
            
            for task in oauth_tasks.all():
                pattern = self.analyze_task_failures(task.id, "oauth_token_monitoring", task.user_id)
                if pattern:
                    tasks_needing_intervention.append({
                        "task_id": task.id,
                        "task_type": "oauth_token_monitoring",
                        "user_id": task.user_id,
                        "platform": task.platform,
                        "failure_pattern": {
                            "consecutive_failures": pattern.consecutive_failures,
                            "recent_failures": pattern.recent_failures,
                            "failure_reason": pattern.failure_reason.value,
                            "last_failure_time": pattern.last_failure_time.isoformat() if pattern.last_failure_time else None,
                            "error_patterns": pattern.error_patterns
                        },
                        "failure_reason": task.failure_reason,
                        "last_failure": task.last_failure.isoformat() if task.last_failure else None
                    })
            
            # Check website analysis tasks
            from models.website_analysis_monitoring_models import WebsiteAnalysisTask
            website_tasks = self.db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.status == "needs_intervention"
            )
            if user_id:
                website_tasks = website_tasks.filter(WebsiteAnalysisTask.user_id == user_id)
            
            for task in website_tasks.all():
                pattern = self.analyze_task_failures(task.id, "website_analysis", task.user_id)
                if pattern:
                    tasks_needing_intervention.append({
                        "task_id": task.id,
                        "task_type": "website_analysis",
                        "user_id": task.user_id,
                        "website_url": task.website_url,
                        "failure_pattern": {
                            "consecutive_failures": pattern.consecutive_failures,
                            "recent_failures": pattern.recent_failures,
                            "failure_reason": pattern.failure_reason.value,
                            "last_failure_time": pattern.last_failure_time.isoformat() if pattern.last_failure_time else None,
                            "error_patterns": pattern.error_patterns
                        },
                        "failure_reason": task.failure_reason,
                        "last_failure": task.last_failure.isoformat() if task.last_failure else None
                    })
            
            # Check platform insights tasks
            from models.platform_insights_monitoring_models import PlatformInsightsTask
            insights_tasks = self.db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.status == "needs_intervention"
            )
            if user_id:
                insights_tasks = insights_tasks.filter(PlatformInsightsTask.user_id == user_id)
            
            for task in insights_tasks.all():
                task_type_str = f"{task.platform}_insights"
                pattern = self.analyze_task_failures(task.id, task_type_str, task.user_id)
                if pattern:
                    tasks_needing_intervention.append({
                        "task_id": task.id,
                        "task_type": task_type_str,
                        "user_id": task.user_id,
                        "platform": task.platform,
                        "failure_pattern": {
                            "consecutive_failures": pattern.consecutive_failures,
                            "recent_failures": pattern.recent_failures,
                            "failure_reason": pattern.failure_reason.value,
                            "last_failure_time": pattern.last_failure_time.isoformat() if pattern.last_failure_time else None,
                            "error_patterns": pattern.error_patterns
                        },
                        "failure_reason": task.failure_reason,
                        "last_failure": task.last_failure.isoformat() if task.last_failure else None
                    })
            
            # Check onboarding full website analysis tasks
            from models.website_analysis_monitoring_models import OnboardingFullWebsiteAnalysisTask
            onboarding_tasks = self.db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.status == "needs_intervention"
            )
            if user_id:
                onboarding_tasks = onboarding_tasks.filter(OnboardingFullWebsiteAnalysisTask.user_id == user_id)
            
            for task in onboarding_tasks.all():
                pattern = self.analyze_task_failures(task.id, "onboarding_full_website_analysis", task.user_id)
                tasks_needing_intervention.append({
                    "task_id": task.id,
                    "task_type": "onboarding_full_website_analysis",
                    "user_id": task.user_id,
                    "website_url": task.website_url,
                    "failure_pattern": {
                        "consecutive_failures": pattern.consecutive_failures if pattern else task.consecutive_failures,
                        "recent_failures": pattern.recent_failures if pattern else 0,
                        "failure_reason": pattern.failure_reason.value if pattern else "unknown",
                        "last_failure_time": pattern.last_failure_time.isoformat() if pattern and pattern.last_failure_time else None,
                        "error_patterns": pattern.error_patterns if pattern else [],
                    },
                    "failure_reason": task.failure_reason,
                    "last_failure": task.last_failure.isoformat() if task.last_failure else None
                })
            
            # Check deep competitor analysis tasks
            from models.website_analysis_monitoring_models import DeepCompetitorAnalysisTask
            competitor_tasks = self.db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.status == "needs_intervention"
            )
            if user_id:
                competitor_tasks = competitor_tasks.filter(DeepCompetitorAnalysisTask.user_id == user_id)
            
            for task in competitor_tasks.all():
                pattern = self.analyze_task_failures(task.id, "deep_competitor_analysis", task.user_id)
                tasks_needing_intervention.append({
                    "task_id": task.id,
                    "task_type": "deep_competitor_analysis",
                    "user_id": task.user_id,
                    "website_url": task.website_url,
                    "failure_pattern": {
                        "consecutive_failures": pattern.consecutive_failures if pattern else task.consecutive_failures,
                        "recent_failures": pattern.recent_failures if pattern else 0,
                        "failure_reason": pattern.failure_reason.value if pattern else "unknown",
                        "last_failure_time": pattern.last_failure_time.isoformat() if pattern and pattern.last_failure_time else None,
                        "error_patterns": pattern.error_patterns if pattern else [],
                    },
                    "failure_reason": task.failure_reason,
                    "last_failure": task.last_failure.isoformat() if task.last_failure else None
                })
            
            # Check SIF indexing tasks
            from models.website_analysis_monitoring_models import SIFIndexingTask
            sif_tasks = self.db.query(SIFIndexingTask).filter(
                SIFIndexingTask.status == "needs_intervention"
            )
            if user_id:
                sif_tasks = sif_tasks.filter(SIFIndexingTask.user_id == user_id)
            
            for task in sif_tasks.all():
                pattern = self.analyze_task_failures(task.id, "sif_indexing", task.user_id)
                tasks_needing_intervention.append({
                    "task_id": task.id,
                    "task_type": "sif_indexing",
                    "user_id": task.user_id,
                    "website_url": task.website_url,
                    "failure_pattern": {
                        "consecutive_failures": pattern.consecutive_failures if pattern else task.consecutive_failures,
                        "recent_failures": pattern.recent_failures if pattern else 0,
                        "failure_reason": pattern.failure_reason.value if pattern else "unknown",
                        "last_failure_time": pattern.last_failure_time.isoformat() if pattern and pattern.last_failure_time else None,
                        "error_patterns": pattern.error_patterns if pattern else [],
                    },
                    "failure_reason": task.failure_reason,
                    "last_failure": task.last_failure.isoformat() if task.last_failure else None
                })
            
            # Check market trends tasks
            from models.website_analysis_monitoring_models import MarketTrendsTask
            trends_tasks = self.db.query(MarketTrendsTask).filter(
                MarketTrendsTask.status == "needs_intervention"
            )
            if user_id:
                trends_tasks = trends_tasks.filter(MarketTrendsTask.user_id == user_id)
            
            for task in trends_tasks.all():
                pattern = self.analyze_task_failures(task.id, "market_trends", task.user_id)
                tasks_needing_intervention.append({
                    "task_id": task.id,
                    "task_type": "market_trends",
                    "user_id": task.user_id,
                    "website_url": task.website_url,
                    "failure_pattern": {
                        "consecutive_failures": pattern.consecutive_failures if pattern else task.consecutive_failures,
                        "recent_failures": pattern.recent_failures if pattern else 0,
                        "failure_reason": pattern.failure_reason.value if pattern else "unknown",
                        "last_failure_time": pattern.last_failure_time.isoformat() if pattern and pattern.last_failure_time else None,
                        "error_patterns": pattern.error_patterns if pattern else [],
                    },
                    "failure_reason": task.failure_reason,
                    "last_failure": task.last_failure.isoformat() if task.last_failure else None
                })
            
            # Check advertools tasks (paused tasks may also need attention)
            from models.advertools_monitoring_models import AdvertoolsTask
            advertools_tasks = self.db.query(AdvertoolsTask).filter(
                AdvertoolsTask.status.in_(["needs_intervention", "failed"])
            )
            if user_id:
                advertools_tasks = advertools_tasks.filter(AdvertoolsTask.user_id == user_id)
            
            for task in advertools_tasks.all():
                pattern = self.analyze_task_failures(task.id, "advertools", task.user_id)
                tasks_needing_intervention.append({
                    "task_id": task.id,
                    "task_type": "advertools",
                    "user_id": task.user_id,
                    "website_url": task.website_url,
                    "failure_pattern": {
                        "consecutive_failures": pattern.consecutive_failures if pattern else task.consecutive_failures,
                        "recent_failures": pattern.recent_failures if pattern else 0,
                        "failure_reason": pattern.failure_reason.value if pattern else "unknown",
                        "last_failure_time": pattern.last_failure_time.isoformat() if pattern and pattern.last_failure_time else None,
                        "error_patterns": pattern.error_patterns if pattern else [],
                    },
                    "failure_reason": task.failure_reason,
                    "last_failure": task.last_failure.isoformat() if task.last_failure else None
                })
            
            return tasks_needing_intervention
            
        except Exception as e:
            self.logger.error(f"Error getting tasks needing intervention: {e}", exc_info=True)
            return []

