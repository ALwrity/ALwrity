"""
LinkedIn Growth Engine API routes.

Provides endpoints for trending topics, network suggestions,
engagement opportunities, preview scoring, and other growth features.
Sessions 1-8 are added incrementally to this router.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from models.linkedin_growth_models import (
    ConsolidatedGrowthResponse,
    TrendingTopicsResponse,
    NetworkSuggestionsResponse,
    EngagementOpportunitiesResponse,
    PreviewScoreRequest,
    PostPreviewScoreResponse,
    ViralAnalysisResponse,
    WeeklyStrategyResponse,
    ContentGapsResponse,
    BrandScorecardResponse,
)
from middleware.auth_middleware import get_current_user
from services.linkedin.growth import (
    ConsolidatedGrowthService,
    TrendingService,
    NetworkGrowthService,
    EngagementService,
    PreviewScoreService,
    ViralAnalysisService,
    WeeklyStrategyService,
    ContentGapService,
    BrandScorecardService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/linkedin/growth",
    tags=["LinkedIn Growth Engine"],
)


def _extract_user_id(current_user: Optional[dict]) -> str:
    if current_user:
        uid = (
            current_user.get("clerk_user_id")
            or current_user.get("id")
            or current_user.get("sub")
        )
        if uid:
            return str(uid)
    raise HTTPException(status_code=401, detail="User not authenticated")


@router.post(
    "/trending",
    response_model=TrendingTopicsResponse,
    summary="Get trending topics for the user's industry",
)
async def get_trending_topics(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Identify top trending topics in the user's industry using Exa + AI.

    Returns up to 3 trending topics with suggested hooks and data source attribution.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = TrendingService()
        return await service.get_trending_topics(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_trending_topics failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/network-suggestions",
    response_model=NetworkSuggestionsResponse,
    summary="Get people to connect with this week",
)
async def get_network_suggestions(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Suggest LinkedIn connections based on the user's profile and industry.

    Returns up to 3 people to connect with, including personalized connection notes.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = NetworkGrowthService()
        return await service.get_network_suggestions(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_network_suggestions failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/engagement-opportunities",
    response_model=EngagementOpportunitiesResponse,
    summary="Find posts to engage with and get comment suggestions",
)
async def get_engagement_opportunities(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Identify posts the user should engage with and suggests comments.

    Uses Exa to find recent thought-provoking content in the user's
    industry and generates thoughtful comment suggestions via AI.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = EngagementService()
        return await service.get_engagement_opportunities(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_engagement_opportunities failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/preview-score",
    response_model=PostPreviewScoreResponse,
    summary="Score a LinkedIn post draft across quality dimensions",
)
async def get_preview_score(
    request: PreviewScoreRequest,
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Analyze a post draft and return scores across 6 quality dimensions.

    Scores Hook Strength, Clarity, Engagement Potential, Value Proposition,
    Call to Action, and Readability — each with actionable feedback.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = PreviewScoreService()
        return await service.score_post(request=request, user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_preview_score failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/viral-analysis",
    response_model=ViralAnalysisResponse,
    summary="Analyze viral content patterns in your industry",
)
async def get_viral_analysis(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Identify content patterns driving high engagement in the user's industry.

    Searches Exa for high-engagement LinkedIn content and uses AI to extract
    recurring patterns with examples and engagement multipliers.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = ViralAnalysisService()
        return await service.analyze(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_viral_analysis failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/weekly-strategy",
    response_model=WeeklyStrategyResponse,
    summary="Generate a weekly LinkedIn content strategy",
)
async def get_weekly_strategy(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Create a week-long content strategy with daily post ideas.

    Uses your LinkedIn profile and recent industry trends to generate
    5 daily post ideas (Mon-Fri), a weekly theme, key topics, and focus area.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = WeeklyStrategyService()
        return await service.generate(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_weekly_strategy failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/content-gaps",
    response_model=ContentGapsResponse,
    summary="Identify content gaps in the user's LinkedIn strategy",
)
async def get_content_gaps(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Find topics the user should be covering but hasn't.

    Analyzes the user's industry and role against current trends
    to identify content gaps with suggested post angles.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = ContentGapService()
        return await service.analyze(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_content_gaps failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/brand-scorecard",
    response_model=BrandScorecardResponse,
    summary="Evaluate your LinkedIn personal brand strength",
)
async def get_brand_scorecard(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Score your personal brand across 5 dimensions.

    Evaluates Profile Completeness, Content Consistency, Authority Signals,
    Network Quality, and Brand Clarity based on your LinkedIn profile data.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = BrandScorecardService()
        return await service.score(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] get_brand_scorecard failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/analyze-all",
    response_model=ConsolidatedGrowthResponse,
    summary="Run all growth analyses in a single AI call",
)
async def analyze_all_growth(
    current_user: Optional[dict] = Depends(get_current_user),
):
    """Generate all growth insights in one consolidated AI call.

    Returns trending topics, network suggestions, engagement opportunities,
    viral analysis, weekly strategy, content gaps, and brand scorecard —
    all from a single LLM prompt to minimize latency and cost.
    """
    try:
        user_id = _extract_user_id(current_user)
        service = ConsolidatedGrowthService()
        return await service.analyze_all(user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Growth] analyze_all_growth failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
