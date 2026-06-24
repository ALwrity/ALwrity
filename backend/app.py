# Ensure typing constructs and models are available globally for FastAPI type annotation evaluation
import os

# Print env vars immediately - BEFORE any imports
print(f"[app.py] EARLY - PORT={os.getenv('PORT')}, HOST={os.getenv('HOST')}", flush=True)

import typing
import builtins
import builtins

# Make common typing constructs available globally
builtins.Optional = typing.Optional
builtins.List = typing.List
builtins.Dict = typing.Dict
builtins.Any = typing.Any
builtins.Union = typing.Union

# Load environment variables FIRST before any other imports
from pathlib import Path
from dotenv import load_dotenv
backend_dir = Path(__file__).parent
project_root = backend_dir.parent

# Load .env but DON'T override existing environment variables (especially PORT from Render)
# Use override=False to preserve Render-provided PORT
load_dotenv(backend_dir / '.env', override=False)
load_dotenv(project_root / '.env', override=False)
load_dotenv(override=False)

# Set LOG_LEVEL early to WARNING in feature-only modes to suppress DEBUG persona logs
import os
if os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() not in ("", "all"):
    os.environ["LOG_LEVEL"] = "WARNING"

print(f"[app.py] Starting... ALWRITY_ENABLED_FEATURES={os.getenv('ALWRITY_ENABLED_FEATURES')}", flush=True)


def get_enabled_features() -> set:
    """Get enabled features from ALWRITY_ENABLED_FEATURES env var."""
    env_value = os.getenv("ALWRITY_ENABLED_FEATURES", "all").strip().lower()
    if not env_value or env_value == "all":
        return {"all"}
    return {f.strip() for f in env_value.split(",") if f.strip()}


def _is_full_mode() -> bool:
    """Check if running in full mode (all features enabled)."""
    enabled = get_enabled_features()
    return "all" in enabled


def _is_feature_enabled(feature: str) -> bool:
    """Check if a specific feature is enabled (including in 'all' mode)."""
    enabled = get_enabled_features()
    return feature in enabled or "all" in enabled


# Print env var IMMEDIATELY at module start
print(f"[app.py] ALWRITY_ENABLED_FEATURES at start: {os.getenv('ALWRITY_ENABLED_FEATURES')}", flush=True)


# Import onboarding models (after env is loaded, before heavy imports)
from models.onboarding import APIKey, WebsiteAnalysis, ResearchPreferences, PersonaData, CompetitorAnalysis


# Import FastAPI and related
from fastapi import FastAPI, HTTPException, Depends, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
import asyncio
from datetime import datetime
from loguru import logger

def _log_memory_usage():
    try:
        import psutil
        mem_mb = psutil.Process().memory_info().rss // (1024 * 1024)
        logger.info(f"Memory usage (MB): {mem_mb}")
    except Exception:
        # psutil not available or failed; skip silently
        pass

# Log memory early in app.py startup
_log_memory_usage()
logger.info("app.py: Early memory checkpoint after env load")


# Import modular utilities (skip OnboardingManager import in feature-only modes)
from alwrity_utils import HealthChecker, RateLimiter, FrontendServing, RouterManager
if _is_full_mode():
    from alwrity_utils import OnboardingManager

# Skip monitoring middleware in feature-only modes to save memory
if _is_full_mode():
    from services.subscription import monitoring_middleware
else:
    monitoring_middleware = None


# Set up clean logging for end users
from logging_config import setup_clean_logging
setup_clean_logging()

# Import middleware
from middleware.auth_middleware import get_current_user

# Import component logic endpoints (skip in feature-only modes - uses seo_analyzer)
component_logic_router = None
if _is_full_mode():
    from api.component_logic import router as component_logic_router

# Import subscription API endpoints
from api.subscription import router as subscription_router

# Import Step 3 onboarding routes (skip in feature-only modes)
step3_routes = None
if _is_full_mode():
    from api.onboarding_utils.step3_routes import router as step3_routes

# Import SEO tools router (skip in feature-only modes - uses seo_analyzer)
seo_tools_router = None
if _is_full_mode():
    from routers.seo_tools import router as seo_tools_router

# Skip heavy services in feature-only modes (PersonaAnalysisService, etc.)
if _is_full_mode():
    from api.brainstorm import router as brainstorm_router
    from api.images import router as images_router
    from api.assets_serving import router as assets_serving_router
    from routers.image_studio import router as image_studio_router
    from routers.product_marketing import router as product_marketing_router
    from routers.campaign_creator import router as campaign_creator_router
else:
    # In feature-only modes, only load essential assets router
    from api.assets_serving import router as assets_serving_router
    brainstorm_router = None
    images_router = None
    image_studio_router = None
    product_marketing_router = None
    campaign_creator_router = None

# Import hallucination detector router
try:
    from api.hallucination_detector import router as hallucination_detector_router
except Exception as e:
    logger.warning(f"Failed to import hallucination_detector router: {e}")
    hallucination_detector_router = None

# Import charts router (shared chart generation for blog writer, podcast, etc.)
try:
    from api.charts import router as charts_router
except Exception as e:
    logger.warning(f"Failed to import charts router: {e}")
    charts_router = None

# Import links router (internal & external link search and rewording)
try:
    from api.links import router as links_router
except Exception as e:
    logger.warning(f"Failed to import links router: {e}")
    links_router = None

# Import research configuration router (skip in feature-only modes)
if _is_full_mode():
    from api.research_config import router as research_config_router
else:
    research_config_router = None

# Import user data endpoints
# Import content planning endpoints (skip in feature-only modes)
if _is_full_mode():
    from api.content_planning.api.router import router as content_planning_router
    from api.content_planning.strategy_copilot import router as strategy_copilot_router
else:
    content_planning_router = None
    strategy_copilot_router = None

# Import user data endpoints (skip in feature-only modes to save memory)
if _is_full_mode():
    from api.user_data import router as user_data_router
else:
    user_data_router = None

# Import database service
from services.database import close_database
from services.startup_health import (
    get_startup_status,
    readiness_under_auth_context,
    run_startup_health_routine,
)

# Trigger reload for monitoring fix

# Import OAuth token monitoring routes (skip in feature-only modes)
if _is_full_mode():
    from api.oauth_token_monitoring_routes import router as oauth_token_monitoring_router
else:
    oauth_token_monitoring_router = None

# Import SEO Dashboard endpoints (skip in feature-only modes to save memory)
if _is_full_mode():
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
        get_onboarding_task_health,
    )
else:
    get_seo_dashboard_data = None
    get_seo_health_score = None
    get_seo_metrics = None
    get_platform_status = None
    get_ai_insights = None
    seo_dashboard_health_check = None
    analyze_seo_comprehensive = None
    analyze_seo_full = None
    get_seo_metrics_detailed = None
    get_analysis_summary = None
    batch_analyze_urls = None
    SEOAnalysisRequest = None
    get_seo_dashboard_overview = None
    get_gsc_raw_data = None
    get_bing_raw_data = None
    get_competitive_insights = None
    get_deep_competitor_analysis = None
    run_strategic_insights = None
    get_strategic_insights_history = None
    refresh_analytics_data = None
    analyze_urls_ai = None
    AnalyzeURLsRequest = None
    get_analyzed_pages = None
    get_semantic_health = None
    get_semantic_cache_stats = None
    get_sif_indexing_health = None
    get_onboarding_task_health = None


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
    "https://alwrity-5vac2n9su-ajsis-projects.vercel.app",  # Current Vercel deployment
    "https://alwrity.vercel.app",  # Vercel app
]

# Optional dynamic origins from environment (comma-separated)
env_origins = os.getenv("ALWRITY_ALLOWED_ORIGINS", "").split(",") if os.getenv("ALWRITY_ALLOWED_ORIGINS") else []
env_origins = [o.strip() for o in env_origins if o.strip()]

# Convenience: NGROK_URL env var (single origin)
ngrok_origin = os.getenv("NGROK_URL")
if ngrok_origin:
    env_origins.append(ngrok_origin.strip())

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
router_group_status: Dict[str, Dict[str, Any]] = {}

onboarding_manager = None
# Only create OnboardingManager in full mode
if _is_full_mode():
    from alwrity_utils import OnboardingManager
    onboarding_manager = OnboardingManager(app)

# Middleware Order (FastAPI executes in REVERSE order of registration - LIFO):
# Registration order:  1. Monitoring  2. Rate Limit  3. API Key Injection
# Execution order:     1. API Key Injection (sets user_id)  2. Rate Limit  3. Monitoring (uses user_id)

# 1. FIRST REGISTERED (runs LAST) - Monitoring middleware (skip in podcast-only mode)
if monitoring_middleware:
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
    health_data = health_checker.basic_health_check()
    health_data["feature_mode"] = "single" if not _is_full_mode() else "full"
    health_data["enabled_features"] = list(get_enabled_features())
    return health_data

@app.get("/health/database")
async def database_health():
    """Database health check endpoint."""
    return health_checker.database_health_check()

@app.get("/health/comprehensive")
async def comprehensive_health():
    """Comprehensive health check endpoint."""
    return health_checker.comprehensive_health_check()

@app.get("/health/readiness")
async def readiness(current_user: dict = Depends(get_current_user)):
    """Readiness check that validates tenant DB resolution/session under auth context."""
    return {
        "feature_mode": "single" if not _is_full_mode() else "full",
        "enabled_features": list(get_enabled_features()),
        "startup": get_startup_status(),
        "tenant": readiness_under_auth_context(current_user),
    }

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
    status = router_manager.get_router_status()
    status.update(
        {
            "feature_mode": "single" if not _is_full_mode() else "full",
            "enabled_features": list(get_enabled_features()),
            "router_groups": router_group_status,
        }
    )
    return status

@app.get("/api/feature-profile/status")
async def feature_profile_status():
    """Get feature profile status and enabled modules."""
    return router_manager.get_feature_profile_status()

# Onboarding management endpoints
@app.get("/api/onboarding/status")
async def onboarding_status():
    """Get onboarding manager status (or demo-mode disabled state)."""
    if not _is_full_mode():
        return {
            "enabled": False,
            "status": "disabled",
            "message": f"Onboarding is disabled in feature-only mode. Enabled features: {list(get_enabled_features())}",
            "feature_mode": "single",
        }
    return onboarding_manager.get_onboarding_status()

# Include routers using modular utilities
enabled_features = get_enabled_features()
if "all" in enabled_features:
    # Full mode: load all core and optional routers
    router_group_status["modular_core"] = {
        "mounted": router_manager.include_core_routers(),
        "reason": "Full mode",
    }
    router_group_status["modular_optional"] = {
        "mounted": router_manager.include_optional_routers(),
        "reason": "Full mode",
    }
else:
    # Feature-only mode: load only routers matching enabled features
    from alwrity_utils.router_manager import CORE_ROUTER_REGISTRY

    # Filter core routers that match any enabled feature
    matching_core = [
        r for r in CORE_ROUTER_REGISTRY
        if r.get("features", set()) & enabled_features
    ]
    logger.info(
        f"[FEATURE-MODE] Enabled features: {enabled_features}, "
        f"matching {len(matching_core)} core routers: {[r['name'] for r in matching_core]}"
    )

    # Try to include step4_assets for voice cloning (may fail if nltk not installed)
    step4_entry = next((r for r in matching_core if r.get("name") == "step4_assets"), None)
    if step4_entry:
        try:
            logger.info(f"[FEATURE-MODE] Attempting to load step4_assets")
            router = router_manager._load_router_from_registry(step4_entry)
            router_manager.include_router_safely(router, step4_entry["name"], step4_entry.get("include_kwargs"))
        except ImportError as e:
            logger.warning(f"[FEATURE-MODE] Skipping step4_assets (missing optional dependency): {e}")
        except Exception as e:
            logger.error(f"[FEATURE-MODE] Failed to mount step4_assets: {e}")

    # Load other matching core routers
    for entry in matching_core:
        if entry.get("name") == "step4_assets":
            continue  # Already loaded above
        if entry.get("name") == "subscription":
            continue  # Loaded separately below
        try:
            logger.info(f"[FEATURE-MODE] Loading router: {entry['name']}")
            router = router_manager._load_router_from_registry(entry)
            router_manager.include_router_safely(router, entry["name"], entry.get("include_kwargs"))
        except Exception as e:
            logger.error(f"[FEATURE-MODE] Failed to mount {entry.get('name', 'unknown')}: {e}")

    router_group_status["modular_core"] = {
        "mounted": True,
        "reason": f"Feature-only mode: {enabled_features}",
    }

    # Load optional routers matching enabled features
    from alwrity_utils.router_manager import OPTIONAL_ROUTER_REGISTRY
    matching_optional = [
        r for r in OPTIONAL_ROUTER_REGISTRY
        if r.get("features", set()) & enabled_features
    ]
    for entry in matching_optional:
        try:
            logger.info(f"[FEATURE-MODE] Loading optional router: {entry['name']}")
            router = router_manager._load_router_from_registry(entry)
            router_manager.include_router_safely(router, entry["name"], entry.get("include_kwargs"))
        except Exception as e:
            logger.error(f"[FEATURE-MODE] Failed to mount optional {entry.get('name', 'unknown')}: {e}")

    router_group_status["modular_optional"] = {
        "mounted": True,
        "reason": f"Feature-only mode: {enabled_features}",
    }

# Safety net: explicitly include hallucination detector (import may fail gracefully)
if hallucination_detector_router:
    router_manager.include_router_safely(hallucination_detector_router, "hallucination_detector")

# Include charts router (shared chart generation)
if charts_router:
    router_manager.include_router_safely(charts_router, "charts")

# Include links router (internal & external link search)
if links_router:
    router_manager.include_router_safely(links_router, "links")

# Log startup summary
router_manager.log_startup_summary()

# Safety net: keep subscription routes available even if core inclusion flow changes
# in special modes (e.g., demo mode). De-dup is handled by RouterManager.
router_manager.include_router_safely(subscription_router, "subscription")

# Include assets serving router (must be mounted to serve generated images)
app.include_router(assets_serving_router)
router_group_status["assets_serving"] = {
    "mounted": True,
    "reason": "Required for podcast media assets",
}

# SEO Dashboard endpoints (skip in feature-only modes)
if _is_full_mode():
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


    @app.get("/api/seo-dashboard/onboarding-task-health")
    async def onboarding_task_health_endpoint(current_user: dict = Depends(get_current_user), site_url: str = None):
        """Get consolidated health for onboarding-scheduled SEO tasks."""
        return await get_onboarding_task_health(current_user, site_url)

    @app.get("/api/seo-dashboard/health")
    async def seo_dashboard_health():
        """Health check for SEO dashboard."""
        return await seo_dashboard_health_check()

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
if _is_full_mode():
    from routers.platform_analytics import router as platform_analytics_router
    app.include_router(platform_analytics_router)
    # Include Bing Analytics Storage router to expose storage-backed endpoints
    from routers.bing_analytics_storage import router as bing_analytics_storage_router
    app.include_router(bing_analytics_storage_router)
    # Include SEO Tools router with enterprise audit and GSC analysis
    if seo_tools_router:
        app.include_router(seo_tools_router)
    if images_router:
        app.include_router(images_router)
    if image_studio_router:
        app.include_router(image_studio_router)
    if product_marketing_router:
        app.include_router(product_marketing_router)
    if campaign_creator_router:
        app.include_router(campaign_creator_router)

    router_group_status["platform_extensions"] = {
        "mounted": True,
        "reason": "Full mode",
    }
else:
    router_group_status["platform_extensions"] = {
        "mounted": False,
        "reason": "Skipped in feature-only mode",
    }

# Include content assets router (always — core utility, not feature-specific)
from api.content_assets.router import router as content_assets_router

# Include LinkedIn Industry Watchdog router (always — background service)
from routers.linkedin_watchdog import router as linkedin_watchdog_router
app.include_router(linkedin_watchdog_router)
app.include_router(content_assets_router)

# Include Podcast Maker router (only when podcast feature is enabled)
if _is_feature_enabled("podcast") and "all" not in get_enabled_features():
    from api.podcast.router import router as podcast_router
    logger.info(f"[ROUTER] Including podcast_router")
    app.include_router(podcast_router)
    router_group_status["podcast_maker"] = {
        "mounted": True,
        "reason": "Podcast feature enabled",
    }
elif "all" in get_enabled_features():
    # In full mode, podcast is loaded via optional router registry
    router_group_status["podcast_maker"] = {
        "mounted": True,
        "reason": "Full mode (loaded via registry)",
    }
else:
    router_group_status["podcast_maker"] = {
        "mounted": False,
        "reason": "Podcast feature not enabled",
    }

if _is_full_mode():
    # Include YouTube Creator Studio router
    from api.youtube.router import router as youtube_router
    app.include_router(youtube_router, prefix="/api")

    # Include research configuration router
    if research_config_router:
        app.include_router(research_config_router, prefix="/api/research", tags=["research"])

    # Include Research Engine router (standalone AI research module)
    from api.research.router import router as research_engine_router
    app.include_router(research_engine_router, tags=["Research Engine"])

    # Scheduler dashboard routes
    from api.scheduler_dashboard import router as scheduler_dashboard_router
    app.include_router(scheduler_dashboard_router)
    if oauth_token_monitoring_router:
        app.include_router(oauth_token_monitoring_router)

    # Autonomous Agents API routes (Phase 3A)
    from api.agents_api import router as agents_router
    app.include_router(agents_router)

    # Today workflow routes
    from api.today_workflow import router as today_workflow_router
    app.include_router(today_workflow_router)
    router_group_status["advanced_workflows"] = {
        "mounted": True,
        "reason": "Full mode",
    }
else:
    router_group_status["advanced_workflows"] = {
        "mounted": False,
        "reason": "Skipped in feature-only mode",
    }

# Setup frontend serving using modular utilities
frontend_serving.setup_frontend_serving()

# Serve React frontend (for production)
@app.get("/")
async def serve_frontend():
    """Serve the React frontend."""
    return frontend_serving.serve_frontend()

# Startup event - fires AFTER port is bound
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    import time
    startup_start = time.time()
    
    logger.info("[STARTUP] Server port bound, beginning background initialization...")
    
    try:
        _log_memory_usage()
        
        # Phase 3.6: surface silent FILE_ENCRYPTION_SALT misconfiguration.
        # Runs in non-strict mode so dev environments without the env var
        # keep working; a clear warning is logged instead. Operators who
        # need hard-fail behavior can set FILE_ENCRYPTION_SALT in the env.
        try:
            from services.intelligence.agent_flat_context import (
                validate_file_encryption_salt,
            )
            salt_ok = validate_file_encryption_salt(strict=False)
            if salt_ok:
                logger.info("[STARTUP] FILE_ENCRYPTION_SALT validated (Phase 3.6)")
        except Exception as salt_check_err:
            logger.warning(
                f"[STARTUP] Phase 3.6 salt check failed: {salt_check_err}"
            )

        # Note: Pricing is initialized per-user in services/database.py:init_user_database()
        # which runs on first database access for each user. No global seeding needed at startup.
        
        enabled_features = get_enabled_features()
        is_single_mode = "all" not in enabled_features
        
        # Skip startup health checks in feature-only modes to avoid unnecessary DB errors
        if _is_full_mode():
            startup_report = run_startup_health_routine(app)
            if startup_report.get("status") != "healthy":
                logger.error(f"Startup readiness finished with failures: {startup_report.get('errors', [])}")
        else:
            logger.info(f"[FEATURE-MODE] Skipping startup health routine (features: {enabled_features})")

        # Start task scheduler only in full mode
        if _is_full_mode():
            from services.scheduler import get_scheduler
            await get_scheduler().start()
        else:
            logger.info(f"[FEATURE-MODE] Skipping scheduler startup (features: {enabled_features})")

        # Recover stale YouTube tasks on startup
        if _is_feature_enabled("youtube"):
            try:
                from api.youtube.task_manager import task_manager
                from services.database import get_all_user_ids
                user_ids = get_all_user_ids()
                recovered = 0
                for uid in user_ids:
                    try:
                        count = task_manager.recover_stale_tasks(uid)
                        recovered += count
                    except Exception:
                        pass
                if recovered > 0:
                    logger.info(f"[STARTUP] Recovered {recovered} stale YouTube tasks across {len(user_ids)} users")
            except Exception as e:
                logger.warning(f"[STARTUP] YouTube task recovery skipped: {e}")

        # Check Wix configuration (OAuth-based, API key optional)
        wix_api_key = os.getenv('WIX_API_KEY')
        if wix_api_key:
            logger.info(f"WIX_API_KEY loaded ({len(wix_api_key)} chars)")
        wix_client_id = os.getenv('WIX_CLIENT_ID')
        if not wix_client_id:
            logger.warning("⚠️ WIX_CLIENT_ID not found in environment - Wix OAuth connection will fail")

        # Start watchdog monitor background poller
        try:
            from services.linkedin.watchdog_monitor_scheduler import start_watchdog_poller
            await start_watchdog_poller()
        except Exception as poller_err:
            logger.warning(f"[STARTUP] Watchdog monitor poller not started: {poller_err}")

        elapsed = time.time() - startup_start
        logger.info(f"ALwrity backend started successfully in {elapsed:.1f}s")
        
        # Critical router mount assertions for feature-only modes
        _assert_router_mounted("subscription")
        if _is_feature_enabled("podcast"):
            _assert_router_mounted("podcast")
        if _is_feature_enabled("blog_writer"):
            _assert_router_mounted("blog_writer")
    except Exception as e:
        logger.error(f"Error during startup: {e}")
        # Don't raise - let the server start anyway


def _assert_router_mounted(router_name: str) -> None:
    """Assert that a critical router is mounted. Fails startup if not found."""
    from fastapi import routing
    mounted_routes = [route.path for route in app.routes]
    
    # Check for router-specific paths
    router_path_indicators = {
        "subscription": ["/api/subscription/plans", "/api/subscription/preflight"],
        "podcast": ["/api/podcast/projects", "/api/podcast/"],
        "blog_writer": ["/api/blog/health", "/api/blog/research/start"],
    }
    
    expected_paths = router_path_indicators.get(router_name, [])
    found = any(path in mounted_routes for path in expected_paths)
    
    if found:
        logger.info(f"✅ Critical router '{router_name}' is mounted")
    else:
        error_msg = f"❌ CRITICAL: Router '{router_name}' is NOT mounted! Expected paths: {expected_paths}"
        logger.error(error_msg)
        # In feature-only mode, only fail if the feature is expected
        if not _is_full_mode() and _is_feature_enabled(router_name):
            raise RuntimeError(error_msg)

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

        # Stop watchdog monitor poller
        try:
            from services.linkedin.watchdog_monitor_scheduler import stop_watchdog_poller
            await stop_watchdog_poller()
        except Exception as poller_err:
            logger.warning(f"[SHUTDOWN] Watchdog monitor poller stop error: {poller_err}")

        # Close Exa Monitor HTTP client
        try:
            from services.research.exa_monitors import get_exa_monitor_client
            client = get_exa_monitor_client()
            await client.close()
        except Exception:
            pass

        logger.info("ALwrity backend shutdown successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


# Add main block to allow running directly with: python app.py
# This also helps Gunicorn work correctly
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "10000"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"[app.py] ====================", flush=True)
    print(f"[app.py] DIRECT STARTUP", flush=True)
    print(f"[app.py] PORT={port}, HOST={host}", flush=True)
    print(f"[app.py] ====================", flush=True)
    
    uvicorn.run(app, host=host, port=port) 
