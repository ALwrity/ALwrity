"""
Scheduler Dashboard — Core Endpoints
======================================

Houses the 5 "core" endpoints of the scheduler dashboard plus their
shared helpers and constants. Extracted from the monolithic
`scheduler_dashboard.py` to keep that file readable.

Endpoints in this module:
    - GET  /dashboard             (the big one — stats + jobs + cumulative)
    - GET  /execution-logs        (M4 user isolation, H2 cached schema check)
    - GET  /jobs                  (APScheduler job list)
    - GET  /event-history         (C3 derives from TaskExecutionLog)
    - GET  /recent-scheduler-logs (C3 derives from TaskExecutionLog)

Helpers:
    - DASHBOARD_TASKS_PER_TYPE_LIMIT   (H1 query cap)
    - _task_execution_logs_has_user_id (H2 cached schema check)
    - _rebuild_cumulative_stats_from_events (H3 from TaskExecutionLog)
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from services.database import get_db
from services.scheduler import get_scheduler
from services.scheduler.utils.user_job_store import get_user_job_store_name
from middleware.auth_middleware import get_current_user

from models.advertools_monitoring_models import AdvertoolsTask
from models.monitoring_models import TaskExecutionLog, MonitoringTask
from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
from models.platform_insights_monitoring_models import (
    PlatformInsightsTask,
)
from models.website_analysis_monitoring_models import (
    WebsiteAnalysisTask,
    DeepWebsiteCrawlTask,
    OnboardingFullWebsiteAnalysisTask,
    DeepCompetitorAnalysisTask,
    SIFIndexingTask,
    MarketTrendsTask,
)

from api.scheduler_dashboard_constants import (
    format_per_user_stats,
    get_task_display_info,
)
from api.scheduler_dashboard_models import (
    DashboardJob,
    DashboardSchedulerStats,
    ExecutionLog,
    ExecutionLogsResponse,
    RecentSchedulerLog,
    RecentSchedulerLogsResponse,
    SchedulerDashboardResponse,
    SchedulerEvent,
    SchedulerEventHistoryResponse,
    SchedulerJobInfo,
    SchedulerJobsResponse,
)


# M5: the sub-router is exposed without a prefix; the parent
# `scheduler_dashboard.py` re-exports it under `/api/scheduler` so
# route URLs are unchanged.
router = APIRouter(tags=["scheduler-dashboard-core"])


# ──────────────────────────────────────────────────────────────────
# H1: bounded dashboard queries
# ──────────────────────────────────────────────────────────────────
# The previous implementation ran 10 unbounded .all() queries (one per
# task type) on every dashboard load. For tenants with thousands of
# users this returned tens of thousands of rows for what is a "show
# me what's running now" view. We cap each query with a per-type
# limit (env-overridable) and, when the caller has a user_id, push
# that filter into SQL instead of post-filtering in Python.
try:
    DASHBOARD_TASKS_PER_TYPE_LIMIT = int(
        os.environ.get("DASHBOARD_TASKS_PER_TYPE_LIMIT", "100")
    )
    if DASHBOARD_TASKS_PER_TYPE_LIMIT <= 0:
        DASHBOARD_TASKS_PER_TYPE_LIMIT = 100
except (TypeError, ValueError):
    DASHBOARD_TASKS_PER_TYPE_LIMIT = 100


# ──────────────────────────────────────────────────────────────────
# H2: cached schema inspection for /execution-logs
# ──────────────────────────────────────────────────────────────────
# The /execution-logs endpoint used to call SQLAlchemy inspect() on
# every request to check whether task_execution_logs has a user_id
# column. This was a per-request metadata query that, in a
# multi-tenant DB, added measurable overhead. We cache the result in
# module scope: the first call resolves and subsequent calls reuse
# it. A schema migration that adds/drops a column would require a
# process restart (intentional — caches and migration handshakes
# don't mix well).
_HAS_USER_ID_COLUMN_CACHE: Optional[bool] = None
_HAS_USER_ID_COLUMN_DONE: bool = False


def _task_execution_logs_has_user_id(db: Session) -> bool:
    """H2: cached schema check. Returns True if task_execution_logs has a
    user_id column. The result is memoised for the process lifetime.
    """
    global _HAS_USER_ID_COLUMN_CACHE, _HAS_USER_ID_COLUMN_DONE
    if _HAS_USER_ID_COLUMN_DONE:
        return bool(_HAS_USER_ID_COLUMN_CACHE)
    try:
        from sqlalchemy import inspect as _sa_inspect
        inspector = _sa_inspect(db.bind)
        columns = [col['name'] for col in inspector.get_columns('task_execution_logs')]
        _HAS_USER_ID_COLUMN_CACHE = 'user_id' in columns
    except Exception as e:
        # If inspection fails (e.g., table doesn't exist yet), assume the
        # column is present (newer code path) so the /execution-logs
        # endpoint can return what it can.
        logger.debug(f"[Dashboard] Schema inspection failed: {e}")
        _HAS_USER_ID_COLUMN_CACHE = True
    _HAS_USER_ID_COLUMN_DONE = True
    return bool(_HAS_USER_ID_COLUMN_CACHE)


# ──────────────────────────────────────────────────────────────────
# H3: cumulative stats rebuild from TaskExecutionLog
# ──────────────────────────────────────────────────────────────────
from datetime import datetime  # used below; imported here to keep
                                # helpers + endpoints grouped logically


def _rebuild_cumulative_stats_from_events(db: Session) -> Dict[str, int]:
    """Rebuild cumulative stats by aggregating TaskExecutionLog.

    H3: the previous implementation queried SchedulerEventLog, which
    has no writers (writes were removed in #656 H1), so the rebuild
    always returned all-zeros. TaskExecutionLog is the actual
    persisted record of scheduler activity — it's what
    TaskExecutionLog actually has data for. We use status counts to
    derive `cumulative_tasks_executed` / `cumulative_tasks_failed` /
    `cumulative_tasks_skipped`. The `total_check_cycles` field has
    no direct mapping from TaskExecutionLog (one cycle may run
    many tasks, or zero), so we return 0 for it and rely on the
    scheduler's in-memory counter for the real value.
    """
    try:
        # Single aggregate query — count by status in one pass.
        status_rows = (
            db.query(TaskExecutionLog.status, func.count(TaskExecutionLog.id))
            .group_by(TaskExecutionLog.status)
            .all()
        )
        counts = {row[0]: int(row[1] or 0) for row in status_rows}
        executed = counts.get("success", 0)
        failed = counts.get("failed", 0)
        skipped = counts.get("skipped", 0)
        # `cumulative_tasks_found` is not in TaskExecutionLog; we treat
        # it as the sum of executed + failed + skipped (anything the
        # scheduler actually picked up). Running-status rows are
        # in-progress and not yet a "found" count.
        found = executed + failed + skipped

        return {
            'total_check_cycles': 0,  # No direct mapping; scheduler owns this
            'cumulative_tasks_found': found,
            'cumulative_tasks_executed': executed,
            'cumulative_tasks_failed': failed,
            'cumulative_tasks_skipped': skipped,
        }
    except Exception as e:
        logger.error(f"[Dashboard] Error rebuilding cumulative stats: {e}", exc_info=True)
        return {
            'total_check_cycles': 0,
            'cumulative_tasks_found': 0,
            'cumulative_tasks_executed': 0,
            'cumulative_tasks_failed': 0,
            'cumulative_tasks_skipped': 0
        }


# ──────────────────────────────────────────────────────────────────
# M5: helper for the "DB task" entries built inside /dashboard
# ──────────────────────────────────────────────────────────────────
def _build_db_task_entry(
    task_id_prefix: str,
    user_id: str,
    task_db_id: int,
    trigger_type: str,
    next_execution_attr: str,
    task,
    user_job_store: str,
    *,
    function_name: str,
    frequency: str,
    task_category: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a dashboard job entry for a database-backed task.

    Centralises the field set that all 8 DB-task blocks in
    `/dashboard` produce, so adding a new field doesn't require
    touching each block. `extra` is a place to attach
    type-specific fields (e.g. `platform`, `competitor_id`) without
    branching the helper.
    """
    next_execution = getattr(task, next_execution_attr, None)
    job_info: Dict[str, Any] = {
        'id': f"{task_id_prefix}_{user_id}_{task_db_id}",
        'trigger_type': trigger_type,
        'next_run_time': next_execution.isoformat() if next_execution else None,
        'user_id': user_id,
        'job_store': 'default',
        'user_job_store': user_job_store,
        'function_name': function_name,
        'task_id': task_db_id,
        # M5: explicit source marker so the UI can render the
        # two kinds of tasks differently without guessing.
        'is_database_task': True,
        'source': 'database_task',
        'frequency': frequency,
        'task_category': task_category,
    }
    if extra:
        job_info.update(extra)
    return job_info


# ──────────────────────────────────────────────────────────────────
# GET /dashboard
# ──────────────────────────────────────────────────────────────────
@router.get("/dashboard", response_model=SchedulerDashboardResponse)
async def get_scheduler_dashboard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get scheduler dashboard statistics and current state.

    Returns:
        - Scheduler stats (total checks, tasks executed, failed, etc.)
        - Current scheduled jobs (APScheduler + DB-backed, split by M5)
        - Active strategies count
        - Check interval
        - User isolation status
        - Last check timestamp
        - Per-user stats (M6)
    """
    try:
        scheduler = get_scheduler()

        # Get user_id from current_user (Clerk format)
        user_id_str = str(current_user.get('id', '')) if current_user else None

        # Get scheduler stats
        stats = scheduler.get_stats(user_id=None)  # Get all stats for dashboard

        # Get all scheduled jobs
        all_jobs = scheduler.scheduler.get_jobs()

        # M5: split the response into real APScheduler jobs vs DB-backed
        # monitoring tasks. The two have different lifecycle semantics:
        # APScheduler jobs are scheduled in the scheduler and run on
        # their trigger; DB-backed tasks are loaded each check cycle
        # from the task tables. Conflating them in one list made the
        # UI treat them as identical. We now keep them in separate
        # lists (`apscheduler_jobs` and `database_tasks`) AND retain a
        # backward-compatible `jobs` field that is the union.
        apscheduler_jobs: List[Dict[str, Any]] = []
        database_tasks: List[Dict[str, Any]] = []

        # Format APScheduler jobs with user context
        for job in all_jobs:
            job_info = {
                'id': job.id,
                'trigger_type': type(job.trigger).__name__,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'user_id': None,
                'job_store': 'default',
                'user_job_store': 'default',
                'source': 'apscheduler',
            }

            # Extract user_id from job
            user_id_from_job = None
            if hasattr(job, 'kwargs') and job.kwargs and job.kwargs.get('user_id'):
                user_id_from_job = job.kwargs.get('user_id')
            elif job.id and ('research_persona_' in job.id or 'facebook_persona_' in job.id):
                parts = job.id.split('_')
                if len(parts) >= 3:
                    user_id_from_job = parts[2]

            if user_id_from_job:
                job_info['user_id'] = user_id_from_job
                try:
                    user_job_store = get_user_job_store_name(user_id_from_job, db)
                    job_info['user_job_store'] = user_job_store
                except Exception as e:
                    logger.debug(f"Could not get job store for user {user_id_from_job}: {e}")

            apscheduler_jobs.append(job_info)

        # ── DB-backed tasks ────────────────────────────────────────
        # Each block is wrapped in try/except so a failure loading one
        # task type doesn't take down the whole dashboard.
        def _job_store_for(user_id: str) -> str:
            try:
                return get_user_job_store_name(user_id, db)
            except Exception as e:
                logger.debug(f"Could not get job store for user {user_id}: {e}")
                return 'default'

        # Add OAuth token monitoring tasks from database (recurring weekly)
        try:
            oauth_query = db.query(OAuthTokenMonitoringTask).filter(
                OAuthTokenMonitoringTask.status == 'active'
            )
            if user_id_str:
                oauth_query = oauth_query.filter(OAuthTokenMonitoringTask.user_id == user_id_str)
            oauth_tasks = oauth_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            oauth_tasks_count = len(oauth_tasks)
            if oauth_tasks_count > 0:
                platforms: Dict[str, int] = {}
                for task in oauth_tasks:
                    platforms[task.platform] = platforms.get(task.platform, 0) + 1
                platform_summary = ", ".join(
                    f"{p}: {c}" for p, c in platforms.items()
                )
                logger.warning(
                    f"[Dashboard] OAuth Monitoring: Found {oauth_tasks_count} active OAuth tasks ({platform_summary})"
                )
            else:
                all_oauth_tasks = db.query(OAuthTokenMonitoringTask).all()
                if all_oauth_tasks:
                    inactive_by_status: Dict[str, int] = {}
                    for task in all_oauth_tasks:
                        status = task.status
                        inactive_by_status[status] = inactive_by_status.get(status, 0) + 1
                    logger.warning(
                        f"[Dashboard] OAuth Monitoring: Found {len(all_oauth_tasks)} total OAuth tasks, "
                        f"but {oauth_tasks_count} are active. Status breakdown: {inactive_by_status}"
                    )

            for task in oauth_tasks:
                database_tasks.append({
                    'id': f"oauth_token_monitoring_{task.platform}_{task.user_id}",
                    'trigger_type': 'CronTrigger',
                    'next_run_time': task.next_check.isoformat() if task.next_check else None,
                    'user_id': task.user_id,
                    'job_store': 'default',
                    'user_job_store': _job_store_for(task.user_id),
                    'function_name': 'oauth_token_monitoring_executor.execute_task',
                    'platform': task.platform,
                    'task_id': task.id,
                    'is_database_task': True, 'source': 'database_task',
                    'frequency': 'Weekly'
                })
        except Exception as e:
            logger.error(f"Error loading OAuth token monitoring tasks: {e}", exc_info=True)

        # Load website analysis tasks
        try:
            wa_query = db.query(WebsiteAnalysisTask).filter(
                WebsiteAnalysisTask.status == 'active'
            )
            if user_id_str:
                wa_query = wa_query.filter(WebsiteAnalysisTask.user_id == user_id_str)
            website_analysis_tasks = wa_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in website_analysis_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix=f"website_analysis_{task.task_type}",
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_check',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='website_analysis_executor.execute_task',
                    frequency=f'Every {task.frequency_days} days',
                    task_category='website_analysis',
                    extra={
                        'task_type': task.task_type,
                        'website_url': task.website_url,
                        'competitor_id': task.competitor_id,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading website analysis tasks: {e}", exc_info=True)

        # Load platform insights tasks (GSC and Bing)
        try:
            pi_query = db.query(PlatformInsightsTask).filter(
                PlatformInsightsTask.status == 'active'
            )
            if user_id_str:
                pi_query = pi_query.filter(PlatformInsightsTask.user_id == user_id_str)
            insights_tasks = pi_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in insights_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix=f"platform_insights_{task.platform}",
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_check',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name=f'{task.platform}_insights_executor.execute_task',
                    frequency='Weekly',
                    task_category='platform_insights',
                    extra={'platform': task.platform},
                ))
        except Exception as e:
            logger.error(f"Error loading platform insights tasks: {e}", exc_info=True)

        # Load deep website crawl tasks
        try:
            crawl_query = db.query(DeepWebsiteCrawlTask).filter(
                DeepWebsiteCrawlTask.status.in_(['active', 'retry'])
            )
            if user_id_str:
                crawl_query = crawl_query.filter(DeepWebsiteCrawlTask.user_id == user_id_str)
            crawl_tasks = crawl_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in crawl_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='deep_website_crawl',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='deep_website_crawl_executor.execute_task',
                    frequency='Weekly',
                    task_category='deep_website_crawl',
                    extra={'website_url': task.website_url},
                ))
        except Exception as e:
            logger.error(f"Error loading deep website crawl tasks: {e}", exc_info=True)

        # Load onboarding full website analysis tasks
        try:
            onb_query = db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.status.in_(['active', 'failed', 'needs_intervention'])
            )
            if user_id_str:
                onb_query = onb_query.filter(OnboardingFullWebsiteAnalysisTask.user_id == user_id_str)
            onboarding_tasks = onb_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in onboarding_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='onboarding_full_website_analysis',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='DateTrigger' if task.status != 'active' else 'CronTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='onboarding_full_website_analysis_executor.execute_task',
                    frequency='One-time' if task.status == 'completed' else 'Once',
                    task_category='onboarding_full_website_analysis',
                    extra={
                        'website_url': task.website_url,
                        'status': task.status,
                        'last_success': task.last_success.isoformat() if task.last_success else None,
                        'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                        'failure_reason': task.failure_reason,
                        'consecutive_failures': task.consecutive_failures,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading onboarding full website analysis tasks: {e}", exc_info=True)

        # Load deep competitor analysis tasks
        try:
            dca_query = db.query(DeepCompetitorAnalysisTask).filter(
                DeepCompetitorAnalysisTask.status.in_(['active', 'failed', 'needs_intervention'])
            )
            if user_id_str:
                dca_query = dca_query.filter(DeepCompetitorAnalysisTask.user_id == user_id_str)
            competitor_tasks = dca_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in competitor_tasks:
                payload = task.payload or {}
                frequency_label = 'Weekly' if payload.get('mode') == 'strategic_insights' else 'One-time'
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='deep_competitor_analysis',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger' if frequency_label == 'Weekly' else 'DateTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='deep_competitor_analysis_executor.execute_task',
                    frequency=frequency_label,
                    task_category='deep_competitor_analysis',
                    extra={
                        'website_url': task.website_url,
                        'status': task.status,
                        'last_success': task.last_success.isoformat() if task.last_success else None,
                        'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                        'failure_reason': task.failure_reason,
                        'consecutive_failures': task.consecutive_failures,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading deep competitor analysis tasks: {e}", exc_info=True)

        # Load SIF indexing tasks
        try:
            sif_query = db.query(SIFIndexingTask).filter(
                SIFIndexingTask.status.in_(['active', 'failed', 'needs_intervention'])
            )
            if user_id_str:
                sif_query = sif_query.filter(SIFIndexingTask.user_id == user_id_str)
            sif_tasks = sif_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in sif_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='sif_indexing',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='sif_indexing_executor.execute_task',
                    frequency=f'Every {task.frequency_hours}h' if task.frequency_hours else 'Every 48h',
                    task_category='sif_indexing',
                    extra={
                        'website_url': task.website_url,
                        'status': task.status,
                        'last_success': task.last_success.isoformat() if task.last_success else None,
                        'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                        'failure_reason': task.failure_reason,
                        'consecutive_failures': task.consecutive_failures,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading SIF indexing tasks: {e}", exc_info=True)

        # Load market trends tasks
        try:
            mt_query = db.query(MarketTrendsTask).filter(
                MarketTrendsTask.status.in_(['active', 'failed', 'needs_intervention'])
            )
            if user_id_str:
                mt_query = mt_query.filter(MarketTrendsTask.user_id == user_id_str)
            trends_tasks = mt_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in trends_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='market_trends',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='market_trends_executor.execute_task',
                    frequency=f'Every {task.frequency_hours}h' if task.frequency_hours else 'Every 72h',
                    task_category='market_trends',
                    extra={
                        'website_url': task.website_url,
                        'status': task.status,
                        'last_success': task.last_success.isoformat() if task.last_success else None,
                        'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                        'failure_reason': task.failure_reason,
                        'consecutive_failures': task.consecutive_failures,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading market trends tasks: {e}", exc_info=True)

        # Load advertools tasks
        try:
            adv_query = db.query(AdvertoolsTask).filter(
                AdvertoolsTask.status.in_(['active', 'failed', 'paused'])
            )
            if user_id_str:
                adv_query = adv_query.filter(AdvertoolsTask.user_id == user_id_str)
            advertools_tasks = adv_query.limit(DASHBOARD_TASKS_PER_TYPE_LIMIT).all()

            for task in advertools_tasks:
                database_tasks.append(_build_db_task_entry(
                    task_id_prefix='advertools',
                    user_id=task.user_id,
                    task_db_id=task.id,
                    trigger_type='CronTrigger',
                    next_execution_attr='next_execution',
                    task=task,
                    user_job_store=_job_store_for(task.user_id),
                    function_name='advertools_executor.execute_task',
                    frequency=f'Every {task.frequency_days}d' if task.frequency_days else 'Weekly',
                    task_category='advertools',
                    extra={
                        'website_url': task.website_url,
                        'status': task.status,
                        'last_success': task.last_success.isoformat() if task.last_success else None,
                        'last_failure': task.last_failure.isoformat() if task.last_failure else None,
                        'failure_reason': task.failure_reason,
                        'consecutive_failures': task.consecutive_failures,
                    },
                ))
        except Exception as e:
            logger.error(f"Error loading advertools tasks: {e}", exc_info=True)

        # ── Aggregate / cumulative stats ─────────────────────────
        active_strategies = stats.get('active_strategies_count', 0)
        last_update = stats.get('last_update')

        # Calculate cumulative/historical values from persistent
        # cumulative stats table. Fallback to TaskExecutionLog aggregation
        # if the table doesn't exist or is invalid. H3: cross-check
        # against the actual source of truth (TaskExecutionLog) instead
        # of the dead SchedulerEventLog.
        cumulative_stats: Dict[str, int] = {}
        try:
            from models.scheduler_cumulative_stats_model import SchedulerCumulativeStats

            cumulative_stats_row = db.query(SchedulerCumulativeStats).filter(
                SchedulerCumulativeStats.id == 1
            ).first()

            if cumulative_stats_row:
                cumulative_stats = {
                    'total_check_cycles': int(cumulative_stats_row.total_check_cycles or 0),
                    'cumulative_tasks_found': int(cumulative_stats_row.cumulative_tasks_found or 0),
                    'cumulative_tasks_executed': int(cumulative_stats_row.cumulative_tasks_executed or 0),
                    'cumulative_tasks_failed': int(cumulative_stats_row.cumulative_tasks_failed or 0),
                    'cumulative_tasks_skipped': int(cumulative_stats_row.cumulative_tasks_skipped or 0),
                    'cumulative_job_completed': int(cumulative_stats_row.cumulative_job_completed or 0),
                    'cumulative_job_failed': int(cumulative_stats_row.cumulative_job_failed or 0)
                }

                logger.debug(
                    f"[Dashboard] Using persistent cumulative stats: "
                    f"cycles={cumulative_stats['total_check_cycles']}, "
                    f"found={cumulative_stats['cumulative_tasks_found']}, "
                    f"executed={cumulative_stats['cumulative_tasks_executed']}, "
                    f"failed={cumulative_stats['cumulative_tasks_failed']}"
                )

                # H3: validate against the actual source of truth —
                # TaskExecutionLog. The previous implementation compared
                # against SchedulerEventLog, which has no writers, so
                # the comparison was always "0 == 0" and never triggered
                # a rebuild.
                actual_counts = (
                    db.query(TaskExecutionLog.status, func.count(TaskExecutionLog.id))
                    .group_by(TaskExecutionLog.status)
                    .all()
                )
                actual_map = {row[0]: int(row[1] or 0) for row in actual_counts}
                actual_executed = actual_map.get("success", 0)
                actual_failed = actual_map.get("failed", 0)
                actual_skipped = actual_map.get("skipped", 0)

                mismatches = []
                for key, actual in (
                    ("cumulative_tasks_executed", actual_executed),
                    ("cumulative_tasks_failed", actual_failed),
                    ("cumulative_tasks_skipped", actual_skipped),
                ):
                    stored = cumulative_stats.get(key, 0) or 0
                    if stored != actual:
                        mismatches.append((key, stored, actual))

                if mismatches:
                    logger.warning(
                        f"[Dashboard] Cumulative stats validation mismatch: "
                        f"{mismatches}. Rebuilding from TaskExecutionLog..."
                    )
                    cumulative_stats = _rebuild_cumulative_stats_from_events(db)
                    if cumulative_stats_row:
                        cumulative_stats_row.total_check_cycles = cumulative_stats['total_check_cycles']
                        cumulative_stats_row.cumulative_tasks_found = cumulative_stats['cumulative_tasks_found']
                        cumulative_stats_row.cumulative_tasks_executed = cumulative_stats['cumulative_tasks_executed']
                        cumulative_stats_row.cumulative_tasks_failed = cumulative_stats['cumulative_tasks_failed']
                        cumulative_stats_row.cumulative_tasks_skipped = cumulative_stats.get('cumulative_tasks_skipped', 0)
                        db.commit()
                    logger.warning(f"[Dashboard] ✅ Rebuilt cumulative stats: {cumulative_stats}")
            else:
                logger.warning(
                    "[Dashboard] Cumulative stats table not found or empty. "
                    "Rebuilding from TaskExecutionLog..."
                )
                cumulative_stats = _rebuild_cumulative_stats_from_events(db)
                cumulative_stats_row = SchedulerCumulativeStats.get_or_create(db)
                cumulative_stats_row.total_check_cycles = cumulative_stats['total_check_cycles']
                cumulative_stats_row.cumulative_tasks_found = cumulative_stats['cumulative_tasks_found']
                cumulative_stats_row.cumulative_tasks_executed = cumulative_stats['cumulative_tasks_executed']
                cumulative_stats_row.cumulative_tasks_failed = cumulative_stats['cumulative_tasks_failed']
                cumulative_stats_row.cumulative_tasks_skipped = cumulative_stats.get('cumulative_tasks_skipped', 0)
                db.commit()
                logger.warning(f"[Dashboard] ✅ Created/updated cumulative stats: {cumulative_stats}")
        except ImportError:
            logger.warning(
                "[Dashboard] Cumulative stats model not found. "
                "Falling back to event logs aggregation. "
                "Run migration: create_scheduler_cumulative_stats.sql"
            )
            cumulative_stats = _rebuild_cumulative_stats_from_events(db)
        except Exception as e:
            logger.error(f"[Dashboard] Error getting cumulative stats: {e}", exc_info=True)
            cumulative_stats = _rebuild_cumulative_stats_from_events(db)

        return {
            'stats': {
                'total_checks': stats.get('total_checks', 0),
                'tasks_found': stats.get('tasks_found', 0),
                'tasks_executed': stats.get('tasks_executed', 0),
                'tasks_failed': stats.get('tasks_failed', 0),
                'tasks_skipped': stats.get('tasks_skipped', 0),
                'last_check': stats.get('last_check'),
                'last_update': last_update,
                'active_executions': stats.get('active_executions', 0),
                'running': stats.get('running', False),
                'check_interval_minutes': stats.get('check_interval_minutes', 60),
                'min_check_interval_minutes': stats.get('min_check_interval_minutes', 15),
                'max_check_interval_minutes': stats.get('max_check_interval_minutes', 60),
                'intelligent_scheduling': stats.get('intelligent_scheduling', True),
                'active_strategies_count': active_strategies,
                'last_interval_adjustment': stats.get('last_interval_adjustment'),
                'registered_types': stats.get('registered_types', []),
                'cumulative_total_check_cycles': cumulative_stats.get('total_check_cycles', 0),
                'cumulative_tasks_found': cumulative_stats.get('cumulative_tasks_found', 0),
                'cumulative_tasks_executed': cumulative_stats.get('cumulative_tasks_executed', 0),
                'cumulative_tasks_failed': cumulative_stats.get('cumulative_tasks_failed', 0)
            },
            # M5: separate APScheduler jobs from DB-backed tasks.
            'apscheduler_jobs': apscheduler_jobs,
            'database_tasks': database_tasks,
            'apscheduler_job_count': len(apscheduler_jobs),
            'database_task_count': len(database_tasks),
            # Backward-compat: union of both lists.
            'jobs': apscheduler_jobs + database_tasks,
            'job_count': len(apscheduler_jobs) + len(database_tasks),
            'recurring_jobs': 1 + len(database_tasks),
            'one_time_jobs': len([
                j for j in apscheduler_jobs if j.get('trigger_type') == 'DateTrigger'
            ]),
            'registered_task_types': stats.get('registered_types', []),
            # M6: per-user stats surfaced for the dashboard.
            'per_user_stats': {
                uid: format_per_user_stats(user_stats)
                for uid, user_stats in (stats.get('per_user_stats') or {}).items()
            },
            'user_isolation': {
                'enabled': True,
                'current_user_id': user_id_str
            },
            'last_updated': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting scheduler dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler dashboard: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /execution-logs
# ──────────────────────────────────────────────────────────────────
@router.get("/execution-logs", response_model=ExecutionLogsResponse)
async def get_execution_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, regex="^(success|failed|running|skipped)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get task execution logs from database.

    Query Params:
        - limit: Number of logs to return (1-500, default: 50)
        - offset: Pagination offset (default: 0)
        - status: Filter by status (success, failed, running, skipped)
    """
    try:
        # M4: enforce user isolation. The previous implementation
        # returned ALL execution logs to any authenticated user, which
        # was a multi-tenant data leak. We now filter by user on every
        # branch.
        from models.enhanced_strategy_models import EnhancedContentStrategy
        user_id_str = str(current_user.get('id', '')) if current_user else None
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Authentication required")

        # H2: cached schema inspection.
        has_user_id_column = _task_execution_logs_has_user_id(db)

        # If user_id column doesn't exist, we need to handle the query
        # differently to avoid SQLAlchemy trying to access a
        # non-existent column.
        if not has_user_id_column:
            # Query without user_id column - use explicit column selection
            from sqlalchemy import func

            # M4: user isolation via the join
            # TaskExecutionLog -> MonitoringTask -> EnhancedContentStrategy.
            count_query = (
                db.query(func.count(TaskExecutionLog.id))
                .join(MonitoringTask, TaskExecutionLog.task_id == MonitoringTask.id)
                .join(EnhancedContentStrategy, MonitoringTask.strategy_id == EnhancedContentStrategy.id)
                .filter(EnhancedContentStrategy.user_id == user_id_str)
            )

            if status:
                count_query = count_query.filter(TaskExecutionLog.status == status)

            total_count = count_query.scalar() or 0

            # Build query for data - select specific columns to avoid user_id
            query = (
                db.query(
                    TaskExecutionLog.id,
                    TaskExecutionLog.task_id,
                    TaskExecutionLog.execution_date,
                    TaskExecutionLog.status,
                    TaskExecutionLog.result_data,
                    TaskExecutionLog.error_message,
                    TaskExecutionLog.execution_time_ms,
                    TaskExecutionLog.created_at,
                    MonitoringTask,
                )
                .join(MonitoringTask, TaskExecutionLog.task_id == MonitoringTask.id)
                .join(EnhancedContentStrategy, MonitoringTask.strategy_id == EnhancedContentStrategy.id)
                .filter(EnhancedContentStrategy.user_id == user_id_str)
            )

            if status:
                query = query.filter(TaskExecutionLog.status == status)

            logs = query.order_by(TaskExecutionLog.execution_date.desc()).offset(offset).limit(limit).all()

            formatted_logs = []
            for log_tuple in logs:
                log_id, task_id, execution_date, log_status, result_data, error_message, execution_time_ms, created_at, task = log_tuple

                log_data = {
                    'id': log_id,
                    'task_id': task_id,
                    'user_id': user_id_str,  # M4: surface the caller's user_id
                    'execution_date': execution_date.isoformat() if execution_date else None,
                    'status': log_status,
                    'error_message': error_message,
                    'execution_time_ms': execution_time_ms,
                    'result_data': result_data,
                    'created_at': created_at.isoformat() if created_at else None
                }

                if task:
                    log_data['task'] = {
                        'id': task.id,
                        'task_title': task.task_title,
                        'component_name': task.component_name,
                        'metric': task.metric,
                        'frequency': task.frequency
                    }

                formatted_logs.append(log_data)

            return {
                'logs': formatted_logs,
                'total_count': total_count,
                'limit': limit,
                'offset': offset,
                'has_more': (offset + limit) < total_count,
                'is_scheduler_logs': False
            }

        # If user_id column exists, use the normal query path
        # Build query with eager loading of task relationship
        query = (
            db.query(TaskExecutionLog)
            .join(
                MonitoringTask,
                TaskExecutionLog.task_id == MonitoringTask.id,
            )
            .join(
                EnhancedContentStrategy,
                MonitoringTask.strategy_id == EnhancedContentStrategy.id,
            )
            .options(joinedload(TaskExecutionLog.task))
        )

        # M4: enforce user isolation.
        query = query.filter(EnhancedContentStrategy.user_id == user_id_str)

        if status:
            query = query.filter(TaskExecutionLog.status == status)

        total_count = query.count()

        logs = query.order_by(desc(TaskExecutionLog.execution_date)).offset(offset).limit(limit).all()

        formatted_logs = []
        for log in logs:
            log_data = {
                'id': log.id,
                'task_id': log.task_id,
                'user_id': user_id_str,
                'execution_date': log.execution_date.isoformat() if log.execution_date else None,
                'status': log.status,
                'error_message': log.error_message,
                'execution_time_ms': log.execution_time_ms,
                'result_data': log.result_data,
                'created_at': log.created_at.isoformat() if log.created_at else None
            }

            if log.task:
                log_data['task'] = {
                    'id': log.task.id,
                    'task_title': log.task.task_title,
                    'component_name': log.task.component_name,
                    'metric': log.task.metric,
                    'frequency': log.task.frequency
                }

            formatted_logs.append(log_data)

        return {
            'logs': formatted_logs,
            'total_count': total_count,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total_count,
            'is_scheduler_logs': False
        }

    except Exception as e:
        logger.error(f"Error getting execution logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get execution logs: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /jobs
# ──────────────────────────────────────────────────────────────────
@router.get("/jobs", response_model=SchedulerJobsResponse)
async def get_scheduler_jobs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about all scheduled jobs."""
    try:
        scheduler = get_scheduler()
        all_jobs = scheduler.scheduler.get_jobs()

        formatted_jobs = []
        for job in all_jobs:
            job_info = {
                'id': job.id,
                'trigger_type': type(job.trigger).__name__,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'jobstore': getattr(job, 'jobstore', 'default'),
                'user_id': None,
                'user_job_store': 'default',
                'function_name': None
            }

            user_id_from_job = None
            if hasattr(job, 'kwargs') and job.kwargs and job.kwargs.get('user_id'):
                user_id_from_job = job.kwargs.get('user_id')
            elif job.id and ('research_persona_' in job.id or 'facebook_persona_' in job.id):
                parts = job.id.split('_')
                if len(parts) >= 3:
                    user_id_from_job = parts[2]

            if user_id_from_job:
                job_info['user_id'] = user_id_from_job
                try:
                    user_job_store = get_user_job_store_name(user_id_from_job, db)
                    job_info['user_job_store'] = user_job_store
                except Exception as e:
                    logger.debug(f"Could not get job store for user {user_id_from_job}: {e}")

            if hasattr(job, 'func') and hasattr(job.func, '__name__'):
                job_info['function_name'] = job.func.__name__
            elif hasattr(job, 'func_ref'):
                job_info['function_name'] = str(job.func_ref)

            formatted_jobs.append(job_info)

        return {
            'jobs': formatted_jobs,
            'total_jobs': len(formatted_jobs),
            'recurring_jobs': 1,  # check_due_tasks
            'one_time_jobs': len(formatted_jobs) - 1
        }

    except Exception as e:
        logger.error(f"Error getting scheduler jobs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler jobs: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /event-history
# ──────────────────────────────────────────────────────────────────
@router.get("/event-history", response_model=SchedulerEventHistoryResponse)
async def get_scheduler_event_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, regex="^(check_cycle|interval_adjustment|start|stop|job_scheduled|job_cancelled|job_completed|job_failed)$"),
    days: int = Query(7, ge=1, le=90, description="Look back this many days"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get scheduler event history.

    C3: the previous implementation queried `SchedulerEventLog`, which
    has no writers (writes removed in #656 H1), so this endpoint
    always returned empty. We now derive events from sources that
    DO have data: TaskExecutionLog.
    """
    try:
        from datetime import timedelta
        from models.monitoring_models import TaskExecutionLog

        cutoff = datetime.utcnow() - timedelta(days=days)

        # For the synthesised event types, query TaskExecutionLog
        synthesised_types = {"job_scheduled", "job_completed", "job_failed"}
        if event_type is None or event_type in synthesised_types:
            te_query = db.query(TaskExecutionLog).filter(
                TaskExecutionLog.execution_date >= cutoff
            )
            recent_exec_logs = te_query.order_by(
                desc(TaskExecutionLog.execution_date)
            ).limit(limit + offset).all()

            synthesised = []
            for log in recent_exec_logs:
                if log.status == "success":
                    derived_event_type = "job_completed"
                elif log.status == "failed":
                    derived_event_type = "job_failed"
                else:
                    derived_event_type = "job_scheduled"
                synthesised.append({
                    "id": log.id,
                    "event_type": derived_event_type,
                    "event_date": log.execution_date.isoformat() if log.execution_date else None,
                    "check_cycle_number": None,
                    "check_interval_minutes": None,
                    "previous_interval_minutes": None,
                    "new_interval_minutes": None,
                    "tasks_found": 1,
                    "tasks_executed": 1 if log.status == "success" else 0,
                    "tasks_failed": 1 if log.status == "failed" else 0,
                    "tasks_by_type": None,
                    "check_duration_seconds": (
                        log.execution_time_ms / 1000.0 if log.execution_time_ms else None
                    ),
                    "active_strategies_count": None,
                    "active_executions": None,
                    "job_id": f"task_{log.task_id}",
                    "job_type": "one_time",
                    "user_id": str(log.user_id) if log.user_id is not None else None,
                    "event_data": {
                        "task_id": log.task_id,
                        "execution_time_seconds": (
                            log.execution_time_ms / 1000.0 if log.execution_time_ms else None
                        ),
                    },
                    "error_message": log.error_message,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                })

            # Apply optional event_type filter on the synthesised list
            if event_type is not None:
                synthesised = [e for e in synthesised if e["event_type"] == event_type]
        else:
            synthesised = []

        # Apply pagination
        paginated = synthesised[offset:offset + limit]
        total_count = len(synthesised)

        return {
            "events": paginated,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": (offset + limit) < total_count,
            "date_filter": {
                "days": days,
                "cutoff_date": cutoff.isoformat(),
                "showing_events_since": cutoff.isoformat(),
            },
            # C3: data-source hint.
            "data_source": "task_execution_logs",
        }

    except Exception as e:
        logger.error(f"Error getting scheduler event history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get scheduler event history: {str(e)}")


# ──────────────────────────────────────────────────────────────────
# GET /recent-scheduler-logs
# ──────────────────────────────────────────────────────────────────
@router.get("/recent-scheduler-logs", response_model=RecentSchedulerLogsResponse)
async def get_recent_scheduler_logs(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent scheduler activity formatted as execution logs for display.

    C3: the previous implementation queried `SchedulerEventLog`, which
    has no writers, so the endpoint always returned an empty list. We
    now derive recent scheduler activity from `TaskExecutionLog`,
    which is the actual source of truth for what the scheduler did.
    """
    try:
        from models.monitoring_models import TaskExecutionLog

        recent_logs = (
            db.query(TaskExecutionLog)
            .order_by(desc(TaskExecutionLog.execution_date))
            .limit(5)
            .all()
        )

        formatted_logs = []
        for log in recent_logs:
            if log.status == "success":
                event_type = "job_completed"
                status = "success"
            elif log.status == "failed":
                event_type = "job_failed"
                status = "failed"
            elif log.status == "running":
                event_type = "job_scheduled"
                status = "running"
            else:
                event_type = "job_scheduled"
                status = log.status

            log_entry = {
                "id": f"exec_log_{log.id}",
                "task_id": log.task_id,
                "user_id": log.user_id,
                "execution_date": log.execution_date.isoformat() if log.execution_date else None,
                "status": status,
                "error_message": log.error_message,
                "execution_time_ms": log.execution_time_ms,
                "result_data": log.result_data,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "task": {
                    "id": log.task_id,
                    "task_title": f"Task {log.task_id}",
                    "component_name": "Scheduler",
                    "metric": "task_execution",
                    "frequency": "periodic",
                },
                "is_scheduler_log": True,
                "event_type": event_type,
                "job_id": f"task_{log.task_id}",
            }
            formatted_logs.append(log_entry)

        logger.info(
            f"[Dashboard] recent-scheduler-logs: returning {len(formatted_logs)} entries from TaskExecutionLog"
        )

        return {
            "logs": formatted_logs,
            "total_count": len(formatted_logs),
            "limit": 5,
            "offset": 0,
            "has_more": False,
            "is_scheduler_logs": True,
            "data_source": "task_execution_logs",
        }

    except Exception as e:
        logger.error(f"Error getting recent scheduler logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get recent scheduler logs: {str(e)}")
