"""
Autofill snapshot persistence.

The Create-Strategy builder used to re-issue POST /autofill/generate on every
mount — a fresh (expensive, ~45-165s) LLM run per page refresh. The fix is a
cache-first contract:

    persistence:   save_autofill_snapshot(db, user_id, payload)
    fetch:         get_autofill_snapshot(db, user_id)

The snapshot lives in the user's existing StrategyWizardState row
(step_data['autofill'] = {payload, generated_at}) — no new tables, merges with
whatever wizard step data is already there.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from loguru import logger
from sqlalchemy.orm import Session

from models.content_strategy_state_models import StrategyWizardState


def save_autofill_snapshot(db: Any, user_id: str, payload: Dict[str, Any]) -> None:
    """Persist/overwrite `step_data['autofill']` on the user's wizard state row."""
    state = db.query(StrategyWizardState).filter(
        StrategyWizardState.user_id == user_id
    ).first()

    if not state:
        state = StrategyWizardState(user_id=user_id)

    step_data = dict(state.step_data or {})
    step_data["autofill"] = {
        "payload": payload,
        "generated_at": datetime.utcnow().isoformat(),
    }
    state.step_data = step_data
    db.add(state)
    db.commit()

    logger.info(f"💾 Autofill snapshot persisted for user {user_id}")


def get_autofill_snapshot(db: Any, user_id: Optional[str]) -> Dict[str, Any] | None:
    """Return {payload, meta-fields, generated_at} or None when absent."""
    if not user_id:
        return None

    state = db.query(StrategyWizardState).filter(
        StrategyWizardState.user_id == user_id
    ).first()

    if not state:
        return None

    autofill = (state.step_data or {}).get("autofill") if isinstance(state.step_data, dict) else None
    if not isinstance(autofill, dict) or not autofill.get("payload"):
        return None

    snapshot = dict(autofill)
    snapshot.setdefault("generated_at", (
        state.updated_at.isoformat() if state.updated_at else None
    ))
    return snapshot
