"""
Content Generator for LinkedIn Content Generation

Handles the main content generation logic for posts and articles.
Uses llm_text_gen for provider-agnostic LLM access (respects GPT_PROVIDER).
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from models.linkedin_models import (
    LinkedInPostRequest, LinkedInArticleRequest, LinkedInPostResponse, LinkedInArticleResponse,
    PostContent, ArticleContent, GroundingLevel, ResearchSource
)
from services.linkedin.quality_handler import QualityHandler
from services.linkedin.content_generator_prompts import (
    PostPromptBuilder,
    ArticlePromptBuilder,
    CarouselPromptBuilder,
    VideoScriptPromptBuilder,
    CommentResponsePromptBuilder,
    CarouselGenerator,
    VideoScriptGenerator
)
from services.llm_providers.main_text_generation import llm_text_gen
from services.linkedin.content_parser import parse_video_script_text
from services.persona_analysis_service import PersonaAnalysisService
import time


class ContentGenerator:
    """Handles content generation for all LinkedIn content types."""
    
    def __init__(self, citation_manager=None, quality_analyzer=None):
        self.citation_manager = citation_manager
        self.quality_analyzer = quality_analyzer
        
        # Persona caching
        self._persona_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._cache_duration = 300  # 5 minutes cache duration
        
        # Initialize specialized generators
        self.carousel_generator = CarouselGenerator(citation_manager, quality_analyzer)
        self.video_script_generator = VideoScriptGenerator(citation_manager, quality_analyzer)
    
    def _get_cached_persona_data(self, user_id: int, platform: str) -> Optional[Dict[str, Any]]:
        """
        Get persona data with caching for LinkedIn platform.
        
        Args:
            user_id: User ID to get persona for
            platform: Platform type (linkedin)
            
        Returns:
            Persona data or None if not available
        """
        cache_key = f"{platform}_persona_{user_id}"
        current_time = time.time()
        
        # Check cache first
        if cache_key in self._persona_cache and cache_key in self._cache_timestamps:
            cache_age = current_time - self._cache_timestamps[cache_key]
            if cache_age < self._cache_duration:
                logger.debug(f"Using cached persona data for user {user_id} (age: {cache_age:.1f}s)")
                return self._persona_cache[cache_key]
            else:
                # Cache expired, remove it
                logger.debug(f"Cache expired for user {user_id}, refreshing...")
                del self._persona_cache[cache_key]
                del self._cache_timestamps[cache_key]
        
        # Fetch fresh data
        try:
            persona_service = PersonaAnalysisService()
            persona_data = persona_service.get_persona_for_platform(user_id, platform)
            
            # Cache the result
            if persona_data:
                self._persona_cache[cache_key] = persona_data
                self._cache_timestamps[cache_key] = current_time
                logger.debug(f"Cached persona data for user {user_id}")
            
            return persona_data
            
        except Exception as e:
            logger.warning(f"Could not load persona data for {platform} content generation: {e}")
            return None
    
    def _clear_persona_cache(self, user_id: int = None):
        """
        Clear persona cache for a specific user or all users.
        
        Args:
            user_id: User ID to clear cache for, or None to clear all
        """
        if user_id is None:
            self._persona_cache.clear()
            self._cache_timestamps.clear()
            logger.info("Cleared all persona cache")
        else:
            # Clear cache for all platforms for this user
            keys_to_remove = [key for key in self._persona_cache.keys() if key.endswith(f"_{user_id}")]
            for key in keys_to_remove:
                del self._persona_cache[key]
                del self._cache_timestamps[key]
            logger.info(f"Cleared persona cache for user {user_id}")
    
    def _build_research_context(self, research_sources: List) -> str:
        """Build research context string from research sources for prompt injection."""
        if not research_sources:
            return ""
        
        context_parts = ["\n\nRESEARCH CONTEXT (use this information to ground your content with facts and data):"]
        for i, source in enumerate(research_sources[:5], 1):  # Limit to top 5 sources
            title = getattr(source, 'title', f'Source {i}')
            url = getattr(source, 'url', '')
            content = getattr(source, 'content', '')
            context_parts.append(f"\n{i}. {title}")
            if url:
                context_parts.append(f"   URL: {url}")
            if content:
                context_parts.append(f"   Key insight: {content[:300]}")
        
        context_parts.append("\nInstructions: Use the research above to include specific data points, statistics, and factual claims in your content. Cite sources where appropriate.")
        return "\n".join(context_parts)
    
    async def generate_post(
        self,
        request: LinkedInPostRequest,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ) -> LinkedInPostResponse:
        """Generate LinkedIn post with all processing steps."""
        try:
            start_time = datetime.now()
            
            # Debug: Log what we received
            logger.info(f"ContentGenerator.generate_post called with:")
            logger.info(f"  - research_sources count: {len(research_sources) if research_sources else 0}")
            logger.info(f"  - research_sources type: {type(research_sources)}")
            logger.info(f"  - content_result keys: {list(content_result.keys()) if content_result else 'None'}")
            logger.info(f"  - grounding_enabled: {grounding_enabled}")
            logger.info(f"  - include_citations: {request.include_citations}")
            
            # Debug: Log content_result details
            if content_result:
                logger.info(f"  - content_result has citations: {'citations' in content_result}")
                logger.info(f"  - content_result has sources: {'sources' in content_result}")
                if 'citations' in content_result:
                    logger.info(f"  - citations count: {len(content_result['citations']) if content_result['citations'] else 0}")
                if 'sources' in content_result:
                    logger.info(f"  - sources count: {len(content_result['sources']) if content_result['sources'] else 0}")
            
            if research_sources:
                logger.info(f"  - First research source: {research_sources[0] if research_sources else 'None'}")
                logger.info(f"  - Research sources types: {[type(s) for s in research_sources[:3]]}")
            
            # Step 3: Add citations if requested
            citations = []
            source_list = None
            final_research_sources = research_sources
            
            if request.include_citations and research_sources and self.citation_manager:
                try:
                    logger.info(f"Processing citations for content length: {len(content_result['content'])}")
                    citations = self.citation_manager.extract_citations(content_result['content'])
                    logger.info(f"Extracted {len(citations)} citations from content")
                    source_list = self.citation_manager.generate_source_list(research_sources)
                    logger.info(f"Generated source list: {source_list[:200] if source_list else 'None'}")
                except Exception as e:
                    logger.warning(f"Citation processing failed: {e}")
            else:
                logger.info(f"Citation processing skipped: include_citations={request.include_citations}, research_sources={len(research_sources) if research_sources else 0}, citation_manager={self.citation_manager is not None}")
            
            # Step 4: Analyze content quality
            quality_metrics = None
            if grounding_enabled and self.quality_analyzer:
                try:
                    quality_handler = QualityHandler(self.quality_analyzer)
                    quality_metrics = quality_handler.create_quality_metrics(
                        content=content_result['content'],
                        sources=final_research_sources,  # Use final_research_sources
                        industry=request.industry,
                        grounding_enabled=grounding_enabled
                    )
                except Exception as e:
                    logger.warning(f"Quality analysis failed: {e}")
            
            # Step 5: Build response
            post_content = PostContent(
                content=content_result['content'],
                character_count=len(content_result['content']),
                hashtags=content_result.get('hashtags', []),
                call_to_action=content_result.get('call_to_action'),
                engagement_prediction=content_result.get('engagement_prediction'),
                citations=citations,
                source_list=source_list,
                quality_metrics=quality_metrics,
                grounding_enabled=grounding_enabled,
                search_queries=content_result.get('search_queries', [])
            )
            
            generation_time = (datetime.now() - start_time).total_seconds()
            
            # Build grounding status
            grounding_status = {
                'status': 'success' if grounding_enabled else 'disabled',
                'sources_used': len(final_research_sources),  # Use final_research_sources
                'citation_coverage': len(citations) / max(len(final_research_sources), 1) if final_research_sources else 0,
                'quality_score': quality_metrics.overall_score if quality_metrics else 0.0
            } if grounding_enabled else None
            
            return LinkedInPostResponse(
                success=True,
                data=post_content,
                research_sources=final_research_sources,  # Use final_research_sources
                generation_metadata={
                    'model_used': 'llm_text_gen',
                    'generation_time': generation_time,
                    'research_time': research_time,
                    'grounding_enabled': grounding_enabled
                },
                grounding_status=grounding_status
            )
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn post: {str(e)}")
            return LinkedInPostResponse(
                success=False,
                error=f"Failed to generate LinkedIn post: {str(e)}"
            )
    
    async def generate_article(
        self,
        request: LinkedInArticleRequest,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ) -> LinkedInArticleResponse:
        """Generate LinkedIn article with all processing steps."""
        try:
            start_time = datetime.now()
            
            # Step 3: Add citations if requested
            citations = []
            source_list = None
            final_research_sources = research_sources
            
            if request.include_citations and research_sources and self.citation_manager:
                try:
                    citations = self.citation_manager.extract_citations(content_result['content'])
                    source_list = self.citation_manager.generate_source_list(research_sources)
                except Exception as e:
                    logger.warning(f"Citation processing failed: {e}")
            
            # Step 4: Analyze content quality
            quality_metrics = None
            if grounding_enabled and self.quality_analyzer:
                try:
                    quality_handler = QualityHandler(self.quality_analyzer)
                    quality_metrics = quality_handler.create_quality_metrics(
                        content=content_result['content'],
                        sources=final_research_sources,  # Use final_research_sources
                        industry=request.industry,
                        grounding_enabled=grounding_enabled
                    )
                except Exception as e:
                    logger.warning(f"Quality analysis failed: {e}")
            
            # Step 5: Build response
            article_content = ArticleContent(
                title=content_result['title'],
                content=content_result['content'],
                word_count=len(content_result['content'].split()),
                sections=content_result.get('sections', []),
                seo_metadata=content_result.get('seo_metadata'),
                image_suggestions=content_result.get('image_suggestions', []),
                reading_time=content_result.get('reading_time'),
                citations=citations,
                source_list=source_list,
                quality_metrics=quality_metrics,
                grounding_enabled=grounding_enabled,
                search_queries=content_result.get('search_queries', [])
            )
            
            generation_time = (datetime.now() - start_time).total_seconds()
            
            # Build grounding status
            grounding_status = {
                'status': 'success' if grounding_enabled else 'disabled',
                'sources_used': len(final_research_sources),  # Use final_research_sources
                'citation_coverage': len(citations) / max(len(final_research_sources), 1) if final_research_sources else 0,
                'quality_score': quality_metrics.overall_score if quality_metrics else 0.0
            } if grounding_enabled else None
            
            return LinkedInArticleResponse(
                success=True,
                data=article_content,
                research_sources=final_research_sources,  # Use final_research_sources
                generation_metadata={
                    'model_used': 'llm_text_gen',
                    'generation_time': generation_time,
                    'research_time': research_time,
                    'grounding_enabled': grounding_enabled
                },
                grounding_status=grounding_status
            )
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn article: {str(e)}")
            return LinkedInArticleResponse(
                success=False,
                error=f"Failed to generate LinkedIn article: {str(e)}"
            )
    
    async def generate_carousel(
        self,
        request,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ):
        """Generate LinkedIn carousel using the specialized CarouselGenerator."""
        return await self.carousel_generator.generate_carousel(
            request, research_sources, research_time, content_result, grounding_enabled
        )
    
    async def generate_video_script(
        self,
        request,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ):
        """Generate LinkedIn video script using the specialized VideoScriptGenerator."""
        return await self.video_script_generator.generate_video_script(
            request, research_sources, research_time, content_result, grounding_enabled
        )
    
    async def generate_comment_response(
        self,
        request,
        research_sources: List,
        research_time: float,
        content_result: Dict[str, Any],
        grounding_enabled: bool
    ):
        """Generate LinkedIn comment response with all processing steps."""
        try:
            start_time = datetime.now()
            
            generation_time = (datetime.now() - start_time).total_seconds()
            
            # Build grounding status
            grounding_status = {
                'status': 'success' if grounding_enabled else 'disabled',
                'sources_used': len(research_sources),
                'citation_coverage': 0,  # Comments typically don't have citations
                'quality_score': 0.8  # Default quality for comments
            } if grounding_enabled else None
            
            return {
                'success': True,
                'response': content_result['response'],
                'alternative_responses': content_result.get('alternative_responses', []),
                'tone_analysis': content_result.get('tone_analysis'),
                'generation_metadata': {
                    'model_used': 'llm_text_gen',
                    'generation_time': generation_time,
                    'research_time': research_time,
                    'grounding_enabled': grounding_enabled
                },
                'grounding_status': grounding_status
            }
            
        except Exception as e:
            logger.error(f"Error generating LinkedIn comment response: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to generate LinkedIn comment response: {str(e)}"
            }
    
    # Grounded content generation methods
    async def generate_grounded_post_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate post content using provider-agnostic llm_text_gen."""
        try:
            # Build the prompt using persona if available
            uid = int(getattr(request, "user_id", 0) or 0)
            persona_data = self._get_cached_persona_data(uid, 'linkedin')
            if getattr(request, 'persona_override', None):
                try:
                    override = request.persona_override
                    if persona_data:
                        core = persona_data.get('core_persona', {})
                        platform_adapt = persona_data.get('platform_adaptation', {})
                        if 'core_persona' in override:
                            core.update(override['core_persona'])
                        if 'platform_adaptation' in override:
                            platform_adapt.update(override['platform_adaptation'])
                        persona_data['core_persona'] = core
                        persona_data['platform_adaptation'] = platform_adapt
                    else:
                        persona_data = override
                except Exception:
                    pass
            prompt = PostPromptBuilder.build_post_prompt(request, persona=persona_data)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway
            raw_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_post",
                max_tokens=request.max_length,
                temperature=0.7
            )
            
            content_text = raw_response if isinstance(raw_response, str) else str(raw_response or "")
            
            return {
                'content': content_text,
                'sources': [],
                'citations': [],
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
            
        except Exception as e:
            logger.error(f"Error generating post content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn post: {str(e)}")
    
    async def generate_grounded_article_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate article content using provider-agnostic llm_text_gen."""
        try:
            # Build the prompt using persona if available
            uid = int(getattr(request, "user_id", 0) or 0)
            persona_data = self._get_cached_persona_data(uid, 'linkedin')
            if getattr(request, 'persona_override', None):
                try:
                    override = request.persona_override
                    if persona_data:
                        core = persona_data.get('core_persona', {})
                        platform_adapt = persona_data.get('platform_adaptation', {})
                        if 'core_persona' in override:
                            core.update(override['core_persona'])
                        if 'platform_adaptation' in override:
                            platform_adapt.update(override['platform_adaptation'])
                        persona_data['core_persona'] = core
                        persona_data['platform_adaptation'] = platform_adapt
                    else:
                        persona_data = override
                except Exception:
                    pass
            prompt = ArticlePromptBuilder.build_article_prompt(request, persona=persona_data)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway
            raw_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_article",
                max_tokens=request.word_count * 10,
                temperature=0.7
            )
            
            content_text = raw_response if isinstance(raw_response, str) else str(raw_response or "")
            
            # Extract title from article content (first markdown heading or first line)
            title = ""
            for line in content_text.split('\n'):
                stripped = line.strip()
                if stripped.startswith('# '):
                    title = stripped[2:].strip()
                    break
            if not title:
                for line in content_text.split('\n'):
                    stripped = line.strip()
                    if stripped:
                        title = stripped[:100].strip()
                        break
            if not title:
                title = request.topic or "LinkedIn Article"
            
            return {
                'content': content_text,
                'title': title,
                'sources': [],
                'citations': [],
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
                
        except Exception as e:
            logger.error(f"Error generating article content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn article: {str(e)}")
    
    async def generate_grounded_carousel_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate carousel content using provider-agnostic llm_text_gen."""
        try:
            prompt = CarouselPromptBuilder.build_carousel_prompt(request)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway
            raw_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_carousel",
                max_tokens=2000,
                temperature=0.7
            )
            
            content_text = raw_response if isinstance(raw_response, str) else str(raw_response or "")
            
            return {
                'content': content_text,
                'sources': [],
                'citations': [],
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
            
        except Exception as e:
            logger.error(f"Error generating carousel content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn carousel: {str(e)}")
    
    async def generate_grounded_video_script_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate video script content using provider-agnostic llm_text_gen."""
        try:
            prompt = VideoScriptPromptBuilder.build_video_script_prompt(request)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway
            raw_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_video_script",
                max_tokens=1500,
                temperature=0.7
            )
            
            content_text = raw_response if isinstance(raw_response, str) else str(raw_response or "")
            parsed = parse_video_script_text(content_text)

            return {
                **parsed,
                'content': content_text,
                'sources': [],
                'citations': [],
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
            
        except Exception as e:
            logger.error(f"Error generating video script content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn video script: {str(e)}")
    
    async def generate_grounded_comment_response(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate comment response using provider-agnostic llm_text_gen."""
        try:
            prompt = CommentResponsePromptBuilder.build_comment_response_prompt(request)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway
            raw_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                flow_type="linkedin_comment_response",
                max_tokens=2000,
                temperature=0.7
            )
            
            content_text = raw_response if isinstance(raw_response, str) else str(raw_response or "")
            
            return {
                'content': content_text,
                'sources': [],
                'citations': [],
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
                
        except Exception as e:
            logger.error(f"Error generating comment response: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn comment response: {str(e)}")
