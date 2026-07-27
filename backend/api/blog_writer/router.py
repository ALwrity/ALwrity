"""
AI Blog Writer API Router

Main router for blog writing operations including research, outline generation,
content creation, SEO analysis, and publishing.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from loguru import logger
from datetime import datetime, timedelta
from middleware.auth_middleware import get_current_user
from sqlalchemy.orm import Session
from services.database import get_db as get_db_dependency
from utils.text_asset_tracker import save_and_track_text_content
from models.content_asset_models import AssetType, AssetSource

from models.blog_models import (
    BlogResearchRequest,
    BlogResearchResponse,
    BlogOutlineRequest,
    BlogOutlineResponse,
    BlogOutlineRefineRequest,
    BlogSectionRequest,
    BlogSectionResponse,
    BlogOptimizeRequest,
    BlogOptimizeResponse,
    BlogSEOAnalyzeRequest,
    BlogSEOAnalyzeResponse,
    BlogSEOMetadataRequest,
    BlogSEOMetadataResponse,
    BlogPublishRequest,
    BlogPublishResponse,
    HallucinationCheckRequest,
    HallucinationCheckResponse,
)
from services.blog_writer.blog_service import BlogWriterService
from services.blog_writer.seo.blog_seo_recommendation_applier import BlogSEORecommendationApplier
from services.llm_providers.main_text_generation import llm_text_gen
from services.content_asset_service import ContentAssetService
from .task_manager import task_manager
from .cache_manager import cache_manager
from models.blog_models import MediumBlogGenerateRequest


router = APIRouter(prefix="/api/blog", tags=["AI Blog Writer"])

service = BlogWriterService()
recommendation_applier = BlogSEORecommendationApplier()


# Use the proper database dependency from services.database
get_db = get_db_dependency
# ---------------------------
# SEO Recommendation Endpoints
# ---------------------------


class RecommendationItem(BaseModel):
    category: str = Field(..., description="Recommendation category, e.g. Structure")
    priority: str = Field(..., description="Priority level: High | Medium | Low")
    recommendation: str = Field(..., description="Action to perform")
    impact: str = Field(..., description="Expected impact or rationale")


class SEOApplyRecommendationsRequest(BaseModel):
    title: str = Field(..., description="Current blog title")
    introduction: str | None = Field(default=None, description="Current blog introduction text")
    sections: List[Dict[str, Any]] = Field(..., description="Array of sections with id, heading, content")
    outline: List[Dict[str, Any]] = Field(default_factory=list, description="Outline structure for context")
    research: Dict[str, Any] = Field(default_factory=dict, description="Research data used for the blog")
    recommendations: List[RecommendationItem] = Field(..., description="Actionable recommendations to apply")
    competitive_advantage: str | None = Field(default=None, description="Selected competitive advantage for emphasis")
    persona: Dict[str, Any] = Field(default_factory=dict, description="Persona settings if available")
    tone: str | None = Field(default=None, description="Desired tone override")
    audience: str | None = Field(default=None, description="Target audience override")


@router.post("/seo/apply-recommendations")
async def apply_seo_recommendations(
    request: SEOApplyRecommendationsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Apply actionable SEO recommendations and return updated content."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        result = await recommendation_applier.apply_recommendations(request.dict(), user_id=user_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to apply recommendations"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to apply SEO recommendations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


class BlogSectionToolRequest(BaseModel):
    section_id: str = Field(..., description="Section id in blog writer UI")
    title: Optional[str] = Field(default=None, description="Section title/heading")
    content: str = Field(..., description="Section content text")
    keywords: List[str] = Field(default_factory=list, description="Optional target keywords")
    goal: Optional[str] = Field(default=None, description="Optional optimization goal")


@router.post("/section/tools/originality")
async def section_originality_tools(
    request: BlogSectionToolRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id"))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")

        from services.intelligence.sif_integration import SIFIntegrationService
        from services.intelligence.agents.specialized import ContentGuardianAgent

        sif_service = SIFIntegrationService(user_id)
        intelligence = sif_service.intelligence_service

        content = (request.content or "").strip()
        if len(content) < 50:
            return {
                "success": False,
                "section_id": request.section_id,
                "error": "Content too short for originality check",
                "matches": [],
            }

        matches = await intelligence.search(content, limit=5)
        normalized_matches = []
        for m in matches or []:
            normalized_matches.append(
                {
                    "id": m.get("id"),
                    "score": m.get("score", 0.0),
                    "excerpt": (m.get("text", "") or "")[:240],
                }
            )

        guardian = ContentGuardianAgent(intelligence, sif_service=sif_service)
        cannibalization = await guardian.check_cannibalization(content)

        return {
            "success": True,
            "section_id": request.section_id,
            "cannibalization": cannibalization,
            "matches": normalized_matches,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run originality tools: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/section/tools/internal-links")
async def section_internal_link_tools(
    request: BlogSectionToolRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id"))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")

        from services.intelligence.sif_integration import SIFIntegrationService
        from services.intelligence.sif_agents import LinkGraphAgent

        sif_service = SIFIntegrationService(user_id)
        intelligence = sif_service.intelligence_service

        content = (request.content or "").strip()
        suggestions = []
        if len(content) >= 50:
            link_agent = LinkGraphAgent(intelligence, sif_service=sif_service)
            suggestions = await link_agent.link_suggester(content)

        return {
            "success": True,
            "section_id": request.section_id,
            "suggestions": suggestions or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run internal link tools: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/section/tools/fact-check")
async def section_fact_check_tools(
    request: BlogSectionToolRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id"))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")

        from services.intelligence.sif_integration import SIFIntegrationService
        from services.intelligence.sif_agents import CitationExpert

        sif_service = SIFIntegrationService(user_id)
        intelligence = sif_service.intelligence_service

        expert = CitationExpert(intelligence)
        content = (request.content or "").strip()

        verification = await expert.claim_verifier(content)

        topic = request.title or content[:120]
        citations = await expert.citation_finder(topic)

        return {
            "success": True,
            "section_id": request.section_id,
            "verification": verification,
            "citations": citations or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run fact check tools: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/section/tools/optimize")
async def section_optimize_tools(
    request: BlogSectionToolRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id"))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")

        content = (request.content or "").strip()
        if len(content) < 50:
            return {
                "success": False,
                "section_id": request.section_id,
                "error": "Content too short for optimization",
            }

        goal = request.goal or "readability"
        keywords_str = ", ".join(request.keywords or [])

        system_prompt = (
            "You are an expert editor. Optimize the provided blog section while preserving meaning and tone."
        )
        prompt = (
            f"Optimization goal: {goal}\n"
            f"Target keywords (if any): {keywords_str}\n"
            f"Section title: {request.title or ''}\n\n"
            "Return a JSON object with keys:\n"
            '- optimized_content: string\n'
            '- changes_made: array of strings\n'
            "- diff_summary: string\n\n"
            f"Section content:\n{content}\n"
        )

        json_struct = {
            "type": "object",
            "properties": {
                "optimized_content": {"type": "string"},
                "changes_made": {"type": "array", "items": {"type": "string"}},
                "diff_summary": {"type": "string"},
            },
            "required": ["optimized_content", "changes_made", "diff_summary"],
        }

        raw = llm_text_gen(prompt=prompt, system_prompt=system_prompt, json_struct=json_struct, user_id=user_id)
        data = None
        try:
            import json as _json

            data = _json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            data = {
                "optimized_content": raw,
                "changes_made": ["Optimization applied"],
                "diff_summary": "Generated optimized version",
            }

        return {
            "success": True,
            "section_id": request.section_id,
            "optimized_content": data.get("optimized_content"),
            "changes_made": data.get("changes_made", []),
            "diff_summary": data.get("diff_summary"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to run optimize tools: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/health")
async def health() -> Dict[str, Any]:
    """Health check endpoint."""
    return {"status": "ok", "service": "ai_blog_writer"}


# Research Endpoints
@router.post("/research/start")
async def start_research(
    request: BlogResearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start a research operation and return a task ID for polling."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        task_id = await task_manager.start_research_task(request, user_id)
        return {"task_id": task_id, "status": "started"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start research: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/research/status/{task_id}")
async def get_research_status(task_id: str) -> Dict[str, Any]:
    """Get the status of a research operation."""
    try:
        status = await task_manager.get_task_status(task_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # If task failed with subscription error, return HTTP error so frontend interceptor can catch it
        if status.get('status') == 'failed' and status.get('error_status') in [429, 402]:
            error_data = status.get('error_data', {}) or {}
            error_status = status.get('error_status', 429)

            if not isinstance(error_data, dict):
                logger.warning(f"Research task {task_id} error_data not dict: {error_data}")
                error_data = {'error': str(error_data)}

            # Determine provider and usage info
            stored_error_message = status.get('error', error_data.get('error'))
            provider = error_data.get('provider', 'unknown')
            usage_info = error_data.get('usage_info')

            if not usage_info:
                usage_info = {
                    'provider': provider,
                    'message': stored_error_message,
                    'error_type': error_data.get('error_type', 'unknown')
                }
                # Include any known fields from error_data
                for key in ['current_tokens', 'requested_tokens', 'limit', 'current_calls']:
                    if key in error_data:
                        usage_info[key] = error_data[key]

            # Build error message for detail
            error_msg = error_data.get('message', stored_error_message or 'Subscription limit exceeded')
            
            # Log the subscription error with all context
            logger.warning(f"Research task {task_id} failed with subscription error {error_status}: {error_msg}")
            logger.warning(f"   Provider: {provider}, Usage Info: {usage_info}")
            
            # Use JSONResponse to ensure detail is returned as-is, not wrapped in an array
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=error_status,
                content={
                    'error': error_data.get('error', stored_error_message or 'Subscription limit exceeded'),
                    'message': error_msg,
                    'provider': provider,
                    'usage_info': usage_info
                }
            )
        
        logger.info(f"Research status request for {task_id}: {status['status']} with {len(status.get('progress_messages', []))} progress messages")
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get research status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Outline Endpoints
@router.post("/outline/start")
async def start_outline_generation(
    request: BlogOutlineRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start an outline generation operation and return a task ID for polling."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")
        
        task_id = task_manager.start_outline_task(request, user_id)
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to start outline generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/outline/status/{task_id}")
async def get_outline_status(task_id: str) -> Dict[str, Any]:
    """Get the status of an outline generation operation."""
    try:
        status = await task_manager.get_task_status(task_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get outline status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/outline/refine", response_model=BlogOutlineResponse)
async def refine_outline(request: BlogOutlineRefineRequest) -> BlogOutlineResponse:
    """Refine an existing outline with AI improvements."""
    try:
        return await service.refine_outline(request)
    except Exception as e:
        logger.error(f"Failed to refine outline: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/outline/enhance-section")
async def enhance_section(section_data: Dict[str, Any], focus: str = "general improvement"):
    """Enhance a specific section with AI improvements."""
    try:
        from models.blog_models import BlogOutlineSection
        section = BlogOutlineSection(**section_data)
        enhanced_section = await service.enhance_section_with_ai(section, focus)
        return enhanced_section.dict()
    except Exception as e:
        logger.error(f"Failed to enhance section: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/outline/optimize")
async def optimize_outline(outline_data: Dict[str, Any], focus: str = "general optimization"):
    """Optimize entire outline for better flow, SEO, and engagement."""
    try:
        from models.blog_models import BlogOutlineSection
        outline = [BlogOutlineSection(**section) for section in outline_data.get('outline', [])]
        optimized_outline = await service.optimize_outline_with_ai(outline, focus)
        return {"outline": [section.dict() for section in optimized_outline]}
    except Exception as e:
        logger.error(f"Failed to optimize outline: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/outline/rebalance")
async def rebalance_outline(outline_data: Dict[str, Any], target_words: int = 1500):
    """Rebalance word count distribution across outline sections."""
    try:
        from models.blog_models import BlogOutlineSection
        outline = [BlogOutlineSection(**section) for section in outline_data.get('outline', [])]
        rebalanced_outline = service.rebalance_word_counts(outline, target_words)
        return {"outline": [section.dict() for section in rebalanced_outline]}
    except Exception as e:
        logger.error(f"Failed to rebalance outline: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Content Generation Endpoints
@router.post("/section/generate", response_model=BlogSectionResponse)
async def generate_section(
    request: BlogSectionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> BlogSectionResponse:
    """Generate content for a specific section."""
    try:
        user_id = str(current_user.get('id', '')) if current_user else None
        response = await service.generate_section(request, user_id=user_id)
        
        # Save and track text content (non-blocking)
        if response.markdown:
            try:
                user_id = str(current_user.get('id', '')) if current_user else None
                if user_id:
                    section_heading = getattr(request, 'section_heading', getattr(request, 'heading', 'Section'))
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=response.markdown,
                        source_module="blog_writer",
                        title=f"Blog Section: {section_heading[:60]}",
                        description=f"Blog section content",
                        prompt=f"Section: {section_heading}\nKeywords: {getattr(request, 'keywords', [])}",
                        tags=["blog", "section", "content"],
                        asset_metadata={
                            "section_id": getattr(request, 'section_id', None),
                            "word_count": len(response.markdown.split()),
                        },
                        subdirectory="sections",
                        file_extension=".md"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track blog section asset: {track_error}")
        
        return response
    except Exception as e:
        logger.error(f"Failed to generate section: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/content/start")
async def start_content_generation(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Start full content generation and return a task id for polling.

    Accepts a payload compatible with MediumBlogGenerateRequest to minimize duplication.
    """
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")
        
        # Map dict to MediumBlogGenerateRequest for reuse
        from models.blog_models import MediumBlogGenerateRequest, MediumSectionOutline, PersonaInfo
        sections = [MediumSectionOutline(**s) for s in request.get("sections", [])]
        persona = None
        if request.get("persona"):
            persona = PersonaInfo(**request.get("persona"))
        req = MediumBlogGenerateRequest(
            title=request.get("title", "Untitled Blog"),
            sections=sections,
            persona=persona,
            tone=request.get("tone"),
            audience=request.get("audience"),
            globalTargetWords=request.get("globalTargetWords", 1000),
            researchKeywords=request.get("researchKeywords") or request.get("keywords"),
        )
        task_id = task_manager.start_content_generation_task(req, user_id)
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to start content generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/content/status/{task_id}")
async def content_generation_status(
    task_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Poll status for content generation task."""
    try:
        status = await task_manager.get_task_status(task_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Track blog content when task completes (non-blocking)
        if status.get('status') == 'completed' and status.get('result'):
            try:
                result = status.get('result', {})
                if result.get('sections') and len(result.get('sections', [])) > 0:
                    user_id = str(current_user.get('id', '')) if current_user else None
                    if user_id:
                        # Combine all sections into full blog content
                        blog_content = f"# {result.get('title', 'Untitled Blog')}\n\n"
                        for section in result.get('sections', []):
                            blog_content += f"\n## {section.get('heading', 'Section')}\n\n{section.get('content', '')}\n\n"
                        
                        save_and_track_text_content(
                            db=db,
                            user_id=user_id,
                            content=blog_content,
                            source_module="blog_writer",
                            title=f"Blog: {result.get('title', 'Untitled Blog')[:60]}",
                            description=f"Complete blog post with {len(result.get('sections', []))} sections",
                            prompt=f"Title: {result.get('title', 'Untitled')}\nSections: {len(result.get('sections', []))}",
                            tags=["blog", "complete", "content"],
                            asset_metadata={
                                "section_count": len(result.get('sections', [])),
                                "model": result.get('model'),
                            },
                            subdirectory="complete",
                            file_extension=".md"
                        )
            except Exception as track_error:
                logger.warning(f"Failed to track blog content asset: {track_error}")
        
        # If task failed with subscription error, return HTTP error so frontend interceptor can catch it
        if status.get('status') == 'failed' and status.get('error_status') in [429, 402]:
            error_data = status.get('error_data', {}) or {}
            error_status = status.get('error_status', 429)
            
            if not isinstance(error_data, dict):
                logger.warning(f"Content generation task {task_id} error_data not dict: {error_data}")
                error_data = {'error': str(error_data)}
            
            # Determine provider and usage info
            stored_error_message = status.get('error', error_data.get('error'))
            provider = error_data.get('provider', 'unknown')
            usage_info = error_data.get('usage_info')
            
            if not usage_info:
                usage_info = {
                    'provider': provider,
                    'message': stored_error_message,
                    'error_type': error_data.get('error_type', 'unknown')
                }
                # Include any known fields from error_data
                for key in ['current_tokens', 'requested_tokens', 'limit', 'current_calls']:
                    if key in error_data:
                        usage_info[key] = error_data[key]
            
            # Build error message for detail
            error_msg = error_data.get('message', stored_error_message or 'Subscription limit exceeded')
            
            # Log the subscription error with all context
            logger.warning(f"Content generation task {task_id} failed with subscription error {error_status}: {error_msg}")
            logger.warning(f"   Provider: {provider}, Usage Info: {usage_info}")
            
            # Use JSONResponse to ensure detail is returned as-is, not wrapped in an array
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=error_status,
                content={
                    'error': error_data.get('error', stored_error_message or 'Subscription limit exceeded'),
                    'message': error_msg,
                    'provider': provider,
                    'usage_info': usage_info
                }
            )
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get content generation status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/section/{section_id}/continuity")
async def get_section_continuity(section_id: str) -> Dict[str, Any]:
    """Fetch last computed continuity metrics for a section (if available)."""
    try:
        # Access the in-memory continuity from the generator
        gen = service.content_generator
        # Find the last stored summary for the given section id
        # For now, expose the most recent metrics if the section was just generated
        # We keep a small in-memory snapshot on the generator object
        continuity: Dict[str, Any] = getattr(gen, "_last_continuity", {})
        metrics = continuity.get(section_id)
        return {"section_id": section_id, "continuity_metrics": metrics}
    except Exception as e:
        logger.error(f"Failed to get section continuity for {section_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/flow-analysis/basic")
async def analyze_flow_basic(request: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Analyze flow metrics for entire blog using single AI call (cost-effective)."""
    try:
        user_id = str(current_user.get('id', '')) if current_user else None
        request['user_id'] = user_id
        result = await service.analyze_flow_basic(request)
        return result
    except Exception as e:
        logger.error(f"Failed to perform basic flow analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/flow-analysis/advanced")
async def analyze_flow_advanced(request: Dict[str, Any], current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Analyze flow metrics for each section individually (detailed but expensive)."""
    try:
        user_id = str(current_user.get('id', '')) if current_user else None
        request['user_id'] = user_id
        result = await service.analyze_flow_advanced(request)
        return result
    except Exception as e:
        logger.error(f"Failed to perform advanced flow analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/section/optimize", response_model=BlogOptimizeResponse)
async def optimize_section(
    request: BlogOptimizeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> BlogOptimizeResponse:
    """Optimize a specific section for better quality and engagement."""
    try:
        response = await service.optimize_section(request)
        
        # Save and track text content (non-blocking)
        if response.optimized:
            try:
                user_id = str(current_user.get('id', '')) if current_user else None
                if user_id:
                    save_and_track_text_content(
                        db=db,
                        user_id=user_id,
                        content=response.optimized,
                        source_module="blog_writer",
                        title=f"Optimized Blog Section",
                        description=f"Optimized blog section content",
                        prompt=f"Original Content: {request.content[:200]}\nGoals: {request.goals}",
                        tags=["blog", "section", "optimized"],
                        asset_metadata={
                            "optimization_goals": request.goals,
                            "word_count": len(response.optimized.split()),
                        },
                        subdirectory="sections/optimized",
                        file_extension=".md"
                    )
            except Exception as track_error:
                logger.warning(f"Failed to track optimized blog section asset: {track_error}")
        
        return response
    except Exception as e:
        logger.error(f"Failed to optimize section: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Quality Assurance Endpoints
@router.post("/quality/hallucination-check", response_model=HallucinationCheckResponse)
async def hallucination_check(request: HallucinationCheckRequest) -> HallucinationCheckResponse:
    """Check content for potential hallucinations and factual inaccuracies."""
    try:
        return await service.hallucination_check(request)
    except Exception as e:
        logger.error(f"Failed to perform hallucination check: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# SEO Endpoints
@router.post("/seo/analyze", response_model=BlogSEOAnalyzeResponse)
async def seo_analyze(
    request: BlogSEOAnalyzeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> BlogSEOAnalyzeResponse:
    """Analyze content for SEO optimization opportunities."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        return await service.seo_analyze(request, user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to perform SEO analysis: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/seo/metadata", response_model=BlogSEOMetadataResponse)
async def seo_metadata(
    request: BlogSEOMetadataRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> BlogSEOMetadataResponse:
    """Generate SEO metadata for the blog post."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        return await service.seo_metadata(request, user_id=user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate SEO metadata: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Publishing Endpoints
# NOTE: Real publishing bypasses this stub. Frontend calls platform-specific
# endpoints directly: /api/wix/publish and /api/wordpress/publish.
# This endpoint is kept as a placeholder for the future unified publish flow.
@router.post("/publish", response_model=BlogPublishResponse)
async def publish(request: BlogPublishRequest) -> BlogPublishResponse:
    """Publish the blog post to the specified platform. [STUB - see note above]"""
    try:
        return await service.publish(request)
    except Exception as e:
        logger.error(f"Failed to publish blog: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Cache Management Endpoints
@router.get("/cache/stats")
async def get_cache_stats() -> Dict[str, Any]:
    """Get research cache statistics."""
    try:
        return cache_manager.get_research_cache_stats()
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/cache/clear")
async def clear_cache() -> Dict[str, Any]:
    """Clear the research cache."""
    try:
        return cache_manager.clear_research_cache()
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/cache/outline/stats")
async def get_outline_cache_stats():
    """Get outline cache statistics."""
    try:
        return cache_manager.get_outline_cache_stats()
    except Exception as e:
        logger.error(f"Failed to get outline cache stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/cache/outline/clear")
async def clear_outline_cache():
    """Clear all cached outline entries."""
    try:
        return cache_manager.clear_outline_cache()
    except Exception as e:
        logger.error(f"Failed to clear outline cache: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/cache/outline/invalidate")
async def invalidate_outline_cache(request: Dict[str, List[str]]):
    """Invalidate outline cache entries for specific keywords."""
    try:
        return cache_manager.invalidate_outline_cache_for_keywords(request["keywords"])
    except Exception as e:
        logger.error(f"Failed to invalidate outline cache: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/cache/outline/entries")
async def get_outline_cache_entries(limit: int = 20):
    """Get recent outline cache entries for debugging."""
    try:
        return cache_manager.get_recent_outline_cache_entries(limit)
    except Exception as e:
        logger.error(f"Failed to get outline cache entries: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------
# Medium Blog Generation API
# ---------------------------

@router.post("/generate/medium/start")
async def start_medium_generation(
    request: MediumBlogGenerateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Start medium-length blog generation (≤1000 words) and return a task id."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get('id'))
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in authentication token")
        
        # Simple server-side guard
        if (request.globalTargetWords or 1000) > 1000:
            raise HTTPException(status_code=400, detail="Global target words exceed 1000; use per-section generation")

        task_id = task_manager.start_medium_generation_task(request, user_id)
        return {"task_id": task_id, "status": "started"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start medium generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/generate/medium/status/{task_id}")
async def medium_generation_status(
    task_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Poll status for medium blog generation task."""
    try:
        status = await task_manager.get_task_status(task_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Track blog content when task completes (non-blocking)
        if status.get('status') == 'completed' and status.get('result'):
            try:
                result = status.get('result', {})
                if result.get('sections') and len(result.get('sections', [])) > 0:
                    user_id = str(current_user.get('id', '')) if current_user else None
                    if user_id:
                        # Combine all sections into full blog content
                        blog_content = f"# {result.get('title', 'Untitled Blog')}\n\n"
                        for section in result.get('sections', []):
                            blog_content += f"\n## {section.get('heading', 'Section')}\n\n{section.get('content', '')}\n\n"
                        
                        save_and_track_text_content(
                            db=db,
                            user_id=user_id,
                            content=blog_content,
                            source_module="blog_writer",
                            title=f"Medium Blog: {result.get('title', 'Untitled Blog')[:60]}",
                            description=f"Medium-length blog post with {len(result.get('sections', []))} sections",
                            prompt=f"Title: {result.get('title', 'Untitled')}\nSections: {len(result.get('sections', []))}",
                            tags=["blog", "medium", "complete"],
                            asset_metadata={
                                "section_count": len(result.get('sections', [])),
                                "model": result.get('model'),
                                "generation_time_ms": result.get('generation_time_ms'),
                            },
                            subdirectory="medium",
                            file_extension=".md"
                        )
            except Exception as track_error:
                logger.warning(f"Failed to track medium blog asset: {track_error}")
        
        # If task failed with subscription error, return HTTP error so frontend interceptor can catch it
        if status.get('status') == 'failed' and status.get('error_status') in [429, 402]:
            error_data = status.get('error_data', {}) or {}
            error_status = status.get('error_status', 429)
            
            if not isinstance(error_data, dict):
                logger.warning(f"Medium generation task {task_id} error_data not dict: {error_data}")
                error_data = {'error': str(error_data)}
            
            # Determine provider and usage info
            stored_error_message = status.get('error', error_data.get('error'))
            provider = error_data.get('provider', 'unknown')
            usage_info = error_data.get('usage_info')
            
            if not usage_info:
                usage_info = {
                    'provider': provider,
                    'message': stored_error_message,
                    'error_type': error_data.get('error_type', 'unknown')
                }
                # Include any known fields from error_data
                for key in ['current_tokens', 'requested_tokens', 'limit', 'current_calls']:
                    if key in error_data:
                        usage_info[key] = error_data[key]
            
            # Build error message for detail
            error_msg = error_data.get('message', stored_error_message or 'Subscription limit exceeded')
            
            # Log the subscription error with all context
            logger.warning(f"Medium generation task {task_id} failed with subscription error {error_status}: {error_msg}")
            logger.warning(f"   Provider: {provider}, Usage Info: {usage_info}")
            
            # Use JSONResponse to ensure detail is returned as-is, not wrapped in an array
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=error_status,
                content={
                    'error': error_data.get('error', stored_error_message or 'Subscription limit exceeded'),
                    'message': error_msg,
                    'provider': provider,
                    'usage_info': usage_info
                }
            )
        
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get medium generation status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/rewrite/start")
async def start_blog_rewrite(request: Dict[str, Any]) -> Dict[str, Any]:
    """Start blog rewrite task with user feedback."""
    try:
        task_id = service.start_blog_rewrite(request)
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to start blog rewrite: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/rewrite/status/{task_id}")
async def rewrite_status(task_id: str):
    """Poll status for blog rewrite task."""
    try:
        status = await service.task_manager.get_task_status(task_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get rewrite status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/titles/generate-seo")
async def generate_seo_titles(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate 5 SEO-optimized blog titles using research and outline data."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        # Import here to avoid circular dependencies
        from services.blog_writer.outline.seo_title_generator import SEOTitleGenerator
        from models.blog_models import BlogResearchResponse, BlogOutlineSection
        
        # Parse request data
        research_data = request.get('research')
        outline_data = request.get('outline', [])
        primary_keywords = request.get('primary_keywords', [])
        secondary_keywords = request.get('secondary_keywords', [])
        content_angles = request.get('content_angles', [])
        search_intent = request.get('search_intent', 'informational')
        word_count = request.get('word_count', 1500)
        
        if not research_data:
            raise HTTPException(status_code=400, detail="Research data is required")
        
        # Convert to models
        research = BlogResearchResponse(**research_data)
        outline = [BlogOutlineSection(**section) for section in outline_data]
        
        # Generate titles
        title_generator = SEOTitleGenerator()
        titles = await title_generator.generate_seo_titles(
            research=research,
            outline=outline,
            primary_keywords=primary_keywords,
            secondary_keywords=secondary_keywords,
            content_angles=content_angles,
            search_intent=search_intent,
            word_count=word_count,
            user_id=user_id
        )
        
        # Save and track titles (non-blocking)
        if titles and len(titles) > 0:
            try:
                titles_content = "# SEO Blog Titles\n\n" + "\n".join([f"{i+1}. {title}" for i, title in enumerate(titles)])
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=titles_content,
                    source_module="blog_writer",
                    title=f"SEO Blog Titles: {primary_keywords[0] if primary_keywords else 'Blog'}",
                    description=f"SEO-optimized blog title suggestions",
                    prompt=f"Primary Keywords: {primary_keywords}\nSearch Intent: {search_intent}\nWord Count: {word_count}",
                    tags=["blog", "titles", "seo"],
                    asset_metadata={
                        "title_count": len(titles),
                        "primary_keywords": primary_keywords,
                        "search_intent": search_intent,
                    },
                    subdirectory="titles",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.warning(f"Failed to track SEO titles asset: {track_error}")
        
        return {
            "success": True,
            "titles": titles
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate SEO titles: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/introductions/generate")
async def generate_introductions(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Generate 3 varied blog introductions using research, outline, and content."""
    try:
        # Extract Clerk user ID (required)
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")
        
        # Import here to avoid circular dependencies
        from services.blog_writer.content.introduction_generator import IntroductionGenerator
        from models.blog_models import BlogResearchResponse, BlogOutlineSection
        
        # Parse request data
        blog_title = request.get('blog_title', '')
        research_data = request.get('research')
        outline_data = request.get('outline', [])
        sections_content = request.get('sections_content', {})
        primary_keywords = request.get('primary_keywords', [])
        search_intent = request.get('search_intent', 'informational')
        
        if not research_data:
            raise HTTPException(status_code=400, detail="Research data is required")
        if not blog_title:
            raise HTTPException(status_code=400, detail="Blog title is required")
        
        # Convert to models
        research = BlogResearchResponse(**research_data)
        outline = [BlogOutlineSection(**section) for section in outline_data]
        
        # Generate introductions
        intro_generator = IntroductionGenerator()
        introductions = await intro_generator.generate_introductions(
            blog_title=blog_title,
            research=research,
            outline=outline,
            sections_content=sections_content,
            primary_keywords=primary_keywords,
            search_intent=search_intent,
            user_id=user_id
        )
        
        # Save and track introductions (non-blocking)
        if introductions and len(introductions) > 0:
            try:
                intro_content = f"# Blog Introductions for: {blog_title}\n\n"
                for i, intro in enumerate(introductions, 1):
                    intro_content += f"## Introduction {i}\n\n{intro}\n\n"
                
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=intro_content,
                    source_module="blog_writer",
                    title=f"Blog Introductions: {blog_title[:60]}",
                    description=f"Blog introduction variations",
                    prompt=f"Blog Title: {blog_title}\nPrimary Keywords: {primary_keywords}\nSearch Intent: {search_intent}",
                    tags=["blog", "introductions"],
                    asset_metadata={
                        "introduction_count": len(introductions),
                        "blog_title": blog_title,
                        "search_intent": search_intent,
                    },
                    subdirectory="introductions",
                    file_extension=".md"
                )
            except Exception as track_error:
                logger.warning(f"Failed to track blog introductions asset: {track_error}")
        
        return {
            "success": True,
            "introductions": introductions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate introductions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------
# Save Complete Blog Asset
# ---------------------------


class SaveCompleteBlogAssetRequest(BaseModel):
    title: str
    content: str
    platform: Optional[str] = None
    post_url: Optional[str] = None
    post_id: Optional[str] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    focus_keyword: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)


@router.post("/save-complete-asset")
async def save_complete_blog_asset(
    request: SaveCompleteBlogAssetRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Save the complete blog content as a single asset in the asset library."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

        full_content = f"# {request.title}\n\n{request.content}"

        asset_metadata = {
            "status": "published",
            "focus_keyword": request.focus_keyword,
            "categories": request.categories,
            "word_count": len(full_content.split()),
        }
        if request.platform:
            asset_metadata["platform"] = request.platform
        if request.post_url:
            asset_metadata["post_url"] = request.post_url
        if request.post_id:
            asset_metadata["post_id"] = request.post_id

        asset_id = save_and_track_text_content(
            db=db,
            user_id=user_id,
            content=full_content,
            source_module="blog_writer",
            title=request.title[:100],
            description=request.meta_description or f"Complete published blog post: {request.title}",
            prompt=f"SEO Title: {request.seo_title or request.title}\nFocus Keyword: {request.focus_keyword or ''}",
            tags=["blog", "published"] + [t for t in (request.tags or []) if t],
            asset_metadata=asset_metadata,
            subdirectory="published",
            file_extension=".md"
        )

        if asset_id:
            logger.info(f"✅ Complete blog asset saved to library: ID={asset_id}")
            return {"success": True, "asset_id": asset_id}
        else:
            logger.warning("save_and_track_text_content returned None for published blog")
            return {"success": False, "error": "Failed to save blog asset"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save complete blog asset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/publish-history")
async def get_publish_history(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Get publish history for the current user from the asset library."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

        svc = ContentAssetService(db)
        assets, total = svc.get_user_assets(
            user_id=user_id,
            tags=["published"],
            source_module=AssetSource.BLOG_WRITER,
            sort_by="created_at",
            sort_order="desc",
            limit=limit,
            offset=offset,
        )

        entries = []
        for a in assets:
            meta = a.asset_metadata or {}
            entries.append({
                "asset_id": a.id,
                "title": a.title,
                "platform": meta.get("platform", "unknown"),
                "post_url": meta.get("post_url"),
                "post_id": meta.get("post_id"),
                "word_count": meta.get("word_count", 0),
                "focus_keyword": meta.get("focus_keyword"),
                "categories": meta.get("categories", []),
                "published_at": a.created_at.isoformat() if a.created_at else None,
            })

        return {"success": True, "entries": entries, "total": total}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get publish history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/analytics/summary")
async def get_blog_analytics_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Lightweight analytics summary powering the Blog Writer radial workflow hero.

    Pure read aggregation over the current user's existing ContentAsset rows
    (source_module=blog_writer) — no new tables, no schema changes. Feeds the
    Plan / Create / Publish / Analysis / Engagement / Remarket wedge badges.
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")

        user_id = str(current_user.get("id", ""))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID in authentication token")

        svc = ContentAssetService(db)
        assets, _ = svc.get_user_assets(
            user_id=user_id,
            source_module=AssetSource.BLOG_WRITER,
            asset_type=AssetType.TEXT,
            sort_by="created_at",
            sort_order="desc",
            limit=500,
        )

        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        ninety_days_ago = now - timedelta(days=90)

        research_sessions_7d = 0
        drafts_in_progress = 0
        published_30d = 0
        platform_breakdown: Dict[str, int] = {}
        seo_scores: List[float] = []
        pending_recommendations = 0
        refresh_candidates: List[Dict[str, Any]] = []
        most_recent_draft: Optional[Dict[str, Any]] = None

        # `assets` is already sorted created_at desc, so the first draft-phase
        # asset encountered is the most recently touched one.
        for asset in assets:
            meta = asset.asset_metadata or {}
            phase = meta.get("phase")
            tags = asset.tags or []
            created_at = asset.created_at

            if created_at and created_at >= seven_days_ago:
                research_sessions_7d += 1

            if phase in ("outline", "content"):
                drafts_in_progress += 1
                if most_recent_draft is None:
                    most_recent_draft = {
                        "asset_id": asset.id,
                        "title": asset.title,
                        "phase": phase,
                    }

            is_published = "published" in tags or phase == "publish"
            if is_published and created_at and created_at >= thirty_days_ago:
                published_30d += 1
                publish_data = meta.get("publish_data") or {}
                platform = (publish_data.get("platform") if isinstance(publish_data, dict) else None) or "unknown"
                platform_breakdown[platform] = platform_breakdown.get(platform, 0) + 1

            seo_data = meta.get("seo_data")
            seo_score = None
            if isinstance(seo_data, dict):
                seo_score = seo_data.get("seo_score")
                recs = seo_data.get("recommendations") or []
                if isinstance(recs, list):
                    pending_recommendations += len(recs)
            if isinstance(seo_score, (int, float)):
                seo_scores.append(float(seo_score))

            if is_published:
                is_stale = bool(created_at and created_at <= ninety_days_ago)
                is_low_score = isinstance(seo_score, (int, float)) and seo_score < 70
                if is_stale or is_low_score:
                    refresh_candidates.append({
                        "asset_id": asset.id,
                        "title": asset.title,
                        "seo_score": seo_score,
                        "published_at": created_at.isoformat() if created_at else None,
                    })

        # Lowest-scoring / stalest candidates first (None scores sort last).
        refresh_candidates.sort(
            key=lambda c: (c["seo_score"] is None, c["seo_score"] if c["seo_score"] is not None else 0)
        )
        refresh_candidates = refresh_candidates[:5]

        avg_seo_score = round(sum(seo_scores) / len(seo_scores), 1) if seo_scores else None

        return {
            "success": True,
            "research_sessions_7d": research_sessions_7d,
            "drafts_in_progress": drafts_in_progress,
            "published_30d": published_30d,
            "platform_breakdown": platform_breakdown,
            "avg_seo_score": avg_seo_score,
            "analyzed_count": len(seo_scores),
            "pending_seo_recommendations": pending_recommendations,
            "refresh_candidates": refresh_candidates,
            "most_recent_draft": most_recent_draft,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get blog analytics summary: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ---------------------------------------
# Blog Asset API (phase-by-phase saving via ContentAsset)
# ---------------------------------------


class BlogAssetCreateRequest(BaseModel):
    research_keywords: str = Field(..., max_length=2000, description="Research keywords / topic")
    topic: Optional[str] = Field(default=None, max_length=500)
    word_count_target: Optional[int] = Field(default=None, ge=100, le=20000)


class BlogAssetUpdateRequest(BaseModel):
    phase: Optional[str] = Field(default=None, pattern=r"^(research|outline|content|seo|publish)$")
    topic: Optional[str] = Field(default=None, max_length=500)
    selected_title: Optional[str] = Field(default=None, max_length=500)
    word_count_target: Optional[int] = Field(default=None, ge=100, le=20000)
    research_data: Optional[Dict[str, Any]] = None
    outline_data: Optional[Dict[str, Any]] = None
    content_data: Optional[Dict[str, Any]] = None
    seo_data: Optional[Dict[str, Any]] = None
    publish_data: Optional[Dict[str, Any]] = None


def _normalize_keywords(kw: str) -> str:
    """Normalize keywords for duplicate comparison."""
    return " ".join(sorted(kw.lower().split()))


@router.post("/asset", response_model=Dict[str, Any])
async def create_blog_asset(
    request: BlogAssetCreateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a blog ContentAsset on research start.
    Returns existing asset if duplicate keywords found (unique topics only).
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id", ""))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")

        svc = ContentAssetService(db)
        normalized_kw = _normalize_keywords(request.research_keywords)

        # Duplicate check — search existing blog assets for matching keywords
        existing_assets, _ = svc.get_user_assets(
            user_id=user_id,
            source_module=AssetSource.BLOG_WRITER,
            asset_type=AssetType.TEXT,
            limit=100,
        )
        for asset in existing_assets:
            meta = asset.asset_metadata or {}
            if meta.get("normalized_keywords") == normalized_kw:
                logger.info(f"Duplicate blog asset found: {asset.id}, returning existing")
                return {
                    "success": True,
                    "asset": _asset_to_response(asset),
                    "existing": True,
                }

        # Create new ContentAsset for this blog
        title = request.topic or request.research_keywords[:200]
        asset_metadata = {
            "phase": "research",
            "research_keywords": request.research_keywords,
            "normalized_keywords": normalized_kw,
            "word_count_target": request.word_count_target,
            "topic": request.topic,
            "research_data": None,
            "outline_data": None,
            "content_data": None,
            "seo_data": None,
            "publish_data": None,
        }
        asset = svc.create_asset(
            user_id=user_id,
            asset_type=AssetType.TEXT,
            source_module=AssetSource.BLOG_WRITER,
            filename=f"blog_{int(datetime.utcnow().timestamp())}.md",
            file_url=f"/api/blog/content/pending",
            title=title,
            description=f"Blog: {title}",
            tags=["blog", "research"],
            asset_metadata=asset_metadata,
        )
        logger.info(f"✅ Created blog asset: {asset.id}")
        return {
            "success": True,
            "asset": _asset_to_response(asset),
            "existing": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create blog asset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/asset/{asset_id}", response_model=Dict[str, Any])
async def update_blog_asset(
    asset_id: int,
    request: BlogAssetUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a blog asset's phase, metadata, and tags."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id", ""))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")

        svc = ContentAssetService(db)
        asset = svc.get_asset_by_id(asset_id, user_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Blog asset not found")

        meta = dict(asset.asset_metadata or {})
        tags = list(asset.tags or [])

        if request.phase is not None:
            meta["phase"] = request.phase
            # Update tags to reflect phase
            new_tags = [t for t in tags if t not in ("research", "outline", "content", "seo", "publish")]
            new_tags.append(request.phase)
            if "blog" not in new_tags:
                new_tags.append("blog")
            tags = new_tags

        if request.topic is not None:
            meta["topic"] = request.topic
        if request.selected_title is not None:
            meta["selected_title"] = request.selected_title
        if request.word_count_target is not None:
            meta["word_count_target"] = request.word_count_target

        for field in ("research_data", "outline_data", "content_data", "seo_data", "publish_data"):
            val = getattr(request, field, None)
            if val is not None:
                meta[field] = val

        # Prefer seo_title from publish_data, then selected_title, then topic, then existing title
        publish_data = meta.get("publish_data") or {}
        if isinstance(publish_data, dict) and publish_data.get("seo_title"):
            new_title = publish_data["seo_title"]
        elif meta.get("selected_title"):
            new_title = meta["selected_title"]
        elif meta.get("topic"):
            new_title = meta["topic"]
        else:
            new_title = asset.title or "Blog Post"

        updated = svc.update_asset(
            asset_id=asset_id,
            user_id=user_id,
            title=new_title[:500],
            tags=tags,
            asset_metadata=meta,
        )
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update asset")

        logger.info(f"✅ Updated blog asset {asset_id}: phase={meta.get('phase')}")
        return {"success": True, "asset": _asset_to_response(updated)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update blog asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/asset/{asset_id}", response_model=Dict[str, Any])
async def get_blog_asset(
    asset_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a blog asset with all phase data."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = str(current_user.get("id", ""))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")

        svc = ContentAssetService(db)
        asset = svc.get_asset_by_id(asset_id, user_id)
        if not asset:
            raise HTTPException(status_code=404, detail="Blog asset not found")

        return {"success": True, "asset": _asset_to_response(asset, full=True)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get blog asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def _asset_to_response(asset: Any, full: bool = False) -> Dict[str, Any]:
    """Convert a ContentAsset to a blog asset response dict."""
    meta = asset.asset_metadata or {}
    resp: Dict[str, Any] = {
        "id": asset.id,
        "title": asset.title,
        "description": asset.description,
        "tags": asset.tags or [],
        "phase": meta.get("phase", "research"),
        "research_keywords": meta.get("research_keywords"),
        "topic": meta.get("topic"),
        "selected_title": meta.get("selected_title"),
        "word_count_target": meta.get("word_count_target"),
        "has_research": meta.get("research_data") is not None,
        "has_outline": meta.get("outline_data") is not None,
        "has_content": meta.get("content_data") is not None,
        "has_seo": meta.get("seo_data") is not None,
        "has_publish": meta.get("publish_data") is not None,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None,
    }
    if full:
        resp["research_data"] = meta.get("research_data")
        resp["outline_data"] = meta.get("outline_data")
        resp["content_data"] = meta.get("content_data")
        resp["seo_data"] = meta.get("seo_data")
        resp["publish_data"] = meta.get("publish_data")
    return resp
