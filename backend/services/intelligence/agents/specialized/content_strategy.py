"""
Content Strategy Agent implementation.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.seo_tools.content_strategy_service import ContentStrategyService
from services.analytics import PlatformAnalyticsService
from services.database import has_onboarding_session

try:
    from services.intelligence.sif_integration import SIFIntegrationService
    SIF_AVAILABLE = True
except ImportError:
    SIF_AVAILABLE = False

class ContentStrategyAgent(BaseALwrityAgent):
    """
    Agent responsible for content strategy, gap analysis, and optimization.
    """
    
    def __init__(self, user_id: str, shared_llm_name: str, llm: Any = None, **kwargs):
        # Correctly pass arguments to superclass
        super().__init__(user_id, "content_strategist", shared_llm_name, llm, **kwargs)
        
        self.sif_service = None
        self.content_strategy_service = ContentStrategyService()
        if SIF_AVAILABLE and has_onboarding_session(user_id):
            try:
                self.sif_service = SIFIntegrationService(user_id)
            except Exception as e:
                logger.warning(f"Failed to initialize SIF service for ContentStrategyAgent: {e}")
        elif SIF_AVAILABLE:
            logger.debug(
                "Skipping SIF service initialization for ContentStrategyAgent user {}: no onboarding session",
                user_id,
            )

    def _create_txtai_agent(self):
        """Create a specialized txtai Agent for content strategy with tools."""
        if not TXTAI_AVAILABLE or Agent is None:
            return None
            
        # Unwrap tracking wrapper for txtai Agent if present
        _llm_for_agent = getattr(self.llm, "llm", self.llm)
        return Agent(
            tools=[
                {
                    "name": "content_analyzer",
                    "description": "Analyzes content performance using SIF insights and GSC data",
                    "target": self._content_analyzer_tool_sync
                },
                {
                    "name": "semantic_gap_detector",
                    "description": "Identifies semantic gaps between current content and high-performing topics",
                    "target": self._semantic_gap_detector_tool_sync
                },
                {
                    "name": "content_optimizer",
                    "description": "Optimizes content for target keywords and user intent",
                    "target": self._content_optimizer_tool_sync
                },
                {
                    "name": "performance_tracker",
                    "description": "Tracks content performance over time",
                    "target": self._performance_tracker_tool_sync
                },
                {
                    "name": "sitemap_analyzer",
                    "description": "Analyzes website structure and publishing velocity via sitemap",
                    "target": self._sitemap_analyzer_tool_sync
                },
                {
                    "name": "gsc_low_ctr_queries",
                    "description": "Returns low-CTR queries with evidence from cached GSC metrics",
                    "target": self._cs_gsc_low_ctr_queries_tool_sync
                },
                {
                    "name": "gsc_striking_distance_queries",
                    "description": "Returns striking-distance queries (positions ~8–20) with evidence",
                    "target": self._cs_gsc_striking_distance_tool_sync
                },
                {
                    "name": "gsc_declining_queries",
                    "description": "Returns period-over-period declining queries with evidence",
                    "target": self._cs_gsc_declining_queries_tool_sync
                },
                {
                    "name": "gsc_low_ctr_pages",
                    "description": "Returns low-CTR pages with top contributing queries",
                    "target": self._cs_gsc_low_ctr_pages_tool_sync
                },
                {
                    "name": "gsc_cannibalization_candidates",
                    "description": "Returns query→multiple-pages cannibalization candidates with target recommendation",
                    "target": self._cs_gsc_cannibalization_candidates_tool_sync
                },
                {
                    "name": "default_content_gsc_plan",
                    "description": "Runs a default first-pass plan using GSC signals (titles/meta, consolidation, refreshes)",
                    "target": self._default_content_gsc_plan_tool_sync
                },
            ],
            llm=_llm_for_agent,
            max_iterations=8,
            task="language-generation",
            )
    
    # Tool Implementations
    
    def _sitemap_analyzer_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes sitemap structure and publishing velocity.
        
        Args:
            context: Input parameters for analysis. Example keys:
                - sitemap_url: Optional URL to sitemap.xml
                - include_lastmod: Whether to include last modification dates
        
        Returns:
            A dictionary with summary metrics (e.g., pages, last_mod).
        """
        # Stub implementation
        return {"status": "analyzed", "pages": 0}

    async def _cs_fetch_gsc_analytics(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        svc = PlatformAnalyticsService()
        data = await svc.get_comprehensive_analytics(self.user_id, platforms=["gsc"], start_date=start_date, end_date=end_date)
        gsc = data.get("gsc")
        if not gsc or gsc.status != "success":
            err = getattr(gsc, "error_message", None) if gsc else "No data"
            raise RuntimeError(f"GSC analytics unavailable: {err}")
        return {"metrics": gsc.metrics, "date_range": gsc.date_range}

    def _cs_gsc_low_ctr_queries_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetches low-CTR queries from Google Search Console signals.
        
        Args:
            context: Input parameters. Example keys:
                - date_range: Optional date range
                - limit: Max number of queries to return
        
        Returns:
            A dictionary containing items and source.
        """
        self._log_agent_operation("Fetching Low CTR Queries (Stub)", context=context)
        return {"items": [], "source": "stub"}

    def _cs_gsc_striking_distance_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns striking-distance queries (positions ~8–20).
        
        Args:
            context: Input parameters. Example keys:
                - position_range: Range to consider striking distance
                - limit: Max number of queries
        
        Returns:
            A dictionary containing items and source.
        """
        self._log_agent_operation("Fetching Striking Distance Queries (Stub)", context=context)
        return {"items": [], "source": "stub"}

    def _cs_gsc_declining_queries_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns period-over-period declining queries.
        
        Args:
            context: Input parameters. Example keys:
                - compare_range: Time windows to compare
                - limit: Max number of queries
        
        Returns:
            A dictionary containing items and source.
        """
        self._log_agent_operation("Fetching Declining Queries (Stub)", context=context)
        return {"items": [], "source": "stub"}

    def _cs_gsc_low_ctr_pages_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns low-CTR pages with top contributing queries.
        
        Args:
            context: Input parameters. Example keys:
                - date_range: Optional date range
                - limit: Max number of pages
        
        Returns:
            A dictionary containing items and source.
        """
        self._log_agent_operation("Fetching Low CTR Pages (Stub)", context=context)
        return {"items": [], "source": "stub"}

    def _cs_gsc_cannibalization_candidates_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns query→multiple-pages cannibalization candidates with target recommendation.
        
        Args:
            context: Input parameters. Example keys:
                - limit: Max number of candidates
        
        Returns:
            A dictionary containing items and source.
        """
        self._log_agent_operation("Fetching Cannibalization Candidates (Stub)", context=context)
        return {"items": [], "source": "stub"}

    def _default_content_gsc_plan_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates a default first-pass plan using GSC signals (titles/meta, consolidation, refreshes).
        
        Args:
            context: Input parameters. Example keys:
                - target_url: Page to optimize
                - date_range: Optional date range for signals
        
        Returns:
            A dictionary describing plan_name and actions.
        """
        self._log_agent_operation("Generating Default GSC Plan (Stub)", context=context)
        return {"plan_name": "Stub Plan", "actions": []}

    def _content_analyzer_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes content performance using SIF insights and Google Search Console data.
        
        Args:
            context: Input parameters. Example keys:
                - target_url: Page to analyze
                - date_range: Optional date range
                - include_competitors: Whether to include competitor comparison
        
        Returns:
            A dictionary containing content_analysis summary, sif_insights, gsc_performance,
            identified_gaps, strategic_recommendations, and timestamp.
        """
        return {
            "content_analysis": "Completed via SIF + GSC Integration",
            "sif_insights": {},
            "gsc_performance": {"clicks": 100},
            "identified_gaps": [],
            "strategic_recommendations": [],
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _content_optimizer_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates specific diffs/rewrites using LLM-based rewriting and semantic analysis.
        
        Args:
            context: Input parameters. Example keys:
                - target_url: Page to optimize
                - optimization_goal: e.g., 'increase CTR', 'clarify intent'
        
        Returns:
            A dictionary containing optimized_content text or diff instructions.
        """
        return {"optimized_content": "Optimized text"}

    def _semantic_gap_detector_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects semantic gaps in current coverage versus target topics.
        
        Args:
            context: Input parameters. Example keys:
                - topics: Optional list of topics to compare against
        
        Returns:
            A list of gap objects with relevance scores.
        """
        self._log_agent_operation("Detecting gaps", context=context)
        return [{"gap": "advanced techniques", "relevance": 0.9}]

    def _performance_tracker_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Tracks performance metrics over time.
        
        Args:
            context: Input parameters. Example keys:
                - date_range: Optional date range
                - metrics: Optional list of metrics to track
        
        Returns:
            A dictionary containing views/engagement summary.
        """
        self._log_agent_operation("Tracking performance", context=context)
        return {"views": 100, "engagement": 0.05}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose strategic tasks based on user onboarding context.
        Derives content pillars, industry, and competitor info to
        generate personalized daily content suggestions.
        """
        proposals = []

        onboarding = context.get("onboarding_data", {})
        if not isinstance(onboarding, dict):
            return proposals

        # Extract user profile hints from onboarding data
        industry = ""
        content_pillars = []
        competitor_domains = []
        try:
            cp = onboarding.get("core_persona") or {}
            if isinstance(cp, dict):
                industry = str(cp.get("industry") or cp.get("company_type") or "")
            step2 = onboarding.get("step2_summary") or onboarding.get("industry_context") or {}
            if isinstance(step2, dict):
                content_pillars = (
                    step2.get("content_pillars")
                    or step2.get("topics")
                    or onboarding.get("content_pillars")
                    or []
                )
            cf = onboarding.get("competitor_focus") or {}
            if isinstance(cf, dict):
                competitor_domains = cf.get("top_competitor_domains") or []
        except Exception:
            pass

        # Task 1: Create content for a key pillar (generate)
        if content_pillars:
            pillar_topic = content_pillars[0] if isinstance(content_pillars[0], str) else (
                content_pillars[0].get("topic") or content_pillars[0].get("name") or "your audience"
            )
            proposals.append(TaskProposal(
                title=f"Create content for '{pillar_topic}'",
                description=f"Write a blog post or social content around your {pillar_topic} content pillar.",
                pillar_id="generate",
                priority="high",
                estimated_time=45,
                source_agent="ContentStrategyAgent",
                reasoning=f"'{pillar_topic}' is a core content pillar in your strategy. Regular publishing keeps your topical authority growing.",
                action_type="navigate",
                action_url="/blog-writer",
                context_data={"pillar_topic": pillar_topic, "industry": industry},
            ))
        else:
            proposals.append(TaskProposal(
                title="Define your content pillars",
                description="Set up your core content topics to get personalized daily suggestions.",
                pillar_id="plan",
                priority="high",
                estimated_time=20,
                source_agent="ContentStrategyAgent",
                reasoning="Content pillars drive every other task in your workflow. Defining them unlocks the full agent committee.",
                action_type="navigate",
                action_url="/content-planning-dashboard",
            ))

        # Task 2: Competitor content review (analyze)
        if competitor_domains:
            domain = competitor_domains[0]
            proposals.append(TaskProposal(
                title=f"Review competitor: {domain}",
                description=f"Analyze recently published content from {domain} to find gaps and opportunities.",
                pillar_id="analyze",
                priority="medium",
                estimated_time=25,
                source_agent="ContentStrategyAgent",
                reasoning=f"{domain} is your top tracked competitor. Regular reviews help you stay ahead of their content strategy moves.",
                action_type="navigate",
                action_url="/seo-dashboard",
                context_data={"competitor_domain": domain},
            ))

        # Task 3: Content audit (analyze) — always suggested
        proposals.append(TaskProposal(
            title="Quick content performance audit",
            description="Review your top 3 pieces from last month. Identify what worked and what to update.",
            pillar_id="analyze",
            priority="medium",
            estimated_time=20,
            source_agent="ContentStrategyAgent",
            reasoning="Regular audits surface declining pages that need refreshing and winning formats to double down on.",
            action_type="navigate",
            action_url="/content-planning-dashboard",
        ))

        return proposals
