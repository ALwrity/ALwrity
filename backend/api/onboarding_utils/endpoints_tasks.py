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
from .task_status import derive_ui_status


def _has_active_strategy(db, user_id: str) -> bool:
    """Return True when the user has a strategy whose activation status is 'active'.

    Checked against ``StrategyActivationStatus`` (monitoring_models), which is
    the single source of truth for strategy activation. Defensive: any failure
    (missing table, DB hiccup, non-numeric user id) degrades to False so the
    tasks-status endpoint never breaks because of this extra check.
    """
    try:
        from models.monitoring_models import StrategyActivationStatus
        uid = int(user_id)
    except (ImportError, ValueError, TypeError):
        return False

    try:
        row = (
            db.query(StrategyActivationStatus)
            .filter(
                StrategyActivationStatus.user_id == uid,
                StrategyActivationStatus.status == "active",
            )
            .first()
        )
        return row is not None
    except Exception as e:
        logger.warning(f"[tasks_status] active-strategy check failed for user {user_id}: {e}")
        return False


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
                    "details": None,
                }

            raw_status = task.status or ""
            last_success = getattr(task, 'last_success', None)
            next_execution = getattr(task, 'next_execution', None)

            # Recurring tasks (SIF, market trends, etc.) keep status='active'
            # so the scheduler re-runs them; a successful run (last_success) is
            # the user-facing "done" signal.
            ui_status, progress_pct = derive_ui_status(raw_status, task.last_executed, last_success)

            base = {
                "status": ui_status,
                "started_at": task.last_executed.isoformat() if task.last_executed else None,
                "progress_pct": progress_pct,
                "details": None,
                "last_success": last_success.isoformat() if last_success else None,
                "failure_reason": getattr(task, 'failure_reason', None),
                "recurring": bool(next_execution),
                "next_execution": next_execution.isoformat() if next_execution else None,
            }

            # For SIF, attach rich progress details from execution log + payload
            if model is SIFIndexingTask:
                details = {}

                # Phase tracking from payload
                payload = getattr(task, 'payload', None) or {}
                if payload.get('phase'):
                    details['phase'] = payload['phase']
                if payload.get('pages_harvested'):
                    details['pages_harvested'] = payload['pages_harvested']
                if payload.get('pages_total'):
                    details['pages_total'] = payload['pages_total']
                if payload.get('sitemap_total'):
                    details['sitemap_total'] = payload['sitemap_total']
                details['harvest_source'] = payload.get('harvest_source', 'beautifulsoup')
                if payload.get('pages_indexed'):
                    details['pages_indexed'] = payload['pages_indexed']
                if payload.get('pillars_found'):
                    details['pillars_found'] = payload['pillars_found']
                if payload.get('indexed_pages'):
                    details['indexed_pages'] = payload['indexed_pages']
                if payload.get('log_messages'):
                    details['log_messages'] = payload['log_messages']

                # Override progress_pct with actual phase-based progress
                # (only while running; completed tasks already report 100)
                phase_progress = {
                    'harvesting': 10,
                    'indexing_metadata': 30,
                    'indexing_content': 60,
                    'analyzing': 80,
                    'complete': 100,
                }
                current_phase = payload.get('phase', '')
                if ui_status == "running" and current_phase in phase_progress:
                    base['progress_pct'] = phase_progress[current_phase]

                # Latest execution log result_data
                try:
                    from models.website_analysis_monitoring_models import SIFIndexingExecutionLog
                    latest_log = db.query(SIFIndexingExecutionLog).filter(
                        SIFIndexingExecutionLog.task_id == task.id
                    ).order_by(SIFIndexingExecutionLog.execution_date.desc()).first()
                    if latest_log and latest_log.result_data:
                        rd = latest_log.result_data
                        details['metadata_synced'] = rd.get('metadata_synced')
                        details['content_synced'] = rd.get('content_synced')
                        if rd.get('guardian_report') and isinstance(rd['guardian_report'], dict):
                            gr = rd['guardian_report']
                            details['pages_analyzed'] = gr.get('pages_analyzed') or gr.get('total_pages')
                            details['pillars_found'] = gr.get('pillars_found') or gr.get('pillar_count') or len(gr.get('pillars', []))
                            details['content_gaps'] = gr.get('content_gaps') or gr.get('gap_count')
                except Exception:
                    pass  # execution log may not exist yet

                base['details'] = details

                # Add freshness indicator (hours since last success)
                if base.get('last_success'):
                    try:
                        from datetime import datetime, timezone
                        last = datetime.fromisoformat(base['last_success'])
                        hours = (datetime.now(timezone.utc) - last).total_seconds() / 3600
                        base['index_freshness_hours'] = round(hours, 1)
                        base['index_stale'] = hours > 48
                    except Exception:
                        pass

            return base

        # Calculate onboarding completion status
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

        # Determine if onboarding completion should be tracked
        # We'll track completion when ALL critical tasks are done
        critical_task_types = ["full_site_seo_audit", "deep_competitor_analysis", "sif_indexing"]
        critical_tasks_completed = sum(1 for task_name in critical_task_types if tasks.get(task_name, {}).get("status") == "completed")
        onboarding_complete = critical_tasks_completed == len(critical_task_types)

        return {
            "tasks": tasks,
            "total": total,
            "completed_count": completed_count,
            "failed_count": failed_count,
            "all_done": all_done,           # Legacy: any/all tasks done
            "has_completed_onboarding": onboarding_complete,  # NEW: critical tasks complete
            "has_active_strategy": _has_active_strategy(db, user_id),  # NEW: real activation query
            "onboarding_data_available": True,  # NEW: data exists for strategy generation
        }
    finally:
        db.close()
