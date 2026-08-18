"""YouTube Analytics / Channel Pulse API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_analytics_service import YouTubeAnalyticsService
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from .oauth_router import get_oauth_service

router = APIRouter(prefix="/analytics", tags=["youtube-analytics"])


def get_analytics_service(
    oauth_service: YouTubeOAuthService = Depends(get_oauth_service),
) -> YouTubeAnalyticsService:
    return YouTubeAnalyticsService(oauth_service)


@router.get("/pulse")
def get_channel_pulse(
    days: int = Query(28, ge=1, le=90),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeAnalyticsService = Depends(get_analytics_service),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.get_channel_pulse(user_id, token_id=token_id, days=days)
    except Exception as e:
        logger.error(f"YouTube analytics pulse route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/retention")
def get_retention_summary(
    days: int = Query(28, ge=1, le=90),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeAnalyticsService = Depends(get_analytics_service),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.get_retention_summary(user_id, token_id=token_id, days=days)
    except Exception as e:
        logger.error(f"YouTube retention route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
