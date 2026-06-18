"""
Market Trends Executor
Runs Google Trends (pytrends) periodically and embeds results into the user SIF index.
"""

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.website_analysis_monitoring_models import MarketTrendsTask, MarketTrendsExecutionLog
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.intelligence.sif_integration import SIFIntegrationService
from services.research.trends.google_trends_service import GoogleTrendsService
from utils.logger_utils import get_service_logger

logger = get_service_logger("market_trends_executor")


class MarketTrendsExecutor(TaskExecutor):
    def __init__(self):
        pass

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, MarketTrendsTask):
            return TaskExecutionResult(success=False, error_message="Invalid task type for market trends", retryable=False)

        task_log = MarketTrendsExecutionLog(task_id=task.id, status="running", execution_date=datetime.utcnow())
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)
        website_url = task.website_url
        payload = task.payload or {}

        try:
            geo = payload.get("geo") or "US"
            timeframe = payload.get("timeframe") or "today 12-m"

            sif_service = SIFIntegrationService(user_id)

            keywords = await self._select_keywords_for_user(db=db, user_id=user_id, website_url=website_url)
            if not keywords:
                keywords = payload.get("keywords") or []

            keywords = [str(k).strip() for k in (keywords or []) if str(k).strip()]
            if len(keywords) > 5:
                keywords = keywords[:5]

            trends_result: Dict[str, Any]
            if keywords:
                try:
                    trends_result = await GoogleTrendsService().analyze_trends(
                        keywords=keywords, timeframe=timeframe, geo=geo, user_id=user_id
                    )
                except Exception as trends_err:
                    trends_result = {
                        "error": str(trends_err),
                        "keywords": keywords,
                        "timeframe": timeframe,
                        "geo": geo,
                        "timestamp": datetime.utcnow().isoformat(),
                        "cached": False,
                    }
            else:
                trends_result = {
                    "error": "No keywords available for market trends run",
                    "keywords": [],
                    "timeframe": timeframe,
                    "geo": geo,
                    "timestamp": datetime.utcnow().isoformat(),
                    "cached": False,
                }

            run_id = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            await sif_service.index_market_trends_run(trends_result=trends_result, run_id=run_id)

            task.last_executed = datetime.utcnow()
            task.last_success = datetime.utcnow()

            frequency_hours = task.frequency_hours or 72
            task.next_execution = datetime.utcnow() + timedelta(hours=frequency_hours)
            task.status = "active"

            task.consecutive_failures = 0
            task.failure_pattern = None
            task.failure_reason = None

            task_log.status = "success"
            task_log.result_data = {
                "run_id": run_id,
                "keywords": trends_result.get("keywords", keywords),
                "geo": geo,
                "timeframe": timeframe,
                "cached": trends_result.get("cached", False),
            }
            task_log.execution_time_ms = int((time.time() - start_time) * 1000)

            db.commit()

            return TaskExecutionResult(
                success=True,
                result_data=task_log.result_data,
                execution_time_ms=task_log.execution_time_ms,
                retryable=False,
            )

        except Exception as e:
            db.rollback()
            logger.warning(f"Market trends task failed for user {user_id}: {e}")

            # Re-merge objects after rollback to avoid DetachedInstanceError
            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "market_trends", user_id)

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
                task.next_execution = datetime.utcnow() + timedelta(hours=6)

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
                retry_delay=21600,
            )

    async def _select_keywords_for_user(self, db: Session, user_id: str, website_url: str) -> List[str]:
        keywords: List[str] = []

        try:
            from sqlalchemy import select, desc
            from models.enhanced_strategy_models import EnhancedContentStrategy

            stmt = (
                select(EnhancedContentStrategy)
                .where(EnhancedContentStrategy.user_id == user_id)
                .order_by(desc(EnhancedContentStrategy.updated_at))
            )
            strategy = db.execute(stmt).scalars().first()
            if strategy:
                if strategy.emerging_trends:
                    keywords.extend(self._extract_strings(strategy.emerging_trends))
                if strategy.industry_trends:
                    keywords.extend(self._extract_strings(strategy.industry_trends))
                if strategy.market_gaps:
                    keywords.extend(self._extract_strings(strategy.market_gaps))
                if strategy.competitor_content_strategies:
                    keywords.extend(self._extract_strings(strategy.competitor_content_strategies))
        except Exception as e:
            logger.warning(f"Failed to extract keywords from EnhancedContentStrategy for user {user_id}: {e}")

        if not keywords:
            try:
                from sqlalchemy import select, desc
                from models.onboarding import WebsiteAnalysis, OnboardingSession

                stmt = (
                    select(WebsiteAnalysis)
                    .join(OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id)
                    .where(OnboardingSession.user_id == user_id)
                    .order_by(desc(WebsiteAnalysis.created_at))
                )
                wa = db.execute(stmt).scalars().first()
                if wa and wa.content_strategy_insights:
                    ai_strategy = wa.content_strategy_insights.get("ai_strategy", {})
                    topic_clusters = ai_strategy.get("topic_clusters") or []
                    keywords.extend(self._extract_strings(topic_clusters))
            except Exception as e:
                logger.warning(f"Failed to extract keywords from WebsiteAnalysis for user {user_id}: {e}")

        deduped = []
        seen = set()
        for k in keywords:
            kk = str(k).strip()
            if not kk:
                continue
            key = kk.lower()
            if key in seen:
                continue
            seen.add(key)
            deduped.append(kk)

        return deduped[:5]

    def _extract_strings(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if isinstance(value, list):
            out: List[str] = []
            for item in value:
                out.extend(self._extract_strings(item))
            return out
        if isinstance(value, dict):
            out: List[str] = []
            for k in ["keyword", "topic", "title", "name", "label"]:
                if k in value and value.get(k):
                    out.append(str(value.get(k)))
            return out
        return [str(value)]

    def calculate_next_execution(self, task: Any, frequency: str, last_execution: datetime = None) -> datetime:
        base = last_execution or datetime.utcnow()
        hours = getattr(task, "frequency_hours", 72) or 72
        return base + timedelta(hours=hours)
