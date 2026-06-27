"""
LinkedIn Content Generation Service for ALwrity

This service generates various types of LinkedIn content with provider-agnostic
LLM access via llm_text_gen. Research is handled by Exa/Tavily through the
common research infrastructure.
"""

import asyncio
import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger

from models.linkedin_models import (
    LinkedInPostRequest, LinkedInPostResponse, PostContent, ResearchSource,
    LinkedInArticleRequest, LinkedInArticleResponse, ArticleContent,
    LinkedInCarouselRequest, LinkedInCarouselResponse, CarouselContent, CarouselSlide,
    LinkedInVideoScriptRequest, LinkedInVideoScriptResponse, VideoScript,
    LinkedInCommentResponseRequest, LinkedInCommentResponseResult,
    HashtagSuggestion, ImageSuggestion, Citation, ContentQualityMetrics,
    GroundingLevel
)
from services.citation import CitationManager
from services.quality import ContentQualityAnalyzer


def _effective_user_id(user_id: Optional[str], request) -> str:
    if user_id:
        return user_id
    raw = getattr(request, 'user_id', '') or ''
    return str(raw) if raw else ''


class LinkedInService:
    """
    LinkedIn content generation service with provider-agnostic LLM access.
    
    Uses llm_text_gen for text generation (respects GPT_PROVIDER).
    Uses Exa/Tavily for research via common infrastructure.
    """
    
    def __init__(self):
        """Initialize the LinkedIn service with lazy provider initialization."""
        self._citation_manager = None
        self._quality_analyzer = None
    
    @property
    def citation_manager(self):
        if self._citation_manager is None:
            try:
                self._citation_manager = CitationManager()
                logger.info("✅ Citation Manager initialized")
            except Exception as e:
                logger.warning(f"⚠️ Citation Manager not available: {e}")
                self._citation_manager = None
        return self._citation_manager
    
    @property
    def quality_analyzer(self):
        if self._quality_analyzer is None:
            try:
                self._quality_analyzer = ContentQualityAnalyzer()
                logger.info("✅ Content Quality Analyzer initialized")
            except Exception as e:
                logger.warning(f"⚠️ Content Quality Analyzer not available: {e}")
                self._quality_analyzer = None
        return self._quality_analyzer
    
    async def generate_linkedin_post(
        self, request: LinkedInPostRequest, user_id: Optional[str] = None
    ) -> LinkedInPostResponse:
        """
        Generate a LinkedIn post with enhanced grounding capabilities.
        
        Args:
            request: LinkedIn post generation request with grounding options
            
        Returns:
            LinkedInPostResponse with grounded content and quality metrics
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn post generation for topic: {request.topic}")
        
            # Debug: Log the request object and search_engine value
            logger.info(f"Request object: {request}")
            logger.info(f"Request search_engine: '{request.search_engine}' (type: {type(request.search_engine)})")
        
            # Step 1: Conduct research if enabled
            from services.linkedin.research_handler import ResearchHandler
            research_handler = ResearchHandler(self)
            effective_user_id = _effective_user_id(user_id, request)
            research_sources, research_time = await research_handler.conduct_research(
                request, request.research_enabled, request.search_engine, 10, user_id=effective_user_id
            )
            
            # Step 2: Generate content based on grounding level
            grounding_enabled = research_handler.determine_grounding_enabled(request, research_sources)
            
            # Use ContentGenerator for content generation
            from services.linkedin.content_generator import ContentGenerator
            content_generator = ContentGenerator(
                self.citation_manager, 
                self.quality_analyzer
            )
            
            if grounding_enabled:
                content_result = await content_generator.generate_grounded_post_content(
                    request=request,
                    research_sources=research_sources,
                    user_id=effective_user_id
                )
            else:
                logger.error("Grounding not enabled, Error generating LinkedIn post")
                raise Exception("Grounding not enabled, Error generating LinkedIn post")
            
            # Step 3-5: Use content generator for processing and response building
            return await content_generator.generate_post(
                request=request,
                research_sources=research_sources,
                research_time=research_time,
                content_result=content_result,
                grounding_enabled=grounding_enabled
            )
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn post: {str(e)}")
            return LinkedInPostResponse(
                success=False,
                error=f"Failed to generate LinkedIn post: {str(e)}"
            )
    
    async def generate_linkedin_article(
        self, request: LinkedInArticleRequest, user_id: Optional[str] = None
    ) -> LinkedInArticleResponse:
        """
        Generate a LinkedIn article with enhanced grounding capabilities.
        
        Args:
            request: LinkedIn article generation request with grounding options
            
        Returns:
            LinkedInArticleResponse with grounded content and quality metrics
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn article generation for topic: {request.topic}")
        
            # Step 1: Conduct research if enabled
            from services.linkedin.research_handler import ResearchHandler
            research_handler = ResearchHandler(self)
            effective_user_id = _effective_user_id(user_id, request)
            research_sources, research_time = await research_handler.conduct_research(
                request, request.research_enabled, request.search_engine, 15, user_id=effective_user_id
            )
            
            # Step 2: Generate content based on grounding level
            grounding_enabled = research_handler.determine_grounding_enabled(request, research_sources)
            
            # Use ContentGenerator for content generation
            from services.linkedin.content_generator import ContentGenerator
            content_generator = ContentGenerator(
                self.citation_manager, 
                self.quality_analyzer
            )
            
            if grounding_enabled:
                content_result = await content_generator.generate_grounded_article_content(
                    request=request,
                    research_sources=research_sources,
                    user_id=effective_user_id
                )
            else:
                logger.error("Grounding not enabled - cannot generate LinkedIn article without AI provider")
                raise Exception("Grounding not enabled - cannot generate LinkedIn article without AI provider")
            
            # Step 3-5: Use content generator for processing and response building
            return await content_generator.generate_article(
                request=request,
                research_sources=research_sources,
                research_time=research_time,
                content_result=content_result,
                grounding_enabled=grounding_enabled
            )
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn article: {str(e)}")
            return LinkedInArticleResponse(
                success=False,
                error=f"Failed to generate LinkedIn article: {str(e)}"
            )
    
    async def generate_linkedin_carousel(
        self, request: LinkedInCarouselRequest, user_id: Optional[str] = None
    ) -> LinkedInCarouselResponse:
        """
        Generate a LinkedIn carousel with enhanced grounding capabilities.
        
        Args:
            request: LinkedIn carousel generation request with grounding options
            
        Returns:
            LinkedInCarouselResponse with grounded content and quality metrics
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn carousel generation for topic: {request.topic}")
        
            # Step 1: Conduct research if enabled
            from services.linkedin.research_handler import ResearchHandler
            research_handler = ResearchHandler(self)
            effective_user_id = _effective_user_id(user_id, request)
            research_sources, research_time = await research_handler.conduct_research(
                request, request.research_enabled, request.search_engine, 12, user_id=effective_user_id
            )
            
            # Step 2: Generate content based on grounding level
            grounding_enabled = research_handler.determine_grounding_enabled(request, research_sources)
            
            # Use ContentGenerator for content generation
            from services.linkedin.content_generator import ContentGenerator
            content_generator = ContentGenerator(
                self.citation_manager, 
                self.quality_analyzer
            )
            
            if grounding_enabled:
                content_result = await content_generator.generate_grounded_carousel_content(
                    request=request,
                    research_sources=research_sources,
                    user_id=effective_user_id
                )
            else:
                logger.error("Grounding not enabled - cannot generate LinkedIn carousel without AI provider")
                raise Exception("Grounding not enabled - cannot generate LinkedIn carousel without AI provider")
            
            # Step 3-5: Use content generator for processing and response building
            
            result = await content_generator.generate_carousel(
                request=request,
                research_sources=research_sources,
                research_time=research_time,
                content_result=content_result,
                grounding_enabled=grounding_enabled
            )
            
            if result['success']:
                # Convert to LinkedInCarouselResponse
                from models.linkedin_models import CarouselSlide, CarouselContent
                slides = []
                for slide_data in result['data']['slides']:
                    slides.append(CarouselSlide(
                        slide_number=slide_data['slide_number'],
                        title=slide_data['title'],
                        content=slide_data['content'],
                        visual_elements=slide_data['visual_elements'],
                        design_notes=slide_data.get('design_notes')
                    ))
                
                carousel_content = CarouselContent(
                    title=result['data']['title'],
                    slides=slides,
                    cover_slide=result['data'].get('cover_slide'),
                    cta_slide=result['data'].get('cta_slide'),
                    design_guidelines=result['data'].get('design_guidelines', {})
                )
                
                return LinkedInCarouselResponse(
                    success=True,
                    data=carousel_content,
                    research_sources=result['research_sources'],
                    generation_metadata=result['generation_metadata'],
                    grounding_status=result['grounding_status']
                )
            else:
                return LinkedInCarouselResponse(
                    success=False,
                    error=result['error']
                )
                
        except Exception as e:
            logger.error(f"Error generating LinkedIn carousel: {str(e)}")
            return LinkedInCarouselResponse(
                success=False,
                error=f"Failed to generate LinkedIn carousel: {str(e)}"
            )
    
    async def generate_linkedin_video_script(
        self, request: LinkedInVideoScriptRequest, user_id: Optional[str] = None
    ) -> LinkedInVideoScriptResponse:
        """
        Generate a LinkedIn video script with enhanced grounding capabilities.
        
        Args:
            request: LinkedIn video script generation request with grounding options
            
        Returns:
            LinkedInVideoScriptResponse with grounded content and quality metrics
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn video script generation for topic: {request.topic}")
        
            # Step 1: Conduct research if enabled
            from services.linkedin.research_handler import ResearchHandler
            research_handler = ResearchHandler(self)
            effective_user_id = _effective_user_id(user_id, request)
            research_sources, research_time = await research_handler.conduct_research(
                request, request.research_enabled, request.search_engine, 8, user_id=effective_user_id
            )
            
            # Step 2: Generate content based on grounding level
            grounding_enabled = research_handler.determine_grounding_enabled(request, research_sources)
            
            # Use ContentGenerator for content generation
            from services.linkedin.content_generator import ContentGenerator
            content_generator = ContentGenerator(
                self.citation_manager, 
                self.quality_analyzer
            )
            
            if grounding_enabled:
                content_result = await content_generator.generate_grounded_video_script_content(
                    request=request,
                    research_sources=research_sources,
                    user_id=effective_user_id
                )
            else:
                logger.error("Grounding not enabled - cannot generate LinkedIn video script without AI provider")
                raise Exception("Grounding not enabled - cannot generate LinkedIn video script without AI provider")
            
            # Step 3-5: Use content generator for processing and response building
            
            result = await content_generator.generate_video_script(
                request=request,
                research_sources=research_sources,
                research_time=research_time,
                content_result=content_result,
                grounding_enabled=grounding_enabled
            )
            
            if result['success']:
                # Convert to LinkedInVideoScriptResponse
                from models.linkedin_models import VideoScript
                from services.linkedin.content_parser import normalize_main_content
                video_script = VideoScript(
                    hook=result['data']['hook'],
                    main_content=normalize_main_content(result['data']['main_content']),
                    conclusion=result['data']['conclusion'],
                    captions=result['data'].get('captions'),
                    thumbnail_suggestions=result['data'].get('thumbnail_suggestions', []),
                    video_description=result['data'].get('video_description', '')
                )
                
                return LinkedInVideoScriptResponse(
                    success=True,
                    data=video_script,
                    research_sources=result['research_sources'],
                    generation_metadata=result['generation_metadata'],
                    grounding_status=result['grounding_status']
                )
            else:
                return LinkedInVideoScriptResponse(
                    success=False,
                    error=result['error']
                )
                
        except Exception as e:
            logger.error(f"Error generating LinkedIn video script: {str(e)}")
            return LinkedInVideoScriptResponse(
                success=False,
                error=f"Failed to generate LinkedIn video script: {str(e)}"
            )
    
    async def generate_linkedin_comment_response(
        self, request: LinkedInCommentResponseRequest, user_id: Optional[str] = None
    ) -> LinkedInCommentResponseResult:
        """
        Generate a LinkedIn comment response with optional grounding capabilities.
        
        Args:
            request: LinkedIn comment response generation request
            
        Returns:
            LinkedInCommentResponseResult with response and optional grounding info
        """
        try:
            start_time = datetime.now()
            logger.info(f"Starting LinkedIn comment response generation")
        
            # Step 1: Conduct research if enabled
            from services.linkedin.research_handler import ResearchHandler
            research_handler = ResearchHandler(self)
            effective_user_id = _effective_user_id(user_id, request)
            research_sources, research_time = await research_handler.conduct_research(
                request, request.research_enabled, request.search_engine, 5, user_id=effective_user_id
            )
            
            # Step 2: Generate response based on grounding level
            grounding_enabled = research_handler.determine_grounding_enabled(request, research_sources)
            
            # Use ContentGenerator for content generation
            from services.linkedin.content_generator import ContentGenerator
            content_generator = ContentGenerator(
                self.citation_manager, 
                self.quality_analyzer
            )
            
            if grounding_enabled:
                response_result = await content_generator.generate_grounded_comment_response(
                    request=request,
                    research_sources=research_sources,
                    user_id=effective_user_id
                )
            else:
                logger.error("Grounding not enabled - cannot generate LinkedIn comment response without AI provider")
                raise Exception("Grounding not enabled - cannot generate LinkedIn comment response without AI provider")
            
            # Step 3-5: Use content generator for processing and response building
            
            result = await content_generator.generate_comment_response(
                request=request,
                research_sources=research_sources,
                research_time=research_time,
                content_result=response_result,
                grounding_enabled=grounding_enabled
            )
            
            if result['success']:
                return LinkedInCommentResponseResult(
                    success=True,
                    response=result['response'],
                    alternative_responses=result.get('alternative_responses', []),
                    tone_analysis=result.get('tone_analysis'),
                    generation_metadata=result.get('generation_metadata', {}),
                    grounding_status=result.get('grounding_status')
                )
            else:
                return LinkedInCommentResponseResult(
                    success=False,
                    error=result['error']
                )
                
        except Exception as e:
            logger.error(f"Error generating LinkedIn comment response: {str(e)}")
            return LinkedInCommentResponseResult(
                success=False,
                error=f"Failed to generate LinkedIn comment response: {str(e)}"
            )
    
    async def _conduct_research(self, topic: str, industry: str, search_engine: str, max_results: int = 10, user_id: str = None) -> List[ResearchSource]:
        """
        Conduct research using the configured search engine with caching.
        
        For Exa: delegates to ExaResearchProvider.simple_search() with pre-flight validation
        For Tavily: delegates to TavilyService.search() with pre-flight validation
        For Google/unknown: falls back to Exa if available
        
        Args:
            topic: Research topic
            industry: Target industry
            search_engine: Search engine to use (exa, tavily)
            max_results: Maximum number of results to return
            user_id: User ID for subscription pre-flight validation and usage tracking
            
        Returns:
            List of research sources
        """
        from services.cache.research_cache import research_cache
        
        search_engine_lower = search_engine.lower().strip()
        
        # Default to Exa if Google or unknown engine specified
        if search_engine_lower in ("google", ""):
            logger.info(f"Search engine '{search_engine}' not supported for direct research, defaulting to Exa")
            search_engine_lower = "exa"
        
        # Check cache first
        cached_result = research_cache.get_cached_result(
            keywords=[topic],
            industry=industry,
            target_audience="linkedin"
        )
        
        if cached_result:
            logger.info(f"Returning cached research result for topic: {topic[:50]}")
            # Convert cached dict back to ResearchSource objects
            sources = []
            for r in cached_result:
                sources.append(ResearchSource(
                    title=r.get('title', 'Untitled'),
                    url=r.get('url', ''),
                    content=r.get('content', '')[:500],
                    relevance_score=r.get('relevance_score', 0.5),
                    credibility_score=r.get('credibility_score', 0.5),
                    source_type=r.get('source_type', 'web'),
                    publication_date=r.get('publication_date')
                ))
            return sources
        
        try:
            # Pre-flight validation if user_id provided
            if user_id:
                try:
                    from services.subscription.preflight_validator import validate_exa_research_operations
                    from services.database import get_session_for_user
                    from services.subscription import PricingService
                    import os
                    
                    db_val = get_session_for_user(user_id)
                    if db_val:
                        try:
                            pricing_service = PricingService(db_val)
                            gpt_provider = os.getenv("GPT_PROVIDER", "google")
                            validate_exa_research_operations(pricing_service, user_id, gpt_provider)
                        finally:
                            db_val.close()
                except Exception as preflight_err:
                    logger.warning(f"Research pre-flight validation failed: {preflight_err}")
                    # Continue anyway - don't block research for pre-flight issues
            
            if search_engine_lower == "exa":
                from services.research import get_exa_content_provider
                
                try:
                    provider = get_exa_content_provider()
                except RuntimeError:
                    logger.warning("Exa API key not configured, falling back to Tavily")
                    provider = None
                
                if provider:
                    try:
                        results = await provider.simple_search(
                            query=f"{topic} {industry}",
                            num_results=max_results,
                            user_id=user_id
                        )
                        
                        sources = []
                        for r in results:
                            sources.append(ResearchSource(
                                title=r.get('title', 'Untitled'),
                                url=r.get('url', ''),
                                content=r.get('text', '')[:500],
                                relevance_score=r.get('score', 0.5),
                                credibility_score=r.get('score', 0.5),
                                source_type='web',
                                publication_date=r.get('publishedDate')
                            ))
                        
                        # Cache the results
                        cache_data = [
                            {
                                'title': s.title,
                                'url': s.url,
                                'content': s.content,
                                'relevance_score': s.relevance_score,
                                'credibility_score': s.credibility_score,
                                'source_type': s.source_type,
                                'publication_date': s.publication_date
                            }
                            for s in sources
                        ]
                        research_cache.cache_result(
                            keywords=[topic],
                            industry=industry,
                            target_audience="linkedin",
                            result=cache_data
                        )
                        
                        logger.info(f"Exa research returned {len(sources)} sources for topic: {topic[:50]}")
                        return sources
                    except Exception as exa_err:
                        logger.warning(f"Exa research failed ({exa_err}), falling back to Tavily")
                
                # Fallback to Tavily
                search_engine_lower = "tavily"
            
            if search_engine_lower == "tavily":
                from services.research.tavily_service import TavilyService
                
                tavily_service = TavilyService()
                if not tavily_service.enabled:
                    logger.warning("Tavily API key not configured, skipping Tavily research")
                    return []
                
                result = await tavily_service.search(
                    query=f"{topic} {industry}",
                    max_results=max_results
                )
                
                raw_results = result.get('results', []) if isinstance(result, dict) else []
                sources = []
                for r in raw_results:
                    sources.append(ResearchSource(
                        title=r.get('title', 'Untitled'),
                        url=r.get('url', ''),
                        content=r.get('content', '')[:500],
                        relevance_score=r.get('score', r.get('relevance_score', 0.5)),
                        credibility_score=r.get('relevance_score', 0.5),
                        source_type='web',
                        publication_date=r.get('published_date')
                    ))
                
                # Cache the results
                cache_data = [
                    {
                        'title': s.title,
                        'url': s.url,
                        'content': s.content,
                        'relevance_score': s.relevance_score,
                        'credibility_score': s.credibility_score,
                        'source_type': s.source_type,
                        'publication_date': s.publication_date
                    }
                    for s in sources
                ]
                research_cache.cache_result(
                    keywords=[topic],
                    industry=industry,
                    target_audience="linkedin",
                    result=cache_data
                )
                
                logger.info(f"Tavily research returned {len(sources)} sources for topic: {topic[:50]}")
                return sources
            
            else:
                logger.warning(f"Unknown search engine '{search_engine}', no research performed")
                return []
                
        except Exception as e:
            logger.error(f"Research failed for engine {search_engine}: {e}")
            return []
