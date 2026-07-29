"""
LinkedIn Today's Workflow — Batch Processing
=============================================

Public API:
    - generate_scheduled_linkedin_workflows: cron entry point (3:00 UTC)

Internal:
    - LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC / LINKEDIN_WORKFLOW_MAX_CONCURRENCY
    - _classify_workflow_error / _merge_stats
    - _process_one_user / _process_one_user_bounded
"""

import asyncio
import os
from typing import Any, Dict

from sqlalchemy.exc import IntegrityError, OperationalError, DBAPIError
from loguru import logger

from services.database import get_all_user_ids
from services.linkedin_today_workflow_service import LinkedInTodayWorkflowService


LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC = int(
    os.getenv("LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC", "45")
)
LINKEDIN_WORKFLOW_MAX_CONCURRENCY = int(
    os.getenv("LINKEDIN_WORKFLOW_MAX_CONCURRENCY", "5")
)


def _classify_workflow_error(exc: BaseException) -> str:
    """Return 'transient' for errors likely to succeed on retry, 'permanent' otherwise."""
    if isinstance(exc, (OperationalError, DBAPIError)):
        return "transient"

    if isinstance(exc, (asyncio.TimeoutError, ConnectionError, TimeoutError)):
        return "transient"

    if isinstance(exc, IntegrityError):
        return "transient"

    return "permanent"


async def _process_one_user(user_id: str) -> Dict[str, int]:
    """Process a single user in the LinkedIn workflow run.

    Returns a stats delta so the caller can aggregate results across users.
    This function never raises — all exceptions are caught and classified here.
    """
    delta = {
        "users_seen": 1,
        "created": 0,
        "existing": 0,
        "failed": 0,
        "failed_transient": 0,
        "failed_permanent": 0,
    }
    try:
        svc = LinkedInTodayWorkflowService(user_id)
        plan, created = await svc.get_or_create_plan(source="scheduled")
        if created:
            delta["created"] += 1
            logger.info(
                "Scheduled LinkedIn workflow created for user {} date {}",
                user_id, plan.date,
            )
        else:
            delta["existing"] += 1
            logger.info(
                "Scheduled LinkedIn workflow already exists for user {} date {}",
                user_id, plan.date,
            )
        return delta
    except Exception as e:
        kind = _classify_workflow_error(e)
        delta["failed"] += 1
        delta[f"failed_{kind}"] += 1
        logger.error(
            "Scheduled LinkedIn workflow generation failed for user {} ({}): {}",
            user_id, kind, e,
        )
        return delta


async def _process_one_user_bounded(
    user_id: str, sem: asyncio.Semaphore
) -> Dict[str, int]:
    """Wrap _process_one_user with a per-user timeout + concurrency cap."""
    async with sem:
        try:
            return await asyncio.wait_for(
                _process_one_user(user_id),
                timeout=LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.error(
                "LinkedIn workflow for user {} exceeded {}s timeout — "
                "counted as transient failure",
                user_id, LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC,
            )
            return {
                "users_seen": 1,
                "created": 0,
                "existing": 0,
                "failed": 1,
                "failed_transient": 1,
                "failed_permanent": 0,
            }
        except Exception as e:
            kind = _classify_workflow_error(e)
            logger.error(
                "Unhandled error in bounded LinkedIn workflow for user {} ({}): {}",
                user_id, kind, e,
            )
            return {
                "users_seen": 1,
                "created": 0,
                "existing": 0,
                "failed": 1,
                "failed_transient": 1 if kind == "transient" else 0,
                "failed_permanent": 1 if kind == "permanent" else 0,
            }


def _merge_stats(target: Dict[str, int], delta: Dict[str, int]) -> None:
    """Add counts from *delta* into *target* in place."""
    for key, value in delta.items():
        target[key] = target.get(key, 0) + value


async def generate_scheduled_linkedin_workflows() -> Dict[str, int]:
    user_ids = get_all_user_ids()
    stats = {
        "users_seen": 0,
        "created": 0,
        "existing": 0,
        "failed": 0,
        "failed_transient": 0,
        "failed_permanent": 0,
    }

    if not user_ids:
        logger.info("Scheduled LinkedIn workflow run: no users to process")
        return stats

    sem = asyncio.Semaphore(LINKEDIN_WORKFLOW_MAX_CONCURRENCY)
    logger.info(
        "Scheduled LinkedIn workflow run starting: {} users, concurrency={}, "
        "per_user_timeout={}s",
        len(user_ids), LINKEDIN_WORKFLOW_MAX_CONCURRENCY,
        LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC,
    )

    coros = [_process_one_user_bounded(uid, sem) for uid in user_ids]
    results = await asyncio.gather(*coros, return_exceptions=True)

    for r in results:
        if isinstance(r, Exception):
            logger.error(
                "Unexpected exception from bounded LinkedIn user task: {}", r
            )
            stats["users_seen"] += 1
            stats["failed"] += 1
            stats["failed_permanent"] += 1
            continue
        _merge_stats(stats, r)

    logger.info("Scheduled LinkedIn workflow run complete: {}", stats)

    seen = stats["users_seen"]
    permanent = stats["failed_permanent"]
    transient = stats["failed_transient"]

    if permanent > 0:
        logger.critical(
            "LINKEDIN_WORKFLOW_PERMANENT_FAILURES: {} permanent failures "
            "out of {} users in this run; this likely indicates a code bug. "
            "Stats: {}",
            permanent, seen, stats,
        )

    if seen > 0 and (transient + permanent) / seen >= 0.5:
        logger.critical(
            "LINKEDIN_WORKFLOW_HIGH_FAILURE_RATE: {} of {} users failed "
            "({} transient, {} permanent). Stats: {}",
            transient + permanent, seen, transient, permanent, stats,
        )
    elif transient > 0:
        logger.warning(
            "LINKEDIN_WORKFLOW_TRANSIENT_FAILURES: {} transient failures "
            "out of {} users. Stats: {}",
            transient, seen, stats,
        )

    return stats


__all__ = [
    "LINKEDIN_WORKFLOW_PER_USER_TIMEOUT_SEC",
    "LINKEDIN_WORKFLOW_MAX_CONCURRENCY",
    "generate_scheduled_linkedin_workflows",
]
