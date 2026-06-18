"""
Autofill Endpoints
Single endpoint for unified autofill (DB + AI merged).
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from loguru import logger
from datetime import datetime

from services.database import get_db_session
from ....services.content_strategy.autofill.autofill_service import AutoFillService
from middleware.auth_middleware import get_current_user
from ....utils.error_handlers import ContentPlanningErrorHandler
from ....utils.response_builders import ResponseBuilder

router = APIRouter(tags=["Strategy Autofill"])

def get_db():
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()

@router.post("/autofill/generate")
async def generate_autofill(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate autofill payload merging DB sources with AI generation."""
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

        return ResponseBuilder.create_success_response(
            message="Autofill generated successfully",
            data=payload
        )
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

        return ResponseBuilder.create_success_response(
            message="AI fields regenerated successfully",
            data=payload
        )
    except Exception as e:
        logger.error(f"Error regenerating AI fields: {str(e)}")
        raise ContentPlanningErrorHandler.handle_general_error(e, "regenerate_ai")
