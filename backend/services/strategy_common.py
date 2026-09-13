"""Shared active-strategy resolution (Phase 0).

Single source of truth for "which strategy is active for this user right
now". Used by both ``monitoring_evidence`` (Phase 1) and ``strategy_context``
(Phase 1b) so the active-strategy rule never forks.

Contract:
    - One active strategy per user: ``StrategyActivationStatus.status ==
      'active'``, latest ``activation_date`` wins when duplicated.
    - Never raises for a normal DB row read; returns ``None`` when no
      active strategy exists.
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import desc

from models.monitoring_models import StrategyActivationStatus
from utils.logger_utils import get_service_logger

logger = get_service_logger("strategy_common")


def resolve_active_strategy(db: Any, user_id: str) -> Optional[int]:
    """Return the strategy_id of the user's currently active strategy.

    Args:
        db: SQLAlchemy session (meeting's own session — bounded read).
        user_id: Scoped user id (Clerk string).

    Returns:
        Active strategy id, or ``None`` if the user has none active.
    """
    active = (
        db.query(StrategyActivationStatus)
        .filter(
            StrategyActivationStatus.user_id == user_id,
            StrategyActivationStatus.status == "active",
        )
        .order_by(desc(StrategyActivationStatus.activation_date))
        .first()
    )
    return active.strategy_id if active else None