"""
Background scheduler for Exa Monitor polling.

Periodically iterates over all users with active watchdog monitors,
triggers runs, and polls for new results. Runs on a configurable
interval (default 6 hours).
"""

import asyncio
import os
from datetime import datetime
from loguru import logger

from services.database import get_all_user_ids
from services.linkedin.watchdog_service import watchdog_service


POLL_INTERVAL_HOURS = int(os.getenv("WATCHDOG_POLL_INTERVAL_HOURS", "6"))


_watchdog_poller_task: asyncio.Task = None


async def _poll_all_users():
    """Iterate over all users and poll watchdog monitor results."""
    try:
        user_ids = get_all_user_ids()
        if not user_ids:
            logger.debug("[WatchdogPoller] No users found, skipping poll cycle")
            return

        total_updates = 0
        for uid in user_ids:
            try:
                updates = await watchdog_service.poll_monitor_results(uid)
                total_updates += len(updates)
            except Exception as e:
                logger.warning(f"[WatchdogPoller] Poll failed for user {uid}: {e}")

        logger.info(f"[WatchdogPoller] Cycle complete: {total_updates} new updates across {len(user_ids)} users")
    except Exception as e:
        logger.error(f"[WatchdogPoller] Cycle failed: {e}")


async def _poller_loop():
    """Background loop that polls monitors on an interval."""
    logger.info(f"[WatchdogPoller] Starting background poller (interval={POLL_INTERVAL_HOURS}h)")
    while True:
        try:
            await asyncio.sleep(POLL_INTERVAL_HOURS * 3600)
            await _poll_all_users()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[WatchdogPoller] Unexpected error in poller loop: {e}")


async def start_watchdog_poller():
    """Start the background poller as an asyncio task."""
    global _watchdog_poller_task
    if _watchdog_poller_task is not None and not _watchdog_poller_task.done():
        logger.debug("[WatchdogPoller] Already running")
        return
    _watchdog_poller_task = asyncio.create_task(_poller_loop())
    logger.info("[WatchdogPoller] Background poller started")


async def stop_watchdog_poller():
    """Stop the background poller."""
    global _watchdog_poller_task
    if _watchdog_poller_task is None or _watchdog_poller_task.done():
        return
    _watchdog_poller_task.cancel()
    try:
        await _watchdog_poller_task
    except asyncio.CancelledError:
        pass
    _watchdog_poller_task = None
    logger.info("[WatchdogPoller] Background poller stopped")
