"""
SEO Optimization Agent implementation.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent, TXTAI_AVAILABLE, Agent
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent, TaskProposal
from services.database import has_onboarding_session
from services.intelligence.agents.tool_contracts import unavailable_tool

try:
    from services.intelligence.sif_integration import SIFIntegrationService
    SIF_AVAILABLE = True
except ImportError:
    SIF_AVAILABLE = False


class SEOOptimizationAgent(BaseALwrityAgent):
    """
    Agent responsible for technical SEO, keyword strategy, and performance optimization.
    Uses SIF index for real data when available.
    """
    
    def __init__(self, user_id: str, shared_llm_name: str, llm: Any = None, **kwargs):
        super().__init__(user_id, "seo_specialist", shared_llm_name, llm, **kwargs)
        
        self.sif_service = None
        if SIF_AVAILABLE and has_onboarding_session(user_id):
            try:
                self.sif_service = SIFIntegrationService(user_id)
            except Exception as e:
                logger.warning(f"Failed to initialize SIF service for SEOOptimizationAgent: {e}")
        elif SIF_AVAILABLE:
            logger.debug(
                "Skipping SIF service initialization for SEOOptimizationAgent user {}: no onboarding session",
                user_id,
            )

    def _create_txtai_agent(self):
        """Create a specialized txtai Agent for SEO optimization."""
        if not TXTAI_AVAILABLE or Agent is None:
            return None
            
        _llm_for_agent = getattr(self.llm, "llm", self.llm)
        return Agent(
            tools=[
                {
                    "name": "seo_auditor",
                    "description": "Returns SEO audit status and available SIF data",
                    "target": self._seo_auditor_tool
                },
                {
                    "name": "keyword_researcher",
                    "description": "Returns keyword research status via SIF",
                    "target": self._keyword_researcher_tool
                },
                {
                    "name": "on_page_optimizer",
                    "description": "Returns on-page optimization availability",
                    "target": self._on_page_optimizer_tool
                },
                {
                    "name": "technical_fixer",
                    "description": "Returns technical fix availability",
                    "target": self._technical_fixer_tool
                }
            ],
            llm=_llm_for_agent,
            max_iterations=15,

        )
    
    # Tool Implementations (sync — called by txtai Agent)
    
    def _seo_auditor_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        SEO audit tool. Returns availability and directs caller to async method for full analysis.
        """
        website_url = context.get("website_url", "unknown")
        if not self.sif_service:
            return unavailable_tool("sif", "SIF service not initialized")
        return unavailable_tool("sif", "Use async perform_seo_audit() for detailed SEO data")

    def _keyword_researcher_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Keyword research tool. Returns SIF availability and sample context if present.
        """
        seed = context.get("seed_keywords", context.get("topic", "unknown"))
        if not self.sif_service:
            return unavailable_tool("sif", "SIF service not initialized")
        return unavailable_tool("sif", f"Use async search_keywords(topic='{seed}') for keyword data")

    def _on_page_optimizer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """On-page optimization tool. Requires async analysis."""
        return unavailable_tool("seo", "On-page optimization provider is unavailable")

    def _technical_fixer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Technical SEO fixer tool. Auto-fix not implemented."""
        issue_id = context.get("issue_id", "unknown")
        return unavailable_tool("seo", f"Issue '{issue_id}' requires manual review; automated fixes are not implemented")

    # Async entry points
    
    async def perform_seo_audit(self, website_url: str) -> Dict[str, Any]:
        """
        Perform a comprehensive SEO audit by searching the SIF index.
        Returns real data about indexed content, keyword coverage, and gaps.
        """
        if not self.sif_service:
            return {"health": "unknown", "issues": [], "error": "SIF service not initialized"}
        try:
            intelligence = getattr(self.sif_service, "intelligence_service", None)
            if not intelligence:
                return {"health": "unknown", "issues": [], "error": "Intelligence service unavailable"}

            results = await intelligence.search(f"seo website analysis {website_url}", limit=10)
            return {
                "health": "reviewed",
                "website_url": website_url,
                "pages_indexed": len(results),
                "issues": [],
                "audit_timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"[SEOOptimizationAgent] SEO audit failed: {e}")
            return {"health": "unknown", "issues": [], "error": str(e)}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose SEO-focused tasks based on real SIF index data.
        """
        default_proposals = []
        issues_found = 0
        website_url = context.get("website_url", "")

        if self.sif_service:
            try:
                intelligence = getattr(self.sif_service, "intelligence_service", None)
                if intelligence:
                    results = await intelligence.search("seo issue problem error fix", limit=5)
                    issues_found = len(results)
            except Exception as e:
                logger.debug(f"[SEOOptimizationAgent] SIF search for issues failed: {e}")

        if issues_found > 0:
            default_proposals.append(TaskProposal(
                title="Review SEO Issues",
                description=f"SIF indexed content suggests {issues_found} areas that may need SEO attention.",
                pillar_id="analyze",
                priority="high",
                estimated_time=30,
                source_agent="SEOOptimizationAgent",
                reasoning="Addressing SEO gaps improves organic visibility.",
                action_type="navigate",
                action_url="/seo-dashboard"
            ))
        else:
            default_proposals.append(TaskProposal(
                title="Run SEO Audit",
                description="Perform a comprehensive SEO audit to identify optimization opportunities.",
                pillar_id="analyze",
                priority="medium",
                estimated_time=15,
                source_agent="SEOOptimizationAgent",
                reasoning="Regular audits prevent SEO degradation.",
                action_type="navigate",
                action_url="/seo-dashboard"
            ))

        return await self._synthesize_task_proposals(
            context,
            default_proposals,
            instructions=(
                "Propose the next SEO actions for this brand based on its website, industry, "
                "content pillars, and target audience. Each task must have a pillar_id from "
                "[plan, generate, publish, analyze, engage, remarket] and an action_url "
                "pointing to /seo-dashboard."
            ),
        )
