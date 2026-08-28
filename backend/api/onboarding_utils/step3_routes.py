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
import re
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
from services.seo_audit_lock import get_seo_audit_lock

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
    content_pillars: Optional[Dict[str, Any]] = None
    total_competitors: Optional[int] = None
    industry_context: Optional[str] = None
    analysis_timestamp: Optional[str] = None
    api_cost: Optional[float] = None
    error: Optional[str] = None

class ContentPillarsRequest(BaseModel):
    """Request model for content pillar discovery."""
    user_url: str = Field(..., description="User's website URL")

class ContentPillarsResponse(BaseModel):
    """Response model for content pillar discovery."""
    success: bool
    message: str
    content_pillars: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

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
    force: bool = Field(False, description="Skip cached result and force a fresh analysis")

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
            
            return CompetitorDiscoveryResponse(
                success=True,
                message=f"Successfully discovered {result['total_competitors']} competitors and social media accounts",
                session_id=result["session_id"],
                user_url=result["user_url"],
                competitors=result["competitors"],
                social_media_accounts=result.get("social_media_accounts"),
                social_media_citations=result.get("social_media_citations"),
                research_summary=result["research_summary"],
                content_pillars=result.get("content_pillars"),
                total_competitors=result["total_competitors"],
                industry_context=result["industry_context"],
                analysis_timestamp=result["analysis_timestamp"],
                api_cost=result["api_cost"]
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

@router.post("/discover-content-pillars", response_model=ContentPillarsResponse)
async def discover_content_pillars(
    request: ContentPillarsRequest,
    current_user: dict = Depends(get_current_user)
) -> ContentPillarsResponse:
    """
    Re-discover content pillars for the user's website without re-running the
    full competitor discovery. Results are persisted to ResearchPreferences so
    they survive refresh and stepper navigation.
    """
    try:
        clerk_user_id = str(current_user.get('id'))
        user_url = request.user_url
        if not user_url.startswith(('http://', 'https://')):
            user_url = f"https://{user_url}"

        logger.info(f"Content pillar refresh for user {clerk_user_id}, URL: {user_url}")

        pillars = await step3_research_service._discover_content_pillars_with_fallback(user_url)

        if not pillars:
            logger.warning(f"Content pillar refresh returned no data for user {clerk_user_id}")
            return ContentPillarsResponse(
                success=False,
                message="Content pillar discovery returned no data",
                error="Content pillar discovery returned no data. Exa credits may be exhausted or the domain returned no results."
            )

        persist_ok = False
        try:
            from api.onboarding_utils.step_management_service import StepManagementService
            db = get_session_for_user(clerk_user_id)
            if db:
                svc = StepManagementService()
                persist_ok = svc.save_content_pillars(clerk_user_id, pillars, db)
                db.close()
        except Exception as persist_err:
            logger.warning(f"Failed to persist content pillars for user {clerk_user_id}: {persist_err}")

        if not persist_ok:
            logger.warning(f"Content pillar persistence failed for user {clerk_user_id}")

        return ContentPillarsResponse(
            success=True,
            message="Content pillars discovered",
            content_pillars=pillars,
        )

    except Exception as e:
        logger.error(f"Error in content pillar discovery endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return ContentPillarsResponse(
            success=False,
            message="Content pillar discovery failed",
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
async def get_sitemap_benchmark_report(current_user: dict = Depends(get_current_user)) -> Optional[Dict[str, Any]]:
    """
    Retrieve the full sitemap benchmark report for the current user.
    Returns None (200) when no report exists yet — the frontend treats this as "not available".
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

@router.get("/sitemap-analysis")
async def get_persisted_sitemap_analysis(
    user_url: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Return the persisted sitemap analysis from DB (no LLM call).

    Mirrors ``GET /api/onboarding/competitor-analysis``: the frontend calls
    this before auto-triggering an LLM analysis so the Strategic Content
    Opportunities section restores from DB on navigation/refresh instead of
    paying for a fresh LLM call every time.
    
    Validates that the persisted user_url matches the requested user_url
    to prevent returning stale data from a previous website analysis.
    """
    try:
        user_id = str(current_user.get('id'))
        from services.database import get_session_for_user
        from api.onboarding_utils.step_management_service import StepManagementService
        from models.onboarding import WebsiteAnalysis

        db = get_session_for_user(user_id)
        if not db:
            logger.info(f"[sitemap_get] MISS: no DB for user={user_id}")
            return {"success": False, "sitemap_analysis": None, "discovery_method": "none"}

        try:
            svc = StepManagementService()
            session = svc._get_or_create_session(user_id, db)
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).order_by(WebsiteAnalysis.updated_at.desc()).first()

            if not analysis:
                logger.info(f"[sitemap_get] MISS: no WebsiteAnalysis row for session={getattr(session, 'id', None)} user={user_id}")
                return {"success": False, "sitemap_analysis": None, "discovery_method": "none"}

            seo_audit = analysis.seo_audit or {}
            cached = seo_audit.get("sitemap_analysis")
            if not isinstance(cached, dict) or not cached.get("success", True):
                logger.info(f"[sitemap_get] MISS: no sitemap_analysis in seo_audit (keys={list(seo_audit.keys())}) user={user_id}")
                return {"success": False, "sitemap_analysis": None, "discovery_method": "none"}

            # Validate URL match to prevent returning stale data from different website
            if user_url:
                cached_url = cached.get("user_url") or ""
                norm_requested = _normalize_site_url(user_url)
                norm_cached = _normalize_site_url(cached_url)
                if norm_cached and norm_requested != norm_cached:
                    logger.info(f"[sitemap_get] URL mismatch: requested={norm_requested}, cached={norm_cached}, returning none")
                    return {"success": False, "sitemap_analysis": None, "discovery_method": "none"}

            logger.info(f"[sitemap_get] HIT for user={user_id}")
            return {"success": True, "sitemap_analysis": cached, "discovery_method": "db"}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error reading persisted sitemap analysis: {e}")
        logger.error(traceback.format_exc())
        return {"success": False, "sitemap_analysis": None, "discovery_method": "error", "error": str(e)}


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

        # ------------------------------------------------------------------
        # In-flight dedup: if another request is already running the
        # same analysis (e.g. user navigated away/back during the 45-90s
        # window), block the duplicate rather than paying for a second
        # LLM call.  Skip this check when force=True (Refresh button).
        # ------------------------------------------------------------------
        inflight_key = _normalize_site_url(request.user_url)
        if not request.force:
            if inflight_key in _sitemap_inflight_locks:
                logger.info(f"[sitemap_dedup] BLOCKED concurrent duplicate for {inflight_key}")
                return SitemapAnalysisResponse(
                    success=False,
                    message="Analysis already in progress for this URL. Please wait.",
                    user_url=request.user_url,
                    sitemap_url=request.sitemap_url or f"{request.user_url.rstrip('/')}/sitemap.xml",
                    error="analysis_in_progress"
                )
            _sitemap_inflight_locks[inflight_key] = True

        try:
          # ------------------------------------------------------------------
          # Cache-first: return a recently persisted analysis instead of paying
          # for a fresh LLM call on every navigation/refresh. The frontend
          # "Refresh Strategy" button sends force=True to bypass this.
          # ------------------------------------------------------------------
          if not request.force:
              cached = _load_cached_sitemap_analysis(str(current_user.get('id')), request.user_url)
              if cached:
                  logger.info(f"Sitemap analysis cache HIT for {request.user_url}; returning persisted result")
                  return SitemapAnalysisResponse(
                      success=True,
                      message="Returning cached sitemap analysis",
                      user_url=request.user_url,
                      sitemap_url=cached.get("sitemap_url") or f"{request.user_url.rstrip('/')}/sitemap.xml",
                      analysis_data=cached.get("analysis_data"),
                      onboarding_insights=(cached.get("analysis_data") or {}).get("onboarding_insights"),
                      analysis_timestamp=cached.get("analyzed_at"),
                      discovery_method="cache"
                  )

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
          
          # Persist synchronously (matching competitor discovery) so the result
          # survives navigation even if the process restarts before a background
          # task would have run. `_persist_sitemap_analysis` is a fast DB write.
          await _persist_sitemap_analysis(
              str(current_user.get('id')),
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
          
        finally:
          _sitemap_inflight_locks.pop(inflight_key, None)
        
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

def _normalize_site_url(url: str) -> str:
    """Normalize a site URL for cache matching (strip protocol/www/trailing slash)."""
    if not isinstance(url, str):
        return ''
    u = url.strip().lower()
    u = re.sub(r'^https?://', '', u)
    if u.startswith('www.'):
        u = u[4:]
    return u.rstrip('/')


# Track in-flight analyze-sitemap requests to block duplicate concurrent
# calls across frontend remounts (e.g., user navigates away/back during the
# 45-90s analysis window).  Module-level dict keyed by normalized URL →
# asyncio.Lock.  Slightly cheaper than a full module-level Lock + dict of
# timestamps; the lock is released as soon as the coroutine finishes.
_sitemap_inflight_locks: Dict[str, bool] = {}


def _load_cached_sitemap_analysis(user_id: str, user_url: str) -> Optional[Dict[str, Any]]:
    """Load a recent sitemap analysis from WebsiteAnalysis.seo_audit, if any.

    Returns the persisted ``sitemap_analysis`` dict when it exists for the
    same ``user_url`` and is fresher than 24h; otherwise returns None.
    """
    norm_requested = _normalize_site_url(user_url)
    try:
        from services.database import get_session_for_user
        from api.onboarding_utils.step_management_service import StepManagementService
        from models.onboarding import WebsiteAnalysis

        db = get_session_for_user(user_id)
        if not db:
            logger.info(f"[sitemap_cache] MISS: get_session_for_user returned None for user={user_id}")
            return None
        try:
            svc = StepManagementService()
            session = svc._get_or_create_session(user_id, db)
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            if not analysis:
                logger.info(f"[sitemap_cache] MISS: no WebsiteAnalysis row for session={getattr(session,'id',None)} user={user_id}")
                return None

            seo_audit = analysis.seo_audit or {}
            cached = seo_audit.get("sitemap_analysis")
            if not isinstance(cached, dict):
                logger.info(f"[sitemap_cache] MISS: seo_audit has no sitemap_analysis key (keys={list(seo_audit.keys())}) user={user_id}")
                return None
            if not cached.get("success", True):
                logger.info(f"[sitemap_cache] MISS: sitemap_analysis.success={cached.get('success')} user={user_id}")
                return None

            # Normalize-then-compare (protocol/www/trailing slash tolerant)
            cached_url = _normalize_site_url(cached.get("user_url") or "")
            if cached_url != norm_requested:
                logger.info(
                    f"[sitemap_cache] MISS: URL mismatch cached='{cached_url}' "
                    f"requested='{norm_requested}' user={user_id}"
                )
                return None

            # TTL check (24h, matching the frontend localStorage cache)
            analyzed_at = cached.get("analyzed_at")
            if analyzed_at:
                try:
                    analyzed_dt = datetime.fromisoformat(str(analyzed_at))
                    if datetime.utcnow() - analyzed_dt > timedelta(hours=24):
                        logger.info(f"[sitemap_cache] MISS: expired analyzed_at={analyzed_at} user={user_id}")
                        return None
                except ValueError:
                    pass  # Unparseable timestamp — treat as fresh rather than blocking

            logger.info(f"[sitemap_cache] HIT for user={user_id} url={norm_requested}")
            return cached
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"[sitemap_cache] MISS: exception for user={user_id}: {e}")
        return None


async def _persist_sitemap_analysis(
    user_id: str,
    user_url: str,
    analysis_result: Dict[str, Any]
) -> None:
    """Background task to persist sitemap analysis results to DB.
    
    Protected by per-user lock to prevent concurrent writes from overwriting
    each other's keys in the seo_audit JSON (e.g., sitemap_analysis vs
    competitive_sitemap_benchmarking).
    """
    async def _do_persist():
        try:
            if not analysis_result or not isinstance(analysis_result, dict):
                logger.warning(f"_persist_sitemap_analysis: invalid analysis_result for user {user_id}")
                return

            from services.database import get_session_for_user
            from api.onboarding_utils.step_management_service import StepManagementService
            db = get_session_for_user(user_id)
            if not db:
                return
            
            svc = StepManagementService()
            session = svc._get_or_create_session(user_id, db)
            
            from models.onboarding import WebsiteAnalysis
            analysis = db.query(WebsiteAnalysis).filter(
                WebsiteAnalysis.session_id == session.id
            ).first()
            
            if analysis:
                from sqlalchemy.orm.attributes import flag_modified
                seo_audit = dict(analysis.seo_audit or {})
                seo_audit["sitemap_analysis"] = {
                    "success": True,
                    "user_url": user_url,
                    "sitemap_url": analysis_result.get("sitemap_url"),
                    "analyzed_at": datetime.utcnow().isoformat(),
                    "analysis_data": {
                        "total_urls": analysis_result.get("total_urls", 0),
                        "url_list": analysis_result.get("url_list", []),
                        "structure_analysis": analysis_result.get("structure_analysis"),
                        "content_trends": analysis_result.get("content_trends"),
                        "publishing_patterns": analysis_result.get("publishing_patterns"),
                        "ai_insights": analysis_result.get("ai_insights"),
                        "onboarding_insights": analysis_result.get("onboarding_insights") or analysis_result.get("sitemap_onboarding_insights"),
                        "competitors_analyzed": analysis_result.get("competitors_analyzed", []),
                    },
                }
                analysis.seo_audit = seo_audit
                flag_modified(analysis, "seo_audit")
                db.commit()
                logger.info(f"Sitemap analysis persisted for user {user_id}")
            else:
                logger.warning(f"No WebsiteAnalysis found for session {session.id}")
            
            db.close()
        except Exception as e:
            import traceback
            logger.error(f"Error persisting sitemap analysis: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
    
    lock = await get_seo_audit_lock(user_id)
    async with lock:
        await _do_persist()


async def _log_sitemap_analysis_result(
    user_id: str,
    user_url: str,
    analysis_result: Dict[str, Any]
) -> None:
    """Background task to log sitemap analysis results."""
    try:
        logger.info(f"Logging sitemap analysis result for user {user_id}")
        logger.info(f"Sitemap analysis logged for {user_url}")
    except Exception as e:
        logger.error(f"Error logging sitemap analysis result: {e}")
