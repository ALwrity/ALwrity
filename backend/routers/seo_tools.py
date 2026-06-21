"""
AI SEO Tools FastAPI Router

This module provides FastAPI endpoints for all AI SEO tools migrated from ToBeMigrated/ai_seo_tools.
Includes intelligent logging, exception handling, and structured responses.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl, Field, validator
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import json
import traceback
from loguru import logger
import os
import tempfile
import asyncio

from services.workspace_dirs import ensure_global_operational_dirs

# Import services
from services.llm_providers.main_text_generation import llm_text_gen
from services.seo_tools.meta_description_service import MetaDescriptionService
from services.seo_tools.pagespeed_service import PageSpeedService
from services.seo_tools.sitemap_service import SitemapService
from services.seo_tools.image_alt_service import ImageAltService
from services.seo_tools.opengraph_service import OpenGraphService
from services.seo_tools.on_page_seo_service import OnPageSEOService
from services.seo_tools.technical_seo_service import TechnicalSEOService
from services.seo_tools.enterprise_seo_service import EnterpriseSEOService
from services.seo_tools.gsc_analyzer_service import GSCAnalyzerService
from services.seo_tools.gsc_strategy_insights_service import GSCStrategyInsightsService
from services.seo_tools.content_strategy_service import ContentStrategyService
from services.seo_tools.llm_insights_service import LLMInsightsService
from services.database import get_session_for_user
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from middleware.logging_middleware import log_api_call, save_to_file
from middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/seo", tags=["AI SEO Tools"])

# Configuration for intelligent logging
LOG_DIR = "logs/seo_tools"


# ---------------------------------------------------------------------------
# Sitemap benchmark idempotency
# ---------------------------------------------------------------------------
# Without this, a click-spam user (or a frontend that auto-retries the
# onboarding-step3 endpoint on every state change) launches N parallel
# background benchmarks against the same domain. Each one makes fresh
# HTTP requests to alwrity.com and its competitors, which trips
# rate-limit (HTTP 429/436) and floods the logs with duplicate
# "Connection closed" / "Failed to fetch sitemap" errors.
#
# The actual dedup logic lives in services/sitemap_benchmark_dedup.py
# so it can be unit-tested in isolation (the seo_tools router has
# unrelated pre-existing import issues that would otherwise break the
# test collection).
from services.sitemap_benchmark_dedup import (
    SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC as _SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC,
    is_recent_sitemap_benchmark_in_flight as _is_recent_sitemap_benchmark_in_flight,
    mark_sitemap_benchmark_started as _mark_sitemap_benchmark_started,
    mark_sitemap_benchmark_finished as _mark_sitemap_benchmark_finished,
)



def ensure_seo_logging_dir() -> str:
    """Create SEO log directory at runtime (no import-time writes)."""
    ensure_global_operational_dirs({"logs"})
    os.makedirs(LOG_DIR, exist_ok=True)
    return LOG_DIR

# Request/Response Models
class BaseResponse(BaseModel):
    """Base response model for all SEO tools"""
    success: bool
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    execution_time: Optional[float] = None
    data: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseResponse):
    """Error response model"""
    error_type: str
    error_details: Optional[str] = None
    traceback: Optional[str] = None

class MetaDescriptionRequest(BaseModel):
    """Request model for meta description generation"""
    keywords: List[str] = Field(..., description="Target keywords for meta description")
    tone: str = Field(default="General", description="Desired tone for meta description")
    search_intent: str = Field(default="Informational Intent", description="Search intent type")
    language: str = Field(default="English", description="Preferred language")
    custom_prompt: Optional[str] = Field(None, description="Custom prompt for generation")
    
    @validator('keywords')
    def validate_keywords(cls, v):
        if not v or len(v) == 0:
            raise ValueError("At least one keyword is required")
        return v

class PageSpeedRequest(BaseModel):
    """Request model for PageSpeed Insights analysis"""
    url: HttpUrl = Field(..., description="URL to analyze")
    strategy: str = Field(default="DESKTOP", description="Analysis strategy (DESKTOP/MOBILE)")
    locale: str = Field(default="en", description="Locale for analysis")
    categories: List[str] = Field(default=["performance", "accessibility", "best-practices", "seo"])

class SitemapAnalysisRequest(BaseModel):
    """Request model for sitemap analysis"""
    sitemap_url: HttpUrl = Field(..., description="Sitemap URL to analyze")
    analyze_content_trends: bool = Field(default=True, description="Analyze content trends")
    analyze_publishing_patterns: bool = Field(default=True, description="Analyze publishing patterns")

class ImageAltRequest(BaseModel):
    """Request model for image alt text generation"""
    image_url: Optional[HttpUrl] = Field(None, description="URL of image to analyze")
    context: Optional[str] = Field(None, description="Context about the image")
    keywords: Optional[List[str]] = Field(None, description="Keywords to include in alt text")

class OpenGraphRequest(BaseModel):
    """Request model for OpenGraph tag generation"""
    url: HttpUrl = Field(..., description="URL for OpenGraph tags")
    title_hint: Optional[str] = Field(None, description="Hint for title")
    description_hint: Optional[str] = Field(None, description="Hint for description")
    platform: str = Field(default="General", description="Platform (General/Facebook/Twitter)")

class OnPageSEORequest(BaseModel):
    """Request model for on-page SEO analysis"""
    url: HttpUrl = Field(..., description="URL to analyze")
    target_keywords: Optional[List[str]] = Field(None, description="Target keywords for analysis")
    analyze_images: bool = Field(default=True, description="Include image analysis")
    analyze_content_quality: bool = Field(default=True, description="Analyze content quality")

class TechnicalSEORequest(BaseModel):
    """Request model for technical SEO analysis"""
    url: HttpUrl = Field(..., description="URL to crawl and analyze")
    crawl_depth: int = Field(default=3, description="Crawl depth (1-5)")
    include_external_links: bool = Field(default=True, description="Include external link analysis")
    analyze_performance: bool = Field(default=True, description="Include performance analysis")

class WorkflowRequest(BaseModel):
    """Request model for SEO workflow execution"""
    website_url: HttpUrl = Field(..., description="Primary website URL")
    workflow_type: str = Field(..., description="Type of workflow to execute")
    competitors: Optional[List[HttpUrl]] = Field(None, description="Competitor URLs (max 5)")
    target_keywords: Optional[List[str]] = Field(None, description="Target keywords")
    custom_parameters: Optional[Dict[str, Any]] = Field(None, description="Custom workflow parameters")

class CompetitiveSitemapBenchmarkingRunRequest(BaseModel):
    max_competitors: int = Field(default=5, ge=1, le=10, description="Max competitors to analyze")
    competitors: Optional[List[HttpUrl]] = Field(None, description="Optional explicit competitor URLs")

class EnterpriseAuditRequest(BaseModel):
    """Request model for complete enterprise SEO audit"""
    website_url: HttpUrl = Field(..., description="Primary website URL to audit")
    competitors: Optional[List[HttpUrl]] = Field(None, description="Competitor URLs for benchmarking (max 5)")
    target_keywords: Optional[List[str]] = Field(None, description="Target keywords for analysis")
    include_content_analysis: bool = Field(default=True, description="Include content strategy analysis")
    include_competitive_analysis: bool = Field(default=True, description="Include competitive benchmarking")
    generate_executive_report: bool = Field(default=True, description="Generate executive summary")

class GSCAnalysisRequest(BaseModel):
    """Request model for advanced GSC analysis"""
    site_url: HttpUrl = Field(..., description="Website URL registered in Google Search Console")
    date_range_days: int = Field(default=90, ge=7, le=365, description="Number of days to analyze")
    include_opportunities: bool = Field(default=True, description="Include content opportunity analysis")
    include_competitive: bool = Field(default=True, description="Include competitive positioning")

class ContentOpportunitiesRequest(BaseModel):
    """Request model for content opportunities report"""
    site_url: HttpUrl = Field(..., description="Website URL registered in GSC")
    min_impressions: int = Field(default=100, ge=10, description="Minimum impressions threshold")
    date_range_days: int = Field(default=90, ge=7, le=365, description="Number of days to analyze")

# ==================== LLM INSIGHTS REQUEST MODELS ====================

class EnterpriseAuditInsightsRequest(BaseModel):
    """Request model for AI insights from enterprise audit"""
    audit_results: Dict[str, Any] = Field(..., description="Complete audit results")
    website_url: str = Field(..., description="Website being audited")
    target_keywords: Optional[List[str]] = Field(None, description="Target keywords")

class GSCAnalysisInsightsRequest(BaseModel):
    """Request model for AI insights from GSC analysis"""
    gsc_analysis: Dict[str, Any] = Field(..., description="Complete GSC analysis data")
    website_url: str = Field(..., description="Website being analyzed")

class ContentStrategyRequest(BaseModel):
    """Request model for content strategy generation"""
    current_content: Dict[str, Any] = Field(..., description="Current content analysis")
    content_gaps: List[str] = Field(..., description="Identified content gaps")
    target_keywords: List[str] = Field(..., description="Target keywords")
    competitor_content: Optional[Dict[str, Any]] = Field(None, description="Competitor content analysis")

class TrafficRoadmapRequest(BaseModel):
    """Request model for traffic improvement roadmap"""
    current_metrics: Dict[str, Any] = Field(..., description="Current traffic metrics")
    identified_opportunities: List[Dict[str, Any]] = Field(..., description="Improvement opportunities")
    implementation_timeline_weeks: int = Field(default=12, ge=4, le=52, description="Implementation timeline")

class CompetitiveInsightsRequest(BaseModel):
    """Request model for competitive insights generation"""
    primary_site_analysis: Dict[str, Any] = Field(..., description="Primary site analysis")
    competitor_analyses: List[Dict[str, Any]] = Field(..., description="Competitor analyses")

class PrioritizedRecommendationsRequest(BaseModel):
    """Request model for prioritized recommendations"""
    all_recommendations: List[Dict[str, Any]] = Field(..., description="All recommendations to prioritize")
    business_context: Dict[str, Any] = Field(..., description="Business goals and constraints")

class QuickWinsRequest(BaseModel):
    """Request model for quick wins identification"""
    audit_data: Dict[str, Any] = Field(..., description="Complete audit data")
    max_days_to_implement: int = Field(default=7, ge=1, le=30, description="Maximum days to implement")

class KeywordExpansionRequest(BaseModel):
    """Request model for keyword expansion"""
    current_keywords: List[str] = Field(..., description="Current target keywords")
    content_analysis: Dict[str, Any] = Field(..., description="Content analysis data")
    target_difficulty: Optional[str] = Field(None, description="Target difficulty (low/medium/high)")

# ==================== GSC STRATEGY INSIGHTS REQUEST MODELS ====================

class GSCStrategyInsightsRequest(BaseModel):
    """Request model for GSC strategy insights (dashboard context)"""
    site_url: HttpUrl = Field(..., description="Website URL registered in GSC")
    include_trends: bool = Field(default=True, description="Include trend analysis")
    include_competitive: bool = Field(default=False, description="Include competitive analysis (Phase 2)")
    top_n: int = Field(default=20, ge=5, le=100, description="Number of top opportunities to return")

class GSCOpportunityRankingRequest(BaseModel):
    """Request model for ROI-ranked opportunities"""
    site_url: HttpUrl = Field(..., description="Website URL registered in GSC")
    ranking_metric: str = Field(default="roi_score", description="Metric to rank by (roi_score/effort/impact/timeline)")
    severity_filter: Optional[str] = Field(None, description="Filter by severity (critical/high/medium/low/watch)")
    limit: int = Field(default=20, ge=5, le=100, description="Number of opportunities to return")

class GSCTrendAnalysisRequest(BaseModel):
    """Request model for performance trend analysis"""
    site_url: HttpUrl = Field(..., description="Website URL registered in GSC")
    metric: str = Field(default="all", description="Metric to analyze (position/impressions/clicks/ctr/all)")
    days_back: int = Field(default=90, ge=7, le=365, description="Days of historical data to analyze")

class GSCHealthMetricsRequest(BaseModel):
    """Request model for health metrics calculation"""
    site_url: HttpUrl = Field(..., description="Website URL registered in GSC")
    include_distribution: bool = Field(default=True, description="Include keyword distribution breakdown")
    include_trends: bool = Field(default=True, description="Include trend comparison")

# Exception Handler
async def handle_seo_tool_exception(func_name: str, error: Exception, request_data: Dict) -> ErrorResponse:
    """Handle exceptions from SEO tools with intelligent logging"""
    error_id = f"seo_{func_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    error_msg = str(error)
    error_trace = traceback.format_exc()
    
    # Log error with structured data
    error_log = {
        "error_id": error_id,
        "function": func_name,
        "error_type": type(error).__name__,
        "error_message": error_msg,
        "request_data": request_data,
        "traceback": error_trace,
        "timestamp": datetime.utcnow().isoformat()
    }
    
    logger.error(f"SEO Tool Error [{error_id}]: {error_msg}")
    
    # Save error to file
    await save_to_file(f"{LOG_DIR}/errors.jsonl", error_log)
    
    return ErrorResponse(
        success=False,
        message=f"Error in {func_name}: {error_msg}",
        error_type=type(error).__name__,
        error_details=error_msg,
        traceback=error_trace if os.getenv("DEBUG", "false").lower() == "true" else None
    )

# SEO Tool Endpoints

@router.post("/meta-description", response_model=BaseResponse)
@log_api_call
async def generate_meta_description(
    request: MetaDescriptionRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate AI-powered SEO meta descriptions
    
    Generates compelling, SEO-optimized meta descriptions based on keywords,
    tone, and search intent using advanced AI analysis.
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        service = MetaDescriptionService()
        result = await service.generate_meta_description(
            keywords=request.keywords,
            tone=request.tone,
            search_intent=request.search_intent,
            language=request.language,
            custom_prompt=request.custom_prompt,
            user_id=user_id
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "meta_description_generation",
            "keywords_count": len(request.keywords),
            "tone": request.tone,
            "language": request.language,
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Meta description generated successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("generate_meta_description", e, request.dict())

@router.post("/pagespeed-analysis", response_model=BaseResponse)
@log_api_call
async def analyze_pagespeed(
    request: PageSpeedRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Analyze website performance using Google PageSpeed Insights
    
    Provides comprehensive performance analysis including Core Web Vitals,
    accessibility, SEO, and best practices scores with AI-enhanced insights.
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        service = PageSpeedService()
        result = await service.analyze_pagespeed(
            url=str(request.url),
            strategy=request.strategy,
            locale=request.locale,
            categories=request.categories,
            user_id=user_id
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "pagespeed_analysis",
            "url": str(request.url),
            "strategy": request.strategy,
            "categories": request.categories,
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="PageSpeed analysis completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("analyze_pagespeed", e, request.dict())

@router.post("/sitemap-analysis", response_model=BaseResponse)
@log_api_call
async def analyze_sitemap(
    request: SitemapAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Analyze website sitemap for content structure and trends
    
    Provides insights into content distribution, publishing patterns,
    and SEO opportunities with AI-powered recommendations.
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        service = SitemapService()
        result = await service.analyze_sitemap(
            sitemap_url=str(request.sitemap_url),
            analyze_content_trends=request.analyze_content_trends,
            analyze_publishing_patterns=request.analyze_publishing_patterns,
            user_id=user_id
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "sitemap_analysis",
            "sitemap_url": str(request.sitemap_url),
            "urls_found": result.get("total_urls", 0),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Sitemap analysis completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("analyze_sitemap", e, request.dict())

@router.post("/image-alt-text", response_model=BaseResponse)
@log_api_call
async def generate_image_alt_text(
    request: ImageAltRequest = None,
    image_file: UploadFile = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate AI-powered alt text for images
    
    Creates SEO-optimized alt text for images using advanced AI vision
    models with context-aware keyword integration.
    """
    start_time = datetime.utcnow()
    
    try:
        service = ImageAltService()
        
        if image_file:
            # Handle uploaded file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{image_file.filename.split('.')[-1]}") as tmp_file:
                content = await image_file.read()
                tmp_file.write(content)
                tmp_file_path = tmp_file.name
            
            result = await service.generate_alt_text_from_file(
                image_path=tmp_file_path,
                context=request.context if request else None,
                keywords=request.keywords if request else None
            )
            
            # Cleanup
            os.unlink(tmp_file_path)
            
        elif request and request.image_url:
            result = await service.generate_alt_text_from_url(
                image_url=str(request.image_url),
                context=request.context,
                keywords=request.keywords
            )
        else:
            raise ValueError("Either image_file or image_url must be provided")
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "image_alt_text_generation",
            "has_image_file": image_file is not None,
            "has_image_url": request.image_url is not None if request else False,
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Image alt text generated successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("generate_image_alt_text", e, 
                                              request.dict() if request else {})

@router.post("/opengraph-tags", response_model=BaseResponse)
@log_api_call
async def generate_opengraph_tags(
    request: OpenGraphRequest,
    background_tasks: BackgroundTasks
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate OpenGraph tags for social media optimization
    
    Creates platform-specific OpenGraph tags optimized for Facebook,
    Twitter, and other social platforms with AI-powered content analysis.
    """
    start_time = datetime.utcnow()
    
    try:
        service = OpenGraphService()
        result = await service.generate_opengraph_tags(
            url=str(request.url),
            title_hint=request.title_hint,
            description_hint=request.description_hint,
            platform=request.platform
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "opengraph_generation",
            "url": str(request.url),
            "platform": request.platform,
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="OpenGraph tags generated successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("generate_opengraph_tags", e, request.dict())

@router.post("/on-page-analysis", response_model=BaseResponse)
@log_api_call
async def analyze_on_page_seo(
    request: OnPageSEORequest,
    background_tasks: BackgroundTasks
) -> Union[BaseResponse, ErrorResponse]:
    """
    Comprehensive on-page SEO analysis
    
    Analyzes meta tags, content quality, keyword optimization, internal linking,
    and provides actionable AI-powered recommendations for improvement.
    """
    start_time = datetime.utcnow()
    
    try:
        service = OnPageSEOService()
        result = await service.analyze_on_page_seo(
            url=str(request.url),
            target_keywords=request.target_keywords,
            analyze_images=request.analyze_images,
            analyze_content_quality=request.analyze_content_quality
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "on_page_seo_analysis",
            "url": str(request.url),
            "target_keywords_count": len(request.target_keywords) if request.target_keywords else 0,
            "seo_score": result.get("overall_score", 0),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="On-page SEO analysis completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("analyze_on_page_seo", e, request.dict())

@router.post("/technical-seo", response_model=BaseResponse)
@log_api_call
async def analyze_technical_seo(
    request: TechnicalSEORequest,
    background_tasks: BackgroundTasks
) -> Union[BaseResponse, ErrorResponse]:
    """
    Technical SEO analysis and crawling
    
    Performs comprehensive technical SEO audit including site structure,
    crawlability, indexability, and performance with AI-enhanced insights.
    """
    start_time = datetime.utcnow()
    
    try:
        service = TechnicalSEOService()
        result = await service.analyze_technical_seo(
            url=str(request.url),
            crawl_depth=request.crawl_depth,
            include_external_links=request.include_external_links,
            analyze_performance=request.analyze_performance
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "technical_seo_analysis",
            "url": str(request.url),
            "crawl_depth": request.crawl_depth,
            "pages_crawled": result.get("pages_crawled", 0),
            "issues_found": len(result.get("issues", [])),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Technical SEO analysis completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("analyze_technical_seo", e, request.dict())

# Workflow Endpoints

@router.post("/workflow/website-audit", response_model=BaseResponse)
@log_api_call
async def execute_website_audit(
    request: WorkflowRequest,
    background_tasks: BackgroundTasks
) -> Union[BaseResponse, ErrorResponse]:
    """
    Complete website SEO audit workflow
    
    Executes a comprehensive SEO audit combining on-page analysis,
    technical SEO, performance analysis, and competitive intelligence.
    """
    start_time = datetime.utcnow()
    
    try:
        service = EnterpriseSEOService()
        result = await service.execute_complete_audit(
            website_url=str(request.website_url),
            competitors=[str(comp) for comp in request.competitors] if request.competitors else [],
            target_keywords=request.target_keywords or []
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "website_audit_workflow",
            "website_url": str(request.website_url),
            "competitors_count": len(request.competitors) if request.competitors else 0,
            "overall_score": result.get("overall_score", 0),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/workflows.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Website audit completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("execute_website_audit", e, request.dict())

@router.post("/workflow/content-analysis", response_model=BaseResponse)
@log_api_call
async def execute_content_analysis(
    request: WorkflowRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    AI-powered content analysis workflow
    
    Analyzes content gaps, opportunities, and competitive positioning
    with AI-generated strategic recommendations for content creators.
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        service = ContentStrategyService()
        result = await service.analyze_content_strategy(
            website_url=str(request.website_url),
            competitors=[str(comp) for comp in request.competitors] if request.competitors else [],
            target_keywords=request.target_keywords or [],
            custom_parameters=request.custom_parameters or {},
            user_id=user_id
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "content_analysis_workflow",
            "website_url": str(request.website_url),
            "content_gaps_found": len(result.get("content_gaps", [])),
            "opportunities_identified": len(result.get("opportunities", [])),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/workflows.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Content analysis completed successfully",
            execution_time=execution_time,
            data=result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("execute_content_analysis", e, request.dict())

# Background Task for Sitemap Benchmarking
async def _run_sitemap_benchmark_background(
    user_id: str,
    website_url: str,
    competitors: List[str],
    max_competitors: int
):
    """Background task for running sitemap benchmarking"""
    logger.info(f"Starting background sitemap benchmark for user {user_id}")
    
    # Create a new session for the background task
    db = get_session_for_user(user_id)
    if not db:
        logger.error(f"Failed to get database session for user {user_id}")
        # Even on early failure, refresh the dedup gate so we don't
        # keep getting hit by duplicate requests while the system is
        # misconfigured.
        _mark_sitemap_benchmark_finished(user_id)
        return

    try:
        service = ContentStrategyService()
        integration_service = OnboardingDataIntegrationService()
        
        # Run analysis (long running)
        report = await service.analyze_competitive_sitemap_benchmarking(
            website_url=website_url,
            competitors=competitors,
            max_competitors=max_competitors,
            user_id=user_id
        )

        # Persist results
        persisted = await integration_service.store_competitive_sitemap_benchmarking(user_id, report, db)
        
        if persisted:
            logger.info(f"✅ Background sitemap benchmark completed and saved for user {user_id}")
        else:
            logger.error(f"❌ Failed to persist background sitemap benchmark for user {user_id}")
            await integration_service.update_competitive_sitemap_benchmarking_status(user_id, "failed", db, error="Failed to persist results")

    except Exception as e:
        logger.error(f"❌ Error in background sitemap benchmark for user {user_id}: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            integration_service = OnboardingDataIntegrationService()
            await integration_service.update_competitive_sitemap_benchmarking_status(user_id, "failed", db, error=str(e))
        except Exception as update_err:
            logger.error(f"Failed to update error status: {update_err}")
    finally:
        # Refresh the dedup gate so we don't hammer upstream sitemaps
        # with rapid-fire retries. Without this, a failed run would
        # allow the next /run call to immediately re-trigger, which
        # is what produced the original log flood.
        _mark_sitemap_benchmark_finished(user_id)
        db.close()

@router.post("/competitive-sitemap-benchmarking/run", response_model=BaseResponse)
@log_api_call
async def run_competitive_sitemap_benchmarking(
    request: CompetitiveSitemapBenchmarkingRunRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    start_time = datetime.utcnow()

    try:
        user_id = str(current_user.get("id")) if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Idempotency: refuse to start a new run if a recent one is in
        # progress for this user. This prevents the thundering herd
        # that hammers upstream sitemaps with N concurrent identical
        # fetches, which then trips 429/436 rate limits and logs
        # dozens of duplicate errors. The dedup key is per user so
        # different users don't block each other.
        if _is_recent_sitemap_benchmark_in_flight(user_id):
            logger.info(
                f"⏭️ [DEDUP] Skipping new sitemap benchmark for user {user_id} — "
                f"a recent run is still in flight or completed within the dedup window"
            )
            db_dedup = get_session_for_user(user_id)
            try:
                existing = None
                if db_dedup:
                    integration_service = OnboardingDataIntegrationService()
                    integrated = integration_service.get_integrated_data_sync(user_id, db_dedup)
                    website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}
                    seo_audit = website_analysis.get("seo_audit") if isinstance(website_analysis, dict) else {}
                    existing = seo_audit.get("competitive_sitemap_benchmarking") if isinstance(seo_audit, dict) else None
            finally:
                try:
                    if db_dedup:
                        db_dedup.close()
                except Exception:
                    pass

            execution_time = (datetime.utcnow() - start_time).total_seconds()
            return BaseResponse(
                success=True,
                message="Competitive sitemap benchmarking already in progress; reusing existing run",
                execution_time=execution_time,
                data={
                    "status": "reused",
                    "report": existing,
                },
            )

        # Get initial data to validate request
        db = get_session_for_user(user_id)
        if not db:
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            integration_service = OnboardingDataIntegrationService()
            integrated = integration_service.get_integrated_data_sync(user_id, db)
            website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}
            website_url = website_analysis.get("website_url") if isinstance(website_analysis, dict) else None

            competitor_urls: List[str] = []
            if request.competitors:
                competitor_urls = [str(c) for c in request.competitors]
            else:
                competitor_analysis = integrated.get("competitor_analysis") if isinstance(integrated, dict) else []
                if isinstance(competitor_analysis, list):
                    for comp in competitor_analysis:
                        if not isinstance(comp, dict):
                            continue
                        url = comp.get("competitor_url") or comp.get("url") or comp.get("website_url")
                        if url:
                            competitor_urls.append(str(url))

            if not website_url:
                raise HTTPException(status_code=400, detail="No website_url found. Complete onboarding step 2 first.")

            # Set status to processing
            await integration_service.update_competitive_sitemap_benchmarking_status(user_id, "processing", db)

            # Mark the dedup gate so subsequent duplicate /run calls
            # within _SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC return the
            # existing result instead of launching another background
            # task against the same domain.
            _mark_sitemap_benchmark_started(user_id)

            # Queue background task
            background_tasks.add_task(
                _run_sitemap_benchmark_background,
                user_id=user_id,
                website_url=str(website_url),
                competitors=competitor_urls,
                max_competitors=request.max_competitors
            )

            execution_time = (datetime.utcnow() - start_time).total_seconds()

            return BaseResponse(
                success=True,
                message="Competitive sitemap benchmarking started in background",
                execution_time=execution_time,
                data={
                    "status": "queued",
                    "competitors_count": len(competitor_urls)
                }
            )
        finally:
            try:
                db.close()
            except Exception:
                pass

    except Exception as e:
        return await handle_seo_tool_exception("run_competitive_sitemap_benchmarking", e, request.dict())

@router.get("/competitive-sitemap-benchmarking", response_model=BaseResponse)
@log_api_call
async def get_competitive_sitemap_benchmarking(
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    try:
        user_id = str(current_user.get("id")) if current_user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        db = get_session_for_user(user_id)
        if not db:
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            integration_service = OnboardingDataIntegrationService()
            integrated = integration_service.get_integrated_data_sync(user_id, db)
            website_analysis = integrated.get("website_analysis") if isinstance(integrated, dict) else {}
            seo_audit = website_analysis.get("seo_audit") if isinstance(website_analysis, dict) else {}
            report = seo_audit.get("competitive_sitemap_benchmarking") if isinstance(seo_audit, dict) else None

            return BaseResponse(
                success=True,
                message="Competitive sitemap benchmarking loaded",
                data={
                    "report": report
                }
            )
        finally:
            try:
                db.close()
            except Exception:
                pass

    except Exception as e:
        return await handle_seo_tool_exception("get_competitive_sitemap_benchmarking", e, {})

# Health and Status Endpoints

@router.get("/health", response_model=BaseResponse)
async def health_check() -> BaseResponse:
    """Health check endpoint for SEO tools"""
    return BaseResponse(
        success=True,
        message="AI SEO Tools API is healthy",
        data={
            "status": "operational",
            "available_tools": [
                "meta_description",
                "pagespeed_analysis", 
                "sitemap_analysis",
                "image_alt_text",
                "opengraph_tags",
                "on_page_analysis",
                "technical_seo",
                "website_audit",
                "content_analysis"
            ],
            "version": "1.0.0"
        }
    )

@router.get("/tools/status", response_model=BaseResponse)
async def get_tools_status() -> BaseResponse:
    """Get status of all SEO tools and their dependencies"""
    
    tools_status = {}
    overall_healthy = True
    
    # Check each service
    services = [
        ("meta_description", MetaDescriptionService),
        ("pagespeed", PageSpeedService),
        ("sitemap", SitemapService),
        ("image_alt", ImageAltService),
        ("opengraph", OpenGraphService),
        ("on_page_seo", OnPageSEOService),
        ("technical_seo", TechnicalSEOService),
        ("enterprise_seo", EnterpriseSEOService),
        ("content_strategy", ContentStrategyService)
    ]
    
    for service_name, service_class in services:
        try:
            service = service_class()
            status = await service.health_check() if hasattr(service, 'health_check') else {"status": "unknown"}
            tools_status[service_name] = {
                "healthy": status.get("status") == "operational",
                "details": status
            }
            if not tools_status[service_name]["healthy"]:
                overall_healthy = False
        except Exception as e:
            tools_status[service_name] = {
                "healthy": False,
                "error": str(e)
            }
            overall_healthy = False
    
    return BaseResponse(
        success=overall_healthy,
        message="Tools status check completed",
        data={
            "overall_healthy": overall_healthy,
            "tools": tools_status,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# ==================== ENTERPRISE AUDIT ENDPOINTS ====================

@router.post("/enterprise/complete-audit", response_model=BaseResponse)
@log_api_call
async def execute_enterprise_audit(
    request: EnterpriseAuditRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Execute comprehensive enterprise SEO audit with full orchestration.
    
    Combines multiple SEO analysis tools into an intelligent workflow:
    - Technical SEO audit with issue severity classification
    - On-page SEO analysis with keyword optimization
    - PageSpeed Insights with Core Web Vitals analysis
    - Sitemap analysis with trend detection
    - Content strategy with competitive comparison
    - Competitive benchmarking across specified competitors
    - AI-powered insights and recommendations
    
    Returns prioritized action items with implementation roadmap.
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Starting enterprise audit for {request.website_url}")
        
        # Initialize service
        enterprise_service = EnterpriseSEOService()
        
        # Execute audit
        audit_result = await enterprise_service.execute_complete_audit(
            website_url=str(request.website_url),
            competitors=[str(c) for c in request.competitors] if request.competitors else [],
            target_keywords=request.target_keywords or [],
            include_content_analysis=request.include_content_analysis,
            include_competitive_analysis=request.include_competitive_analysis,
            generate_executive_report=request.generate_executive_report
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Complete enterprise audit executed successfully",
            execution_time=execution_time,
            data=audit_result
        )
        
    except Exception as e:
        logger.error(f"Enterprise audit failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("execute_enterprise_audit", e, request.dict())


@router.post("/enterprise/quick-audit", response_model=BaseResponse)
@log_api_call
async def execute_quick_enterprise_audit(
    website_url: HttpUrl,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Execute quick 5-minute enterprise audit focusing on critical issues.
    
    Provides rapid assessment of most critical SEO problems:
    - Technical SEO critical issues
    - PageSpeed performance bottlenecks
    - Top 3 actionable recommendations
    - Estimated business impact
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Starting quick audit for {website_url}")
        
        enterprise_service = EnterpriseSEOService()
        audit_result = await enterprise_service.execute_quick_audit(str(website_url))
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Quick audit completed",
            execution_time=execution_time,
            data=audit_result
        )
        
    except Exception as e:
        return await handle_seo_tool_exception("execute_quick_enterprise_audit", e, {"website_url": str(website_url)})


# ==================== ADVANCED GSC ANALYSIS ENDPOINTS ====================

@router.post("/gsc/analyze-search-performance", response_model=BaseResponse)
@log_api_call
async def analyze_gsc_search_performance(
    request: GSCAnalysisRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Advanced Google Search Console analysis with comprehensive insights.
    
    Provides deep dive into search performance:
    - Performance overview with aggregated metrics
    - Keyword analysis with trend detection
    - Page-level performance breakdown
    - Content opportunity identification (15+ opportunities scored)
    - Technical SEO signal analysis
    - Competitive positioning assessment
    - AI-powered strategic recommendations
    
    Each analysis component includes:
    - Current metrics and trends
    - Performance scores (0-100)
    - Actionable recommendations
    - Implementation priority
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Starting GSC analysis for {request.site_url}")
        
        user_id = str(current_user.get("id")) if current_user else None
        
        gsc_service = GSCAnalyzerService()
        analysis_result = await gsc_service.analyze_search_performance(
            site_url=str(request.site_url),
            date_range_days=request.date_range_days,
            user_id=user_id
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="GSC search performance analysis completed",
            execution_time=execution_time,
            data=analysis_result
        )
        
    except Exception as e:
        logger.error(f"GSC analysis failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("analyze_gsc_search_performance", e, request.dict())


@router.post("/gsc/content-opportunities", response_model=BaseResponse)
@log_api_call
async def get_content_opportunities_report(
    request: ContentOpportunitiesRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate detailed content opportunities report from GSC data.
    
    Identifies high-priority content gaps and optimization opportunities:
    - Queries with high volume but low CTR (meta/title optimization)
    - Keywords ranking 4-10 (ready for ranking improvement)
    - Long-tail keywords with expansion potential
    - Competitive white space analysis
    
    For each opportunity includes:
    - Current position and metrics
    - Estimated traffic gain
    - Optimization strategy
    - Implementation difficulty
    - Phased roadmap (Phase 1, 2, 3)
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating content opportunities for {request.site_url}")
        
        gsc_service = GSCAnalyzerService()
        report = await gsc_service.get_content_opportunities_report(
            site_url=str(request.site_url),
            min_impressions=request.min_impressions,
            date_range_days=request.date_range_days
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Content opportunities report generated",
            execution_time=execution_time,
            data=report
        )
        
    except Exception as e:
        logger.error(f"Content opportunities report failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("get_content_opportunities_report", e, request.dict())


# ==================== GSC STRATEGY INSIGHTS ENDPOINTS (Dashboard-Focused) ====================

@router.post("/gsc/strategy-insights", response_model=BaseResponse)
@log_api_call
async def get_gsc_strategy_insights(
    request: GSCStrategyInsightsRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Get comprehensive strategy insights from GSC data for SEO Dashboard.
    
    Provides strategic insights optimized for dashboard display:
    - Ranked opportunities by ROI score (0-100)
    - Health metrics with trend comparison
    - Quick summary of key insights
    - Optional: Performance trends and competitive positioning
    
    ROI Scoring Formula:
    ROI = 0.40×traffic_impact + 0.30×ease + 0.20×competitive + 0.10×momentum
    
    Severity Levels:
    - CRITICAL: 80-100 (immediate action)
    - HIGH: 60-79 (high priority)
    - MEDIUM: 40-59 (medium priority)
    - LOW: 20-39 (low priority)
    - WATCH: <20 (monitoring)
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        
        service = GSCStrategyInsightsService()
        insights = await service.get_dashboard_strategy(
            user_id=user_id,
            site_url=str(request.site_url),
            include_trends=request.include_trends,
            include_competitive=request.include_competitive,
            top_n=request.top_n
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="GSC strategy insights generated successfully",
            execution_time=execution_time,
            data=insights
        )
        
    except Exception as e:
        logger.error(f"GSC strategy insights failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("get_gsc_strategy_insights", e, request.dict())


@router.post("/gsc/opportunity-ranking", response_model=BaseResponse)
@log_api_call
async def get_ranked_opportunities(
    request: GSCOpportunityRankingRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Get ROI-ranked opportunities from GSC data.
    
    Returns opportunities sorted by specified metric:
    - roi_score: ROI-weighted score (recommended)
    - effort: Easiest to implement first
    - impact: Highest traffic impact first
    - timeline: Fastest results first
    
    Optional filtering by severity level:
    - critical: 80-100 ROI (immediate action required)
    - high: 60-79 ROI (high priority)
    - medium: 40-59 ROI (medium priority)
    - low: 20-39 ROI (low priority)
    - watch: <20 ROI (monitoring)
    
    Each opportunity includes:
    - ROI score and severity level
    - Implementation effort (hours)
    - Timeline to impact (weeks)
    - Recommendations
    - Related keywords
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        
        service = GSCStrategyInsightsService()
        opportunities = await service._get_ranked_opportunities(
            site_url=str(request.site_url),
            top_n=request.limit
        )
        
        # Filter by severity if specified
        if request.severity_filter and opportunities.get('status') == 'success':
            filtered = [
                opp for opp in opportunities.get('opportunities', [])
                if opp.get('severity') == request.severity_filter
            ]
            opportunities['opportunities'] = filtered
        
        # Sort by metric
        if opportunities.get('status') == 'success' and request.ranking_metric != 'roi_score':
            opps = opportunities.get('opportunities', [])
            if request.ranking_metric == 'effort':
                opps.sort(key=lambda x: x.get('effort_hours', 0))
            elif request.ranking_metric == 'impact':
                opps.sort(key=lambda x: x.get('estimated_impact', 0), reverse=True)
            elif request.ranking_metric == 'timeline':
                opps.sort(key=lambda x: x.get('timeline_weeks', 0))
            opportunities['opportunities'] = opps
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Ranked opportunities retrieved successfully",
            execution_time=execution_time,
            data=opportunities
        )
        
    except Exception as e:
        logger.error(f"Ranked opportunities failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("get_ranked_opportunities", e, request.dict())


@router.post("/gsc/health-metrics", response_model=BaseResponse)
@log_api_call
async def get_health_metrics(
    request: GSCHealthMetricsRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Get comprehensive health metrics for SEO Dashboard.
    
    Returns overall SEO health with:
    - Health score (0-100)
    - Health trend (up/down/stable)
    - Keyword position distribution
    - Average metrics (position, CTR, etc.)
    - Optional: Trend comparison vs period ago
    
    Health Score Calculation:
    Score = 0.60×(Page1_Keywords%) + 0.30×CTR_vs_Benchmark + 0.10×Growth_Rate
    
    Interpretation:
    - 80-100: Excellent SEO health
    - 60-79: Good SEO health
    - 40-59: Needs improvement
    - 0-39: Critical issues
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        
        service = GSCStrategyInsightsService()
        metrics = await service._calculate_health_metrics(
            site_url=str(request.site_url)
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Health metrics calculated successfully",
            execution_time=execution_time,
            data=metrics
        )
        
    except Exception as e:
        logger.error(f"Health metrics calculation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("get_health_metrics", e, request.dict())


@router.post("/gsc/trend-analysis", response_model=BaseResponse)
@log_api_call
async def analyze_gsc_trends(
    request: GSCTrendAnalysisRequest,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Analyze performance trends from GSC data.
    
    Returns trend analysis for specified metrics:
    - position: Ranking trend for keywords
    - impressions: Search volume trends
    - clicks: Click trend
    - ctr: Click-through rate trend
    - all: All metrics combined
    
    For each metric includes:
    - Current value
    - Value from 30/90 days ago
    - Trend direction (up/down/stable)
    - Trend percentage change
    - Momentum (acceleration of trend)
    - Seasonal patterns
    - Anomalies detected
    
    Note: This feature requires historical data collection.
    Phase 1: Manual trend calculation from snapshots.
    Phase 2: Automated historical tracking.
    """
    start_time = datetime.utcnow()
    
    try:
        user_id = str(current_user.get("id")) if current_user else None
        
        service = GSCStrategyInsightsService()
        trends = await service._analyze_performance_trends(
            site_url=str(request.site_url)
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BaseResponse(
            success=True,
            message="Trend analysis completed",
            execution_time=execution_time,
            data=trends
        )
        
    except Exception as e:
        logger.error(f"Trend analysis failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("analyze_gsc_trends", e, request.dict())


@router.get("/enterprise/health", response_model=BaseResponse)
@log_api_call
async def check_enterprise_services_health() -> BaseResponse:
    """Health check for enterprise services"""
    try:
        enterprise_service = EnterpriseSEOService()
        gsc_service = GSCAnalyzerService()
        
        enterprise_health = await enterprise_service.health_check()
        gsc_health = await gsc_service.health_check()
        
        return BaseResponse(
            success=True,
            message="Enterprise services health check completed",
            data={
                "enterprise_seo_service": enterprise_health,
                "gsc_analyzer_service": gsc_health,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Enterprise health check failed: {str(e)}")
        return BaseResponse(
            success=False,
            message="Enterprise health check failed",
            data={"error": str(e)}
        )


# ==================== LLM INSIGHTS ENDPOINTS (Phase 2A.2) ====================

@router.post("/llm/generate-audit-insights", response_model=BaseResponse)
@log_api_call
async def generate_audit_insights(
    request: EnterpriseAuditInsightsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate AI-powered insights from enterprise SEO audit results.
    
    Analyzes audit findings and produces strategic, actionable insights with:
    - Priority scoring (1-10 scale)
    - Traffic impact projections
    - Implementation difficulty assessments
    - Step-by-step action guides
    - Required tools and resources
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating audit insights for {request.website_url}")
        
        llm_service = LLMInsightsService()
        insights = await llm_service.generate_enterprise_audit_insights(
            audit_results=request.audit_results,
            website_url=request.website_url,
            target_keywords=request.target_keywords
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log successful operation
        log_data = {
            "operation": "audit_insights_generation",
            "website_url": request.website_url,
            "insights_generated": len(insights.get('insights', [])),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Audit insights generated successfully",
            execution_time=execution_time,
            data=insights
        )
        
    except Exception as e:
        logger.error(f"Audit insights generation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("generate_audit_insights", e, {"website_url": request.website_url})


@router.post("/llm/generate-gsc-insights", response_model=BaseResponse)
@log_api_call
async def generate_gsc_insights(
    request: GSCAnalysisInsightsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate strategic insights from GSC search performance analysis.
    
    Produces targeted, actionable insights including:
    - Keyword optimization opportunities
    - Content ranking improvement strategies
    - CTR enhancement tactics
    - Competitive positioning analysis
    - Quick-win identification
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating GSC insights for {request.website_url}")
        
        llm_service = LLMInsightsService()
        insights = await llm_service.generate_gsc_analysis_insights(
            gsc_analysis=request.gsc_analysis,
            website_url=request.website_url
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "gsc_insights_generation",
            "website_url": request.website_url,
            "insights_generated": len(insights.get('insights', [])),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="GSC insights generated successfully",
            execution_time=execution_time,
            data=insights
        )
        
    except Exception as e:
        logger.error(f"GSC insights generation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("generate_gsc_insights", e, {"website_url": request.website_url})


@router.post("/llm/generate-content-strategy", response_model=BaseResponse)
@log_api_call
async def generate_content_strategy(
    request: ContentStrategyRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate comprehensive content strategy with AI recommendations.
    
    Creates detailed strategy including:
    - Content gap analysis and solutions
    - Content calendar recommendations
    - Keyword-to-content mapping
    - Competitive content benchmarking
    - Topic cluster suggestions
    - Publishing frequency recommendations
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating content strategy ({len(request.content_gaps)} gaps)")
        
        llm_service = LLMInsightsService()
        strategy = await llm_service.generate_content_strategy_insights(
            current_content=request.current_content,
            content_gaps=request.content_gaps,
            target_keywords=request.target_keywords,
            competitor_content=request.competitor_content
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "content_strategy_generation",
            "gaps_addressed": len(request.content_gaps),
            "keywords_analyzed": len(request.target_keywords),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Content strategy generated successfully",
            execution_time=execution_time,
            data=strategy
        )
        
    except Exception as e:
        logger.error(f"Content strategy generation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("generate_content_strategy", e, {"gaps_count": len(request.content_gaps)})


@router.post("/llm/generate-traffic-roadmap", response_model=BaseResponse)
@log_api_call
async def generate_traffic_roadmap(
    request: TrafficRoadmapRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate phased traffic improvement roadmap with projections.
    
    Produces detailed roadmap with:
    - Phased implementation plan (Week 1, 2, 3+)
    - Traffic gain projections per phase
    - Priority-ordered action items
    - Resource requirements per phase
    - Key performance indicators (KPIs)
    - Success metrics and validation points
    - Risk mitigation strategies
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating traffic roadmap ({request.implementation_timeline_weeks} weeks)")
        
        llm_service = LLMInsightsService()
        roadmap = await llm_service.generate_traffic_improvement_roadmap(
            current_metrics=request.current_metrics,
            identified_opportunities=request.identified_opportunities,
            implementation_timeline_weeks=request.implementation_timeline_weeks
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "traffic_roadmap_generation",
            "timeline_weeks": request.implementation_timeline_weeks,
            "opportunities_count": len(request.identified_opportunities),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Traffic roadmap generated successfully",
            execution_time=execution_time,
            data=roadmap
        )
        
    except Exception as e:
        logger.error(f"Traffic roadmap generation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("generate_traffic_roadmap", e, 
                                              {"opportunities_count": len(request.identified_opportunities)})


@router.post("/llm/generate-competitive-insights", response_model=BaseResponse)
@log_api_call
async def generate_competitive_insights(
    request: CompetitiveInsightsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Generate competitive positioning and intelligence insights.
    
    Analyzes competitive landscape and provides:
    - Competitive advantage identification
    - Competitive gap analysis
    - Market opportunity identification
    - Threat assessment
    - Win strategy recommendations
    - Differentiation recommendations
    - Market position recommendations
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Generating competitive insights ({len(request.competitor_analyses)} competitors)")
        
        llm_service = LLMInsightsService()
        insights = await llm_service.generate_competitive_insights(
            primary_site_analysis=request.primary_site_analysis,
            competitor_analyses=request.competitor_analyses
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "competitive_insights_generation",
            "competitors_analyzed": len(request.competitor_analyses),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Competitive insights generated successfully",
            execution_time=execution_time,
            data=insights
        )
        
    except Exception as e:
        logger.error(f"Competitive insights generation failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("generate_competitive_insights", e,
                                              {"competitors_count": len(request.competitor_analyses)})


@router.post("/llm/prioritized-recommendations", response_model=BaseResponse)
@log_api_call
async def get_prioritized_recommendations(
    request: PrioritizedRecommendationsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Get AI-prioritized recommendations ranked by business impact.
    
    Scores and prioritizes recommendations by:
    - Traffic impact potential
    - Implementation effort required
    - Resource requirements
    - Timeline to implementation
    - Business alignment
    - Risk level
    - ROI potential
    
    Returns categorized as: Quick Wins | High Impact | Long-term
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Prioritizing {len(request.all_recommendations)} recommendations")
        
        llm_service = LLMInsightsService()
        prioritized = await llm_service.generate_prioritized_recommendations(
            all_recommendations=request.all_recommendations,
            business_context=request.business_context
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "prioritized_recommendations_generation",
            "total_recommendations": len(request.all_recommendations),
            "quick_wins": len(prioritized.get('quick_wins', [])),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Recommendations prioritized successfully",
            execution_time=execution_time,
            data=prioritized
        )
        
    except Exception as e:
        logger.error(f"Recommendation prioritization failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("get_prioritized_recommendations", e,
                                              {"recommendations_count": len(request.all_recommendations)})


@router.post("/llm/quick-wins", response_model=BaseResponse)
@log_api_call
async def identify_quick_wins(
    request: QuickWinsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Identify quick wins - high-impact actions implementable in short timeframe.
    
    Finds high-ROI quick wins including:
    - Meta tag optimization opportunities
    - URL structure improvements
    - On-page optimization quick fixes
    - Internal linking recommendations
    - Content formatting improvements
    - Technical SEO quick fixes
    - Performance optimization opportunities
    
    Each with: estimated traffic gain, implementation time, tools needed, expected outcomes
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Identifying quick wins (max {request.max_days_to_implement} days)")
        
        llm_service = LLMInsightsService()
        quick_wins = await llm_service.generate_quick_wins(
            audit_data=request.audit_data,
            max_days_to_implement=request.max_days_to_implement
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "quick_wins_identification",
            "max_days": request.max_days_to_implement,
            "quick_wins_found": len(quick_wins.get('quick_wins', [])),
            "total_potential_traffic": quick_wins.get('total_potential_traffic', 0),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Quick wins identified successfully",
            execution_time=execution_time,
            data=quick_wins
        )
        
    except Exception as e:
        logger.error(f"Quick wins identification failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("identify_quick_wins", e,
                                              {"max_days": request.max_days_to_implement})


@router.post("/llm/keyword-expansion", response_model=BaseResponse)
@log_api_call
async def expand_keywords(
    request: KeywordExpansionRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
) -> Union[BaseResponse, ErrorResponse]:
    """
    Expand keyword list with AI-generated related and long-tail keywords.
    
    Generates 15-20 additional keywords including:
    - Long-tail keyword variations
    - Question-based keywords (People Also Ask)
    - Local keyword variations
    - Intent-based keywords (commercial, informational, navigational)
    - Seasonal keyword variants
    
    Each keyword includes: search volume estimate, difficulty score, relevance, content opportunity
    """
    start_time = datetime.utcnow()
    
    try:
        logger.info(f"Expanding keywords from {len(request.current_keywords)} base keywords")
        
        llm_service = LLMInsightsService()
        expansion = await llm_service.generate_keyword_expansion(
            current_keywords=request.current_keywords,
            content_analysis=request.content_analysis,
            target_difficulty=request.target_difficulty
        )
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        log_data = {
            "operation": "keyword_expansion",
            "original_keywords": len(request.current_keywords),
            "expanded_keywords": expansion.get('expanded_keywords', 0),
            "execution_time": execution_time,
            "success": True
        }
        background_tasks.add_task(save_to_file, f"{LOG_DIR}/llm_operations.jsonl", log_data)
        
        return BaseResponse(
            success=True,
            message="Keyword expansion completed successfully",
            execution_time=execution_time,
            data=expansion
        )
        
    except Exception as e:
        logger.error(f"Keyword expansion failed: {str(e)}", exc_info=True)
        return await handle_seo_tool_exception("expand_keywords", e,
                                              {"keywords_count": len(request.current_keywords)})


@router.get("/llm/health", response_model=BaseResponse)
@log_api_call
async def check_llm_insights_health() -> BaseResponse:
    """Health check for LLM insights service"""
    try:
        llm_service = LLMInsightsService()
        health = await llm_service.health_check()
        
        return BaseResponse(
            success=True,
            message="LLM insights service is healthy",
            data={
                "service": health.get('service'),
                "version": health.get('version'),
                "llm_integration": health.get('llm_integration'),
                "timestamp": health.get('last_check')
            }
        )
    except Exception as e:
        logger.error(f"LLM insights health check failed: {str(e)}")
        return BaseResponse(
            success=False,
            message="LLM insights service health check failed",
            data={"error": str(e)}
        )
