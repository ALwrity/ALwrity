"""
Tavily Research Provider

AI-powered search implementation using Tavily API for high-quality research.
"""

import os
from loguru import logger
from models.subscription_models import APIProvider
from services.research.tavily_service import TavilyService
from .base_provider import ResearchProvider as BaseProvider


class TavilyResearchProvider(BaseProvider):
    """Tavily AI-powered search provider."""
    
    def __init__(self):
        self.api_key = os.getenv("TAVILY_API_KEY")
        if not self.api_key:
            raise RuntimeError("TAVILY_API_KEY not configured")
        self.tavily_service = TavilyService()
        logger.debug("✅ Tavily Research Provider initialized")
    
    async def search(self, prompt, topic, industry, target_audience, config, user_id):
        """Execute Tavily search and return standardized results."""
        # Build Tavily query
        query = f"{topic} {industry} {target_audience}"
        
        # Get Tavily-specific config options
        topic = config.tavily_topic or "general"
        search_depth = config.tavily_search_depth or "basic"
        
        logger.info(f"[Tavily Research] Executing search: {query}")
        
        # Execute Tavily search
        result = await self.tavily_service.search(
            query=query,
            topic=topic,
            search_depth=search_depth,
            max_results=min(config.max_sources, 20),
            include_domains=config.tavily_include_domains or None,
            exclude_domains=config.tavily_exclude_domains or None,
            include_answer=config.tavily_include_answer or False,
            include_raw_content=config.tavily_include_raw_content or False,
            include_images=config.tavily_include_images or False,
            include_image_descriptions=config.tavily_include_image_descriptions or False,
            time_range=config.tavily_time_range,
            start_date=config.tavily_start_date,
            end_date=config.tavily_end_date,
            country=config.tavily_country,
            chunks_per_source=config.tavily_chunks_per_source or 3,
            auto_parameters=config.tavily_auto_parameters or False
        )
        
        if not result.get("success"):
            raise RuntimeError(f"Tavily search failed: {result.get('error', 'Unknown error')}")
        
        # Transform to standardized format
        sources = self._transform_sources(result.get("results", []))
        content = self._aggregate_content(result.get("results", []))
        
        # Calculate cost (basic = 1 credit, advanced = 2 credits)
        cost = 0.001 if search_depth == "basic" else 0.002  # Estimate cost per search
        
        logger.info(f"[Tavily Research] Search completed: {len(sources)} sources, depth: {search_depth}")
        
        return {
            'sources': sources,
            'content': content,
            'search_type': search_depth,
            'provider': 'tavily',
            'search_queries': [query],
            'cost': {'total': cost},
            'answer': result.get("answer"),  # If include_answer was requested
            'images': result.get("images", [])
        }
    
    def get_provider_enum(self):
        """Return TAVILY provider enum for subscription tracking."""
        return APIProvider.TAVILY
    
    def estimate_tokens(self) -> int:
        """Estimate token usage for Tavily (not token-based, but we estimate API calls)."""
        return 0  # Tavily is per-search, not token-based
    
    def _transform_sources(self, results):
        """Transform Tavily results to ResearchSource format."""
        sources = []
        for idx, result in enumerate(results):
            source_type = self._determine_source_type(result.get("url", ""))
            
            sources.append({
                'title': result.get("title", ""),
                'url': result.get("url", ""),
                'excerpt': result.get("content", "")[:500],  # First 500 chars
                'credibility_score': result.get("relevance_score", 0.5),
                'published_at': result.get("published_date"),
                'index': idx,
                'source_type': source_type,
                'content': result.get("content", ""),
                'raw_content': result.get("raw_content"),  # If include_raw_content was requested
                'score': result.get("score", result.get("relevance_score", 0.5)),
                'favicon': result.get("favicon")
            })
        
        return sources
    
    def _determine_source_type(self, url):
        """Determine source type from URL."""
        if not url:
            return 'web'
        
        url_lower = url.lower()
        if 'arxiv.org' in url_lower or 'research' in url_lower or '.edu' in url_lower:
            return 'academic'
        elif any(news in url_lower for news in ['cnn.com', 'bbc.com', 'reuters.com', 'theguardian.com', 'nytimes.com']):
            return 'news'
        elif 'linkedin.com' in url_lower:
            return 'expert'
        elif '.gov' in url_lower:
            return 'government'
        else:
            return 'web'
    
    def _aggregate_content(self, results):
        """Aggregate content from Tavily results for LLM analysis."""
        content_parts = []
        
        for idx, result in enumerate(results):
            content = result.get("content", "")
            if content:
                content_parts.append(f"Source {idx + 1}: {content}")
        
        return "\n\n".join(content_parts)
    
    def track_tavily_usage(self, user_id: str, cost: float, search_depth: str):
        """Track Tavily API usage after successful call."""
        from services.database import get_session_for_user
        from services.subscription import PricingService
        from sqlalchemy import text
        
        db = get_session_for_user(user_id)
        if not db:
            logger.warning(f"[Tavily] Could not get DB session for user {user_id}, skipping usage tracking")
            return
        try:
            pricing_service = PricingService(db)
            current_period = pricing_service.get_current_billing_period(user_id)
            
            # Update tavily_calls and tavily_cost via SQL UPDATE
            update_query = text("""
                UPDATE usage_summaries 
                SET tavily_calls = COALESCE(tavily_calls, 0) + 1,
                    tavily_cost = COALESCE(tavily_cost, 0) + :cost,
                    total_calls = COALESCE(total_calls, 0) + 1,
                    total_cost = COALESCE(total_cost, 0) + :cost
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db.execute(update_query, {
                'cost': cost,
                'user_id': user_id,
                'period': current_period
            })
            db.commit()
            
            logger.info(f"[Tavily] Tracked usage: user={user_id}, cost=${cost}, depth={search_depth}")
        except Exception as e:
            logger.error(f"[Tavily] Failed to track usage: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()

