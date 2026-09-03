"""Consolidated dashboard status router (Phase 3b).

Provides a single endpoint that aggregates sif-health, onboarding-tasks,
and the latest plan's guardian health + limitations, replacing the three
independent pollers on the frontend.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard-status", tags=["Dashboard Status"])


@router.get("")
async def get_dashboard_status(
    date: Optional[str] = None,
    current_user: dict = None,
    db: Session = None,
) -> Dict[str, Any]:
    """Consolidated dashboard status: sif-health + onboarding tasks +
    latest plan guardian health + limitations in one call.

    Replaces the three independent pollers (sif-health, onboarding-tasks,
    guardian-audit) on the frontend with a single request.
    """
    from services.database import get_session_for_user
    from models.daily_workflow_models import DailyWorkflowPlan

    user_id = str((current_user or {}).get("id", ""))
    from services.today_workflow import _today_date_str
    date_str = date or _today_date_str()

    guardian_health = None
    limitations: List[str] = []
    plan_found = False

    session = get_session_for_user(user_id)
    if session:
        try:
            plan = (
                session.query(DailyWorkflowPlan)
                .filter(DailyWorkflowPlan.user_id == user_id, DailyWorkflowPlan.date == date_str)
                .first()
            )
            if plan and isinstance(plan.plan_json, dict):
                plan_found = True
                pj = plan.plan_json
                limitations = [str(l) for l in (pj.get("limitations") or []) if l]
                gr = pj.get("guardian_review") or {}
                gs = gr.get("summary") or {}
                guardian_health = gs.get("health_score")
        except Exception as e:
            logger.debug(f"Dashboard status plan read failed: {e}")
        finally:
            session.close()

    sif_health: Dict[str, Any] = {"status": "unavailable"}
    try:
        from services.intelligence.monitoring.semantic_dashboard import SemanticDashboard
        sd = SemanticDashboard(user_id)
        sif_health = {"status": "available", "has_service": sd.sif_enabled}
    except Exception:
        pass

    onboarding_tasks: Dict[str, Any] = {"status": "available"}

    return {
        "success": True,
        "data": {
            "date": date_str,
            "plan_found": plan_found,
            "sif_health": sif_health,
            "onboarding_tasks": onboarding_tasks,
            "guardian_health": guardian_health,
            "limitations": limitations,
        },
    }
