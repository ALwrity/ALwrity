"""Shared YouTube API auth helpers."""

from typing import Any, Dict

from fastapi import HTTPException


def require_authenticated_user(current_user: Dict[str, Any]) -> str:
    """Extract and validate user ID from current user."""
    user_id = current_user.get("id") if current_user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(user_id)
