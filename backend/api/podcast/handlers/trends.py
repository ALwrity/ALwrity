"""
Podcast Trends Handler

Endpoints for fetching Google Trends data relevant to podcast topics.
"""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.research.trends.trends_config import get_trends_total_timeout
from services.research.trends.trends_keyword_utils import normalize_trends_keywords

router = APIRouter(prefix="/trends", tags=["Podcast Trends"])

# Module-level shared instance (singleton pattern)
_trends_service_instance = None
_trends_service_lock = None


def get_trends_service():
    """Get or create shared GoogleTrendsService instance."""
    global _trends_service_instance, _trends_service_lock
    if _trends_service_instance is None:
        try:
            from services.research.trends import GoogleTrendsService
            _trends_service_instance = GoogleTrendsService()
            _trends_service_lock = asyncio.Lock()
            logger.info("[Podcast Trends] Created shared GoogleTrendsService instance")
        except (ImportError, RuntimeError) as e:
            logger.error(f"[Podcast Trends] Failed to create GoogleTrendsService: {e}")
            raise
    return _trends_service_instance


class PodcastTrendsRequest(BaseModel):
    keywords: List[str] = Field(..., min_length=1, max_length=5, description="1-5 keywords to analyze")
    timeframe: str = Field(default="today 12-m", description="Timeframe: 'today 3-m', 'today 12-m', 'today 5-y', 'all'")
    geo: str = Field(default="US", description="Country code: 'US', 'GB', 'IN', etc.")
    source: str = Field(default="web", description="Data source: 'web' (Google), 'podcast' (YouTube)")


class PodcastTrendsResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("", response_model=PodcastTrendsResponse)
async def get_podcast_trends(
    request: PodcastTrendsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Fetch Google Trends data for podcast topic keywords."""
    user_id = current_user.get("user_id") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found")

    try:
        service = get_trends_service()
    except (ImportError, RuntimeError) as e:
        logger.error(f"[Podcast Trends] GoogleTrendsService unavailable: {e}")
        raise HTTPException(
            status_code=503,
            detail="Google Trends service is currently unavailable. Please try again later."
        )

    try:
        # Map 'source' to 'gprop' - 'podcast' uses YouTube for video/podcast relevance
        gprop_map = {"": "", "web": "", "podcast": "youtube", "news": "news", "images": "images", "shopping": "froogle"}
        gprop = gprop_map.get(request.source, "")

        keywords = normalize_trends_keywords(request.keywords)
        if keywords != request.keywords:
            logger.info(
                "[Podcast Trends] Normalized keywords for Google Trends: {} -> {}",
                request.keywords,
                keywords,
            )

        total_timeout = get_trends_total_timeout()
        logger.info(
            "[Podcast Trends] Fetch started user={} source={} keywords={} timeout={}s",
            user_id,
            request.source,
            keywords,
            int(total_timeout),
        )

        try:
            result = await asyncio.wait_for(
                service.analyze_trends(
                    keywords=keywords,
                    timeframe=request.timeframe,
                    geo=request.geo,
                    gprop=gprop,
                    user_id=user_id,
                ),
                timeout=total_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                "[Podcast Trends] Timed out after {}s source={} keywords={}",
                int(total_timeout),
                request.source,
                keywords,
            )
            raise HTTPException(
                status_code=504,
                detail=(
                    f"Google Trends took too long ({int(total_timeout)}s). "
                    "Try a shorter idea with 2-4 words (e.g. 'Bali travel')."
                ),
            )

        has_error = result.get("error")
        has_data = (
            len(result.get("interest_over_time", [])) > 0
            or len(result.get("interest_by_region", [])) > 0
            or len(result.get("related_topics", {}).get("top", [])) > 0
            or len(result.get("related_topics", {}).get("rising", [])) > 0
            or len(result.get("related_queries", {}).get("top", [])) > 0
            or len(result.get("related_queries", {}).get("rising", [])) > 0
        )

        # Return error if: has error OR no data (meaning blocked/empty)
        if has_error and not has_data:
            error_msg = result.get("error", "")
            cooldown_active = result.get("cooldown_active", False)
            logger.warning(f"[Trends] No data or error: {error_msg[:100]}")
            # Provide helpful message during cooldown
            if cooldown_active:
                return PodcastTrendsResponse(
                    success=False,
                    data=result,
                    error="Google is rate limiting requests. Try using 'Get Trending Topics' instead, or wait 30 minutes."
                )
            return PodcastTrendsResponse(success=False, data=result, error=error_msg or "No trends data available. Google may be blocking requests.")

        # Even if no error but empty data - return error
        if not has_data:
            logger.warning("[Trends] Empty data returned")
            return PodcastTrendsResponse(success=False, data=result, error="No trends data available. Please try different keywords.")

        return PodcastTrendsResponse(success=True, data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[Podcast Trends] Error fetching trends for {request.keywords}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch trends data: {str(e)}"
        )