"""
Content Generator for LinkedIn Content Generation

Handles the main content generation logic for posts and articles.
Uses llm_text_gen for provider-agnostic LLM access (respects GPT_PROVIDER).
"""

import json
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger
from models.linkedin_models import (
    LinkedInPostRequest, LinkedInArticleRequest, LinkedInPostResponse, LinkedInArticleResponse,
    PostContent, ArticleContent, GroundingLevel, ResearchSource, LinkedInPostOutput, Citation,
    HashtagSuggestion, LinkedInArticleOutput, LinkedInArticleTitleOutput, LinkedInCarouselOutput, LinkedInVideoScriptOutput
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

    def _generate_article_title(self, request, research_sources: List, user_id: str = None) -> str:
        """Generate article title via llm_text_gen with structured JSON schema.

        Uses a dedicated LLM call with LinkedInArticleTitleOutput schema to ensure
        the title is 40-60 characters, compelling, and specific.
        """
        try:
            title_prompt = f"""You are an expert content strategist. Generate a compelling LinkedIn article headline.
            TOPIC: {request.topic}
            INDUSTRY: {request.industry}
            TONE: {request.tone}
            TARGET AUDIENCE: {request.target_audience or 'Industry professionals, executives, and thought leaders'}

            RULES:
            - 40-60 characters maximum
            - Compelling and specific, not generic or clickbait
            - Must communicate the core value or insight of the article
            - Do NOT include [Source N] citations in the title
            - Do NOT use quotes or special characters
            - Single sentence that makes the reader want to click
            """
            raw = llm_text_gen(
                prompt=title_prompt,
                json_struct=LinkedInArticleTitleOutput.model_json_schema(),
                user_id=user_id,
                flow_type="linkedin_article_title",
                temperature=0.7
            )
            parsed = raw if isinstance(raw, dict) else json.loads(str(raw).strip())
            return parsed.get('title', '').strip()
        except Exception as e:
            logger.warning(f"Article title generation failed, falling back to topic: {e}")
            return ""

    def _clear_persona_cache(self, user_id: str = None):
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
    
    def _extract_citation_text(self, content: str, source_num: int) -> str:
        """Extract the sentence surrounding a [Source N] marker for citation text display."""
        pattern = re.compile(rf'([^.]*?\[Source {re.escape(str(source_num))}\][^.]*\.)')
        match = pattern.search(content)
        if match:
            text = match.group(1).strip()
            return text[:200]
        return f"Source {source_num}"

    def _build_research_context(self, research_sources: List) -> str:
        """Build research context string from research sources for prompt injection.
        
        Prioritizes Exa AI-generated highlights and summary over raw content text.
        """
        if not research_sources:
            return ""
        
        today = datetime.now().strftime("%B %d, %Y")
        context_parts = [f"\n\nTODAY'S DATE: {today}\n\nRESEARCH CONTEXT (use this information to ground your content with facts and data):"]
        for i, source in enumerate(research_sources[:12], 1):
            title = getattr(source, 'title', f'Source {i}')
            url = getattr(source, 'url', '')
            highlights = getattr(source, 'highlights', None)
            summary = getattr(source, 'summary', None)
            content = getattr(source, 'content', '')
            
            context_parts.append(f"\n{i}. {title}")
            if url:
                context_parts.append(f"   URL: {url}")
            
            # Use Exa AI highlights (most concise and valuable)
            if highlights:
                for h in highlights[:3]:
                    context_parts.append(f"   - {h[:300]}")
            # Fall back to Exa AI summary
            elif summary:
                context_parts.append(f"   Summary: {summary[:500]}")
            # Fall back to raw content truncation
            elif content:
                context_parts.append(f"   Key insight: {content[:500]}")
        
        context_parts.append("\nInstructions: Use the research above to include specific data points, statistics, and factual claims in your content. Cite sources where appropriate.")
        return "\n".join(context_parts)
    
    async def _synthesize_research(self, research_sources: List, topic: str, user_id: str = None) -> str:
        """Distill research sources into structured bullet points using LLM.
        
        Produces a concise synthesis focused on key statistics, trends, and
        actionable findings relevant to the topic.
        """
        if not research_sources:
            return ""
        
        today = datetime.now().strftime("%B %d, %Y")
        sources_text = []
        for i, s in enumerate(research_sources[:15], 1):
            title = getattr(s, 'title', f'Source {i}')
            highlights = getattr(s, 'highlights', None)
            summary = getattr(s, 'summary', None)
            content = getattr(s, 'content', '')
            
            snippet = f"Source {i}: {title}\n"
            if highlights:
                snippet += "\n".join(f"  - {h}" for h in highlights[:3])
            elif summary:
                snippet += f"  Summary: {summary[:500]}"
            elif content:
                snippet += f"  Excerpt: {content[:500]}"
            sources_text.append(snippet)
        
        synthesis_prompt = f"""You are a research analyst. Below are {len(research_sources)} research sources about "{topic}".

Extract and organize the most important information into these categories:
- KEY STATISTICS: Specific numbers, percentages, dates, and data points
- KEY TRENDS: Emerging patterns, shifts, and发展方向
- EXPERT INSIGHTS: Quotes, opinions, and expert perspectives
- ACTIONABLE FINDINGS: Practical takeaways that can be applied

Research sources:
{chr(10).join(sources_text)}

Today's date: {today}

Return ONLY the synthesized findings in clear bullet points under each category heading. Be concise and factual. If a category has no relevant data, skip it."""
        
        try:
            synthesis = llm_text_gen(
                prompt=synthesis_prompt,
                user_id=user_id,
                flow_type="research_synthesis",
                temperature=0.2
            )
            return f"\n\nRESEARCH SYNTHESIS:\n{synthesis}"
        except Exception as e:
            logger.warning(f"Research synthesis failed, using raw context: {e}")
            return ""
    
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
            
            # Step 3: Build citations from structured LLM output or fall back to extraction
            citations = []
            source_list = None
            final_research_sources = research_sources
            
            if request.include_citations:
                # Prefer structured citations from LLM json_struct output
                if content_result.get('citations'):
                    citations = content_result['citations']
                    logger.info(f"Using {len(citations)} structured citations from LLM output")
                elif research_sources and self.citation_manager:
                    try:
                        logger.info(f"Falling back to citation extraction for content length: {len(content_result['content'])}")
                        citations = self.citation_manager.extract_citations(content_result['content'])
                        logger.info(f"Extracted {len(citations)} citations from content")
                    except Exception as e:
                        logger.warning(f"Citation extraction fallback failed: {e}")
                
                if research_sources and self.citation_manager:
                    try:
                        source_list = self.citation_manager.generate_source_list(research_sources)
                    except Exception as e:
                        logger.warning(f"Source list generation failed: {e}")
            else:
                logger.info(f"Citation processing skipped: include_citations={request.include_citations}")
            
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
            # Convert string hashtags from LLM output to HashtagSuggestion objects
            raw_hashtags = content_result.get('hashtags', [])
            if raw_hashtags and isinstance(raw_hashtags[0], str):
                hashtag_suggestions = [HashtagSuggestion(hashtag=h if h.startswith('#') else f'#{h}', category="generated") for h in raw_hashtags]
            else:
                hashtag_suggestions = raw_hashtags
            
            post_content = PostContent(
                content=content_result['content'],
                character_count=len(content_result['content']),
                hashtags=hashtag_suggestions,
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
            
            if request.include_citations:
                # Prefer structured citations from LLM json_struct output
                if content_result.get('citations'):
                    citations = content_result['citations']
                    logger.info(f"Using {len(citations)} structured citations from LLM output for article")
                elif research_sources and self.citation_manager:
                    try:
                        citations = self.citation_manager.extract_citations(content_result['content'])
                        logger.info(f"Extracted {len(citations)} citations from article content")
                    except Exception as e:
                        logger.warning(f"Citation extraction fallback for article failed: {e}")
                
                if research_sources and self.citation_manager:
                    try:
                        source_list = self.citation_manager.generate_source_list(research_sources)
                    except Exception as e:
                        logger.warning(f"Source list generation for article failed: {e}")
            
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
        """Generate post content using provider-agnostic llm_text_gen with structured JSON output."""
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
            has_key_points = getattr(request, 'key_points', None)
            if research_context:
                prompt += research_context
                if has_key_points:
                    prompt += """\n\n        RESEARCH-TO-KEY-POINTS MAPPING:
        For each key point, find which research source(s) best support it. When writing:
        - Open each key point section by anchoring it to its best-matching research finding
        - Use inline references like "According to [Source N]" when citing specific data
        - If research contradicts a key point, acknowledge the nuance rather than forcing alignment"""
            elif has_key_points:
                prompt += """\n\n        NOTE: No external research sources were available. Write the post using your general industry knowledge for each key point. Avoid fabricated data — state opinions, frameworks, and observations instead."""
            
            # Generate content using provider-agnostic gateway with structured JSON schema
            raw_response = llm_text_gen(
                prompt=prompt,
                json_struct=LinkedInPostOutput.model_json_schema(),
                user_id=user_id,
                flow_type="linkedin_post",
                max_tokens=request.max_length,
                temperature=0.7
            )
            
            # Parse structured response (handle both dict from Gemini and str from others)
            if isinstance(raw_response, dict):
                parsed = raw_response
            else:
                cleaned = str(raw_response).strip()
                if cleaned.startswith('```json'):
                    cleaned = cleaned[7:]
                elif cleaned.startswith('```'):
                    cleaned = cleaned[3:]
                if cleaned.endswith('```'):
                    cleaned = cleaned[:-3]
                parsed = json.loads(cleaned)
            
            content_text = parsed.get('content', '').strip()
            hashtags = parsed.get('hashtags', [])
            call_to_action = parsed.get('call_to_action')
            cited_indices = parsed.get('cited_source_indices', [])
            
            # Build citations from cited source indices
            citations = []
            for idx in cited_indices:
                if isinstance(idx, int) and 0 < idx <= len(research_sources):
                    citations.append(Citation(
                        type="inline",
                        reference=f"Source {idx}",
                        source_index=idx - 1,
                        text=self._extract_citation_text(content_text, idx)
                    ))
            
            return {
                'content': content_text,
                'hashtags': hashtags,
                'call_to_action': call_to_action,
                'sources': research_sources,
                'citations': citations,
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
            
        except Exception as e:
            logger.error(f"Error generating post content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn post: {str(e)}")
    
    async def generate_grounded_article_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate article content using provider-agnostic llm_text_gen with structured JSON output."""
        try:
            # Generate title first via dedicated structured call
            article_title = self._generate_article_title(request, research_sources, user_id)
            if not article_title:
                article_title = getattr(request, 'topic', 'LinkedIn Article').strip()
            
            # Build the prompt using persona if available
            persona_data = None
            if user_id:
                persona_data = self._get_cached_persona_data(user_id, 'linkedin')
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
            prompt = ArticlePromptBuilder.build_article_prompt(request, persona=persona_data, article_title=article_title)
            
            # Inject research context (highlights/summary prioritized)
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway with structured JSON schema
            raw_response = llm_text_gen(
                prompt=prompt,
                json_struct=LinkedInArticleOutput.model_json_schema(),
                user_id=user_id,
                flow_type="linkedin_article",
                max_tokens=request.word_count * 10,
                temperature=0.3
            )
            
            # Parse structured response (handle both dict from Gemini and str from others)
            if isinstance(raw_response, dict):
                parsed = raw_response
            else:
                cleaned = str(raw_response).strip()
                if cleaned.startswith('```json'):
                    cleaned = cleaned[7:]
                elif cleaned.startswith('```'):
                    cleaned = cleaned[3:]
                if cleaned.endswith('```'):
                    cleaned = cleaned[:-3]
                parsed = json.loads(cleaned)
            
            content_text = parsed.get('content', '').strip()
            title = article_title or parsed.get('title', request.topic or "LinkedIn Article")
            sections = parsed.get('sections', [])
            seo_metadata = parsed.get('seo_metadata')
            reading_time = parsed.get('reading_time')
            cited_indices = parsed.get('cited_source_indices', [])
            
            # Build citations from cited source indices
            citations = []
            for idx in cited_indices:
                if isinstance(idx, int) and 0 < idx <= len(research_sources):
                    citations.append(Citation(
                        type="inline",
                        reference=f"Source {idx}",
                        source_index=idx - 1,
                        text=self._extract_citation_text(content_text, idx)
                    ))
            
            return {
                'content': content_text,
                'title': title,
                'sections': sections,
                'seo_metadata': seo_metadata,
                'reading_time': reading_time,
                'sources': research_sources,
                'citations': citations,
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
                
        except Exception as e:
            logger.error(f"Error generating article content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn article: {str(e)}")
    
    async def generate_grounded_carousel_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate carousel content using provider-agnostic llm_text_gen with structured JSON output."""
        try:
            prompt = CarouselPromptBuilder.build_carousel_prompt(request)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway with structured JSON schema
            raw_response = llm_text_gen(
                prompt=prompt,
                json_struct=LinkedInCarouselOutput.model_json_schema(),
                user_id=user_id,
                flow_type="linkedin_carousel",
                max_tokens=2000,
                temperature=0.7
            )
            
            # Parse structured response (handle both dict from Gemini and str from others)
            if isinstance(raw_response, dict):
                parsed = raw_response
            else:
                cleaned = str(raw_response).strip()
                if cleaned.startswith('```json'):
                    cleaned = cleaned[7:]
                elif cleaned.startswith('```'):
                    cleaned = cleaned[3:]
                if cleaned.endswith('```'):
                    cleaned = cleaned[:-3]
                parsed = json.loads(cleaned)
            
            slides_raw = parsed.get('slides', [])
            # Convert slide dicts if they came through as plain dicts from JSON
            slides = []
            for s in slides_raw:
                if isinstance(s, dict):
                    slides.append(s)
                else:
                    slides.append(s.model_dump() if hasattr(s, 'model_dump') else dict(s))
            
            cited_indices = parsed.get('cited_source_indices', [])
            
            # Build citations from cited source indices
            citations = []
            all_slide_content = " ".join([s.get('content', '') for s in slides])
            for idx in cited_indices:
                if isinstance(idx, int) and 0 < idx <= len(research_sources):
                    citations.append(Citation(
                        type="inline",
                        reference=f"Source {idx}",
                        source_index=idx - 1,
                        text=self._extract_citation_text(all_slide_content, idx)
                    ))
            
            return {
                'content': parsed.get('content', ''),
                'slides': slides,
                'title': parsed.get('title', ''),
                'cover_slide': parsed.get('cover_slide'),
                'cta_slide': parsed.get('cta_slide'),
                'design_guidelines': parsed.get('design_guidelines', {}),
                'sources': research_sources,
                'citations': citations,
                'grounding_enabled': bool(research_sources),
                'fallback_used': False
            }
            
        except Exception as e:
            logger.error(f"Error generating carousel content: {str(e)}")
            raise Exception(f"Failed to generate LinkedIn carousel: {str(e)}")
    
    async def generate_grounded_video_script_content(self, request, research_sources: List, user_id: str = None) -> Dict[str, Any]:
        """Generate video script content using provider-agnostic llm_text_gen with structured JSON output."""
        try:
            prompt = VideoScriptPromptBuilder.build_video_script_prompt(request)
            
            # Inject research context into prompt
            research_context = self._build_research_context(research_sources)
            if research_context:
                prompt += research_context
            
            # Generate content using provider-agnostic gateway with structured JSON schema
            raw_response = llm_text_gen(
                prompt=prompt,
                json_struct=LinkedInVideoScriptOutput.model_json_schema(),
                user_id=user_id,
                flow_type="linkedin_video_script",
                max_tokens=1500,
                temperature=0.7
            )
            
            # Parse structured response (handle both dict from Gemini and str from others)
            if isinstance(raw_response, dict):
                parsed = raw_response
            else:
                cleaned = str(raw_response).strip()
                if cleaned.startswith('```json'):
                    cleaned = cleaned[7:]
                elif cleaned.startswith('```'):
                    cleaned = cleaned[3:]
                if cleaned.endswith('```'):
                    cleaned = cleaned[:-3]
                parsed = json.loads(cleaned)
            
            hook = parsed.get('hook', '')
            main_content_raw = parsed.get('main_content', [])
            main_content = []
            for s in main_content_raw:
                if isinstance(s, dict):
                    main_content.append(s)
                else:
                    main_content.append(s.model_dump() if hasattr(s, 'model_dump') else dict(s))
            conclusion = parsed.get('conclusion', '')
            captions = parsed.get('captions')
            thumbnail_suggestions = parsed.get('thumbnail_suggestions', [])
            video_description = parsed.get('video_description', '')
            cited_indices = parsed.get('cited_source_indices', [])
            
            # Build citations from cited source indices
            citations = []
            all_scene_content = " ".join([s.get('content', '') for s in main_content])
            full_content = f"{hook} {all_scene_content} {conclusion}"
            for idx in cited_indices:
                if isinstance(idx, int) and 0 < idx <= len(research_sources):
                    citations.append(Citation(
                        type="inline",
                        reference=f"Source {idx}",
                        source_index=idx - 1,
                        text=self._extract_citation_text(full_content, idx)
                    ))
            
            return {
                'hook': hook,
                'main_content': main_content,
                'conclusion': conclusion,
                'captions': captions,
                'thumbnail_suggestions': thumbnail_suggestions,
                'video_description': video_description,
                'content': full_content,
                'sources': research_sources,
                'citations': citations,
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
