"""
LinkedIn Content Generation Router

FastAPI router for LinkedIn content generation endpoints.
Provides comprehensive LinkedIn content creation functionality with
proper error handling, monitoring, and documentation.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from fastapi.responses import JSONResponse, FileResponse
from typing import Dict, Any, Optional
import time
import json
from loguru import logger
from pathlib import Path

from models.linkedin_models import (
    LinkedInPostRequest, LinkedInArticleRequest, LinkedInCarouselRequest,
    LinkedInVideoScriptRequest, LinkedInCommentResponseRequest,
    LinkedInPostResponse, LinkedInArticleResponse, LinkedInCarouselResponse,
    LinkedInVideoScriptResponse, LinkedInCommentResponseResult,
    LinkedInEditContentRequest, LinkedInEditContentResponse
)
from services.llm_providers.main_text_generation import llm_text_gen
from services.linkedin_service import LinkedInService
from services.linkedin.carousel import LinkedInCarouselPDFRenderer
from middleware.auth_middleware import get_current_user
from utils.text_asset_tracker import save_and_track_text_content
from models.api_monitoring import APIRequest
from sqlalchemy import func
from collections import defaultdict

# Initialize the LinkedIn service instance
linkedin_service = LinkedInService()
from services.subscription.monitoring_middleware import DatabaseAPIMonitor
from services.database import get_db as get_db_dependency
from sqlalchemy.orm import Session

# Simple in-memory rate limiter: {user_id: [timestamp, ...]}
_rate_limit_store: Dict[str, list] = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW = 60  # seconds

def check_rate_limit(user_id: str) -> Optional[int]:
    """Returns retry-after seconds if rate limited, None otherwise."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW
    timestamps = _rate_limit_store[user_id]
    # Prune old entries
    _rate_limit_store[user_id] = [t for t in timestamps if t > window_start]
    if len(_rate_limit_store[user_id]) >= RATE_LIMIT_MAX_REQUESTS:
        return int(_rate_limit_store[user_id][0] + RATE_LIMIT_WINDOW - now)
    _rate_limit_store[user_id].append(now)
    return None

ERROR_CODES = {
    'VALIDATION': 'LINKEDIN_ERR_001',
    'GENERATION_FAILED': 'LINKEDIN_ERR_002',
    'RATE_LIMITED': 'LINKEDIN_ERR_003',
    'SAVE_FAILED': 'LINKEDIN_ERR_004',
    'NOT_FOUND': 'LINKEDIN_ERR_404',
}

def error_response(code: str, message: str) -> dict:
    return {"code": code, "message": message}


def _extract_clerk_user_id(
    current_user: Optional[Dict[str, Any]], http_request: Request
) -> Optional[str]:
    if current_user:
        return str(
            current_user.get('clerk_user_id')
            or current_user.get('id')
            or current_user.get('sub')
            or ''
        ) or None
    return http_request.headers.get("X-User-ID") or None


def _require_clerk_user_id(
    current_user: Optional[Dict[str, Any]], http_request: Request
) -> str:
    user_id = _extract_clerk_user_id(current_user, http_request)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail=error_response('VALIDATION', "Authentication required. Please provide Clerk user ID."),
        )
    return user_id

# Initialize router
router = APIRouter(
    prefix="/api/linkedin",
    tags=["LinkedIn Content Generation"],
    responses={
        404: {"description": "Not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"}
    }
)

# Initialize monitoring
monitor = DatabaseAPIMonitor()


# Use the proper database dependency from services.database
get_db = get_db_dependency


async def log_api_request(request: Request, db: Session, duration: float, status_code: int):
    """Log API request to database for monitoring."""
    try:
        request_record = APIRequest(
            path=str(request.url.path),
            method=request.method,
            status_code=status_code,
            duration=duration,
            user_id=request.headers.get("X-User-ID"),
            request_size=len(await request.body()) if request.method == "POST" else 0,
            user_agent=request.headers.get("User-Agent"),
            ip_address=request.client.host if request.client else None
        )
        db.add(request_record)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log API request: {str(e)}")


@router.get("/health", summary="Health Check", description="Check LinkedIn service health")
async def health_check():
    """Health check endpoint for LinkedIn service."""
    return {
        "status": "healthy",
        "service": "linkedin_content_generation",
        "version": "1.0.0",
        "timestamp": time.time()
    }


@router.post(
    "/generate-post",
    response_model=LinkedInPostResponse,
    summary="Generate LinkedIn Post",
    description="""
    Generate a professional LinkedIn post with AI-powered content creation.
    
    Features:
    - Research-backed content using multiple search engines
    - Industry-specific optimization
    - Hashtag generation and optimization
    - Call-to-action suggestions
    - Engagement prediction
    - Multiple tone and style options
    
    The service conducts research on the specified topic and industry,
    then generates engaging content optimized for LinkedIn's algorithm.
    """
)
async def generate_post(
    request: LinkedInPostRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate a LinkedIn post based on the provided parameters."""
    start_time = time.time()
    
    try:
        logger.info(f"Received LinkedIn post generation request for topic: {request.topic}")
        
        # Validate request
        if not request.topic.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Topic cannot be empty"))
        
        if not request.industry.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Industry cannot be empty"))
        
        # Extract user_id
        user_id = _require_clerk_user_id(current_user, http_request)
        
        # Rate limit check
        retry_after = check_rate_limit(user_id or 'anonymous')
        if retry_after:
            raise HTTPException(
                status_code=429,
                detail=error_response(ERROR_CODES['RATE_LIMITED'], f"Rate limit exceeded. Retry after {retry_after} seconds."),
                headers={"Retry-After": str(retry_after)}
            )
        
        # Generate post content
        response = await linkedin_service.generate_linkedin_post(request, user_id=user_id)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], response.error or "Post generation failed"))
        
        # Log successful request
        duration = time.time() - start_time
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 200
        )
        
        # Save and track text content
        if user_id and response.data and response.data.content:
            try:
                text_content = response.data.content
                if response.data.call_to_action:
                    text_content += f"\n\nCall to Action: {response.data.call_to_action}"
                if response.data.hashtags:
                    hashtag_text = " ".join([f"#{h.hashtag}" if isinstance(h, dict) else f"#{h.get('hashtag', '')}" for h in response.data.hashtags])
                    text_content += f"\n\nHashtags: {hashtag_text}"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=text_content,
                    source_module="linkedin_writer",
                    title=f"LinkedIn Post: {request.topic[:80]}",
                    description=f"LinkedIn post for {request.industry} industry",
                    prompt=f"Topic: {request.topic}\nIndustry: {request.industry}\nTone: {request.tone}",
                    tags=["linkedin", "post", request.industry.lower().replace(' ', '_')],
                    asset_metadata={
                        "post_type": request.post_type.value if hasattr(request.post_type, 'value') else str(request.post_type),
                        "tone": request.tone.value if hasattr(request.tone, 'value') else str(request.tone),
                        "character_count": response.data.character_count,
                        "hashtag_count": len(response.data.hashtags),
                        "grounding_enabled": response.data.grounding_enabled if hasattr(response.data, 'grounding_enabled') else False
                    },
                    subdirectory="posts"
                )
            except Exception as track_error:
                logger.error(f"Failed to track LinkedIn post asset: {track_error}")
        
        logger.info(f"Successfully generated LinkedIn post in {duration:.2f} seconds")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating LinkedIn post: {str(e)}")
        
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 500
        )
        
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate LinkedIn post: {str(e)}")
        )


@router.post(
    "/generate-article",
    response_model=LinkedInArticleResponse,
    summary="Generate LinkedIn Article",
    description="""
    Generate a comprehensive LinkedIn article with AI-powered content creation.
    
    Features:
    - Long-form content generation
    - Research-backed insights and data
    - SEO optimization for LinkedIn
    - Section structuring and organization
    - Image placement suggestions
    - Reading time estimation
    - Multiple research sources integration
    
    Perfect for thought leadership and in-depth industry analysis.
    """
)
async def generate_article(
    request: LinkedInArticleRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate a LinkedIn article based on the provided parameters."""
    start_time = time.time()
    
    try:
        logger.info(f"Received LinkedIn article generation request for topic: {request.topic}")
        
        # Validate request
        if not request.topic.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Topic cannot be empty"))
        
        if not request.industry.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Industry cannot be empty"))
        
        # Extract user_id
        user_id = _require_clerk_user_id(current_user, http_request)
        
        # Rate limit check
        retry_after = check_rate_limit(user_id or 'anonymous')
        if retry_after:
            raise HTTPException(status_code=429, detail=error_response(ERROR_CODES['RATE_LIMITED'], f"Rate limit exceeded. Retry after {retry_after} seconds."), headers={"Retry-After": str(retry_after)})
        
        # Generate article content
        response = await linkedin_service.generate_linkedin_article(request, user_id=user_id)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], response.error or "Article generation failed"))
        
        # Save and track text content (non-blocking)
        if user_id and response.data:
            try:
                # Combine article content
                text_content = f"# {response.data.title}\n\n"
                text_content += response.data.content
                
                if response.data.sections:
                    text_content += "\n\n## Sections:\n"
                    for section in response.data.sections:
                        if isinstance(section, dict):
                            text_content += f"\n### {section.get('heading', 'Section')}\n{section.get('content', '')}\n"
                
                if response.data.seo_metadata:
                    text_content += f"\n\n## SEO Metadata\n{response.data.seo_metadata}\n"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=text_content,
                    source_module="linkedin_writer",
                    title=f"LinkedIn Article: {response.data.title[:80] if response.data.title else request.topic[:80]}",
                    description=f"LinkedIn article for {request.industry} industry",
                    prompt=f"Topic: {request.topic}\nIndustry: {request.industry}\nTone: {request.tone}\nWord Count: {request.word_count}",
                    tags=["linkedin", "article", request.industry.lower().replace(' ', '_')],
                    asset_metadata={
                        "tone": request.tone.value if hasattr(request.tone, 'value') else str(request.tone),
                        "word_count": response.data.word_count,
                        "reading_time": response.data.reading_time,
                        "section_count": len(response.data.sections) if response.data.sections else 0,
                        "grounding_enabled": response.data.grounding_enabled if hasattr(response.data, 'grounding_enabled') else False
                    },
                    subdirectory="articles",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.error(f"Failed to track LinkedIn article asset: {track_error}")
        
        duration = time.time() - start_time
        logger.info(f"Successfully generated LinkedIn article in {duration:.2f} seconds")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating LinkedIn article: {str(e)}")
        
        # Log failed request
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 500
        )
        
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate LinkedIn article: {str(e)}")
        )


@router.post(
    "/generate-carousel",
    response_model=LinkedInCarouselResponse,
    summary="Generate LinkedIn Carousel",
    description="""
    Generate a LinkedIn carousel post with multiple slides.
    
    Features:
    - Multi-slide content generation
    - Visual hierarchy optimization
    - Story arc development
    - Design guidelines and suggestions
    - Cover and CTA slide options
    - Professional slide structuring
    
    Ideal for step-by-step guides, tips, and visual storytelling.
    """
)
async def generate_carousel(
    request: LinkedInCarouselRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate a LinkedIn carousel based on the provided parameters."""
    start_time = time.time()
    
    try:
        logger.info(f"Received LinkedIn carousel generation request for topic: {request.topic}")
        
        # Validate request
        if not request.topic.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Topic cannot be empty"))
        
        if not request.industry.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Industry cannot be empty"))
        
        if request.number_of_slides < 3 or request.number_of_slides > 15:
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Number of slides must be between 3 and 15"))
        
        # Extract user_id
        user_id = _require_clerk_user_id(current_user, http_request)
        
        # Rate limit check
        retry_after = check_rate_limit(user_id or 'anonymous')
        if retry_after:
            raise HTTPException(status_code=429, detail=error_response(ERROR_CODES['RATE_LIMITED'], f"Rate limit exceeded. Retry after {retry_after} seconds."), headers={"Retry-After": str(retry_after)})
        
        # Generate carousel content
        response = await linkedin_service.generate_linkedin_carousel(request, user_id=user_id)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], response.error or "Carousel generation failed"))
        
        # Log successful request
        duration = time.time() - start_time
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 200
        )
        
        # Save and track text content (non-blocking)
        if user_id and response.data:
            try:
                # Combine carousel content
                text_content = f"# {response.data.title}\n\n"
                for slide in response.data.slides:
                    text_content += f"\n## Slide {slide.slide_number}: {slide.title}\n{slide.content}\n"
                    if slide.visual_elements:
                        text_content += f"\nVisual Elements: {', '.join(slide.visual_elements)}\n"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=text_content,
                    source_module="linkedin_writer",
                    title=f"LinkedIn Carousel: {response.data.title[:80] if response.data.title else request.topic[:80]}",
                    description=f"LinkedIn carousel for {request.industry} industry",
                    prompt=f"Topic: {request.topic}\nIndustry: {request.industry}\nSlides: {request.number_of_slides}",
                    tags=["linkedin", "carousel", request.industry.lower().replace(' ', '_')],
                    asset_metadata={
                        "number_of_slides": len(response.data.slides),
                        "has_cover": response.data.cover_slide is not None,
                        "has_cta": response.data.cta_slide is not None
                    },
                    subdirectory="carousels",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.error(f"Failed to track LinkedIn carousel asset: {track_error}")
        
        duration = time.time() - start_time
        logger.info(f"Successfully generated LinkedIn carousel in {duration:.2f} seconds")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating LinkedIn carousel: {str(e)}")
        
        # Log failed request
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 500
        )
        
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate LinkedIn carousel: {str(e)}")
        )


@router.post(
    "/generate-carousel-pdf",
    summary="Render Carousel as PDF",
    description="""
    Render previously generated LinkedIn carousel content as a PDF document.
    
    Takes carousel content (slides with title, content, visual_elements) and
    renders them into visually appealing slide images composed into a PDF
    ready for LinkedIn upload (1.91:1 aspect ratio, max 300 slides, max 100MB).
    """
)
async def generate_carousel_pdf(
    request: LinkedInCarouselRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate carousel content and render as PDF."""
    start_time = time.time()

    try:
        user_id = _require_clerk_user_id(current_user, http_request)

        # First generate carousel content
        content_result = await linkedin_service.generate_linkedin_carousel(request, user_id=user_id)

        if not content_result.success or not content_result.data:
            raise HTTPException(status_code=500, detail=content_result.error or "Carousel generation failed")

        carousel_data = content_result.data.model_dump()

        # Then render to PDF
        renderer = LinkedInCarouselPDFRenderer()
        pdf_result = await renderer.render_carousel_to_pdf(
            carousel_data=carousel_data,
            color_scheme=request.color_scheme,
            user_id=user_id,
        )

        if not pdf_result.get('success'):
            raise HTTPException(status_code=500, detail=pdf_result.get('error', 'PDF rendering failed'))

        duration = time.time() - start_time
        background_tasks.add_task(log_api_request, http_request, db, duration, 200)

        pdf_path = pdf_result.get('pdf_path')
        if pdf_path:
            return FileResponse(
                path=pdf_path,
                media_type="application/pdf",
                filename=f"linkedin_carousel_{request.topic[:30].replace(' ', '_')}.pdf"
            )

        return JSONResponse(content={
            'success': True,
            'pdf_bytes': pdf_result.get('pdf_bytes'),
            'metadata': pdf_result.get('metadata'),
        })

    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating carousel PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate carousel PDF: {str(e)}"))


@router.post(
    "/generate-video-script",
    response_model=LinkedInVideoScriptResponse,
    summary="Generate LinkedIn Video Script",
    description="""
    Generate a LinkedIn video script optimized for engagement.
    
    Features:
    - Attention-grabbing hooks
    - Structured storytelling
    - Visual cue suggestions
    - Caption generation
    - Thumbnail text recommendations
    - Timing and pacing guidance
    
    Perfect for creating professional video content for LinkedIn.
    """
)
async def generate_video_script(
    request: LinkedInVideoScriptRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate a LinkedIn video script based on the provided parameters."""
    start_time = time.time()
    
    try:
        logger.info(f"Received LinkedIn video script generation request for topic: {request.topic}")
        
        # Validate request
        if not request.topic.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Topic cannot be empty"))
        
        if not request.industry.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Industry cannot be empty"))
        
        video_duration = getattr(request, 'video_duration', getattr(request, 'video_length', 60))
        if video_duration < 15 or video_duration > 300:
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Video length must be between 15 and 300 seconds"))
        
        # Extract user_id
        user_id = _require_clerk_user_id(current_user, http_request)
        
        # Rate limit check
        retry_after = check_rate_limit(user_id or 'anonymous')
        if retry_after:
            raise HTTPException(status_code=429, detail=error_response(ERROR_CODES['RATE_LIMITED'], f"Rate limit exceeded. Retry after {retry_after} seconds."), headers={"Retry-After": str(retry_after)})
        
        # Generate video script content
        response = await linkedin_service.generate_linkedin_video_script(request, user_id=user_id)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], response.error or "Video script generation failed"))
        
        # Log successful request
        duration = time.time() - start_time
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 200
        )
        
        # Save and track text content (non-blocking)
        if user_id and response.data:
            try:
                # Combine video script content
                text_content = f"# Video Script: {request.topic}\n\n"
                text_content += f"## Hook\n{response.data.hook}\n\n"
                text_content += "## Main Content\n"
                for scene in response.data.main_content:
                    if isinstance(scene, dict):
                        text_content += f"\n### Scene {scene.get('scene_number', '')}\n"
                        text_content += f"{scene.get('content', '')}\n"
                        if scene.get('duration'):
                            text_content += f"Duration: {scene.get('duration')}s\n"
                        if scene.get('visual_notes'):
                            text_content += f"Visual Notes: {scene.get('visual_notes')}\n"
                text_content += f"\n## Conclusion\n{response.data.conclusion}\n"
                if response.data.captions:
                    text_content += f"\n## Captions\n" + "\n".join(response.data.captions) + "\n"
                if response.data.thumbnail_suggestions:
                    text_content += f"\n## Thumbnail Suggestions\n" + "\n".join(response.data.thumbnail_suggestions) + "\n"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=text_content,
                    source_module="linkedin_writer",
                    title=f"LinkedIn Video Script: {request.topic[:80]}",
                    description=f"LinkedIn video script for {request.industry} industry",
                    prompt=f"Topic: {request.topic}\nIndustry: {request.industry}\nDuration: {video_duration}s",
                    tags=["linkedin", "video_script", request.industry.lower().replace(' ', '_')],
                    asset_metadata={
                        "video_duration": video_duration,
                        "scene_count": len(response.data.main_content),
                        "has_captions": bool(response.data.captions)
                    },
                    subdirectory="video_scripts",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.error(f"Failed to track LinkedIn video script asset: {track_error}")
        
        logger.info(f"Successfully generated LinkedIn video script in {duration:.2f} seconds")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating LinkedIn video script: {str(e)}")
        
        # Log failed request
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 500
        )
        
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate LinkedIn video script: {str(e)}")
        )


@router.post(
    "/generate-comment-response",
    response_model=LinkedInCommentResponseResult,
    summary="Generate LinkedIn Comment Response",
    description="""
    Generate professional responses to LinkedIn comments.
    
    Features:
    - Context-aware responses
    - Multiple response type options
    - Tone optimization
    - Brand voice customization
    - Alternative response suggestions
    - Engagement goal targeting
    
    Helps maintain professional engagement and build relationships.
    """
)
async def generate_comment_response(
    request: LinkedInCommentResponseRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Generate a LinkedIn comment response based on the provided parameters."""
    start_time = time.time()
    
    try:
        logger.info("Received LinkedIn comment response generation request")
        
        # Validate request
        original_comment = getattr(request, 'original_comment', getattr(request, 'comment', ''))
        post_context = getattr(request, 'post_context', getattr(request, 'original_post', ''))
        
        if not original_comment.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Original comment cannot be empty"))
        
        if not post_context.strip():
            raise HTTPException(status_code=422, detail=error_response(ERROR_CODES['VALIDATION'], "Post context cannot be empty"))
        
        # Extract user_id
        user_id = _require_clerk_user_id(current_user, http_request)
        
        # Rate limit check
        retry_after = check_rate_limit(user_id or 'anonymous')
        if retry_after:
            raise HTTPException(status_code=429, detail=error_response(ERROR_CODES['RATE_LIMITED'], f"Rate limit exceeded. Retry after {retry_after} seconds."), headers={"Retry-After": str(retry_after)})
        
        # Generate comment response
        response = await linkedin_service.generate_linkedin_comment_response(request, user_id=user_id)
        
        if not response.success:
            raise HTTPException(status_code=500, detail=error_response(ERROR_CODES['GENERATION_FAILED'], response.error or "Comment response generation failed"))
        
        # Log successful request
        duration = time.time() - start_time
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 200
        )
        
        # Save and track text content (non-blocking)
        if user_id and hasattr(response, 'response') and response.response:
            try:
                text_content = f"# Comment Response\n\n"
                text_content += f"## Original Comment\n{original_comment}\n\n"
                text_content += f"## Post Context\n{post_context}\n\n"
                text_content += f"## Generated Response\n{response.response}\n"
                if hasattr(response, 'alternatives') and response.alternatives:
                    text_content += f"\n## Alternative Responses\n"
                    for i, alt in enumerate(response.alternatives, 1):
                        text_content += f"\n### Alternative {i}\n{alt}\n"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=text_content,
                    source_module="linkedin_writer",
                    title=f"LinkedIn Comment Response: {original_comment[:60]}",
                    description=f"LinkedIn comment response for {request.industry} industry",
                    prompt=f"Original Comment: {original_comment}\nPost Context: {post_context}\nIndustry: {request.industry}",
                    tags=["linkedin", "comment_response", request.industry.lower().replace(' ', '_')],
                    asset_metadata={
                        "response_length": getattr(request, 'response_length', 'medium'),
                        "tone": request.tone.value if hasattr(request.tone, 'value') else str(request.tone),
                        "has_alternatives": hasattr(response, 'alternatives') and bool(response.alternatives)
                    },
                    subdirectory="comment_responses",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.error(f"Failed to track LinkedIn comment response asset: {track_error}")
        
        logger.info(f"Successfully generated LinkedIn comment response in {duration:.2f} seconds")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Error generating LinkedIn comment response: {str(e)}")
        
        # Log failed request
        background_tasks.add_task(
            log_api_request, http_request, db, duration, 500
        )
        
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], f"Failed to generate LinkedIn comment response: {str(e)}")
        )


@router.get(
    "/content-types",
    summary="Get Available Content Types",
    description="Get list of available LinkedIn content types and their descriptions"
)
async def get_content_types():
    """Get available LinkedIn content types."""
    return {
        "content_types": {
            "post": {
                "name": "LinkedIn Post",
                "description": "Short-form content for regular LinkedIn posts",
                "max_length": 3000,
                "features": ["hashtags", "call_to_action", "engagement_prediction"]
            },
            "article": {
                "name": "LinkedIn Article",
                "description": "Long-form content for LinkedIn articles",
                "max_length": 125000,
                "features": ["seo_optimization", "image_suggestions", "reading_time"]
            },
            "carousel": {
                "name": "LinkedIn Carousel",
                "description": "Multi-slide visual content",
                "slide_range": "3-15 slides",
                "features": ["visual_guidelines", "slide_design", "story_flow"]
            },
            "video_script": {
                "name": "LinkedIn Video Script",
                "description": "Script for LinkedIn video content",
                "length_range": "15-300 seconds",
                "features": ["hooks", "visual_cues", "captions", "thumbnails"]
            },
            "comment_response": {
                "name": "Comment Response",
                "description": "Professional responses to LinkedIn comments",
                "response_types": ["professional", "appreciative", "clarifying", "disagreement", "value_add"],
                "features": ["tone_matching", "brand_voice", "alternatives"]
            }
        }
    }


@router.post(
    "/edit-content",
    response_model=LinkedInEditContentResponse,
    summary="Edit LinkedIn Content with AI",
    description="""
    Apply AI-powered edits to LinkedIn content.
    
    Supported edit types:
    - professionalize: Rewrite content with professional business language
    - optimize_engagement: Optimize hook and structure for maximum engagement
    - add_hashtags: Generate relevant, industry-specific hashtags
    - adjust_tone: Rewrite content in a different tone (professional, conversational, authoritative, etc.)
    - expand: Add depth, examples, and insights to content
    - condense: Shorten content while preserving key messages
    - add_cta: Generate a contextual call-to-action
    """
)
async def edit_linkedin_content(
    request: LinkedInEditContentRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """Edit LinkedIn content using AI-powered text generation."""
    try:
        # Extract user_id for subscription checking
        user_id = _extract_clerk_user_id(current_user, http_request)
        if not user_id:
            return LinkedInEditContentResponse(
                success=False, error="Authentication required", edit_type=request.edit_type
            )
        
        if not request.content.strip():
            return LinkedInEditContentResponse(
                success=False, error="Content cannot be empty", edit_type=request.edit_type
            )

        # Build the system prompt based on edit type
        system_prompts = {
            "professionalize": "You are a professional business writer. Rewrite the following LinkedIn content to be more professional, polished, and industry-appropriate. Maintain the original message but use sophisticated business language, improve sentence structure, and ensure a confident executive presence.",
            "optimize_engagement": "You are a LinkedIn engagement strategist. Rewrite the following content to maximize engagement. Strengthen the hook in the first 2 lines, add thought-provoking elements, improve readability with shorter sentences, and ensure the content encourages comments and shares.",
            "add_hashtags": "You are a LinkedIn hashtag strategist. Generate 5 highly relevant, industry-specific hashtags for the following content. Return the original content unchanged, followed by two newlines and the hashtags on a single line.",
            "adjust_tone": "You are a LinkedIn tone specialist. Rewrite the following content in the specified tone while preserving all key information and the overall message.",
            "expand": "You are a LinkedIn content strategist. Expand the following content by adding relevant examples, data points, actionable insights, and deeper analysis. Maintain the original structure but add substantial value while keeping it LinkedIn-appropriate (under 3000 characters).",
            "condense": "You are a LinkedIn editing specialist. Condense the following content to be more concise and impactful. Remove filler words, tighten sentences, and preserve only the strongest points. Keep the core message intact.",
            "add_cta": "You are a LinkedIn conversion strategist. Add a compelling, contextual call-to-action to the following content. The CTA should feel natural, not salesy, and should encourage meaningful engagement (comments, connections, or discussions)."
        }

        system_prompt = system_prompts.get(request.edit_type)
        if not system_prompt:
            return LinkedInEditContentResponse(
                success=False, error=f"Unknown edit type: {request.edit_type}", edit_type=request.edit_type
            )

        # Build the user prompt with context
        user_prompt = f"Content to edit:\n\n{request.content}\n\n"
        if request.industry:
            user_prompt += f"Industry: {request.industry}\n"
        if request.tone:
            user_prompt += f"Target tone: {request.tone}\n"
        if request.target_audience:
            user_prompt += f"Target audience: {request.target_audience}\n"
        if request.parameters:
            user_prompt += f"Additional context: {json.dumps(request.parameters)}\n"

        user_prompt += "\nReturn ONLY the edited content without any explanations, labels, or markdown formatting."

        # Generate edited content using provider-agnostic gateway
        temperature = {
            "professionalize": 0.3,
            "optimize_engagement": 0.7,
            "add_hashtags": 0.4,
            "adjust_tone": 0.5,
            "expand": 0.7,
            "condense": 0.3,
            "add_cta": 0.6,
        }.get(request.edit_type, 0.5)

        max_tokens = {
            "expand": 2048,
            "professionalize": 1024,
            "optimize_engagement": 1024,
            "adjust_tone": 1024,
            "condense": 1024,
            "add_cta": 1024,
            "add_hashtags": 512,
        }.get(request.edit_type, 1024)

        edited = llm_text_gen(
            prompt=user_prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            flow_type=f"linkedin_edit_{request.edit_type}",
            max_tokens=max_tokens,
            temperature=temperature
        )

        if not edited:
            return LinkedInEditContentResponse(
                success=False, error="AI editing returned empty result", edit_type=request.edit_type
            )

        edited = edited.strip()

        # For add_hashtags, ensure hashtags are separated from content
        if request.edit_type == "add_hashtags":
            if not edited.endswith("\n\n"):
                # Hashtags might be inline; separate them
                pass

        logger.info(f"LinkedIn content edited successfully via {request.edit_type}")
        return LinkedInEditContentResponse(
            success=True,
            content=edited,
            edit_type=request.edit_type,
            provider="llm_text_gen",
            model="provider-agnostic"
        )

    except Exception as e:
        logger.error(f"Error editing LinkedIn content: {str(e)}", exc_info=True)
        return LinkedInEditContentResponse(
            success=False, error=f"Editing failed: {str(e)}", edit_type=request.edit_type
        )


@router.get(
    "/usage-stats",
    summary="Get Usage Statistics",
    description="Get LinkedIn content generation usage statistics"
)
async def get_usage_stats(db: Session = Depends(get_db)):
    """Get usage statistics for LinkedIn content generation."""
    try:
        base = db.query(APIRequest).filter(APIRequest.path.like('/api/linkedin/%'))
        total = base.count()
        successful = base.filter(APIRequest.status_code < 400).count()

        avg_dur = base.with_entities(func.avg(APIRequest.duration)).scalar() or 0

        content_types = {
            "posts": base.filter(APIRequest.path.like('%generate-post')).count(),
            "articles": base.filter(APIRequest.path.like('%generate-article')).count(),
            "carousels": base.filter(APIRequest.path.like('%generate-carousel')).count(),
            "video_scripts": base.filter(APIRequest.path.like('%generate-video-script')).count(),
            "comment_responses": base.filter(APIRequest.path.like('%generate-comment-response')).count(),
        }

        return {
            "total_requests": total,
            "content_types": content_types,
            "success_rate": round(successful / max(total, 1), 2),
            "average_generation_time": round(float(avg_dur), 2),
        }
    except Exception as e:
        logger.error(f"Error retrieving usage stats: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=error_response(ERROR_CODES['GENERATION_FAILED'], "Failed to retrieve usage statistics")
        )