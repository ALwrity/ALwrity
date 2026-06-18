"""
Exa API Service for ALwrity

This service provides competitor discovery and analysis using the Exa API,
which uses neural search to find semantically similar websites and content.

Key Features:
- Competitor discovery using neural search
- Content analysis and summarization
- Competitive intelligence gathering
- Cost-effective API usage with caching
- Integration with onboarding Step 3

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
import asyncio
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from loguru import logger
from urllib.parse import urlparse
from exa_py import Exa

class ExaService:
    """
    Service for competitor discovery and analysis using the Exa API.
    
    This service provides neural search capabilities to find semantically similar
    websites and analyze their content for competitive intelligence.
    """
    
    def __init__(self, timeout_seconds: int = 30):
        """Initialize the Exa Service with API credentials."""
        self.api_key = os.getenv("EXA_API_KEY")
        self.exa = None
        self.enabled = False
        self.timeout_seconds = timeout_seconds

        # Don't assume key is available at import time in production.
        # Keys may be injected per-request via middleware, so defer init.
        self._try_initialize()

    async def _run_sync_with_timeout(self, func, *args, **kwargs):
        """Run a synchronous SDK call in a thread pool with a timeout."""
        loop = asyncio.get_event_loop()
        return await asyncio.wait_for(
            loop.run_in_executor(None, lambda: func(*args, **kwargs)),
            timeout=self.timeout_seconds
        )

    def _try_initialize(self) -> None:
        """Attempt to (re)initialize the Exa SDK from current environment."""
        if self.enabled and self.exa:
            return
        try:
            self.api_key = os.getenv("EXA_API_KEY")
            if not self.api_key:
                # Leave disabled; caller may try again after middleware injection
                logger.warning("EXA_API_KEY not configured; Exa service will be disabled")
                self.enabled = False
                self.exa = None
                return
            self.exa = Exa(api_key=self.api_key)
            self.enabled = True
            logger.info("Exa Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Exa service: {e}")
            self.enabled = False
            self.exa = None
    
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
        Discover competitors for a given website using Exa's neural search.
        
        Args:
            user_url: The website URL to find competitors for
            num_results: Number of competitor results to return (max 100)
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
                raise ValueError("Exa Service is not enabled - API key missing")
            
            logger.info(f"Starting competitor discovery for: {user_url}")
            
            # Extract user domain for exclusion
            user_domain = urlparse(user_url).netloc
            exclude_domains_list = exclude_domains or []
            exclude_domains_list.append(user_domain)
            
            logger.info(f"Excluding domains: {exclude_domains_list}")
            
            # Extract insights from website analysis for better targeting
            include_text_queries = []
            summary_query = f"Business model, target audience, content strategy{f' in {industry_context}' if industry_context else ''}"
            
            if website_analysis_data:
                analysis = website_analysis_data.get('analysis', {})
                
                # Extract key business terms from the analysis
                if 'target_audience' in analysis:
                    audience = analysis['target_audience']
                    if isinstance(audience, dict) and 'primary_audience' in audience:
                        primary_audience = audience['primary_audience']
                        if len(primary_audience.split()) <= 5:  # Exa limit
                            include_text_queries.append(primary_audience)
                
                # Use industry context from analysis
                if 'industry' in analysis and analysis['industry']:
                    industry = analysis['industry']
                    if len(industry.split()) <= 5:
                        include_text_queries.append(industry)
                
                # Enhance summary query with analysis insights
                if 'content_type' in analysis:
                    content_type = analysis['content_type']
                    summary_query += f", {content_type} content strategy"
                
                logger.info(f"Enhanced targeting with analysis data: {include_text_queries}")
            
            # Use the Exa SDK to find similar links with content and context
            search_result = await self._run_sync_with_timeout(
                self.exa.find_similar_and_contents,
                url=user_url,
                num_results=min(num_results, 10),  # Exa API limit
                include_domains=include_domains,
                exclude_domains=exclude_domains_list,
                include_text=include_text_queries if include_text_queries else None,
                text=True,
                highlights={
                    "numSentences": 2,
                    "highlightsPerUrl": 3,
                    "query": "Unique value proposition, competitive advantages, market position"
                },
                summary={
                    "query": summary_query
                }
            )
            
            # TODO: Add context generation once SDK supports it
            # For now, we'll generate a basic context from the results
            context_result = None
            
            # Log the raw Exa API response summary (avoiding verbose markdown content)
            logger.info(f"📊 Exa API response for {user_url}:")
            logger.info(f"  ├─ Request ID: {getattr(search_result, 'request_id', 'N/A')}")
            logger.info(f"  ├─ Results count: {len(getattr(search_result, 'results', []))}")
            logger.info(f"  └─ Cost: ${getattr(getattr(search_result, 'cost_dollars', None), 'total', 0)}")
            
            # Note: Full raw response contains verbose markdown content - logging only summary
            # To see full response, set EXA_DEBUG=true in environment
            
            # Extract results from search
            results = getattr(search_result, 'results', [])
            
            # Log summary of results
            logger.info(f"  - Found {len(results)} competitors")
            
            # Process and structure the results
            competitors = self._process_competitor_results(search_result, user_url)
            
            logger.info(f"Successfully discovered {len(competitors)} competitors for {user_url}")
            
            return {
                "success": True,
                "user_url": user_url,
                "competitors": competitors,
                "total_competitors": len(competitors),
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "industry_context": industry_context,
                "api_cost": getattr(getattr(search_result, 'cost_dollars', None), 'total', 0) if hasattr(search_result, 'cost_dollars') and getattr(search_result, 'cost_dollars', None) else 0,
                "request_id": getattr(search_result, 'request_id', None) if hasattr(search_result, 'request_id') else None
            }
                        
        except asyncio.TimeoutError:
            logger.error("Exa API request timed out")
            return {
                "success": False,
                "error": "Request timed out",
                "details": "The competitor discovery request took too long to complete"
            }
            
        except Exception as e:
            logger.error(f"Error in competitor discovery: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during competitor discovery"
            }
    
    def _process_competitor_results(self, search_result, user_url: str) -> List[Dict[str, Any]]:
        """
        Process and structure the Exa SDK response into competitor data.
        
        Args:
            search_result: Response from Exa SDK
            user_url: Original user URL for reference
            
        Returns:
            List of processed competitor data
        """
        competitors = []
        try:
            user_domain = urlparse(user_url).netloc
        except Exception:
            user_domain = ""
        
        # Extract results from the SDK response
        # Handle case where search_result might be a dict or an object
        if isinstance(search_result, dict):
            results = search_result.get('results', [])
        else:
            results = getattr(search_result, 'results', [])
        
        for result in results:
            try:
                # Helper to safely get attribute or dict key
                def get_val(obj, key, default=None):
                    if isinstance(obj, dict):
                        return obj.get(key, default)
                    return getattr(obj, key, default)

                # Extract basic information
                raw_url = get_val(result, 'url', '')
                # Clean URL (remove backticks and whitespace that might be in the response)
                competitor_url = raw_url.strip().strip('`').strip() if raw_url else ''
                
                # Fallback to ID if URL is missing/empty but ID looks like a URL
                if not competitor_url:
                    raw_id = get_val(result, 'id', '')
                    cleaned_id = raw_id.strip().strip('`').strip() if raw_id else ''
                    if cleaned_id and (cleaned_id.startswith('http://') or cleaned_id.startswith('https://')):
                        competitor_url = cleaned_id
                
                if not competitor_url:
                    continue

                try:
                    competitor_domain = urlparse(competitor_url).netloc
                except Exception:
                    competitor_domain = ""
                
                # Skip if it's the same domain as the user (fuzzy match)
                if user_domain and competitor_domain and (user_domain in competitor_domain or competitor_domain in user_domain):
                    continue
                
                # Extract content insights
                summary = get_val(result, 'summary', '')
                highlights = get_val(result, 'highlights', [])
                highlight_scores = get_val(result, 'highlight_scores', [])
                subpages = get_val(result, 'subpages', [])
                
                # Ensure subpages are dicts
                processed_subpages = []
                if subpages:
                    for sp in subpages:
                        if isinstance(sp, dict):
                            processed_subpages.append(sp)
                        elif hasattr(sp, '__dict__'):
                            processed_subpages.append(sp.__dict__)
                        else:
                            processed_subpages.append({
                                "id": getattr(sp, 'id', ''),
                                "url": getattr(sp, 'url', ''),
                                "title": getattr(sp, 'title', '')
                            })
                subpages = processed_subpages
                
                # Calculate competitive relevance score
                relevance_score = self._calculate_relevance_score(result, user_url)
                
                competitor_data = {
                    "url": competitor_url,
                    "domain": competitor_domain,
                    "title": get_val(result, 'title', ''),
                    "published_date": get_val(result, 'published_date', None),
                    "author": get_val(result, 'author', None),
                    "favicon": get_val(result, 'favicon', None),
                    "image": get_val(result, 'image', None),
                    "summary": summary,
                    "highlights": highlights,
                    "highlight_scores": highlight_scores,
                    "subpages": subpages,
                    "relevance_score": relevance_score,
                    "competitive_insights": self._extract_competitive_insights(summary, highlights),
                    "content_analysis": self._analyze_content_quality(result)
                }
                
                competitors.append(competitor_data)
                
            except Exception as e:
                logger.warning(f"Error processing competitor result: {str(e)}")
                continue
        
        # Sort by relevance score (highest first)
        competitors.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        return competitors
    
    def _calculate_relevance_score(self, result, user_url: str) -> float:
        """
        Calculate a relevance score for competitor ranking.
        
        Args:
            result: Competitor result from Exa SDK
            user_url: Original user URL
            
        Returns:
            Relevance score between 0 and 1
        """
        score = 0.0
        
        # Base score from highlight scores
        highlight_scores = getattr(result, 'highlight_scores', [])
        if highlight_scores:
            score += sum(highlight_scores) / len(highlight_scores) * 0.4
        
        # Score from summary quality
        summary = getattr(result, 'summary', '')
        if summary and len(summary) > 100:
            score += 0.3
        
        # Score from title relevance
        title = getattr(result, 'title', '').lower()
        if any(keyword in title for keyword in ["business", "company", "service", "solution", "platform"]):
            score += 0.2
        
        # Score from URL structure similarity
        competitor_url = getattr(result, 'url', '')
        if self._url_structure_similarity(user_url, competitor_url) > 0.5:
            score += 0.1
        
        return min(score, 1.0)
    
    def _url_structure_similarity(self, url1: str, url2: str) -> float:
        """
        Calculate URL structure similarity.
        
        Args:
            url1: First URL
            url2: Second URL
            
        Returns:
            Similarity score between 0 and 1
        """
        try:
            parsed1 = urlparse(url1)
            parsed2 = urlparse(url2)
            
            # Compare path structure
            path1_parts = [part for part in parsed1.path.split('/') if part]
            path2_parts = [part for part in parsed2.path.split('/') if part]
            
            if not path1_parts or not path2_parts:
                return 0.0
            
            # Calculate similarity based on path length and structure
            max_parts = max(len(path1_parts), len(path2_parts))
            common_parts = sum(1 for p1, p2 in zip(path1_parts, path2_parts) if p1 == p2)
            
            return common_parts / max_parts
            
        except Exception:
            return 0.0
    
    def _extract_competitive_insights(self, summary: str, highlights: List[str]) -> Dict[str, Any]:
        """
        Extract competitive insights from summary and highlights.
        
        Args:
            summary: Content summary
            highlights: Content highlights
            
        Returns:
            Dictionary of competitive insights
        """
        insights = {
            "business_model": "",
            "target_audience": "",
            "value_proposition": "",
            "competitive_advantages": [],
            "content_strategy": ""
        }
        
        # Combine summary and highlights for analysis
        content = f"{summary} {' '.join(highlights)}".lower()
        
        # Extract business model indicators
        business_models = ["saas", "platform", "service", "product", "consulting", "agency", "marketplace"]
        for model in business_models:
            if model in content:
                insights["business_model"] = model.title()
                break
        
        # Extract target audience indicators
        audiences = ["enterprise", "small business", "startups", "developers", "marketers", "consumers"]
        for audience in audiences:
            if audience in content:
                insights["target_audience"] = audience.title()
                break
        
        # Extract value proposition from highlights
        if highlights:
            insights["value_proposition"] = highlights[0][:100] + "..." if len(highlights[0]) > 100 else highlights[0]
        
        return insights
    
    def _analyze_content_quality(self, result) -> Dict[str, Any]:
        """
        Analyze the content quality of a competitor.
        
        Args:
            result: Competitor result from Exa SDK
            
        Returns:
            Dictionary of content quality metrics
        """
        quality_metrics = {
            "content_depth": "medium",
            "technical_sophistication": "medium",
            "content_freshness": "unknown",
            "engagement_potential": "medium"
        }
        
        # Analyze content depth from summary length
        summary = getattr(result, 'summary', '')
        if len(summary) > 300:
            quality_metrics["content_depth"] = "high"
        elif len(summary) < 100:
            quality_metrics["content_depth"] = "low"
        
        # Analyze technical sophistication
        technical_keywords = ["api", "integration", "automation", "analytics", "data", "platform"]
        highlights = getattr(result, 'highlights', [])
        content_text = f"{summary} {' '.join(highlights)}".lower()
        
        technical_count = sum(1 for keyword in technical_keywords if keyword in content_text)
        if technical_count >= 3:
            quality_metrics["technical_sophistication"] = "high"
        elif technical_count == 0:
            quality_metrics["technical_sophistication"] = "low"
        
        return quality_metrics
    
    async def discover_social_media_accounts(self, user_url: str) -> Dict[str, Any]:
        """
        Discover social media accounts for a given website using Exa's answer API.
        
        Args:
            user_url: The website URL to find social media accounts for
            
        Returns:
            Dictionary containing social media discovery results
        """
        try:
            # Ensure we pick up any per-request injected key
            self._try_initialize()
            if not self.enabled:
                raise ValueError("Exa Service is not enabled - API key missing")
            
            logger.info(f"Starting social media discovery for: {user_url}")
            
            # Extract domain from URL for better targeting
            domain = urlparse(user_url).netloc.replace('www.', '')
            
            # Use Exa's answer API to find social media accounts
            result = await self._run_sync_with_timeout(
                self.exa.answer,
                f"Find all social media accounts of the url: {domain}. Return a JSON object with facebook, twitter, instagram, linkedin, youtube, and tiktok fields containing the URLs or empty strings if not found.",
                model="exa-pro",
                text=True
            )
            
            # Log the raw Exa API response for debugging
            logger.info(f"Raw Exa social media response for {user_url}:")
            if hasattr(result, 'to_json'):
                 logger.info(result.to_json())
            else:
                 logger.info(str(result))

            logger.info(f"  - Request ID: {getattr(result, 'request_id', 'N/A')}")
            logger.info(f"  └─ Cost: ${getattr(getattr(result, 'cost_dollars', None), 'total', 0)}")
            # Note: Full raw response contains verbose content - logging only summary
            # To see full response, set EXA_DEBUG=true in environment
            
            # Extract social media data
            answer_text = getattr(result, 'answer', '')
            citations = getattr(result, 'citations', [])
            
            # Convert AnswerResult objects to dictionaries for JSON serialization
            citations_dicts = []
            for citation in citations:
                if hasattr(citation, '__dict__'):
                    # Convert object to dictionary
                    citation_dict = {
                        'id': getattr(citation, 'id', ''),
                        'title': getattr(citation, 'title', ''),
                        'url': getattr(citation, 'url', ''),
                        'text': getattr(citation, 'text', ''),
                        'snippet': getattr(citation, 'snippet', ''),
                        'published_date': getattr(citation, 'published_date', None),
                        'author': getattr(citation, 'author', None),
                        'image': getattr(citation, 'image', None),
                        'favicon': getattr(citation, 'favicon', None)
                    }
                    citations_dicts.append(citation_dict)
                else:
                    # If it's already a dict, use as is
                    citations_dicts.append(citation)
            
            logger.info(f"  - Raw answer text: {answer_text}")
            logger.info(f"  - Citations count: {len(citations_dicts)}")
            
            # Parse the response from the answer (could be JSON or markdown format)
            try:
                import json
                import re
                
                logger.warning(f"Parsing Exa answer text: {answer_text[:200]}...")

                # Clean markdown code blocks if present
                clean_text = answer_text.strip()
                if clean_text.startswith('```json'):
                    clean_text = clean_text[7:]
                if clean_text.startswith('```'):
                    clean_text = clean_text[3:]
                if clean_text.endswith('```'):
                    clean_text = clean_text[:-3]
                
                clean_text = clean_text.strip()

                if clean_text.startswith('{'):
                    # Direct JSON format
                    answer_data = json.loads(clean_text)
                    # Normalize all values to strings — Exa may return 1/true for platforms without URLs
                    answer_data = {k: str(v).strip() if v else '' for k, v in answer_data.items()}
                else:
                    # Parse markdown format with URLs
                    answer_data = {
                        "facebook": "",
                        "twitter": "",
                        "instagram": "",
                        "linkedin": "",
                        "youtube": "",
                        "tiktok": ""
                    }
                    
                    # Extract URLs using regex patterns
                    facebook_match = re.search(r'Facebook.*?\[([^\]]+)\]', answer_text)
                    if facebook_match:
                        answer_data["facebook"] = facebook_match.group(1)
                    
                    twitter_match = re.search(r'Twitter.*?\[([^\]]+)\]', answer_text)
                    if twitter_match:
                        answer_data["twitter"] = twitter_match.group(1)
                    
                    instagram_match = re.search(r'Instagram.*?\[([^\]]+)\]', answer_text)
                    if instagram_match:
                        answer_data["instagram"] = instagram_match.group(1)
                    
                    linkedin_match = re.search(r'LinkedIn.*?\[([^\]]+)\]', answer_text)
                    if linkedin_match:
                        answer_data["linkedin"] = linkedin_match.group(1)
                    
                    youtube_match = re.search(r'YouTube.*?\[([^\]]+)\]', answer_text)
                    if youtube_match:
                        answer_data["youtube"] = youtube_match.group(1)
                    
                    tiktok_match = re.search(r'TikTok.*?\[([^\]]+)\]', answer_text)
                    if tiktok_match:
                        answer_data["tiktok"] = tiktok_match.group(1)
                        
            except (json.JSONDecodeError, AttributeError, KeyError):
                # If parsing fails, create empty structure
                answer_data = {
                    "facebook": "",
                    "twitter": "",
                    "instagram": "",
                    "linkedin": "",
                    "youtube": "",
                    "tiktok": ""
                }
            
            logger.info(f"  - Parsed social media accounts:")
            for platform, url in answer_data.items():
                if url:
                    logger.info(f"    {platform}: {url}")
            
            return {
                "success": True,
                "user_url": user_url,
                "social_media_accounts": answer_data,
                "citations": citations_dicts,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "api_cost": getattr(getattr(result, 'cost_dollars', None), 'total', 0) if hasattr(result, 'cost_dollars') and getattr(result, 'cost_dollars', None) else 0,
                "request_id": getattr(result, 'request_id', None) if hasattr(result, 'request_id') else None
            }
                        
        except Exception as e:
            logger.error(f"Error in social media discovery: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during social media discovery"
            }
    
    def _generate_basic_context(self, results: List[Any], user_url: str) -> str:
        """
        Generate a basic context string from competitor results for LLM consumption.
        
        Args:
            results: List of competitor results from Exa API
            user_url: Original user URL for reference
            
        Returns:
            Formatted context string
        """
        context_parts = [
            f"Competitive Analysis for: {user_url}",
            f"Found {len(results)} similar websites/competitors:",
            ""
        ]
        
        for i, result in enumerate(results[:5], 1):  # Limit to top 5 for context
            url = getattr(result, 'url', 'Unknown URL')
            title = getattr(result, 'title', 'Unknown Title')
            summary = getattr(result, 'summary', 'No summary available')
            
            context_parts.extend([
                f"{i}. {title}",
                f"   URL: {url}",
                f"   Summary: {summary[:200]}{'...' if len(summary) > 200 else ''}",
                ""
            ])
        
        context_parts.append("Key insights:")
        context_parts.append("- These competitors offer similar services or content")
        context_parts.append("- Analyze their content strategy and positioning")
        context_parts.append("- Identify opportunities for differentiation")
        
        return "\n".join(context_parts)
            
    async def analyze_competitor_content(
        self,
        competitor_url: str,
        analysis_depth: str = "standard"
    ) -> Dict[str, Any]:
        """
        Perform deeper analysis of a specific competitor.
        
        Args:
            competitor_url: URL of the competitor to analyze
            analysis_depth: Depth of analysis ("quick", "standard", "deep")
            
        Returns:
            Dictionary containing detailed competitor analysis
        """
        try:
            logger.info(f"Starting detailed analysis for competitor: {competitor_url}")
            
            # Get similar content from this competitor
            similar_results = await self.discover_competitors(
                competitor_url,
                num_results=10,
                include_domains=[urlparse(competitor_url).netloc]
            )
            
            if not similar_results["success"]:
                return similar_results
            
            # Analyze content patterns
            content_patterns = self._analyze_content_patterns(similar_results["competitors"])
            
            # Generate competitive insights
            competitive_insights = self._generate_competitive_insights(
                competitor_url,
                similar_results["competitors"],
                content_patterns
            )
            
            return {
                "success": True,
                "competitor_url": competitor_url,
                "content_patterns": content_patterns,
                "competitive_insights": competitive_insights,
                "analysis_timestamp": datetime.utcnow().isoformat(),
                "analysis_depth": analysis_depth
            }
            
        except Exception as e:
            logger.error(f"Error in competitor content analysis: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "details": "An unexpected error occurred during competitor analysis"
            }
    
    def _analyze_content_patterns(self, competitors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze content patterns across competitors.
        
        Args:
            competitors: List of competitor data
            
        Returns:
            Dictionary of content patterns
        """
        patterns = {
            "common_themes": [],
            "content_types": [],
            "publishing_patterns": {},
            "target_keywords": [],
            "content_strategies": []
        }
        
        # Analyze common themes
        all_summaries = [comp.get("summary", "") for comp in competitors]
        # This would be enhanced with NLP analysis in a full implementation
        
        # Analyze content types from URLs
        content_types = set()
        for comp in competitors:
            url = comp.get("url", "")
            if "/blog/" in url:
                content_types.add("blog")
            elif "/product/" in url or "/service/" in url:
                content_types.add("product")
            elif "/about/" in url:
                content_types.add("about")
            elif "/contact/" in url:
                content_types.add("contact")
        
        patterns["content_types"] = list(content_types)
        
        return patterns
    
    def _generate_competitive_insights(
        self,
        competitor_url: str,
        competitors: List[Dict[str, Any]],
        content_patterns: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate competitive insights from analysis data.
        
        Args:
            competitor_url: URL of the competitor
            competitors: List of competitor data
            content_patterns: Content pattern analysis
            
        Returns:
            Dictionary of competitive insights
        """
        insights = {
            "competitive_strengths": [],
            "content_opportunities": [],
            "market_positioning": "unknown",
            "strategic_recommendations": []
        }
        
        # Analyze competitive strengths
        for comp in competitors:
            if comp.get("relevance_score", 0) > 0.7:
                insights["competitive_strengths"].append({
                    "strength": comp.get("summary", "")[:100],
                    "relevance": comp.get("relevance_score", 0)
                })
        
        # Generate content opportunities
        if content_patterns.get("content_types"):
            insights["content_opportunities"] = [
                f"Develop {content_type} content" 
                for content_type in content_patterns["content_types"]
            ]
        
        return insights
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the Exa service.
        
        Returns:
            Dictionary containing service health status
        """
        try:
            # Ensure latest env before health check
            self._try_initialize()
            if not self.enabled:
                return {
                    "status": "disabled",
                    "message": "Exa API key not configured",
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            # Test with a simple request using the SDK directly
            test_result = self.exa.find_similar(
                url="https://example.com",
                num_results=1
            )
            
            # If we get here without an exception, the API is working
            return {
                "status": "healthy",
                "message": "Exa API is operational",
                "timestamp": datetime.utcnow().isoformat(),
                "test_successful": True
            }
                
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}",
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def get_cost_estimate(self, num_results: int, include_content: bool = True) -> Dict[str, Any]:
        """
        Get cost estimate for Exa API usage.
        
        Args:
            num_results: Number of results requested
            include_content: Whether to include content analysis
            
        Returns:
            Dictionary containing cost estimate
        """
        # Exa API pricing (as of documentation)
        if num_results <= 25:
            search_cost = 0.005
        elif num_results <= 100:
            search_cost = 0.025
        else:
            search_cost = 1.0
        
        content_cost = 0.0
        if include_content:
            # Estimate content analysis cost
            content_cost = num_results * 0.001  # Rough estimate
        
        total_cost = search_cost + content_cost
        
        return {
            "search_cost": search_cost,
            "content_cost": content_cost,
            "total_estimated_cost": total_cost,
            "num_results": num_results,
            "include_content": include_content
        }
