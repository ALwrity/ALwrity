"""
Phase 2B: Real-Time Semantic Dashboard

This module implements a real-time semantic monitoring dashboard for ongoing
content analysis, competitor tracking, and semantic health monitoring.
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from loguru import logger

from services.database import has_onboarding_session
from ..txtai_service import TxtaiIntelligenceService
from ..semantic_cache import semantic_cache_manager
from ..sif_integration import SIFIntegrationService
# Agent imports will be done lazily to avoid circular imports


@dataclass
class SemanticHealthMetric:
    """Represents a semantic health metric for monitoring."""
    metric_name: str
    value: float
    threshold: float
    status: str  # "healthy", "warning", "critical"
    timestamp: str
    description: str
    recommendations: List[str]


@dataclass
class CompetitorSemanticSnapshot:
    """Snapshot of competitor semantic positioning."""
    competitor_id: str
    competitor_name: str
    semantic_overlap: float
    unique_topics: List[str]
    content_volume: int
    authority_score: float
    last_updated: str
    trending_topics: List[str]


@dataclass
class ContentSemanticInsight:
    """Represents an actionable content insight."""
    insight_id: str
    insight_type: str  # 'gap', 'trend', 'optimization', 'threat'
    title: str
    description: str
    confidence_score: float  # 0.0 to 1.0
    impact_score: float  # 0.0 to 10.0
    related_topics: List[str]
    suggested_actions: List[str]
    created_at: str
    expires_at: str
    source_agent: str = "SIF Intelligence"  # New field for agent attribution


class RealTimeSemanticMonitor:
    """
    Real-time semantic monitoring system for content and competitor analysis.
    
    Features:
    - Continuous semantic health monitoring
    - Real-time competitor tracking
    - Content performance analysis
    - Automated alerting system
    - Trend detection and forecasting
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.cache_manager = semantic_cache_manager
        self.sif_enabled = has_onboarding_session(user_id)
        self.intelligence_service = TxtaiIntelligenceService(user_id) if self.sif_enabled else None
        self.sif_service = SIFIntegrationService(user_id) if self.sif_enabled else None
        if not self.sif_enabled:
            logger.info(
                "Skipping semantic monitor SIF initialization for user {}: no onboarding session found",
                user_id,
            )
        
        # Initialize monitoring agents (lazy initialization to avoid circular imports)
        self.strategy_agent = None
        self.guardian_agent = None
        self.link_agent = None
        
        # Monitoring configuration
        self.monitoring_interval = 300  # 5 minutes
        self.health_thresholds = {
            "semantic_diversity": 0.6,
            "content_freshness": 0.7,
            "competitor_gap": 0.5,
            "authority_score": 0.4
        }
        
        # Monitoring state
        self.is_monitoring = False
        self.monitored_competitors: Set[str] = set()
        self.alert_subscribers: List[str] = []
        self.monitoring_history: List[Dict[str, Any]] = []
        # Reference to the asyncio task running the monitoring loop.
        # Stored so stop_monitoring() can cancel and await it cleanly
        # (previously the task was fire-and-forget and could outlive
        # the caller's intent).
        self._monitoring_task: Optional[asyncio.Task] = None
        
        logger.info(f"Real-time semantic monitor initialized for user {user_id}")

    async def check_semantic_health(self, user_id: Optional[str] = None) -> SemanticHealthMetric:
        """
        Public wrapper for semantic health check.
        Aggregates metrics into a single health status object.
        """
        # If SIF isn't enabled for this user (no onboarding session),
        # surface a distinct 'not_available' status instead of warning.
        # This lets the frontend render a clear 'not set up' state and
        # avoid polling for users who will never get a different result.
        if not self.sif_enabled:
            return SemanticHealthMetric(
                metric_name="semantic_health",
                value=0.0,
                threshold=0.0,
                status="not_available",
                timestamp=datetime.utcnow().isoformat(),
                description="Semantic monitoring is not enabled for this user (no onboarding session).",
                recommendations=[
                    "Complete onboarding to enable semantic monitoring",
                ],
            )

        # Call internal method (ignoring user_id arg if passed, as we use self.user_id)
        metrics = await self._check_semantic_health()

        if not metrics:
            # Return a canonical semantic health summary when no metrics are available.
            return SemanticHealthMetric(
                metric_name="semantic_health",
                value=0.0,
                threshold=0.0,
                status="warning",
                timestamp=datetime.utcnow().isoformat(),
                description="No semantic health metrics available yet",
                recommendations=[
                    "Run semantic analysis to populate health metrics",
                    "Check data sources and try again shortly"
                ]
            )
            
        # Aggregate metrics
        # 1. Status: "critical" if any critical, else "warning" if any warning, else "healthy"
        status = "healthy"
        for m in metrics:
            if m.status == "critical":
                status = "critical"
                break
            if m.status == "warning":
                status = "warning"
        
        # 2. Value: Average of metric values
        avg_value = sum(m.value for m in metrics) / len(metrics)

        # 3. Threshold: Average threshold across health metrics
        avg_threshold = sum(m.threshold for m in metrics) / len(metrics)

        # 4. Recommendations: de-duplicated recommendations from non-healthy metrics
        recommendations = []
        seen_recommendations = set()
        for metric in metrics:
            if metric.status != "healthy":
                for recommendation in metric.recommendations:
                    if recommendation not in seen_recommendations:
                        seen_recommendations.add(recommendation)
                        recommendations.append(recommendation)

        if not recommendations:
            recommendations = ["Continue monitoring semantic performance"]

        return SemanticHealthMetric(
            metric_name="semantic_health",
            value=avg_value,
            threshold=avg_threshold,
            status=status,
            timestamp=datetime.utcnow().isoformat(),
            description="Aggregated semantic health across monitoring metrics",
            recommendations=recommendations,
        )
    
    async def start_monitoring(self, competitors: List[str] = None) -> bool:
        """Start real-time semantic monitoring."""
        try:
            # If a previous loop is still running, cancel it before
            # starting a new one. Prevents accumulating stale loops
            # when start_monitoring() is called repeatedly.
            if self._monitoring_task is not None and not self._monitoring_task.done():
                self._monitoring_task.cancel()
                try:
                    await self._monitoring_task
                except (asyncio.CancelledError, Exception):
                    pass
                self._monitoring_task = None

            self.is_monitoring = True
            if competitors:
                self.monitored_competitors = set(competitors)

            logger.info(f"Started semantic monitoring for user {self.user_id}")
            logger.info(f"Monitoring {len(self.monitored_competitors)} competitors")

            # Start background monitoring task and keep a reference so
            # stop_monitoring() can cancel it cleanly. The previous
            # implementation used a fire-and-forget asyncio.create_task()
            # which made the loop uncancellable from outside.
            self._monitoring_task = asyncio.create_task(self._monitoring_loop())

            return True

        except Exception as e:
            logger.error(f"Failed to start semantic monitoring: {e}")
            return False

    async def stop_monitoring(self) -> bool:
        """Stop real-time semantic monitoring."""
        try:
            self.is_monitoring = False

            # Cancel and await the background loop. If the task already
            # finished, this is a no-op.
            if self._monitoring_task is not None and not self._monitoring_task.done():
                self._monitoring_task.cancel()
                try:
                    await self._monitoring_task
                except (asyncio.CancelledError, Exception):
                    pass
            self._monitoring_task = None

            logger.info(f"Stopped semantic monitoring for user {self.user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to stop semantic monitoring: {e}")
            return False
    
    async def _monitoring_loop(self):
        """Main monitoring loop that runs continuously."""
        while self.is_monitoring:
            try:
                logger.info(f"Running semantic health check for user {self.user_id}")
                
                # Perform comprehensive semantic analysis
                health_metrics = await self._check_semantic_health()
                competitor_updates = await self._monitor_competitors()
                content_insights = await self._analyze_content_performance()
                
                # Store monitoring snapshot
                snapshot = {
                    "timestamp": datetime.now().isoformat(),
                    "user_id": self.user_id,
                    "health_metrics": [asdict(metric) for metric in health_metrics],
                    "competitor_updates": [asdict(update) for update in competitor_updates],
                    "content_insights": [asdict(insight) for insight in content_insights]
                }
                
                self.monitoring_history.append(snapshot)

                # Keep only last 24 hours of history
                cutoff_time = datetime.now() - timedelta(hours=24)
                self.monitoring_history = [
                    h for h in self.monitoring_history
                    if datetime.fromisoformat(h["timestamp"]) > cutoff_time
                ]

                # Phase 5: persist the snapshot to DB so the dashboard
                # has durable history across process restarts and
                # multi-instance deployments. Best-effort: failures
                # are logged and the in-memory list is still kept.
                try:
                    from services.database import get_session_for_user
                    from models.semantic_monitoring_snapshot import (
                        SemanticMonitoringSnapshot,
                    )
                    db = get_session_for_user(self.user_id)
                    if db is not None:
                        try:
                            SemanticMonitoringSnapshot.append_snapshot(
                                db, self.user_id, snapshot
                            )
                            # Reclaim disk: prune anything older than 24h
                            # in the same transaction.
                            SemanticMonitoringSnapshot.prune_old_snapshots(
                                db, max_age_hours=24
                            )
                            db.commit()
                        finally:
                            db.close()
                except Exception as persist_exc:
                    logger.warning(
                        f"Failed to persist semantic monitoring snapshot "
                        f"for user {self.user_id}: {persist_exc}"
                    )
                
                # Check for alerts
                await self._check_alerts(health_metrics, competitor_updates, content_insights)
                
                # Cache results for dashboard
                await self._cache_monitoring_results(snapshot)
                
                logger.info(f"Semantic monitoring cycle completed. Next check in {self.monitoring_interval}s")
                
                # Wait for next cycle
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Error in semantic monitoring loop: {e}")
                await asyncio.sleep(self.monitoring_interval)  # Continue even on error
    
    async def _check_semantic_health(self) -> List[SemanticHealthMetric]:
        """Check overall semantic health of user's content."""
        metrics = []

        if not self.sif_enabled or not self.sif_service:
            return metrics
        
        try:
            # Get current semantic insights
            insights = await self.sif_service.get_semantic_insights({"user_id": self.user_id})
            
            if insights.get("source") == "error":
                logger.warning("Failed to get semantic insights for health check")
                return metrics
            
            insights_data = insights.get("insights", {})
            
            # Semantic diversity metric
            content_pillars = insights_data.get("content_pillars", [])
            semantic_diversity = len(content_pillars) / 10.0  # Normalize to 0-1
            
            diversity_status = "healthy" if semantic_diversity >= self.health_thresholds["semantic_diversity"] else "warning"
            metrics.append(SemanticHealthMetric(
                metric_name="semantic_diversity",
                value=semantic_diversity,
                threshold=self.health_thresholds["semantic_diversity"],
                status=diversity_status,
                timestamp=datetime.now().isoformat(),
                description=f"Content covers {len(content_pillars)} semantic pillars",
                recommendations=["Expand content topics", "Explore new semantic areas"] if diversity_status == "warning" else []
            ))
            
            # Content freshness metric (based on recent updates)
            freshness_score = await self._calculate_content_freshness()
            freshness_status = "healthy" if freshness_score >= self.health_thresholds["content_freshness"] else "warning"
            
            metrics.append(SemanticHealthMetric(
                metric_name="content_freshness",
                value=freshness_score,
                threshold=self.health_thresholds["content_freshness"],
                status=freshness_status,
                timestamp=datetime.now().isoformat(),
                description="Content freshness based on recent semantic updates",
                recommendations=["Update content regularly", "Monitor trending topics"] if freshness_status == "warning" else []
            ))
            
            # Authority score metric
            authority_score = await self._calculate_authority_score()
            authority_status = "healthy" if authority_score >= self.health_thresholds["authority_score"] else "critical"
            
            metrics.append(SemanticHealthMetric(
                metric_name="authority_score",
                value=authority_score,
                threshold=self.health_thresholds["authority_score"],
                status=authority_status,
                timestamp=datetime.now().isoformat(),
                description="Semantic authority based on content depth and relevance",
                recommendations=["Create authoritative content", "Build topical expertise"] if authority_status != "healthy" else []
            ))
            
        except Exception as e:
            logger.error(f"Failed to check semantic health: {e}")
        
        return metrics
    
    async def _monitor_competitors(self) -> List[CompetitorSemanticSnapshot]:
        """Monitor competitor semantic positioning."""
        snapshots = []
        if not self.sif_enabled or not self.intelligence_service:
            return snapshots
        try:
            # 1. Get competitors from SIF integration
            # We assume SIFIntegrationService has methods to get competitor data or we query index
            # Let's try to search for "competitor_analysis" type in txtai index
            results = await self.intelligence_service.search("competitor analysis", limit=10)
            
            competitors_found = []
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        if metadata.get('type') == 'competitor_analysis':
                            competitors_found.append(metadata)
                    except: continue

            # If no semantic data found, try fallback to DB/Integration service logic if needed
            # For now, if we found semantic docs:
            for comp_meta in competitors_found:
                try:
                    full_report = comp_meta.get('full_report', {})
                    domain = comp_meta.get('url', 'Unknown')
                    
                    # Calculate real metrics from the full report
                    # Use semantic overlap from SIF if available, or estimate
                    overlap = full_report.get('semantic_overlap', 0.5) 
                    
                    # Extract topics from the analysis content
                    topics = full_report.get('content_topics', [])
                    if not topics and 'analysis' in full_report:
                         # Try to extract from unstructured text if structured topics missing
                         topics = ["General Strategy"] # Fallback
                    
                    snapshot = CompetitorSemanticSnapshot(
                        competitor_id=f"comp_{domain}",
                        competitor_name=domain,
                        semantic_overlap=overlap,
                        unique_topics=topics[:5],
                        content_volume=full_report.get('page_count', 0),
                        authority_score=full_report.get('authority_score', 0.5),
                        last_updated=comp_meta.get('timestamp', datetime.now().isoformat()),
                        trending_topics=full_report.get('trending_topics', [])
                    )
                    snapshots.append(snapshot)
                except Exception as e:
                    logger.error(f"Error processing competitor snapshot: {e}")

            if not snapshots and self.monitored_competitors:
                 # Fallback for manually added competitors that might not be fully indexed yet
                 for competitor in self.monitored_competitors:
                     snapshots.append(CompetitorSemanticSnapshot(
                        competitor_id=f"comp_{competitor}",
                        competitor_name=competitor,
                        semantic_overlap=0.0,
                        unique_topics=["Pending Analysis"],
                        content_volume=0,
                        authority_score=0.0,
                        last_updated=datetime.now().isoformat(),
                        trending_topics=[]
                    ))

        except Exception as e:
            logger.error(f"Failed to monitor competitors: {e}")
        
        return snapshots
    
    async def _analyze_content_performance(self) -> List[ContentSemanticInsight]:
        """Analyze content performance and identify insights using SIF Agents."""
        insights = []

        if not self.sif_enabled or not self.sif_service:
            return insights
        
        try:
            current_time = datetime.now()
            
            # 1. Initialize Agents if needed (lazy load to avoid circular imports)
            if not self.strategy_agent:
                from ..agents.specialized_agents import StrategyArchitectAgent, ContentStrategyAgent, CompetitorResponseAgent
                self.strategy_agent = StrategyArchitectAgent(self.user_id)
                self.content_agent = ContentStrategyAgent(self.user_id)
                self.competitor_agent = CompetitorResponseAgent(self.user_id)

            # 2. Get Real Insights from Agents
            # Content Gaps
            try:
                # We can reuse the propose_daily_tasks logic or call specific methods
                # Let's manually construct a "gap analysis" context for the agent
                gap_context = {"analysis_type": "gaps", "website_url": "user_site"} 
                # Ideally we call a specific method like find_semantic_gaps if available publicly
                # But propose_daily_tasks returns TaskProposal objects. 
                # Let's check if we can get raw insights. 
                # The agents have methods like find_semantic_gaps (StrategyArchitect)
                
                # Using StrategyArchitect for pillar/gap analysis
                if hasattr(self.strategy_agent, 'find_semantic_gaps'):
                    logger.warning(
                        "Skipping direct semantic gap method invocation for user_id={} due to missing competitor index context",
                        self.user_id,
                    )
                else:
                    logger.warning(
                        "Strategy agent missing find_semantic_gaps for user_id={}, using dashboard-context fallback",
                        self.user_id,
                    )
                
                # Alternative: Query SIF directly for "content gaps" if they are indexed as such
                # Or generate them now via LLM + SIF Context
                
                # Let's generate ONE high quality insight via ContentStrategyAgent
                # We'll simulate a task proposal request but specifically for "insights"
                # Actually, let's look at SIFIntegrationService.get_content_strategy_context
                
                # For now, to fix the "mock data" issue quickly:
                # We will check if we have ANY data in SIF.
                # If yes, we generate dynamic insights based on that data.
                
                dashboard_context = await self.sif_service.get_seo_dashboard_context()
                if "error" not in dashboard_context:
                    data = dashboard_context.get("dashboard_data", {})
                    summary = data.get("summary", {})
                    
                    # Insight 1: Performance Trend
                    ctr = summary.get("ctr", 0)
                    if ctr < 0.02:
                        insights.append(ContentSemanticInsight(
                            insight_id="perf_low_ctr",
                            insight_type="opportunity",
                            title="Low CTR Opportunity",
                            description=f"Your average CTR is {ctr:.1%}. Optimizing meta descriptions could boost traffic.",
                            confidence_score=0.9,
                            impact_score=8.0,
                            related_topics=["meta tags", "titles", "ctr optimization"],
                            suggested_actions=["Rewrite titles for high-impression low-click pages"],
                            created_at=current_time.isoformat(),
                            expires_at=(current_time + timedelta(days=7)).isoformat(),
                            source_agent="SEO Specialist Agent"
                        ))
                    
                    # Insight 2: Keyword Opportunities (from AI insights in dashboard data)
                    ai_insights = data.get("ai_insights", [])
                    for i, ai_ins in enumerate(ai_insights[:2]): # Take top 2
                        insights.append(ContentSemanticInsight(
                            insight_id=f"ai_insight_{i}",
                            insight_type="trend", # Map category
                            title=f"AI Recommendation: {ai_ins.get('category', 'General')}",
                            description=ai_ins.get('insight', 'No description'),
                            confidence_score=0.85,
                            impact_score=7.5,
                            related_topics=[ai_ins.get('category', 'seo')],
                            suggested_actions=[ai_ins.get('insight')], # Simplification
                            created_at=current_time.isoformat(),
                            expires_at=(current_time + timedelta(days=7)).isoformat(),
                            source_agent="Strategy Architect Agent"
                        ))

                    if not ai_insights:
                        logger.warning(
                            "Dashboard context returned no ai_insights for user_id={}, insight generation is degraded",
                            self.user_id,
                        )
                else:
                    logger.warning(
                        "SEO dashboard context unavailable for user_id={}, using fallback insight only",
                        self.user_id,
                    )

            except Exception as agent_err:
                logger.warning(f"Agent insight generation failed: {agent_err}")

            # If still no insights (e.g. no dashboard data), AND we have no fallback, 
            # THEN we might return an empty list or a "Setup" insight.
            if not insights:
                 insights.append(ContentSemanticInsight(
                    insight_id="setup_001",
                    insight_type="gap",
                    title="Awaiting Data Analysis",
                    description="Connect Search Console or complete competitor analysis to see real-time insights.",
                    confidence_score=1.0,
                    impact_score=5.0,
                    related_topics=["onboarding"],
                    suggested_actions=["Complete Step 5 Onboarding"],
                    created_at=current_time.isoformat(),
                    expires_at=(current_time + timedelta(days=1)).isoformat(),
                    source_agent="Onboarding Assistant"
                ))
            
        except Exception as e:
            logger.error(f"Failed to analyze content performance: {e}")
        
        return insights
    
    async def _calculate_content_freshness(self) -> float:
        """Calculate content freshness score."""
        # This would analyze actual content timestamps and updates
        return 0.85  # Placeholder
    
    async def _calculate_authority_score(self) -> float:
        """Calculate semantic authority score."""
        # This would analyze content depth, backlinks, engagement, etc.
        return 0.72  # Placeholder
    
    async def _check_alerts(self, health_metrics: List[SemanticHealthMetric], 
                           competitor_updates: List[CompetitorSemanticSnapshot],
                           content_insights: List[ContentSemanticInsight]):
        """Check for alert conditions and notify subscribers."""
        alerts = []
        
        # Check health metrics for critical conditions
        for metric in health_metrics:
            if metric.status == "critical":
                alerts.append({
                    "type": "health_critical",
                    "title": f"Critical: {metric.metric_name}",
                    "message": metric.description,
                    "severity": "critical",
                    "timestamp": datetime.now().isoformat()
                })
        
        # Check for high-impact insights
        for insight in content_insights:
            if insight.impact_score >= 8.0:
                alerts.append({
                    "type": "high_impact_insight",
                    "title": f"High Impact: {insight.title}",
                    "message": insight.description,
                    "severity": "warning",
                    "timestamp": datetime.now().isoformat()
                })
        
        # Send alerts to subscribers
        if alerts:
            try:
                from services.agent_activity_service import AgentActivityService
                from services.database import get_session_for_user

                db = get_session_for_user(self.user_id)
                if db:
                    service = AgentActivityService(db, self.user_id)
                    for alert in alerts:
                        alert_type = alert.get("type") or "semantic_alert"
                        severity = alert.get("severity") or "info"
                        mapped_severity = "error" if severity == "critical" else ("warning" if severity == "warning" else "info")
                        dedupe_key = None
                        if alert_type == "health_critical":
                            dedupe_key = f"semantic_health_critical:{alert.get('title')}:{datetime.utcnow().date().isoformat()}"
                        elif alert_type == "high_impact_insight":
                            dedupe_key = f"semantic_high_impact:{alert.get('title')}:{datetime.utcnow().date().isoformat()}"

                        service.create_alert(
                            alert_type=alert_type,
                            title=alert.get("title") or "Semantic alert",
                            message=alert.get("message") or "",
                            severity=mapped_severity,
                            payload=alert,
                            cta_path="/seo-dashboard",
                            dedupe_key=dedupe_key,
                        )
                    db.close()
            except Exception as alert_err:
                logger.warning(
                    "Unable to persist semantic alerts for user_id={} error_class={} error_message={}",
                    self.user_id,
                    type(alert_err).__name__,
                    str(alert_err),
                )
            await self._send_alerts(alerts)

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get semantic cache statistics."""
        return self.cache_manager.get_stats()
    
    async def _send_alerts(self, alerts: List[Dict[str, Any]]):
        """Send alerts to subscribed users."""
        for alert in alerts:
            logger.warning(f"ALERT: {alert['title']} - {alert['message']}")
            # Here you would integrate with notification systems (email, Slack, etc.)
    
    async def _cache_monitoring_results(self, snapshot: Dict[str, Any]):
        """Cache monitoring results for dashboard access."""
        try:
            cache_key = f"semantic_monitoring_{self.user_id}"
            self.cache_manager.set(
                cache_key, 
                self.user_id, 
                snapshot, 
                ttl=300  # 5 minutes
            )
            
            logger.debug(f"Cached monitoring results for user {self.user_id}")
            
        except Exception as e:
            logger.error(f"Failed to cache monitoring results: {e}")
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get current dashboard data for the user."""
        try:
            # Get cached monitoring results
            cache_key = f"semantic_monitoring_{self.user_id}"
            cached_data = self.cache_manager.get(cache_key, self.user_id)
            
            if cached_data:
                return {
                    "status": "active" if self.is_monitoring else "inactive",
                    "last_updated": cached_data.get("timestamp"),
                    "health_metrics": cached_data.get("health_metrics", []),
                    "competitor_updates": cached_data.get("competitor_updates", []),
                    "content_insights": cached_data.get("content_insights", []),
                    "monitored_competitors": list(self.monitored_competitors),
                    "monitoring_interval": self.monitoring_interval
                }
            
            # Return default data if no cache
            return {
                "status": "inactive",
                "last_updated": datetime.now().isoformat(),
                "health_metrics": [],
                "competitor_updates": [],
                "content_insights": [],
                "monitored_competitors": list(self.monitored_competitors),
                "monitoring_interval": self.monitoring_interval
            }
            
        except Exception as e:
            logger.error(f"Failed to get dashboard data: {e}")
            return {"error": str(e)}
    
    def get_monitoring_history(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Get monitoring history for the specified number of hours.

        Phase 5: prefer the durable DB-backed history when available
        so the dashboard can show data across process restarts. Falls
        back to the in-memory list if the DB is unreachable. The two
        sources are merged (DB rows first, then in-memory snapshots
        newer than what the DB returned) so the caller sees the most
        complete view possible.
        """
        db_snapshots: List[Dict[str, Any]] = []
        try:
            from services.database import get_session_for_user
            from models.semantic_monitoring_snapshot import (
                SemanticMonitoringSnapshot,
            )
            db = get_session_for_user(self.user_id)
            if db is not None:
                try:
                    db_snapshots = SemanticMonitoringSnapshot.get_recent_snapshots(
                        db, self.user_id, hours=hours
                    )
                finally:
                    db.close()
        except Exception as db_exc:
            logger.warning(
                f"Failed to read semantic monitoring history from DB "
                f"for user {self.user_id}: {db_exc}"
            )

        # In-memory list filtered to the same window. This is the
        # in-flight view (newest snapshots) and may overlap with the
        # DB rows, so we dedupe by timestamp.
        cutoff_time = datetime.now() - timedelta(hours=hours)
        in_memory = [
            h for h in self.monitoring_history
            if datetime.fromisoformat(h["timestamp"]) > cutoff_time
        ]
        seen_timestamps = {h.get("timestamp") for h in db_snapshots}
        merged = list(db_snapshots)
        for snap in in_memory:
            if snap.get("timestamp") not in seen_timestamps:
                merged.append(snap)
                seen_timestamps.add(snap.get("timestamp"))
        # Sort by timestamp so callers get a stable ordering
        merged.sort(key=lambda h: h.get("timestamp", ""))
        return merged


class SemanticDashboardAPI:
    """API interface for the semantic monitoring dashboard."""

    STALE_AFTER_SECONDS = 3600  # 1 hour without access = stale

    def __init__(self):
        self.monitors: Dict[str, RealTimeSemanticMonitor] = {}
        self._last_access: Dict[str, datetime] = {}

    def get_monitor(self, user_id: str) -> RealTimeSemanticMonitor:
        """Get or create a semantic monitor for a user."""
        if user_id not in self.monitors:
            self.monitors[user_id] = RealTimeSemanticMonitor(user_id)
        self._last_access[user_id] = datetime.utcnow()
        return self.monitors[user_id]

    def evict_stale_monitors(self, max_age_seconds: Optional[int] = None) -> int:
        """
        Remove monitors that haven't been accessed in max_age_seconds.
        Returns the number of evicted monitors.
        """
        max_age = max_age_seconds or self.STALE_AFTER_SECONDS
        now = datetime.utcnow()
        stale = [
            uid for uid, last in self._last_access.items()
            if (now - last).total_seconds() > max_age
        ]
        for uid in stale:
            self.monitors.pop(uid, None)
            self._last_access.pop(uid, None)
        if stale:
            logger.info(f"Evicted {len(stale)} stale semantic monitor(s)")
        return len(stale)
    
    async def start_dashboard_monitoring(self, user_id: str, competitors: List[str] = None) -> Dict[str, Any]:
        """Start semantic monitoring for a user."""
        monitor = self.get_monitor(user_id)
        success = await monitor.start_monitoring(competitors)
        
        return {
            "user_id": user_id,
            "monitoring_started": success,
            "competitors": competitors or [],
            "timestamp": datetime.now().isoformat()
        }
    
    async def stop_dashboard_monitoring(self, user_id: str) -> Dict[str, Any]:
        """Stop semantic monitoring for a user."""
        monitor = self.get_monitor(user_id)
        success = await monitor.stop_monitoring()
        
        return {
            "user_id": user_id,
            "monitoring_stopped": success,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        """Get current dashboard data for a user."""
        monitor = self.get_monitor(user_id)
        return monitor.get_dashboard_data()
    
    def get_monitoring_history(self, user_id: str, hours: int = 24) -> List[Dict[str, Any]]:
        """Get monitoring history for a user."""
        monitor = self.get_monitor(user_id)
        return monitor.get_monitoring_history(hours)


# Global API instance
semantic_dashboard_api = SemanticDashboardAPI()


# Example usage and testing
async def test_semantic_dashboard():
    """Test the real-time semantic dashboard."""
    logger.info("Testing Real-Time Semantic Dashboard")
    
    # Create test monitor
    user_id = "test_user_dashboard"
    competitors = ["competitor1.com", "competitor2.com", "competitor3.com"]
    
    # Start monitoring
    logger.info("Starting semantic monitoring...")
    start_result = await semantic_dashboard_api.start_dashboard_monitoring(user_id, competitors)
    logger.info(f"Monitoring started: {start_result}")
    
    # Wait a bit for monitoring to collect data
    logger.info("Waiting for monitoring data collection...")
    await asyncio.sleep(10)
    
    # Get dashboard data
    logger.info("Getting dashboard data...")
    dashboard_data = semantic_dashboard_api.get_dashboard_data(user_id)
    logger.info(f"Dashboard status: {dashboard_data.get('status')}")
    logger.info(f"Health metrics: {len(dashboard_data.get('health_metrics', []))}")
    logger.info(f"Competitor updates: {len(dashboard_data.get('competitor_updates', []))}")
    logger.info(f"Content insights: {len(dashboard_data.get('content_insights', []))}")
    
    # Get monitoring history
    logger.info("Getting monitoring history...")
    history = semantic_dashboard_api.get_monitoring_history(user_id, hours=1)
    logger.info(f"Monitoring history entries: {len(history)}")
    
    # Stop monitoring
    logger.info("Stopping semantic monitoring...")
    stop_result = await semantic_dashboard_api.stop_dashboard_monitoring(user_id)
    logger.info(f"Monitoring stopped: {stop_result}")
    
    logger.info("Semantic Dashboard test completed successfully!")


if __name__ == "__main__":
    # Run test
    asyncio.run(test_semantic_dashboard())
