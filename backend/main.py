# Ensure typing constructs and models are available globally for FastAPI type annotation evaluation
import typing
import builtins

# Make common typing constructs available globally
builtins.Optional = typing.Optional
builtins.List = typing.List
builtins.Dict = typing.Dict
builtins.Any = typing.Any
builtins.Union = typing.Union

# Import onboarding models VERY early to ensure they're available before any services
from models.onboarding import APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis


from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
from loguru import logger
from dotenv import load_dotenv
import asyncio
from datetime import datetime

# Import OnboardingSession right after basic imports to ensure it's available
from models.onboarding import OnboardingSession

from services.subscription import monitoring_middleware

# Import remaining onboarding models
from models import APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis

# Import modular utilities
from alwrity_utils import HealthChecker, RateLimiter, FrontendServing, RouterManager
from alwrity_utils import OnboardingManager

# Load environment variables
# Try multiple locations for .env file
from pathlib import Path
backend_dir = Path(__file__).parent
project_root = backend_dir.parent

# Load from backend/.env first (higher priority), then root .env
load_dotenv(backend_dir / '.env')  # backend/.env
load_dotenv(project_root / '.env')  # root .env (fallback)
load_dotenv()  # CWD .env (fallback)

# Set up clean logging for end users
from logging_config import setup_clean_logging
setup_clean_logging()

# Import middleware
from middleware.auth_middleware import get_current_user

# Import component logic endpoints (needs OnboardingSession, so import after models)
from api.component_logic import router as component_logic_router

# Import subscription API endpoints
from api.subscription import router as subscription_router

# Import Step 3 onboarding routes
from api.onboarding_utils.step3_routes import router as step3_routes

# Import SEO tools router
from routers.seo_tools import router as seo_tools_router
# Import Facebook Writer endpoints
from api.facebook_writer.routers import facebook_router
# Import LinkedIn content generation router
from routers.linkedin import router as linkedin_router
# Import LinkedIn image generation router
from api.linkedin_image_generation import router as linkedin_image_router
from api.brainstorm import router as brainstorm_router
from api.images import router as images_router
from routers.image_studio import router as image_studio_router
from routers.product_marketing import router as product_marketing_router
from routers.campaign_creator import router as campaign_creator_router
from routers.backlink_outreach import router as backlink_outreach_router

# Import hallucination detector router
from api.hallucination_detector import router as hallucination_detector_router
from api.writing_assistant import router as writing_assistant_router
from api.charts import router as charts_router
from api.links import router as links_router

# Import research configuration router
from api.research_config import router as research_config_router

# Import user data endpoints
# Import content planning endpoints
from api.content_planning.api.router import router as content_planning_router
from api.user_data import router as user_data_router

# Import user environment endpoints
from api.user_environment import router as user_environment_router

# Import strategy copilot endpoints
from api.content_planning.strategy_copilot import router as strategy_copilot_router

# Import database service
from services.database import init_database, close_database

# Trigger reload for monitoring fix

# Import OAuth token monitoring routes
from api.oauth_token_monitoring_routes import router as oauth_token_monitoring_router

# Import SEO Dashboard endpoints
from api.seo_dashboard import (
    get_seo_dashboard_data,
    get_seo_health_score,
    get_seo_metrics,
    get_platform_status,
    get_ai_insights,
    seo_dashboard_health_check,
    analyze_seo_comprehensive,
    analyze_seo_full,
    get_seo_metrics_detailed,
    get_analysis_summary,
    batch_analyze_urls,
    SEOAnalysisRequest,
    get_seo_dashboard_overview,
    get_gsc_raw_data,
    get_bing_raw_data,
    get_competitive_insights,
    get_deep_competitor_analysis,
    run_strategic_insights,
    get_strategic_insights_history,
    refresh_analytics_data,
    analyze_urls_ai,
    AnalyzeURLsRequest,
    get_analyzed_pages,
    get_semantic_health,
    get_semantic_cache_stats,
    get_sif_indexing_health,
    get_guardian_audit,
    get_keyword_gaps,
    get_serp_gaps,
    get_competitor_content,
    get_content_gap_radar,
    generate_content_from_gap,
    GenerateContentRequest,
)

# Initialize FastAPI app
app = FastAPI(
    title="ALwrity Backend API",
    description="Backend API for ALwrity - AI-powered content creation platform",
    version="1.0.0"
)

# Add CORS middleware
# Build allowed origins list with env overrides to support dynamic tunnels (e.g., ngrok)
default_allowed_origins = [
    "http://localhost:3000",  # React dev server
    "http://localhost:8000",  # Backend dev server
    "http://localhost:3001",  # Alternative React port
    "https://alwrity-ai.vercel.app",  # Vercel frontend
]

# Optional dynamic origins from environment (comma-separated)
env_origins = os.getenv("ALWRITY_ALLOWED_ORIGINS", "").split(",") if os.getenv("ALWRITY_ALLOWED_ORIGINS") else []
env_origins = [o.strip() for o in env_origins if o.strip()]

# Convenience: NGROK_URL env var (single origin)
ngrok_origin = os.getenv("NGROK_URL")
if ngrok_origin:
    env_origins.append(ngrok_origin.strip())

allowed_origins = list(dict.fromkeys(default_allowed_origins + env_origins))  # de-duplicate, keep order

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize modular utilities
health_checker = HealthChecker()
rate_limiter = RateLimiter(window_seconds=60, max_requests=200)
frontend_serving = FrontendServing(app)
router_manager = RouterManager(app)

onboarding_manager = OnboardingManager(app)

# Middleware Order (FastAPI executes in REVERSE order of registration - LIFO):
# Registration order:  1. Monitoring  2. Rate Limit  3. API Key Injection
# Execution order:     1. API Key Injection (sets user_id)  2. Rate Limit  3. Monitoring (uses user_id)

# 1. FIRST REGISTERED (runs LAST) - Monitoring middleware
app.middleware("http")(monitoring_middleware)

# 2. SECOND REGISTERED (runs SECOND) - Rate limiting
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware using modular utilities."""
    return await rate_limiter.rate_limit_middleware(request, call_next)

# 3. LAST REGISTERED (runs FIRST) - API key injection
from middleware.api_key_injection_middleware import api_key_injection_middleware
app.middleware("http")(api_key_injection_middleware)

# Health check endpoints using modular utilities
@app.get("/health")
async def health():
    """Health check endpoint."""
    return health_checker.basic_health_check()

@app.get("/health/database")
async def database_health():
    """Database health check endpoint."""
    return health_checker.database_health_check()

@app.get("/health/comprehensive")
async def comprehensive_health():
    """Comprehensive health check endpoint."""
    return health_checker.comprehensive_health_check()

# Rate limiting management endpoints
@app.get("/api/rate-limit/status")
async def rate_limit_status(request: Request):
    """Get current rate limit status for the requesting client."""
    client_ip = request.client.host if request.client else "unknown"
    return rate_limiter.get_rate_limit_status(client_ip)

@app.post("/api/rate-limit/reset")
async def reset_rate_limit(request: Request, client_ip: Optional[str] = None):
    """Reset rate limit for a specific client or all clients."""
    if client_ip is None:
        client_ip = request.client.host if request.client else "unknown"
    return rate_limiter.reset_rate_limit(client_ip)

# Frontend serving management endpoints
@app.get("/api/frontend/status")
async def frontend_status():
    """Get frontend serving status."""
    return frontend_serving.get_frontend_status()

# Router management endpoints
@app.get("/api/routers/status")
async def router_status():
    """Get router inclusion status."""
    return router_manager.get_router_status()

@app.get("/api/feature-profile/status")
async def feature_profile_status():
    """Get feature profile status and enabled modules."""
    return router_manager.get_feature_profile_status()

# Onboarding management endpoints
@app.get("/api/onboarding/status")
async def onboarding_status():
    """Get onboarding manager status."""
    return onboarding_manager.get_onboarding_status()

# Include routers using modular utilities
router_manager.include_core_routers()
# Safety net: keep subscription routes available even if core inclusion flow changes
# in special modes (e.g., demo mode). De-dup is handled by RouterManager.
router_manager.include_router_safely(subscription_router, "subscription")
# Include hallucination detector explicitly (router_manager may skip silently on import failure)
router_manager.include_router_safely(hallucination_detector_router, "hallucination_detector")
# Include charts router (shared chart generation for blog writer, podcast, etc.)
router_manager.include_router_safely(charts_router, "charts")
# Include links router (internal & external link search and rewording)
router_manager.include_router_safely(links_router, "links")
router_manager.include_optional_routers()

# SEO Dashboard endpoints
@app.get("/api/seo-dashboard/data")
async def seo_dashboard_data():
    """Get complete SEO dashboard data."""
    return await get_seo_dashboard_data()

@app.get("/api/seo-dashboard/health-score")
async def seo_health_score():
    """Get SEO health score."""
    return await get_seo_health_score()

@app.get("/api/seo-dashboard/metrics")
async def seo_metrics():
    """Get SEO metrics."""
    return await get_seo_metrics()

@app.get("/api/seo-dashboard/platforms")
async def seo_platforms(current_user: dict = Depends(get_current_user)):
    """Get platform status."""
    return await get_platform_status(current_user)

@app.get("/api/seo-dashboard/insights")
async def seo_insights():
    """Get AI insights."""
    return await get_ai_insights()

# New SEO Dashboard endpoints with real data
@app.get("/api/seo-dashboard/overview")
async def seo_dashboard_overview_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get comprehensive SEO dashboard overview with real GSC/Bing data."""
    return await get_seo_dashboard_overview(current_user, site_url)

@app.get("/api/seo-dashboard/gsc/raw")
async def gsc_raw_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get raw GSC data for the specified site."""
    return await get_gsc_raw_data(current_user, site_url)

@app.get("/api/seo-dashboard/bing/raw")
async def bing_raw_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get raw Bing data for the specified site."""
    return await get_bing_raw_data(current_user, site_url)

@app.get("/api/seo-dashboard/competitive-insights")
async def competitive_insights_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get competitive insights from onboarding step 3 data."""
    return await get_competitive_insights(current_user, site_url)

@app.get("/api/seo-dashboard/deep-competitor-analysis")
async def deep_competitor_analysis_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Get deep competitor analysis results (auto-scheduled post-onboarding)."""
    return await get_deep_competitor_analysis(current_user, site_url)

@app.post("/api/seo-dashboard/strategic-insights/run")
async def run_strategic_insights_endpoint(current_user: dict = Depends(get_current_user)):
    """Run AI-powered strategic insights analysis manually."""
    return await run_strategic_insights(current_user)

@app.get("/api/seo-dashboard/strategic-insights/history")
async def get_strategic_insights_history_endpoint(current_user: dict = Depends(get_current_user)):
    """Fetch the history of strategic insights for the user."""
    return await get_strategic_insights_history(current_user)

@app.post("/api/seo-dashboard/refresh")
async def refresh_analytics_data_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Refresh analytics data by invalidating cache and fetching fresh data."""
    return await refresh_analytics_data(current_user, site_url)

@app.get("/api/seo-dashboard/health")
async def seo_dashboard_health():
    """Health check for SEO dashboard."""
    return await seo_dashboard_health_check()

# Phase 2B: Semantic health monitoring endpoint (24-hour polling)
@app.get("/api/seo-dashboard/semantic-health")
async def semantic_health_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get real-time semantic health metrics for content and competitors.
    This endpoint provides Phase 2B semantic intelligence monitoring data.
    
    Returns semantic health score, status, and recommendations.
    Data is cached and updated every 24 hours via scheduler.
    """
    return await get_semantic_health(current_user)


@app.get("/api/seo-dashboard/cache-stats")
async def semantic_cache_stats_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get semantic cache performance statistics.
    Returns hit rate, memory usage, and eviction counts.
    """
    return await get_semantic_cache_stats(current_user)


@app.get("/api/seo-dashboard/sif-health")
async def sif_indexing_health_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get SIF indexing health summary for the current user.
    Used by the Semantic Indexing Status widget on the dashboard.
    """
    return await get_sif_indexing_health(current_user)


@app.get("/api/sif/metrics")
async def sif_metrics_endpoint(current_user: dict = Depends(get_current_user)):
    """Phase 4.6: SIF metrics for the team-activity page (or any
    dashboard widget that wants to surface live SIF activity).

    Returns a JSON dict with:
      - ``user_id``: the requesting user
      - ``counters``: global counters (search, index, delete, cluster, cache, sync)
      - ``gauges``: process-wide gauges (uptime, corrupt markers, etc.)
      - ``user_gauges``: per-user gauges (sif_index_count, sif_corrupt_marker, sif_ann_disabled)

    The endpoint is cheap: it reads from the in-process
    ``sif_metrics`` module, which holds the data in a thread-safe
    dict. No DB queries, no model loads.
    """
    try:
        from services.intelligence.sif_metrics import get_metrics_for_user
        user_id = str(current_user.get("id"))
        return get_metrics_for_user(user_id)
    except ImportError as e:
        logger.warning(f"/api/sif/metrics: sif_metrics not available: {e}")
        return {
            "user_id": str(current_user.get("id", "")),
            "counters": {},
            "gauges": {},
            "user_gauges": {},
            "error": "sif_metrics_unavailable",
        }
    except Exception as e:
        logger.error(f"/api/sif/metrics failed: {e}")
        return {
            "user_id": str(current_user.get("id", "")),
            "counters": {},
            "gauges": {},
            "user_gauges": {},
            "error": str(e),
        }


@app.get("/api/seo-dashboard/guardian-audit")
async def guardian_audit_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Get the latest Content Guardian audit report for the current user.
    Returns content quality, brand voice, safety, and cannibalization metrics.
    Used by the Content Guardian Audit Card on the dashboard.
    """
    return await get_guardian_audit(current_user)


@app.get("/api/seo-dashboard/keyword-gaps")
async def keyword_gaps_endpoint(
    current_user: dict = Depends(get_current_user),
    site_url: str = None,
):
    """
    Get keyword gap analysis from GSC data.
    Returns keyword gaps, quick wins, content opportunities, and page opportunities
    for the user's site, derived from last 30 days of GSC search analytics.
    """
    return await get_keyword_gaps(current_user, site_url)


@app.get("/api/seo-dashboard/serp-gaps")
async def serp_gaps_endpoint(
    current_user: dict = Depends(get_current_user),
    topics: Optional[List[str]] = None,
):
    """
    Get SERP gap analysis — detect which competitors rank for given topics.

    Uses Google Custom Search `site:` queries per competitor domain to detect
    ranking presence. If no topics are provided, derives them from the user's
    latest SIF semantic gap analysis (up to 12 topics).
    """
    return await get_serp_gaps(current_user, topics)


@app.get("/api/seo-dashboard/competitor-content")
async def competitor_content_endpoint(
    current_user: dict = Depends(get_current_user),
    topics: Optional[List[str]] = None,
):
    """
    Get competitor content deep-dive for gap topics using Exa.

    Scopes Exa neural search to known competitor domains and returns
    full text, highlights, and summaries for competitive analysis.
    If no topics provided, derives up to 6 from the latest SIF semantic gaps.
    """
    return await get_competitor_content(current_user, topics)


@app.get("/api/seo-dashboard/content-gap-radar")
async def content_gap_radar_endpoint(
    current_user: dict = Depends(get_current_user),
    bypass_cache: bool = Query(False, description="Bypass 24h cache"),
):
    """
    Run the Content Gap Radar pipeline — full Phase 3 agent.

    Orchestrates SIF semantic gap analysis, SERP ranking presence (Google CSE),
    competitor content deep-dive (Exa), and trend momentum scoring into a single
    ROI-ranked list of content opportunities.
    """
    return await get_content_gap_radar(current_user, bypass_cache=bypass_cache)


@app.post("/api/seo-dashboard/content-gap-radar/generate-content")
async def generate_content_from_gap_endpoint(
    request: GenerateContentRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a content brief from a content gap radar item and save it
    as a blog ContentAsset. Navigate to /blog-writer with the returned
    asset_id to resume in the full Blog Writer workflow.
    """
    return await generate_content_from_gap(request, current_user)


# Comprehensive SEO Analysis endpoints
@app.post("/api/seo-dashboard/analyze-comprehensive")
async def analyze_seo_comprehensive_endpoint(request: SEOAnalysisRequest):
    """Analyze a URL for comprehensive SEO performance."""
    return await analyze_seo_comprehensive(request)

@app.post("/api/seo-dashboard/analyze-full")
async def analyze_seo_full_endpoint(request: SEOAnalysisRequest):
    """Analyze a URL for comprehensive SEO performance."""
    return await analyze_seo_full(request)

@app.get("/api/seo-dashboard/metrics-detailed")
async def seo_metrics_detailed(url: str):
    """Get detailed SEO metrics for a URL."""
    return await get_seo_metrics_detailed(url)

@app.get("/api/seo-dashboard/analysis-summary")
async def seo_analysis_summary(url: str):
    """Get a quick summary of SEO analysis for a URL."""
    return await get_analysis_summary(url)

@app.post("/api/seo-dashboard/batch-analyze")
async def batch_analyze_urls_endpoint(urls: list[str]):
    """Analyze multiple URLs in batch."""
    return await batch_analyze_urls(urls)

@app.post("/api/seo-dashboard/analyze-urls-ai")
async def analyze_urls_ai_endpoint(request: AnalyzeURLsRequest, current_user: dict = Depends(get_current_user)):
    """Run AI-powered SEO analysis on selected URLs."""
    return await analyze_urls_ai(request, current_user)

# Include platform analytics router
from routers.platform_analytics import router as platform_analytics_router
app.include_router(platform_analytics_router)
app.include_router(images_router)
app.include_router(image_studio_router)
app.include_router(product_marketing_router)
app.include_router(campaign_creator_router)
app.include_router(backlink_outreach_router)

# Include content assets router
from api.content_assets.router import router as content_assets_router
app.include_router(content_assets_router)

# Include Podcast Maker router
from api.podcast.router import router as podcast_router
app.include_router(podcast_router)

# Include YouTube Creator Studio router
from api.youtube.router import router as youtube_router
app.include_router(youtube_router, prefix="/api")

# Include research configuration router
app.include_router(research_config_router, prefix="/api/research", tags=["research"])

# Include Research Engine router (standalone AI research module)
from api.research.router import router as research_engine_router
app.include_router(research_engine_router, tags=["Research Engine"])

# Scheduler dashboard routes
from api.scheduler_dashboard import router as scheduler_router
app.include_router(scheduler_router)
app.include_router(oauth_token_monitoring_router)

# Include scheduler monitoring API
# from api.scheduler_monitoring import router as scheduler_monitoring_router
# app.include_router(scheduler_monitoring_router)

# Autonomous Agents API routes (Phase 3A)
from api.agents_api import router as agents_router
app.include_router(agents_router)

# Today workflow routes
from api.today_workflow import router as today_workflow_router
app.include_router(today_workflow_router)

# Setup frontend serving using modular utilities
frontend_serving.setup_frontend_serving()

# Serve React frontend (for production)
@app.get("/")
async def serve_frontend():
    """Serve the React frontend."""
    return frontend_serving.serve_frontend()

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    try:
        # Initialize database
        init_database()
        
        # Start task scheduler
        from services.scheduler import get_scheduler
        await get_scheduler().start()
        
        # Check Wix API key configuration
        wix_api_key = os.getenv('WIX_API_KEY')
        if wix_api_key:
            logger.warning(f"âœ… WIX_API_KEY loaded ({len(wix_api_key)} chars, starts with '{wix_api_key[:10]}...')")
        else:
            logger.warning("âš ï¸ WIX_API_KEY not found in environment - Wix publishing may fail")
        
        logger.info("ALwrity backend started successfully")
    except Exception as e:
        logger.error(f"Error during startup: {e}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    try:
        # Stop task scheduler
        from services.scheduler import get_scheduler
        await get_scheduler().stop()
        
        # Close database connections
        close_database()
        logger.info("ALwrity backend shutdown successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}") 
