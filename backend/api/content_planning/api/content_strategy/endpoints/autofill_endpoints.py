"""
Autofill Endpoints
Single endpoint for unified autofill (DB + AI merged).
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

from services.database import get_db
from ....services.content_strategy.autofill.autofill_service import AutoFillService
from ....services.content_strategy.autofill.autofill_cache import (
    save_autofill_snapshot,
    get_autofill_snapshot,
)
from middleware.auth_middleware import get_current_user
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder

router = APIRouter(tags=["Strategy Autofill"])

@router.get("/autofill/latest")
async def get_latest_autofill(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Return the persisted autofill snapshot so the builder can hydrate
    WITHOUT re-running the expensive LLM autofill on every page refresh.
    data=None means no snapshot — the client should generate."""
    try:
        if not current_user or not current_user.get('id'):
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user['id'])

        snapshot = get_autofill_snapshot(db, user_id)
        return ResponseBuilder.create_success_response(
            message="Autofill snapshot retrieved" if snapshot else "No autofill snapshot yet",
            data=snapshot,
        )
    except Exception as e:
        logger.error(f"Error fetching latest autofill snapshot: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "get_latest_autofill")

@router.post("/autofill/generate")
async def generate_autofill(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate autofill payload merging DB sources with AI generation.
    Persists the full payload as the user's snapshot for cache-first reloads."""
    try:
        if not current_user or not current_user.get('id'):
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user['id'])
        started = datetime.utcnow()

        service = AutoFillService(db)
        payload = await service.generate(user_id)

        total_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
        meta = payload.get('meta') or {}
        meta.update({'http_total_ms': total_ms, 'http_started_at': started.isoformat()})
        payload['meta'] = meta

        # Persist so the next page load can hydrate without an LLM call.
        if payload.get('fields'):
            save_autofill_snapshot(db, user_id, payload)

        return ResponseBuilder.create_success_response(
            message="Autofill generated successfully",
            data=payload
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating autofill: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "generate_autofill")

@router.post("/autofill/regenerate-ai")
async def regenerate_ai(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Regenerate AI-generated fields, preserving DB-grounded onboarding data."""
    try:
        if not current_user or not current_user.get('id'):
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user['id'])
        started = datetime.utcnow()

        service = AutoFillService(db)
        payload = await service.regenerate_ai_fields(user_id)

        total_ms = int((datetime.utcnow() - started).total_seconds() * 1000)
        meta = payload.get('meta') or {}
        meta.update({'http_total_ms': total_ms, 'http_started_at': started.isoformat()})
        payload['meta'] = meta

        # Manual regeneration also refreshes the persisted snapshot.
        if payload.get('fields'):
            save_autofill_snapshot(db, user_id, payload)

        return ResponseBuilder.create_success_response(
            message="AI fields regenerated successfully",
            data=payload
        )
    except Exception as e:
        logger.error(f"Error regenerating AI fields: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "regenerate_ai")
