"""Email preferences endpoints for ALwrity onboarding sessions.

Reads and updates `contact_email`, `email_digest_opt_in`, and `timezone` on the
user's onboarding session so the header Email Preferences modal and onboarding
Step 1 share one source of truth.
"""

from typing import Dict, Any
from loguru import logger
from fastapi import HTTPException


def _user_id(current_user: Dict[str, Any]) -> str:
    return str(current_user.get('clerk_user_id') or current_user.get('id'))


def get_email_preferences(current_user: Dict[str, Any]) -> Dict[str, Any]:
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        from services.database.sessions import get_session_for_user

        svc = StepManagementService()
        db = get_session_for_user(_user_id(current_user))
        if not db:
            raise HTTPException(status_code=503, detail="Database temporarily unavailable")
        try:
            session = svc._get_or_create_session(_user_id(current_user), db)
            return {
                "email": session.contact_email or current_user.get('email') or "",
                "email_digest_opt_in": bool(session.email_digest_opt_in),
                "timezone": session.timezone or "UTC",
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting email preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


def update_email_preferences(
    current_user: Dict[str, Any], payload: Dict[str, Any]
) -> Dict[str, Any]:
    try:
        from api.onboarding_utils.step_management_service import StepManagementService
        from services.database.sessions import get_session_for_user

        svc = StepManagementService()
        db = get_session_for_user(_user_id(current_user))
        if not db:
            raise HTTPException(status_code=503, detail="Database temporarily unavailable")
        try:
            session = svc._get_or_create_session(_user_id(current_user), db)

            email = payload.get('email')
            if email is not None:
                session.contact_email = str(email) or None

            timezone = payload.get('timezone')
            if timezone is not None:
                session.timezone = str(timezone)

            opt_in = payload.get('email_digest_opt_in')
            if opt_in is not None:
                session.email_digest_opt_in = bool(opt_in)

            db.commit()
            return {
                "email": session.contact_email or current_user.get('email') or "",
                "email_digest_opt_in": bool(session.email_digest_opt_in),
                "timezone": session.timezone or "UTC",
            }
        finally:
            db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating email preferences: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


__all__ = [name for name in globals().keys() if not name.startswith('_')]