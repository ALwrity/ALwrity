"""
Podcast Trends Handler

Endpoints for fetching Tavily-backed trend data relevant to podcast topics.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.research.trends import TavilyTrendProvider, TrendPlatform, synthesize_trends
from services.research.trends.trends_keyword_utils import normalize_trends_keywords

router = APIRouter(prefix="/trends", tags=["Podcast Trends"])

# Module-level shared instance (singleton pattern)
_trend_provider_instance = None


def get_trend_provider():
    """Get or create a shared TavilyTrendProvider instance."""
    global _trend_provider_instance
    if _trend_provider_instance is None:
        _trend_provider_instance = TavilyTrendProvider()
        logger.info("[Podcast Trends] Created shared TavilyTrendProvider instance")
    return _trend_provider_instance


_SOURCE_TO_PLATFORM = {
    "": TrendPlatform.WEB,
    "web": TrendPlatform.WEB,
    "podcast": TrendPlatform.PODCAST,
    "news": TrendPlatform.NEWS,
    "images": TrendPlatform.IMAGES,
    "shopping": TrendPlatform.SHOPPING,
}


def _map_source_to_platform(source: str) -> TrendPlatform:
    return _SOURCE_TO_PLATFORM.get((source or "").strip().lower(), TrendPlatform.WEB)


async def _fetch_podcast_trends(
    provider, keywords, source, timeframe, geo, user_id
) -> Dict[str, Any]:
    """Fetch and synthesize Tavily trends for the requested source/platform."""
    platform = _map_source_to_platform(source)
    items = await provider.fetch_trends(
        platform, industry="", keywords=keywords, user_id=user_id
    )
    report = await synthesize_trends(
        items, platform, user_id=user_id, focus=f"{platform.value} content angles"
    )
    return {
        "keywords": keywords,
        "source": source,
        "platform": platform.value,
        "timeframe": timeframe,
        "geo": geo,
        "summary": report.get("summary", ""),
        "trends": report.get("trends", []),
        "items": [item.to_dict() for item in items],
    }


class PodcastTrendsRequest(BaseModel):
    keywords: List[str] = Field(..., min_length=1, max_length=5, description="1-5 keywords to analyze")
    timeframe: str = Field(default="today 12-m", description="Timeframe: 'today 3-m', 'today 12-m', 'today 5-y', 'all'")
    geo: str = Field(default="US", description="Country code: 'US', 'GB', 'IN', etc.")
    source: str = Field(default="web", description="Data source: 'web', 'podcast', 'news', 'images', 'shopping'")


class PodcastTrendsResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.post("", response_model=PodcastTrendsResponse)
async def get_podcast_trends(
    request: PodcastTrendsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Fetch Tavily-backed trend topics for podcast topic keywords."""
    user_id = current_user.get("user_id") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID not found")

    try:
        provider = get_trend_provider()
    except (ImportError, RuntimeError) as e:
        logger.error(f"[Podcast Trends] Trend provider unavailable: {e}")
        raise HTTPException(
            status_code=503,
            detail="Trend service is currently unavailable. Please try again later."
        )

    keywords = normalize_trends_keywords(request.keywords)
    if keywords != request.keywords:
        logger.info("[Podcast Trends] Normalized keywords: {} -> {}", request.keywords, keywords)

    try:
        data = await _fetch_podcast_trends(
            provider, keywords, request.source, request.timeframe, request.geo, user_id
        )
    except Exception as e:
        logger.error(f"[Podcast Trends] Error fetching trends for {request.keywords}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch trends data: {str(e)}")

    has_data = bool(data.get("trends") or data.get("items"))
    if not has_data:
        logger.warning("[Trends] No trend data returned")
        return PodcastTrendsResponse(
            success=False, data=data, error="No trends data available. Please try different keywords."
        )

    return PodcastTrendsResponse(success=True, data=data)
