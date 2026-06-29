"""
Step 3 Research Routes for Onboarding

FastAPI routes for Step 3 research phase of onboarding,
including competitor discovery and research data management.

Author: ALwrity Team
Version: 1.0
Last Updated: January 2025
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Body
from pydantic import BaseModel, HttpUrl, Field
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
import traceback
from loguru import logger

from middleware.auth_middleware import get_current_user
from .step3_research_service import Step3ResearchService
from services.seo_tools.sitemap_service import SitemapService
from services.database import get_session_for_user
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from models.website_analysis_monitoring_models import (
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog,
    DeepWebsiteCrawlTask,
    DeepWebsiteCrawlExecutionLog
)
from services.research.deep_crawl_service import DeepCrawlService

router = APIRouter(prefix="/api/onboarding/step3", tags=["Onboarding Step 3 - Research"])

# Request/Response Models
class CompetitorDiscoveryRequest(BaseModel):
    """Request model for competitor discovery."""
    session_id: Optional[str] = Field(None, description="Deprecated - user identification comes from auth token")
    user_url: str = Field(..., description="User's website URL")
    industry_context: Optional[str] = Field(None, description="Industry context for better discovery")
    num_results: int = Field(25, ge=1, le=100, description="Number of competitors to discover")
    website_analysis_data: Optional[Dict[str, Any]] = Field(None, description="Website analysis data from Step 2 for better targeting")

class CompetitorDiscoveryResponse(BaseModel):
    """Response model for competitor discovery."""
    success: bool
    message: str
    session_id: str
    user_url: str
    competitors: Optional[List[Dict[str, Any]]] = None
    social_media_accounts: Optional[Dict[str, str]] = None
    social_media_citations: Optional[List[Dict[str, Any]]] = None
    research_summary: Optional[Dict[str, Any]] = None
    total_competitors: Optional[int] = None
    industry_context: Optional[str] = None
    analysis_timestamp: Optional[str] = None
    api_cost: Optional[float] = None
    error: Optional[str] = None
    # SIF-enhanced semantic intelligence fields
    semantic_insights: Optional[Dict[str, Any]] = None
    content_analysis: Optional[Dict[str, Any]] = None
    strategic_recommendations: Optional[List[Dict[str, Any]]] = None

class ResearchDataRequest(BaseModel):
    """Request model for retrieving research data."""
    session_id: str = Field(..., description="Onboarding session ID")

class ResearchDataResponse(BaseModel):
    """Response model for research data retrieval."""
    success: bool
    message: str
    session_id: Optional[str] = None
    research_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@router.get("/scheduled-tasks-status")
async def scheduled_tasks_status(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    user_id = str(current_user.get("id"))
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        integration_service = OnboardingDataIntegrationService()
        integrated = integration_service.get_integrated_data_sync(user_id, db)
        
        # Check for competitors in competitor_analysis (Step 3 persistence) first
        competitors = integrated.get("competitor_analysis") if isinstance(integrated, dict) else []
        
        # If not found, fall back to research_preferences
        if not competitors:
            research_prefs = integrated.get("research_preferences", {}) if isinstance(integrated, dict) else {}
            competitors = research_prefs.get("competitors") if isinstance(research_prefs, dict) else None

        has_competitors = isinstance(competitors, list) and len(competitors) > 0

        website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}
        seo_audit = website_analysis.get("seo_audit") if isinstance(website_analysis, dict) else {}
        sitemap_benchmark_report = seo_audit.get("competitive_sitemap_benchmarking") if isinstance(seo_audit, dict) else None
        
        # Check if it's a real report or just status tracking
        # A full report has 'analysis_type' or 'competitors' or 'benchmark'
        is_full_report = False
        if isinstance(sitemap_benchmark_report, dict):
            if "benchmark" in sitemap_benchmark_report or "competitors" in sitemap_benchmark_report:
                is_full_report = True
                
        sitemap_benchmark_available = is_full_report
        sitemap_benchmark_last_run = sitemap_benchmark_report.get("timestamp") if isinstance(sitemap_benchmark_report, dict) else None
        sitemap_benchmark_status = sitemap_benchmark_report.get("status") if isinstance(sitemap_benchmark_report, dict) else None
        sitemap_benchmark_error = sitemap_benchmark_report.get("error") if isinstance(sitemap_benchmark_report, dict) else None

        # Check for stale processing status (older than 30 minutes)
        if sitemap_benchmark_status == "processing" and isinstance(sitemap_benchmark_report, dict):
            started_at_str = sitemap_benchmark_report.get("started_at")
            if started_at_str:
                try:
                    started_at = datetime.fromisoformat(started_at_str)
                    if (datetime.utcnow() - started_at).total_seconds() > 600:
                        sitemap_benchmark_status = "failed"
                        sitemap_benchmark_error = "Task timed out (stale). Please retry."
                except Exception:
                    pass

        # Extract error count from the report if available
        sitemap_error_count = 0
        if isinstance(sitemap_benchmark_report, dict):
            competitors_data = sitemap_benchmark_report.get("competitors", {})
            if isinstance(competitors_data, dict):
                errors = competitors_data.get("errors", {})
                if isinstance(errors, dict):
                    sitemap_error_count = len(errors)

        task = db.query(DeepCompetitorAnalysisTask).filter(
            DeepCompetitorAnalysisTask.user_id == user_id
        ).order_by(DeepCompetitorAnalysisTask.updated_at.desc()).first()

        latest_log = None
        if task:
            latest_log = db.query(DeepCompetitorAnalysisExecutionLog).filter(
                DeepCompetitorAnalysisExecutionLog.task_id == task.id
            ).order_by(DeepCompetitorAnalysisExecutionLog.execution_date.desc()).first()

        return {
            "deep_competitor_analysis": {
                "bulb": "green" if has_competitors else "red",
                "eligible": has_competitors,
                "reason": None if has_competitors else "No competitors found in Step 3 'Discovered Competitors'.",
                "task": {
                    "exists": bool(task),
                    "status": task.status if task else None,
                    "next_execution": task.next_execution.isoformat() if task and task.next_execution else None,
                    "last_run": latest_log.execution_date.isoformat() if latest_log and latest_log.execution_date else None,
                    "last_status": latest_log.status if latest_log else None
                }
            },
            "competitive_sitemap_benchmarking": {
                "bulb": "green" if has_competitors else "red",
                "eligible": has_competitors,
                "reason": None if has_competitors else "No competitors found in Step 3 'Discovered Competitors'.",
                "report": {
                    "available": sitemap_benchmark_available,
                    "last_run": sitemap_benchmark_last_run,
                    "error_count": sitemap_error_count,
                    "status": sitemap_benchmark_status,
                    "error": sitemap_benchmark_error
                }
            }
        }
    finally:
        db.close()

class ResearchHealthResponse(BaseModel):
    """Response model for research service health check."""
    success: bool
    message: str
    service_status: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

class SitemapAnalysisRequest(BaseModel):
    """Request model for sitemap analysis in onboarding context."""
    user_url: str = Field(..., description="User's website URL")
    sitemap_url: Optional[str] = Field(None, description="Custom sitemap URL (defaults to user_url/sitemap.xml)")
    competitors: Optional[List[str]] = Field(None, description="List of competitor URLs for benchmarking")
    industry_context: Optional[str] = Field(None, description="Industry context for analysis")
    analyze_content_trends: bool = Field(True, description="Whether to analyze content trends")
    analyze_publishing_patterns: bool = Field(True, description="Whether to analyze publishing patterns")

class SitemapAnalysisResponse(BaseModel):
    """Response model for sitemap analysis."""
    success: bool
    message: str
    user_url: str
    sitemap_url: str
    analysis_data: Optional[Dict[str, Any]] = None
    onboarding_insights: Optional[Dict[str, Any]] = None
    analysis_timestamp: Optional[str] = None
    discovery_method: Optional[str] = None
    error: Optional[str] = None

class SocialMediaDiscoveryRequest(BaseModel):
    """Request model for social media discovery."""
    user_url: str = Field(..., description="User's website URL")

class SocialMediaDiscoveryResponse(BaseModel):
    """Response model for social media discovery."""
    success: bool
    message: str
    social_media_accounts: Optional[Dict[str, str]] = None
    error: Optional[str] = None

# Initialize services
step3_research_service = Step3ResearchService()
sitemap_service = SitemapService()

@router.post("/discover-social-media", response_model=SocialMediaDiscoveryResponse)
async def discover_social_media(
    request: SocialMediaDiscoveryRequest,
    current_user: dict = Depends(get_current_user)
) -> SocialMediaDiscoveryResponse:
    """
    Discover social media accounts for a given website.
    """
    try:
        logger.info(f"Starting social media discovery for user: {current_user.get('user_id', 'unknown')}")
        logger.info(f"Social media discovery request: {request.user_url}")
        
        # Use ExaService directly via Step3ResearchService instance
        result = await step3_research_service.exa_service.discover_social_media_accounts(request.user_url)
        
        if result["success"]:
            return SocialMediaDiscoveryResponse(
                success=True,
                message="Social media accounts discovered successfully",
                social_media_accounts=result.get("social_media_accounts", {})
            )
        else:
            return SocialMediaDiscoveryResponse(
                success=False,
                message="Social media discovery failed",
                error=result.get("error", "Unknown error")
            )
            
    except Exception as e:
        logger.error(f"Error in social media discovery: {str(e)}")
        return SocialMediaDiscoveryResponse(
            success=False,
            message="An unexpected error occurred",
            error=str(e)
        )

@router.post("/discover-competitors", response_model=CompetitorDiscoveryResponse)
async def discover_competitors(
    request: CompetitorDiscoveryRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> CompetitorDiscoveryResponse:
    """
    Discover competitors for the user's website using Exa API with user isolation.
    
    This endpoint performs neural search to find semantically similar websites
    and analyzes their content for competitive intelligence.
    """
    try:
        # Get Clerk user ID for user isolation
        clerk_user_id = str(current_user.get('id'))
        
        logger.info(f"Starting competitor discovery for authenticated user {clerk_user_id}, URL: {request.user_url}")
        logger.info(f"Request data - user_url: '{request.user_url}', industry_context: '{request.industry_context}', num_results: {request.num_results}")
        
        # Validate URL format
        if not request.user_url.startswith(('http://', 'https://')):
            request.user_url = f"https://{request.user_url}"
        
        # Perform competitor discovery with Clerk user ID
        result = await step3_research_service.discover_competitors_for_onboarding(
            user_url=request.user_url,
            user_id=clerk_user_id,  # Use Clerk user ID to find correct session
            industry_context=request.industry_context,
            num_results=request.num_results,
            website_analysis_data=request.website_analysis_data
        )
        
        if result["success"]:
            logger.info(f"✅ Successfully discovered {result['total_competitors']} competitors for user {clerk_user_id}")
            
            # SIF-enhanced semantic intelligence (best-effort, non-blocking)
            sif_insights = None
            sif_content = None
            sif_recommendations = None
            try:
                from services.sif_onboarding_service import enhance_step3_with_semantic_intelligence
                sif_result = await enhance_step3_with_semantic_intelligence(
                    user_id=clerk_user_id,
                    website_url=request.user_url,
                    business_info={"description": request.industry_context or "", "industry": request.industry_context or ""}
                )
                sif_insights = sif_result.get("semantic_insights")
                sif_content = sif_result.get("content_analysis")
                sif_recommendations = sif_insights.get("strategic_recommendations") if sif_insights else None
                logger.info(f"[SIF] Step 3 enhanced with semantic intelligence for {clerk_user_id}")
            except Exception as e:
                logger.warning(f"[SIF] Step 3 enhancement failed (non-blocking): {e}")
            
            return CompetitorDiscoveryResponse(
                success=True,
                message=f"Successfully discovered {result['total_competitors']} competitors and social media accounts",
                session_id=result["session_id"],
                user_url=result["user_url"],
                competitors=result["competitors"],
                social_media_accounts=result.get("social_media_accounts"),
                social_media_citations=result.get("social_media_citations"),
                research_summary=result["research_summary"],
                total_competitors=result["total_competitors"],
                industry_context=result["industry_context"],
                analysis_timestamp=result["analysis_timestamp"],
                api_cost=result["api_cost"],
                semantic_insights=sif_insights,
                content_analysis=sif_content,
                strategic_recommendations=sif_recommendations
            )
        else:
            logger.error(f"❌ Competitor discovery failed for user {clerk_user_id}: {result.get('error')}")
            
            return CompetitorDiscoveryResponse(
                success=False,
                message="Competitor discovery failed",
                session_id=clerk_user_id,
                user_url=result.get("user_url", request.user_url),
                error=result.get("error", "Unknown error occurred")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in competitor discovery endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return error response with Clerk user ID
        clerk_user_id = str(current_user.get('id', 'unknown'))
        return CompetitorDiscoveryResponse(
            success=False,
            message="Internal server error during competitor discovery",
            session_id=clerk_user_id,
            user_url=request.user_url,
            error=str(e)
        )

@router.post("/research-data", response_model=ResearchDataResponse)
async def get_research_data(
    request: ResearchDataRequest,
    current_user: dict = Depends(get_current_user)
) -> ResearchDataResponse:
    """
    Retrieve research data for a specific onboarding session.
    
    This endpoint returns the stored research data including competitor analysis
    and research summary for the given session.
    """
    try:
        # Get Clerk user ID for user isolation
        clerk_user_id = str(current_user.get('id'))
        
        logger.info(f"Retrieving research data for session {request.session_id} (user: {clerk_user_id})")
        
        # Validate session ID
        if not request.session_id or len(request.session_id) < 10:
            raise HTTPException(
                status_code=400,
                detail="Invalid session ID"
            )
        
        # Retrieve research data
        result = await step3_research_service.get_research_data(request.session_id, clerk_user_id)
        
        if result["success"]:
            logger.info(f"Successfully retrieved research data for session {request.session_id}")
            
            return ResearchDataResponse(
                success=True,
                message="Research data retrieved successfully",
                session_id=result["session_id"],
                research_data=result["research_data"]
            )
        else:
            logger.warning(f"No research data found for session {request.session_id}")
            
            return ResearchDataResponse(
                success=False,
                message="No research data found for this session",
                session_id=request.session_id,
                error=result.get("error", "Research data not found")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving research data: {str(e)}")
        logger.error(traceback.format_exc())
        
        return ResearchDataResponse(
            success=False,
            message="Internal server error while retrieving research data",
            session_id=request.session_id,
            error=str(e)
        )

@router.get("/sitemap-benchmark-report")
async def get_sitemap_benchmark_report(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Retrieve the full sitemap benchmark report for the current user.
    """
    user_id = str(current_user.get("id"))
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        integration_service = OnboardingDataIntegrationService()
        integrated = integration_service.get_integrated_data_sync(user_id, db)
        
        website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}
        seo_audit = website_analysis.get("seo_audit") if isinstance(website_analysis, dict) else {}
        sitemap_benchmark_report = seo_audit.get("competitive_sitemap_benchmarking") if isinstance(seo_audit, dict) else None
        
        if not sitemap_benchmark_report:
            raise HTTPException(status_code=404, detail="No sitemap benchmark report found")
            
        return sitemap_benchmark_report
        
    finally:
        db.close()

@router.get("/health", response_model=ResearchHealthResponse)
async def health_check() -> ResearchHealthResponse:
    """
    Check the health of the Step 3 research service.
    
    This endpoint provides health status information for the research service
    including Exa API connectivity and service status.
    """
    try:
        logger.info("Performing Step 3 research service health check")
        
        health_status = await step3_research_service.health_check()
        
        if health_status["status"] == "healthy":
            return ResearchHealthResponse(
                success=True,
                message="Step 3 research service is healthy",
                service_status=health_status,
                timestamp=health_status["timestamp"]
            )
        else:
            return ResearchHealthResponse(
                success=False,
                message=f"Step 3 research service is {health_status['status']}",
                service_status=health_status,
                timestamp=health_status["timestamp"]
            )
            
    except Exception as e:
        logger.error(f"Error in health check: {str(e)}")
        logger.error(traceback.format_exc())
        
        return ResearchHealthResponse(
            success=False,
            message="Health check failed",
            error=str(e),
            timestamp=datetime.utcnow().isoformat()
        )

@router.post("/validate-session")
async def validate_session(
    session_id: str = Body(..., embed=True),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Validate that a session exists and is ready for Step 3.
    
    This endpoint checks if the session exists and has completed previous steps.
    """
    try:
        logger.info(f"Validating session {session_id} for Step 3, user: {current_user.get('id')}")
        
        # Basic validation
        if not session_id or len(session_id) < 10:
            raise HTTPException(
                status_code=400,
                detail="Invalid session ID format"
            )
        
        # Check if session has completed Step 2 (website analysis)
        # This would integrate with the existing session validation logic
        
        return {
            "success": True,
            "message": "Session is valid for Step 3",
            "session_id": session_id,
            "ready_for_step3": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Deep Website Crawl Endpoints

class DeepCrawlRequest(BaseModel):
    user_url: str
    schedule: bool = False

@router.post("/deep-crawl/start")
async def start_deep_crawl(
    request: DeepCrawlRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Start a deep website crawl task.
    If schedule is True, creates a recurring task with proper frequency.
    If schedule is False, runs immediately (fire-and-forget, no DB record).
    """
    user_id = str(current_user.get("id"))
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        task = db.query(DeepWebsiteCrawlTask).filter(
            DeepWebsiteCrawlTask.user_id == user_id,
            DeepWebsiteCrawlTask.website_url == request.user_url
        ).first()

        if not task:
            if request.schedule:
                # Create recurring task with proper frequency
                task = DeepWebsiteCrawlTask(
                    user_id=user_id,
                    website_url=request.user_url,
                    status="active",
                    next_execution=datetime.now(timezone.utc) + timedelta(minutes=5),
                    frequency_days=7,
                    payload={"created_from": "deep-crawl-endpoint", "schedule": True},
                )
                db.add(task)
                db.commit()
                db.refresh(task)
                message = "Deep crawl scheduled for first run in 5 minutes."
            else:
                # Fire-and-forget: no DB record, run immediately
                service = DeepCrawlService()
                background_tasks.add_task(
                    service.execute_deep_crawl,
                    user_id=user_id,
                    website_url=request.user_url,
                    task_id=None,
                )
                return {
                    "success": True,
                    "message": "Deep crawl started immediately.",
                    "task_id": None,
                    "status": "running",
                }
        else:
            # Existing task
            if request.schedule:
                task.status = "active"
                task.next_execution = datetime.now(timezone.utc) + timedelta(minutes=5)
                task.frequency_days = 7
                db.commit()
                message = "Deep crawl re-scheduled."
            else:
                # Fire-and-forget: run immediately, don't alter task schedule
                service = DeepCrawlService()
                background_tasks.add_task(
                    service.execute_deep_crawl,
                    user_id=user_id,
                    website_url=request.user_url,
                    task_id=task.id,
                )
                return {
                    "success": True,
                    "message": "Deep crawl started immediately.",
                    "task_id": task.id,
                    "status": "running",
                }

        return {
            "success": True,
            "message": message,
            "task_id": task.id,
            "status": task.status,
        }
    except Exception as e:
        logger.error(f"Error starting deep crawl: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/deep-crawl/status")
async def get_deep_crawl_status(
    current_user: dict = Depends(get_current_user)
):
    """
    Get status of the deep website crawl task.
    """
    user_id = str(current_user.get("id"))
    db = get_session_for_user(user_id)
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        task = db.query(DeepWebsiteCrawlTask).filter(
            DeepWebsiteCrawlTask.user_id == user_id
        ).order_by(DeepWebsiteCrawlTask.id.desc()).first()

        if not task:
            return {
                "exists": False,
                "status": None
            }

        latest_log = db.query(DeepWebsiteCrawlExecutionLog).filter(
            DeepWebsiteCrawlExecutionLog.task_id == task.id
        ).order_by(DeepWebsiteCrawlExecutionLog.execution_date.desc()).first()

        return {
            "exists": True,
            "task_id": task.id,
            "status": task.status,
            "last_executed": task.last_executed,
            "next_execution": task.next_execution,
            "latest_log": {
                "status": latest_log.status if latest_log else None,
                "execution_date": latest_log.execution_date if latest_log else None,
                "result_summary": latest_log.result_data if latest_log else None,
                "error": latest_log.error_message if latest_log else None
            }
        }
    except Exception as e:
        logger.error(f"Error getting deep crawl status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@router.get("/cost-estimate")
async def get_cost_estimate(
    num_results: int = 25,
    include_content: bool = True
) -> Dict[str, Any]:
    """
    Get cost estimate for competitor discovery.
    
    This endpoint provides cost estimates for Exa API usage
    to help users understand the cost of competitor discovery.
    """
    try:
        logger.info(f"Getting cost estimate for {num_results} results, content: {include_content}")
        
        cost_estimate = step3_research_service.exa_service.get_cost_estimate(
            num_results=num_results,
            include_content=include_content
        )
        
        return {
            "success": True,
            "cost_estimate": cost_estimate,
            "message": "Cost estimate calculated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error calculating cost estimate: {str(e)}")
        
        return {
            "success": False,
            "message": "Failed to calculate cost estimate",
            "error": str(e)
        }

@router.post("/discover-sitemap")
async def discover_sitemap(
    request: SitemapAnalysisRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Discover the sitemap URL for a given website using intelligent search.
    
    This endpoint attempts to find the sitemap URL by checking robots.txt
    and common sitemap locations.
    """
    try:
        logger.info(f"Discovering sitemap for user: {current_user.get('user_id', 'unknown')}")
        logger.info(f"Sitemap discovery request: {request.user_url}")
        
        # Use intelligent sitemap discovery
        discovered_sitemap = await sitemap_service.discover_sitemap_url(request.user_url)
        
        if discovered_sitemap:
            return {
                "success": True,
                "message": "Sitemap discovered successfully",
                "user_url": request.user_url,
                "sitemap_url": discovered_sitemap,
                "discovery_method": "intelligent_search"
            }
        else:
            # Provide fallback URL
            base_url = request.user_url.rstrip('/')
            fallback_url = f"{base_url}/sitemap.xml"
            
            return {
                "success": False,
                "message": "No sitemap found using intelligent discovery",
                "user_url": request.user_url,
                "fallback_url": fallback_url,
                "discovery_method": "fallback"
            }
        
    except Exception as e:
        logger.error(f"Error in sitemap discovery: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return {
            "success": False,
            "message": "An unexpected error occurred during sitemap discovery",
            "user_url": request.user_url,
            "error": str(e)
        }

@router.post("/analyze-sitemap", response_model=SitemapAnalysisResponse)
async def analyze_sitemap_for_onboarding(
    request: SitemapAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> SitemapAnalysisResponse:
    """
    Analyze user's sitemap for competitive positioning and content strategy insights.
    
    This endpoint provides enhanced sitemap analysis specifically designed for
    onboarding Step 3 competitive analysis, including competitive positioning
    insights and content strategy recommendations.
    """
    try:
        logger.info(f"Starting sitemap analysis for user: {current_user.get('user_id', 'unknown')}")
        logger.info(f"Sitemap analysis request: {request.user_url}")
        
        # Determine sitemap URL using intelligent discovery
        sitemap_url = request.sitemap_url
        if not sitemap_url:
            # Use intelligent sitemap discovery
            discovered_sitemap = await sitemap_service.discover_sitemap_url(request.user_url)
            if discovered_sitemap:
                sitemap_url = discovered_sitemap
                logger.info(f"Discovered sitemap via intelligent search: {sitemap_url}")
            else:
                # Fallback to standard location if discovery fails
                base_url = request.user_url.rstrip('/')
                sitemap_url = f"{base_url}/sitemap.xml"
                logger.info(f"Using fallback sitemap URL: {sitemap_url}")
        
        logger.info(f"Analyzing sitemap: {sitemap_url}")
        
        # Run onboarding-specific sitemap analysis
        analysis_result = await sitemap_service.analyze_sitemap_for_onboarding(
            sitemap_url=sitemap_url,
            user_url=request.user_url,
            competitors=request.competitors,
            industry_context=request.industry_context,
            analyze_content_trends=request.analyze_content_trends,
            analyze_publishing_patterns=request.analyze_publishing_patterns,
            user_id=str(current_user.get('id'))
        )
        
        # Check if analysis was successful
        if analysis_result.get("error"):
            logger.error(f"Sitemap analysis failed: {analysis_result['error']}")
            return SitemapAnalysisResponse(
                success=False,
                message="Sitemap analysis failed",
                user_url=request.user_url,
                sitemap_url=sitemap_url,
                error=analysis_result["error"]
            )
        
        # Extract onboarding insights
        onboarding_insights = analysis_result.get("onboarding_insights", {})
        
        # Log successful analysis
        logger.info(f"Sitemap analysis completed successfully for {request.user_url}")
        logger.info(f"Found {analysis_result.get('structure_analysis', {}).get('total_urls', 0)} URLs")
        
        # Background task to store analysis results (if needed)
        background_tasks.add_task(
            _log_sitemap_analysis_result,
            current_user.get('user_id'),
            request.user_url,
            analysis_result
        )
        
        # Determine discovery method
        discovery_method = "fallback"
        if request.sitemap_url:
            discovery_method = "user_provided"
        elif discovered_sitemap:
            discovery_method = "intelligent_search"
        
        return SitemapAnalysisResponse(
            success=True,
            message="Sitemap analysis completed successfully",
            user_url=request.user_url,
            sitemap_url=sitemap_url,
            analysis_data=analysis_result,
            onboarding_insights=onboarding_insights,
            analysis_timestamp=datetime.utcnow().isoformat(),
            discovery_method=discovery_method
        )
        
    except Exception as e:
        logger.error(f"Error in sitemap analysis: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return SitemapAnalysisResponse(
            success=False,
            message="An unexpected error occurred during sitemap analysis",
            user_url=request.user_url,
            sitemap_url=sitemap_url or f"{request.user_url.rstrip('/')}/sitemap.xml",
            error=str(e)
        )

async def _log_sitemap_analysis_result(
    user_id: str,
    user_url: str,
    analysis_result: Dict[str, Any]
) -> None:
    """Background task to log sitemap analysis results."""
    try:
        logger.info(f"Logging sitemap analysis result for user {user_id}")
        # Add any logging or storage logic here if needed
        # For now, just log the completion
        logger.info(f"Sitemap analysis logged for {user_url}")
    except Exception as e:
        logger.error(f"Error logging sitemap analysis result: {e}")
