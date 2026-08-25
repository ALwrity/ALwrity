"""
Link Graph Agent implementation.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.txtai_service import TxtaiIntelligenceService

class LinkGraphAgent(SIFBaseAgent):
    """Agent for internal linking and graph optimization using real SIF index data."""

    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="link_graph_expert", **kwargs)

    async def analyze_graph(self) -> Dict[str, Any]:
        """
        Analyze the knowledge graph structure by searching the SIF index.
        Returns semantic clusters and content grouping insights.
        """
        if not self.intelligence.is_initialized():
            return {"node_count": 0, "edge_count": 0, "clusters": [], "error": "SIF index not initialized"}

        try:
            # Use clustering to identify content groups
            cluster_indices = await self.intelligence.cluster(min_score=0.5)
            cluster_count = len(cluster_indices) if cluster_indices else 0

            # Search for content hub candidates
            hub_results = await self.intelligence.search("pillar core foundation guide overview", limit=10)

            # Search for orphan candidates (specific niche content not linking to pillars)
            orphan_results = await self.intelligence.search("specific detailed deep dive", limit=10)

            return {
                "node_count": len(hub_results) + len(orphan_results),
                "cluster_count": cluster_count,
                "content_hubs": [
                    {"id": r.get("id", ""), "title": r.get("text", "")[:100]}
                    for r in hub_results
                ],
                "orphaned_content": [
                    {"id": r.get("id", ""), "snippet": r.get("text", "")[:100]}
                    for r in orphan_results
                ],
                "analysis_timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Graph analysis failed: {e}")
            return {"node_count": 0, "edge_count": 0, "clusters": [], "error": str(e)}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose internal linking tasks based on real SIF cluster and search data.
        """
        proposals = []
        cluster_count = 0
        hub_count = 0

        if self.intelligence.is_initialized():
            try:
                cluster_indices = await self.intelligence.cluster(min_score=0.5)
                cluster_count = len(cluster_indices) if cluster_indices else 0

                hub_results = await self.intelligence.search("pillar guide", limit=5)
                hub_count = len(hub_results)
            except Exception as e:
                logger.debug(f"[LinkGraphAgent] SIF analysis failed: {e}")

        if cluster_count > 0:
            proposals.append(TaskProposal(
                title="Strengthen Internal Links",
                description=f"SIF detected {cluster_count} content clusters that need cross-linking.",
                pillar_id="distribute",
                priority="medium",
                estimated_time=20,
                source_agent="LinkGraphAgent",
                reasoning="Connecting content clusters improves SEO and user navigation.",
                action_type="navigate",
                action_url="/content-planning-dashboard",
                synthesis_mode="data_derived",
            ))
        else:
            proposals.append(TaskProposal(
                title="Plan Content Clusters",
                description="No content clusters found. Create pillar pages to build a linked content structure.",
                pillar_id="distribute",
                priority="medium",
                estimated_time=30,
                source_agent="LinkGraphAgent",
                reasoning="Structured content clusters drive organic growth.",
                action_type="navigate",
                action_url="/content-planning-dashboard",
                synthesis_mode="data_derived",
            ))

        return proposals
