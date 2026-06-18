from typing import Dict, Any
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.database import get_session_for_user
from models.website_analysis_monitoring_models import (
    OnboardingFullWebsiteAnalysisTask,
    DeepCompetitorAnalysisTask,
    DeepWebsiteCrawlTask,
    SIFIndexingTask,
    MarketTrendsTask,
)
from models.advertools_monitoring_models import AdvertoolsTask


async def get_tasks_status(current_user: dict) -> Dict[str, Any]:
    user_id = str(current_user.get("id"))
    db = get_session_for_user(user_id)
    if not db:
        return {"error": "Database connection failed"}

    try:
        def _task_status(model, display_name: str):
            task = db.query(model).filter(
                model.user_id == user_id
            ).order_by(model.updated_at.desc()).first()
            if not task:
                return {
                    "status": "pending",
                    "started_at": None,
                    "progress_pct": 0,
                }
            return {
                "status": task.status if task.status != "active" else "running",
                "started_at": task.last_executed.isoformat() if task.last_executed else None,
                "progress_pct": 100 if task.status == "completed" else (50 if task.last_executed else 0),
            }

        tasks = {
            "full_site_seo_audit": _task_status(OnboardingFullWebsiteAnalysisTask, "Full-Site SEO Audit"),
            "deep_competitor_analysis": _task_status(DeepCompetitorAnalysisTask, "Deep Competitor Analysis"),
            "sif_indexing": _task_status(SIFIndexingTask, "Site Indexing (SIF)"),
            "market_trends": _task_status(MarketTrendsTask, "Market Trends"),
            "advertools": _task_status(AdvertoolsTask, "Advertools Intelligence"),
            "deep_website_crawl": _task_status(DeepWebsiteCrawlTask, "Deep Website Crawl"),
        }

        total = len(tasks)
        completed_count = sum(1 for t in tasks.values() if t.get("status") == "completed")
        failed_count = sum(1 for t in tasks.values() if t.get("status") == "failed")
        all_done = completed_count + failed_count >= total

        return {
            "tasks": tasks,
            "total": total,
            "completed_count": completed_count,
            "failed_count": failed_count,
            "all_done": all_done,
        }
    finally:
        db.close()
