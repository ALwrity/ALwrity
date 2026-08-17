"""
Pure helpers for deriving user-facing task status.

Kept free of heavy imports so the status mapping can be unit-tested
without pulling in the database/auth/model stack.
"""

from typing import Any, Tuple

FAILED_STATUSES = ("failed", "needs_intervention")


def derive_ui_status(
    raw_status: Any,
    last_executed: Any,
    last_success: Any,
) -> Tuple[str, int]:
    """Derive ``(ui_status, progress_pct)`` for a scheduled task.

    Recurring tasks keep ``status='active'`` so the scheduler re-runs them;
    a successful run (``last_success``) is the reliable user-facing "done"
    signal. Failure states take precedence over a stale ``last_success``.

    Args:
        raw_status: ``task.status`` value (may be None/empty).
        last_executed: ``task.last_executed`` datetime or None.
        last_success: ``task.last_success`` datetime or None.

    Returns:
        ``(ui_status, progress_pct)`` where ``ui_status`` is one of
        ``"pending"``, ``"running"``, ``"completed"``, ``"failed"`` and
        ``progress_pct`` is 0 (pending/failed), 50 (running), or 100
        (completed).
    """
    raw_status = raw_status or ""

    is_failed = raw_status in FAILED_STATUSES
    is_done = raw_status == "completed" or last_success is not None

    if is_failed:
        ui_status = "failed"
    elif is_done:
        ui_status = "completed"
    elif raw_status == "running" or last_executed is not None:
        ui_status = "running"
    else:
        ui_status = "pending"

    progress_pct = (
        100
        if ui_status == "completed"
        else (0 if ui_status in ("pending", "failed") else 50)
    )
    return ui_status, progress_pct
