"""
SEO Dashboard Service

Main orchestration service that coordinates data fetching from GSC, Bing,
and other analytics sources for the SEO dashboard. Leverages existing
OAuth connections from onboarding step 5.
"""

from typing import Dict, Any, Optional, List, Type
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from loguru import logger

from utils.logger_utils import get_service_logger
from services.gsc_service import GSCService
from services.integrations.bing_oauth import BingOAuthService
from services.bing_analytics_storage_service import BingAnalyticsStorageService
from services.analytics_cache_service import AnalyticsCacheService
from services.analytics.connection_manager import PlatformConnectionManager
from api.content_planning.services.content_strategy.onboarding.data_integration import OnboardingDataIntegrationService
from .analytics_aggregator import AnalyticsAggregator
from .competitive_analyzer import CompetitiveAnalyzer
from models.onboarding import SEOPageAudit, WebsiteAnalysis, OnboardingSession
from models.website_analysis_monitoring_models import (
    OnboardingFullWebsiteAnalysisTask,
    OnboardingFullWebsiteAnalysisExecutionLog,
    DeepCompetitorAnalysisTask,
    DeepCompetitorAnalysisExecutionLog,
    SIFIndexingTask,
    SIFIndexingExecutionLog,
    MarketTrendsTask,
    MarketTrendsExecutionLog,
)
from models.advertools_monitoring_models import AdvertoolsTask

logger = get_service_logger("seo_dashboard")

# Typed hint mapping each onboarding task model to the SEO Dashboard UI section
# that should open when the user clicks "View results" for that task.
RESULTS_KEY_BY_TASK_MODEL: Dict[Any, str] = {
    OnboardingFullWebsiteAnalysisTask: "website_analysis",
    DeepCompetitorAnalysisTask: "competitor_analysis",
    SIFIndexingTask: "sif_indexing",
    MarketTrendsTask: "market_trends",
}

TASK_TYPE_BY_MODEL: Dict[Any, str] = {
    OnboardingFullWebsiteAnalysisTask: "onboarding_full_website_analysis",
    DeepCompetitorAnalysisTask: "deep_competitor_analysis",
    SIFIndexingTask: "sif_indexing",
    MarketTrendsTask: "market_trends",
}

class SEODashboardService:
    """Main service for SEO dashboard data orchestration."""
    
    def __init__(self, db: Session):
        """Initialize the SEO dashboard service."""
        self.db = db
        self.gsc_service = GSCService()
        self.bing_oauth = BingOAuthService()
        # Bing storage is initialized per-user dynamically
        self.analytics_cache = AnalyticsCacheService()
        self.integration_service = OnboardingDataIntegrationService()
        self.analytics_aggregator = AnalyticsAggregator()
        self.competitive_analyzer = CompetitiveAnalyzer(db)
        self.connection_manager = PlatformConnectionManager()
        
    def _get_bing_storage(self, user_id: str) -> BingAnalyticsStorageService:
        """Get Bing storage service for user."""
        from services.database import get_user_db_path
        db_path = get_user_db_path(user_id)
        db_url = f"sqlite:///{db_path}"
        return BingAnalyticsStorageService(db_url)
        
    async def get_platform_status(self, user_id: str) -> Dict[str, Any]:
        """Get connection status for GSC and Bing platforms.

        Uses PlatformConnectionManager to perform real OAuth verification
        (token refresh + Google API sites().list() call for GSC, token check for Bing)
        instead of merely checking credential file existence.
        """
        try:
            conn_status = await self.connection_manager.get_platform_connection_status(user_id)
            gsc_status = conn_status.get('gsc', {})
            bing_conn = conn_status.get('bing', {})
            gsc_connected = gsc_status.get('connected', False)
            bing_connected = bing_conn.get('connected', False)
            
            gsc_data = self.analytics_cache.get('gsc_analytics', user_id)
            bing_data = self.analytics_cache.get('bing_analytics', user_id)
            
            return {
                "gsc": {
                    "connected": gsc_connected,
                    "sites": gsc_status.get('sites', []) if gsc_connected else [],
                    "last_sync": gsc_data.get('last_updated') if gsc_data else None,
                    "status": "connected" if gsc_connected else "disconnected"
                },
                "bing": {
                    "connected": bing_connected,
                    "sites": bing_conn.get('sites', []) if bing_connected else [],
                    "last_sync": bing_data.get('last_updated') if bing_data else None,
                    "status": "connected" if bing_connected else "disconnected",
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting platform status for user {user_id}: {e}")
            return {
                "gsc": {"connected": False, "sites": [], "last_sync": None, "status": "error"},
                "bing": {"connected": False, "sites": [], "last_sync": None, "status": "error"}
            }
    
    async def get_dashboard_overview(self, user_id: str, site_url: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive dashboard overview with real GSC/Bing data."""
        try:
            # Get user's website URL if not provided
            if not site_url:
                # Use SSOT for onboarding data
                onboarding_data = await self.integration_service.process_onboarding_data(user_id, self.db)
                website_analysis = onboarding_data.get('website_analysis', {})
                
                if website_analysis and website_analysis.get('website_url'):
                    site_url = website_analysis['website_url']
                else:
                    # Fallback: try to get from Bing sites
                    bing_sites = self._get_bing_sites(user_id)
                    if bing_sites:
                        site_url = bing_sites[0]  # Use first Bing site
                    else:
                        site_url = 'https://alwrity.com'  # Default fallback
            
            # Get platform status
            platform_status = await self.get_platform_status(user_id)
            
            # Get analytics data
            gsc_data = await self.get_gsc_data(user_id, site_url)
            bing_data = await self.get_bing_data(user_id, site_url)
            
            # Aggregate metrics
            summary = self.analytics_aggregator.combine_metrics(gsc_data, bing_data)
            timeseries = self.analytics_aggregator.normalize_timeseries(
                gsc_data.get("timeseries", []), 
                bing_data.get("timeseries", [])
            )
            
            # Get competitive insights
            competitor_insights = await self.competitive_analyzer.get_competitive_insights(user_id)
            
            # Calculate health score
            health_score = self._calculate_health_score(summary, platform_status)
            
            # Generate AI insights
            ai_insights = await self._generate_ai_insights(summary, timeseries, competitor_insights)

            technical_seo_audit = self._get_technical_seo_audit_overview(user_id, site_url)
            
            advertools_insights = self._get_advertools_insights(user_id, site_url)
            
            return {
                "website_url": site_url,
                "platforms": platform_status,
                "summary": summary,
                "timeseries": timeseries,
                "competitor_insights": competitor_insights,
                "health_score": health_score,
                "ai_insights": ai_insights,
                "technical_seo_audit": technical_seo_audit,
                "advertools_insights": advertools_insights,
                "last_updated": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting dashboard overview for user {user_id}: {e}")
            raise

    def _get_technical_seo_audit_overview(self, user_id: str, site_url: str) -> Dict[str, Any]:
        site_key = (site_url or "").rstrip("/")

        try:
            q = self.db.query(SEOPageAudit).filter(SEOPageAudit.user_id == str(user_id))

            if site_key:
                q = q.filter(SEOPageAudit.website_url.like(f"{site_key}%"))

            audits = q.order_by(func.coalesce(SEOPageAudit.overall_score, 1000).asc()).all()

            pages_audited = len(audits)
            scores = [a.overall_score for a in audits if isinstance(a.overall_score, int)]
            avg_score = round(sum(scores) / len(scores)) if scores else 0
            fix_scheduled_pages = len([a for a in audits if a.status == 'fix_scheduled'])

            worst_pages = [
                {
                    "page_url": a.page_url,
                    "overall_score": a.overall_score,
                    "status": a.status,
                    "issues_count": len(a.issues or []) if isinstance(a.issues, list) else 0
                }
                for a in audits[:10]
            ]

            task = self.db.query(OnboardingFullWebsiteAnalysisTask).filter(
                OnboardingFullWebsiteAnalysisTask.user_id == str(user_id),
                OnboardingFullWebsiteAnalysisTask.website_url.like(f"{site_key}%")
            ).order_by(OnboardingFullWebsiteAnalysisTask.updated_at.desc()).first()

            task_status = None
            next_execution = None
            failure_pattern = None
            if task:
                task_status = task.status
                next_execution = task.next_execution.isoformat() if task.next_execution else None
                failure_pattern = task.failure_pattern

            return {
                "status": "ready" if pages_audited > 0 else ("scheduled" if task_status == "active" else "pending"),
                "task_status": task_status,
                "next_execution": next_execution,
                "failure_pattern": failure_pattern,
                "pages_audited": pages_audited,
                "avg_score": avg_score,
                "fix_scheduled_pages": fix_scheduled_pages,
                "worst_pages": worst_pages
            }
        except Exception as e:
            logger.warning(f"Failed to build technical SEO audit overview for user {user_id}: {e}")
            return {
                "status": "error",
                "error": str(e),
                "pages_audited": 0,
                "avg_score": 0,
                "fix_scheduled_pages": 0,
                "worst_pages": []
            }

    async def get_onboarding_scheduled_task_health(
        self,
        user_id: str,
        site_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return consolidated health for all onboarding scheduled SEO jobs."""
        site_key = (site_url or "").rstrip("/")

        task_matrix = {
            "OnboardingFullWebsiteAnalysisTask": {
                "label": "Onboarding Full Website Analysis",
                "task_model": OnboardingFullWebsiteAnalysisTask,
                "log_model": OnboardingFullWebsiteAnalysisExecutionLog,
            },
            "DeepCompetitorAnalysisTask": {
                "label": "Deep Competitor Analysis",
                "task_model": DeepCompetitorAnalysisTask,
                "log_model": DeepCompetitorAnalysisExecutionLog,
            },
            "SIFIndexingTask": {
                "label": "SIF Indexing",
                "task_model": SIFIndexingTask,
                "log_model": SIFIndexingExecutionLog,
            },
            "MarketTrendsTask": {
                "label": "Market Trends",
                "task_model": MarketTrendsTask,
                "log_model": MarketTrendsExecutionLog,
            },
        }

        task_health: Dict[str, Any] = {}
        for task_name, config in task_matrix.items():
            task_health[task_name] = self._get_single_task_health(
                user_id=user_id,
                task_model=config["task_model"],
                log_model=config["log_model"],
                label=config["label"],
                site_key=site_key,
            )

        return {
            "status": "ok",
            "website_url": site_key or None,
            "tasks": task_health,
            "last_updated": datetime.utcnow().isoformat(),
        }

    def _get_single_task_health(
        self,
        user_id: str,
        task_model: Type[Any],
        log_model: Type[Any],
        label: str,
        site_key: str,
    ) -> Dict[str, Any]:
        results_key = RESULTS_KEY_BY_TASK_MODEL.get(task_model)
        task_type_str = TASK_TYPE_BY_MODEL.get(task_model)

        query = self.db.query(task_model).filter(task_model.user_id == str(user_id))
        if site_key:
            query = query.filter(task_model.website_url.like(f"{site_key}%"))

        task = query.order_by(task_model.updated_at.desc()).first()
        if not task:
            return {
                "label": label,
                "results_key": results_key,
                "task_id": None,
                "task_type": task_type_str,
                "status": "not_scheduled",
                "next_execution": None,
                "last_success": None,
                "last_failure": None,
                "consecutive_failures": 0,
                "result_summary": None,
                "latest_execution": None,
            }

        latest_log = (
            self.db.query(log_model)
            .filter(log_model.task_id == task.id)
            .order_by(log_model.execution_date.desc())
            .first()
        )

        result_summary = None
        log_summary = None
        if latest_log:
            result_summary = self._summarize_execution_result(latest_log.result_data)
            log_summary = {
                "status": latest_log.status,
                "execution_date": latest_log.execution_date.isoformat() if latest_log.execution_date else None,
                "execution_time_ms": latest_log.execution_time_ms,
                "error_message": (latest_log.error_message or "")[:500] if latest_log.error_message else None,
                "result_summary": result_summary,
            }

        return {
            "label": label,
            "results_key": results_key,
            "task_id": task.id,
            "task_type": task_type_str,
            "status": task.status or "not_scheduled",
            "next_execution": task.next_execution.isoformat() if task.next_execution else None,
            "last_success": task.last_success.isoformat() if task.last_success else None,
            "last_failure": task.last_failure.isoformat() if task.last_failure else None,
            "consecutive_failures": task.consecutive_failures or 0,
            "result_summary": result_summary,
            "latest_execution": log_summary,
        }

    def _summarize_execution_result(self, result_data: Any) -> Optional[str]:
        if not isinstance(result_data, dict):
            return None

        # Prefer an explicit summary/message key when the executor wrote one
        for key in ("summary", "message", "status_message", "note"):
            value = result_data.get(key)
            if isinstance(value, str) and value.strip():
                return value[:300]

        # Skipped runs carry a reason
        reason = result_data.get("reason")
        if isinstance(reason, str) and reason.strip():
            return f"Skipped: {reason}"

        parts: List[str] = []

        # Website analysis (OnboardingFullWebsiteAnalysisTask)
        crawl_result = result_data.get("crawl_result")
        if isinstance(crawl_result, dict):
            pages = crawl_result.get("pages")
            url_count = len(pages) if isinstance(pages, list) else None
            parts.append(f"{url_count} pages crawled" if url_count is not None else "website crawled")
        if result_data.get("style_analysis"):
            parts.append("style analysis complete")
        if result_data.get("style_guidelines"):
            parts.append("style guidelines generated")
        if result_data.get("seo_audit"):
            parts.append("SEO audit complete")

        # Deep competitor analysis
        competitors = result_data.get("competitors")
        if isinstance(competitors, list) and competitors:
            meta = result_data.get("metadata")
            analyzed = None
            if isinstance(meta, dict):
                analyzed = meta.get("competitors_analyzed") or meta.get("competitors_requested")
            parts.append(f"{analyzed or len(competitors)} competitors analyzed")

        # SIF indexing
        if "metadata_synced" in result_data or "content_synced" in result_data:
            parts.append(f"metadata items synced: {result_data.get('metadata_synced') or 0}")
            parts.append(f"content pages indexed: {'yes' if result_data.get('content_synced') else 'no'}")
            guardian = result_data.get("guardian_report")
            if isinstance(guardian, dict):
                pillars = guardian.get("pillars_found") or guardian.get("pillar_count")
                if pillars is None and isinstance(guardian.get("pillars"), list):
                    pillars = len(guardian["pillars"])
                pages_analyzed = guardian.get("pages_analyzed") or guardian.get("total_pages")
                if pillars:
                    parts.append(f"pillars found: {pillars}")
                if pages_analyzed:
                    parts.append(f"pages analyzed: {pages_analyzed}")

        # Market trends
        if "run_id" in result_data or "keywords" in result_data:
            keywords = result_data.get("keywords")
            if isinstance(keywords, list):
                parts.append(f"trends run for {len(keywords)} keyword(s)")
            elif isinstance(keywords, (int, str)) and keywords not in (None, ""):
                parts.append(f"trends run for {keywords} keyword(s)")
            geo = result_data.get("geo")
            timeframe = result_data.get("timeframe")
            meta_bits = [bit for bit in (geo, timeframe) if bit]
            if meta_bits:
                parts.append(" / ".join(meta_bits))

        if parts:
            return "; ".join(parts)

        if result_data:
            return f"Result keys: {', '.join(sorted(result_data.keys())[:6])}"
        return None
    
    async def get_gsc_data(self, user_id: str, site_url: Optional[str] = None) -> Dict[str, Any]:
        """Get GSC data for the specified site."""
        try:
            # Check if user has GSC credentials
            credentials = self.gsc_service.load_user_credentials(user_id)
            if not credentials:
                return {"error": "GSC not connected", "data": [], "status": "disconnected"}
            
            # Try to get from cache first
            cache_key = f"gsc_analytics:{user_id}:{site_url or 'default'}"
            cached_data = self.analytics_cache.get('gsc_analytics', user_id, site_url=site_url or 'default')
            if cached_data:
                return cached_data
            
            # Fetch fresh data from GSC API
            if site_url:
                gsc_data = self.gsc_service.get_search_analytics(user_id, site_url)
            else:
                # Get all sites for user
                sites = self._get_gsc_sites(user_id)
                if sites:
                    gsc_data = self.gsc_service.get_search_analytics(user_id, sites[0])
                else:
                    return {"error": "No GSC sites found", "data": [], "status": "disconnected"}
            
            # Cache the data
            self.analytics_cache.set('gsc_analytics', user_id, gsc_data, ttl_override=3600, site_url=site_url or 'default')  # 1 hour cache
            
            return gsc_data
            
        except Exception as e:
            logger.error(f"Error getting GSC data for user {user_id}: {e}")
            return {"error": str(e), "data": [], "status": "error"}
    
    async def get_bing_data(self, user_id: str, site_url: Optional[str] = None) -> Dict[str, Any]:
        """Get Bing Webmaster Tools data for the specified site."""
        try:
            # Check if user has Bing tokens
            tokens = self.bing_oauth.get_user_tokens(user_id)
            if not tokens:
                return {"error": "Bing not connected", "data": [], "status": "disconnected"}
            
            # Try to get from cache first
            cache_key = f"bing_analytics:{user_id}:{site_url or 'default'}"
            cached_data = self.analytics_cache.get('bing_analytics', user_id, site_url=site_url or 'default')
            if cached_data:
                return cached_data
            
            # Get data from Bing storage service
            if site_url:
                bing_storage = self._get_bing_storage(user_id)
                bing_data = bing_storage.get_analytics_summary(user_id, site_url, days=30)
            else:
                # Get all sites for user
                sites = self._get_bing_sites(user_id)
                if sites:
                    logger.info(f"Using first Bing site for analysis: {sites[0]}")
                    bing_storage = self._get_bing_storage(user_id)
                    bing_data = bing_storage.get_analytics_summary(user_id, sites[0], days=30)
                else:
                    logger.warning(f"No Bing sites found for user {user_id}")
                    return {"error": "No Bing sites found", "data": [], "status": "disconnected"}
            
            # Cache the data
            self.analytics_cache.set('bing_analytics', user_id, bing_data, ttl_override=3600, site_url=site_url or 'default')  # 1 hour cache
            
            return bing_data
            
        except Exception as e:
            logger.error(f"Error getting Bing data for user {user_id}: {e}")
            return {"error": str(e), "data": [], "status": "error"}
    
    async def get_competitive_insights(self, user_id: str) -> Dict[str, Any]:
        """Get competitive insights from onboarding step 3 data."""
        try:
            return await self.competitive_analyzer.get_competitive_insights(user_id)
        except Exception as e:
            logger.error(f"Error getting competitive insights for user {user_id}: {e}")
            return {
                "competitor_keywords": [],
                "content_gaps": [],
                "opportunity_score": 0
            }
    
    async def refresh_analytics_data(self, user_id: str, site_url: Optional[str] = None) -> Dict[str, Any]:
        """Refresh analytics data by invalidating cache and fetching fresh data."""
        try:
            # Invalidate cache
            cache_keys = [
                f"gsc_analytics:{user_id}",
                f"bing_analytics:{user_id}",
                f"gsc_analytics:{user_id}:{site_url or 'default'}",
                f"bing_analytics:{user_id}:{site_url or 'default'}"
            ]
            
            for key in cache_keys:
                self.analytics_cache.delete(key)
            
            # Fetch fresh data
            gsc_result = await self.get_gsc_data(user_id, site_url)
            bing_result = await self.get_bing_data(user_id, site_url)
            
            return {
                "status": "success",
                "message": "Analytics data refreshed successfully",
                "last_updated": datetime.now().isoformat(),
                "platforms": {
                    "gsc": {"status": "success" if "error" not in gsc_result else "error"},
                    "bing": {"status": "success" if "error" not in bing_result else "error"}
                }
            }
            
        except Exception as e:
            logger.error(f"Error refreshing analytics data for user {user_id}: {e}")
            return {
                "status": "error",
                "message": f"Failed to refresh analytics data: {str(e)}",
                "last_updated": datetime.now().isoformat()
            }
    
    def _get_advertools_insights(self, user_id: str, site_url: str) -> Dict[str, Any]:
        """Fetch Advertools-based insights from WebsiteAnalysis and AdvertoolsTasks."""
        try:
            session = self.db.query(OnboardingSession).filter(OnboardingSession.user_id == user_id).first()
            if not session:
                return {}

            analysis = self.db.query(WebsiteAnalysis).filter(WebsiteAnalysis.session_id == session.id).first()
            
            tasks = self.db.query(AdvertoolsTask).filter(AdvertoolsTask.user_id == user_id).all()
            
            audit_status = "pending"
            health_status = "pending"
            
            for task in tasks:
                t_type = task.payload.get('type') if task.payload else None
                if t_type == 'content_audit':
                    audit_status = task.status
                elif t_type == 'site_health':
                    health_status = task.status

            brand_analysis = analysis.brand_analysis or {} if analysis else {}
            seo_audit = analysis.seo_audit or {} if analysis else {}

            return {
                "augmented_themes": brand_analysis.get('augmented_themes', []),
                "link_health": brand_analysis.get('link_health', {}),
                "redirect_audit": brand_analysis.get('redirect_audit', {}),
                "image_seo": brand_analysis.get('image_seo', {}),
                "page_status": brand_analysis.get('page_status', {}),
                "url_structure": brand_analysis.get('url_structure', {}),
                "freshness": brand_analysis.get('freshness', {}),
                "robots_txt": brand_analysis.get('robots_txt', {}),
                "crawl_budget": brand_analysis.get('crawl_budget', {}),
                "last_audit": brand_analysis.get('last_advertools_audit'),
                "site_health": seo_audit.get('site_health', {}),
                "last_health_check": seo_audit.get('last_advertools_health_check'),
                "tasks": {
                    "content_audit": audit_status,
                    "site_health": health_status
                }
            }
        except Exception as e:
            logger.warning(f"Failed to fetch Advertools insights for user {user_id}: {e}")
            return {}

    def _get_gsc_sites(self, user_id: str) -> List[str]:
        """Get GSC sites for user."""
        try:
            return self.gsc_service.get_site_list(user_id)
        except Exception as e:
            logger.warning(f"Error getting GSC sites for user {user_id}: {e}")
            return []
    
    def _get_bing_sites(self, user_id: str) -> List[str]:
        """Get Bing sites for user."""
        try:
            # Use the existing get_user_sites method from BingOAuthService
            sites = self.bing_oauth.get_user_sites(user_id)
            if not sites:
                logger.warning(f"No Bing sites found for user {user_id}")
                return []
            
            # Extract site URLs from the sites data
            site_urls = []
            for site in sites:
                if isinstance(site, dict) and site.get('url'):
                    site_urls.append(site['url'])
                elif isinstance(site, str):
                    site_urls.append(site)
            
            logger.info(f"Found {len(site_urls)} Bing sites for user {user_id}: {site_urls}")
            return site_urls
            
        except Exception as e:
            logger.error(f"Error getting Bing sites for user {user_id}: {e}")
            return []
    
    def _calculate_health_score(self, summary: Dict[str, Any], platform_status: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall SEO health score."""
        try:
            score = 0
            max_score = 100
            
            # Base score for connected platforms
            if platform_status.get("gsc", {}).get("connected"):
                score += 30
            if platform_status.get("bing", {}).get("connected"):
                score += 20
            
            # Traffic score (0-30)
            clicks = summary.get("clicks", 0)
            if clicks > 1000:
                score += 30
            elif clicks > 500:
                score += 20
            elif clicks > 100:
                score += 10
            
            # CTR score (0-20)
            ctr = summary.get("ctr", 0)
            if ctr > 0.05:  # 5%
                score += 20
            elif ctr > 0.03:  # 3%
                score += 15
            elif ctr > 0.01:  # 1%
                score += 10
            
            # Determine trend and color
            if score >= 80:
                trend = "up"
                label = "EXCELLENT"
                color = "#4CAF50"
            elif score >= 60:
                trend = "stable"
                label = "GOOD"
                color = "#2196F3"
            elif score >= 40:
                trend = "down"
                label = "NEEDS IMPROVEMENT"
                color = "#FF9800"
            else:
                trend = "down"
                label = "POOR"
                color = "#F44336"
            
            return {
                "score": score,
                "change": 0,  # Would need historical data to calculate
                "trend": trend,
                "label": label,
                "color": color
            }
            
        except Exception as e:
            logger.error(f"Error calculating health score: {e}")
            return {
                "score": 0,
                "change": 0,
                "trend": "unknown",
                "label": "UNKNOWN",
                "color": "#9E9E9E"
            }
    
    async def _generate_ai_insights(self, summary: Dict[str, Any], timeseries: List[Dict[str, Any]], competitor_insights: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate AI insights from analytics data."""
        try:
            insights = []
            
            # Traffic insights
            clicks = summary.get("clicks", 0)
            ctr = summary.get("ctr", 0)
            
            if clicks > 0 and ctr < 0.02:  # Low CTR
                insights.append({
                    "type": "opportunity",
                    "priority": "high",
                    "text": f"Your CTR is {ctr:.1%}, which is below average. Consider optimizing your meta descriptions and titles.",
                    "category": "performance"
                })
            
            # Competitive insights
            opportunity_score = competitor_insights.get("opportunity_score", 0)
            if opportunity_score > 70:
                insights.append({
                    "type": "opportunity",
                    "priority": "high",
                    "text": f"High opportunity score of {opportunity_score}% - competitors are ranking for keywords you're not targeting.",
                    "category": "competitive"
                })
            
            # Content gaps
            content_gaps = competitor_insights.get("content_gaps", [])
            if content_gaps:
                insights.append({
                    "type": "action",
                    "priority": "medium",
                    "text": f"Found {len(content_gaps)} content gaps. Consider creating content for these topics.",
                    "category": "content"
                })
            
            return insights
            
        except Exception as e:
            logger.error(f"Error generating AI insights: {e}")
            return []
