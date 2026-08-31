"""YouTube keyword search API (Data API v3 Search.list)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_search_service import YouTubeSearchService
from .oauth_router import get_oauth_service

router = APIRouter(tags=["youtube-search"])


def get_search_service(
    oauth_service: YouTubeOAuthService = Depends(get_oauth_service),
) -> YouTubeSearchService:
    return YouTubeSearchService(oauth_service)


@router.get("/search")
def search_by_keyword(
    q: str = Query(..., min_length=1),
    max_results: int = Query(25, ge=1, le=50),
    page_token: Optional[str] = Query(None),
    token_id: Optional[int] = Query(None),
    user: dict = Depends(get_current_user),
    service: YouTubeSearchService = Depends(get_search_service),
):
    """GET /api/youtube/search — YouTube.Search.list by keyword."""
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        logger.info(
            "YouTube search route user_id={} query_length={} max_results={} "
            "has_page_token={} token_id_set={}",
            user_id,
            len(q.strip()),
            max_results,
            bool(page_token),
            token_id is not None,
        )
        result = service.search_by_keyword(
            user_id,
            q,
            max_results=max_results,
            page_token=page_token,
            token_id=token_id,
        )
        if not result.get("success"):
            logger.warning(
                "YouTube search route unsuccessful user_id={} error_code={}",
                user_id,
                result.get("error_code"),
            )
        else:
            logger.info(
                "YouTube search route complete user_id={} item_count={}",
                user_id,
                len(result.get("items") or []),
            )
        return result
    except Exception as exc:
        logger.exception("YouTube search route error: {}", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
