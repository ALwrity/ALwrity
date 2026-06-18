"""
Daily Workflow Batch Processing
================================

Owns the scheduled / batch-mode daily workflow entry point and the
per-user bounded processing helpers. Split out of `today_workflow_service.py`
to keep that module focused on per-user workflow generation.

Public API:
    - generate_scheduled_daily_workflows: cron entry point

Internal:
    - DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC / DAILY_WORKFLOW_MAX_CONCURRENCY
    - _classify_workflow_error
    - _process_one_user / _process_one_user_bounded
    - _merge_stats
"""

import asyncio
import os
from typing import Any, Dict, List

from sqlalchemy.exc import IntegrityError, OperationalError, DBAPIError
from loguru import logger

from services.database import get_all_user_ids, get_session_for_user
from services.onboarding.progress_service import OnboardingProgressService
from services.active_strategy_service import ActiveStrategyService
from services.today_workflow_service import get_or_create_daily_workflow_plan


# C1: Bounded per-user work for the daily cron.
# - Per-user timeout prevents one slow user from blowing past the misfire
#   grace window.
# - Concurrency cap (semaphore) limits simultaneous users so we don't
#   exhaust DB connections / LLM concurrency.
# Defaults are conservative; can be overridden via env if needed.
DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC = int(os.getenv("DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC", "60"))
DAILY_WORKFLOW_MAX_CONCURRENCY = int(os.getenv("DAILY_WORKFLOW_MAX_CONCURRENCY", "10"))


def _classify_workflow_error(exc: BaseException) -> str:
    """Return 'transient' for errors likely to succeed on retry, 'permanent' otherwise.

    Distinguishing transient vs permanent failures lets operators triage
    alerting differently: a spike in transient failures often points to
    infrastructure (DB locks, timeouts), while permanent failures indicate
    a real bug that needs investigation.
    """
    if isinstance(exc, (OperationalError, DBAPIError)):
        return "transient"

    if isinstance(exc, (asyncio.TimeoutError, ConnectionError, TimeoutError)):
        return "transient"

    # IntegrityError is transient: another worker won the race; the plan exists
    if isinstance(exc, IntegrityError):
        return "transient"

    return "permanent"


async def _process_one_user(user_id: str) -> Dict[str, int]:
    """Process a single user in the daily workflow run.

    Returns a stats delta (per-key int counts) so the caller can aggregate
    results across users. Any exception is caught and classified here, so
    this function never raises.
    """
    delta = {
        "users_seen": 1,
        "created": 0,
        "existing": 0,
        "skipped_no_onboarding": 0,
        "skipped_no_strategy": 0,
        "failed": 0,
        "failed_transient": 0,
        "failed_permanent": 0,
    }
    db = None
    try:
        # Gate 1: Onboarding must be completed
        onboarding_service = OnboardingProgressService()
        status = onboarding_service.get_onboarding_status(user_id)
        if not status.get("is_completed", False):
            delta["skipped_no_onboarding"] += 1
            logger.info("Skipping daily workflow for user {} — onboarding not completed", user_id)
            return delta

        db = get_session_for_user(user_id)
        if not db:
            delta["failed"] += 1
            delta["failed_transient"] += 1
            logger.warning("DB session unavailable for user {}", user_id)
            return delta

        # Gate 2: User must have an active content strategy
        active_strategy_service = ActiveStrategyService(db_session=db)
        has_active_strategy = active_strategy_service.has_active_strategies_with_tasks()
        if not has_active_strategy:
            delta["skipped_no_strategy"] += 1
            logger.info("Skipping daily workflow for user {} — no active strategy", user_id)
            return delta

        plan, created = await get_or_create_daily_workflow_plan(
            db,
            user_id,
            creation_source="scheduled",
        )
        if created:
            delta["created"] += 1
            logger.info("Scheduled daily workflow created for user {} date {}", user_id, plan.date)
        else:
            delta["existing"] += 1
            logger.info("Scheduled daily workflow already exists for user {} date {}", user_id, plan.date)
        return delta
    except Exception as e:
        kind = _classify_workflow_error(e)
        delta["failed"] += 1
        delta[f"failed_{kind}"] += 1
        logger.error(
            "Scheduled daily workflow generation failed for user {} ({}): {}",
            user_id, kind, e,
        )
        return delta
    finally:
        if db:
            db.close()


async def _process_one_user_bounded(user_id: str, sem: asyncio.Semaphore) -> Dict[str, int]:
    """Wrap _process_one_user with a per-user timeout + concurrency cap."""
    async with sem:
        try:
            return await asyncio.wait_for(
                _process_one_user(user_id),
                timeout=DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.error(
                "Daily workflow for user {} exceeded {}s timeout — counted as transient failure",
                user_id, DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC,
            )
            return {
                "users_seen": 1,
                "created": 0,
                "existing": 0,
                "skipped_no_onboarding": 0,
                "skipped_no_strategy": 0,
                "failed": 1,
                "failed_transient": 1,
                "failed_permanent": 0,
            }
        except Exception as e:
            # Defence-in-depth: the inner function already catches all
            # exceptions, but anything that escapes (e.g., a bug in our
            # classification itself) should not kill the entire run.
            kind = _classify_workflow_error(e)
            logger.error(
                "Unhandled error in bounded daily workflow for user {} ({}): {}",
                user_id, kind, e,
            )
            return {
                "users_seen": 1,
                "created": 0,
                "existing": 0,
                "skipped_no_onboarding": 0,
                "skipped_no_strategy": 0,
                "failed": 1,
                "failed_transient": 1 if kind == "transient" else 0,
                "failed_permanent": 1 if kind == "permanent" else 0,
            }


def _merge_stats(target: Dict[str, int], delta: Dict[str, int]) -> None:
    """Add counts from `delta` into `target` in place."""
    for key, value in delta.items():
        target[key] = target.get(key, 0) + value


async def generate_scheduled_daily_workflows() -> Dict[str, int]:
    user_ids = get_all_user_ids()
    stats = {
        "users_seen": 0,
        "created": 0,
        "existing": 0,
        "skipped_no_onboarding": 0,
        "skipped_no_strategy": 0,
        "failed": 0,
        "failed_transient": 0,
        "failed_permanent": 0,
    }

    if not user_ids:
        logger.info("Scheduled daily workflow run: no users to process")
        return stats

    # C1: bound concurrency. asyncio.Semaphore caps simultaneous in-flight
    # user workflows so we don't overwhelm DB connections or LLM
    # concurrency. Sequential loop was O(users * avg_time) which could
    # exceed the 1-hour misfire grace window for large user bases.
    sem = asyncio.Semaphore(DAILY_WORKFLOW_MAX_CONCURRENCY)
    logger.info(
        "Scheduled daily workflow run starting: {} users, concurrency={}, per_user_timeout={}s",
        len(user_ids), DAILY_WORKFLOW_MAX_CONCURRENCY, DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC,
    )

    coros = [_process_one_user_bounded(uid, sem) for uid in user_ids]
    # return_exceptions=True ensures one task's failure doesn't cancel
    # siblings; any escaped exception is already converted to a stats
    # delta by `_process_one_user_bounded`.
    results = await asyncio.gather(*coros, return_exceptions=True)

    for r in results:
        if isinstance(r, Exception):
            # Should not happen because the bounded wrapper catches all,
            # but log defensively so we notice if a future change breaks
            # that contract.
            logger.error("Unexpected exception from bounded user task: {}", r)
            stats["users_seen"] += 1
            stats["failed"] += 1
            stats["failed_permanent"] += 1
            continue
        _merge_stats(stats, r)

    logger.info("Scheduled daily workflow run complete: {}", stats)

    # ── M3: Monitoring/alerting on workflow failures ──
    # Permanent failures (likely bugs) are escalated to a CRITICAL log so
    # log aggregators can fire ops alerts. Spikes in transient failures
    # (DB timeouts, race losses) are reported as warnings — they're usually
    # infra issues but shouldn't page on-call unless they dominate.
    seen = stats["users_seen"]
    permanent = stats["failed_permanent"]
    transient = stats["failed_transient"]

    if permanent > 0:
        logger.critical(
            "ALWRITY_DAILY_WORKFLOW_PERMANENT_FAILURES: {} permanent failures "
            "out of {} users in this run; this likely indicates a code bug. "
            "Stats: {}",
            permanent, seen, stats,
        )

    if seen > 0 and (transient + permanent) / seen >= 0.5:
        logger.critical(
            "ALWRITY_DAILY_WORKFLOW_HIGH_FAILURE_RATE: {} of {} users failed "
            "({} transient, {} permanent). Stats: {}",
            transient + permanent, seen, transient, permanent, stats,
        )
    elif transient > 0:
        logger.warning(
            "ALWRITY_DAILY_WORKFLOW_TRANSIENT_FAILURES: {} transient failures "
            "out of {} users. Stats: {}",
            transient, seen, stats,
        )

    return stats


__all__ = [
    "DAILY_WORKFLOW_PER_USER_TIMEOUT_SEC",
    "DAILY_WORKFLOW_MAX_CONCURRENCY",
    "generate_scheduled_daily_workflows",
]
