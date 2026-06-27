from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

from services.database import get_session_for_user
from middleware.auth_middleware import get_current_user
from sqlalchemy import desc
from models.content_strategy_state_models import StrategyWizardState, ActiveStrategy
from models.enhanced_strategy_models import EnhancedContentStrategy
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder

router = APIRouter(tags=["Strategy Wizard"])


def get_db(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get a DB session for the authenticated user."""
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
    """Get the latest strategy for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.user_id == user_id
        ).order_by(desc(EnhancedContentStrategy.created_at)).first()

        if not strategy:
            return ResponseBuilder.create_success_response(
                message="No strategy found",
                data=None
            )

        active = db.query(ActiveStrategy).filter(
            ActiveStrategy.user_id == user_id
        ).first()

        return ResponseBuilder.create_success_response(
            message="Latest strategy retrieved",
            data={
                "strategy": strategy.to_dict(),
                "is_active": active is not None and active.strategy_id == strategy.id,
                "active_strategy_id": active.strategy_id if active else None,
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
    """Activate a strategy for the authenticated user (only one active at a time)."""
    try:
        user_id = str(current_user.get("id"))

        strategy_id = payload.get("strategy_id")
        if not strategy_id:
            raise HTTPException(status_code=400, detail="strategy_id required")

        strategy = db.query(EnhancedContentStrategy).filter(
            EnhancedContentStrategy.id == strategy_id
        ).first()

        if not strategy:
            raise HTTPException(status_code=404, detail="Strategy not found")

        if str(strategy.user_id) != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to activate this strategy")

        existing = db.query(ActiveStrategy).filter(
            ActiveStrategy.user_id == user_id
        ).first()

        if existing:
            existing.strategy_id = strategy_id
            existing.activated_at = datetime.utcnow()
        else:
            existing = ActiveStrategy(user_id=user_id, strategy_id=strategy_id)
            db.add(existing)

        db.commit()
        db.refresh(existing)

        return ResponseBuilder.create_success_response(
            message="Strategy activated",
            data={
                "strategy_id": strategy_id,
                "strategy": strategy.to_dict(),
                "activated_at": existing.activated_at.isoformat() if existing.activated_at else None,
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
    """Get the currently active strategy for the authenticated user."""
    try:
        user_id = str(current_user.get("id"))

        active = db.query(ActiveStrategy).filter(
            ActiveStrategy.user_id == user_id
        ).first()

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
                "activated_at": active.activated_at.isoformat() if active.activated_at else None,
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active strategy: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_active_strategy")
