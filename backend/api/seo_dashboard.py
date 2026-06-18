"""SEO Dashboard API endpoints for ALwrity."""

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import os
from loguru import logger
import time

# Import existing services
from services.onboarding.api_key_manager import APIKeyManager
from services.validation import check_all_api_keys
from services.seo_analyzer import ComprehensiveSEOAnalyzer, SEOAnalysisResult, SEOAnalysisService
from services.user_data_service import UserDataService
from services.database import get_db_session, get_session_for_user
from services.seo import SEODashboardService
from middleware.auth_middleware import get_current_user
from services.llm_providers.main_text_generation import llm_text_gen
from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
from models.onboarding import SEOPageAudit, WebsiteAnalysis, OnboardingSession, CompetitorAnalysis
from sqlalchemy.orm.attributes import flag_modified

from sqlalchemy import desc

# Phase 2B: Import semantic monitoring
from services.intelligence.monitoring.semantic_dashboard import RealTimeSemanticMonitor, SemanticHealthMetric

# GSC services for keyword gap analysis
from services.gsc_service import GSCService
from services.gsc_brainstorm_service import GSCBrainstormService

# Import SIF models for guardian audit
from models.website_analysis_monitoring_models import SIFIndexingTask, SIFIndexingExecutionLog

router = APIRouter(prefix="/api/seo-dashboard", tags=["SEO Dashboard"])

# Initialize the SEO analyzer
seo_analyzer = ComprehensiveSEOAnalyzer()

# Pydantic models for SEO Dashboard
class SEOHealthScore(BaseModel):
    score: int
    change: int
    trend: str
    label: str
    color: str

class SEOMetric(BaseModel):
    value: float
    change: float
    trend: str
    description: str
    color: str

class PlatformStatus(BaseModel):
    status: str
    connected: bool
    last_sync: Optional[str] = None
    data_points: Optional[int] = None

class AIInsight(BaseModel):
    insight: str
    priority: str
    category: str
    action_required: bool
    tool_path: Optional[str] = None

class SEODashboardData(BaseModel):
    health_score: SEOHealthScore
    key_insight: str
    priority_alert: str
    metrics: Dict[str, SEOMetric]
    platforms: Dict[str, PlatformStatus]
    ai_insights: List[AIInsight]
    last_updated: str
    website_url: Optional[str] = None
    advertools_insights: Optional[Dict[str, Any]] = None
    technical_seo_audit: Optional[Dict[str, Any]] = None

# New models for comprehensive SEO analysis
class SEOAnalysisRequest(BaseModel):
    url: str
    target_keywords: Optional[List[str]] = None

class AnalyzeURLsRequest(BaseModel):
    urls: List[str]

class SEOAnalysisResponse(BaseModel):
    url: str
    timestamp: datetime
    overall_score: int
    health_status: str
    critical_issues: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    data: Dict[str, Any]
    success: bool
    message: str

class SEOMetricsResponse(BaseModel):
    metrics: Dict[str, Any]
    critical_issues: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    detailed_analysis: Dict[str, Any]
    timestamp: str
    url: str

# Mock data for Phase 1
def get_mock_seo_data() -> SEODashboardData:
    """Get mock SEO dashboard data for Phase 1."""
    # Try to get the user's website URL from the database
    website_url = None
    db_session = get_db_session()
    if db_session:
        try:
            user_data_service = UserDataService(db_session)
            website_url = user_data_service.get_user_website_url()
            logger.info(f"Retrieved website URL from database: {website_url}")
        except Exception as e:
            logger.error(f"Error fetching website URL from database: {e}")
        finally:
            db_session.close()
    
    return SEODashboardData(
        health_score=SEOHealthScore(
            score=78,
            change=12,
            trend="up",
            label="Good",
            color="#FF9800"
        ),
        key_insight="Your content strategy is working! Focus on technical SEO to reach 90+ score",
        priority_alert="Mobile speed needs attention - 2.8s load time",
        website_url=website_url,  # Include the user's website URL
        metrics={
            "traffic": SEOMetric(
                value=23450,
                change=23,
                trend="up",
                description="Strong growth!",
                color="#4CAF50"
            ),
            "rankings": SEOMetric(
                value=8,
                change=8,
                trend="up",
                description="Great work on content",
                color="#2196F3"
            ),
            "mobile": SEOMetric(
                value=2.8,
                change=-0.3,
                trend="down",
                description="Needs attention",
                color="#FF9800"
            ),
            "keywords": SEOMetric(
                value=156,
                change=5,
                trend="up",
                description="5 new opportunities",
                color="#9C27B0"
            )
        },
        platforms={
            "google_search_console": PlatformStatus(
                status="excellent",
                connected=True,
                last_sync="2024-01-15T10:30:00Z",
                data_points=1250
            ),
            "google_analytics": PlatformStatus(
                status="good",
                connected=True,
                last_sync="2024-01-15T10:25:00Z",
                data_points=890
            ),
            "bing_webmaster": PlatformStatus(
                status="needs_attention",
                connected=False,
                last_sync=None,
                data_points=0
            )
        },
        ai_insights=[
            AIInsight(
                insight="Your mobile page speed is 2.8s - optimize images and enable compression",
                priority="high",
                category="performance",
                action_required=True,
                tool_path="/seo-tools/page-speed-optimizer"
            ),
            AIInsight(
                insight="Add structured data to improve rich snippet opportunities",
                priority="medium",
                category="technical",
                action_required=False,
                tool_path="/seo-tools/schema-generator"
            ),
            AIInsight(
                insight="Content quality score improved by 15% - great work!",
                priority="low",
                category="content",
                action_required=False
            )
        ],
        last_updated="2024-01-15T10:30:00Z"
    )

def calculate_health_score(metrics: Dict[str, Any]) -> SEOHealthScore:
    """Calculate SEO health score based on metrics."""
    # This would be replaced with actual calculation logic
    base_score = 75
    change = 12
    trend = "up"
    label = "Good"
    color = "#FF9800"
    
    return SEOHealthScore(
        score=base_score,
        change=change,
        trend=trend,
        label=label,
        color=color
    )

def generate_ai_insights(metrics: Dict[str, Any], platforms: Dict[str, Any]) -> List[AIInsight]:
    """Generate AI-powered insights based on metrics and platform data."""
    insights = []
    
    # Performance insights
    if metrics.get("mobile", {}).get("value", 0) > 2.5:
        insights.append(AIInsight(
            insight="Mobile page speed needs optimization - aim for under 2 seconds",
            priority="high",
            category="performance",
            action_required=True,
            tool_path="/seo-tools/page-speed-optimizer"
        ))
    
    # Technical insights
    if not platforms.get("google_search_console", {}).get("connected", False):
        insights.append(AIInsight(
            insight="Connect Google Search Console for better SEO monitoring",
            priority="medium",
            category="technical",
            action_required=True,
            tool_path="/seo-tools/search-console-setup"
        ))
    
    # Content insights
    if metrics.get("rankings", {}).get("change", 0) > 0:
        insights.append(AIInsight(
            insight="Rankings are improving - continue with current content strategy",
            priority="low",
            category="content",
            action_required=False
        ))
    
    return insights

from services.seo.deep_competitor_analysis_service import DeepCompetitorAnalysisService

# API Endpoints
async def run_strategic_insights(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Manually trigger AI-Powered Competitive Insights (Weekly Strategy Brief).
    """
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
            
        try:
            # 1. Get Website Analysis (with fallback)
            website_analysis_data = None
            analysis_id = None
            
            # Try SSOT first
            integration_service = OnboardingDataIntegrationService()
            integrated_data = integration_service.get_integrated_data_sync(user_id, db_session)
            if integrated_data and integrated_data.get("website_analysis"):
                 website_analysis_data = integrated_data.get("website_analysis")
                 analysis_id = website_analysis_data.get("id")
            
            # Fallback: Find latest WebsiteAnalysis across sessions
            if not website_analysis_data:
                latest_analysis = db_session.query(WebsiteAnalysis).join(
                    OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id
                ).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(WebsiteAnalysis.updated_at.desc()).first()
                
                if latest_analysis:
                    # Convert to dict
                    from fastapi.encoders import jsonable_encoder
                    website_analysis_data = jsonable_encoder(latest_analysis)
                    analysis_id = latest_analysis.id
            
            if not website_analysis_data:
                raise HTTPException(status_code=400, detail="No website analysis found. Please complete Onboarding Step 2.")

            # 2. Get Competitors
            competitors = []
            if integrated_data:
                competitors = integrated_data.get("competitor_analysis", [])
                
            if not competitors:
                 # Fallback to research preferences
                 research_prefs = integrated_data.get("research_preferences", {})
                 competitors = research_prefs.get("competitors", [])

            if not competitors:
                 raise HTTPException(status_code=400, detail="No competitors found. Please complete Onboarding Step 3.")

            # 3. Run Analysis
            service = DeepCompetitorAnalysisService()
            report = await service.generate_weekly_strategy_brief(
                user_id=user_id,
                website_analysis=website_analysis_data,
                competitors=competitors
            )
            
            # 4. Persist to History
            if analysis_id:
                wa = db_session.query(WebsiteAnalysis).filter(WebsiteAnalysis.id == analysis_id).first()
                if wa:
                    history = wa.strategic_insights_history or []
                    # Ensure history is a list
                    if not isinstance(history, list):
                        history = []
                    
                    # Prepend new report
                    history.insert(0, report)
                    
                    # Keep last 52 weeks
                    wa.strategic_insights_history = history[:52]
                    flag_modified(wa, "strategic_insights_history")
                    db_session.commit()
            
            return report

        finally:
            db_session.close()

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error running strategic insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run analysis: {str(e)}")

async def get_seo_dashboard_data(current_user: dict = Depends(get_current_user)) -> SEODashboardData:
    """Get comprehensive SEO dashboard data."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            logger.error("No database session available")
            return get_mock_seo_data()
        
        try:
            # Use new SEO dashboard service
            dashboard_service = SEODashboardService(db_session)
            overview_data = await dashboard_service.get_dashboard_overview(user_id)
            
            # Convert to SEODashboardData format
            return SEODashboardData(
                health_score=SEOHealthScore(**overview_data.get("health_score", {})),
                key_insight=overview_data.get("key_insight", "Connect your analytics accounts for personalized insights"),
                priority_alert=overview_data.get("priority_alert", "No alerts at this time"),
                metrics=_convert_metrics(overview_data.get("summary", {})),
                platforms=_convert_platforms(overview_data.get("platforms", {})),
                ai_insights=[AIInsight(**insight) for insight in overview_data.get("ai_insights", [])],
                last_updated=overview_data.get("last_updated", datetime.now().isoformat()),
                website_url=overview_data.get("website_url"),
                advertools_insights=overview_data.get("advertools_insights"),
                technical_seo_audit=overview_data.get("technical_seo_audit"),
            )
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting SEO dashboard data: {e}")
        # Fallback to mock data
        return get_mock_seo_data()

async def get_seo_health_score(current_user: dict = Depends(get_current_user)) -> SEOHealthScore:
    """Get current SEO health score."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
        
        try:
            dashboard_service = SEODashboardService(db_session)
            overview_data = await dashboard_service.get_dashboard_overview(user_id)
            health_score_data = overview_data.get("health_score", {})
            return SEOHealthScore(**health_score_data)
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting SEO health score: {e}")
        raise HTTPException(status_code=500, detail="Failed to get SEO health score")

async def get_seo_metrics(current_user: dict = Depends(get_current_user)) -> Dict[str, SEOMetric]:
    """Get SEO metrics."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
        
        try:
            dashboard_service = SEODashboardService(db_session)
            overview_data = await dashboard_service.get_dashboard_overview(user_id)
            summary_data = overview_data.get("summary", {})
            return _convert_metrics(summary_data)
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting SEO metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get SEO metrics")

async def get_platform_status(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get platform connection status."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            # Use SEO dashboard service to get platform status
            dashboard_service = SEODashboardService(db_session)
            platform_status = await dashboard_service.get_platform_status(user_id)
            
            logger.info(f"Retrieved platform status for user {user_id}")
            return platform_status
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting platform status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get platform status")

async def get_ai_insights(current_user: dict = Depends(get_current_user)) -> List[AIInsight]:
    """Get AI-generated insights."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
        
        try:
            dashboard_service = SEODashboardService(db_session)
            overview_data = await dashboard_service.get_dashboard_overview(user_id)
            ai_insights_data = overview_data.get("ai_insights", [])
            return [AIInsight(**insight) for insight in ai_insights_data]
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting AI insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI insights")

async def seo_dashboard_health_check():
    """Health check for SEO dashboard."""
    return {"status": "healthy", "service": "SEO Dashboard API"}

# Phase 2B: Semantic health monitoring endpoint
async def get_semantic_health(current_user: dict = Depends(get_current_user)) -> SemanticHealthMetric:
    """
    Get the canonical semantic health summary for the user's content and competitors.
    This endpoint provides Phase 2B semantic intelligence monitoring data.

    Returns:
        SemanticHealthMetric with health status, aggregate score, and recommendations.
    """
    try:
        user_id = str(current_user.get('id'))
        
        # Initialize semantic monitor for this user
        semantic_monitor = RealTimeSemanticMonitor(user_id)
        
        # Get current semantic health (will use cache if available)
        semantic_health: SemanticHealthMetric = await semantic_monitor.check_semantic_health(user_id)
        
        logger.info(f"[Semantic Health API] Retrieved health data for user {user_id}: {semantic_health.status} (score: {semantic_health.value:.2f})")
        
        return semantic_health
        
    except Exception as e:
        logger.error(f"[Semantic Health API] Error retrieving semantic health for user: {e}")
        # Return a default healthy state with warning message
        return SemanticHealthMetric(
            metric_name="semantic_health",
            value=0.5,
            threshold=0.6,
            status="warning",
            timestamp=datetime.utcnow().isoformat(),
            description="Semantic monitoring temporarily unavailable",
            recommendations=["Please try again later", "Check system status"]
        )


async def get_semantic_cache_stats(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get statistics for the semantic cache.
    """
    try:
        user_id = str(current_user.get('id'))
        # Initialize semantic monitor to access its cache manager
        semantic_monitor = RealTimeSemanticMonitor(user_id)
        return await semantic_monitor.get_cache_stats()
    except Exception as e:
        logger.error(f"[Semantic Cache API] Error retrieving cache stats: {e}")
        return {
            "error": "Failed to retrieve cache statistics",
            "hit_rate": 0.0,
            "memory_usage_mb": 0.0
        }


async def get_sif_indexing_health(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """SIF indexing health for the dashboard.

    Phase 4.3: extends the response with ``index_stats``:
      - ``doc_count``: number of docs in the user's txtai index
        (0 if uninitialized — the service is lazily created)
      - ``ann_disabled``: True if a previous run hit IndexIDMap
        nprobe and fell back to linear search
      - ``corrupt_marker_present``: True if a ``.corrupt`` marker
        file exists for the user (signals next service start will
        rebuild the index — Phase 3.1 auto-remediation)

    Phase 4.4: extends the response with ``cache_stats``:
      - total cache entries
      - memory usage MB
      - hit/miss/invalidations from the cache layer

    The function is best-effort: if the intelligence service or
    cache cannot be loaded (e.g. txtai not installed in this
    environment), the corresponding section is set to ``None``
    rather than raising.
    """
    try:
        user_id = str(current_user.get("id"))
        db_session = get_session_for_user(user_id)
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")

        try:
            dashboard_service = SEODashboardService(db_session)
            onboarding_task_health = await dashboard_service.get_onboarding_scheduled_task_health(user_id)
            sif_health = onboarding_task_health.get("tasks", {}).get("SIFIndexingTask", {})

            if sif_health.get("status") == "not_scheduled":
                return {
                    "has_task": False,
                    "status": "not_scheduled",
                    "message": "SIF indexing task not yet scheduled for this website.",
                }

            overall_status = "healthy"
            if (sif_health.get("consecutive_failures") or 0) > 0:
                overall_status = "warning"
            if sif_health.get("status") in {"failed", "needs_intervention"}:
                overall_status = "critical"

            return {
                "has_task": True,
                "status": overall_status,
                "task": {
                    "raw_status": sif_health.get("status"),
                    "next_execution": sif_health.get("next_execution"),
                    "last_success": sif_health.get("last_success"),
                    "last_failure": sif_health.get("last_failure"),
                    "consecutive_failures": sif_health.get("consecutive_failures") or 0,
                },
                "last_run": {
                    "status": sif_health.get("latest_execution", {}).get("status"),
                    "time": sif_health.get("latest_execution", {}).get("execution_date"),
                    "error_message": sif_health.get("latest_execution", {}).get("error_message"),
                },
                # Phase 4.3: live index stats from the txtai service.
                # Best-effort: returns None if the service is not
                # importable in this environment (e.g. txtai missing).
                "index_stats": _collect_sif_index_stats(user_id),
                # Phase 4.4: cache stats from the semantic cache.
                "cache_stats": _collect_sif_cache_stats(),
                # Phase 4.5: structured counters since process start.
                "metrics": _collect_sif_metrics_snapshot(user_id),
            }
        finally:
            db_session.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get SIF indexing health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get SIF indexing health")


async def get_guardian_audit(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Get the latest Content Guardian audit report for the current user.
    Returns audit data (quality, brand voice, safety, cannibalization) or a
    null-state response if no audit has been performed yet.
    """
    try:
        user_id = str(current_user.get("id"))
        db_session = get_session_for_user(user_id)
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")

        try:
            # Find the most recent SIF indexing task for this user
            task = (
                db_session.query(SIFIndexingTask)
                .filter(SIFIndexingTask.user_id == user_id)
                .order_by(desc(SIFIndexingTask.created_at))
                .first()
            )

            if not task:
                return {
                    "has_audit": False,
                    "status": "not_available",
                    "message": "No SIF indexing task found. Onboarding may not be complete.",
                }

            # Get the latest execution log with a guardian report
            log = (
                db_session.query(SIFIndexingExecutionLog)
                .filter(
                    SIFIndexingExecutionLog.task_id == task.id,
                    SIFIndexingExecutionLog.result_data.isnot(None),
                )
                .order_by(desc(SIFIndexingExecutionLog.execution_date))
                .first()
            )

            if not log or not log.result_data:
                return {
                    "has_audit": False,
                    "status": "pending",
                    "message": "SIF indexing has not completed a run yet.",
                }

            guardian_report = log.result_data.get("guardian_report")
            if not guardian_report:
                return {
                    "has_audit": False,
                    "status": "no_report",
                    "message": "Guardian audit was not performed on the last indexing run.",
                }

            return {
                "has_audit": True,
                "status": "available",
                "audit_timestamp": guardian_report.get("audit_timestamp"),
                "website_url": guardian_report.get("website_url"),
                "total_pages_crawled": guardian_report.get("total_pages_crawled", 0),
                "content_quality": guardian_report.get("content_quality"),
                "brand_voice_consistency": guardian_report.get("brand_voice_consistency"),
                "safety_issues": guardian_report.get("safety_issues"),
                "cannibalization_issues": guardian_report.get("cannibalization_issues"),
                "last_execution_time": log.execution_date.isoformat() if log.execution_date else None,
            }
        finally:
            db_session.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get guardian audit: {e}")
        raise HTTPException(status_code=500, detail="Failed to get guardian audit")


async def get_keyword_gaps(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get keyword gap analysis from GSC data.
    Returns keyword gaps, quick wins, content opportunities, and page-level opportunities
    derived from the user's Google Search Console search analytics (last 30 days).
    """
    try:
        user_id = str(current_user.get("id"))

        gsc_service = GSCService()
        brainstorm_service = GSCBrainstormService(gsc_service)

        # Resolve site URL
        if not site_url:
            sites = gsc_service.get_site_list(user_id)
            if not sites:
                return {
                    "error": "No GSC sites found. Connect Google Search Console first.",
                    "keyword_gaps": [],
                    "quick_wins": [],
                    "content_opportunities": [],
                    "page_opportunities": [],
                    "summary": {},
                }
            site_url = sites[0].get("siteUrl", "")

        # Fetch GSC analytics (last 30 days)
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        analytics = gsc_service.get_search_analytics(
            user_id=user_id,
            site_url=site_url,
            start_date=start_date,
            end_date=end_date,
        )

        if "error" in analytics:
            return {
                "error": analytics.get("error", "Failed to fetch GSC data"),
                "keyword_gaps": [],
                "quick_wins": [],
                "content_opportunities": [],
                "page_opportunities": [],
                "summary": {},
            }

        query_rows = analytics.get("query_data", {}).get("rows", [])
        page_rows = analytics.get("page_data", {}).get("rows", [])

        keywords_data = GSCBrainstormService._parse_query_rows(query_rows)
        pages_data = GSCBrainstormService._parse_page_rows(page_rows)

        if not keywords_data:
            return {
                "error": "No keyword data available for the last 30 days.",
                "keyword_gaps": [],
                "quick_wins": [],
                "content_opportunities": [],
                "page_opportunities": [],
                "summary": {
                    "site_url": site_url,
                    "date_range": {"start": start_date, "end": end_date},
                    "total_keywords_analyzed": 0,
                },
            }

        # Run rule-based analysis WITHOUT topic filter (site-wide)
        content_opportunities = GSCBrainstormService._identify_content_opportunities(keywords_data)
        keyword_gaps = GSCBrainstormService._identify_keyword_gaps(keywords_data)
        quick_wins = GSCBrainstormService._identify_quick_wins(keywords_data)
        page_opportunities = GSCBrainstormService._identify_page_opportunities(pages_data)
        summary = GSCBrainstormService._compute_summary(
            keywords_data, pages_data, site_url, start_date, end_date
        )

        return {
            "keyword_gaps": keyword_gaps,
            "quick_wins": quick_wins,
            "content_opportunities": content_opportunities,
            "page_opportunities": page_opportunities,
            "summary": summary,
        }
    except Exception as e:
        logger.error(f"Failed to get keyword gaps: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get keyword gaps: {str(e)}")


async def get_serp_gaps(
    current_user: dict = Depends(get_current_user),
    topics: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Get SERP gap analysis — detect which competitors rank for given topics.

    Uses Google Custom Search `site:` queries per competitor domain to detect
    ranking presence. Topics can be provided explicitly or derived from the
    user's latest SIF semantic gap analysis.

    Args:
        topics: Optional list of topic phrases. If omitted, uses the user's
                latest SIF semantic gaps (up to 12 topics).

    Returns:
        Dict with gaps list and metadata.
    """
    try:
        user_id = str(current_user.get("id"))

        # If no topics provided, fetch from SIF semantic gaps
        if not topics:
            try:
                from services.intelligence.agents.specialized import StrategyArchitectAgent
                from services.intelligence.txtai_service import TxtaiIntelligenceService

                integration = OnboardingDataIntegrationService()
                db_session = get_session_for_user(user_id)
                if db_session:
                    try:
                        integrated = integration.get_integrated_data_sync(
                            user_id, db_session
                        )
                        competitor_indices = []
                        if integrated and integrated.get("competitor_analysis"):
                            competitor_indices = [
                                i
                                for i, _ in enumerate(
                                    integrated["competitor_analysis"]
                                )
                            ]
                        agent = StrategyArchitectAgent(
                            TxtaiIntelligenceService(user_id), user_id
                        )
                        gaps = await agent.find_semantic_gaps(competitor_indices)
                        topics = [g["topic"] for g in gaps[:12]]
                    finally:
                        db_session.close()
            except Exception as e:
                logger.warning(
                    f"Could not derive topics from SIF gaps: {e}. "
                    "Pass topics explicitly."
                )
                return {
                    "gaps": [],
                    "message": "No topics provided and unable to derive from SIF gaps.",
                }

        if not topics:
            return {
                "gaps": [],
                "message": "No topics to analyze. Complete onboarding and SIF indexing first.",
            }

        # Get competitor domains from onboarding
        competitor_domains = []
        db_session = get_session_for_user(user_id)
        if db_session:
            try:
                analyses = (
                    db_session.query(CompetitorAnalysis)
                    .join(
                        OnboardingSession,
                        CompetitorAnalysis.session_id == OnboardingSession.id,
                    )
                    .filter(OnboardingSession.user_id == user_id)
                    .filter(CompetitorAnalysis.competitor_domain.isnot(None))
                    .all()
                )
                competitor_domains = list(
                    set(a.competitor_domain for a in analyses if a.competitor_domain)
                )
            finally:
                db_session.close()

        if not competitor_domains:
            return {
                "gaps": [],
                "message": "No competitor domains found. Complete onboarding Step 3.",
            }

        # Run SERP gap analysis
        from services.seo_tools.serp_gap_service import SerpGapService

        service = SerpGapService()
        result = await service.analyze_topic_gaps(topics, competitor_domains)
        return result

    except Exception as e:
        logger.error(f"Failed to get SERP gaps: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get SERP gaps: {str(e)}"
        )


async def get_competitor_content(
    current_user: dict = Depends(get_current_user),
    topics: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Get competitor content deep-dive for gap topics using Exa.

    Scopes Exa neural search to known competitor domains (from onboarding Step 3)
    and returns full text, highlights, and summaries for competitive analysis.

    Args:
        topics: Optional list of topic phrases. If omitted, uses the user's
                latest SIF semantic gaps (up to 6 topics — Exa is paid).

    Returns:
        Dict with per-topic competitor content results.
    """
    try:
        user_id = str(current_user.get("id"))

        # If no topics provided, fetch from SIF semantic gaps
        if not topics:
            try:
                from services.intelligence.agents.specialized import StrategyArchitectAgent
                from services.intelligence.txtai_service import TxtaiIntelligenceService

                integration = OnboardingDataIntegrationService()
                db_session = get_session_for_user(user_id)
                if db_session:
                    try:
                        integrated = integration.get_integrated_data_sync(
                            user_id, db_session
                        )
                        competitor_indices = []
                        if integrated and integrated.get("competitor_analysis"):
                            competitor_indices = [
                                i
                                for i, _ in enumerate(
                                    integrated["competitor_analysis"]
                                )
                            ]
                        agent = StrategyArchitectAgent(
                            TxtaiIntelligenceService(user_id), user_id
                        )
                        gaps = await agent.find_semantic_gaps(competitor_indices)
                        # Fewer topics for Exa (paid API)
                        topics = [g["topic"] for g in gaps[:6]]
                    finally:
                        db_session.close()
            except Exception as e:
                logger.warning(
                    f"Could not derive topics from SIF gaps: {e}. "
                    "Pass topics explicitly."
                )
                return {
                    "results": [],
                    "message": "No topics provided and unable to derive from SIF gaps.",
                }

        if not topics:
            return {
                "results": [],
                "message": "No topics to analyze. Complete onboarding and SIF indexing first.",
            }

        # Get competitor domains from onboarding
        competitor_domains = []
        db_session = get_session_for_user(user_id)
        if db_session:
            try:
                analyses = (
                    db_session.query(CompetitorAnalysis)
                    .join(
                        OnboardingSession,
                        CompetitorAnalysis.session_id == OnboardingSession.id,
                    )
                    .filter(OnboardingSession.user_id == user_id)
                    .filter(CompetitorAnalysis.competitor_domain.isnot(None))
                    .all()
                )
                competitor_domains = list(
                    set(a.competitor_domain for a in analyses if a.competitor_domain)
                )
            finally:
                db_session.close()

        if not competitor_domains:
            return {
                "results": [],
                "message": "No competitor domains found. Complete onboarding Step 3.",
            }

        # Run Exa competitor deep-dive
        from services.seo_tools.competitor_content_service import (
            CompetitorContentService,
        )

        service = CompetitorContentService()
        result = await service.deep_dive(topics, competitor_domains)
        return result

    except Exception as e:
        logger.error(f"Failed to get competitor content: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get competitor content: {str(e)}"
        )


async def get_content_gap_radar(
    current_user: dict = Depends(get_current_user),
    bypass_cache: bool = False,
) -> Dict[str, Any]:
    """
    Run the Content Gap Radar pipeline — the full Phase 3 agent.

    Orchestrates SIF semantic gap analysis, SERP ranking presence detection,
    Exa competitor content deep-dive, and trend momentum scoring into a
    single ROI-ranked list of content opportunities.

    Returns scored gaps with per-topic evidence and a summary.
    """
    try:
        user_id = str(current_user.get("id"))

        # Fetch competitor domains + indices from onboarding data
        competitor_domains = []
        competitor_indices = []

        db_session = get_session_for_user(user_id)
        if db_session:
            try:
                # Competitor domains
                analyses = (
                    db_session.query(CompetitorAnalysis)
                    .join(
                        OnboardingSession,
                        CompetitorAnalysis.session_id == OnboardingSession.id,
                    )
                    .filter(OnboardingSession.user_id == user_id)
                    .filter(CompetitorAnalysis.competitor_domain.isnot(None))
                    .all()
                )
                competitor_domains = list(
                    set(
                        a.competitor_domain
                        for a in analyses
                        if a.competitor_domain
                    )
                )

                # Competitor indices from integrated data
                integration = OnboardingDataIntegrationService()
                integrated = integration.get_integrated_data_sync(
                    user_id, db_session
                )
                if integrated and integrated.get("competitor_analysis"):
                    competitor_indices = [
                        i
                        for i, _ in enumerate(
                            integrated["competitor_analysis"]
                        )
                    ]
            finally:
                db_session.close()

        if not competitor_domains:
            return {
                "gaps": [],
                "summary": {},
                "message": "No competitor domains found. Complete onboarding Step 3.",
            }

        # Run the agent
        from services.intelligence.agents import ContentGapRadarAgent
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        agent = ContentGapRadarAgent(
            TxtaiIntelligenceService(user_id), user_id
        )
        result = await agent.analyze(
            competitor_domains=competitor_domains,
            competitor_indices=competitor_indices,
            bypass_cache=bypass_cache,
        )
        return result

    except Exception as e:
        logger.error(f"Failed to run content gap radar: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to run content gap radar: {str(e)}",
        )


class GenerateContentRequest(BaseModel):
    topic: str
    recommended_action: str = ""
    scoring: Optional[Dict[str, float]] = None
    serp_evidence: Optional[Dict[str, Any]] = None
    sif_gap: Optional[Dict[str, Any]] = None


async def generate_content_from_gap(
    request: GenerateContentRequest,
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate a content brief from a content gap radar item and save it
    as a blog ContentAsset so the user can resume in the Blog Writer.
    """
    try:
        user_id = str(current_user.get("id"))
        from services.intelligence.agents import ContentGapRadarAgent
        from services.intelligence.txtai_service import TxtaiIntelligenceService

        agent = ContentGapRadarAgent(
            TxtaiIntelligenceService(user_id), user_id
        )
        brief_result = await agent.generate_content_brief(
            topic=request.topic,
            recommended_action=request.recommended_action,
            scoring=request.scoring,
            serp_evidence=request.serp_evidence,
            sif_gap=request.sif_gap,
        )

        # Create blog ContentAsset so user can resume in Blog Writer
        from services.content_asset_service import ContentAssetService
        from models.content_asset_models import AssetType, AssetSource
        from services.database import get_db_session

        session = get_db_session()
        asset_id = None
        if session:
            try:
                svc = ContentAssetService(session)
                asset = svc.create_asset(
                    user_id=user_id,
                    asset_type=AssetType.TEXT,
                    source_module=AssetSource.BLOG_WRITER,
                    filename=f"gap_{int(time.time())}.md",
                    file_url=f"/api/blog/content/pending",
                    title=request.topic,
                    description=f"Content brief from gap analysis: {request.topic}",
                    tags=["content-gap", "seo-dashboard"],
                    asset_metadata={
                        "phase": "research",
                        "research_keywords": request.topic,
                        "topic": request.topic,
                        "research_data": brief_result,
                        "outline_data": None,
                        "content_data": None,
                        "seo_data": None,
                        "publish_data": None,
                    },
                )
                asset_id = asset.id
                logger.info(
                    f"Created blog asset {asset_id} for gap topic '{request.topic}'"
                )
            except Exception as e:
                logger.warning(f"Failed to create blog asset: {e}")
            finally:
                session.close()

        return {
            "success": True,
            "brief": brief_result["brief"],
            "asset_id": asset_id,
        }

    except Exception as e:
        logger.error(f"Failed to generate content from gap: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate content brief: {str(e)}",
        )


async def get_onboarding_task_health(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Get consolidated onboarding scheduled SEO task health."""
    try:
        user_id = str(current_user.get("id"))
        db_session = get_session_for_user(user_id)
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")

        try:
            dashboard_service = SEODashboardService(db_session)
            return await dashboard_service.get_onboarding_scheduled_task_health(user_id, site_url)
        finally:
            db_session.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get onboarding task health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get onboarding scheduled task health")

# New comprehensive SEO analysis endpoints
async def analyze_seo_comprehensive(request: SEOAnalysisRequest) -> SEOAnalysisResponse:
    """
    Analyze a URL for comprehensive SEO performance (progressive mode)
    
    Args:
        request: SEOAnalysisRequest containing URL and optional target keywords
        
    Returns:
        SEOAnalysisResponse with detailed analysis results
    """
    try:
        logger.info(f"Starting progressive SEO analysis for URL: {request.url}")
        
        # Use progressive analysis for comprehensive results with timeout handling
        result = seo_analyzer.analyze_url_progressive(request.url, request.target_keywords)
        
        # Store result in database
        db_session = get_db_session()
        if db_session:
            try:
                seo_service = SEOAnalysisService(db_session)
                stored_analysis = seo_service.store_analysis_result(result)
                if stored_analysis:
                    logger.info(f"Stored progressive SEO analysis in database with ID: {stored_analysis.id}")
                else:
                    logger.warning("Failed to store SEO analysis in database")
            except Exception as db_error:
                logger.error(f"Database error during analysis storage: {str(db_error)}")
            finally:
                db_session.close()
        
        # Convert to response format
        response_data = {
            'url': result.url,
            'timestamp': result.timestamp,
            'overall_score': result.overall_score,
            'health_status': result.health_status,
            'critical_issues': result.critical_issues,
            'warnings': result.warnings,
            'recommendations': result.recommendations,
            'data': result.data,
            'success': True,
            'message': f"Progressive SEO analysis completed successfully for {result.url}"
        }
        
        logger.info(f"Progressive SEO analysis completed for {request.url}. Overall score: {result.overall_score}")
        return SEOAnalysisResponse(**response_data)
        
    except Exception as e:
        logger.error(f"Error analyzing SEO for {request.url}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing SEO: {str(e)}"
        )

async def analyze_seo_full(request: SEOAnalysisRequest) -> SEOAnalysisResponse:
    """
    Analyze a URL for comprehensive SEO performance (full analysis)
    
    Args:
        request: SEOAnalysisRequest containing URL and optional target keywords
        
    Returns:
        SEOAnalysisResponse with detailed analysis results
    """
    try:
        logger.info(f"Starting full SEO analysis for URL: {request.url}")
        
        # Use progressive analysis for comprehensive results
        result = seo_analyzer.analyze_url_progressive(request.url, request.target_keywords)
        
        # Store result in database
        db_session = get_db_session()
        if db_session:
            try:
                seo_service = SEOAnalysisService(db_session)
                stored_analysis = seo_service.store_analysis_result(result)
                if stored_analysis:
                    logger.info(f"Stored full SEO analysis in database with ID: {stored_analysis.id}")
                else:
                    logger.warning("Failed to store SEO analysis in database")
            except Exception as db_error:
                logger.error(f"Database error during analysis storage: {str(db_error)}")
            finally:
                db_session.close()
        
        # Convert to response format
        response_data = {
            'url': result.url,
            'timestamp': result.timestamp,
            'overall_score': result.overall_score,
            'health_status': result.health_status,
            'critical_issues': result.critical_issues,
            'warnings': result.warnings,
            'recommendations': result.recommendations,
            'data': result.data,
            'success': True,
            'message': f"Full SEO analysis completed successfully for {result.url}"
        }
        
        logger.info(f"Full SEO analysis completed for {request.url}. Overall score: {result.overall_score}")
        return SEOAnalysisResponse(**response_data)
        
    except Exception as e:
        logger.error(f"Error in full SEO analysis for {request.url}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error in full SEO analysis: {str(e)}"
        )

async def get_seo_metrics_detailed(url: str) -> SEOMetricsResponse:
    """
    Get detailed SEO metrics for dashboard display
    
    Args:
        url: The URL to analyze
        
    Returns:
        Detailed SEO metrics for React dashboard
    """
    try:
        # Ensure URL has protocol
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        logger.info(f"Getting detailed SEO metrics for URL: {url}")
        
        # Perform analysis
        result = seo_analyzer.analyze_url_progressive(url)
        
        # Extract metrics for dashboard
        metrics = {
            "overall_score": result.overall_score,
            "health_status": result.health_status,
            "url_structure_score": result.data.get('url_structure', {}).get('score', 0),
            "meta_data_score": result.data.get('meta_data', {}).get('score', 0),
            "content_score": result.data.get('content_analysis', {}).get('score', 0),
            "technical_score": result.data.get('technical_seo', {}).get('score', 0),
            "performance_score": result.data.get('performance', {}).get('score', 0),
            "accessibility_score": result.data.get('accessibility', {}).get('score', 0),
            "user_experience_score": result.data.get('user_experience', {}).get('score', 0),
            "security_score": result.data.get('security_headers', {}).get('score', 0)
        }
        
        # Add detailed data for each category
        dashboard_data = {
            "metrics": metrics,
            "critical_issues": result.critical_issues,
            "warnings": result.warnings,
            "recommendations": result.recommendations,
            "detailed_analysis": {
                "url_structure": result.data.get('url_structure', {}),
                "meta_data": result.data.get('meta_data', {}),
                "content_analysis": result.data.get('content_analysis', {}),
                "technical_seo": result.data.get('technical_seo', {}),
                "performance": result.data.get('performance', {}),
                "accessibility": result.data.get('accessibility', {}),
                "user_experience": result.data.get('user_experience', {}),
                "security_headers": result.data.get('security_headers', {}),
                "keyword_analysis": result.data.get('keyword_analysis', {})
            },
            "timestamp": result.timestamp.isoformat(),
            "url": result.url
        }
        
        logger.info(f"Detailed SEO metrics retrieved for {url}")
        return SEOMetricsResponse(**dashboard_data)
        
    except Exception as e:
        logger.error(f"Error getting SEO metrics for {url}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting SEO metrics: {str(e)}"
        )

async def get_analysis_summary(url: str) -> Dict[str, Any]:
    """
    Get a quick summary of SEO analysis for a URL
    
    Args:
        url: The URL to analyze
        
    Returns:
        Summary of SEO analysis
    """
    try:
        # Ensure URL has protocol
        if not url.startswith(('http://', 'https://')):
            url = f"https://{url}"
        
        logger.info(f"Getting analysis summary for URL: {url}")
        
        # Perform analysis
        result = seo_analyzer.analyze_url_progressive(url)
        
        # Create summary
        summary = {
            "url": result.url,
            "overall_score": result.overall_score,
            "health_status": result.health_status,
            "critical_issues_count": len(result.critical_issues),
            "warnings_count": len(result.warnings),
            "recommendations_count": len(result.recommendations),
            "top_issues": result.critical_issues[:3],
            "top_recommendations": result.recommendations[:3],
            "analysis_timestamp": result.timestamp.isoformat()
        }
        
        logger.info(f"Analysis summary retrieved for {url}")
        return summary
        
    except Exception as e:
        logger.error(f"Error getting analysis summary for {url}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting analysis summary: {str(e)}"
        )

async def batch_analyze_urls(urls: List[str]) -> Dict[str, Any]:
    """
    Analyze multiple URLs in batch
    
    Args:
        urls: List of URLs to analyze
        
    Returns:
        Batch analysis results
    """
    try:
        logger.info(f"Starting batch analysis for {len(urls)} URLs")
        
        results = []
        
        for url in urls:
            try:
                # Ensure URL has protocol
                if not url.startswith(('http://', 'https://')):
                    url = f"https://{url}"
                
                # Perform analysis
                result = seo_analyzer.analyze_url_progressive(url)
                
                # Add to results
                results.append({
                    "url": result.url,
                    "overall_score": result.overall_score,
                    "health_status": result.health_status,
                    "critical_issues_count": len(result.critical_issues),
                    "warnings_count": len(result.warnings),
                    "success": True
                })
                
            except Exception as e:
                # Add error result
                results.append({
                    "url": url,
                    "overall_score": 0,
                    "health_status": "error",
                    "critical_issues_count": 0,
                    "warnings_count": 0,
                    "success": False,
                    "error": str(e)
                })
        
        batch_result = {
            "total_urls": len(urls),
            "successful_analyses": len([r for r in results if r['success']]),
            "failed_analyses": len([r for r in results if not r['success']]),
            "results": results
        }
        
        logger.info(f"Batch analysis completed. Success: {batch_result['successful_analyses']}/{len(urls)}")
        return batch_result
        
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error in batch analysis: {str(e)}"
        )

async def analyze_urls_ai(request: AnalyzeURLsRequest, current_user: dict) -> Dict[str, Any]:
    """Run AI analysis on selected URLs."""
    user_id = str(current_user.get('id'))
    db_session = get_db_session()
    results = []
    
    try:
        for url in request.urls:
            # Check if audit exists
            audit = db_session.query(SEOPageAudit).filter(
                SEOPageAudit.user_id == user_id,
                SEOPageAudit.page_url == url
            ).first()
            
            if not audit:
                results.append({"url": url, "status": "skipped", "reason": "No audit found"})
                continue
                
            # Prepare Prompt
            # We use the existing audit data (algorithmic) to feed the AI
            audit_summary = {
                "score": audit.overall_score,
                "issues": audit.issues,
                "warnings": audit.warnings
            }
            
            prompt = f"""
            As an expert SEO consultant, analyze these technical audit results for the page: {url}
            
            AUDIT DATA:
            {json.dumps(audit_summary, default=str)[:3000]}
            
            TASK:
            Provide 3 specific, high-impact AI recommendations to improve this page's SEO.
            Focus on content relevance, user intent, and semantic SEO, which the algorithmic audit might miss.
            
            OUTPUT JSON format:
            [
                {{ "category": "Content|Technical|UX", "recommendation": "...", "impact": "High|Medium", "effort": "Low|Medium" }}
            ]
            """
            
            try:
                ai_response = llm_text_gen(prompt, user_id=user_id)
                # Parse JSON
                import re
                cleaned = ai_response.strip().replace("```json", "").replace("```", "")
                # Simple regex to find the JSON array if extra text exists
                match = re.search(r'\[.*\]', cleaned, re.DOTALL)
                if match:
                    cleaned = match.group(0)
                
                recommendations = json.loads(cleaned)
                
                # Update audit
                current_recs = audit.recommendations or []
                if isinstance(current_recs, list):
                    # Tag new ones
                    for r in recommendations:
                        r['source'] = 'ai_on_demand'
                    current_recs.extend(recommendations)
                    audit.recommendations = current_recs
                
                audit.last_analyzed_at = datetime.utcnow()
                results.append({"url": url, "status": "success"})
                
            except Exception as e:
                logger.error(f"AI Analysis failed for {url}: {e}")
                results.append({"url": url, "status": "failed", "error": str(e)})
        
        db_session.commit()
        return {"results": results}
        
    finally:
        db_session.close()

async def get_analyzed_pages(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Get list of pages that have been analyzed by AI."""
    user_id = str(current_user.get('id'))
    db_session = get_db_session()
    
    try:
        audits = db_session.query(SEOPageAudit).filter(
            SEOPageAudit.user_id == user_id
        ).all()
        
        results = []
        for audit in audits:
            if audit.recommendations:
                results.append({
                    "url": audit.page_url,
                    "analyzed_at": audit.last_analyzed_at,
                    "score": audit.overall_score,
                    "recommendations_count": len(audit.recommendations)
                })
        
        return {"results": results}
    finally:
        db_session.close()


# New SEO Dashboard Endpoints with Real Data

async def get_seo_dashboard_overview(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None
) -> Dict[str, Any]:
    """Get comprehensive SEO dashboard overview with real GSC/Bing data."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_session_for_user(user_id)
        
        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            # Use SEO dashboard service to get real data
            dashboard_service = SEODashboardService(db_session)
            overview_data = await dashboard_service.get_dashboard_overview(user_id, site_url)
            
            logger.info(f"Retrieved SEO dashboard overview for user {user_id}")
            return overview_data
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting SEO dashboard overview: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard overview")

async def get_gsc_raw_data(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None
) -> Dict[str, Any]:
    """Get raw GSC data for the specified site."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session()
        
        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            # Use SEO dashboard service to get GSC data
            dashboard_service = SEODashboardService(db_session)
            gsc_data = await dashboard_service.get_gsc_data(user_id, site_url)
            
            logger.info(f"Retrieved GSC raw data for user {user_id}")
            return gsc_data
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting GSC raw data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get GSC data")

async def get_bing_raw_data(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None
) -> Dict[str, Any]:
    """Get raw Bing data for the specified site."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            # Use SEO dashboard service to get Bing data
            dashboard_service = SEODashboardService(db_session)
            bing_data = await dashboard_service.get_bing_data(user_id, site_url)
            
            logger.info(f"Retrieved Bing raw data for user {user_id}")
            return bing_data
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting Bing raw data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get Bing data")

async def get_competitive_insights(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None
) -> Dict[str, Any]:
    """Get competitive insights from onboarding step 3 data."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        try:
            # Use SEO dashboard service to get competitive insights
            dashboard_service = SEODashboardService(db_session)
            insights_data = await dashboard_service.get_competitive_insights(user_id)
            
            logger.info(f"Retrieved competitive insights for user {user_id}")
            return insights_data
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error getting competitive insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to get competitive insights")


async def get_deep_competitor_analysis(
    current_user: dict = Depends(get_current_user),
    site_url: Optional[str] = None
) -> Dict[str, Any]:
    try:
        user_id = str(current_user.get('id'))
        db_session = get_session_for_user(user_id)

        if not db_session:
            logger.error("No database session available")
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            integration_service = OnboardingDataIntegrationService()
            integrated = integration_service.get_integrated_data_sync(user_id, db_session)
            deep = integrated.get("deep_competitor_analysis") if isinstance(integrated, dict) else None
            return deep or {
                "status": "not_available",
                "last_run": None,
                "report": None
            }
        finally:
            db_session.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting deep competitor analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to get deep competitor analysis")


async def run_strategic_insights(
    current_user: dict = Depends(get_current_user)
) -> Dict[str, Any]:
    """Run AI-powered strategic insights analysis manually."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_session_for_user(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection failed")

        try:
            integration_service = OnboardingDataIntegrationService()
            integrated = integration_service.get_integrated_data_sync(user_id, db_session)
            
            website_analysis_data = integrated.get("website_analysis")
            logger.info(f"Integrated data for user {user_id}: website_analysis found? {bool(website_analysis_data)}")
            
            # Fallback: If not found in integrated data (e.g. strict session mismatch), find latest analysis for user
            if not website_analysis_data:
                logger.info(f"Attempting fallback for user {user_id}")
                # Find latest WebsiteAnalysis for this user across all sessions
                latest_analysis = db_session.query(WebsiteAnalysis).join(
                    OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id
                ).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(WebsiteAnalysis.updated_at.desc()).first()
                
                if latest_analysis:
                    logger.info(f"Found fallback WebsiteAnalysis {latest_analysis.id} for user {user_id}")
                    website_analysis_data = latest_analysis.to_dict()
                    # Ensure ID is present for updates
                    website_analysis_data['id'] = latest_analysis.id
                else:
                    logger.warning(f"Fallback failed for user {user_id}. No WebsiteAnalysis found.")

            if not website_analysis_data:
                raise HTTPException(status_code=400, detail="Website analysis (Step 2) not found. Please complete onboarding.")
            
            research_prefs = integrated.get("research_preferences")
            competitors = (research_prefs.get("competitors") if isinstance(research_prefs, dict) else None)
            
            if not competitors:
                # Try competitor_analysis as fallback
                competitors = integrated.get("competitor_analysis") or []

            if not competitors:
                raise HTTPException(status_code=400, detail="No competitors found. Please add competitors in Step 3.")

            from services.seo.deep_competitor_analysis_service import DeepCompetitorAnalysisService
            analysis_service = DeepCompetitorAnalysisService()
            
            logger.info(f"Running manual strategic insights for user {user_id}")
            report = await analysis_service.generate_weekly_strategy_brief(
                user_id=user_id,
                website_analysis=website_analysis_data if isinstance(website_analysis_data, dict) else {},
                competitors=competitors if isinstance(competitors, list) else []
            )
            
            # Find the WebsiteAnalysis record to persist history
            analysis_id = website_analysis_data.get('id') if isinstance(website_analysis_data, dict) else None
            if analysis_id:
                website_analysis = db_session.query(WebsiteAnalysis).filter(WebsiteAnalysis.id == analysis_id).first()
                
                if website_analysis:
                    history = website_analysis.strategic_insights_history or []
                    if not isinstance(history, list):
                        history = []
                    
                    # Append new report at the beginning (latest first)
                    history.insert(0, report)
                    # Keep last 52 weeks (1 year)
                    website_analysis.strategic_insights_history = history[:52]
                    flag_modified(website_analysis, "strategic_insights_history")
                    db_session.commit()
                    logger.info(f"Persisted strategic insight for user {user_id} to history")
            
            return {"success": True, "report": report}
        finally:
            db_session.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running strategic insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to run strategic insights: {str(e)}")


@router.post("/refresh-data")
async def refresh_analytics_data(current_user: dict = Depends(get_current_user), site_url: str = None):
    """Force refresh of analytics data from GSC/Bing."""
    # This would trigger background jobs to fetch fresh data
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
        
        try:
            dashboard_service = SEODashboardService(db_session)
            return await dashboard_service.refresh_analytics_data(user_id, site_url)
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error refreshing analytics data: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/strategic-insights-history")
async def get_strategic_insights_history(
    current_user: dict = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get history of strategic insights reports."""
    try:
        user_id = str(current_user.get('id'))
        db_session = get_db_session(user_id)
        
        if not db_session:
            raise HTTPException(status_code=500, detail="Database connection unavailable")
            
        try:
            # Get latest website analysis
            latest_analysis = db_session.query(WebsiteAnalysis).join(
                OnboardingSession, WebsiteAnalysis.session_id == OnboardingSession.id
            ).filter(
                OnboardingSession.user_id == user_id
            ).order_by(WebsiteAnalysis.updated_at.desc()).first()
            
            if not latest_analysis:
                return []
                
            return latest_analysis.strategic_insights_history or []
            
        finally:
            db_session.close()
            
    except Exception as e:
        logger.error(f"Error fetching strategic insights history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper methods for data conversion
def _convert_metrics(summary_data: Dict[str, Any]) -> Dict[str, SEOMetric]:
    """Convert summary data to SEOMetric format."""
    try:
        return {
            "traffic": SEOMetric(
                value=summary_data.get("clicks", 0),
                change=0,  # Would calculate from historical data
                trend="up",
                description="Organic traffic",
                color="#4CAF50"
            ),
            "rankings": SEOMetric(
                value=summary_data.get("position", 0),
                change=0,  # Would calculate from historical data
                trend="up",
                description="Average ranking",
                color="#2196F3"
            ),
            "mobile": SEOMetric(
                value=0,  # Would get from performance data
                change=0,
                trend="stable",
                description="Mobile speed",
                color="#FF9800"
            ),
            "keywords": SEOMetric(
                value=0,  # Would count from query data
                change=0,
                trend="up",
                description="Keywords tracked",
                color="#9C27B0"
            )
        }
    except Exception as e:
        logger.error(f"Error converting metrics: {e}")
        return {}

def _convert_platforms(platform_data: Dict[str, Any]) -> Dict[str, PlatformStatus]:
    """Convert platform data to PlatformStatus format."""
    try:
        return {
            "google_search_console": PlatformStatus(
                status="connected" if platform_data.get("gsc", {}).get("connected", False) else "disconnected",
                connected=platform_data.get("gsc", {}).get("connected", False),
                last_sync=platform_data.get("gsc", {}).get("last_sync"),
                data_points=len(platform_data.get("gsc", {}).get("sites", []))
            ),
                "bing_webmaster": PlatformStatus(
                    status="connected" if platform_data.get("bing", {}).get("connected", False) else "disconnected",
                    connected=platform_data.get("bing", {}).get("connected", False),
                    last_sync=platform_data.get("bing", {}).get("last_sync"),
                    data_points=len(platform_data.get("bing", {}).get("sites", []))
                )
            }
    except Exception as e:
        logger.error(f"Error converting platforms: {e}")
        return {}


# Phase 4.3 + 4.4: helpers used by ``get_sif_indexing_health`` to
# surface live index and cache state. Each helper is best-effort:
# returns ``None`` if the underlying service cannot be loaded in
# this environment (e.g. txtai not installed), so the endpoint
# stays usable even when the SIF stack is degraded.


def _collect_sif_index_stats(user_id: str) -> Optional[Dict[str, Any]]:
    """Return live index stats for the given user.

    The txtai service is lazily created per user. For dashboard
    purposes we do NOT want to call the heavy ``_ensure_initialized``
    path (which loads the model and could take seconds); instead we
    read the persisted index file size + count if available, and
    check the ``.corrupt`` marker file.
    """
    try:
        from services.intelligence.txtai_service import TxtaiIntelligenceService
    except ImportError:
        return None

    try:
        from services.intelligence.sif_metrics import set_user_gauge

        svc = TxtaiIntelligenceService(user_id=user_id)
        # doc_count via embeddings.count() — this is a blocking call.
        # We do not want to make the dashboard endpoint slow, so we
        # only attempt this if the service is already initialized.
        doc_count = 0
        if svc._initialized and svc.embeddings and hasattr(svc.embeddings, "count"):
            try:
                doc_count = int(svc.embeddings.count())
            except Exception:
                doc_count = 0

        # Phase 3.1: corrupt marker check.
        from pathlib import Path
        index_path = getattr(svc, "index_path", None)
        corrupt_marker_present = False
        if index_path:
            try:
                corrupt_marker_present = Path(f"{index_path}.corrupt").exists()
            except OSError:
                corrupt_marker_present = False

        # ANN-disabled flag was set in-process by _mark_ann_incompatible.
        # This is per-service-instance, so for the dashboard we
        # default to False (the actual flag lives on the singleton
        # for this user). The ``hasattr`` check is defensive in case
        # the attribute is removed in a future refactor.
        ann_disabled = bool(getattr(svc, "_disable_ann_queries", False))

        stats = {
            "doc_count": doc_count,
            "ann_disabled": ann_disabled,
            "corrupt_marker_present": corrupt_marker_present,
            "index_path": index_path,
            "initialized": bool(svc._initialized),
        }
        # Phase 4.4: per-user gauge for the team-activity page.
        set_user_gauge(user_id, "sif_index_count", float(doc_count))
        set_user_gauge(user_id, "sif_corrupt_marker", float(corrupt_marker_present))
        set_user_gauge(user_id, "sif_ann_disabled", float(ann_disabled))
        return stats
    except Exception as e:
        logger.debug(f"Phase 4.3: _collect_sif_index_stats failed for user {user_id}: {e}")
        return None


def _collect_sif_cache_stats() -> Optional[Dict[str, Any]]:
    """Return semantic cache stats (memory entries, hit/miss counters)."""
    try:
        from services.intelligence.semantic_cache import semantic_cache_manager
    except ImportError:
        return None
    try:
        mgr = semantic_cache_manager
        # ``get_stats()`` returns a dataclass asdict; safe to expose
        stats = mgr.get_stats()
        return {
            "cache_size": int(stats.get("cache_size", 0) or 0),
            "memory_usage_mb": float(stats.get("memory_usage_mb", 0.0) or 0.0),
            "total_hits": int(stats.get("total_hits", 0) or 0),
            "total_misses": int(stats.get("total_misses", 0) or 0),
            "total_invalidations": int(stats.get("total_invalidations", 0) or 0),
            "max_memory_size_mb": float(stats.get("max_memory_size_mb", 0.0) or 0.0),
        }
    except Exception as e:
        logger.debug(f"Phase 4.4: _collect_sif_cache_stats failed: {e}")
        return None


def _collect_sif_metrics_snapshot(user_id: str) -> Optional[Dict[str, Any]]:
    """Return the sif_metrics snapshot for the dashboard."""
    try:
        from services.intelligence.sif_metrics import get_metrics_for_user
        return get_metrics_for_user(user_id)
    except Exception as e:
        logger.debug(f"Phase 4.5: _collect_sif_metrics_snapshot failed: {e}")
        return None

