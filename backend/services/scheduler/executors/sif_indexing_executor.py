"""
SIF Indexing Executor
Executes SIF indexing tasks (Step 2 metadata and User Website Content).
"""

import time
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.website_analysis_monitoring_models import (
    SIFIndexingTask,
    SIFIndexingExecutionLog
)
from models.onboarding import OnboardingSession
from services.scheduler.core.executor_interface import TaskExecutor, TaskExecutionResult
from services.scheduler.core.failure_detection_service import FailureDetectionService
from services.intelligence.sif_integration import SIFIntegrationService
from utils.logger_utils import get_service_logger

# Issue #620 #5: import ContentGuardianAgent at module top with
# try/except. Pre-#5 the import was inside the ``execute_task``
# except block, so a missing dependency silently disabled the
# audit with only a ``logger.error`` line. Operators had no
# way to see "ContentGuardianAgent is unavailable" at startup.
# Now we record the failure once at import time so it's visible
# in any boot log / health check.
try:
    from services.intelligence.agents.specialized import ContentGuardianAgent
    _CONTENT_GUARDIAN_AVAILABLE = True
    _CONTENT_GUARDIAN_IMPORT_ERROR: Optional[str] = None
except ImportError as _guardian_import_err:
    _CONTENT_GUARDIAN_AVAILABLE = False
    _CONTENT_GUARDIAN_IMPORT_ERROR = str(_guardian_import_err)
    ContentGuardianAgent = None  # type: ignore

logger = get_service_logger("sif_indexing_executor")


class SIFIndexingExecutor(TaskExecutor):
    """
    Executor for SIF indexing tasks.
    
    Handles:
    - Indexing Step 2 Website Analysis Data (Metadata)
    - Harvesting and Indexing User Website Content (Deep Crawl)
    - Scheduling recurring updates (snapshot refresh)
    """
    
    def __init__(self):
        pass

    async def execute_task(self, task: Any, db: Session) -> TaskExecutionResult:
        start_time = time.time()

        if not isinstance(task, SIFIndexingTask):
            return TaskExecutionResult(
                success=False,
                error_message="Invalid task type for SIF indexing",
                retryable=False
            )

        task_log = SIFIndexingExecutionLog(
            task_id=task.id,
            status="running",
            execution_date=datetime.utcnow()
        )
        db.add(task_log)
        db.commit()

        user_id = str(task.user_id)
        website_url = task.website_url

        try:
            logger.info(f"Executing SIF indexing for user {user_id} ({website_url})")

            onboarding_session = (
                db.query(OnboardingSession)
                .filter(OnboardingSession.user_id == user_id)
                .order_by(OnboardingSession.updated_at.desc())
                .first()
            )
            if not onboarding_session:
                # Issue #620 #4: pre-#4 the executor set
                # ``task.status = "paused"`` and
                # ``task.next_execution = None``, which permanently
                # wedged the task. Users with a missing onboarding
                # record (DB inconsistency, partial rollback, etc.)
                # would never get their SIF index. The fix keeps
                # the task ``active`` and reschedules a 24h retry
                # so we get out of the wedged state automatically.
                # The /sif-indexing/health endpoint already surfaces
                # this kind of failure via the ``last_failure`` /
                # ``error_message`` fields, so operators see it.
                logger.info(
                    f"SIF indexing for user {user_id}: no onboarding session found. "
                    "Scheduling 24h retry (will resume once the "
                    "onboarding record is created). "
                    "See /sif-indexing/health for monitoring."
                )
                task.last_executed = datetime.utcnow()
                # Keep status as 'active' so the scheduler picks
                # us up again at next_execution. We deliberately do
                # NOT pause; pausing requires manual intervention
                # which is the bug we are fixing.
                task.status = "active"
                task.next_execution = datetime.utcnow() + timedelta(hours=24)

                task_log.status = "skipped"
                task_log.result_data = {
                    "reason": "no_onboarding_session",
                    "website_url": website_url,
                    "retry_at": task.next_execution.isoformat(),
                }
                task_log.execution_time_ms = int((time.time() - start_time) * 1000)
                db.commit()

                return TaskExecutionResult(
                    success=True,
                    result_data=task_log.result_data,
                    execution_time_ms=task_log.execution_time_ms,
                    # retryable=True so the failure-tracking
                    # service doesn't escalate this to a 7-day
                    # cool-off (which is for real failures, not
                    # "wait for onboarding to finish").
                    retryable=True,
                )
            
            # Initialize SIF Service
            sif_service = SIFIntegrationService(user_id)
            
            # Phase tracking: write progress to task payload for frontend polling
            def _update_phase(phase: str, **extra):
                payload = dict(task.payload) if task.payload else {}
                payload['phase'] = phase
                payload.update(extra)
                task.payload = payload
                try:
                    db.commit()
                except Exception:
                    db.rollback()

            def _log(message: str):
                payload = dict(task.payload) if task.payload else {}
                logs = list(payload.get('log_messages') or [])
                logs.append(message)
                if len(logs) > 20:
                    logs = logs[-20:]
                payload['log_messages'] = logs
                task.payload = payload
                try:
                    db.commit()
                except Exception:
                    db.rollback()

            async def _log_callback(message: str):
                _log(message)

            _update_phase("harvesting")
            _log(f"Starting SIF indexing for {website_url}")

            # Progress callback: update task.payload incrementally
            async def _harvest_progress(current: int, total: int):
                payload = dict(task.payload) if task.payload else {}
                payload['pages_harvested'] = current
                payload['pages_total'] = total
                payload['phase'] = f"harvesting {current}/{total}"
                task.payload = payload
                try:
                    db.commit()
                except Exception:
                    db.rollback()

            # 1. Sync Step 2 Metadata (WebsiteAnalysis, CompetitorAnalysis)
            _log("Indexing site metadata...")
            metadata_synced = await sif_service.sync_onboarding_data_to_sif()

            _update_phase("indexing_metadata", items_indexed=metadata_synced or 0)
            _log(f"Indexed {metadata_synced or 0} metadata item(s)")

            # 1.5. Sync SEO Page Audits (per-page audit data for semantic search)
            _log("Indexing SEO page audits...")
            try:
                seo_audit_synced = await sif_service.sync_seo_audit_to_sif()
                _log(f"Indexed SEO page audits")
            except Exception as e:
                logger.warning(f"SEO audit sync failed (continuing): {e}")
                _log(f"SEO audit sync skipped: {e}")

            # 2. Sync User Website Content (Deep Crawl / Snapshot)
            _log("Harvesting website pages...")
            content_result = await sif_service.sync_user_website_content(
                website_url, progress_callback=_harvest_progress, log_callback=_log_callback)
            
            pages_harvested = content_result.get("count", 0) if isinstance(content_result, dict) else (content_result if isinstance(content_result, int) else 0)
            indexed_pages = content_result.get("pages", []) if isinstance(content_result, dict) else []

            # If nothing new was harvested, retain the previously indexed
            # page list so the SIF panel keeps showing the full index.
            if not indexed_pages and isinstance(task.payload, dict) and task.payload.get("indexed_pages"):
                indexed_pages = task.payload.get("indexed_pages")
            
            # Fetch sitemap total for visibility
            sitemap_total = 0
            try:
                from models.onboarding import WebsiteAnalysis
                wa = db.query(WebsiteAnalysis).filter(
                    WebsiteAnalysis.session_id == onboarding_session.id
                ).order_by(WebsiteAnalysis.created_at.desc()).first()
                if wa and wa.seo_audit:
                    sitemap_data = wa.seo_audit.get("sitemap_analysis", {})
                    ad = sitemap_data.get("analysis_data", {}) or sitemap_data
                    sitemap_total = ad.get("total_urls", 0) or 0
            except Exception:
                pass
            if not sitemap_total:
                # SSOT fallback (Phase 1 plan): the persisted sitemap inventory
                # may know the site size even when seo_audit has no analysis.
                try:
                    from services.seo.sitemap_ssot import get_inventory_total
                    sitemap_total = get_inventory_total(db, user_id) or 0
                except Exception:
                    pass

            _update_phase("indexing_content", pages_harvested=pages_harvested, indexed_pages=indexed_pages, sitemap_total=sitemap_total)
            content_synced = pages_harvested > 0
            _log(f"Harvested {pages_harvested} page(s) from {website_url}")

            # 3. Trigger Content Guardian Audit (Background Analysis)
            # This ensures the agent runs immediately after new data is indexed
            guardian_report = None
            if content_synced:
                # Issue #620 #5: pre-#5 the import was inside this
                # ``try`` block, so a missing ContentGuardianAgent
                # dependency was silently swallowed with just a
                # ``logger.error``. Now the import is at module
                # top with a guard; we only enter the try/except
                # if the agent is available.
                if not _CONTENT_GUARDIAN_AVAILABLE:
                    logger.warning(
                        f"ContentGuardianAgent unavailable at import time "
                        f"({_CONTENT_GUARDIAN_IMPORT_ERROR}); skipping site audit. "
                        f"This was logged once at module import; the underlying "
                        f"issue needs operator attention."
                    )
                else:
                    try:
                        # Re-use the intelligence service from sif_service
                        guardian_agent = ContentGuardianAgent(
                            intelligence_service=sif_service.intelligence_service,
                            user_id=user_id,
                            sif_service=sif_service
                        )

                        logger.info("Triggering Content Guardian Site Audit...")
                        guardian_report = await guardian_agent.perform_site_audit(website_url)

                        # Persist the audit report in the task log result data
                    except Exception as e:
                        logger.error(f"Failed to run Content Guardian audit: {e}")
                        _log(f"Site audit failed: {e}")

            # 4. Identify content pillars from the freshly indexed content
            pillar_count = 0
            pillars = []
            if content_synced:
                _update_phase("analyzing")
                _log("Analyzing content pillars...")
                try:
                    pillar_result = await sif_service.analyze_content_pillars()
                    pillars = pillar_result.get("pillars", []) if isinstance(pillar_result, dict) else []
                    pillar_count = len(pillars)
                    if pillar_result.get("error"):
                        _log(f"Pillar analysis warning: {pillar_result.get('error')}")
                except Exception as e:
                    logger.error(f"Failed to analyze content pillars: {e}")
                    _log(f"Pillar analysis failed: {e}")

            # Merge pillar results into the guardian report so downstream
            # consumers (tasks/status, dashboard_service) can read them.
            if guardian_report is None:
                guardian_report = {}
            if isinstance(guardian_report, dict):
                guardian_report["pillars"] = pillars
                guardian_report["pillars_found"] = pillar_count

            # Phase tracking: mark complete with results
            _update_phase("complete", pillars_found=pillar_count, pages_harvested=pages_harvested)
            _log(f"Indexing complete: {pages_harvested} page(s), {pillar_count} pillar(s) found")
            
            # Determine overall success
            success = metadata_synced or content_synced

            task.last_executed = datetime.utcnow()

            if success:
                # Normal success — update last_success, clear failure state
                task.last_success = datetime.utcnow()
                task.consecutive_failures = 0
                task.failure_pattern = None
                task.failure_reason = None
                frequency_hours = task.frequency_hours or 48
                task.next_execution = datetime.utcnow() + timedelta(hours=frequency_hours)
                task.status = "active"

                task_log.status = "success"
                task_log.result_data = {
                    "metadata_synced": metadata_synced,
                    "content_synced": content_synced,
                    "guardian_report": guardian_report,
                    "website_url": website_url
                }
                task_log.execution_time_ms = int((time.time() - start_time) * 1000)

                db.commit()

                return TaskExecutionResult(
                    success=True,
                    result_data=task_log.result_data,
                    execution_time_ms=task_log.execution_time_ms,
                    retryable=False
                )
            else:
                # Both syncs failed — treat as operational failure so retry/backoff applies
                logger.warning(f"SIF indexing completed but no data was synced/indexed for {user_id}")
                task.last_failure = datetime.utcnow()
                task.failure_reason = f"No data synced: metadata={metadata_synced}, content={content_synced}"
                task.consecutive_failures = (task.consecutive_failures or 0) + 1
                task.status = "active"
                task.next_execution = datetime.utcnow() + timedelta(minutes=60)

                task_log.status = "failed"
                task_log.error_message = task.failure_reason
                task_log.result_data = {
                    "metadata_synced": metadata_synced,
                    "content_synced": content_synced,
                    "guardian_report": guardian_report,
                    "website_url": website_url
                }
                task_log.execution_time_ms = int((time.time() - start_time) * 1000)

                db.commit()

                return TaskExecutionResult(
                    success=False,
                    error_message=task_log.error_message,
                    execution_time_ms=task_log.execution_time_ms,
                    retryable=True,
                    retry_delay=3600
                )

        except Exception as e:
            db.rollback()
            logger.warning(f"SIF indexing task failed for user {user_id}: {e}")

            # Re-merge objects after rollback to avoid DetachedInstanceError
            task = db.merge(task)
            task_log = db.merge(task_log)

            failure_detection = FailureDetectionService(db)
            pattern = failure_detection.analyze_task_failures(task.id, "sif_indexing", user_id)

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
                    "cool_off_until": (datetime.utcnow() + timedelta(days=7)).isoformat()
                }
                task.next_execution = None
            else:
                # Retry sooner if it's a transient failure
                task.status = "active" # Keep active for retry
                task.next_execution = datetime.utcnow() + timedelta(minutes=60)

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
                retry_delay=3600
            )

    def calculate_next_execution(self, task: Any, frequency: str, last_execution: datetime = None) -> datetime:
        # Not strictly used here as we handle logic in execute_task, but good for interface compliance
        base = last_execution or datetime.utcnow()
        hours = getattr(task, 'frequency_hours', 48) or 48
        return base + timedelta(hours=hours)
