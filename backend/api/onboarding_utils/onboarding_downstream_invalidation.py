"""
Invalidate downstream onboarding steps when the website analysis changes.

Clears research, competitor, and persona artifacts while preserving the
Connect Platforms step in an in-progress state until the user clicks Continue.
"""

from typing import Any, Dict, Optional

from fastapi import Body
from loguru import logger
from sqlalchemy.orm import Session

from models.onboarding import (
    CompetitorAnalysis,
    OnboardingSession,
    PersonaData,
    ResearchPreferences,
)
from services.database import get_session_for_user
from services.onboarding.progress_service import OnboardingProgressService


def invalidate_downstream_onboarding_steps(
    user_id: str,
    *,
    website_url: Optional[str] = None,
    reason: str = "website_analysis_changed",
) -> Dict[str, Any]:
    """
    Reset steps 2+ so onboarding must be completed sequentially again.

    Args:
        user_id: Clerk / ALwrity user id.
        website_url: Optional URL for logging only.
        reason: Short audit string for logs.
    """
    db: Session = get_session_for_user(user_id)
    deleted = {"competitors": 0, "research_preferences": 0, "persona_data": 0}

    try:
        session = (
            db.query(OnboardingSession)
            .filter(OnboardingSession.user_id == user_id)
            .order_by(OnboardingSession.updated_at.desc())
            .first()
        )

        if not session:
            logger.info(
                "[onboarding] invalidate_downstream skipped — no session user_id={} reason={}",
                user_id,
                reason,
            )
            return {"success": True, "deleted": deleted, "progress_reset": False}

        deleted["competitors"] = (
            db.query(CompetitorAnalysis)
            .filter(CompetitorAnalysis.session_id == session.id)
            .delete(synchronize_session=False)
        )
        deleted["research_preferences"] = (
            db.query(ResearchPreferences)
            .filter(ResearchPreferences.session_id == session.id)
            .delete(synchronize_session=False)
        )
        deleted["persona_data"] = (
            db.query(PersonaData)
            .filter(PersonaData.session_id == session.id)
            .delete(synchronize_session=False)
        )

        session.current_step = 1
        session.progress = 0.0
        db.commit()

        progress_service = OnboardingProgressService()
        progress_service._cancel_scheduled_tasks(user_id)

        try:
            from services.intelligence.agent_flat_context import AgentFlatContextStore
            import os

            flat_store = AgentFlatContextStore(user_id)
            for filename in (
                AgentFlatContextStore.STEP3_FILENAME,
                AgentFlatContextStore.STEP4_FILENAME,
            ):
                target = flat_store._context_file(filename)
                if target.exists():
                    os.remove(target)
                    logger.info(
                        "[onboarding] invalidate_downstream removed flat context {}",
                        filename,
                    )
        except Exception as flat_err:
            logger.warning(
                "[onboarding] invalidate_downstream flat context cleanup failed user_id={} err={}",
                user_id,
                flat_err,
            )

        logger.info(
            "[onboarding] invalidate_downstream user_id={} website_url={} reason={} deleted={}",
            user_id,
            website_url or "",
            reason,
            deleted,
        )

        return {
            "success": True,
            "deleted": deleted,
            "progress_reset": True,
            "current_step": 1,
            "completion_percentage": 0,
        }
    except Exception as exc:
        db.rollback()
        logger.error(
            "[onboarding] invalidate_downstream failed user_id={} reason={} error={}",
            user_id,
            reason,
            exc,
        )
        raise
    finally:
        db.close()


async def invalidate_downstream_onboarding(
    current_user: Dict[str, Any],
    payload: Optional[Dict[str, Any]] = Body(default=None),
) -> Dict[str, Any]:
    """FastAPI handler wrapper."""
    user_id = str(current_user.get("clerk_user_id") or current_user.get("id"))
    if not user_id:
        raise ValueError("User not authenticated")

    body = payload or {}
    website_url = (body.get("website_url") or body.get("website") or "").strip() or None
    reason = (body.get("reason") or "website_analysis_changed").strip()

    result = invalidate_downstream_onboarding_steps(
        user_id,
        website_url=website_url,
        reason=reason,
    )
    return {
        "message": "Downstream onboarding steps invalidated",
        "user_id": user_id,
        **result,
    }
