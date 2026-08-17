"""YouTube Studio ops: channel videos, playlists, stale refresh, community/gaps."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_studio_ops_service import YouTubeStudioOpsService
from .oauth_router import get_oauth_service

router = APIRouter(prefix="/studio", tags=["youtube-studio-ops"])


class PlaylistAddRequest(BaseModel):
    playlist_id: str
    video_id: str
    token_id: Optional[int] = None


class StaleRefreshRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ""
    tags: List[str] = Field(default_factory=list)
    niche: Optional[str] = None


class UpdateMetadataRequest(BaseModel):
    video_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    token_id: Optional[int] = None


class CommunityIdeasRequest(BaseModel):
    niche: Optional[str] = None
    recent_title: Optional[str] = None


class ContentGapsRequest(BaseModel):
    niche: Optional[str] = None
    recent_titles: List[str] = Field(default_factory=list)


def get_studio_ops(
    oauth_service: YouTubeOAuthService = Depends(get_oauth_service),
) -> YouTubeStudioOpsService:
    return YouTubeStudioOpsService(oauth_service)


@router.get("/videos")
def list_channel_videos(
    max_results: int = Query(15, ge=1, le=50),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.list_channel_videos(user_id, token_id=token_id, max_results=max_results)


@router.get("/playlists")
def list_playlists(
    max_results: int = Query(25, ge=1, le=50),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.list_playlists(user_id, token_id=token_id, max_results=max_results)


@router.post("/playlists/add")
def add_to_playlist(
    body: PlaylistAddRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.add_video_to_playlist(
        user_id,
        playlist_id=body.playlist_id,
        video_id=body.video_id,
        token_id=body.token_id,
    )


@router.post("/stale-refresh/suggest")
def suggest_stale_refresh(
    body: StaleRefreshRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return service.suggest_stale_refresh(
            user_id,
            title=body.title,
            description=body.description,
            tags=body.tags,
            niche=body.niche,
        )
    except Exception as e:
        logger.error(f"stale refresh route error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/videos/update-metadata")
def update_video_metadata(
    body: UpdateMetadataRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.update_video_metadata(
        user_id,
        video_id=body.video_id,
        title=body.title,
        description=body.description,
        tags=body.tags,
        token_id=body.token_id,
    )


@router.post("/community-ideas")
def community_post_ideas(
    body: CommunityIdeasRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.community_post_ideas(
        user_id, niche=body.niche, recent_title=body.recent_title
    )


@router.post("/content-gaps")
def content_gap_ideas(
    body: ContentGapsRequest,
    user: dict = Depends(get_current_user),
    service: YouTubeStudioOpsService = Depends(get_studio_ops),
):
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return service.content_gap_ideas(
        user_id, niche=body.niche, recent_titles=body.recent_titles
    )
