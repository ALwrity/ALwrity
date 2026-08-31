"""Trend Surfer Agent (Tavily-backed).

Surfaces trending topics for the user's industry/pillars via Tavily news search
and distills them into content angles with a single LLM synthesis call.
"""
import re
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from services.intelligence.agents.specialized_agents import SIFBaseAgent
from services.intelligence.txtai_service import TxtaiIntelligenceService
from services.research.trends import (
    TavilyTrendProvider,
    TrendItem,
    TrendPlatform,
    synthesize_trends,
)


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")


def _momentum_to_urgency(momentum: Optional[str]) -> str:
    value = str(momentum or "").strip().lower()
    if value == "rising":
        return "high"
    if value == "declining":
        return "low"
    return "medium"


def _momentum_to_impact(momentum: Optional[str]) -> float:
    value = str(momentum or "").strip().lower()
    if value == "rising":
        return 0.8
    if value == "declining":
        return 0.3
    return 0.5


def build_trend_opportunities(
    report: Dict[str, Any],
    items: List[TrendItem],
    now: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Map a synthesized trend report into the opportunity shape consumed downstream."""
    now = now or datetime.utcnow().isoformat()
    opportunities: List[Dict[str, Any]] = []
    for trend in report.get("trends") or []:
        topic = str((trend or {}).get("topic") or "").strip()
        if not topic:
            continue
        momentum = str((trend or {}).get("momentum") or "").strip().lower()
        opportunities.append({
            "trend_id": f"trend_{_slug(topic)}",
            "topic": topic,
            "headline": topic,
            "source": "tavily",
            "urgency": _momentum_to_urgency(momentum),
            "impact_score": _momentum_to_impact(momentum),
            "current_coverage": 0.0,
            "recommendation": "Create new content",
            "suggested_angle": str((trend or {}).get("suggested_angle") or ""),
            "why_it_matters": str((trend or {}).get("why_it_matters") or ""),
            "detected_at": now,
        })
    return opportunities


class TrendSurferAgent(SIFBaseAgent):
    """Agent for identifying and capitalizing on emerging market trends via Tavily."""

    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="trend_surfer", **kwargs)
        self.user_id = user_id
        self.trend_provider = TavilyTrendProvider()

    async def surf_trends(self) -> List[Dict[str, Any]]:
        """Surface trending topics and propose content angles."""
        try:
            industry, keywords = self._trend_context()
            items = await self.trend_provider.fetch_trends(
                TrendPlatform.WEB,
                industry=industry,
                keywords=keywords,
                user_id=self.user_id,
            )
            if not items:
                logger.info(f"[{self.__class__.__name__}] No trends surfaced")
                return []

            report = await synthesize_trends(
                items,
                TrendPlatform.WEB,
                user_id=self.user_id,
                focus="content angles for the brand's pillars and audience",
            )
            opportunities = build_trend_opportunities(report, items)
            logger.info(
                f"[{self.__class__.__name__}] Surfed {len(opportunities)} trend opportunities"
            )
            return opportunities
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Trend surfing failed: {e}")
            logger.error(f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}")
            return []

    def _trend_context(self) -> Tuple[str, List[str]]:
        ctx: Dict[str, Any] = {}
        try:
            ctx = self._load_prompt_context() or {}
        except Exception:
            pass
        industry = str(ctx.get("industry") or "").strip()
        pillars = ctx.get("content_pillars") or ""
        if isinstance(pillars, str):
            keywords = [p.strip() for p in pillars.split(",") if p.strip()]
        else:
            keywords = [str(p).strip() for p in (pillars or []) if str(p).strip()]
        return industry, keywords
