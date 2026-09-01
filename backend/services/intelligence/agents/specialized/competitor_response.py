"""
Competitor Response Agent implementation.
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


class CompetitorResponseAgent(BaseALwrityAgent):
    """
    Agent responsible for monitoring competitors and generating counter-strategies.
    Uses SIF index for real competitive data when available.
    """
    
    def __init__(self, user_id: str, shared_llm_name: str, llm: Any = None, **kwargs):
        super().__init__(user_id, "competitor_analyst", shared_llm_name, llm, **kwargs)
        
        self.sif_service = None
        if SIF_AVAILABLE and has_onboarding_session(user_id):
            try:
                self.sif_service = SIFIntegrationService(user_id)
            except Exception as e:
                logger.warning(f"Failed to initialize SIF service for CompetitorResponseAgent: {e}")
        elif SIF_AVAILABLE:
            logger.debug(
                "Skipping SIF service initialization for CompetitorResponseAgent user {}: no onboarding session",
                user_id,
            )

    def _create_txtai_agent(self):
        """Create a specialized txtai Agent for competitor analysis."""
        if not TXTAI_AVAILABLE or Agent is None:
            return None
            
        _llm_for_agent = getattr(self.llm, "llm", self.llm)
        return Agent(
            tools=[
                {
                    "name": "competitor_monitor",
                    "description": "Returns competitor monitoring status via SIF",
                    "target": self._competitor_monitor_tool
                },
                {
                    "name": "threat_analyzer",
                    "description": "Returns threat analysis availability and SIF status",
                    "target": self._threat_analyzer_tool
                }
            ],
            llm=_llm_for_agent,
            max_iterations=5,

        )
    
    # Tool Implementations (sync — called by txtai Agent)
    
    def _competitor_monitor_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Competitor monitoring tool. Returns SIF availability and directs to async method.

        Args:
            context: Input parameters for the tool. Example keys:
                - competitor_url: Optional URL of the competitor to monitor

        Returns:
            A dictionary describing SIF availability or how to fetch detailed data.
        """
        competitor_url = context.get("competitor_url", "any")
        if not self.sif_service:
            return unavailable_tool("sif", "SIF not initialized")
        return unavailable_tool("sif", "Use async analyze_competitors() for detailed competitor data")

    def _threat_analyzer_tool(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Threat analysis tool. Returns SIF status.

        Args:
            context: Input parameters for the tool. Example keys:
                - focus_area: Optional focus area for the threat scan

        Returns:
            A dictionary describing SIF availability or how to fetch threat data.
        """
        focus = context.get("focus_area", "general")
        if not self.sif_service:
            return unavailable_tool("sif", "SIF not initialized")
        return unavailable_tool("sif", f"Use async analyze_competitors(focus_area='{focus}') for threat data")

    # Async entry points
    
    async def analyze_competitors(self, website_url: str = "", focus_area: str = "general") -> Dict[str, Any]:
        """
        Search the SIF index for competitor intelligence and return real matches.
        """
        if not self.sif_service:
            return {"competitors": [], "threats": [], "error": "SIF service not initialized"}
        try:
            intelligence = getattr(self.sif_service, "intelligence_service", None)
            if not intelligence:
                return {"competitors": [], "threats": [], "error": "Intelligence service unavailable"}

            query = f"competitor {focus_area} {website_url}"
            results = await intelligence.search(query, limit=10)
            return {
                "competitors": [{"url": r.get("id", ""), "snippet": r.get("text", "")[:200]} for r in results],
                "threats": [],
                "pages_analyzed": len(results),
                "focus_area": focus_area,
                "analysis_timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"[CompetitorResponseAgent] Analysis failed: {e}")
            return {"competitors": [], "threats": [], "error": str(e)}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose tasks based on competitive intel from the SIF index.
        """
        default_proposals = []
        competitor_count = 0
        focus_area = context.get("focus_area", "content strategy")

        if self.sif_service:
            try:
                intelligence = getattr(self.sif_service, "intelligence_service", None)
                if intelligence:
                    results = await intelligence.search(f"competitor {focus_area}", limit=5)
                    competitor_count = len(results)
            except Exception as e:
                logger.debug(f"[CompetitorResponseAgent] SIF competitor search failed: {e}")

        if competitor_count > 0:
            default_proposals.append(TaskProposal(
                title="Review Competitor Content",
                description=f"SIF found {competitor_count} competitor pages. Review for gap opportunities.",
                pillar_id="analyze",
                priority="high",
                estimated_time=45,
                source_agent="CompetitorResponseAgent",
                reasoning="SIF-detected competitor activity presents content gap opportunities.",
                action_type="navigate",
                action_url="/seo-dashboard"
            ))
        else:
            default_proposals.append(TaskProposal(
                title="Research Competitor Topics",
                description="Search for competitor content in your niche to identify coverage gaps.",
                pillar_id="analyze",
                priority="medium",
                estimated_time=30,
                source_agent="CompetitorResponseAgent",
                reasoning="Understanding competitor positioning improves content strategy.",
                action_type="navigate",
                action_url="/seo-dashboard"
            ))

        return await self._synthesize_task_proposals(
            context,
            default_proposals,
            instructions=(
                "Propose the next competitor-response actions for this brand based on its tracked "
                "competitors, content pillars, and target audience. Each task must have a pillar_id "
                "from [plan, generate, publish, analyze, engage, remarket] and an action_url "
                "pointing to /seo-dashboard."
            ),
        )
