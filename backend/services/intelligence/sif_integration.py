"""
SIF Phase 2 Integration Module

This module is the canonical production entry point for the
Semantic Intelligence Framework (SIF) integration layer. It
orchestrates ``TxtaiIntelligenceService`` (per-user FAISS
embeddings), the ``SemanticCacheManager``, the
``SemanticHarvesterService``, and the SIF agent team to provide
context-aware retrieval for the rest of the ALwrity backend
(onboarding, website analysis, SEO dashboard, agent framework).

Failure-mode contract (Phase 1.2.3)
----------------------------------
Public methods follow the SIFError contract defined in
``sif_errors``. The strict context-fallback methods
(``get_step*_context``) raise :class:`SIFContextMissing` after all
three fallback tiers return no data; this is a documented
runtime condition (the user has not completed that onboarding
step) and is *not* a system fault. SIFError subclasses raised
by the underlying ``intelligence_service.search`` (Phase 1.2.2)
are caught and logged at the tier level; the method falls
through to the next tier. Only SIFContextMissing surfaces.
"""

import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime
import json

from services.database import has_onboarding_session

# Import existing SIF components
from services.intelligence.sif._base import SIFBase
from services.intelligence.sif._context import SIFContextMixin
from services.intelligence.sif._sync import SIFSyncMixin


class SIFIntegrationService(SIFSyncMixin, SIFContextMixin, SIFBase):
    """
    Semantic Intelligence Framework service with Phase 2 improvements.
    
    Features:
    - Intelligent caching for all semantic operations
    - Performance monitoring and analytics
    - Real-time cache invalidation
    - User-specific semantic memory optimization
    """


    async def get_seo_dashboard_context(self) -> Dict[str, Any]:
        """
        Retrieve SEO Dashboard context from SIF (txtai index).
        If not found, triggers a sync and tries again.
        """
        try:
            logger.info(f"Retrieving SEO Dashboard context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = "seo dashboard analysis health score clicks"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid dashboard objects
            valid_result = None
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'seo_dashboard':
                            valid_result = metadata.get('full_report')
                            break
                    except Exception as parse_err:
                        continue

            if valid_result:
                logger.info("Found SEO Dashboard context in SIF index")
                return {
                    "dashboard_data": valid_result,
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry
            logger.info("SEO Dashboard context not found in SIF. Triggering sync...")
            synced = await self.sync_seo_dashboard_to_sif()
            
            if synced:
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            
                            if metadata.get('type') == 'seo_dashboard':
                                valid_result = metadata.get('full_report')
                                return {
                                    "dashboard_data": valid_result,
                                    "source": "sif_index_after_sync"
                                }
                        except: continue

            logger.warning("No SEO Dashboard data found in SIF even after sync.")
            return {
                "error": "No SEO Dashboard data found.",
                "source": "empty"
            }
                    
        except Exception as e:
            logger.error(f"Failed to get SEO Dashboard context via SIF: {e}")
            return {"error": str(e)}

    async def get_seo_context(self, website_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve existing SEO context from SIF (txtai index).
        If not found, triggers a sync from DB and tries again.
        """
        try:
            logger.info(f"Retrieving SEO context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = f"website analysis seo audit {website_url if website_url else ''}"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid website analysis objects
            valid_result = None
            if results:
                for res in results:
                    # txtai returns metadata in the result object directly if objects=True
                    # Structure: {'id': '...', 'score': ..., 'text': '...', 'metadata': {...}}
                    # Note: txtai_service.py search returns results. 
                    # If objects=True in embeddings, result is dict with metadata fields merged or in 'metadata'?
                    # Let's check txtai_service.py implementation of search. 
                    # It calls self.embeddings.search(query, limit). 
                    # With objects=True, it usually returns list of dicts.
                    
                    # We check if the result is of type 'website_analysis' and matches URL if provided
                    # Since we serialized metadata to JSON string in index_content, we might need to parse it back?
                    # txtai_service.py: "metadata_json = json.dumps(metadata) ... processed_items.append((id, text, metadata_json))"
                    # So the stored object IS the JSON string.
                    
                    try:
                        # txtai might return the object as the 'object' field or merge it.
                        # Let's assume standard txtai behavior: 
                        # If we indexed (id, text, object), search returns {'id': id, 'score': score, 'text': text, ...object_fields...}
                        # OR if object was a string, it might be in 'object' field.
                        
                        # In txtai_service.py, we did: processed_items.append((id_val, text, metadata_json))
                        # So 'object' is a JSON string.
                        
                        metadata_str = res.get('object') # or it might be unpacked if it was a dict, but we stored string.
                        
                        if not metadata_str and 'type' in res: 
                             # Maybe it unpacks automatically? 
                             # If we stored a string, it is likely in 'object'.
                             pass

                        if metadata_str:
                             if isinstance(metadata_str, str):
                                 metadata = json.loads(metadata_str)
                             else:
                                 metadata = metadata_str # Already dict?
                        else:
                             # Fallback: maybe the dict keys are merged into res?
                             metadata = res
                        
                        if metadata.get('type') == 'website_analysis':
                            if website_url and website_url not in metadata.get('url', ''):
                                continue # URL mismatch
                            
                            valid_result = metadata.get('full_report')
                            break
                    except Exception as parse_err:
                        logger.warning(f"Failed to parse SIF result metadata: {parse_err}")
                        continue

            if valid_result:
                logger.info(f"Found SEO context in SIF index for {valid_result.get('website_url')}")
                return {
                    "website_url": valid_result.get('website_url'),
                    "seo_audit": valid_result.get('seo_audit') or {},
                    "crawl_result": valid_result.get('crawl_result') or {},
                    "sitemap_analysis": valid_result.get('crawl_result', {}).get('sitemap_analysis', {}) if valid_result.get('crawl_result') else {},
                    "pagespeed_data": valid_result.get('crawl_result', {}).get('pagespeed', {}) if valid_result.get('crawl_result') else {},
                    "analysis_date": valid_result.get('analysis_date'),
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry (Lazy Embedding)
            logger.info("SEO context not found in SIF. Triggering DB sync...")
            synced = await self.sync_onboarding_data_to_sif()
            
            if synced:
                # Retry search once
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            
                            if metadata.get('type') == 'website_analysis':
                                if website_url and website_url not in metadata.get('url', ''):
                                    continue
                                
                                valid_result = metadata.get('full_report')
                                return {
                                    "website_url": valid_result.get('website_url'),
                                    "seo_audit": valid_result.get('seo_audit') or {},
                                    "crawl_result": valid_result.get('crawl_result') or {},
                                    "sitemap_analysis": valid_result.get('crawl_result', {}).get('sitemap_analysis', {}) if valid_result.get('crawl_result') else {},
                                    "pagespeed_data": valid_result.get('crawl_result', {}).get('pagespeed', {}) if valid_result.get('crawl_result') else {},
                                    "analysis_date": valid_result.get('analysis_date'),
                                    "source": "sif_index_after_sync"
                                }
                        except: continue

            logger.warning("No SEO data found in SIF even after sync.")
            return {
                "error": "No SEO data found. Please complete onboarding.",
                "source": "empty"
            }
                    
        except Exception as e:
            logger.error(f"Failed to get SEO context via SIF: {e}")
            return {"error": str(e)}

    async def track_agent_failure(self, agent_id: str, error: Exception, context: Dict[str, Any]):
        """
        Tracks agent failures to identify root causes and patterns.
        """
        try:
            error_type = type(error).__name__
            error_message = str(error)
            timestamp = datetime.utcnow().isoformat()
            
            # Categorize error
            category = "unknown"
            if "context window" in error_message.lower() or "token limit" in error_message.lower():
                category = "context_window_exceeded"
            elif "timeout" in error_message.lower():
                category = "timeout"
            elif "rate limit" in error_message.lower():
                category = "rate_limit"
            elif "parse" in error_message.lower() or "json" in error_message.lower():
                category = "parsing_error"
            elif "safety" in error_message.lower():
                category = "safety_violation"
            elif "tool" in error_message.lower():
                category = "tool_execution_failed"
            
            failure_record = {
                "agent_id": agent_id,
                "error_type": error_type,
                "error_message": error_message,
                "category": category,
                "context": context,
                "timestamp": timestamp
            }
            
            logger.error(f"Agent Failure Tracked: {agent_id} - {category} - {error_message}")
            
            # Index failure for semantic analysis (optional, but useful for 'why failed?')
            text_content = f"Agent Failure: {agent_id} encountered {category}. Error: {error_message}."
            metadata = {
                "type": "agent_failure_log",
                "agent_id": agent_id,
                "category": category,
                "timestamp": timestamp,
                "full_report": failure_record
            }
            
            # Fire and forget indexing to avoid blocking
            asyncio.create_task(self.intelligence_service.index_content([(f"fail_{agent_id}_{timestamp}", text_content, metadata)]))
            
            try:
                from services.database import get_session_for_user
                from services.agent_activity_service import AgentActivityService

                db = get_session_for_user(self.user_id)
                if db:
                    service = AgentActivityService(db, self.user_id)
                    service.create_alert(
                        alert_type="agent_failure",
                        title=f"Agent failure: {category}",
                        message=error_message[:2000],
                        severity="error" if category in {"timeout", "context_window_exceeded", "tool_execution_failed", "safety_violation"} else "warning",
                        payload=failure_record,
                        cta_path="/content-planning",
                    )
                    db.close()
            except Exception:
                pass

            return failure_record
            
        except Exception as e:
            logger.error(f"Failed to track agent failure: {e}")

    async def get_agent_failure_analysis(self, time_window_hours: int = 24) -> Dict[str, Any]:
        """
        Analyzes recent agent failures to provide insights.
        """
        try:
            # Search for failure logs
            query = "agent failure error"
            results = await self.intelligence_service.search(query, limit=50)
            
            failures = []
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'agent_failure_log':
                            failures.append(metadata.get('full_report'))
                    except: continue
            
            # Aggregate stats
            categories = {}
            for f in failures:
                cat = f.get('category', 'unknown')
                categories[cat] = categories.get(cat, 0) + 1
                
            return {
                "total_failures": len(failures),
                "breakdown": categories,
                "recent_failures": failures[:5]
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze agent failures: {e}")
            return {"error": str(e)}

    async def get_competitor_context(self, competitor_url: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve existing Competitor context from SIF (txtai index).
        If not found, triggers a sync from DB and tries again.
        """
        try:
            logger.info(f"Retrieving Competitor context via SIF for user {self.user_id}")
            
            # 1. Construct semantic query
            query = f"competitor analysis {competitor_url if competitor_url else ''}"
            
            # 2. Search SIF
            results = await self.intelligence_service.search(query, limit=5)
            
            # 3. Filter for valid competitor analysis objects
            valid_results = []
            
            if results:
                for res in results:
                    try:
                        metadata_str = res.get('object')
                        metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                        
                        if metadata.get('type') == 'competitor_analysis':
                            if competitor_url and competitor_url not in metadata.get('url', ''):
                                continue 
                            
                            valid_results.append(metadata.get('full_report'))
                    except Exception as parse_err:
                        continue
            
            if valid_results:
                logger.info(f"Found {len(valid_results)} competitor contexts in SIF index")
                return {
                    "competitors": valid_results,
                    "source": "sif_index"
                }

            # 4. If not found, Sync and Retry
            logger.info("Competitor context not found in SIF. Triggering DB sync...")
            synced = await self.sync_onboarding_data_to_sif()
            
            if synced:
                results_retry = await self.intelligence_service.search(query, limit=5)
                if results_retry:
                    for res in results_retry:
                        try:
                            metadata_str = res.get('object')
                            metadata = json.loads(metadata_str) if isinstance(metadata_str, str) else (metadata_str or res)
                            if metadata.get('type') == 'competitor_analysis':
                                if competitor_url and competitor_url not in metadata.get('url', ''):
                                    continue
                                valid_results.append(metadata.get('full_report'))
                        except: continue
                    
                    if valid_results:
                         return {
                            "competitors": valid_results,
                            "source": "sif_index_after_sync"
                        }

            logger.warning("No Competitor data found in SIF even after sync.")
            return {
                "error": "No Competitor data found. Please complete onboarding.",
                "source": "empty"
            }

        except Exception as e:
            logger.error(f"Failed to get Competitor context via SIF: {e}")
            return {"error": str(e)}

    async def get_semantic_insights(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get semantic insights with intelligent caching.
        
        Args:
            website_data: User website analysis data
            
        Returns:
            Semantic insights with caching metadata
        """
        try:
            logger.info(f"Getting semantic insights for user {self.user_id}")
            
            # Check cache first
            if self.enable_caching and self.cache_manager:
                cached_insights = self.cache_manager.get_cached_semantic_insights(
                    user_id=self.user_id,
                    force_refresh=False
                )
                
                if cached_insights:
                    logger.info("Returning cached semantic insights")
                    return {
                        "insights": cached_insights,
                        "source": "cache",
                        "cached_at": cached_insights.get("timestamp", "unknown"),
                        "cache_hit": True
                    }
            
            # Generate new insights if cache miss or caching disabled
            logger.info("Generating new semantic insights")
            
            # Perform semantic analysis
            insights = await self._generate_semantic_insights(website_data)
            
            # Cache the results
            if self.enable_caching and self.cache_manager:
                self.cache_manager.cache_semantic_insights(
                    user_id=self.user_id,
                    insights=insights,
                    ttl=3600,  # 1 hour TTL
                    metadata={
                        "generated_at": datetime.now().isoformat(),
                        "website_data_hash": hash(str(website_data)),
                        "analysis_version": "v2.0"
                    }
                )
                logger.info("Cached new semantic insights")
            
            return {
                "insights": insights,
                "source": "analysis",
                "generated_at": datetime.now().isoformat(),
                "cache_hit": False
            }
            
        except Exception as e:
            logger.error(f"Failed to get semantic insights: {e}")
            return {
                "insights": {},
                "error": str(e),
                "source": "error"
            }
    
    async def _generate_semantic_insights(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate semantic insights using multiple analysis methods."""
        try:
            insights = {
                "user_id": self.user_id,
                "timestamp": datetime.now().isoformat(),
                "analysis_version": "v2.0"
            }
            
            # Content pillar analysis
            if self.intelligence_service.is_initialized():
                clusters = await self.intelligence_service.cluster(min_score=0.6)
                if asyncio.iscoroutine(clusters):
                    clusters = await clusters
                insights["content_pillars"] = self._format_clusters_as_pillars(clusters)
                
                # Semantic gaps analysis
                gaps = await self._identify_semantic_gaps(website_data)
                insights["semantic_gaps"] = gaps
                
                # Competitor comparison
                competitor_analysis = await self._analyze_competitor_semantics(website_data)
                insights["competitor_analysis"] = competitor_analysis
            
            # Strategic recommendations (lazy initialization to avoid circular imports)
            if not self.strategy_agent:
                from .sif_agents import StrategyArchitectAgent
                self.strategy_agent = StrategyArchitectAgent(self.intelligence_service, user_id=self.user_id)
            recommendations = await self.strategy_agent.analyze_content_strategy(website_data)
            insights["strategic_recommendations"] = recommendations
            
            # Content quality assessment (lazy initialization to avoid circular imports)
            if not self.guardian_agent:
                from services.intelligence.agents.specialized import ContentGuardianAgent
                self.guardian_agent = ContentGuardianAgent(self.intelligence_service, user_id=self.user_id, sif_service=self)
            quality_score = await self.guardian_agent.assess_content_quality(website_data)
            insights["content_quality"] = quality_score
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate semantic insights: {e}")
            return {"error": str(e)}
    
    def _format_clusters_as_pillars(self, clusters: List[List[int]]) -> List[Dict[str, Any]]:
        """Format clustering results as content pillars."""
        pillars = []
        
        for i, cluster in enumerate(clusters):
            if cluster:  # Only include non-empty clusters
                pillar = {
                    "pillar_id": f"pillar_{i}",
                    "size": len(cluster),
                    "relevance_score": 0.8,  # Placeholder - would be calculated
                    "key_topics": [f"topic_{j}" for j in range(min(5, len(cluster)))],
                    "competitor_coverage": 0.6,  # Placeholder
                    "user_coverage": 0.4  # Placeholder
                }
                pillars.append(pillar)
        
        return pillars
    
    async def analyze_content_pillars(self) -> Dict[str, Any]:
        """Identify content pillars from the indexed content via clustering.

        Returns a dict with ``pillars`` (formatted clusters) and
        ``pillar_count``. This is the source of truth for the SIF panel's
        "Pillars found" stat and for the "analysis pending" vs "complete"
        status used by the frontend.
        """
        try:
            if not self.intelligence_service.is_initialized():
                logger.warning(f"[SIF] Intelligence service not initialized for user {self.user_id}; cannot analyze pillars")
                return {"pillars": [], "pillar_count": 0, "error": "service not initialized"}

            clusters = await self.intelligence_service.cluster(min_score=0.6)
            if asyncio.iscoroutine(clusters):
                clusters = await clusters
            pillars = self._format_clusters_as_pillars(clusters or [])
            return {"pillars": pillars, "pillar_count": len(pillars)}
        except Exception as e:
            logger.error(f"[SIF] Failed to analyze content pillars: {e}")
            return {"pillars": [], "pillar_count": 0, "error": str(e)}

    async def _identify_semantic_gaps(self, website_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify semantic gaps using StrategyArchitectAgent evidence-driven analysis."""
        try:
            if not self.strategy_agent:
                from .sif_agents import StrategyArchitectAgent
                self.strategy_agent = StrategyArchitectAgent(self.intelligence_service, user_id=self.user_id)

            competitor_ids = website_data.get("competitor_indices", []) or []
            gaps = await self.strategy_agent.find_semantic_gaps(competitor_indices=competitor_ids)

            normalized_gaps = []
            for gap in gaps:
                density = gap.get("topic_density", {})
                normalized_gaps.append({
                    "topic": gap.get("topic"),
                    "priority": gap.get("priority", "medium"),
                    "reason": gap.get("reason", "Competitor coverage gap"),
                    "confidence": gap.get("confidence", 0.0),
                    "current_coverage_score": density.get("user", 0.0),
                    "competitor_coverage_score": density.get("competitor", 0.0),
                    "gap_severity": gap.get("priority", "medium"),
                    "suggested_action": f"Create dedicated content for '{gap.get('topic', 'this topic')}'",
                    "topic_density": density,
                    "evidence": gap.get("evidence", {})
                })

            return normalized_gaps

        except Exception as e:
            logger.error(f"Error identifying semantic gaps: {e}")
            return []
    
    async def _analyze_competitor_semantics(self, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze competitor semantic positioning."""
        # This would perform actual competitor analysis
        return {
            "total_competitors_analyzed": 5,
            "semantic_overlap": 0.65,
            "unique_positioning": ["AI-powered content", "Data-driven insights"],
            "competitive_advantages": ["Technical depth", "Industry expertise"],
            "threats": ["Large competitor budgets", "Established brand presence"]
        }
    
# Integration with existing API endpoints
class SIFIntegrationAPI:
    """API wrapper for SIF operations with caching integration."""
    
    def __init__(self):
        self.services: Dict[str, SIFIntegrationService] = {}
    
    def get_service(self, user_id: str) -> Optional[SIFIntegrationService]:
        """Get or create SIF service for a user."""
        if not has_onboarding_session(user_id):
            logger.debug(
                "Skipping SIF service creation for user {} via SIFIntegrationAPI: no onboarding session",
                user_id,
            )
            return None
        if user_id not in self.services:
            self.services[user_id] = SIFIntegrationService(user_id)
        return self.services[user_id]
    
    async def get_semantic_insights_with_cache(self, user_id: str, website_data: Dict[str, Any]) -> Dict[str, Any]:
        """Get semantic insights with caching metadata."""
        service = self.get_service(user_id)
        if not service:
            return {
                "source": "skipped",
                "reason": "no_onboarding_session",
                "insights": {},
            }
        return await service.get_semantic_insights(website_data)
    
    async def get_cache_performance(self, user_id: str) -> Dict[str, Any]:
        """Get cache performance metrics for a user."""
        service = self.get_service(user_id)
        if not service:
            return {
                "user_id": user_id,
                "cache_enabled": False,
                "performance": {},
                "reason": "no_onboarding_session",
                "timestamp": datetime.now().isoformat(),
            }
        stats = service.get_cache_performance_stats()
        
        return {
            "user_id": user_id,
            "cache_enabled": stats is not None,
            "performance": stats or {},
            "timestamp": datetime.now().isoformat()
        }
    
    async def invalidate_user_cache(self, user_id: str, reason: str = "api_request") -> Dict[str, Any]:
        """Invalidate cache for a specific user."""
        service = self.get_service(user_id)
        if not service:
            return {
                "user_id": user_id,
                "success": False,
                "reason": "no_onboarding_session",
                "timestamp": datetime.now().isoformat(),
            }
        success = await service.invalidate_user_cache(reason)
        
        return {
            "user_id": user_id,
            "success": success,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        }


# Global API instance
sif_integration_api = SIFIntegrationAPI()


# Example usage and testing
async def test_sif_integration_service():
    """Test the SIF integration service with caching."""
    logger.info("Testing SIF Integration Service with Caching")
    
    # Create test service
    user_id = "test_user_123"
    service = SIFIntegrationService(user_id, enable_caching=True)
    
    # Test data
    website_data = {
        "url": "https://example.com",
        "content": [
            {"title": "SEO Best Practices", "content": "Learn about search engine optimization..."},
            {"title": "Content Marketing", "content": "Discover content marketing strategies..."}
        ],
        "competitors": [
            {"url": "https://competitor1.com", "name": "Competitor 1"},
            {"url": "https://competitor2.com", "name": "Competitor 2"}
        ]
    }
    
    # First call - should generate new insights
    logger.info("First call (cache miss expected):")
    result1 = await service.get_semantic_insights(website_data)
    logger.info(f"Source: {result1.get('source')}")
    logger.info(f"Cache hit: {result1.get('cache_hit')}")
    
    # Second call - should hit cache
    logger.info("\nSecond call (cache hit expected):")
    result2 = await service.get_semantic_insights(website_data)
    logger.info(f"Source: {result2.get('source')}")
    logger.info(f"Cache hit: {result2.get('cache_hit')}")
    
    # Get cache performance stats
    logger.info("\nCache Performance Stats:")
    stats = service.get_cache_performance_stats()
    if stats:
        logger.info(f"Hit rate: {stats['hit_rate']:.2%}")
        logger.info(f"Total hits: {stats['total_hits']}")
        logger.info(f"Total misses: {stats['total_misses']}")
        logger.info(f"Memory usage: {stats['memory_usage_mb']:.2f} MB")
    
    logger.info("SIF Integration Service test completed successfully!")


if __name__ == "__main__":
    # Run test
    asyncio.run(test_sif_integration_service())
