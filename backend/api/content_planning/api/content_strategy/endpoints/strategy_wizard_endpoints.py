from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

from services.database import get_session_for_user
from middleware.auth_middleware import get_current_user
from sqlalchemy import desc
from models.content_strategy_state_models import StrategyWizardState
from models.enhanced_strategy_models import EnhancedContentStrategy
from models.monitoring_models import StrategyActivationStatus
from services.intelligence.strategy_sif_status import query_active_activation
from services.intelligence.sif_strategy_source_ids import active_strategy_source_id
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder

router = APIRouter(tags=["Strategy Wizard"])


def get_db(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get a per-user DB session for the authenticated user's workspace."""
    user_id = str(current_user.get("id"))
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        yield db
    finally:
        db.close()


def _as_int_user_id(user_id) -> Optional[int]:
    """Coerce a user id to the numeric shape used by ``strategy_activation_status``.

    Mirrors ``api/onboarding_utils/endpoints_tasks._has_active_strategy``: the
    activation rows store integer user ids; non-numeric ids degrade to None.
    """
    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


@router.get("/wizard/state")
async def get_wizard_state(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get current wizard state for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        state = db.query(StrategyWizardState).filter(
            StrategyWizardState.user_id == user_id
        ).first()

        if not state:
            return ResponseBuilder.create_success_response(
                message="No wizard state found",
                data=None
            )

        return ResponseBuilder.create_success_response(
            message="Wizard state retrieved",
            data=state.to_dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting wizard state: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_wizard_state")


@router.put("/wizard/state")
async def update_wizard_state(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create or update wizard state for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        state = db.query(StrategyWizardState).filter(
            StrategyWizardState.user_id == user_id
        ).first()

        if not state:
            state = StrategyWizardState(user_id=user_id)
            db.add(state)

        if "current_step" in payload:
            state.current_step = int(payload["current_step"])
        if "status" in payload:
            state.status = str(payload["status"])
        if "progress" in payload:
            state.progress = int(payload["progress"])
        if "step_data" in payload:
            existing = state.step_data or {}
            existing.update(payload["step_data"])
            state.step_data = existing

        state.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(state)

        return ResponseBuilder.create_success_response(
            message="Wizard state updated",
            data=state.to_dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating wizard state: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "update_wizard_state")


@router.post("/wizard/complete")
async def complete_wizard(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Mark the wizard as completed for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        state = db.query(StrategyWizardState).filter(
            StrategyWizardState.user_id == user_id
        ).first()

        if not state:
            raise HTTPException(status_code=404, detail="No wizard state found")

        state.status = "completed"
        state.current_step = 4
        state.progress = 100
        state.updated_at = datetime.utcnow()
        db.commit()

        return ResponseBuilder.create_success_response(
            message="Wizard completed",
            data=state.to_dict()
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error completing wizard: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "complete_wizard")


@router.delete("/wizard/state")
async def reset_wizard_state(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Reset (delete) wizard state for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        state = db.query(StrategyWizardState).filter(
            StrategyWizardState.user_id == user_id
        ).first()

        if state:
            db.delete(state)
            db.commit()

        return ResponseBuilder.create_success_response(
            message="Wizard state reset",
            data=None
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting wizard state: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "reset_wizard_state")


@router.get("/strategy/latest")
async def get_latest_strategy(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the latest strategy and its activation status for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))
        uid = _as_int_user_id(user_id)

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.user_id == user_id
        ).order_by(desc(EnhancedContentStrategy.created_at)).first()

        if not strategy:
            return ResponseBuilder.create_success_response(
                message="No strategy found",
                data=None
            )

        active_strategy_id = None
        active = query_active_activation(db, user_id, uid)
        if active is not None:
            active_strategy_id = active.strategy_id

        return ResponseBuilder.create_success_response(
            message="Latest strategy retrieved",
            data={
                "strategy": strategy.to_dict(),
                "is_active": active_strategy_id is not None and active_strategy_id == strategy.id,
                "active_strategy_id": active_strategy_id,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latest strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_latest_strategy")


@router.post("/strategy/activate")
async def activate_strategy(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Activate a strategy by writing the single source of truth
    (``strategy_activation_status``, status ``'active'``).

    Idempotent: re-activating an already-active strategy only refreshes
    ``last_updated``. Follows the existing additive semantics used by
    ``strategy_service.activate_strategy`` — the current active strategy is the
    one with the latest ``activation_date`` (as read by ``ActiveStrategyService``
    and onboarding's ``_has_active_strategy``).
    """
    try:
        user_id = str(current_user.get("id"))

        strategy_id = payload.get("strategy_id")
        if not strategy_id:
            raise HTTPException(status_code=400, detail="strategy_id required")

        uid = _as_int_user_id(user_id)
        if uid is None:
            raise HTTPException(status_code=400, detail="User ID must be numeric for strategy activation")

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()

        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")

        if str(strategy.user_id) != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to activate this strategy")

        now = datetime.utcnow()
        existing = db.query(StrategyActivationStatus).filter(
            StrategyActivationStatus.user_id == uid,
            StrategyActivationStatus.strategy_id == strategy_id,
        ).first()

        if not existing:
            existing = StrategyActivationStatus(
                user_id=uid,
                strategy_id=strategy_id,
                activation_date=now,
                status="active",
                last_updated=now,
            )
            db.add(existing)
        elif existing.status != "active":
            existing.status = "active"
            existing.activation_date = now
            existing.last_updated = now
        else:
            existing.last_updated = now

        db.commit()
        db.refresh(existing)

        try:
            from services.active_strategy_service import ActiveStrategyService
            await ActiveStrategyService(db_session=db).clear_cache(uid)
        except Exception as cache_error:
            logger.debug(f"Could not clear active strategy cache: {cache_error}")

        # SIF x Strategy (non-blocking): mirror active.md to the VFS and
        # schedule txtai embedding. Fire-and-forget — must never fail
        # activation; the write + task dispatch each swallow their errors.
        # ``existing.activation_date`` is preserved on re-activation of an
        # already-active strategy (keeps the source hash stable → the
        # watermark skips a no-op re-embed); fall back to ``now`` only when
        # the row has no timestamp yet.
        try:
            from services.intelligence.strategy_vfs_companion import dispatch_activation_indexing
            dispatch_activation_indexing(
                db,
                user_id,
                strategy.to_dict(),
                existing.activation_date if existing.activation_date is not None else now,
            )
        except Exception as sif_error:
            logger.debug(f"Could not dispatch SIF strategy indexing: {sif_error}")

        return ResponseBuilder.create_success_response(
            message="Strategy activated",
            data={
                "strategy_id": strategy_id,
                "strategy": strategy.to_dict(),
                "activated_at": existing.activation_date.isoformat() if existing.activation_date else None,
                "status": existing.status,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error activating strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "activate_strategy")


@router.get("/strategy/active")
async def get_active_strategy(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get the currently active strategy (latest ``activation_date``, status
    ``'active'``) for the authenticated user — read from the same SSOT rows."""
    try:
        user_id = str(current_user.get("id"))
        uid = _as_int_user_id(user_id)

        active = query_active_activation(db, user_id, uid)

        if not active:
            return ResponseBuilder.create_success_response(
                message="No active strategy",
                data=None
            )

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == active.strategy_id
        ).first()

        if not strategy:
            return ResponseBuilder.create_success_response(
                message="Active strategy record exists but strategy data not found",
                data=None
            )

        return ResponseBuilder.create_success_response(
            message="Active strategy retrieved",
            data={
                "strategy": strategy.to_dict(),
                "activated_at": active.activation_date.isoformat() if active.activation_date else None,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_active_strategy")


@router.get("/strategy/sif-status")
async def get_strategy_sif_status(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Read-only semantic-index status for the active content strategy.

    Tells the UI what happened to the SIF embedding for the active
    strategy: the durable ``strategy_sif_index_status`` lifecycle
    (pending / running / success / skipped / failed), the successful-embed
    watermark, whether the VFS mirror ``strategy/active.md`` exists, and
    the 8 canonical document kinds. Never writes and never loads txtai —
    safe to poll while indexing runs.
    """
    try:
        user_id = str(current_user.get("id"))
        uid = _as_int_user_id(user_id)

        from services.intelligence.strategy_sif_status import (
            build_strategy_sif_status_payload,
        )

        data = build_strategy_sif_status_payload(db, user_id, uid)
        return ResponseBuilder.create_success_response(
            message="Strategy SIF status retrieved",
            data=data
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error retrieving strategy SIF status: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_strategy_sif_status")


STRATEGY_KIND_LABELS: Dict[str, str] = {
    "form_summary": "Strategy summary",
    "base_strategy": "Base strategy",
    "strategic_insights": "Strategic insights",
    "competitive_analysis": "Competitive analysis",
    "performance_predictions": "Performance predictions",
    "implementation_roadmap": "Implementation roadmap",
    "risk_assessment": "Risk assessment",
    "user_persona_digest": "User persona",
}


@router.get("/strategy/sif-search")
async def search_strategy_sif(
    query: str = "",
    limit: int = 4,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Semantic search over ONLY the active strategy's SIF documents.

    Mirrors the onboarding white-box search (``/api/onboarding/sif/search``)
    but scoped to the strategy contract: hits are filtered to the active
    strategy's document ids (``user:{uid}:strategy_active:current:*``) and
    labeled with the 8 canonical kinds. The Semantic Dashboard's preset
    questions call this so an end user can prove "SIF x Content strategy is
    working" by clicking a query and reading the matching strategy passage.
    """
    try:
        user_id = str(current_user.get("id"))
        source_id = active_strategy_source_id(user_id)
        prefix = f"{source_id}:"

        from services.intelligence.txtai_service import TxtaiIntelligenceService

        svc = TxtaiIntelligenceService(user_id)
        raw = await svc.search(query, limit=max(limit * 4, 12))

        hits: list = []
        for result in raw or []:
            if isinstance(result, dict):
                doc_id = result.get("id")
                score = result.get("score") or 0
                text = result.get("text") or ""
            elif isinstance(result, (list, tuple)):
                doc_id = result[0] if len(result) > 0 else None
                score = result[1] if len(result) > 1 else 0
                text = ""
            else:
                continue
            doc_id = str(doc_id) if doc_id is not None else ""
            if not doc_id.startswith(prefix):
                continue
            # txtai search returns id + score only; enrich with the stored
            # document text so the caller can render a meaningful answer.
            if not text or text == doc_id:
                try:
                    text = svc.get_document_text(doc_id)
                except Exception:
                    text = ""
            kind = doc_id.rsplit(":", 1)[-1]
            hits.append({
                "id": doc_id,
                "kind": kind,
                "kind_label": STRATEGY_KIND_LABELS.get(kind, kind),
                "score": score,
                "text": text,
            })

        hits.sort(key=lambda hit: hit["score"], reverse=True)
        return ResponseBuilder.create_success_response(
            message="Strategy SIF search completed",
            data={"query": query, "source_id": source_id, "hits": hits[:limit]},
        )

    except Exception as e:
        logger.error(f"Error searching strategy SIF: {str(e)}")
        return ResponseBuilder.create_success_response(
            message="Strategy SIF search failed",
            data={"query": query, "hits": [], "error": str(e)},
        )