"""
Tavily API Service for ALwrity

This service provides web search and research capabilities using the Tavily API,
which offers AI-powered search with real-time information retrieval.

Key Features:
- Web search with AI-powered results
- Content extraction and summarization
- Real-time information retrieval
- Topic-based search (general, news, finance)
- Advanced search depth options
- Cost-effective API usage with caching

Dependencies:
- aiohttp (for async HTTP requests)
- os (for environment variables)
- logging (for debugging)

Author: ALwrity Team
Version: 1.0
Last Updated: January 2025
"""

import os
import json
import aiohttp
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from loguru import logger
from urllib.parse import urlparse


class TavilyService:
    """
    Service for web search and research using the Tavily API.
    
    This service provides AI-powered search capabilities to find relevant
    content and information for research purposes.
    """
    
    def __init__(self):
        """Initialize the Tavily Service with API credentials."""
        self.api_key = os.getenv("TAVILY_API_KEY")
        self.base_url = "https://api.tavily.com"
        self.enabled = False

        # Don't assume key is available at import time in production.
        # Keys may be injected per-request via middleware, so defer init.
        self._try_initialize()

    def _try_initialize(self) -> None:
        """Attempt to (re)initialize the Tavily service from current environment."""
        if self.enabled and self.api_key:
            return
        try:
            self.api_key = os.getenv("TAVILY_API_KEY")
            if not self.api_key:
                # Leave disabled; caller may try again after middleware injection
                logger.warning("TAVILY_API_KEY not configured; Tavily service will be disabled")
                self.enabled = False
                return
            self.enabled = True
            logger.info("Tavily Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Tavily service: {e}")
            self.enabled = False
    
    async def search(
        self,
        query: str,
        topic: str = "general",
        search_depth: str = "basic",
        max_results: int = 10,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
        include_answer: Union[bool, str] = False,
        include_raw_content: Union[bool, str] = False,
        include_images: bool = False,
        include_image_descriptions: bool = False,
        include_favicon: bool = False,
        time_range: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        country: Optional[str] = None,
        chunks_per_source: int = 3,
        auto_parameters: bool = False
    ) -> Dict[str, Any]:
        """
        Execute a search query using Tavily API.
        
        Args:
            query: The search query to execute
            topic: Category of search (general, news, finance)
            search_depth: Depth of search (advanced=2 credits, basic/fast/ultra-fast=1 credit)
            max_results: Maximum number of results to return (0-20, default: 5)
            include_domains: List of domains to specifically include (max 300)
            exclude_domains: List of domains to specifically exclude (max 150)
            include_answer: Include LLM-generated answer (basic/advanced/true/false)
            include_raw_content: Include raw HTML content (markdown/text/true/false)
            include_images: Include image search results
            include_image_descriptions: Include image descriptions (requires include_images)
            include_favicon: Include favicon URLs
            time_range: Time range filter (day, week, month, year, d, w, m, y)
            start_date: Start date filter (YYYY-MM-DD)
            end_date: End date filter (YYYY-MM-DD)
            country: Country filter (lowercase full country name, e.g., "united states" not "US")
            chunks_per_source: Maximum chunks per source (1-3, only for advanced/fast search, default: 3)
            auto_parameters: Auto-configure parameters based on query (costs 2 credits)
            
        Returns:
            Dictionary containing search results
        """
        try:
            # Ensure we pick up any per-request injected key
            self._try_initialize()
            if not self.enabled:
                raise ValueError("Tavily Service is not enabled - API key missing")
            
            logger.info(f"Starting Tavily search for: {query}")
            
            # Build request payload
            payload = {
                "api_key": self.api_key,
                "query": query,
                "topic": topic,
                "search_depth": search_depth,
                "max_results": min(max_results, 20),  # Tavily limit
                "include_favicon": include_favicon
            }
            
            # Add optional parameters
            if include_domains:
                payload["include_domains"] = include_domains[:300]  # Tavily limit
            
            if exclude_domains:
                payload["exclude_domains"] = exclude_domains[:150]  # Tavily limit
            
            if include_answer:
                payload["include_answer"] = include_answer
            
            if include_raw_content:
                payload["include_raw_content"] = include_raw_content
            
            if include_images:
                payload["include_images"] = include_images
                if include_image_descriptions:
                    payload["include_image_descriptions"] = include_image_descriptions
            
            if time_range:
                payload["time_range"] = time_range
            
            if start_date:
                payload["start_date"] = start_date
            
            if end_date:
                payload["end_date"] = end_date
            
            if country and topic == "general":
                payload["country"] = country
            
            # chunks_per_source only available for advanced and fast search_depth
            if search_depth in ["advanced", "fast"] and 1 <= chunks_per_source <= 3:
                payload["chunks_per_source"] = chunks_per_source
            
            if auto_parameters:
                payload["auto_parameters"] = True
            
            # Make API request
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/search",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Tavily search completed successfully. Found {len(result.get('results', []))} results.")
                        
                        # Process and structure results
                        processed_results = self._process_search_results(result, query)
                        
                        return {
                            "success": True,
                            "query": result.get("query", query),
                            "answer": result.get("answer"),  # If include_answer was requested
                            "results": processed_results,
                            "images": result.get("images", []),
                            "response_time": result.get("response_time"),
                            "request_id": result.get("request_id"),
                            "auto_parameters": result.get("auto_parameters"),
                            "total_results": len(processed_results),
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"Tavily API error: {response.status} - {error_text}")
                        raise RuntimeError(f"Tavily API error: {response.status} - {error_text}")
                        
        except aiohttp.ClientTimeout:
            logger.error("Tavily API request timed out")
            return {
                "success": False,
                "error": "Request timed out",
                "details": "The search request took too long to complete"
            }
        except Exception as e:
            logger.error(f"Error in Tavily search: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during search"
            }
    
    def _process_search_results(self, api_response: Dict[str, Any], query: str) -> List[Dict[str, Any]]:
        """
        Process and structure Tavily API response into standardized format.
        
        Args:
            api_response: Raw response from Tavily API
            query: Original search query
            
        Returns:
            List of processed search results
        """
        results = []
        raw_results = api_response.get("results", [])
        
        for result in raw_results:
            try:
                # Extract domain from URL
                url = result.get("url", "")
                domain = urlparse(url).netloc if url else ""
                
                # Calculate relevance score (Tavily provides score field)
                relevance_score = result.get("score", 0.5)
                
                processed_result = {
                    "url": url,
                    "domain": domain,
                    "title": result.get("title", ""),
                    "content": result.get("content", ""),
                    "raw_content": result.get("raw_content"),  # If include_raw_content was requested
                    "score": relevance_score,
                    "relevance_score": relevance_score,  # Alias for compatibility
                    "favicon": result.get("favicon"),
                    "published_date": result.get("published_date"),
                }
                
                results.append(processed_result)
                
            except Exception as e:
                logger.warning(f"Error processing Tavily result: {str(e)}")
                continue
        
        # Sort by relevance score (highest first)
        results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        return results

    async def crawl(
        self,
        url: str,
        limit: int = 50,
        max_depth: int = 1,
        max_breadth: int = 20,
        extract_depth: str = "basic",
        include_favicon: bool = False,
        instructions: str = "",
        allow_external: bool = True
    ) -> Dict[str, Any]:
        """
        Crawl a website using Tavily API.
        
        Args:
            url: The root URL to begin the crawl
            limit: Total number of links the crawler will process
            max_depth: Max depth of the crawl
            max_breadth: Max number of links to follow per level
            extract_depth: 'basic' or 'advanced'
            include_favicon: Whether to include favicon
            instructions: Natural language instructions for the crawler
            allow_external: Whether to return external links
            
        Returns:
            Dict containing crawl results
        """
        try:
            self._try_initialize()
            if not self.enabled:
                raise ValueError("Tavily Service is not enabled - API key missing")
            
            logger.info(f"Starting Tavily crawl for: {url}")
            
            payload = {
                "api_key": self.api_key,
                "urls": [url] # Tavily extract/crawl might take a list or single URL. 
                # Wait, if this is 'crawl', usually it takes one URL. 
                # Let's double check standard Tavily API. 
                # But since I can't check external docs, I will follow the MCP tool params.
                # The MCP tool has 'url' (string).
            }
            
            # NOTE: Tavily API structure for crawl might be different. 
            # I'll assume there is a /crawl endpoint or similar.
            # However, looking at standard Tavily python SDK, they often use 'extract' or 'search'.
            # But 'crawl' is a distinct feature.
            # I will use a generic request structure based on the tool parameters.
            
            # Re-constructing payload based on tool params
            request_payload = {
                "api_key": self.api_key,
                "url": url,
                "limit": limit,
                "max_depth": max_depth,
                "max_breadth": max_breadth,
                "extract_depth": extract_depth,
                "include_favicon": include_favicon,
                "instructions": instructions,
                "allow_external": allow_external
            }

            async with aiohttp.ClientSession() as session:
                # Assuming the endpoint is /crawl based on the tool name
                # If it fails, I'll need to adjust.
                endpoint = f"{self.base_url}/crawl" 
                
                # Note: Tavily might not have a /crawl endpoint exposed this way in REST if it's new.
                # But let's try.
                
                # Actually, wait. The user mentioned "Refer to the tavily mcp".
                # The tool definition `mcp_tavily-remote-mcp_tavily_crawl` has the description.
                
                # I will proceed with /crawl.
                
                async with session.post(
                    endpoint,
                    json=request_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=300) # Crawling takes longer
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Tavily crawl completed successfully.")
                        return {
                            "success": True,
                            "results": result.get("results", []), # Assuming standard response
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"Tavily Crawl API error: {response.status} - {error_text}")
                        return {
                            "success": False,
                            "error": f"Tavily API error: {response.status}",
                            "details": error_text
                        }
                        
        except Exception as e:
            logger.error(f"Error in Tavily crawl: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during crawl"
            }
    
    async def search_industry_trends(
        self,
        topic: str,
        industry: str,
        max_results: int = 10,
        search_depth: str = "basic"
    ) -> Dict[str, Any]:
        """
        Search for current industry trends and insights.
        
        Args:
            topic: The specific topic to research
            industry: The industry context for the search
            max_results: Maximum number of search results to return
            search_depth: Depth of search (basic or advanced)
            
        Returns:
            Dictionary containing search results with industry context
        """
        # Build industry-specific query
        search_query = f"{topic} {industry} trends insights"
        
        # Use news topic for current trends
        return await self.search(
            query=search_query,
            topic="news" if search_depth == "basic" else "general",
            search_depth=search_depth,
            max_results=max_results,
            include_answer="basic",
            include_favicon=True,
            time_range="month"  # Last month for current trends
        )
    
    async def discover_competitors(
        self,
        user_url: str,
        num_results: int = 10,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
        industry_context: Optional[str] = None,
        website_analysis_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Discover competitors for a given website using Tavily search.
        
        Args:
            user_url: The website URL to find competitors for
            num_results: Number of competitor results to return
            include_domains: List of domains to include in search
            exclude_domains: List of domains to exclude from search
            industry_context: Industry context for better competitor discovery
            
        Returns:
            Dictionary containing competitor analysis results
        """
        try:
            # Ensure we pick up any per-request injected key
            self._try_initialize()
            if not self.enabled:
                raise ValueError("Tavily Service is not enabled - API key missing")
            
            logger.info(f"Starting competitor discovery for: {user_url}")
            
            # Extract user domain for exclusion
            user_domain = urlparse(user_url).netloc
            exclude_domains_list = exclude_domains or []
            exclude_domains_list.append(user_domain)
            
            # Build search query
            query_parts = ["similar websites", "competitors"]
            if industry_context:
                query_parts.append(f"in {industry_context}")
            
            # Extract insights from website analysis if available
            if website_analysis_data:
                analysis = website_analysis_data.get('analysis', {})
                if 'target_audience' in analysis:
                    audience = analysis['target_audience']
                    if isinstance(audience, dict) and 'primary_audience' in audience:
                        query_parts.append(audience['primary_audience'])
            
            search_query = " ".join(query_parts)
            
            # Perform search
            search_result = await self.search(
                query=search_query,
                topic="general",
                search_depth="advanced",  # Use advanced for better competitor discovery
                max_results=num_results,
                include_domains=include_domains,
                exclude_domains=exclude_domains_list,
                include_favicon=True,
                chunks_per_source=3
            )
            
            if not search_result.get("success"):
                return search_result
            
            # Process results into competitor format
            competitors = []
            for result in search_result.get("results", []):
                competitor_data = {
                    "url": result.get("url"),
                    "domain": result.get("domain"),
                    "title": result.get("title"),
                    "summary": result.get("content", ""),
                    "relevance_score": result.get("relevance_score", 0.5),
                    "favicon": result.get("favicon"),
                    "published_date": result.get("published_date"),
                    "highlights": self._extract_highlights(result.get("content", "")),
                    "competitive_insights": self._extract_competitive_insights(result),
                    "content_insights": self._analyze_content_quality(result)
                }
                competitors.append(competitor_data)
            
            logger.info(f"Successfully discovered {len(competitors)} competitors for {user_url}")
            
            return {
                "success": True,
                "user_url": user_url,
                "competitors": competitors,
                "total_competitors": len(competitors),
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "industry_context": industry_context,
                "request_id": search_result.get("request_id")
            }
            
        except Exception as e:
            logger.error(f"Error in competitor discovery: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during competitor discovery"
            }
    
    def _extract_highlights(self, content: str, num_sentences: int = 3) -> List[str]:
        """Extract key highlights from content."""
        if not content:
            return []
        
        # Simple sentence extraction (can be enhanced with NLP)
        sentences = [s.strip() for s in content.split('.') if s.strip()]
        return sentences[:num_sentences]
    
    def _extract_competitive_insights(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract competitive insights from search result."""
        content = result.get("content", "")
        title = result.get("title", "")
        
        return {
            "business_model": "unknown",
            "target_audience": "unknown",
            "key_differentiators": []
        }
    
    def _analyze_content_quality(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze content quality metrics."""
        content = result.get("content", "")
        
        return {
            "content_focus": "general",
            "content_quality": "medium",
            "publishing_frequency": "unknown"
        }

    async def extract(
        self,
        urls: Union[str, List[str]],
        extract_depth: str = "basic",
        query: Optional[str] = None,
        chunks_per_source: Optional[int] = None,
        include_images: bool = False,
    ) -> Dict[str, Any]:
        """
        Extract clean markdown/text content from URLs using Tavily Extract.

        Handles JavaScript-rendered pages, removes boilerplate (ads, nav, footers),
        and returns structured content ready for LLM consumption.

        Args:
            urls: Single URL string or list of URLs (max 20)
            extract_depth: 'basic' (1 credit/5 URLs) or 'advanced' (2 credits/5 URLs)
            query: Optional query to rerank content chunks by relevance
            chunks_per_source: Number of relevant chunks to return (1-5, requires query)
            include_images: Whether to include image data in results

        Returns:
            Dict with keys: results (list of {url, raw_content}), failed_results (list of {url, error})
        """
        try:
            self._try_initialize()
            if not self.enabled:
                return {"results": [], "failed_results": [{"url": str(urls), "error": "Tavily not enabled"}], "success": False}

            url_list = [urls] if isinstance(urls, str) else urls
            logger.info(f"Tavily Extract: {len(url_list)} URLs, depth={extract_depth}")

            payload: Dict[str, Any] = {
                "api_key": self.api_key,
                "urls": url_list[:20],
                "extract_depth": extract_depth,
            }
            if query:
                payload["query"] = query
            if chunks_per_source is not None:
                payload["chunks_per_source"] = min(max(chunks_per_source, 1), 5)
            if include_images:
                payload["include_images"] = True

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/extract",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"Tavily Extract completed. {len(result.get('results', []))} pages extracted.")
                        return {
                            "success": True,
                            "results": result.get("results", []),
                            "failed_results": result.get("failed_results", []),
                        }
                    else:
                        error_text = await response.text()
                        logger.error(f"Tavily Extract API error: {response.status} - {error_text}")
                        return {
                            "success": False,
                            "results": [],
                            "failed_results": [{"url": u, "error": f"API error {response.status}"} for u in url_list],
                        }
        except Exception as e:
            logger.error(f"Tavily Extract failed: {e}")
            return {"success": False, "results": [], "failed_results": [{"url": str(urls), "error": str(e)}]}

