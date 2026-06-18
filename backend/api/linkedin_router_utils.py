"""Shared utilities for LinkedIn FastAPI routers."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from loguru import logger
from sqlalchemy.orm import Session

from services.database import get_db as get_db_dependency
from services.subscription.monitoring_middleware import DatabaseAPIMonitor

_rate_limit_store: Dict[str, list] = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW = 60  # seconds

ERROR_CODES = {
    "VALIDATION": "LINKEDIN_ERR_001",
    "GENERATION_FAILED": "LINKEDIN_ERR_002",
    "RATE_LIMITED": "LINKEDIN_ERR_003",
    "SAVE_FAILED": "LINKEDIN_ERR_004",
    "NOT_FOUND": "LINKEDIN_ERR_404",
}

monitor = DatabaseAPIMonitor()
get_db = get_db_dependency


def error_response(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def check_rate_limit(user_id: str) -> Optional[int]:
    """Returns retry-after seconds if rate limited, None otherwise."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    timestamps = _rate_limit_store[user_id]
    _rate_limit_store[user_id] = [t for t in timestamps if t > window_start]
    if len(_rate_limit_store[user_id]) >= RATE_LIMIT_MAX_REQUESTS:
        return int(_rate_limit_store[user_id][0] + RATE_LIMIT_WINDOW - now)
    _rate_limit_store[user_id].append(now)
    return None


def resolve_linkedin_user_id(
    current_user: Optional[Dict[str, Any]],
    http_request: Request,
) -> str:
    """Resolve authenticated user id from JWT or fallback headers."""
    user_id = None
    if current_user:
        user_id = str(current_user.get("id", "") or current_user.get("sub", ""))
    if not user_id:
        user_id = http_request.headers.get("X-User-ID") or http_request.headers.get("Authorization")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail=error_response(ERROR_CODES["VALIDATION"], "Authentication required"),
        )
    return user_id


def resolve_linkedin_user_id_optional(
    current_user: Optional[Dict[str, Any]],
) -> str:
    """Resolve user id from JWT only; raises 401 if missing."""
    user_id = None
    if current_user:
        user_id = str(current_user.get("id", "") or current_user.get("sub", ""))
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


async def log_api_request(
    request: Request,
    db: Session,
    duration: float,
    status_code: int,
) -> None:
    """Log API request to database for monitoring."""
    try:
        await monitor.add_request(
            db=db,
            path=str(request.url.path),
            method=request.method,
            status_code=status_code,
            duration=duration,
            user_id=request.headers.get("X-User-ID"),
            request_size=len(await request.body()) if request.method == "POST" else 0,
            user_agent=request.headers.get("User-Agent"),
            ip_address=request.client.host if request.client else None,
        )
        db.commit()
    except Exception as exc:
        logger.error("Failed to log API request: {}", exc)
