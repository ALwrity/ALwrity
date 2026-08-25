"""
Shared dependencies for subscription API routes.
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from services.database import get_db
from middleware.auth_middleware import get_current_user


def verify_user_access(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> str:
    """
    Verify that the current user can only access their own data.
    
    Args:
        user_id: The user ID from the route parameter
        current_user: The authenticated user from the token
        
    Returns:
        The verified user_id
        
    Raises:
        HTTPException: If user tries to access another user's data
    """
    if current_user.get('id') != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return user_id


def get_user_id_from_token(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> str:
    """
    Extract user ID from authentication token.
    
    Args:
        current_user: The authenticated user from the token
        
    Returns:
        The user ID as a string
        
    Raises:
        HTTPException: If user is not authenticated
    """
    user_id = str(current_user.get('id', '')) if current_user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return user_id
