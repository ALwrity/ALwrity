"""
Content Gap Radar Agent

Scores and prioritizes content opportunities by combining SIF semantic gap analysis,
SERP ranking presence (Google CSE), competitor content deep-dive (Exa), and trend
momentum into a single ROI score per topic.

Phase 3 of the Content Gap Radar feature.
"""

import traceback
from typing import List, Dict, Any, Optional
from loguru import logger

from services.intelligence.agents.specialized import SIFBaseAgent
from services.intelligence.agents.specialized.strategy_architect import StrategyArchitectAgent
from services.intelligence.agents.trend_surfer_agent import TrendSurferAgent
from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.txtai_service import TxtaiIntelligenceService
from services.seo_tools.serp_gap_service import SerpGapService
from services.seo_tools.competitor_content_service import CompetitorContentService


class ContentGapRadarAgent(SIFBaseAgent):
    """
    Agent that scores and prioritizes content opportunities by combining
    SIF semantic gap analysis, SERP ranking presence, Exa competitor content,
    and trend momentum into a single ROI score.
    """

    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="content_gap_radar", **kwargs)
        self.user_id = user_id
        self.serp_service = SerpGapService()
        self.competitor_content_service = CompetitorContentService()
        self.strategy_architect = StrategyArchitectAgent(intelligence_service, user_id)

    async def analyze(
        self,
        competitor_domains: List[str],
        competitor_indices: Optional[List[Any]] = None,
        topics: Optional[List[str]] = None,
        bypass_cache: bool = False,
    ) -> Dict[str, Any]:
        """
        Full content gap radar pipeline.

        1. Get topic-level gaps from SIF semantic analysis
        2. Get SERP ranking data per topic
        3. Get Exa competitor content for top topics
        4. Get trend momentum data
        5. Score each topic with ROI formula
        6. Return prioritized results

        Args:
            competitor_domains: Known competitor domains
            competitor_indices: SIF index positions for competitor docs
            topics: Optional explicit topic list (derived from SIF if omitted)
            bypass_cache: Force fresh API calls

        Returns:
            Dict with scored gaps list and summary.
        """
        self._log_agent_operation(
            "Running content gap radar",
            competitor_count=len(competitor_domains),
            topics_provided=bool(topics),
        )

        try:
            sif_gaps = []

            # Step 1: Derive topics from SIF semantic gaps if not provided
            if not topics:
                sif_gaps = await self.strategy_architect.find_semantic_gaps(
                    competitor_indices or []
                )
                topics = [g["topic"] for g in sif_gaps[:12]]
                logger.info(
                    f"[{self.__class__.__name__}] Derived {len(topics)} topics from SIF gaps"
                )

            if not topics:
                logger.info(f"[{self.__class__.__name__}] No topics to analyze")
                return {"gaps": [], "summary": {}}

            # If we got sif_gaps externally but topics were provided, fetch SIF data anyway
            if not sif_gaps:
                try:
                    sif_gaps = await self.strategy_architect.find_semantic_gaps(
                        competitor_indices or []
                    )
                except Exception as e:
                    logger.warning(
                        f"[{self.__class__.__name__}] SIF gap fetch failed (non-fatal): {e}"
                    )
                    sif_gaps = []

            # Build lookup maps for cross-referencing
            sif_map = {g["topic"]: g for g in sif_gaps}

            # Step 2: SERP gap analysis
            serp_data = await self.serp_service.analyze_topic_gaps(
                topics, competitor_domains, bypass_cache=bypass_cache
            )
            serp_map = {}
            for g in serp_data.get("gaps", []):
                serp_map[g["topic"]] = g

            # Step 3: Exa deep-dive (top 6 topics — paid API)
            exa_data = await self.competitor_content_service.deep_dive(
                topics[:6], competitor_domains, bypass_cache=bypass_cache
            )
            exa_map = {}
            for r in exa_data.get("results", []):
                exa_map[r["topic"]] = r

            # Step 4: Trend momentum data
            trend_surfer = TrendSurferAgent(
                self.intelligence, self.user_id
            )
            trend_signals = await trend_surfer.surf_trends()

            # Step 5: Score each topic
            scored = []
            for topic in topics:
                scored.append(
                    self._score_topic(
                        topic=topic,
                        sif_map=sif_map,
                        serp_map=serp_map,
                        exa_map=exa_map,
                        trend_signals=trend_signals,
                    )
                )

            scored.sort(key=lambda x: x["roi_score"], reverse=True)

            # Step 6: Summary
            high = [g for g in scored if g["priority"] == "high"]
            medium = [g for g in scored if g["priority"] == "medium"]
            low = [g for g in scored if g["priority"] == "low"]

            logger.info(
                f"[{self.__class__.__name__}] Scored {len(scored)} gaps: "
                f"{len(high)} high, {len(medium)} medium, {len(low)} low"
            )

            return {
                "gaps": scored,
                "summary": {
                    "total_topics_analyzed": len(topics),
                    "high_priority": len(high),
                    "medium_priority": len(medium),
                    "low_priority": len(low),
                },
            }

        except Exception as e:
            logger.error(
                f"[{self.__class__.__name__}] Content gap radar failed: {e}"
            )
            logger.error(
                f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}"
            )
            return {"gaps": [], "summary": {}, "error": str(e)}

    async def propose_daily_tasks(self, context: Dict[str, Any]) -> List[TaskProposal]:
        """
        Propose high-ROI content tasks from gap radar analysis.
        Integrates with Today's Workflow agent committee polling.
        """
        proposals = []

        onboarding = context.get("onboarding_data", {})
        competitor_focus = onboarding.get("competitor_focus", {})
        competitor_domains = competitor_focus.get("top_competitor_domains", [])

        if not competitor_domains:
            logger.info(f"[{self.__class__.__name__}] No competitor domains in context, skipping")
            return proposals

        try:
            result = await self.analyze(
                competitor_domains=competitor_domains,
                competitor_indices=[],
            )
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] propose_daily_tasks failed: {e}")
            return proposals

        gaps = result.get("gaps", [])
        scored = [g for g in gaps if g["priority"] in ("high", "medium")]
        scored.sort(key=lambda x: x["roi_score"], reverse=True)

        for gap in scored[:3]:
            pillar_id = self._action_to_pillar(gap["recommended_action"])
            action_url = (
                "/blog-writer"
                if pillar_id == "generate"
                else "/seo-dashboard#content-gap-radar"
            )
            proposals.append(TaskProposal(
                title=f"Write about: {gap['topic']}",
                description=gap["recommended_action"],
                pillar_id=pillar_id,
                priority=gap["priority"],
                estimated_time=60 if pillar_id == "generate" else 30,
                source_agent="ContentGapRadarAgent",
                reasoning=(
                    f"Content gap with {gap['scoring']['gap_size']:.0%} gap size, "
                    f"{gap['scoring']['volume']:.0%} volume, "
                    f"{gap['scoring']['trend']:.0%} trend momentum, "
                    f"ROI {gap['roi_score']:.0%}"
                ),
                action_type="navigate",
                action_url=action_url,
                context_data={"gap": gap},
                synthesis_mode="data_derived",
            ))

        return proposals

    @staticmethod
    def _action_to_pillar(recommended_action: str) -> str:
        action_lower = recommended_action.lower()
        if "optimize" in action_lower:
            return "analyze"
        return "generate"

    def _score_topic(
        self,
        topic: str,
        sif_map: Dict[str, Any],
        serp_map: Dict[str, Any],
        exa_map: Dict[str, Any],
        trend_signals: List[Any],
    ) -> Dict[str, Any]:
        """Score a single topic with the ROI formula."""
        # gap_size: from SIF coverage_delta
        sif = sif_map.get(topic, {})
        gap_size = sif.get("coverage_delta", 0.5)

        # volume: from SERP gap — competitors ranking for this topic
        serp = serp_map.get(topic, {})
        comp_count = serp.get("competitor_count", 0)
        total_domains = serp.get("total_domains_checked", 1)
        volume = min(comp_count / max(total_domains, 1), 1.0)

        # trend: match topic against TrendSurfer signals
        trend_score = self._match_trend_score(topic, trend_signals)

        # intent: classify topic commercial value
        intent = self._classify_intent(topic)

        # competition: Exa content depth as penalty
        exa = exa_map.get(topic, {})
        content_count = exa.get("total_results", 0)
        competition = min(content_count / 10.0, 1.0)

        # ROI = (gap_size × volume × trend × intent) × (1 - 0.3 × competition)
        base_roi = gap_size * volume * trend_score * intent
        roi = base_roi * (1 - 0.3 * competition)

        # Priority thresholds
        if roi >= 0.6:
            priority = "high"
        elif roi >= 0.3:
            priority = "medium"
        else:
            priority = "low"

        # Recommended action based on scoring profile
        action = self._recommend_action(gap_size, competition, intent)

        return {
            "topic": topic,
            "roi_score": round(roi, 3),
            "priority": priority,
            "recommended_action": action,
            "scoring": {
                "gap_size": round(gap_size, 3),
                "volume": round(volume, 3),
                "trend": round(trend_score, 3),
                "intent": round(intent, 3),
                "competition": round(competition, 3),
            },
            "sif_gap": sif if sif else None,
            "serp_evidence": {
                "competitors_found": serp.get("competitors_found", []),
                "competitor_count": comp_count,
                "domains_with_content": serp.get("domains_with_content", []),
            } if serp else None,
            "competitor_content": exa if exa else None,
        }

    def _match_trend_score(self, topic: str, signals: List[Dict[str, Any]]) -> float:
        if not signals:
            return 0.5

        topic_lower = topic.lower()
        topic_words = set(topic_lower.split())

        best_score = 0.0
        for signal in signals:
            impact = signal.get("impact_score", 0.5)
            text_fields = " ".join(filter(None, [
                signal.get("topic", ""),
                signal.get("headline", ""),
                signal.get("suggested_angle", ""),
            ]))
            text_lower = text_fields.lower()

            if topic_lower in text_lower:
                best_score = max(best_score, impact)

            text_words = set(text_lower.split())
            overlap = len(topic_words & text_words)
            if overlap > 0:
                word_score = (overlap / max(len(topic_words), 1)) * impact
                best_score = max(best_score, word_score)

        return max(best_score, 0.5)

    def _classify_intent(self, topic: str) -> float:
        """
        Classify topic intent using LLM with keyword fallback.
        Returns intent score 0.0-1.0.
        """
        topic_lower = topic.lower()

        # Keyword-based heuristics
        commercial_words = [
            "best", "top", "review", "vs", "comparison", "alternative",
            "vs.", "versus", "pricing", "cost", "price", "cheap",
            "affordable", "discount", "coupon", "deal", "buy",
        ]
        transactional_words = [
            "buy", "purchase", "order", "subscribe", "sign up",
            "download", "get started", "free trial", "demo",
        ]

        has_commercial = any(w in topic_lower for w in commercial_words)
        has_transactional = any(w in topic_lower for w in transactional_words)

        if has_transactional:
            return 0.9
        if has_commercial:
            return 0.7
        return 0.4  # Informational default

    def _recommend_action(
        self, gap_size: float, competition: float, intent: float
    ) -> str:
        """Generate a recommended action based on scoring profile."""
        if gap_size > 0.7 and competition < 0.3:
            return "Create comprehensive pillar page — large gap, low competition"
        elif gap_size > 0.5 and intent > 0.6:
            return "Create high-conversion content — significant gap, strong intent"
        elif competition > 0.7:
            return "Create differentiated content — high competition requires unique angle"
        elif gap_size < 0.3:
            return "Optimize existing content — incremental gap, update current pages"
        else:
            return "Create targeted blog post — moderate opportunity"

    async def generate_content_brief(
        self,
        topic: str,
        recommended_action: str,
        scoring: Optional[Dict[str, float]] = None,
        serp_evidence: Optional[Dict[str, Any]] = None,
        sif_gap: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generate a structured content brief from a gap item.
        Uses LLM to produce title options, outline sections, target keywords,
        and a writing angle. Falls back to template-based generation on LLM failure.
        """
        gap_size = (scoring or {}).get("gap_size", 0.5)
        volume = (scoring or {}).get("volume", 0.5)
        trend = (scoring or {}).get("trend", 0.5)
        intent = (scoring or {}).get("intent", 0.5)
        competition = (scoring or {}).get("competition", 0.5)
        word_count = 800 if competition > 0.7 else 1200 if gap_size > 0.5 else 600

        serp_context = ""
        if serp_evidence and serp_evidence.get("competitors_found"):
            snippets = [
                f"- {c.get('title','')}: {c.get('snippet','')[:100]}"
                for c in serp_evidence["competitors_found"][:3]
            ]
            serp_context = "Competitor content already ranking:\n" + "\n".join(snippets)

        sif_context = ""
        if sif_gap:
            sif_context = (
                f"SIF coverage delta: {sif_gap.get('coverage_delta', 0):.2%}, "
                f"confidence: {sif_gap.get('confidence', 0):.2%}"
            )

        prompt = f"""You are a senior content strategist. Create a detailed content brief for the topic below.

TOPIC: {topic}
RECOMMENDED ACTION: {recommended_action}
{serp_context}
{sif_context}

Scoring profile:
- Gap size: {gap_size:.0%}
- Search volume: {volume:.0%}
- Trend momentum: {trend:.0%}
- Intent score: {intent:.0%}
- Competition level: {competition:.0%}
- Target word count: {word_count}

Return a JSON object with these exact keys:
{{
  "titles": ["Title option 1", "Title option 2", "Title option 3"],
  "outline": [
    {{"heading": "Section heading", "key_points": ["point 1", "point 2", "point 3"]}}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "angle": "A single paragraph describing the strategic writing angle",
  "word_count": {word_count}
}}

Generate 4-6 outline sections. Only return valid JSON, no other text."""

        try:
            response = await self._generate_llm_response(prompt)
            import json as _json
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                brief = _json.loads(response[start:end])
            else:
                raise ValueError("No JSON found in LLM response")
        except Exception as e:
            logger.warning(
                f"[{self.__class__.__name__}] LLM brief generation failed, using template: {e}"
            )
            brief = {
                "titles": [
                    f"The Ultimate Guide to {topic}",
                    f"{topic}: Strategies That Actually Work",
                    f"Why {topic} Matters More Than Ever",
                ],
                "outline": [
                    {"heading": f"Introduction to {topic}", "key_points": ["Context and importance", "What this guide covers"]},
                    {"heading": "Why This Matters", "key_points": ["Current landscape", "Key challenges and opportunities"]},
                    {"heading": "Key Strategies", "key_points": ["Strategy 1 with examples", "Strategy 2 with implementation tips", "Strategy 3 for advanced practitioners"]},
                    {"heading": "Common Pitfalls to Avoid", "key_points": ["Mistake 1 and how to avoid it", "Mistake 2 and how to avoid it"]},
                    {"heading": "Measuring Success", "key_points": ["Key metrics to track", "Tools and methods for measurement"]},
                    {"heading": "Conclusion & Next Steps", "key_points": ["Summary of key takeaways", "Actionable next steps"]},
                ],
                "keywords": [topic] + [topic.split()[-1]] if len(topic.split()) > 1 else [topic, "guide", "strategy"],
                "angle": f"Create comprehensive, actionable content about {topic} that fills the gap identified in competitor analysis. Focus on providing unique insights and practical implementation guidance.",
                "word_count": word_count,
            }

        return {
            "topic": topic,
            "recommended_action": recommended_action,
            "brief": brief,
            "scoring": scoring,
        }
