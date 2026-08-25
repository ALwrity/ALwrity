"""
Trend Surfer Agent
Agent for identifying and capitalizing on emerging market trends.
"""

import traceback
from typing import List, Dict, Any, Optional
from loguru import logger

from services.intelligence.agents.specialized_agents import SIFBaseAgent
from services.intelligence.agents.market_signal_detector import MarketSignalDetector, MarketSignal, UrgencyLevel, SignalType, compute_signal_confidence
from services.intelligence.txtai_service import TxtaiIntelligenceService
from services.research.trends.google_trends_service import GoogleTrendsService

class TrendSurferAgent(SIFBaseAgent):
    """
    Agent for identifying and capitalizing on emerging market trends.
    "Surfs" the trends detected by MarketSignalDetector to propose timely content.
    """
    
    def __init__(self, intelligence_service: TxtaiIntelligenceService, user_id: str, **kwargs):
        super().__init__(intelligence_service, user_id, agent_type="trend_surfer", **kwargs)
        self.user_id = user_id
        self.signal_detector = MarketSignalDetector(user_id)
        self.trends_service = GoogleTrendsService()
        
    async def surf_trends(self) -> List[Dict[str, Any]]:
        """
        Identify high-potential trends and suggest content angles.
        Integrates real-time Google Trends data with MarketSignalDetector signals.
        """
        self._log_agent_operation("Surfing market trends")
        
        try:
            # 1. Get real-time trending searches from Google Trends
            realtime_trends = await self.trends_service.get_trending_searches(user_id=self.user_id)
            logger.info(f"[{self.__class__.__name__}] Found {len(realtime_trends)} real-time trends")

            # 2. Detect internal market signals (competitors, SERP, etc.)
            signals = await self.signal_detector.detect_market_signals()
            
            # 3. Analyze real-time trends and convert to signals if actionable
            trend_signals = await self._analyze_realtime_trends(realtime_trends)
            signals.extend(trend_signals)

            if not signals:
                logger.info(f"[{self.__class__.__name__}] No active market signals found")
                return []
                
            # Filter for actionable trends (High/Critical urgency or High impact)
            actionable_trends = [
                s for s in signals 
                if s.urgency_level.value in ['high', 'critical'] or s.impact_score > 0.7
            ]
            
            logger.info(f"[{self.__class__.__name__}] Found {len(actionable_trends)} actionable trends")
            
            opportunities = []
            for trend in actionable_trends:
                opp = await self._analyze_opportunity(trend)
                if opp:
                    opportunities.append(opp)
            
            return opportunities
            
        except Exception as e:
            logger.error(f"[{self.__class__.__name__}] Trend surfing failed: {e}")
            logger.error(f"[{self.__class__.__name__}] Full traceback: {traceback.format_exc()}")
            return []

    async def _analyze_realtime_trends(self, trends: List[str]) -> List[MarketSignal]:
        """
        Analyze raw trend keywords and convert actionable ones to MarketSignals.
        Uses pytrends (via GoogleTrendsService) to validate interest.
        """
        signals = []
        # Limit to top 5 for detailed analysis to avoid rate limits
        top_trends = trends[:5]
        
        for trend_kw in top_trends:
            try:
                # Get detailed data for the keyword
                trend_data = await self.trends_service.analyze_trends(
                    keywords=[trend_kw],
                    timeframe="now 7-d", # Last 7 days to see immediate trajectory
                    geo="US" # Default to US for now, could be user-configured
                )
                
                # Check if rising
                interest_over_time = trend_data.get("interest_over_time", [])
                if not interest_over_time:
                    continue
                    
                # Simple logic: is the last point higher than the average?
                values = [float(point.get(trend_kw, 0)) for point in interest_over_time if trend_kw in point]
                if not values:
                    continue
                    
                avg_interest = sum(values) / len(values)
                last_interest = values[-1]
                
                # Derive confidence from measurable trend factors instead of a
                # fixed constant: sample depth, momentum vs the flat baseline,
                # and data freshness (fetched live moments ago).
                if avg_interest > 0:
                    confidence_score, confidence_basis, is_estimate = compute_signal_confidence(
                        sample_count=len(values),
                        change_ratio=last_interest / avg_interest,  # threshold is 1.0 (flat trend)
                        data_age_hours=0.0,
                    )
                else:
                    confidence_score = None
                    is_estimate = True
                    confidence_basis = "Insufficient samples: zero-interest series"
                if confidence_score is None:
                    logger.info(f"Skipping trend signal for '{trend_kw}': {confidence_basis}")
                    continue
                
                # Calculate impact/urgency
                impact_score = min(last_interest / 100.0, 1.0) # Normalized
                urgency = UrgencyLevel.MEDIUM
                if last_interest > 80:
                    urgency = UrgencyLevel.CRITICAL
                elif last_interest > 50:
                    urgency = UrgencyLevel.HIGH
                
                # Create Signal
                signal = MarketSignal(
                    signal_id=f"trend_{trend_kw.replace(' ', '_')}_{int(values[-1])}",
                    signal_type=SignalType.SOCIAL_TREND, # Using SOCIAL_TREND as proxy for general search trend
                    source="google_trends",
                    description=f"Surging interest in '{trend_kw}'",
                    impact_score=impact_score,
                    urgency_level=urgency,
                    confidence_score=confidence_score,
                    related_topics=[t.get("topic_title", "") for t in trend_data.get("related_topics", {}).get("top", [])[:3]],
                    suggested_actions=["Create timely content", "Update social media"],
                    metadata={
                        **trend_data,
                        'avg_interest': avg_interest,
                        'last_interest': last_interest,
                        'confidence_basis': confidence_basis,
                        'confidence_is_estimate': is_estimate,
                    }
                )
                signals.append(signal)
                
            except Exception as e:
                logger.warning(f"[{self.__class__.__name__}] Failed to analyze trend '{trend_kw}': {e}")
                continue
                
        return signals

    async def _analyze_opportunity(self, trend: MarketSignal) -> Optional[Dict[str, Any]]:
        """
        Analyze a specific trend signal to generate a content opportunity.
        """
        try:
            # Use semantic search to find if we already have content covering this
            query = f"{trend.description} {' '.join(trend.related_topics)}"
            existing_content = await self.intelligence.search(query, limit=3)
            
            coverage_score = 0.0
            if existing_content:
                # If top result has high score, we might already cover it
                coverage_score = existing_content[0].get('score', 0.0)
            
            # If already well-covered, might skip or suggest update
            if coverage_score > 0.8:
                recommendation = "Update existing content"
            else:
                recommendation = "Create new content"
                
            # Use LLM to generate creative angle
            headline = f"Trend: {trend.description}"
            angle = f"Leverage {trend.source} trend on {trend.related_topics[0] if trend.related_topics else 'topic'}"
            
            try:
                prompt = f"""
                Analyze this market trend signal and propose a content angle:
                Trend: {trend.description}
                Related Topics: {', '.join(trend.related_topics)}
                Impact Score: {trend.impact_score}
                Recommendation: {recommendation}
                
                Provide a catchy headline and a 1-sentence strategic angle.
                Format: Headline | Angle
                """
                response = await self._generate_llm_response(prompt)
                if response and "|" in response:
                    parts = response.split('|')
                    headline = parts[0].strip()
                    angle = parts[1].strip()
                elif response:
                    angle = response.strip()
            except Exception as e:
                logger.warning(f"[{self.__class__.__name__}] LLM generation failed for opportunity: {e}")

            return {
                "trend_id": trend.signal_id,
                "topic": trend.description,
                "headline": headline,
                "source": trend.source,
                "urgency": trend.urgency_level.value,
                "impact_score": trend.impact_score,
                "current_coverage": coverage_score,
                "recommendation": recommendation,
                "suggested_angle": angle,
                "detected_at": trend.detected_at
            }
            
        except Exception as e:
            logger.warning(f"[{self.__class__.__name__}] Failed to analyze opportunity for signal {trend.signal_id}: {e}")
            return None
