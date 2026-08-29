"""
Step 3 Research Service for Onboarding

This service handles the research phase of onboarding (Step 3), including
competitor discovery using Exa API and research data management.

Key Features:
- Competitor discovery using Exa API
- Research progress tracking
- Data storage and retrieval
- Integration with onboarding workflow

Author: ALwrity Team
Version: 1.0
Last Updated: January 2025
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
import traceback
from loguru import logger
from services.research.exa_service import ExaService
from services.database import get_db_session
from models.onboarding import OnboardingSession
from sqlalchemy.orm import Session

class Step3ResearchService:
    """
    Service for managing Step 3 research phase of onboarding.
    
    This service handles competitor discovery, research data storage,
    and integration with the onboarding workflow.
    """
    
    def __init__(self):
        """Initialize the Step 3 Research Service."""
        self.exa_service = ExaService()
        self.service_name = "step3_research"
        logger.info(f"Initialized {self.service_name}")
    
    async def _discover_content_pillars_with_fallback(self, user_url: str) -> Dict[str, Any]:
        """Discover content pillars via Answer API, normalized into a status envelope.

        Returns a dict with: ``success`` (bool), ``error`` (str|None),
        ``content_pillars`` (raw dict|None) and ``timestamp`` (ISO string).
        Never returns an ambiguous ``None`` so callers can tell a real failure
        apart from an in-flight / empty state.
        """
        timestamp = datetime.utcnow().isoformat()
        logger.info(f"[research] Content pillar discovery starting for {user_url}")
        result = await self.exa_service._discover_content_pillars_via_answer(user_url)
        if result and isinstance(result, dict):
            logger.info(f"[research] Content pillars from Answer API: {list(result.keys())}")
            return {
                "success": True,
                "error": None,
                "content_pillars": result,
                "timestamp": timestamp,
            }
        error = (
            "Content pillar discovery returned no data. "
            "Exa credits may be exhausted or the API found no structured pillars."
        )
        logger.warning(f"[research] Content pillar discovery failed for {user_url}: {error}")
        return {
            "success": False,
            "error": error,
            "content_pillars": None,
            "timestamp": timestamp,
        }

    @staticmethod
    def _pillars_payload(envelope: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Normalize a discovery envelope into the value persisted and returned.

        Success -> the raw Exa pillars dict tagged with ``status: "complete"``
        plus timestamp. Failure -> a minimal ``{status: "failed", error,
        timestamp}`` dict so reloads show a retryable error instead of an
        eternal "pending".
        """
        if not envelope or not isinstance(envelope, dict):
            return None
        raw = envelope.get("content_pillars")
        if envelope.get("success") and isinstance(raw, dict):
            payload = dict(raw)
            payload.setdefault("status", "complete")
            payload.setdefault("timestamp", envelope.get("timestamp"))
            return payload
        return {
            "status": "failed",
            "error": envelope.get("error") or "Content pillar discovery failed",
            "timestamp": envelope.get("timestamp") or datetime.utcnow().isoformat(),
        }

    async def discover_competitors_for_onboarding(
        self,
        user_url: str,
        user_id: str,
        industry_context: Optional[str] = None,
        num_results: int = 25,
        website_analysis_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Discover competitors for onboarding Step 3.

        Args:
            user_url: The user's website URL
            user_id: Clerk user ID for finding the correct session
            industry_context: Industry context for better discovery
            num_results: Number of competitors to discover

        Returns:
            Dictionary containing competitor discovery results
        """
        try:
            logger.info(f"Starting research analysis for user {user_id}, URL: {user_url}")

            # Find the correct onboarding session for this user
            # Use the most recent session (ordered by updated_at DESC) to match
            # the session that reads target, ensuring writes go to the same session.
            with get_db_session(user_id) as db:
                from models.onboarding import OnboardingSession
                session = db.query(OnboardingSession).filter(
                    OnboardingSession.user_id == user_id
                ).order_by(OnboardingSession.updated_at.desc()).first()

                if not session:
                    logger.error(f"No onboarding session found for user {user_id}")
                    return {
                        "success": False,
                        "error": f"No onboarding session found for user {user_id}"
                    }

                actual_session_id = str(session.id)  # Convert to string for consistency
                logger.info(f"Found onboarding session {actual_session_id} for user {user_id}")

            # Step 1, 2 & 3: Discover competitors, social media, and content pillars in parallel
            logger.info("Running competitor + social media + content pillars discovery in parallel...")
            competitor_task = self.exa_service.discover_competitors(
                user_url=user_url, num_results=num_results, exclude_domains=None,
                industry_context=industry_context, website_analysis_data=website_analysis_data)
            social_media_task = self.exa_service.discover_social_media_accounts(user_url)
            pillars_task = self._discover_content_pillars_with_fallback(user_url)
            logger.info(f"[research] All 3 tasks created — awaiting asyncio.gather…")
            competitor_results, social_media_results, pillars_results = await asyncio.gather(
                competitor_task, social_media_task, pillars_task, return_exceptions=True)
            logger.info(f"[research] gather complete — competitor={type(competitor_results).__name__} "
                        f"social={type(social_media_results).__name__} "
                        f"pillars={type(pillars_results).__name__}")

            # Trigger SIF indexing regardless of Exa success/failure (background thread)
            try:
                from api.onboarding_utils.onboarding_task_scheduler import _run_sif_now
                import asyncio as _asyncio
                _asyncio.get_event_loop().run_in_executor(
                    None, lambda: _asyncio.run(_run_sif_now(user_id, user_url))
                )
                logger.info(f"Triggered SIF indexing in background thread for {user_id}")
            except Exception as sif_err:
                logger.warning(f"Could not trigger SIF after discovery: {sif_err}")

            if isinstance(competitor_results, Exception):
                return {"success": False, "error": str(competitor_results)}
            if not competitor_results.get("success"):
                return competitor_results
            if isinstance(social_media_results, Exception) or not social_media_results.get("success"):
                social_media_results = {"success": False, "social_media_accounts": {}, "citations": []}
            if isinstance(pillars_results, Exception):
                pillars_results = {
                    "success": False,
                    "error": f"Content pillar discovery raised: {pillars_results}",
                    "content_pillars": None,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            pillars_payload = self._pillars_payload(pillars_results) if isinstance(pillars_results, dict) else None
            
            # Process and enhance competitor data
            enhanced_competitors = await self._enhance_competitor_data(
                competitor_results["competitors"],
                user_url,
                industry_context
            )
            
            # Generate research summary
            research_summary = self._generate_research_summary(
                enhanced_competitors,
                industry_context
            )
            
            # Get social media citations for persistence
            social_media_citations = social_media_results.get("citations", [])
            
            # Persist to DB immediately so results survive refresh
            # Include research_summary and social_media_citations for persistence
            try:
                from services.database import get_session_for_user
                from api.onboarding_utils.step_management_service import StepManagementService
                db = get_session_for_user(user_id)
                if db:
                    svc = StepManagementService()
                    svc._save_competitor_analysis(
                        user_id, 
                        enhanced_competitors, 
                        industry_context, 
                        db, 
                        content_pillars=pillars_payload,
                        research_summary=research_summary,
                        social_media_citations=social_media_citations
                    )
                    db.close()
                    logger.info(f"Competitor analysis persisted for user {user_id}")
            except Exception as persist_err:
                logger.exception(f"Failed to persist competitor analysis for user {user_id}: {persist_err}")
            
            logger.info(f"Successfully discovered {len(enhanced_competitors)} competitors for user {user_id}")

            return {
                "success": True,
                "session_id": actual_session_id,
                "user_url": user_url,
                "competitors": enhanced_competitors,
                "social_media_accounts": social_media_results.get("social_media_accounts", {}),
                "social_media_citations": social_media_citations,
                "content_pillars": pillars_payload,
                "research_summary": research_summary,
                "total_competitors": len(enhanced_competitors),
                "industry_context": industry_context,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "api_cost": competitor_results.get("api_cost", 0) + social_media_results.get("api_cost", 0)
            }
            
        except Exception as e:
            logger.error(f"Error in competitor discovery for onboarding: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "session_id": actual_session_id if 'actual_session_id' in locals() else session_id,
                "user_url": user_url
            }
    
    async def _enhance_competitor_data(
        self,
        competitors: List[Dict[str, Any]],
        user_url: str,
        industry_context: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Enhance competitor data with additional analysis.
        
        Args:
            competitors: Raw competitor data from Exa API
            user_url: User's website URL for comparison
            industry_context: Industry context
            
        Returns:
            List of enhanced competitor data
        """
        enhanced_competitors = []
        
        for competitor in competitors:
            try:
                # Add competitive analysis
                competitive_analysis = self._analyze_competitor_competitiveness(
                    competitor,
                    user_url,
                    industry_context
                )
                
                # Add content strategy insights
                content_insights = self._analyze_content_strategy(competitor)
                
                # Add market positioning
                market_positioning = self._analyze_market_positioning(competitor)
                
                enhanced_competitor = {
                    **competitor,
                    "competitive_analysis": competitive_analysis,
                    "content_insights": content_insights,
                    "market_positioning": market_positioning,
                    "enhanced_timestamp": datetime.utcnow().isoformat()
                }
                
                enhanced_competitors.append(enhanced_competitor)
                
            except Exception as e:
                logger.warning(f"Error enhancing competitor data: {str(e)}")
                enhanced_competitors.append(competitor)
        
        return enhanced_competitors
    
    def _analyze_competitor_competitiveness(
        self,
        competitor: Dict[str, Any],
        user_url: str,
        industry_context: Optional[str]
    ) -> Dict[str, Any]:
        """
        Analyze competitor competitiveness.
        
        Args:
            competitor: Competitor data
            user_url: User's website URL
            industry_context: Industry context
            
        Returns:
            Dictionary of competitive analysis
        """
        analysis = {
            "threat_level": "medium",
            "competitive_strengths": [],
            "competitive_weaknesses": [],
            "market_share_estimate": "unknown",
            "differentiation_opportunities": [],
            # business_model/target_audience satisfy the frontend `Competitor`
            # contract under the `competitive_insights` alias (`business_model`,
            # `target_audience`). Kept alongside the richer analysis fields.
            "business_model": "unknown",
            "target_audience": "unknown"
        }
        
        # Analyze threat level based on relevance score
        relevance_score = competitor.get("relevance_score", 0)
        if relevance_score > 0.8:
            analysis["threat_level"] = "high"
        elif relevance_score < 0.4:
            analysis["threat_level"] = "low"
        
        # Analyze competitive strengths from content
        summary = competitor.get("summary", "").lower()
        title = competitor.get("title", "").lower()
        highlights = competitor.get("highlights", [])
        highlight_blob = " ".join(h.lower() for h in highlights)
        
        # Extract strengths from content analysis
        if "innovative" in summary or "cutting-edge" in summary:
            analysis["competitive_strengths"].append("Innovation leadership")
        
        if "comprehensive" in summary or "complete" in summary:
            analysis["competitive_strengths"].append("Comprehensive solution")
        
        if "enterprise" in highlight_blob:
            analysis["competitive_strengths"].append("Enterprise focus")
        
        # Generate differentiation opportunities
        if "saas" not in summary:
            analysis["differentiation_opportunities"].append("SaaS platform differentiation")
        
        # Infer business model from the site's description
        blob = f"{title} {summary} {highlight_blob}"
        if "saas" in blob or "software" in blob or "platform" in blob:
            analysis["business_model"] = "SaaS / platform"
        elif "subscription" in blob or "membership" in blob or "recurring" in blob:
            analysis["business_model"] = "Subscription"
        elif "marketplace" in blob or "e-commerce" in blob or "ecommerce" in blob or "shop" in blob:
            analysis["business_model"] = "E-commerce / marketplace"
        elif "agency" in blob or "services" in blob or "consulting" in blob:
            analysis["business_model"] = "Agency / services"
        elif "advertis" in blob:
            analysis["business_model"] = "Ad-supported"
        
        # Infer target audience from the same descriptive blob
        if "enterprise" in blob or "for business" in blob:
            analysis["target_audience"] = "Enterprise"
        elif "developer" in blob or "technical" in blob:
            analysis["target_audience"] = "Developers"
        elif "startup" in blob or "small business" in blob or "sme" in blob:
            analysis["target_audience"] = "Startups / SMBs"
        elif "consumer" in blob or "individuals" in blob or "personal" in blob:
            analysis["target_audience"] = "Consumers"
        
        return analysis
    
    def _analyze_content_strategy(self, competitor: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze competitor's content strategy.
        
        Args:
            competitor: Competitor data
            
        Returns:
            Dictionary of content strategy analysis
        """
        strategy = {
            "content_focus": "general",
            "target_audience": "unknown",
            "content_types": [],
            "publishing_frequency": "unknown",
            "content_quality": "medium"
        }
        
        summary = competitor.get("summary", "").lower()
        title = competitor.get("title", "").lower()
        
        # Analyze content focus
        if "technical" in summary or "developer" in summary:
            strategy["content_focus"] = "technical"
        elif "business" in summary or "enterprise" in summary:
            strategy["content_focus"] = "business"
        elif "marketing" in summary or "seo" in summary:
            strategy["content_focus"] = "marketing"
        
        # Analyze target audience
        if "startup" in summary or "small business" in summary:
            strategy["target_audience"] = "startups_small_business"
        elif "enterprise" in summary or "large" in summary:
            strategy["target_audience"] = "enterprise"
        elif "developer" in summary or "technical" in summary:
            strategy["target_audience"] = "developers"
        
        # Analyze content quality
        if len(summary) > 300:
            strategy["content_quality"] = "high"
        elif len(summary) < 100:
            strategy["content_quality"] = "low"
        
        return strategy
    
    def _analyze_market_positioning(self, competitor: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze competitor's market positioning.
        
        Args:
            competitor: Competitor data
            
        Returns:
            Dictionary of market positioning analysis
        """
        positioning = {
            "market_tier": "unknown",
            "pricing_position": "unknown",
            "brand_positioning": "unknown",
            "competitive_advantage": "unknown"
        }
        
        summary = competitor.get("summary", "").lower()
        title = competitor.get("title", "").lower()
        
        # Analyze market tier
        if "enterprise" in summary or "enterprise" in title:
            positioning["market_tier"] = "enterprise"
        elif "startup" in summary or "small" in summary:
            positioning["market_tier"] = "startup_small_business"
        elif "premium" in summary or "professional" in summary:
            positioning["market_tier"] = "premium"
        
        # Analyze brand positioning
        if "innovative" in summary or "cutting-edge" in summary:
            positioning["brand_positioning"] = "innovator"
        elif "reliable" in summary or "trusted" in summary:
            positioning["brand_positioning"] = "trusted_leader"
        elif "affordable" in summary or "cost-effective" in summary:
            positioning["brand_positioning"] = "value_leader"
        
        return positioning
    
    def _generate_research_summary(
        self,
        competitors: List[Dict[str, Any]],
        industry_context: Optional[str]
    ) -> Dict[str, Any]:
        """
        Generate a summary of the research findings.
        
        Args:
            competitors: List of enhanced competitor data
            industry_context: Industry context
            
        Returns:
            Dictionary containing research summary
        """
        if not competitors:
            return {
                "total_competitors": 0,
                "market_insights": "No competitors found",
                "key_findings": [],
                "recommendations": []
            }
        
        # Analyze market landscape
        threat_levels = [comp.get("competitive_analysis", {}).get("threat_level", "medium") for comp in competitors]
        high_threat_count = threat_levels.count("high")
        
        # Extract common themes
        content_focuses = [comp.get("content_insights", {}).get("content_focus", "general") for comp in competitors]
        content_focus_distribution = {focus: content_focuses.count(focus) for focus in set(content_focuses)}
        
        # Generate key findings
        key_findings = []
        if high_threat_count > len(competitors) * 0.3:
            key_findings.append("Highly competitive market with multiple strong players")
        
        if "technical" in content_focus_distribution:
            key_findings.append("Technical content is a key differentiator in this market")
        
        # Generate recommendations
        recommendations = []
        if high_threat_count > 0:
            recommendations.append("Focus on unique value proposition to differentiate from strong competitors")
        
        if "technical" in content_focus_distribution and content_focus_distribution["technical"] > 2:
            recommendations.append("Consider developing technical content strategy")
        
        return {
            "total_competitors": len(competitors),
            "high_threat_competitors": high_threat_count,
            "content_focus_distribution": content_focus_distribution,
            "market_insights": f"Found {len(competitors)} competitors in {industry_context or 'the market'}",
            "key_findings": key_findings,
            "recommendations": recommendations,
            "competitive_landscape": "moderate" if high_threat_count < len(competitors) * 0.5 else "high"
        }
    
    # _store_research_data removed as it is now handled by StepManagementService via delayed persistence
    
    async def get_research_data(self, session_id: str, user_id: str) -> Dict[str, Any]:       
        """
        Retrieve research data for a session.

        Args:
            session_id: Onboarding session ID
            user_id: Clerk user ID for database access

        Returns:
            Dictionary containing research data
        """
        try:
            with get_db_session(user_id) as db:
                session = db.query(OnboardingSession).filter(
                    OnboardingSession.id == session_id
                ).first()

                if not session:
                    return {
                        "success": False,
                        "error": "Session not found"
                    }

                # Check if step_data attribute exists (it may not be in the model)
                # If it doesn't exist, try to get data from CompetitorAnalysis table
                research_data = None
                if hasattr(session, 'step_data') and session.step_data:
                    research_data = session.step_data.get("step3_research_data") if isinstance(session.step_data, dict) else None

                # If not found in step_data, try CompetitorAnalysis table
                if not research_data:
                    try:
                        from models.onboarding import CompetitorAnalysis
                        competitor_records = db.query(CompetitorAnalysis).filter(
                            CompetitorAnalysis.session_id == session.id
                        ).all()

                        if competitor_records:
                            competitors = []
                            for record in competitor_records:
                                analysis_data = record.analysis_data or {}
                                competitor_info = {
                                    "url": record.competitor_url,
                                    "domain": record.competitor_domain or record.competitor_url,
                                    "title": analysis_data.get("title", record.competitor_domain or ""),
                                    "summary": analysis_data.get("summary", ""),
                                    "relevance_score": analysis_data.get("relevance_score", 0.5),
                                    "highlights": analysis_data.get("highlights", []),
                                    "favicon": analysis_data.get("favicon"),
                                    "image": analysis_data.get("image"),
                                    "published_date": analysis_data.get("published_date"),
                                    "author": analysis_data.get("author"),
                                    "competitive_analysis": analysis_data.get("competitive_analysis", {}),
                                    "content_insights": analysis_data.get("content_insights", {})
                                }
                                competitors.append(competitor_info)

                            if competitors:
                                # Map competitor fields to match frontend expectations
                                mapped_competitors = []
                                for comp in competitors:
                                    mapped_comp = {
                                        **comp,  # Keep all original fields
                                        "name": comp.get("title") or comp.get("name") or comp.get("domain", ""),
                                        "description": comp.get("summary") or comp.get("description", ""),
                                        "similarity_score": comp.get("relevance_score") or comp.get("similarity_score", 0.5)
                                    }
                                    mapped_competitors.append(mapped_comp)
                                
                                # Regenerate research summary from the mapped competitors
                                research_summary = self._generate_research_summary(mapped_competitors, None)
                                
                                research_data = {
                                    "competitors": mapped_competitors,
                                    "research_summary": research_summary,
                                    "completed_at": competitor_records[0].created_at.isoformat() if competitor_records[0].created_at else None
                                }
                    except Exception as e:
                        logger.warning(f"Could not retrieve competitors from CompetitorAnalysis table: {e}")

                if not research_data:
                    return {
                        "success": False,
                        "error": "No research data found for this session"      
                    }
                
                return {
                    "success": True,
                    "step3_research_data": research_data,
                    "research_data": research_data  # Keep for backward compatibility
                }
                
        except Exception as e:
            logger.error(f"Error retrieving research data: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _extract_domain(self, url: str) -> str:
        """
        Extract domain from URL.
        
        Args:
            url: Website URL
            
        Returns:
            Domain name
        """
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc
        except Exception:
            return url
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the Step 3 Research Service.
        
        Returns:
            Dictionary containing service health status
        """
        try:
            exa_health = await self.exa_service.health_check()
            
            return {
                "status": "healthy" if exa_health["status"] == "healthy" else "degraded",
                "service": self.service_name,
                "exa_service_status": exa_health["status"],
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "error",
                "service": self.service_name,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
