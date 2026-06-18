"""
Stale Task Recovery
Detects and resets tasks stuck in 'running' status after process crashes,
preventing them from staying in limbo forever.
"""

from typing import List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from loguru import logger

from models.advertools_monitoring_models import AdvertoolsTask
from models.website_analysis_monitoring_models import (
    OnboardingFullWebsiteAnalysisTask,
    DeepCompetitorAnalysisTask,
    DeepWebsiteCrawlTask,
    SIFIndexingTask,
    MarketTrendsTask,
    WebsiteAnalysisTask,
)

# How long a task can stay in 'running' status before being considered stale
STALE_TASK_TTL_MINUTES = 120  # 2 hours


def _recover_stale_tasks_for_model(
    db: Session,
    model_class,
    table_name: str,
    cutoff: datetime,
) -> int:
    """Reset stale 'running' tasks of a given model to 'failed'."""
    try:
        stale = (
            db.query(model_class)
            .filter(
                model_class.status == "running",
                model_class.started_at < cutoff,
            )
            .all()
        )
        for task in stale:
            task.status = "failed"
            task.failure_reason = (
                f"Stale task: execution timed out or process crashed "
                f"(started at {task.started_at}, no completion after {STALE_TASK_TTL_MINUTES}min)"
            )
            task.last_failure = datetime.utcnow()
            task.consecutive_failures = (task.consecutive_failures or 0) + 1
            logger.warning(
                f"[StaleRecovery] Reset {table_name} id={task.id} "
                f"user={task.user_id} — stuck in 'running' since {task.started_at}"
            )
        if stale:
            db.commit()
        return len(stale)
    except Exception as e:
        db.rollback()
        logger.error(f"[StaleRecovery] Error recovering {table_name}: {e}")
        return 0


def recover_stale_tasks(db: Session) -> int:
    """Check all scheduler task tables for stale 'running' tasks and reset them.

    Returns:
        Total number of tasks recovered.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=STALE_TASK_TTL_MINUTES)
    total = 0

    models: List[Tuple] = [
        (AdvertoolsTask, "advertools_tasks"),
        (OnboardingFullWebsiteAnalysisTask, "onboarding_full_website_analysis_tasks"),
        (DeepCompetitorAnalysisTask, "deep_competitor_analysis_tasks"),
        (DeepWebsiteCrawlTask, "deep_website_crawl_tasks"),
        (SIFIndexingTask, "sif_indexing_tasks"),
        (MarketTrendsTask, "market_trends_tasks"),
        (WebsiteAnalysisTask, "website_analysis_tasks"),
    ]

    for model_class, table_name in models:
        recovered = _recover_stale_tasks_for_model(db, model_class, table_name, cutoff)
        if recovered:
            logger.warning(
                f"[StaleRecovery] Recovered {recovered} stale task(s) from {table_name}"
            )
        total += recovered

    if total:
        logger.warning(f"[StaleRecovery] Total recovered across all tables: {total}")
    return total
