"""
Task scheduling endpoints for Step 2 — save and load user task preferences.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from middleware.auth_middleware import get_current_user
from services.database import get_session_for_user

from .step2_task_preferences import (
    DEFAULT_TASK_PREFERENCES,
    TASK_DESCRIPTIONS,
    apply_defaults,
    get_task_delay_mins,
)

router = APIRouter(prefix="/api/onboarding/step2", tags=["Onboarding Task Preferences"])


@router.get("/task-preferences")
async def get_task_preferences(
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return task preferences with descriptions for the UI."""
    user_id = str(current_user.get("id", ""))
    db = get_session_for_user(user_id)

    try:
        from models.onboarding import OnboardingSession
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()

        saved_prefs = {}
        if session and session.payload:
            saved_prefs = session.payload.get("task_preferences", {})

        preferences = apply_defaults(saved_prefs)

        # Build enriched response with descriptions
        tasks = {}
        for task_id, prefs in preferences.items():
            tasks[task_id] = {
                **prefs,
                "label": DEFAULT_TASK_PREFERENCES.get(task_id, {}).get("label", task_id),
                "description": TASK_DESCRIPTIONS.get(task_id, ""),
            }

        return {
            "success": True,
            "tasks": tasks,
        }
    finally:
        db.close()


@router.put("/task-preferences")
async def save_task_preferences(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """Save user task preferences for Step 2 background tasks."""
    user_id = str(current_user.get("id", ""))
    task_prefs = request.get("tasks", {})
    db = get_session_for_user(user_id)

    try:
        from models.onboarding import OnboardingSession
        session = db.query(OnboardingSession).filter(
            OnboardingSession.user_id == user_id
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="Onboarding session not found")

        # Store preferences in session payload
        payload = dict(session.payload) if session.payload else {}
        payload["task_preferences"] = task_prefs
        session.payload = payload
        db.commit()

        logger.info(f"[Step2Tasks] Saved preferences for user={user_id}: {list(task_prefs.keys())}")

        return {
            "success": True,
            "message": "Task preferences saved",
            "deferred_count": sum(
                1 for t in task_prefs.values() if not t.get("enabled", True)
            ),
        }
    finally:
        db.close()
