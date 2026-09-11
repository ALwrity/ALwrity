"""SIF x Strategy integration — Phase 5: startup backfill + hardening.

Strategies activated BEFORE the SIF x Strategy feature shipped were never
embedded (activating a strategy is what triggers indexing). This module
closes that gap at server startup without re-running the activation flow.

The pass is:

- **Non-blocking & best-effort**: runs from the startup event, never blocks
  server readiness, and per-user failures are logged + counted — one bad
  user cannot fail the pass.
- **Flag-gated**: a no-op when ``strategy_sif_indexing_enabled()`` is
  False (same Phase SIF-B feature flag the activation hook honors).
- **Same dispatch path**: each catch-up user reuses
  ``dispatch_activation_indexing``, so the VFS markdown mirror, the
  ``pending`` lifecycle row and the fire-and-forget async embed are
  identical to a real activation.

The module also owns the shared "is this strategy indexed?" predicate
(``strategy_is_indexed``) — a watermark-existence query that the backfill
skip-logic relies on.

Observability: every per-user outcome is metered via
``sif_strategy_backfill_total{outcome=dispatched|already_indexed|
no_active_strategy|error}``, with a per-user
``[sif_event] operation=strategy_backfill`` line at TRACE level (invisible in
both the default and verbose console handlers — one line per user would
otherwise flood startup logs) and an aggregated INFO tree summary
in ``run_startup_backfill``. The indexer's existing retry/backoff also meters
every non-final attempt via ``sif_strategy_index_retry_total{outcome=retry}``
(connectivity backoff is thus visible to operators).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from loguru import logger

from models.enhanced_strategy_models import EnhancedContentStrategy
from models.sif_indexing_watermark import SIFIndexingWatermark

from .sif_strategy_source_ids import active_strategy_source_id
from .strategy_sif_status import query_active_activation


def active_strategy_for_user(db, user_id: str) -> Optional[Dict[str, Any]]:
    """Return the active strategy snapshot for a user, or ``None``.

    Mirrors the ``GET /strategy/current`` SSOT query: the latest
    ``activation_date`` row with status ``'active'`` joined to its strategy
    record (see ``strategy_wizard_endpoints.py``). Keys: ``strategy`` (the
    ``to_dict()`` snapshot the indexer consumes) and ``activated_at``
    (ISO-8601 string or ``None``). ``None`` when there is no active
    activation row or the strategy record is missing. The activation row is
    resolved by both the numeric uid and the raw (Clerk) string ``user_id``,
    so string-id users (whose rows store the raw Clerk id) resolve too.
    """
    active = query_active_activation(db, user_id)
    if not active:
        return None

    strategy = (
        db.query(EnhancedContentStrategy)
        .filter(EnhancedContentStrategy.id == active.strategy_id)
        .first()
    )
    if not strategy:
        return None

    return {
        "strategy": strategy.to_dict(),
        "activated_at": (
            active.activation_date.isoformat() if active.activation_date else None
        ),
    }


def strategy_is_indexed(db, user_id: str) -> bool:
    """True iff a watermark row already exists for this user's active-strategy
    source.

    Existence (not hash match) is the signal here — a row means the active
    strategy has been embedded at least once. Backfill uses this to skip
    users who already embedded post-feature. DB errors degrade to False so
    the safer action (dispatch) is taken.
    """
    return bool(
        SIFIndexingWatermark.get_indexed_source_ids(
            db, user_id, {active_strategy_source_id(user_id)}
        )
    )


def _meter_backfill(user_id: str, outcome: str) -> None:
    from .sif_metrics import inc_counter, log_sif_event

    inc_counter("sif_strategy_backfill_total", outcome, value=1)
    # Per-user detail is deliberately TRACE: the pass is one line per user,
    # so anything above TRACE floods startup logs on a many-workspace fleet.
    # The INFO tree summary in ``run_startup_backfill`` aggregates the pass.
    log_sif_event(
        "strategy_backfill", user_id=user_id, outcome=outcome, level="trace"
    )


def dispatch_strategy_backfill(limit: Optional[int] = None) -> Dict[str, Any]:
    """Enumerate users and dispatch the post-activation pipeline for every
    active strategy that was never embedded.

    Returns a JSON-serializable report::

        {
            "disabled": bool,        # True when the feature flag is off
            "scanned": int,          # users examined (limit-capped)
            "dispatched": int,       # backfill embeds queued
            "already_indexed": int,  # active strategy already watermarked
            "no_active_strategy": int,
            "errors": int,           # per-user best-effort failures
        }

    Non-blocking: never raises; per-user failures are logged, metered and
    counted. When indexing is dispatched, the session is intentionally left
    open — the fire-and-forget task writes the lifecycle/watermark rows
    through it (the request-path dispatch relies on the same session
    ownership).
    """
    from services.database.sessions import get_all_user_ids, get_session_for_user
    from services.intelligence.strategy_indexer import strategy_sif_indexing_enabled
    from services.intelligence.strategy_vfs_companion import dispatch_activation_indexing

    if not strategy_sif_indexing_enabled():
        logger.info("SIF x Strategy backfill skipped (feature disabled)")
        return {
            "disabled": True, "scanned": 0, "dispatched": 0,
            "already_indexed": 0, "no_active_strategy": 0, "errors": 0,
        }

    report: Dict[str, Any] = {
        "disabled": False, "scanned": 0, "dispatched": 0,
        "already_indexed": 0, "no_active_strategy": 0, "errors": 0,
    }

    try:
        user_ids: List[str] = get_all_user_ids()
    except Exception as exc:
        logger.warning(f"SIF x Strategy backfill user discovery failed: {exc}")
        report["errors"] += 1
        return report

    if limit is not None:
        user_ids = user_ids[:limit]

    for user_id in user_ids:
        report["scanned"] += 1
        db = None
        try:
            db = get_session_for_user(user_id)
            if db is None:
                raise RuntimeError(f"no database session for user {user_id}")

            snapshot = active_strategy_for_user(db, user_id)
            if snapshot is None:
                report["no_active_strategy"] += 1
                _meter_backfill(user_id, "no_active_strategy")
                continue

            if strategy_is_indexed(db, user_id):
                report["already_indexed"] += 1
                _meter_backfill(user_id, "already_indexed")
                continue

            task = dispatch_activation_indexing(
                db, user_id, snapshot["strategy"], snapshot["activated_at"]
            )
            report["dispatched"] += 1
            _meter_backfill(user_id, "dispatched")
            if task is not None:
                # Session ownership handed to the fire-and-forget task.
                db = None
        except Exception as exc:
            logger.warning(f"SIF x Strategy backfill failed for user {user_id}: {exc}")
            report["errors"] += 1
            _meter_backfill(user_id, "error")
        finally:
            if db is not None:
                try:
                    db.close()
                except Exception:
                    pass

    return report


def run_startup_backfill() -> None:
    """Startup hook entry point: run the catch-up pass best-effort.

    Never raises: any dispatch-level failure is logged and swallowed so a
    backfill problem can never prevent the server from starting.
    """
    try:
        report = dispatch_strategy_backfill()
    except Exception as exc:
        logger.warning(f"[STARTUP] Strategy SIF backfill skipped: {exc}")
        return

    if report.get("disabled"):
        logger.info("[STARTUP] Strategy SIF backfill skipped (feature disabled)")
        return

    logger.info(
        "[STARTUP] Strategy SIF backfill complete:\n"
        f"   \u251c\u2500 Users Scanned:      {report.get('scanned', 0)}\n"
        f"   \u251c\u2500 Dispatched:         {report.get('dispatched', 0)}\n"
        f"   \u251c\u2500 Already Indexed:    {report.get('already_indexed', 0)}\n"
        f"   \u251c\u2500 No Active Strategy: {report.get('no_active_strategy', 0)}\n"
        f"   \u2514\u2500 Errors:             {report.get('errors', 0)}"
    )