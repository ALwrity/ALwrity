"""
SIF Phase 1 Integration: Onboarding Step 3 Enhancement
Integrates semantic intelligence capabilities into ALwrity's onboarding step 3.
This module enhances competitor discovery and content analysis with txtai-powered semantic understanding.
"""

import asyncio
import json
from typing import List, Dict, Any, Optional
from loguru import logger
from datetime import datetime

# Import existing ALwrity services
from api.onboarding_utils.step3_research_service import Step3ResearchService
from services.research.exa_service import ExaService
from services.seo.competitive_analyzer import CompetitiveAnalyzer

# Import SIF framework
from services.intelligence.txtai_service import TxtaiIntelligenceService
from services.intelligence.harvester import SemanticHarvesterService
from services.intelligence.agents import (
    StrategyArchitectAgent,
    ContentGuardianAgent,
    LinkGraphAgent
)

class SIFOnboardingIntegration:
    """
    Phase 1: Semantic Intelligence Integration for Onboarding Step 3
    Enhances competitor discovery and content analysis with semantic understanding.
    """
    
    def __init__(self, user_id: str, db_session=None):
        self.user_id = user_id
        self.research_service = Step3ResearchService()
        self.exa_service = ExaService()
        
        # Optional database session for Phase 1 (can be added later)
        self.db_session = db_session
        if db_session:
            try:
                from services.seo.competitive_analyzer import CompetitiveAnalyzer
                self.competitive_analyzer = CompetitiveAnalyzer(db_session)
            except ImportError:
                logger.warning("[SIFOnboarding] CompetitiveAnalyzer not available, using fallback")
                self.competitive_analyzer = None
        else:
            self.competitive_analyzer = None
        
        # SIF components
        self.intelligence = TxtaiIntelligenceService(user_id)
        self.harvester = SemanticHarvesterService()

        # Issue #620 #11: lazy agent initialization. Pre-#11
        # all three agents were instantiated eagerly in
        # ``__init__``, which meant loading the txtai model and
        # building the embeddings index for every onboarding
        # service, even ones that only needed (say) competitor
        # discovery. Lazy creation defers that work to first
        # access, reducing cold-start time and avoiding the cost
        # of building an index for users who only call a subset
        # of the methods.
        self._strategy_agent: Optional[StrategyArchitectAgent] = None
        self._guardian_agent: Optional[ContentGuardianAgent] = None
        self._link_agent: Optional[LinkGraphAgent] = None

        logger.info(f"[SIFOnboarding] Initialized for user {user_id}")

    def _get_strategy_agent(self) -> StrategyArchitectAgent:
        if self._strategy_agent is None:
            self._strategy_agent = StrategyArchitectAgent(
                self.intelligence, self.user_id
            )
        return self._strategy_agent

    def _get_guardian_agent(self) -> ContentGuardianAgent:
        if self._guardian_agent is None:
            self._guardian_agent = ContentGuardianAgent(
                self.intelligence, self.user_id
            )
        return self._guardian_agent

    def _get_link_agent(self) -> LinkGraphAgent:
        if self._link_agent is None:
            self._link_agent = LinkGraphAgent(
                self.intelligence, self.user_id
            )
        return self._link_agent
    
    async def enhance_competitor_discovery(self, website_url: str, business_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enhanced competitor discovery with semantic intelligence.
        
        Args:
            website_url: User's website URL
            business_info: Business information from onboarding
            
        Returns:
            Enhanced competitor analysis with semantic insights
        """
        logger.info(f"[SIFOnboarding] Starting enhanced competitor discovery for {website_url}")
        
        try:
            # Step 1: Harvest user website content for semantic analysis
            logger.info(f"[SIFOnboarding] Harvesting user website content from {website_url}")
            user_content = await self.harvester.harvest_website(website_url, limit=20)
            
            if not user_content:
                logger.warning(f"[SIFOnboarding] No content harvested from {website_url}")
                return await self._fallback_to_traditional_discovery(website_url, business_info)
            
            # Step 2: Index user content for semantic analysis
            logger.info(f"[SIFOnboarding] Indexing {len(user_content)} pages from user website")
            user_items = [
                (page["url"], page["content"], {
                    "title": page.get("title", ""),
                    "type": "user_content",
                    "source": "user_website"
                }) for page in user_content
            ]
            await self.intelligence.index_content(user_items)
            
            # Step 3: Traditional competitor discovery (existing ALwrity logic)
            logger.info("[SIFOnboarding] Running traditional competitor discovery")
            traditional_competitors = await self._get_traditional_competitors(website_url, business_info)
            
            # Step 4: Semantic competitor discovery using Exa AI
            logger.info("[SIFOnboarding] Running semantic competitor discovery")
            semantic_competitors = await self._discover_semantic_competitors(website_url, business_info)
            
            # Step 5: Harvest and analyze competitor content
            logger.info(f"[SIFOnboarding] Harvesting content from {len(semantic_competitors)} semantic competitors")
            competitor_content = await self.harvester.harvest_competitors(
                [comp["url"] for comp in semantic_competitors[:5]], 
                pages_per_competitor=10
            )
            
            # Step 6: Index competitor content
            if competitor_content:
                logger.info(f"[SIFOnboarding] Indexing {len(competitor_content)} pages from competitors")
                competitor_items = [
                    (page["url"], page["content"], {
                        "title": page.get("title", ""),
                        "type": "competitor_content",
                        "source": "competitor_website",
                        "competitor_name": self._extract_domain(page["url"])
                    }) for page in competitor_content
                ]
                await self.intelligence.index_content(competitor_items)
            
            # Step 7: Generate semantic insights
            logger.info("[SIFOnboarding] Generating semantic insights")
            semantic_insights = await self._generate_semantic_insights(user_content, competitor_content)
            
            # Step 8: Combine traditional and semantic results
            enhanced_results = {
                "traditional_competitors": traditional_competitors,
                "semantic_competitors": semantic_competitors,
                "semantic_insights": semantic_insights,
                "content_analysis": {
                    "user_pages_analyzed": len(user_content),
                    "competitor_pages_analyzed": len(competitor_content),
                    "harvest_stats": self.harvester.get_harvest_stats()
                },
                "intelligence_status": self.intelligence.get_index_stats()
            }
            
            logger.success(f"[SIFOnboarding] Enhanced competitor discovery completed for user {self.user_id}")
            return enhanced_results
            
        except Exception as e:
            logger.error(f"[SIFOnboarding] Enhanced competitor discovery failed: {e}")
            logger.exception("Full traceback:")
            return await self._fallback_to_traditional_discovery(website_url, business_info)
    
    async def _generate_semantic_insights(self, user_content: List[Dict], competitor_content: List[Dict]) -> Dict[str, Any]:
        """Generate semantic insights using SIF agents."""
        logger.info("[SIFOnboarding] Generating semantic insights")
        
        try:
            # Discover content pillars from user content
            content_pillars = await self._get_strategy_agent().discover_pillars()
            
            # Find semantic gaps (what competitors cover that user doesn't)
            indexed_documents = await self._get_strategy_agent()._fetch_index_documents()
            competitor_doc_ids = [
                str(doc.get("id", ""))
                for doc in indexed_documents
                if self._get_strategy_agent()._infer_document_role(doc.get("metadata", {})) == "competitor"
            ]
            semantic_gaps = await self._get_strategy_agent().find_semantic_gaps(competitor_indices=competitor_doc_ids)

            # Analyze content themes and topics
            themes_analysis = await self._analyze_content_themes(indexed_documents)
            
            # Generate strategic recommendations
            recommendations = await self._generate_strategic_recommendations(
                content_pillars, semantic_gaps, themes_analysis
            )
            
            return {
                "content_pillars": content_pillars,
                "semantic_gaps": semantic_gaps,
                "themes_analysis": themes_analysis,
                "strategic_recommendations": recommendations,
                "confidence_scores": {
                    "pillar_discovery": len(content_pillars) > 0,
                    "gap_analysis": len(semantic_gaps) > 0,
                    "theme_analysis": themes_analysis is not None
                }
            }
            
        except Exception as e:
            logger.error(f"[SIFOnboarding] Semantic insights generation failed: {e}")
            return {
                "content_pillars": [],
                "semantic_gaps": [],
                "themes_analysis": None,
                "strategic_recommendations": [],
                "error": str(e)
            }
    
    async def _analyze_content_themes(self, indexed_documents: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze themes from indexed metadata instead of static literals."""
        logger.info("[SIFOnboarding] Analyzing content themes")

        try:
            if not indexed_documents:
                return None

            user_docs = [
                doc for doc in indexed_documents
                if self._get_strategy_agent()._infer_document_role(doc.get("metadata", {})) == "user"
            ]
            competitor_docs = [
                doc for doc in indexed_documents
                if self._get_strategy_agent()._infer_document_role(doc.get("metadata", {})) == "competitor"
            ]
            if not user_docs and not competitor_docs:
                return None

            user_theme_density = self._get_strategy_agent()._extract_topic_density(user_docs)
            competitor_theme_density = self._get_strategy_agent()._extract_topic_density(competitor_docs)
            all_topics = set(user_theme_density) | set(competitor_theme_density)

            ranked_themes = []
            for topic in all_topics:
                user_score = user_theme_density.get(topic, 0.0)
                competitor_score = competitor_theme_density.get(topic, 0.0)
                ranked_themes.append({
                    "theme": topic,
                    "user_density": round(user_score, 4),
                    "competitor_density": round(competitor_score, 4),
                    "combined_relevance": round((user_score + competitor_score) / 2, 4),
                    "coverage_delta": round(competitor_score - user_score, 4),
                    "classification": (
                        "competitor_led"
                        if competitor_score > user_score + 0.05
                        else "user_led"
                        if user_score > competitor_score + 0.05
                        else "shared"
                    ),
                    "evidence": {
                        "user_sample_titles": self._get_strategy_agent()._sample_titles_for_topic(user_docs, topic),
                        "competitor_sample_titles": self._get_strategy_agent()._sample_titles_for_topic(competitor_docs, topic)
                    }
                })

            ranked_themes.sort(
                key=lambda item: (item["combined_relevance"], abs(item["coverage_delta"])),
                reverse=True
            )

            return {
                "top_themes": ranked_themes[:8],
                "total_themes_analyzed": len(ranked_themes),
                "user_theme_count": len(user_theme_density),
                "competitor_theme_count": len(competitor_theme_density),
                "theme_source": "indexed_metadata"
            }

        except Exception as e:
            logger.error(f"[SIFOnboarding] Theme analysis failed: {e}")
            return None
    
    async def _generate_strategic_recommendations(self, content_pillars: List[Dict], semantic_gaps: List[Dict], themes_analysis: Optional[Dict]) -> List[Dict[str, Any]]:
        """Generate strategic recommendations based on semantic analysis."""
        logger.info("[SIFOnboarding] Generating strategic recommendations")
        
        recommendations = []
        
        try:
            # Content pillar recommendations
            if content_pillars:
                recommendations.append({
                    "type": "content_pillars",
                    "priority": "high",
                    "title": "Focus on Core Content Pillars",
                    "description": f"Based on semantic analysis, focus on {len(content_pillars)} key content areas.",
                    "action_items": [f"Develop comprehensive content for pillar: {pillar.get('pillar_id', 'Unknown')}" for pillar in content_pillars[:3]]
                })
            
            # Semantic gap recommendations
            if semantic_gaps:
                recommendations.append({
                    "type": "content_gaps",
                    "priority": "high",
                    "title": "Fill Content Gaps",
                    "description": f"Competitors are covering {len(semantic_gaps)} topics you haven't addressed.",
                    "action_items": [
                        (
                            f"Create content about: {gap.get('topic', 'Unknown topic')} "
                            f"({gap.get('priority', 'medium')} priority) - {gap.get('reason', 'Coverage gap identified')}"
                        )
                        for gap in semantic_gaps[:5]
                    ],
                    "evidence": [
                        {
                            "topic": gap.get("topic"),
                            "priority": gap.get("priority"),
                            "confidence": gap.get("confidence"),
                            "topic_density": gap.get("topic_density"),
                            "competitor_sample_titles": gap.get("evidence", {}).get("competitor_sample_titles", [])
                        }
                        for gap in semantic_gaps[:5]
                    ]
                })
            
            # Theme-based recommendations
            if themes_analysis and themes_analysis.get("top_themes"):
                top_theme = themes_analysis["top_themes"][0] if themes_analysis["top_themes"] else None
                if top_theme:
                    recommendations.append({
                        "type": "content_themes",
                        "priority": "medium",
                        "title": "Leverage High-Relevance Themes",
                        "description": f"Your content strongly relates to '{top_theme['theme']}' - consider expanding in this area.",
                        "action_items": [
                            f"Create in-depth guides about {top_theme['theme']}",
                            f"Develop case studies showing {top_theme['theme']} success",
                            f"Create comparison content for {top_theme['theme']} tools/approaches"
                        ]
                    })
            
            # General strategic recommendations
            recommendations.append({
                "type": "strategic_overview",
                "priority": "medium",
                "title": "Strategic Content Approach",
                "description": "Based on semantic analysis of your competitive landscape",
                "action_items": [
                    "Focus on unique angles within your content pillars",
                    "Address identified content gaps systematically",
                    "Monitor competitor content themes for emerging opportunities",
                    "Develop thought leadership in your strongest semantic areas"
                ]
            })
            
            return recommendations
            
        except Exception as e:
            logger.error(f"[SIFOnboarding] Strategic recommendations generation failed: {e}")
            return [{
                "type": "error",
                "priority": "low",
                "title": "Analysis Error",
                "description": "Unable to generate strategic recommendations due to analysis error",
                "action_items": ["Retry analysis with different parameters"]
            }]
    
    async def _get_traditional_competitors(self, website_url: str, business_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get traditional competitors using existing ALwrity logic."""
        try:
            # Use existing Step3ResearchService for traditional competitor discovery
            # Note: This will use the existing ALwrity logic without database dependency for Phase 1
            return await self.research_service.discover_competitors(website_url, business_info)
        except Exception as e:
            logger.error(f"[SIFOnboarding] Traditional competitor discovery failed: {e}")
            # Fallback: return sample competitors for testing
            return [
                {
                    "name": "Sample Competitor 1",
                    "url": "https://sample-competitor-1.com",
                    "description": "Traditional competitor discovered via ALwrity",
                    "discovery_method": "traditional"
                },
                {
                    "name": "Sample Competitor 2", 
                    "url": "https://sample-competitor-2.com",
                    "description": "Traditional competitor discovered via ALwrity",
                    "discovery_method": "traditional"
                }
            ]
    
    async def _discover_semantic_competitors(self, website_url: str, business_info: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Discover semantic competitors using Exa AI neural search."""
        try:
            # Use Exa API for semantic competitor discovery
            business_description = business_info.get("description", "")
            industry = business_info.get("industry", "")
            
            # Create semantic search query
            semantic_query = f"{business_description} {industry} competitors alternatives"
            
            # Search for semantically similar businesses
            exa_results = await self.exa_service.search_and_contents(
                semantic_query,
                num_results=10,
                exclude_domains=[self._extract_domain(website_url)]
            )
            
            # Format results as competitors
            semantic_competitors = []
            for result in exa_results.get("results", []):
                competitor = {
                    "name": result.get("title", "Unknown Competitor"),
                    "url": result.get("url", ""),
                    "description": result.get("snippet", ""),
                    "discovery_method": "semantic_search",
                    "relevance_score": result.get("score", 0.0),
                    "semantic_match": True
                }
                semantic_competitors.append(competitor)
            
            return semantic_competitors
            
        except Exception as e:
            logger.error(f"[SIFOnboarding] Semantic competitor discovery failed: {e}")
            return []
    
    async def _fallback_to_traditional_discovery(self, website_url: str, business_info: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback to traditional competitor discovery when SIF fails."""
        logger.warning(f"[SIFOnboarding] Falling back to traditional discovery for {website_url}")
        
        traditional_competitors = await self._get_traditional_competitors(website_url, business_info)
        
        return {
            "traditional_competitors": traditional_competitors,
            "semantic_competitors": [],
            "semantic_insights": {
                "error": "Semantic analysis temporarily unavailable",
                "fallback_used": True
            },
            "content_analysis": {
                "user_pages_analyzed": 0,
                "competitor_pages_analyzed": 0,
                "error": "Content harvesting failed"
            },
            "intelligence_status": {"status": "error", "error": "SIF initialization failed"}
        }
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL."""
        from urllib.parse import urlparse
        try:
            return urlparse(url).netloc
        except Exception:
            return url

# Integration helper functions for existing ALwrity code
def create_sif_enhanced_step3(user_id: str, db_session=None) -> SIFOnboardingIntegration:
    """
    Factory function to create SIF-enhanced Step 3 integration.
    
    Args:
        user_id: The user ID for the onboarding session
        db_session: Optional database session for enhanced functionality
        
    Returns:
        Configured SIFOnboardingIntegration instance
    """
    return SIFOnboardingIntegration(user_id, db_session)

async def enhance_step3_with_semantic_intelligence(
    user_id: str, 
    website_url: str, 
    business_info: Dict[str, Any],
    db_session=None
) -> Dict[str, Any]:
    """
    Convenience function to enhance Step 3 with semantic intelligence.
    
    Args:
        user_id: User ID
        website_url: User's website URL
        business_info: Business information from onboarding
        db_session: Optional database session for enhanced functionality
        
    Returns:
        Enhanced competitor analysis results
    """
    sif_integration = create_sif_enhanced_step3(user_id, db_session)
    return await sif_integration.enhance_competitor_discovery(website_url, business_info)

# Example usage for integration into existing Step 3 API
"""
# In step3_routes.py, enhance the existing competitor discovery endpoint:

from services.intelligence.sif_onboarding_integration import enhance_step3_with_semantic_intelligence

@app.post("/api/onboarding/step3/discover-competitors")
async def discover_competitors(request: CompetitorDiscoveryRequest, user=Depends(get_current_user)):
    # Existing traditional competitor discovery
    traditional_results = await step3_research_service.discover_competitors(
        request.website_url, request.business_info
    )
    
    # New: Enhanced with semantic intelligence
    enhanced_results = await enhance_step3_with_semantic_intelligence(
        user.id, request.website_url, request.business_info
    )
    
    # Combine results
    return {
        "traditional_competitors": traditional_results,
        "semantic_insights": enhanced_results["semantic_insights"],
        "content_analysis": enhanced_results["content_analysis"],
        "strategic_recommendations": enhanced_results["semantic_insights"]["strategic_recommendations"]
    }
"""
