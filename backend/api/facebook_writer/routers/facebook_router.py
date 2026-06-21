"""FastAPI router for Facebook Writer endpoints."""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
import logging
from sqlalchemy.orm import Session

from ..models import *
from ..services import *
from middleware.auth_middleware import get_current_user
from services.database import get_db as get_db_dependency
from utils.text_asset_tracker import save_and_track_text_content

# Configure logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/api/facebook-writer",
    tags=["Facebook Writer"],
    responses={404: {"description": "Not found"}},
)

# Initialize services
post_service = FacebookPostService()
story_service = FacebookStoryService()
reel_service = FacebookReelService()
carousel_service = FacebookCarouselService()
event_service = FacebookEventService()
hashtag_service = FacebookHashtagService()
engagement_service = FacebookEngagementService()
group_post_service = FacebookGroupPostService()
page_about_service = FacebookPageAboutService()
ad_copy_service = FacebookAdCopyService()


@router.get("/health")
async def health_check():
    """Health check endpoint for Facebook Writer API."""
    return {"status": "healthy", "service": "Facebook Writer API"}


@router.get("/tools")
async def get_available_tools():
    """Get list of available Facebook Writer tools."""
    tools = [
        {
            "name": "FB Post Generator",
            "endpoint": "/post/generate",
            "description": "Create engaging Facebook posts that drive engagement and reach",
            "icon": "📝",
            "category": "Content Creation"
        },
        {
            "name": "FB Story Generator", 
            "endpoint": "/story/generate",
            "description": "Generate creative Facebook Stories with text overlays and engagement elements",
            "icon": "📱",
            "category": "Content Creation"
        },
        {
            "name": "FB Reel Generator",
            "endpoint": "/reel/generate", 
            "description": "Create engaging Facebook Reels scripts with trending music suggestions",
            "icon": "🎥",
            "category": "Content Creation"
        },
        {
            "name": "Carousel Generator",
            "endpoint": "/carousel/generate",
            "description": "Generate multi-image carousel posts with engaging captions for each slide",
            "icon": "🔄",
            "category": "Content Creation"
        },
        {
            "name": "Event Description Generator",
            "endpoint": "/event/generate",
            "description": "Create compelling event descriptions that drive attendance and engagement",
            "icon": "📅",
            "category": "Business Tools"
        },
        {
            "name": "Group Post Generator",
            "endpoint": "/group-post/generate",
            "description": "Generate engaging posts for Facebook Groups with community-focused content",
            "icon": "👥",
            "category": "Business Tools"
        },
        {
            "name": "Page About Generator",
            "endpoint": "/page-about/generate",
            "description": "Create professional and engaging About sections for your Facebook Page",
            "icon": "ℹ️",
            "category": "Business Tools"
        },
        {
            "name": "Ad Copy Generator",
            "endpoint": "/ad-copy/generate",
            "description": "Generate high-converting ad copy for Facebook Ads with targeting suggestions",
            "icon": "💰",
            "category": "Marketing Tools"
        },
        {
            "name": "Hashtag Generator",
            "endpoint": "/hashtags/generate",
            "description": "Generate trending and relevant hashtags for your Facebook content",
            "icon": "#️⃣",
            "category": "Marketing Tools"
        },
        {
            "name": "Engagement Analyzer",
            "endpoint": "/engagement/analyze",
            "description": "Analyze your content performance and get AI-powered improvement suggestions",
            "icon": "📊",
            "category": "Marketing Tools"
        }
    ]
    
    return {"tools": tools, "total_count": len(tools)}


# Use the proper database dependency from services.database
get_db = get_db_dependency


# Content Creation Endpoints
@router.post("/post/generate", response_model=FacebookPostResponse)
async def generate_facebook_post(
    request: FacebookPostRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook post with engagement optimization."""
    try:
        logger.info(f"Generating Facebook post for business: {request.business_type}")
        user_id = str(current_user.get('id', '') or current_user.get('sub', '') or '0') if current_user else '0'
        response = post_service.generate_post(request, user_id)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.content:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    text_content = response.content
                    if response.analytics:
                        text_content += f"\n\n## Analytics\nExpected Reach: {response.analytics.expected_reach}\nExpected Engagement: {response.analytics.expected_engagement}\nBest Time to Post: {response.analytics.best_time_to_post}"
                    
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=text_content,
                        source_module="facebook_writer",
                        title=f"Facebook Post: {request.business_type[:60]}",
                        description=f"Facebook post for {request.business_type}",
                        prompt=f"Business Type: {request.business_type}\nTarget Audience: {request.target_audience}\nGoal: {request.post_goal.value if hasattr(request.post_goal, 'value') else request.post_goal}\nTone: {request.post_tone.value if hasattr(request.post_tone, 'value') else request.post_tone}",
                        tags=["facebook", "post", request.business_type.lower().replace(' ', '_')],
                        asset_metadata={
                            "post_goal": request.post_goal.value if hasattr(request.post_goal, 'value') else str(request.post_goal),
                            "post_tone": request.post_tone.value if hasattr(request.post_tone, 'value') else str(request.post_tone),
                            "media_type": request.media_type.value if hasattr(request.media_type, 'value') else str(request.media_type)
                        },
                        subdirectory="posts"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook post asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook post: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/story/generate", response_model=FacebookStoryResponse)
async def generate_facebook_story(
    request: FacebookStoryRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook story with visual suggestions."""
    try:
        logger.info(f"Generating Facebook story for business: {request.business_type}")
        user_id = str(current_user.get('id', '') or current_user.get('sub', '') or '0') if current_user else '0'
        response = story_service.generate_story(request, user_id)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.content:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=response.content,
                        source_module="facebook_writer",
                        title=f"Facebook Story: {request.business_type[:60]}",
                        description=f"Facebook story for {request.business_type}",
                        prompt=f"Business Type: {request.business_type}\nStory Type: {request.story_type.value if hasattr(request.story_type, 'value') else request.story_type}",
                        tags=["facebook", "story", request.business_type.lower().replace(' ', '_')],
                        asset_metadata={
                            "story_type": request.story_type.value if hasattr(request.story_type, 'value') else str(request.story_type)
                        },
                        subdirectory="stories"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook story asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook story: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/reel/generate", response_model=FacebookReelResponse)
async def generate_facebook_reel(
    request: FacebookReelRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook reel script with music suggestions."""
    try:
        logger.info(f"Generating Facebook reel for business: {request.business_type}")
        user_id = str(current_user.get('id', '') or current_user.get('sub', '') or '0') if current_user else '0'
        response = reel_service.generate_reel(request, user_id)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.script:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    text_content = f"# Facebook Reel Script\n\n## Script\n{response.script}\n"
                    if response.scene_breakdown:
                        text_content += f"\n## Scene Breakdown\n" + "\n".join([f"{i+1}. {scene}" for i, scene in enumerate(response.scene_breakdown)]) + "\n"
                    if response.music_suggestions:
                        text_content += f"\n## Music Suggestions\n" + "\n".join(response.music_suggestions) + "\n"
                    if response.hashtag_suggestions:
                        text_content += f"\n## Hashtag Suggestions\n" + " ".join([f"#{tag}" for tag in response.hashtag_suggestions]) + "\n"
                    
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=text_content,
                        source_module="facebook_writer",
                        title=f"Facebook Reel: {request.topic[:60]}",
                        description=f"Facebook reel script for {request.business_type}",
                        prompt=f"Business Type: {request.business_type}\nTopic: {request.topic}\nReel Type: {request.reel_type.value if hasattr(request.reel_type, 'value') else request.reel_type}\nLength: {request.reel_length.value if hasattr(request.reel_length, 'value') else request.reel_length}",
                        tags=["facebook", "reel", request.business_type.lower().replace(' ', '_')],
                        asset_metadata={
                            "reel_type": request.reel_type.value if hasattr(request.reel_type, 'value') else str(request.reel_type),
                            "reel_length": request.reel_length.value if hasattr(request.reel_length, 'value') else str(request.reel_length),
                            "reel_style": request.reel_style.value if hasattr(request.reel_style, 'value') else str(request.reel_style)
                        },
                        subdirectory="reels",
                        file_extension=".md"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook reel asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook reel: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/carousel/generate", response_model=FacebookCarouselResponse)
async def generate_facebook_carousel(
    request: FacebookCarouselRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook carousel post with multiple slides."""
    try:
        logger.info(f"Generating Facebook carousel for business: {request.business_type}")
        response = carousel_service.generate_carousel(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.main_caption and response.slides:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    text_content = f"# Facebook Carousel\n\n## Main Caption\n{response.main_caption}\n\n"
                    text_content += "## Slides\n"
                    for i, slide in enumerate(response.slides, 1):
                        text_content += f"\n### Slide {i}: {slide.title}\n{slide.content}\n"
                        if slide.image_description:
                            text_content += f"Image Description: {slide.image_description}\n"
                    
                    if response.hashtag_suggestions:
                        text_content += f"\n## Hashtag Suggestions\n" + " ".join([f"#{tag}" for tag in response.hashtag_suggestions]) + "\n"
                    
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=text_content,
                        source_module="facebook_writer",
                        title=f"Facebook Carousel: {request.topic[:60]}",
                        description=f"Facebook carousel for {request.business_type}",
                        prompt=f"Business Type: {request.business_type}\nTopic: {request.topic}\nCarousel Type: {request.carousel_type.value if hasattr(request.carousel_type, 'value') else request.carousel_type}\nSlides: {request.num_slides}",
                        tags=["facebook", "carousel", request.business_type.lower().replace(' ', '_')],
                        asset_metadata={
                            "carousel_type": request.carousel_type.value if hasattr(request.carousel_type, 'value') else str(request.carousel_type),
                            "num_slides": request.num_slides,
                            "has_cta": request.include_cta
                        },
                        subdirectory="carousels",
                        file_extension=".md"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook carousel asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook carousel: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Business Tools Endpoints
@router.post("/event/generate", response_model=FacebookEventResponse)
async def generate_facebook_event(
    request: FacebookEventRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook event description."""
    try:
        logger.info(f"Generating Facebook event: {request.event_name}")
        response = event_service.generate_event(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.description:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    text_content = f"# Facebook Event: {request.event_name}\n\n## Description\n{response.description}\n"
                    if hasattr(response, 'details') and response.details:
                        text_content += f"\n## Details\n{response.details}\n"
                    
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=text_content,
                        source_module="facebook_writer",
                        title=f"Facebook Event: {request.event_name[:60]}",
                        description=f"Facebook event description for {request.event_name}",
                        prompt=f"Event Name: {request.event_name}\nEvent Type: {getattr(request, 'event_type', 'N/A')}\nDate: {getattr(request, 'event_date', 'N/A')}",
                        tags=["facebook", "event", request.event_name.lower().replace(' ', '_')[:20]],
                        asset_metadata={
                            "event_name": request.event_name,
                            "event_type": getattr(request, 'event_type', None)
                        },
                        subdirectory="events"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook event asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook event: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/group-post/generate", response_model=FacebookGroupPostResponse)
async def generate_facebook_group_post(
    request: FacebookGroupPostRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook group post following community guidelines."""
    try:
        logger.info(f"Generating Facebook group post for: {request.group_name}")
        response = group_post_service.generate_group_post(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.content:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=response.content,
                        source_module="facebook_writer",
                        title=f"Facebook Group Post: {request.group_name[:60]}",
                        description=f"Facebook group post for {request.group_name}",
                        prompt=f"Group Name: {request.group_name}\nTopic: {getattr(request, 'topic', 'N/A')}",
                        tags=["facebook", "group_post", request.group_name.lower().replace(' ', '_')[:20]],
                        asset_metadata={
                            "group_name": request.group_name,
                            "group_type": getattr(request, 'group_type', None)
                        },
                        subdirectory="group_posts"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook group post asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook group post: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/page-about/generate", response_model=FacebookPageAboutResponse)
async def generate_facebook_page_about(
    request: FacebookPageAboutRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a Facebook page about section."""
    try:
        logger.info(f"Generating Facebook page about for: {request.business_name}")
        response = page_about_service.generate_page_about(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.about_section:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=response.about_section,
                        source_module="facebook_writer",
                        title=f"Facebook Page About: {request.business_name[:60]}",
                        description=f"Facebook page about section for {request.business_name}",
                        prompt=f"Business Name: {request.business_name}\nBusiness Type: {getattr(request, 'business_type', 'N/A')}",
                        tags=["facebook", "page_about", request.business_name.lower().replace(' ', '_')[:20]],
                        asset_metadata={
                            "business_name": request.business_name,
                            "business_type": getattr(request, 'business_type', None)
                        },
                        subdirectory="page_about"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook page about asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook page about: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Marketing Tools Endpoints
@router.post("/ad-copy/generate", response_model=FacebookAdCopyResponse)
async def generate_facebook_ad_copy(
    request: FacebookAdCopyRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate Facebook ad copy with targeting suggestions."""
    try:
        logger.info(f"Generating Facebook ad copy for: {request.business_type}")
        response = ad_copy_service.generate_ad_copy(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        # Save and track text content (non-blocking)
        if response.ad_copy:
            try:
                user_id = None
                if current_user:
                    user_id = str(current_user.get('id', '') or current_user.get('sub', ''))
                
                if user_id:
                    text_content = f"# Facebook Ad Copy\n\n## Ad Copy\n{response.ad_copy}\n"
                    if hasattr(response, 'headline') and response.headline:
                        text_content += f"\n## Headline\n{response.headline}\n"
                    if hasattr(response, 'description') and response.description:
                        text_content += f"\n## Description\n{response.description}\n"
                    if hasattr(response, 'targeting_suggestions') and response.targeting_suggestions:
                        text_content += f"\n## Targeting Suggestions\n" + "\n".join(response.targeting_suggestions) + "\n"
                    
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=text_content,
                        source_module="facebook_writer",
                        title=f"Facebook Ad Copy: {request.business_type[:60]}",
                        description=f"Facebook ad copy for {request.business_type}",
                        prompt=f"Business Type: {request.business_type}\nAd Objective: {getattr(request, 'ad_objective', 'N/A')}\nTarget Audience: {getattr(request, 'target_audience', 'N/A')}",
                        tags=["facebook", "ad_copy", request.business_type.lower().replace(' ', '_')],
                        asset_metadata={
                            "ad_objective": getattr(request, 'ad_objective', None),
                            "budget": getattr(request, 'budget', None)
                        },
                        subdirectory="ad_copy",
                        file_extension=".md"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track Facebook ad copy asset: {track_error}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook ad copy: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/hashtags/generate", response_model=FacebookHashtagResponse)
async def generate_facebook_hashtags(request: FacebookHashtagRequest):
    """Generate relevant hashtags for Facebook content."""
    try:
        logger.info(f"Generating Facebook hashtags for: {request.content_topic}")
        response = hashtag_service.generate_hashtags(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        return response
        
    except Exception as e:
        logger.error(f"Error generating Facebook hashtags: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/engagement/analyze", response_model=FacebookEngagementResponse)
async def analyze_facebook_engagement(request: FacebookEngagementRequest):
    """Analyze Facebook content for engagement optimization."""
    try:
        logger.info(f"Analyzing Facebook engagement for {request.content_type.value}")
        response = engagement_service.analyze_engagement(request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.error)
        
        return response
        
    except Exception as e:
        logger.error(f"Error analyzing Facebook engagement: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Utility Endpoints
@router.get("/post/templates")
async def get_post_templates():
    """Get predefined post templates."""
    templates = [
        {
            "name": "Product Launch",
            "description": "Template for announcing new products",
            "goal": "Promote a product/service",
            "tone": "Upbeat",
            "structure": "Hook + Features + Benefits + CTA"
        },
        {
            "name": "Educational Content",
            "description": "Template for sharing knowledge",
            "goal": "Share valuable content", 
            "tone": "Informative",
            "structure": "Problem + Solution + Tips + Engagement Question"
        },
        {
            "name": "Community Engagement",
            "description": "Template for building community",
            "goal": "Increase engagement",
            "tone": "Conversational",
            "structure": "Question + Context + Personal Experience + Call for Comments"
        }
    ]
    return {"templates": templates}


@router.get("/analytics/benchmarks")
async def get_analytics_benchmarks():
    """Get Facebook analytics benchmarks by industry."""
    benchmarks = {
        "general": {
            "average_engagement_rate": "3.91%",
            "average_reach": "5.5%",
            "best_posting_times": ["1 PM - 3 PM", "3 PM - 4 PM"]
        },
        "retail": {
            "average_engagement_rate": "4.2%",
            "average_reach": "6.1%",
            "best_posting_times": ["12 PM - 2 PM", "5 PM - 7 PM"]
        },
        "health_fitness": {
            "average_engagement_rate": "5.1%",
            "average_reach": "7.2%",
            "best_posting_times": ["6 AM - 8 AM", "6 PM - 8 PM"]
        }
    }
    return {"benchmarks": benchmarks}


@router.get("/compliance/guidelines")
async def get_compliance_guidelines():
    """Get Facebook content compliance guidelines."""
    guidelines = {
        "general": [
            "Avoid misleading or false information",
            "Don't use excessive capitalization",
            "Ensure claims are substantiated",
            "Respect intellectual property rights"
        ],
        "advertising": [
            "Include required disclaimers",
            "Avoid prohibited content categories",
            "Use appropriate targeting",
            "Follow industry-specific regulations"
        ],
        "community": [
            "Respect community standards",
            "Avoid spam or repetitive content",
            "Don't engage in artificial engagement",
            "Report violations appropriately"
        ]
    }
    return {"guidelines": guidelines}