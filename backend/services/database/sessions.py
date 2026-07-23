"""FastAPI session dependencies and user discovery helpers."""

from __future__ import annotations

import os
from typing import List, Optional

from fastapi import Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session, sessionmaker

from middleware.auth_middleware import get_current_user
from services.database.engine import get_engine_for_user
from services.database.paths import WORKSPACE_DIR, get_user_db_path


def has_onboarding_session(user_id: str, db: Optional[Session] = None) -> bool:
    """Return True when at least one onboarding session exists for the given user."""
    if not user_id:
        return False

    db_session = db
    close_db = False

    try:
        if db_session is None:
            db_path = get_user_db_path(user_id)
            if not os.path.exists(db_path):
                return False
            db_session = get_session_for_user(user_id)
            close_db = True

        if not db_session:
            return False

        from models.onboarding import OnboardingSession

        onboarding_row = (
            db_session.query(OnboardingSession.id)
            .filter(OnboardingSession.user_id == user_id)
            .first()
        )
        return onboarding_row is not None

    except Exception as e:
        logger.debug(f"Failed onboarding session existence check for user {user_id}: {e}")
        return False
    finally:
        if close_db and db_session:
            try:
                db_session.close()
            except Exception:
                pass


def get_all_user_ids() -> List[str]:
    """
    Discover all user IDs by scanning workspace directories.

    Returns canonical user IDs when discoverable from DB, otherwise workspace IDs.
    """
    user_ids: List[str] = []
    if not os.path.exists(WORKSPACE_DIR):
        return []

    try:
        workspace_ids: List[str] = []
        for item in os.listdir(WORKSPACE_DIR):
            if item.startswith("workspace_") and os.path.isdir(os.path.join(WORKSPACE_DIR, item)):
                workspace_id = item[len("workspace_") :]
                if workspace_id:
                    workspace_ids.append(workspace_id)

        from models.onboarding import OnboardingSession

        for workspace_id in workspace_ids:
            canonical_user_id = workspace_id
            db = None
            try:
                db_path = get_user_db_path(workspace_id)
                if not os.path.exists(db_path):
                    canonical_user_id = workspace_id
                else:
                    db = get_session_for_user(workspace_id)
                    if db:
                        onboarding_row = (
                            db.query(OnboardingSession.user_id)
                            .order_by(OnboardingSession.updated_at.desc())
                            .first()
                        )
                        if onboarding_row and onboarding_row[0]:
                            canonical_user_id = str(onboarding_row[0])
            except Exception as resolve_error:
                logger.debug(
                    f"Could not resolve canonical user_id from DB for workspace {workspace_id}: {resolve_error}"
                )
            finally:
                if db:
                    db.close()

            if canonical_user_id not in user_ids:
                user_ids.append(canonical_user_id)

    except Exception as e:
        logger.error(f"Error discovering user workspaces: {e}")

    return user_ids


def get_db(current_user: dict = Depends(get_current_user)):
    """Database dependency for FastAPI endpoints (authenticated user's DB)."""
    user_id = current_user.get("id") or current_user.get("clerk_user_id")
    if not user_id:
        logger.error("No user ID found in context for DB connection")
        raise HTTPException(status_code=401, detail="User ID required for database access")

    try:
        engine = get_engine_for_user(user_id)
    except Exception as e:
        logger.error(f"[DB] Failed to create engine for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Database temporarily unavailable")

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_session_for_user(user_id: str) -> Optional[Session]:
    """Get a new database session for a specific user (caller must close it)."""
    engine = get_engine_for_user(user_id)
    if not engine:
        return None

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def get_db_session(user_id: Optional[str] = None) -> Optional[Session]:
    """DEPRECATED: Use get_session_for_user(user_id) instead."""
    if user_id:
        return get_session_for_user(user_id)
    return None
