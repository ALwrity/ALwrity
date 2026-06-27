"""
Core Task Scheduler Service
Pluggable task scheduler that can work with any task model.
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.orm import Session
from sqlalchemy import text

from .executor_interface import TaskExecutor, TaskExecutionResult
from .task_registry import TaskRegistry
from .exception_handler import (
    SchedulerExceptionHandler, SchedulerException, TaskExecutionError, DatabaseError,
    TaskLoaderError, SchedulerConfigError
)
from .settings import SchedulerSettings

from services.database import get_all_user_ids, get_session_for_user
from utils.logger_utils import get_service_logger

from ..utils.user_job_store import get_user_job_store_name
from models.scheduler_models import SchedulerEventLog
from .interval_manager import determine_optimal_interval
from .job_restoration import restore_persona_jobs
from .oauth_task_restoration import restore_oauth_monitoring_tasks
from .website_analysis_task_restoration import restore_website_analysis_tasks
from .platform_insights_task_restoration import restore_platform_insights_tasks
from .advertools_task_restoration import restore_advertools_tasks
from .check_cycle_handler import check_and_execute_due_tasks
from .task_execution_handler import execute_task_async

logger = get_service_logger("task_scheduler")


class TaskScheduler:
    """
    Pluggable task scheduler that can work with any task model.
    
    Features:
    - Async task execution
    - Plugin-based executor system
    - Database-backed task persistence
    - Configurable check intervals
    - Automatic retry logic
    - User isolation: All tasks are filtered by user_id for isolation
    - Per-user job store context: Logs show user's website root for debugging
    
    User Isolation:
    - Tasks are filtered by user_id in task loaders
    - Execution logs include user_id for tracking
    - Per-user statistics are maintained
    - Job store names (based on website root) are logged for debugging
    """
    
    def __init__(
        self,
        check_interval_minutes: Optional[int] = None,
        max_concurrent_executions: Optional[int] = None,
        enable_retries: Optional[bool] = None,
        max_retries: Optional[int] = None,
        settings: Optional[SchedulerSettings] = None,
    ):
        self.settings = settings if settings is not None else SchedulerSettings.from_env()

        self.check_interval_minutes = check_interval_minutes or self.settings.check_interval_minutes
        self.max_concurrent_executions = max_concurrent_executions or self.settings.max_concurrent_executions
        self.enable_retries = enable_retries if enable_retries is not None else self.settings.enable_retries
        self.max_retries = max_retries or self.settings.max_retries
        
        # Initialize APScheduler
        self.scheduler = AsyncIOScheduler(
            timezone='UTC',
            job_defaults={
                'coalesce': True,
                'max_instances': self.settings.max_instances_per_job,
                'misfire_grace_time': self.settings.misfire_grace_time_seconds
            }
        )
        
        # Configure APScheduler to use unified logging system
        self._configure_apscheduler_logging()
        
        # Task executor registry
        self.registry = TaskRegistry()
        
        # Track running executions
        self.active_executions: Dict[str, asyncio.Task] = {}
        
        # Exception handler for robust error handling
        self.exception_handler = SchedulerExceptionHandler()
        
        # Intelligent scheduling configuration
        self.min_check_interval_minutes = self.settings.min_check_interval_minutes
        self.max_check_interval_minutes = self.settings.max_check_interval_minutes
        self.current_check_interval_minutes = self.check_interval_minutes
        
        # Statistics
        self.stats = {
            'total_checks': 0,
            'tasks_found': 0,
            'tasks_executed': 0,
            'tasks_failed': 0,
            'tasks_skipped': 0,
            'last_check': None,
            'last_update': datetime.utcnow().isoformat(),  # Timestamp for frontend polling
            'per_user_stats': {},  # Track metrics per user for user isolation
            'active_strategies_count': 0,  # Track active strategies with tasks
            'last_interval_adjustment': None  # Track when interval was last adjusted
        }
        
        self._running = False
        self._lock = asyncio.Lock()

        # Local Desktop App: Always leader, no advisory locks needed
        self._leader_lock_key = self.settings.leader_lock_key
        self._leadership_check_interval_seconds = self.settings.leadership_check_interval_seconds
        self._leader_session = None
        self._is_leader = True
        self._execution_enabled = True
        self._leader_since = datetime.utcnow().isoformat()
        self._last_leadership_check = None
        self._last_leadership_error = None


        # Execution lease registry (prevents duplicate redispatch across check cycles)
        self._task_leases: Dict[str, str] = {}
        self._task_lease_ttl_seconds = self.settings.get_task_lease_ttl()
    
    def _get_trigger_for_interval(self, interval_minutes: int):
        """
        Get the appropriate trigger for the given interval.
        
        Uses CronTrigger only when interval_minutes divides 60 evenly (wall-clock alignment).
        Falls back to IntervalTrigger for non-divisors to avoid hour-boundary skew.
        
        Args:
            interval_minutes: Interval in minutes
            
        Returns:
            Appropriate APScheduler trigger
        """
        if interval_minutes < 60 and 60 % interval_minutes == 0:
            return CronTrigger(minute=f'*/{interval_minutes}')
        else:
            return IntervalTrigger(minutes=interval_minutes)
    
    def register_executor(
        self,
        task_type: str,
        executor: TaskExecutor,
        task_loader: Callable[[Session], List[Any]]
    ):
        """
        Register a task executor for a specific task type.
        
        Args:
            task_type: Unique identifier for task type (e.g., 'monitoring_task')
            executor: TaskExecutor instance that handles execution
            task_loader: Function that loads due tasks from database
        """
        self.registry.register(task_type, executor, task_loader)
        logger.info(f"Registered executor for task type: {task_type}")
    
    def _configure_apscheduler_logging(self):
        """Configure APScheduler to use unified logging system."""
        import logging
        
        # Get APScheduler loggers and redirect them to unified logging
        apscheduler_logger = logging.getLogger("apscheduler")
        apscheduler_scheduler_logger = logging.getLogger("apscheduler.scheduler")
        apscheduler_executors_logger = logging.getLogger("apscheduler.executors")
        apscheduler_jobstores_logger = logging.getLogger("apscheduler.jobstores")
        
        # Create a custom handler that redirects to unified logger
        class APSchedulerUnifiedHandler(logging.Handler):
            def __init__(self, service_logger):
                super().__init__()
                self.service_logger = service_logger
            
            def emit(self, record):
                try:
                    # Format the message
                    msg = self.format(record)
                    
                    # Map APScheduler log levels to unified logger
                    if record.levelno >= logging.ERROR:
                        self.service_logger.error(f"[APScheduler] {msg}")
                    elif record.levelno >= logging.WARNING:
                        self.service_logger.warning(f"[APScheduler] {msg}")
                    elif record.levelno >= logging.INFO:
                        self.service_logger.info(f"[APScheduler] {msg}")
                    else:
                        self.service_logger.debug(f"[APScheduler] {msg}")
                except Exception:
                    # Don't let logging errors break the scheduler
                    pass
        
        # Create and add the handler
        unified_handler = APSchedulerUnifiedHandler(logger)
        unified_handler.setLevel(logging.DEBUG)
        
        # Add handler to all APScheduler loggers
        apscheduler_logger.addHandler(unified_handler)
        apscheduler_scheduler_logger.addHandler(unified_handler)
        apscheduler_executors_logger.addHandler(unified_handler)
        apscheduler_jobstores_logger.addHandler(unified_handler)
        
        # Set levels to capture all logs
        apscheduler_logger.setLevel(logging.DEBUG)
        apscheduler_scheduler_logger.setLevel(logging.DEBUG)
        apscheduler_executors_logger.setLevel(logging.DEBUG)
        apscheduler_jobstores_logger.setLevel(logging.DEBUG)
        
        # Prevent propagation to avoid duplicate logs
        apscheduler_logger.propagate = False
        apscheduler_scheduler_logger.propagate = False
        apscheduler_executors_logger.propagate = False
        apscheduler_jobstores_logger.propagate = False
        
        logger.info("APScheduler logging configured to use unified logging system")
    

    def _scheduler_identity(self) -> str:
        return f"{os.getenv('HOSTNAME', 'local')}-{os.getpid()}"

    def _acquire_leadership(self) -> bool:
        """Always return True for local desktop app (no HA needed)."""
        self._is_leader = True
        self._execution_enabled = True
        if not self._leader_since:
            self._leader_since = datetime.utcnow().isoformat()
        self._last_leadership_check = datetime.utcnow().isoformat()
        return True

    def _release_leadership(self):
        """No-op for local desktop app."""
        pass

    def _sync_check_due_tasks_job(self):
        """Ensure check_due_tasks job exists only for leader."""
        job = self.scheduler.get_job('check_due_tasks')
        if self._is_leader and self._execution_enabled:
            if job is None:
                self.scheduler.add_job(
                    self._check_and_execute_due_tasks,
                    trigger=self._get_trigger_for_interval(self.current_check_interval_minutes),
                    id='check_due_tasks',
                    replace_existing=True
                )
        else:
            if job is not None:
                self.scheduler.remove_job('check_due_tasks')

    async def _leadership_tick(self):
        """Periodic leadership check/renewal (Stub for local)."""
        if not self._running:
            return

        self._acquire_leadership()
        self._sync_check_due_tasks_job()

    def _acquire_task_lease(self, task_key: str) -> bool:
        """Acquire in-memory lease for a task key if available/expired."""
        now = datetime.utcnow()
        expiry_str = self._task_leases.get(task_key)

        if expiry_str:
            try:
                expiry = datetime.fromisoformat(expiry_str)
                if expiry > now:
                    return False
            except Exception:
                # Corrupted lease value: overwrite safely
                pass

        expiry = now + timedelta(seconds=self._task_lease_ttl_seconds)
        self._task_leases[task_key] = expiry.isoformat()
        return True

    def _release_task_lease(self, task_key: str):
        """Release lease for task key."""
        if task_key in self._task_leases:
            del self._task_leases[task_key]

    def _is_task_leased(self, task_key: str) -> bool:
        """Check whether task key is currently leased and not expired."""
        expiry_str = self._task_leases.get(task_key)
        if not expiry_str:
            return False

        try:
            expiry = datetime.fromisoformat(expiry_str)
            if expiry > datetime.utcnow():
                return True
        except Exception:
            pass

        # Expired/corrupt lease gets cleaned up lazily
        self._release_task_lease(task_key)
        return False

    async def start(self):
        """Start the scheduler with intelligent interval adjustment."""
        async with self._lock:
            if self._running:
                logger.warning("Scheduler is already running")
                return

            apscheduler_started = False
            try:
                initial_interval = await determine_optimal_interval(
                    self,
                    self.min_check_interval_minutes,
                    self.max_check_interval_minutes
                )
                self.current_check_interval_minutes = initial_interval

                self.scheduler.start()
                apscheduler_started = True

                self.scheduler.add_job(
                    self._leadership_tick,
                    trigger=IntervalTrigger(seconds=self._leadership_check_interval_seconds),
                    id='leadership_monitor',
                    replace_existing=True,
                    max_instances=1,
                    coalesce=True
                )

                await self._leadership_tick()
                await self._execute_missed_jobs()
                await restore_persona_jobs(self)

                total_oauth_tasks = await restore_oauth_monitoring_tasks(self)
                oauth_tasks_count = total_oauth_tasks
                website_analysis_tasks_count = await restore_website_analysis_tasks(self)
                platform_insights_tasks_count = await restore_platform_insights_tasks(self)
                advertools_tasks_count = await restore_advertools_tasks(self)

                await self._validate_and_rebuild_cumulative_stats()

                self._running = True

                all_jobs = self.scheduler.get_jobs()
                registered_types = self.registry.get_registered_types()
                active_strategies = self.stats.get('active_strategies_count', 0)

                apscheduler_recurring = 1
                apscheduler_one_time = len(all_jobs) - 1
                total_recurring = apscheduler_recurring + oauth_tasks_count + website_analysis_tasks_count + platform_insights_tasks_count + advertools_tasks_count
                total_jobs = len(all_jobs) + oauth_tasks_count + website_analysis_tasks_count + platform_insights_tasks_count + advertools_tasks_count

                startup_lines = [
                    f"[Scheduler] TaskScheduler Started",
                    f"   ├─ Check Interval: {initial_interval} minutes",
                    f"   ├─ Registered Task Types: {len(registered_types)} ({', '.join(registered_types) if registered_types else 'none'})",
                    f"   ├─ Active Strategies: {active_strategies}",
                    f"   ├─ Total Scheduled Jobs: {total_jobs}",
                    f"   ├─ Recurring Jobs: {total_recurring} ({'check_due_tasks: 1' + (f', OAuth monitoring: {oauth_tasks_count}' if oauth_tasks_count > 0 else '') + (f', Website analysis: {website_analysis_tasks_count}' if website_analysis_tasks_count > 0 else '') + (f', Platform insights: {platform_insights_tasks_count}' if platform_insights_tasks_count > 0 else '') + (f', Advertools: {advertools_tasks_count}' if advertools_tasks_count > 0 else '')})",
                    f"   └─ One-Time Jobs: {apscheduler_one_time}"
                ]

                if all_jobs:
                    for idx, job in enumerate(all_jobs):
                        is_last = idx == len(all_jobs) - 1 and oauth_tasks_count == 0 and website_analysis_tasks_count == 0 and platform_insights_tasks_count == 0
                        prefix = "   └─" if is_last else "   ├─"
                        next_run = job.next_run_time
                        trigger_type = type(job.trigger).__name__
                        user_context = ""
                        user_id_from_job = None

                        if hasattr(job, 'kwargs') and job.kwargs and job.kwargs.get('user_id'):
                            user_id_from_job = job.kwargs.get('user_id')
                        elif job.id and ('research_persona_' in job.id or 'facebook_persona_' in job.id):
                            if job.id.startswith('research_persona_'):
                                user_id_from_job = job.id.replace('research_persona_', '')
                            elif job.id.startswith('facebook_persona_'):
                                user_id_from_job = job.id.replace('facebook_persona_', '')
                            else:
                                parts = job.id.split('_')
                                if len(parts) >= 3:
                                    user_id_from_job = parts[2]

                        if user_id_from_job:
                            try:
                                db = get_session_for_user(user_id_from_job)
                                if db:
                                    user_job_store = get_user_job_store_name(user_id_from_job, db)
                                    if user_job_store == 'default':
                                        logger.debug(
                                            f"[Scheduler] Job store extraction returned 'default' for user {user_id_from_job}. "
                                            f"This may indicate no onboarding data or website URL not found."
                                        )
                                    user_context = f" | User: {user_id_from_job} | Store: {user_job_store}"
                                    db.close()
                                else:
                                    user_context = f" | User: {user_id_from_job} | DB: Not Found"
                            except Exception as e:
                                logger.warning(
                                    f"[Scheduler] Could not extract job store name for user {user_id_from_job}: {e}. "
                                    f"Error type: {type(e).__name__}"
                                )
                                user_context = f" | User: {user_id_from_job}"

                        startup_lines.append(f"{prefix} Job: {job.id} | Trigger: {trigger_type} | Next Run: {next_run}{user_context}")

                if advertools_tasks_count > 0:
                    try:
                        user_ids = get_all_user_ids()
                        for user_id in user_ids:
                            try:
                                db = get_session_for_user(user_id)
                                if db:
                                    from models.advertools_monitoring_models import AdvertoolsTask
                                    advertools_tasks = db.query(AdvertoolsTask).all()
                                    for idx, task in enumerate(advertools_tasks):
                                        is_last = idx == len(advertools_tasks) - 1 and len(all_jobs) == 0 and total_oauth_tasks == 0 and website_analysis_tasks_count == 0 and platform_insights_tasks_count == 0 and user_id == user_ids[-1]
                                        prefix = "   ├─"
                                        try:
                                            user_job_store = get_user_job_store_name(task.user_id, db)
                                        except Exception as e:
                                            logger.debug(f"Could not extract job store name for user {task.user_id}: {e}")
                                            user_job_store = 'default'
                                        next_check = task.next_execution.isoformat() if task.next_execution else 'Not scheduled'
                                        task_type = task.payload.get('type') if task.payload else 'unknown'
                                        status_indicator = "active" if task.status == 'active' else task.status
                                        startup_lines.append(
                                            f"{prefix} Job: advertools_{task_type}_{task.user_id}_{task.id} | "
                                            f"Trigger: CronTrigger (Weekly) | Next Run: {next_check} | "
                                            f"User: {task.user_id} | Store: {user_job_store} | Type: {task_type} | Status: {status_indicator}"
                                        )
                                    db.close()
                            except Exception as e:
                                logger.warning(f"Error checking Advertools tasks for user {user_id}: {e}")
                    except Exception as e:
                        logger.debug(f"Could not get Advertools task details: {e}")

                logger.warning("\n".join(startup_lines))

            except Exception as e:
                self._running = False
                if apscheduler_started:
                    try:
                        self.scheduler.shutdown(wait=False)
                    except Exception:
                        pass
                logger.error(f"Failed to start scheduler: {e}")
                raise


    @property
    def is_running(self) -> bool:
        """Check if the scheduler is currently running."""
        return self._running

    async def health_check(self) -> Dict[str, Any]:
        """Return scheduler health status."""
        return {
            "healthy": self._running and self.scheduler.running,
            "running": self._running,
            "scheduler_running": self.scheduler.running,
            "active_executions": len(self.active_executions),
        }

    async def stop(self):
        """Stop the scheduler gracefully."""
        async with self._lock:
            if not self._running:
                return

            try:
                # Cancel all active executions
                for task_id, execution_task in self.active_executions.items():
                    execution_task.cancel()

                # Wait for active executions to complete (with timeout)
                if self.active_executions:
                    await asyncio.wait(
                        self.active_executions.values(),
                        timeout=self.settings.shutdown_timeout_seconds
                    )

                # Get final job count before shutdown
                all_jobs_before = self.scheduler.get_jobs()

                # Release leadership lock and stop leadership monitor
                try:
                    if self.scheduler.get_job('leadership_monitor') is not None:
                        self.scheduler.remove_job('leadership_monitor')
                except Exception:
                    pass
                self._release_leadership()

                # Shutdown scheduler
                self.scheduler.shutdown(wait=True)

                # Log comprehensive shutdown information
                total_checks = self.stats.get('total_checks', 0)
                total_executed = self.stats.get('tasks_executed', 0)
                total_failed = self.stats.get('tasks_failed', 0)

                shutdown_message = (
                    f"[Scheduler] Task Scheduler Stopped\n"
                    f"   ├─ Total Check Cycles: {total_checks}\n"
                    f"   ├─ Total Tasks Executed: {total_executed}\n"
                    f"   ├─ Total Tasks Failed: {total_failed}\n"
                    f"   ├─ Jobs Cancelled: {len(all_jobs_before)}\n"
                    f"   └─ Shutdown: Graceful"
                )
                logger.warning(shutdown_message)

            except Exception as e:
                logger.error(f"Error stopping scheduler: {e}")
                raise
            finally:
                self._running = False

    async def _check_and_execute_due_tasks(self):
        """
        Main scheduler loop: check for due tasks and execute them.
        This runs periodically with intelligent interval adjustment based on active strategies.
        """
        if not self._execution_enabled or not self._is_leader:
            logger.debug("[Scheduler] Skipping due-task loop on standby replica")
            return

        await check_and_execute_due_tasks(self)
    
    async def _execute_missed_jobs(self):
        """
        Check for and execute any missed DateTrigger jobs that are still within grace period.
        APScheduler marks jobs as 'missed' if they were scheduled to run while the scheduler wasn't running.
        """
        try:
            all_jobs = self.scheduler.get_jobs()
            now = datetime.utcnow().replace(tzinfo=self.scheduler.timezone)
            
            missed_jobs = []
            for job in all_jobs:
                # Only check DateTrigger jobs (one-time tasks)
                if hasattr(job, 'trigger') and isinstance(job.trigger, DateTrigger):
                    if job.next_run_time and job.next_run_time < now:
                        # Job's scheduled time has passed
                        time_since_scheduled = (now - job.next_run_time).total_seconds()
                        # Check if still within grace period (1 hour = 3600 seconds)
                        if time_since_scheduled <= self.settings.missed_job_grace_seconds:
                            missed_jobs.append(job)
            
            if missed_jobs:
                logger.warning(
                    f"[Scheduler] Found {len(missed_jobs)} missed job(s) within grace period, executing now..."
                )
                for job in missed_jobs:
                    try:
                        # Execute the job immediately
                        logger.info(f"[Scheduler] Executing missed job: {job.id}")
                        await job.func(*job.args, **job.kwargs)
                    except Exception as e:
                        logger.error(f"[Scheduler] Error executing missed job {job.id}: {e}")
        except Exception as e:
            logger.warning(f"[Scheduler] Error checking for missed jobs: {e}")
    
    async def _validate_and_rebuild_cumulative_stats(self):
        """
        Validate and rebuild cumulative stats if needed.
        Currently a placeholder for future implementation.
        """
        pass

    async def _process_task_type(
        self,
        task_type: str,
        db: Session,
        cycle_summary: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, int]:
        summary = {"found": 0, "executed": 0, "failed": 0}
        try:
            task_loader = self.registry.get_task_loader(task_type)
        except Exception as e:
            error = TaskLoaderError(
                message=f"Failed to get task loader for type {task_type}: {str(e)}",
                user_id=user_id,
                context={"task_type": task_type},
                original_error=e
            )
            self.exception_handler.handle_exception(error, db=db)
            self.stats["tasks_failed"] += 1
            return summary

        try:
            tasks = task_loader(db)

            if not tasks:
                return summary

            summary["found"] = len(tasks)
            max_concurrent = self.max_concurrent_executions

            for task in tasks:
                task_id = getattr(task, "id", None)
                lease_key = f"{task_type}_{task_id or id(task)}"

                if self._is_task_leased(lease_key):
                    continue

                if len(self.active_executions) >= max_concurrent:
                    break

                if not self._acquire_task_lease(lease_key):
                    continue

                execution_task = asyncio.create_task(
                    execute_task_async(
                        self,
                        task_type,
                        task,
                        summary,
                        execution_source="scheduler",
                        user_id=user_id,
                    )
                )
                self.active_executions[lease_key] = execution_task

            cycle_summary.setdefault("tasks_found_by_type", {})
            cycle_summary.setdefault("tasks_executed_by_type", {})
            cycle_summary.setdefault("tasks_failed_by_type", {})

            cycle_summary["tasks_found_by_type"][task_type] = (
                cycle_summary["tasks_found_by_type"].get(task_type, 0)
                + summary["found"]
            )
            cycle_summary["tasks_executed_by_type"][task_type] = (
                cycle_summary["tasks_executed_by_type"].get(task_type, 0)
                + summary["executed"]
            )
            cycle_summary["tasks_failed_by_type"][task_type] = (
                cycle_summary["tasks_failed_by_type"].get(task_type, 0)
                + summary["failed"]
            )

            self.stats["tasks_found"] += summary["found"]

            return summary
        except Exception as e:
            error = TaskLoaderError(
                message=f"Error processing task type {task_type}: {str(e)}",
                user_id=user_id,
                context={"task_type": task_type},
                original_error=e
            )
            self.exception_handler.handle_exception(error, db=db)
            self.stats["tasks_failed"] += 1
            return summary

    def _update_user_stats(self, user_id: Optional[str], success: bool):
        if not user_id:
            return
        per_user = self.stats.setdefault("per_user_stats", {})
        user_stats = per_user.setdefault(
            user_id,
            {
                "tasks_executed": 0,
                "tasks_failed": 0,
                "last_update": None,
            },
        )
        if success:
            user_stats["tasks_executed"] += 1
        else:
            user_stats["tasks_failed"] += 1
        user_stats["last_update"] = datetime.utcnow().isoformat()

    def get_stats(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Return a composite stats dict for the dashboard.

        C1: this method was missing — the dashboard endpoint called
        `scheduler.get_stats()` and crashed with `AttributeError`. We now
        return `self.stats` (counters) plus live runtime attributes
        (running state, active execution count, current/min/max check
        interval, registered task types).

        The returned dict is a deep copy of `self.stats` (callers cannot
        mutate scheduler state through it) plus live runtime attributes
        (running state, active execution count, current/min/max check
        interval, registered task types).

        If `user_id` is provided, per-user counters are returned under
        the top-level keys (so the dashboard can show a user-scoped
        view). Global counters are still included.
        """
        import copy

        # Shallow copy the top-level stats dict, then deep copy the
        # nested per_user_stats (and each per-user sub-dict) so callers
        # can read but not mutate scheduler state.

        out: Dict[str, Any] = dict(self.stats)
        nested = self.stats.get("per_user_stats")
        if isinstance(nested, dict):
            out["per_user_stats"] = {
                uid: copy.deepcopy(user_stats)
                for uid, user_stats in nested.items()
            }

        # Live runtime attributes that the dashboard reads.
        out["active_executions"] = len(self.active_executions)
        out["running"] = self._running
        out["check_interval_minutes"] = self.current_check_interval_minutes
        out["min_check_interval_minutes"] = self.min_check_interval_minutes
        out["max_check_interval_minutes"] = self.max_check_interval_minutes
        # Adaptive interval logic exists (min < max) so flag it on.
        out["intelligent_scheduling"] = (
            self.min_check_interval_minutes < self.max_check_interval_minutes
        )
        try:
            out["registered_types"] = list(self.registry.get_registered_types())
        except Exception:
            out["registered_types"] = []

        # User-scoped view: overlay per-user counters at the top level.
        if user_id is not None:
            user_stats = out.get("per_user_stats", {}).get(user_id) or {}
            out["tasks_executed"] = user_stats.get("tasks_executed", 0)
            out["tasks_failed"] = user_stats.get("tasks_failed", 0)
            out["last_update"] = user_stats.get("last_update") or out.get("last_update")

        return out

    async def _schedule_retry(self, task: Any, retry_delay: int):
        try:
            task_id = getattr(task, "id", None)
            logger.warning(
                f"[Scheduler] Retry requested for task {task_id} in {retry_delay}s, "
                f"using loader-based retry semantics."
            )
        except Exception:
            pass

    def schedule_one_time_task(
        self,
        func: Callable,
        run_date: datetime,
        job_id: str,
        kwargs: Optional[Dict[str, Any]] = None,
        replace_existing: bool = True
    ) -> str:
        """
        Schedule a one-time task execution.
        
        Args:
            func: Function to execute
            run_date: Date/time to run the task
            job_id: Unique job ID
            kwargs: Keyword arguments for the function
            replace_existing: Whether to replace existing job with same ID
            
        Returns:
            Job ID
        """
        try:
            self.scheduler.add_job(
                func,
                trigger=DateTrigger(run_date=run_date),
                id=job_id,
                kwargs=kwargs or {},
                replace_existing=replace_existing,
                misfire_grace_time=self.settings.one_time_misfire_grace_seconds
            )
            logger.info(f"Scheduled one-time task {job_id} at {run_date}")
            return job_id
        except Exception as e:
            logger.error(f"Failed to schedule one-time task {job_id}: {e}")
            raise
