"""
Shared error-logging helpers for API route exception handlers.

Every route's generic ``except Exception`` block should call
``log_route_exception`` so operations can correlate failures across
the LinkedIn subsystem even without a full APM.
"""

from __future__ import annotations

import traceback
from typing import Optional

from loguru import logger


def log_route_exception(
    *,
    route: str,
    user_id: Optional[str] = None,
    exc: Exception,
    extra: Optional[str] = None,
) -> None:
    """
    Log a caught exception in a route handler with structured context.

    Args:
        route: Human-readable route label (e.g. ``"get_linkedin_posts"``).
        user_id: Authenticated user ID when available.
        exc: The caught exception instance.
        extra: Optional additional context string.
    """
    tb = traceback.format_exc()
    exc_name = type(exc).__name__
    msg = f"[{route}] unhandled exception user_id={user_id} type={exc_name} {exc}"
    if extra:
        msg += f" | {extra}"
    logger.opt(exception=False).error(msg)
    logger.opt(depth=1).debug(f"[{route}] traceback:\n{tb}")
