"""
Database sessions for subscription plan catalog reads.

Supports unauthenticated GET /plans by serving from a seeded catalog workspace.
Authenticated requests use the caller's workspace DB (same plan SSOT via init).
"""

from __future__ import annotations

from typing import Any, Dict, Generator, Optional

from fastapi import Depends, HTTPException
from loguru import logger
from sqlalchemy.orm import Session, sessionmaker

from middleware.auth_middleware import get_optional_user
from services.database.engine import get_engine_for_user

CATALOG_USER_ID = "_subscription_catalog"
LOG_PREFIX = "[SubscriptionPlansDB]"


def _open_session(user_id: str) -> Optional[Session]:
    engine = get_engine_for_user(user_id)
    if not engine:
        return None
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def _ensure_user_db(user_id: str) -> None:
    from services.database.init_db import init_user_database

    try:
        init_user_database(user_id)
    except Exception as exc:
        logger.warning(f"{LOG_PREFIX} init failed user_id={user_id}: {exc}")


def get_catalog_db() -> Generator[Session, None, None]:
    """Yield a DB session for the shared subscription catalog (no auth)."""
    _ensure_user_db(CATALOG_USER_ID)
    db = _open_session(CATALOG_USER_ID)
    if not db:
        logger.error(f"{LOG_PREFIX} catalog session unavailable")
        raise HTTPException(
            status_code=503,
            detail="Subscription catalog temporarily unavailable",
        )
    try:
        yield db
    finally:
        db.close()


def get_plans_db(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> Generator[Session, None, None]:
    """
    DB for plan listing: authenticated user's workspace, else shared catalog.

    LinkedIn pricing and marketing pages call GET /plans before sign-in.
    """
    if current_user:
        user_id = current_user.get("id") or current_user.get("clerk_user_id")
        if not user_id:
            logger.error(f"{LOG_PREFIX} authenticated request missing user id")
            raise HTTPException(
                status_code=401,
                detail="User ID required for database access",
            )
        _ensure_user_db(user_id)
        db = _open_session(user_id)
        if not db:
            logger.error(f"{LOG_PREFIX} user session unavailable user_id={user_id}")
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable",
            )
        try:
            yield db
        finally:
            db.close()
        return

    logger.debug(f"{LOG_PREFIX} unauthenticated plans request — using catalog DB")
    yield from get_catalog_db()
