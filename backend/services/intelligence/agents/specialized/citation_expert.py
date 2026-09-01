"""
Citation Expert Agent implementation.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from loguru import logger
from .base import SIFBaseAgent
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.txtai_service import TxtaiIntelligenceService

class CitationExpert(SIFBaseAgent):
    """Agent for fact-checking and source management using the SIF index."""

    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="citation_expert", **kwargs)

    async def verify_citations(self, content: str) -> Dict[str, Any]:
        """
        Verify claims in content against the SIF index.
        Searches for supporting or refuting evidence for each extracted claim.
        """
        if not self.intelligence.is_initialized():
            return {
                "verified_claims": [],
                "unverified_claims": [],
                "missing_citations": [],
                "error": "SIF index not initialized"
            }

        try:
            # Extract potential claim sentences from content
            sentences = [s.strip() for s in content.replace("\n", " ").split(".") if len(s.strip()) > 40]
            claim_candidates = sentences[:10]

            verified = []
            unverified = []

            for claim in claim_candidates:
                results = await self.intelligence.search(claim, limit=3)
                if results and any(r.get("score", 0) > 0.7 for r in results):
                    verified.append({
                        "claim": claim[:200],
                        "supporting_sources": [
                            {"url": r.get("id", ""), "score": r.get("score", 0)}
                            for r in results if r.get("score", 0) > 0.7
                        ]
                    })
                else:
                    unverified.append({"claim": claim[:200], "sources_found": len(results)})

            return {
                "verified_claims": verified,
                "unverified_claims": unverified,
                "missing_citations": [c["claim"] for c in unverified],
                "analysis_timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Citation verification failed: {e}")
            return {
                "verified_claims": [],
                "unverified_claims": [],
                "missing_citations": [],
                "error": str(e)
            }

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose fact-checking tasks based on SIF index coverage.
        """
        self._remember_grounding(context)
        proposals = []
        indexed_count = 0

        if self.intelligence.is_initialized():
            try:
                stats_query = self._sif_query(
                    "citation_expert",
                    hints=["statistics data research study"],
                    fallback="statistics data research study",
                )
                results = await self.sif_search(stats_query, limit=5, trigger="citation_stats")
                indexed_count = len(results)
            except Exception as e:
                logger.debug(f"[CitationExpert] SIF search failed: {e}")

        if indexed_count > 0:
            proposals.append(TaskProposal(
                title="Verify Data Claims",
                description=f"SIF found {indexed_count} reference pages. Check recent drafts for unsupported statistics.",
                pillar_id="create",
                priority="medium",
                estimated_time=20,
                source_agent="CitationExpert",
                reasoning="Verified sources build audience trust and SEO authority.",
                action_type="navigate",
                action_url="/content-planning-dashboard",
                synthesis_mode="data_derived",
            ))
        else:
            proposals.append(TaskProposal(
                title="Add Source Citations",
                description="Index authoritative sources in SIF to enable automated fact-checking.",
                pillar_id="create",
                priority="low",
                estimated_time=15,
                source_agent="CitationExpert",
                reasoning="Citing authoritative sources improves content credibility.",
                action_type="navigate",
                action_url="/content-planning-dashboard",
                synthesis_mode="data_derived",
            ))

        return proposals
