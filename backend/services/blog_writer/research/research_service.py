"""
Research Service - Core research functionality for AI Blog Writer.

Handles Google Search grounding, caching, and research orchestration.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from loguru import logger

from models.blog_models import (
    BlogResearchRequest,
    BlogResearchResponse,
    ResearchSource,
    GroundingMetadata,
    GroundingChunk,
    GroundingSupport,
    Citation,
    ResearchConfig,
    ResearchMode,
    ResearchProvider,
)
from services.blog_writer.logger_config import blog_writer_logger, log_function_call
from fastapi import HTTPException

from .keyword_analyzer import KeywordAnalyzer
from .competitor_analyzer import CompetitorAnalyzer
from .content_angle_generator import ContentAngleGenerator
from .data_filter import ResearchDataFilter
from .research_strategies import get_strategy_for_mode


class ResearchService:
    """Service for conducting comprehensive research using Exa neural search.
    
    Currently supports Exa as the primary and only provider for testing and debugging.
    Google Search grounding code is preserved for future use.
    """
    
    def __init__(self):
        self.keyword_analyzer = KeywordAnalyzer()
        self.competitor_analyzer = CompetitorAnalyzer()
        self.content_angle_generator = ContentAngleGenerator()
        self.data_filter = ResearchDataFilter()
    
    @log_function_call("research_operation")
    async def research(self, request: BlogResearchRequest, user_id: str) -> BlogResearchResponse:
        """
        Stage 1: Research & Strategy (AI Orchestration)
        Uses Exa neural search as the primary research provider.
        Follows LinkedIn service pattern for efficiency and cost optimization.
        Includes intelligent caching for exact keyword matches.
        
        Note: Currently Exa-only for testing. Failures will raise errors instead of falling back.
        """
        try:
            from services.cache.research_cache import research_cache
            
            # PHASE C SKIP (persona voice): research is SEO/topic-driven (keywords,
            # search intent, competitors) — not brand voice. `industry`/`target_audience`
            # here are SEO targeting signals, not style. Style/topic separation.
            topic = request.topic or ", ".join(request.keywords)
            industry = request.industry or (request.persona.industry if request.persona and request.persona.industry else "General")
            target_audience = getattr(request.persona, 'target_audience', 'General') if request.persona else 'General'
            
            # Log research parameters
            blog_writer_logger.log_operation_start(
                "research",
                topic=topic,
                industry=industry,
                target_audience=target_audience,
                keywords=request.keywords,
                keyword_count=len(request.keywords)
            )
            
            # Check cache first for exact keyword match
            cached_result = research_cache.get_cached_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience
            )
            
            if cached_result:
                logger.info(f"Returning cached research result for keywords: {request.keywords}")
                blog_writer_logger.log_operation_end("research", 0, success=True, cache_hit=True)
                # Normalize cached data to fix None values in confidence_scores
                normalized_result = self._normalize_cached_research_data(cached_result)
                return BlogResearchResponse(**normalized_result)
            
            # User ID validation (validation logic is now in Google Grounding provider)
            if not user_id:
                raise ValueError("user_id is required for research operation. Please provide Clerk user ID.")
            
            # Cache miss - proceed with API call
            logger.info(f"Cache miss - making API call for keywords: {request.keywords}")
            blog_writer_logger.log_operation_start("research_api_call", api_name="research", operation="research")

            # Determine research mode and get appropriate strategy
            research_mode = request.research_mode or ResearchMode.BASIC
            config = request.config or ResearchConfig(mode=research_mode, provider=ResearchProvider.EXA)
            strategy = get_strategy_for_mode(research_mode)
            
            logger.info(f"Research: mode={research_mode.value}, provider={config.provider.value}")
            
            # Build research prompt based on strategy
            research_prompt = strategy.build_research_prompt(topic, industry, target_audience, config)
            
            # Currently Exa-only for testing - fail if other providers are requested
            if config.provider != ResearchProvider.EXA:
                raise ValueError(f"Only Exa provider is currently supported for testing. Requested provider: {config.provider.value}")
            
            # Route to Exa provider
            if config.provider == ResearchProvider.EXA:
                # Exa research workflow
                from .exa_provider import ExaResearchProvider
                from services.subscription.preflight_validator import validate_exa_research_operations
                from services.database import get_session_for_user
                from services.subscription import PricingService
                import os
                import time
                
                # Pre-flight validation (use get_session_for_user since get_db is a FastAPI dependency)
                db_val = get_session_for_user(user_id)
                if not db_val:
                    raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
                try:
                    pricing_service = PricingService(db_val)
                    gpt_provider = os.getenv("GPT_PROVIDER", "google")
                    validate_exa_research_operations(pricing_service, user_id, gpt_provider)
                finally:
                    if db_val:
                        db_val.close()
                
                # Execute Exa search
                api_start_time = time.time()
                try:
                    exa_provider = ExaResearchProvider()
                    raw_result = await exa_provider.search(
                        research_prompt, topic, industry, target_audience, config, user_id
                    )
                    api_duration_ms = (time.time() - api_start_time) * 1000
                    
                    # Track usage
                    cost = raw_result.get('cost', {}).get('total', 0.005) if isinstance(raw_result.get('cost'), dict) else 0.005
                    exa_provider.track_exa_usage(user_id, cost)
                    
                    # Log API call performance
                    blog_writer_logger.log_api_call(
                        "exa_search",
                        "search_and_contents",
                        api_duration_ms,
                        token_usage={},
                        content_length=len(raw_result.get('content', ''))
                    )
                    
                    # Extract content for downstream analysis
                    content = raw_result.get('content', '')
                    sources = raw_result.get('sources', [])
                    search_widget = ""  # Exa doesn't provide search widgets
                    search_queries = raw_result.get('search_queries', [])
                    grounding_metadata = self._build_grounding_metadata_from_sources(sources, search_queries)
                    
                except RuntimeError as e:
                    # Fail fast - no fallback for testing/debugging
                    logger.error(f"Exa research failed: {e}")
                    raise RuntimeError(f"Exa research failed: {e}. Please ensure EXA_API_KEY is configured.") from e
            
            elif config.provider == ResearchProvider.TAVILY:
                # Tavily research workflow
                from .tavily_provider import TavilyResearchProvider
                from services.database import get_session_for_user
                from services.subscription import PricingService
                import os
                import time
                
                # Pre-flight validation (use get_session_for_user since get_db is a FastAPI dependency)
                db_val = get_session_for_user(user_id)
                if not db_val:
                    raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
                try:
                    pricing_service = PricingService(db_val)
                    # Check Tavily usage limits
                    limits = pricing_service.get_user_limits(user_id)
                    tavily_limit = limits.get('limits', {}).get('tavily_calls', 0) if limits else 0
                    
                    # Get current usage
                    from models.subscription_models import UsageSummary
                    from datetime import datetime
                    current_period = pricing_service.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
                    usage = db_val.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    
                    current_calls = getattr(usage, 'tavily_calls', 0) or 0 if usage else 0
                    
                    if tavily_limit > 0 and current_calls >= tavily_limit:
                        raise HTTPException(
                            status_code=429,
                            detail={
                                'error': 'Tavily API call limit exceeded',
                                'message': f'You have reached your Tavily API call limit ({tavily_limit} calls). Please upgrade your plan or wait for the next billing period.',
                                'provider': 'tavily',
                                'usage_info': {
                                    'current': current_calls,
                                    'limit': tavily_limit
                                }
                            }
                        )
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"Error checking Tavily limits: {e}")
                finally:
                    db_val.close()
                
                # Execute Tavily search
                api_start_time = time.time()
                try:
                    tavily_provider = TavilyResearchProvider()
                    raw_result = await tavily_provider.search(
                        research_prompt, topic, industry, target_audience, config, user_id
                    )
                    api_duration_ms = (time.time() - api_start_time) * 1000
                    
                    # Track usage
                    cost = raw_result.get('cost', {}).get('total', 0.001) if isinstance(raw_result.get('cost'), dict) else 0.001
                    search_depth = config.tavily_search_depth or "basic"
                    tavily_provider.track_tavily_usage(user_id, cost, search_depth)
                    
                    # Log API call performance
                    blog_writer_logger.log_api_call(
                        "tavily_search",
                        "search",
                        api_duration_ms,
                        token_usage={},
                        content_length=len(raw_result.get('content', ''))
                    )
                    
                    # Extract content for downstream analysis
                    content = raw_result.get('content', '')
                    sources = raw_result.get('sources', [])
                    search_widget = ""  # Tavily doesn't provide search widgets
                    search_queries = raw_result.get('search_queries', [])
                    grounding_metadata = self._build_grounding_metadata_from_sources(sources, search_queries)
                    
                except RuntimeError as e:
                    # Fail fast - no fallback for testing/debugging
                    logger.error(f"Tavily research failed: {e}")
                    raise RuntimeError(f"Tavily research failed: {e}. Please ensure TAVILY_API_KEY is configured.") from e
            
            # Validate that we have content and sources before proceeding
            if 'content' not in locals() or 'sources' not in locals():
                raise RuntimeError(f"{config.provider.value} research did not return content or sources. Research failed.")
            
            # Build compact all-source summary for richer analysis
            analysis_content = self._build_analysis_content(sources)
            
            # Run dedicated competitor search for richer competitor intelligence
            competitor_content = analysis_content
            try:
                comp_query = f"top {industry} companies or competitors {topic}"
                comp_results = await exa_provider.simple_search(
                    query=comp_query, num_results=5, user_id=user_id,
                )
                if comp_results:
                    comp_lines = ["COMPETITOR SEARCH RESULTS:"]
                    for r in comp_results:
                        title = r.get('title', '')
                        text = (r.get('text', '') or '')[:400]
                        comp_lines.append(f"- {title}")
                        if text:
                            comp_lines.append(f"  {text[:200]}")
                    competitor_content = "\n".join(comp_lines) + "\n\n" + analysis_content
            except Exception as e:
                logger.warning(f"Competitor search failed (non-critical): {e}")
            
            # Continue with common analysis (same for both providers)
            keyword_analysis = self.keyword_analyzer.analyze(analysis_content, request.keywords, user_id=user_id)
            competitor_analysis = self.competitor_analyzer.analyze(competitor_content, user_id=user_id)
            suggested_angles = self.content_angle_generator.generate(analysis_content, topic, industry, user_id=user_id)
            
            logger.info(f"Research completed successfully with {len(sources)} sources and {len(search_queries)} search queries")
            
            # Log analysis results
            blog_writer_logger.log_performance(
                "research_analysis",
                len(content),
                "characters",
                sources_count=len(sources),
                search_queries_count=len(search_queries),
                keyword_analysis_keys=len(keyword_analysis),
                suggested_angles_count=len(suggested_angles)
            )

            # Create the response
            response = BlogResearchResponse(
                success=True,
                sources=sources,
                keyword_analysis=keyword_analysis,
                competitor_analysis=competitor_analysis,
                suggested_angles=suggested_angles,
                # Add search widget and queries for UI display
                search_widget=search_widget if 'search_widget' in locals() else "",
                search_queries=search_queries if 'search_queries' in locals() else [],
                # Add grounding metadata for detailed UI display
                grounding_metadata=grounding_metadata,
            )
            
            # Filter and clean research data for optimal AI processing
            filtered_response = self.data_filter.filter_research_data(response)
            logger.info("Research data filtering completed successfully")
            
            # Cache the successful result for future exact keyword matches (both caches)
            persistent_research_cache.cache_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience,
                result=filtered_response.dict()
            )
            
            # Also cache in memory for faster access
            research_cache.cache_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience,
                result=filtered_response.dict()
            )
            
            return filtered_response
            
        except HTTPException:
            # Re-raise HTTPException (subscription errors) - let task manager handle it
            raise
        except Exception as e:
            error_message = str(e)
            logger.error(f"Research failed: {error_message}")
            
            # Log error with full context
            blog_writer_logger.log_error(
                e,
                "research",
                context={
                    "topic": topic,
                    "keywords": request.keywords,
                    "industry": industry,
                    "target_audience": target_audience
                }
            )
            
            # Import custom exceptions for better error handling
            from services.blog_writer.exceptions import (
                ResearchFailedException, 
                APIRateLimitException, 
                APITimeoutException,
                ValidationException
            )
            
            # Determine if this is a retryable error
            retry_suggested = True
            user_message = "Research failed. Please try again with different keywords or check your internet connection."
            
            if isinstance(e, APIRateLimitException):
                retry_suggested = True
                user_message = f"Rate limit exceeded. Please wait {e.context.get('retry_after', 60)} seconds before trying again."
            elif isinstance(e, APITimeoutException):
                retry_suggested = True
                user_message = "Research request timed out. Please try again with a shorter query or check your internet connection."
            elif isinstance(e, ValidationException):
                retry_suggested = False
                user_message = "Invalid research request. Please check your input parameters and try again."
            elif "401" in error_message or "403" in error_message:
                retry_suggested = False
                user_message = "Authentication failed. Please check your API credentials."
            elif "400" in error_message:
                retry_suggested = False
                user_message = "Invalid request. Please check your input parameters."
            
            # Return a graceful failure response with enhanced error information
            return BlogResearchResponse(
                success=False,
                sources=[],
                keyword_analysis={},
                competitor_analysis={},
                suggested_angles=[],
                search_widget="",
                search_queries=[],
                error_message=user_message,
                retry_suggested=retry_suggested,
                error_code=getattr(e, 'error_code', 'RESEARCH_FAILED'),
                actionable_steps=getattr(e, 'actionable_steps', [
                    "Try with different keywords",
                    "Check your internet connection",
                    "Wait a few minutes and try again",
                    "Contact support if the issue persists"
                ])
            )
    
    @log_function_call("research_with_progress")
    async def research_with_progress(self, request: BlogResearchRequest, task_id: str, user_id: str) -> BlogResearchResponse:
        """
        Research method with progress updates for real-time feedback.
        """
        try:
            from services.cache.research_cache import research_cache
            from services.cache.persistent_research_cache import persistent_research_cache
            from api.blog_writer.task_manager import task_manager
            
            # PHASE C SKIP (persona voice): research is SEO/topic-driven (keywords,
            # search intent, competitors) — not brand voice. `industry`/`target_audience`
            # here are SEO targeting signals, not style. Style/topic separation.
            topic = request.topic or ", ".join(request.keywords)
            industry = request.industry or (request.persona.industry if request.persona and request.persona.industry else "General")
            target_audience = getattr(request.persona, 'target_audience', 'General') if request.persona else 'General'
            
            # Check cache first for exact keyword match (try both caches)
            await task_manager.update_progress(task_id, "🔍 Checking cache for existing research...")
            
            # Try persistent cache first (survives restarts)
            cached_result = persistent_research_cache.get_cached_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience
            )
            
            # Fallback to in-memory cache
            if not cached_result:
                cached_result = research_cache.get_cached_result(
                    keywords=request.keywords,
                    industry=industry,
                    target_audience=target_audience
                )
            
            if cached_result:
                await task_manager.update_progress(task_id, "✅ Found cached research results! Returning instantly...")
                logger.info(f"Returning cached research result for keywords: {request.keywords}")
                # Normalize cached data to fix None values in confidence_scores
                normalized_result = self._normalize_cached_research_data(cached_result)
                return BlogResearchResponse(**normalized_result)
            
            # User ID validation
            if not user_id:
                await task_manager.update_progress(task_id, "❌ Error: User ID is required for research operation")
                raise ValueError("user_id is required for research operation. Please provide Clerk user ID.")
            
            # Determine research mode and get appropriate strategy
            research_mode = request.research_mode or ResearchMode.BASIC
            config = request.config or ResearchConfig(mode=research_mode, provider=ResearchProvider.EXA)
            strategy = get_strategy_for_mode(research_mode)
            
            logger.info(f"Research: mode={research_mode.value}, provider={config.provider.value}")
            
            # Build research prompt based on strategy
            research_prompt = strategy.build_research_prompt(topic, industry, target_audience, config)
            
            # Currently Exa-only for testing - fail if other providers are requested
            if config.provider != ResearchProvider.EXA:
                raise ValueError(f"Only Exa provider is currently supported for testing. Requested provider: {config.provider.value}")
            
            # Route to Exa provider
            if config.provider == ResearchProvider.EXA:
                # Exa research workflow
                from .exa_provider import ExaResearchProvider
                from services.subscription.preflight_validator import validate_exa_research_operations
                from services.database import get_session_for_user
                from services.subscription import PricingService
                import os
                
                await task_manager.update_progress(task_id, "🌐 Connecting to Exa neural search...")
                
                # Pre-flight validation (use get_session_for_user since get_db is a FastAPI dependency)
                db_val = get_session_for_user(user_id)
                if not db_val:
                    raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
                try:
                    pricing_service = PricingService(db_val)
                    gpt_provider = os.getenv("GPT_PROVIDER", "google")
                    validate_exa_research_operations(pricing_service, user_id, gpt_provider)
                except HTTPException as http_error:
                    logger.error(f"Subscription limit exceeded for Exa research: {http_error.detail}")
                    await task_manager.update_progress(task_id, f"❌ Subscription limit exceeded: {http_error.detail.get('message', str(http_error.detail)) if isinstance(http_error.detail, dict) else str(http_error.detail)}")
                    raise
                finally:
                    if db_val:
                        db_val.close()
                
                # Execute Exa search
                await task_manager.update_progress(task_id, "🤖 Executing Exa neural search...")
                try:
                    exa_provider = ExaResearchProvider()
                    raw_result = await exa_provider.search(
                        research_prompt, topic, industry, target_audience, config, user_id
                    )
                    
                    # Track usage
                    cost = raw_result.get('cost', {}).get('total', 0.005) if isinstance(raw_result.get('cost'), dict) else 0.005
                    exa_provider.track_exa_usage(user_id, cost)
                    
                    # Extract content for downstream analysis
                    # Handle None result case
                    if raw_result is None:
                        logger.error("raw_result is None after Exa search - this should not happen if HTTPException was raised")
                        raise ValueError("Exa research result is None - search operation failed unexpectedly")
                    
                    if not isinstance(raw_result, dict):
                        logger.warning(f"raw_result is not a dict (type: {type(raw_result)}), using defaults")
                        raw_result = {}
                    
                    content = raw_result.get('content', '')
                    sources = raw_result.get('sources', []) or []
                    search_widget = ""  # Exa doesn't provide search widgets
                    search_queries = raw_result.get('search_queries', []) or []
                    grounding_metadata = self._build_grounding_metadata_from_sources(sources, search_queries)
                    
                except RuntimeError as e:
                    # Fail fast - no fallback for testing/debugging
                    logger.error(f"Exa research failed: {e}")
                    await task_manager.update_progress(task_id, f"❌ Exa research failed: {str(e)}")
                    raise RuntimeError(f"Exa research failed: {e}. Please ensure EXA_API_KEY is configured.") from e
            
            elif config.provider == ResearchProvider.TAVILY:
                # Tavily research workflow
                from .tavily_provider import TavilyResearchProvider
                from services.database import get_session_for_user
                from services.subscription import PricingService
                import os
                
                await task_manager.update_progress(task_id, "🌐 Connecting to Tavily AI search...")
                
                # Pre-flight validation (use get_session_for_user since get_db is a FastAPI dependency)
                db_val = get_session_for_user(user_id)
                if not db_val:
                    raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")
                try:
                    pricing_service = PricingService(db_val)
                    # Check Tavily usage limits
                    limits = pricing_service.get_user_limits(user_id)
                    tavily_limit = limits.get('limits', {}).get('tavily_calls', 0) if limits else 0
                    
                    # Get current usage
                    from models.subscription_models import UsageSummary
                    from datetime import datetime
                    current_period = pricing_service.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
                    usage = db_val.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    
                    current_calls = getattr(usage, 'tavily_calls', 0) or 0 if usage else 0
                    
                    if tavily_limit > 0 and current_calls >= tavily_limit:
                        await task_manager.update_progress(task_id, f"❌ Tavily API call limit exceeded ({current_calls}/{tavily_limit})")
                        raise HTTPException(
                            status_code=429,
                            detail={
                                'error': 'Tavily API call limit exceeded',
                                'message': f'You have reached your Tavily API call limit ({tavily_limit} calls). Please upgrade your plan or wait for the next billing period.',
                                'provider': 'tavily',
                                'usage_info': {
                                    'current': current_calls,
                                    'limit': tavily_limit
                                }
                            }
                        )
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"Error checking Tavily limits: {e}")
                finally:
                    if db_val:
                        db_val.close()
                
                # Execute Tavily search
                await task_manager.update_progress(task_id, "🤖 Executing Tavily AI search...")
                try:
                    tavily_provider = TavilyResearchProvider()
                    raw_result = await tavily_provider.search(
                        research_prompt, topic, industry, target_audience, config, user_id
                    )
                    
                    # Track usage
                    cost = raw_result.get('cost', {}).get('total', 0.001) if isinstance(raw_result.get('cost'), dict) else 0.001
                    search_depth = config.tavily_search_depth or "basic"
                    tavily_provider.track_tavily_usage(user_id, cost, search_depth)
                    
                    # Extract content for downstream analysis
                    if raw_result is None:
                        logger.error("raw_result is None after Tavily search")
                        raise ValueError("Tavily research result is None - search operation failed unexpectedly")
                    
                    if not isinstance(raw_result, dict):
                        logger.warning(f"raw_result is not a dict (type: {type(raw_result)}), using defaults")
                        raw_result = {}
                    
                    content = raw_result.get('content', '')
                    sources = raw_result.get('sources', []) or []
                    search_widget = ""  # Tavily doesn't provide search widgets
                    search_queries = raw_result.get('search_queries', []) or []
                    grounding_metadata = self._build_grounding_metadata_from_sources(sources, search_queries)
                    
                except RuntimeError as e:
                    # Fail fast - no fallback for testing/debugging
                    logger.error(f"Tavily research failed: {e}")
                    await task_manager.update_progress(task_id, f"❌ Tavily research failed: {str(e)}")
                    raise RuntimeError(f"Tavily research failed: {e}. Please ensure TAVILY_API_KEY is configured.") from e
            
            # Validate that we have content and sources before proceeding
            if config.provider == ResearchProvider.EXA and ('content' not in locals() or 'sources' not in locals()):
                await task_manager.update_progress(task_id, "❌ Exa research did not return content or sources")
                raise RuntimeError("Exa research did not return content or sources. Research failed.")
            elif config.provider == ResearchProvider.TAVILY and ('content' not in locals() or 'sources' not in locals()):
                await task_manager.update_progress(task_id, "❌ Tavily research did not return content or sources")
                raise RuntimeError("Tavily research did not return content or sources. Research failed.")
            
            # Continue with common analysis (same for both providers)
            await task_manager.update_progress(task_id, "🔍 Analyzing keywords and content angles...")
            analysis_content = self._build_analysis_content(sources)
            
            # Run dedicated competitor search for richer competitor intelligence
            competitor_content = analysis_content
            try:
                comp_query = f"top {industry} companies or competitors {topic}"
                comp_results = await exa_provider.simple_search(
                    query=comp_query, num_results=5, user_id=user_id,
                )
                if comp_results:
                    comp_lines = ["COMPETITOR SEARCH RESULTS:"]
                    for r in comp_results:
                        title = r.get('title', '')
                        text = (r.get('text', '') or '')[:400]
                        comp_lines.append(f"- {title}")
                        if text:
                            comp_lines.append(f"  {text[:200]}")
                    competitor_content = "\n".join(comp_lines) + "\n\n" + analysis_content
            except Exception as e:
                logger.warning(f"Competitor search failed (non-critical): {e}")
            
            keyword_analysis = self.keyword_analyzer.analyze(analysis_content, request.keywords, user_id=user_id)
            competitor_analysis = self.competitor_analyzer.analyze(competitor_content, user_id=user_id)
            suggested_angles = self.content_angle_generator.generate(analysis_content, topic, industry, user_id=user_id)
            
            await task_manager.update_progress(task_id, "💾 Caching results for future use...")
            logger.info(f"Research completed successfully with {len(sources)} sources and {len(search_queries)} search queries")

            # Create the response
            response = BlogResearchResponse(
                success=True,
                sources=sources,
                keyword_analysis=keyword_analysis,
                competitor_analysis=competitor_analysis,
                suggested_angles=suggested_angles,
                # Add search widget and queries for UI display
                search_widget=search_widget if 'search_widget' in locals() else "",
                search_queries=search_queries if 'search_queries' in locals() else [],
                # Add grounding metadata for detailed UI display
                grounding_metadata=grounding_metadata,
                # Preserve original user keywords for caching
                original_keywords=request.keywords,
            )
            
            # Filter and clean research data for optimal AI processing
            await task_manager.update_progress(task_id, "🔍 Filtering and cleaning research data...")
            filtered_response = self.data_filter.filter_research_data(response)
            logger.info("Research data filtering completed successfully")
            
            # Cache the successful result for future exact keyword matches (both caches)
            persistent_research_cache.cache_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience,
                result=filtered_response.dict()
            )
            
            # Also cache in memory for faster access
            research_cache.cache_result(
                keywords=request.keywords,
                industry=industry,
                target_audience=target_audience,
                result=filtered_response.dict()
            )
            
            return filtered_response
            
        except HTTPException:
            # Re-raise HTTPException (subscription errors) - let task manager handle it
            raise
        except Exception as e:
            error_message = str(e)
            logger.error(f"Research failed: {error_message}")
            
            # Log error with full context
            blog_writer_logger.log_error(
                e,
                "research",
                context={
                    "topic": topic,
                    "keywords": request.keywords,
                    "industry": industry,
                    "target_audience": target_audience
                }
            )
            
            # Import custom exceptions for better error handling
            from services.blog_writer.exceptions import (
                ResearchFailedException, 
                APIRateLimitException, 
                APITimeoutException,
                ValidationException
            )
            
            # Determine if this is a retryable error
            retry_suggested = True
            user_message = "Research failed. Please try again with different keywords or check your internet connection."
            
            if isinstance(e, APIRateLimitException):
                retry_suggested = True
                user_message = f"Rate limit exceeded. Please wait {e.context.get('retry_after', 60)} seconds before trying again."
            elif isinstance(e, APITimeoutException):
                retry_suggested = True
                user_message = "Research request timed out. Please try again with a shorter query or check your internet connection."
            elif isinstance(e, ValidationException):
                retry_suggested = False
                user_message = "Invalid research request. Please check your input parameters and try again."
            elif "401" in error_message or "403" in error_message:
                retry_suggested = False
                user_message = "Authentication failed. Please check your API credentials."
            elif "400" in error_message:
                retry_suggested = False
                user_message = "Invalid request. Please check your input parameters."
            
            # Return a graceful failure response with enhanced error information
            return BlogResearchResponse(
                success=False,
                sources=[],
                keyword_analysis={},
                competitor_analysis={},
                suggested_angles=[],
                search_widget="",
                search_queries=[],
                error_message=user_message,
                retry_suggested=retry_suggested,
                error_code=getattr(e, 'error_code', 'RESEARCH_FAILED'),
                actionable_steps=getattr(e, 'actionable_steps', [
                    "Try with different keywords",
                    "Check your internet connection",
                    "Wait a few minutes and try again",
                    "Contact support if the issue persists"
                ])
            )

    def _extract_sources_from_grounding(self, gemini_result: Dict[str, Any]) -> List[ResearchSource]:
        """Extract sources from Gemini grounding metadata."""
        sources = []
        
        # Handle None or invalid gemini_result
        if not gemini_result or not isinstance(gemini_result, dict):
            logger.warning("gemini_result is None or not a dict, returning empty sources")
            return sources
        
        # The Gemini grounded provider already extracts sources and puts them in the 'sources' field
        raw_sources = gemini_result.get("sources", [])
        # Ensure raw_sources is a list (handle None case)
        if raw_sources is None:
            raw_sources = []
        
        for src in raw_sources:
            source = ResearchSource(
                title=src.get("title", "Untitled"),
                url=src.get("url", ""),
                excerpt=src.get("content", "")[:500] if src.get("content") else f"Source from {src.get('title', 'web')}",
                credibility_score=float(src.get("credibility_score", 0.8)),
                published_at=str(src.get("publication_date", f"{datetime.now().year}-01-01")),
                index=src.get("index"),
                source_type=src.get("type", "web")
            )
            sources.append(source)
        
        return sources

    def _build_grounding_metadata_from_sources(self, sources: List[Dict[str, Any]], search_queries: List[str]) -> Optional[GroundingMetadata]:
        """Build GroundingMetadata from Exa/Tavily sources (which lack native Google grounding)."""
        if not sources:
            return None

        grounding_chunks = []
        grounding_supports = []
        citations = []

        for i, source in enumerate(sources):
            score = source.get('credibility_score', 0.85)

            chunk = GroundingChunk(
                title=source.get('title', 'Untitled'),
                url=source.get('url', ''),
                confidence_score=score,
            )
            grounding_chunks.append(chunk)

            highlights = source.get('highlights', [])
            if highlights:
                for h in highlights:
                    grounding_supports.append(GroundingSupport(
                        confidence_scores=[score],
                        grounding_chunk_indices=[i],
                        segment_text=h,
                    ))
            else:
                excerpt = source.get('excerpt', '')
                if excerpt:
                    grounding_supports.append(GroundingSupport(
                        confidence_scores=[score],
                        grounding_chunk_indices=[i],
                        segment_text=excerpt,
                    ))

            citations.append(Citation(
                citation_type='inline',
                start_index=0,
                end_index=0,
                text=(highlights[0] if highlights else source.get('excerpt', source.get('title', '')))[:200],
                source_indices=[i],
                reference=f'Source {i + 1}',
            ))

        return GroundingMetadata(
            grounding_chunks=grounding_chunks,
            grounding_supports=grounding_supports,
            citations=citations,
            web_search_queries=search_queries or [],
        )

    def _build_analysis_content(self, sources: List[Dict[str, Any]]) -> str:
        """Build compact all-source summary for LLM analysis.

        Each source is distilled to one line with title, key content, and highlights.
        This ensures ALL sources are visible to keyword, competitor, and angle
        analyzers instead of only the first few (raw content[:3000]).
        """
        if not sources:
            return ""
        lines = []
        for src in sources:
            title = src.get('title', '') or ''
            summary = src.get('summary', '') or ''
            highlights = src.get('highlights', []) or []
            excerpt = src.get('excerpt', '') or ''
            part = f"• {title}"
            if summary:
                part += f" — {summary[:250]}"
            elif excerpt:
                part += f" — {excerpt[:250]}"
            if highlights:
                findings = [h[:120] for h in highlights[:2] if h]
                if findings:
                    part += f" | {'; '.join(findings)}"
            lines.append(part)
        return "\n".join(lines)

    def _normalize_cached_research_data(self, cached_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize cached research data to fix None values in confidence_scores.
        Ensures all GroundingSupport objects have confidence_scores as a list.
        """
        if not isinstance(cached_data, dict):
            return cached_data
        
        normalized = cached_data.copy()
        
        # Normalize grounding_metadata if present
        if "grounding_metadata" in normalized and normalized["grounding_metadata"]:
            grounding_metadata = normalized["grounding_metadata"].copy() if isinstance(normalized["grounding_metadata"], dict) else {}
            
            # Normalize grounding_supports
            if "grounding_supports" in grounding_metadata and isinstance(grounding_metadata["grounding_supports"], list):
                normalized_supports = []
                for support in grounding_metadata["grounding_supports"]:
                    if isinstance(support, dict):
                        normalized_support = support.copy()
                        # Fix confidence_scores: ensure it's a list, not None
                        if normalized_support.get("confidence_scores") is None:
                            normalized_support["confidence_scores"] = []
                        elif not isinstance(normalized_support.get("confidence_scores"), list):
                            # If it's not a list, try to convert or default to empty list
                            normalized_support["confidence_scores"] = []
                        # Fix grounding_chunk_indices: ensure it's a list, not None
                        if normalized_support.get("grounding_chunk_indices") is None:
                            normalized_support["grounding_chunk_indices"] = []
                        elif not isinstance(normalized_support.get("grounding_chunk_indices"), list):
                            normalized_support["grounding_chunk_indices"] = []
                        # Ensure segment_text is a string
                        if normalized_support.get("segment_text") is None:
                            normalized_support["segment_text"] = ""
                        normalized_supports.append(normalized_support)
                    else:
                        normalized_supports.append(support)
                grounding_metadata["grounding_supports"] = normalized_supports
            
            normalized["grounding_metadata"] = grounding_metadata
        
        return normalized

    def _extract_grounding_metadata(self, gemini_result: Dict[str, Any]) -> GroundingMetadata:
        """Extract detailed grounding metadata from Gemini result."""
        grounding_chunks = []
        grounding_supports = []
        citations = []
        
        # Handle None or invalid gemini_result
        if not gemini_result or not isinstance(gemini_result, dict):
            logger.warning("gemini_result is None or not a dict, returning empty grounding metadata")
            return GroundingMetadata(
                grounding_chunks=grounding_chunks,
                grounding_supports=grounding_supports,
                citations=citations
            )
        
        # Extract grounding chunks from the raw grounding metadata
        raw_grounding = gemini_result.get("grounding_metadata", {})
        
        # Handle case where grounding_metadata might be a GroundingMetadata object
        if hasattr(raw_grounding, 'grounding_chunks'):
            raw_chunks = raw_grounding.grounding_chunks
        else:
            raw_chunks = raw_grounding.get("grounding_chunks", []) if isinstance(raw_grounding, dict) else []
        
        # Ensure raw_chunks is a list (handle None case)
        if raw_chunks is None:
            raw_chunks = []
        
        for chunk in raw_chunks:
            if "web" in chunk:
                web_data = chunk["web"]
                grounding_chunk = GroundingChunk(
                    title=web_data.get("title", "Untitled"),
                    url=web_data.get("uri", ""),
                    confidence_score=None  # Will be set from supports
                )
                grounding_chunks.append(grounding_chunk)
        
        # Extract grounding supports with confidence scores
        if hasattr(raw_grounding, 'grounding_supports'):
            raw_supports = raw_grounding.grounding_supports
        else:
            raw_supports = raw_grounding.get("grounding_supports", [])
        for support in raw_supports:
            # Handle both dictionary and GroundingSupport object formats
            if hasattr(support, 'confidence_scores'):
                confidence_scores = support.confidence_scores
                chunk_indices = support.grounding_chunk_indices
                segment_text = getattr(support, 'segment_text', '')
                start_index = getattr(support, 'start_index', None)
                end_index = getattr(support, 'end_index', None)
            else:
                confidence_scores = support.get("confidence_scores", [])
                chunk_indices = support.get("grounding_chunk_indices", [])
                segment = support.get("segment", {})
                segment_text = segment.get("text", "")
                start_index = segment.get("start_index")
                end_index = segment.get("end_index")
            
            grounding_support = GroundingSupport(
                confidence_scores=confidence_scores,
                grounding_chunk_indices=chunk_indices,
                segment_text=segment_text,
                start_index=start_index,
                end_index=end_index
            )
            grounding_supports.append(grounding_support)
            
            # Update confidence scores for chunks
            if confidence_scores and chunk_indices:
                avg_confidence = sum(confidence_scores) / len(confidence_scores)
                for idx in chunk_indices:
                    if idx < len(grounding_chunks):
                        grounding_chunks[idx].confidence_score = avg_confidence
        
        # Extract citations from the raw result
        raw_citations = gemini_result.get("citations", [])
        for citation in raw_citations:
            citation_obj = Citation(
                citation_type=citation.get("type", "inline"),
                start_index=citation.get("start_index", 0),
                end_index=citation.get("end_index", 0),
                text=citation.get("text", ""),
                source_indices=citation.get("source_indices", []),
                reference=citation.get("reference", "")
            )
            citations.append(citation_obj)
        
        # Extract search entry point and web search queries
        if hasattr(raw_grounding, 'search_entry_point'):
            search_entry_point = getattr(raw_grounding.search_entry_point, 'rendered_content', '') if raw_grounding.search_entry_point else ''
        else:
            search_entry_point = raw_grounding.get("search_entry_point", {}).get("rendered_content", "")
        
        if hasattr(raw_grounding, 'web_search_queries'):
            web_search_queries = raw_grounding.web_search_queries
        else:
            web_search_queries = raw_grounding.get("web_search_queries", [])
        
        return GroundingMetadata(
            grounding_chunks=grounding_chunks,
            grounding_supports=grounding_supports,
            citations=citations,
            search_entry_point=search_entry_point,
            web_search_queries=web_search_queries
        )
