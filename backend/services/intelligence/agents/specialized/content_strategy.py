"""
Content Strategy Agent implementation.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.seo_tools.content_strategy_service import ContentStrategyService
from services.analytics import PlatformAnalyticsService
from services.llm_providers.main_text_generation import llm_text_gen
from services.database import has_onboarding_session, get_session_for_user
from models.content_asset_models import AssetSource, AssetType
from services.content_asset_service import ContentAssetService
from services.intelligence.agents.tool_contracts import error_tool, tool_result, unavailable_tool
from services.intelligence.agents.prompt_context import build_prompt_context

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

            )

    def _run_async_tool(self, coroutine):
        """Run an async service from txtai's synchronous tool callback."""
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coroutine)

        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(asyncio.run, coroutine).result(timeout=120)

    def _tool_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        supplied = context if isinstance(context, dict) else {}
        onboarding = supplied.get("onboarding_context")
        if isinstance(onboarding, dict):
            return onboarding
        try:
            return self._load_prompt_context()
        except Exception:
            return {}

    def _gsc_result(self, context: Dict[str, Any]) -> Dict[str, Any]:
        try:
            result = self._run_async_tool(
                self._cs_fetch_gsc_analytics(
                    context.get("start_date"), context.get("end_date")
                )
            )
            return result
        except Exception as exc:
            return error_tool("gsc", exc)

    def _content_asset_evidence(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Read published text assets for content inventory evidence."""
        session = context.get("db")
        owns_session = session is None
        try:
            session = session or get_session_for_user(self.user_id)
            if session is None:
                return unavailable_tool("content_asset_library", "content asset database is unavailable")
            assets, total = ContentAssetService(session).get_user_assets(
                user_id=self.user_id,
                asset_type=AssetType.TEXT,
                source_module=AssetSource.BLOG_WRITER,
                sort_by="created_at",
                sort_order="desc",
                limit=int(context.get("asset_limit") or 500),
            )
            published = []
            for asset in assets or []:
                tags = asset.tags if isinstance(asset.tags, list) else []
                metadata = asset.asset_metadata if isinstance(asset.asset_metadata, dict) else {}
                if "published" in tags or metadata.get("status") == "published":
                    published.append({
                        "id": str(getattr(asset, "id", "")),
                        "title": getattr(asset, "title", None),
                        "created_at": getattr(asset, "created_at", None),
                    })
            return tool_result(
                "success" if total else "no_data",
                "content_asset_library",
                data={"total_text_assets": total, "published_assets": len(published), "assets": published},
                evidence=published[:10],
                confidence=0.9,
            )
        except Exception as exc:
            return error_tool("content_asset_library", exc)
        finally:
            if owns_session and session is not None:
                session.close()
    
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
        tool_context = self._tool_context(context)
        website_url = str(
            context.get("sitemap_url")
            or context.get("website_url")
            or tool_context.get("website_url")
            or ""
        ).strip()
        if not website_url:
            return unavailable_tool("sitemap", "website_url is required")
        try:
            analysis = self._run_async_tool(
                self.content_strategy_service.analyze_content_strategy(
                    website_url=website_url,
                    competitors=tool_context.get("competitors") or [],
                    target_keywords=context.get("target_keywords") or [],
                    user_id=self.user_id,
                )
            )
            if not analysis:
                return tool_result("no_data", "sitemap", limitations=["Sitemap returned no analysis"])
            return tool_result(
                "success",
                "sitemap",
                data=analysis,
                evidence=[website_url],
                confidence=0.8,
            )
        except Exception as exc:
            return error_tool("sitemap", exc)

    async def _cs_fetch_gsc_analytics(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        svc = PlatformAnalyticsService()
        data = await svc.get_comprehensive_analytics(self.user_id, platforms=["gsc"], start_date=start_date, end_date=end_date)
        gsc = data.get("gsc")
        status = getattr(gsc, "status", None)
        status = getattr(status, "value", status)
        if not gsc or status != "success":
            err = getattr(gsc, "error_message", None) if gsc else "No data"
            raise RuntimeError(f"GSC analytics unavailable: {err}")
        metrics = gsc.metrics or {}
        return tool_result(
            "success" if metrics else "no_data",
            "gsc",
            data={"metrics": metrics, "date_range": gsc.date_range or {}},
            evidence=["Google Search Console"],
            confidence=0.9,
            freshness={"date_range": gsc.date_range or {}},
        )

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
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        metrics = result["data"].get("metrics") or {}
        limit = int(context.get("limit") or 10)
        items = [q for q in (metrics.get("top_queries") or []) if float(q.get("ctr") or 0) < float(context.get("max_ctr") or 3.0)]
        selected = items[:limit]
        return {**result, "data": {"items": selected}, "evidence": selected[:5]}

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
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        metrics = result["data"].get("metrics") or {}
        low = float(context.get("min_position") or 8)
        high = float(context.get("max_position") or 20)
        items = [q for q in (metrics.get("top_queries") or []) if low <= float(q.get("position") or 0) <= high]
        selected = items[: int(context.get("limit") or 10)]
        return {**result, "data": {"items": selected}, "evidence": selected[:5]}

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
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        declining = (result["data"].get("metrics") or {}).get("declining_queries") or []
        selected = declining[: int(context.get("limit") or 10)]
        return {**result, "data": {"items": selected}, "evidence": selected[:5]}

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
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        pages = [p for p in ((result["data"].get("metrics") or {}).get("top_pages") or []) if float(p.get("ctr") or 0) < float(context.get("max_ctr") or 3.0)]
        selected = pages[: int(context.get("limit") or 10)]
        return {**result, "data": {"items": selected}, "evidence": selected[:5]}

    def _cs_gsc_cannibalization_candidates_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Returns query→multiple-pages cannibalization candidates with target recommendation.
        
        Args:
            context: Input parameters. Example keys:
                - limit: Max number of candidates
        
        Returns:
            A dictionary containing items and source.
        """
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        candidates = (result["data"].get("metrics") or {}).get("cannibalization") or []
        selected = candidates[: int(context.get("limit") or 10)]
        return {**result, "data": {"items": selected}, "evidence": selected[:5]}

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
        result = self._gsc_result(context)
        if result["status"] != "success":
            return result
        metrics = result["data"].get("metrics") or {}
        actions = []
        if metrics.get("top_queries"):
            actions.append({"type": "review_queries", "evidence": metrics["top_queries"][:5]})
        if metrics.get("top_pages"):
            actions.append({"type": "review_pages", "evidence": metrics["top_pages"][:5]})
        return {**result, "data": {"plan_name": "GSC-backed content plan", "actions": actions}, "evidence": actions}

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
        result = self._gsc_result(context)
        assets = self._content_asset_evidence(context)
        gsc_metrics = result.get("data", {}).get("metrics", {}) if result["status"] == "success" else {}
        sif_items = []
        if self.sif_service and getattr(self.sif_service, "intelligence_service", None):
            try:
                topic_hint = str(context.get("topic") or context.get("target_url") or "").strip()
                sif_query = self._sif_query(
                    "content_strategist",
                    hints=[topic_hint] if topic_hint else ["content gaps"],
                    fallback="content gaps",
                )
                sif_items = self._run_async_tool(
                    self.sif_search(
                        sif_query,
                        limit=int(context.get("limit") or 10),
                        trigger="content_analyzer",
                    )
                ) or []
            except Exception as exc:
                logger.warning("SIF content analysis failed: {}", exc)
        if result["status"] != "success" and assets["status"] not in {"success", "no_data"} and not sif_items:
            return result
        low_ctr_pages = [p for p in gsc_metrics.get("top_pages", []) if float(p.get("ctr") or 0) < 3.0]
        gaps = [{"text": row.get("text") or row.get("id"), "score": row.get("score")} for row in sif_items]
        recommendations = []
        if low_ctr_pages:
            recommendations.append({"type": "improve_titles_and_descriptions", "pages": low_ctr_pages[:5]})
        if gaps:
            recommendations.append({"type": "cover_semantic_gaps", "topics": gaps[:5]})
        evidence = (low_ctr_pages[:5] + gaps[:5] + assets.get("evidence", [])[:5])
        return {
            **tool_result(
                "success" if result["status"] == "success" or assets["status"] == "success" or sif_items else "no_data",
                "gsc+sif+content_asset_library",
                data={},
                evidence=evidence,
                confidence=0.85 if result["status"] == "success" else 0.65,
                freshness=result.get("freshness", {}),
                limitations=result.get("limitations", []) + assets.get("limitations", []),
            ),
            "data": {
                "content_analysis": {"target_url": context.get("target_url"), "pages_analyzed": len(gsc_metrics.get("top_pages", []))},
                "gsc_performance": gsc_metrics,
                "content_inventory": assets.get("data", {}),
                "identified_gaps": gaps,
                "strategic_recommendations": recommendations,
            },
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
        content = str(context.get("content") or "").strip()
        if not content:
            return unavailable_tool("user_input", "content is required")
        try:
            response = llm_text_gen(
                prompt=(
                    "Improve the supplied content for the stated goal. Return only the revised text.\n"
                    f"Goal: {context.get('optimization_goal') or 'clarity and search intent'}\n"
                    f"Target audience: {self._tool_context(context).get('target_audience', '')}\n"
                    f"Content:\n{content[:12000]}"
                ),
                user_id=self.user_id,
            )
            optimized = str(response or "").strip()
            if not optimized:
                return tool_result("no_data", "llm", limitations=["Optimizer returned no content"])
            return tool_result(
                "success",
                "llm",
                data={
                    "optimized_content": optimized,
                    "optimization_goal": context.get("optimization_goal") or "clarity and search intent",
                    "quality_decision": {"passed": len(optimized) >= 20, "reason": "Generated content length check"},
                },
                evidence=[{"type": "user_input", "target_url": context.get("target_url")}],
                confidence=0.6,
            )
        except Exception as exc:
            return error_tool("llm", exc)

    def _semantic_gap_detector_tool_sync(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detects semantic gaps in current coverage versus target topics.
        
        Args:
            context: Input parameters. Example keys:
                - topics: Optional list of topics to compare against
        
        Returns:
            A list of gap objects with relevance scores.
        """
        if not self.sif_service:
            return unavailable_tool("sif", "SIF service is not initialized")
        try:
            intelligence = getattr(self.sif_service, "intelligence_service", None)
            if not intelligence:
                return unavailable_tool("sif", "SIF intelligence service is unavailable")
            topics = [str(item) for item in (context.get("topics") or []) if str(item).strip()]
            topic_hint = " ".join(topics) if topics else "content gaps"
            sif_query = self._sif_query(
                "content_strategist",
                hints=[topic_hint],
                fallback=topic_hint,
            )
            results = self._run_async_tool(
                self.sif_search(
                    sif_query,
                    limit=int(context.get("limit") or 10),
                    trigger="semantic_gap_detector",
                )
            )
            items = [
                {"gap": str(row.get("text") or row.get("id") or ""), "relevance": row.get("score")}
                for row in results or []
            ]
            return tool_result("success" if items else "no_data", "sif", data=items, evidence=items[:5], confidence=0.7)
        except Exception as exc:
            return error_tool("sif", exc)

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
        try:
            analytics = self._run_async_tool(
                PlatformAnalyticsService().get_comprehensive_analytics(
                    self.user_id,
                    platforms=context.get("platforms"),
                    start_date=context.get("start_date"),
                    end_date=context.get("end_date"),
                )
            )
            data = {}
            for platform, value in (analytics or {}).items():
                data[platform] = getattr(value, "metrics", {}) or {}
            return tool_result("success" if data else "no_data", "analytics", data=data, evidence=list(data.keys()), confidence=0.85)
        except Exception as exc:
            return error_tool("analytics", exc)

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose strategic tasks based on user onboarding context.
        Derives content pillars, industry, and competitor info to
        generate personalized daily content suggestions.
        """
        self._remember_grounding(context)
        default_proposals = []

        onboarding = context.get("onboarding_data", {})
        if not isinstance(onboarding, dict):
            return default_proposals

        # Extract user profile hints from onboarding data
        industry = ""
        content_pillars = []
        competitor_domains = []
        try:
            # P4.1: Read from integrated data keys
            # Industry from website_analysis or research_preferences
            website_analysis = onboarding.get("website_analysis") or {}
            research_prefs = onboarding.get("research_preferences") or {}
            target = research_prefs.get("target_audience") or website_analysis.get("target_audience") or {}
            if isinstance(target, dict):
                industry = str(target.get("industry_focus") or target.get("industry") or "")

            # Content pillars from multiple sources
            style_analysis = website_analysis.get("style_analysis") or {}
            strategy_insights = style_analysis.get("content_strategy_insights") or {}
            sitemap_analysis = style_analysis.get("sitemap_analysis") or {}
            content_pillars = (
                strategy_insights.get("content_pillars")
                or sitemap_analysis.get("content_pillars")
                or research_prefs.get("content_pillars")
                or []
            )

            # Competitor domains from competitor_analysis
            competitor_analysis = onboarding.get("competitor_analysis") or []
            if isinstance(competitor_analysis, list):
                competitor_domains = [
                    c.get("domain") or c.get("url") or c.get("website")
                    for c in competitor_analysis[:10]
                    if isinstance(c, dict) and c.get("domain")
                ]
        except Exception:
            pass

        # Task 1: Create content for a key pillar (generate)
        if content_pillars:
            pillar_topic = content_pillars[0] if isinstance(content_pillars[0], str) else (
                content_pillars[0].get("topic") or content_pillars[0].get("name") or "your audience"
            )
            default_proposals.append(TaskProposal(
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
            default_proposals.append(TaskProposal(
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
            default_proposals.append(TaskProposal(
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

        # NOTE: the old unconditional "Quick content performance audit"
        # filler was removed per the honest-absence policy — this agent now
        # declines or returns empty when neither pillars, competitors, nor
        # LLM synthesis provide anything grounded.

        return await self._synthesize_task_proposals(
            context,
            default_proposals,
            instructions=(
                "Propose the next content actions for this brand based on its content pillars, "
                "competitors, and target audience. Each task must have a pillar_id from "
                "[plan, generate, publish, analyze, engage, remarket] and an action_url "
                "pointing to a relevant dashboard (e.g. /blog-writer, /content-planning-dashboard, /seo-dashboard)."
            ),
        )
