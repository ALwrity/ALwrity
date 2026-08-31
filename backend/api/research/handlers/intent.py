"""
Intent-Driven Research Handler

Handles intent analysis and intent-driven research endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from loguru import logger
import asyncio

from services.database import get_db
from services.research.core import (
    ResearchEngine,
    ResearchContext,
    ResearchPersonalizationContext,
    ResearchGoal,
    ResearchDepth,
    ProviderPreference,
)
from middleware.auth_middleware import get_current_user
from models.research_intent_models import (
    ResearchIntent,
    ResearchQuery,
    ExpectedDeliverable,
)
from services.research.intent import (
    ResearchIntentInference,
    IntentQueryGenerator,
    IntentAwareAnalyzer,
)
from ..models import (
    AnalyzeIntentRequest,
    AnalyzeIntentResponse,
    IntentDrivenResearchRequest,
    IntentDrivenResearchResponse,
)
from ..utils import (
    map_purpose_to_goal,
    map_depth_to_engine_depth,
    map_provider_to_preference,
    merge_trends_data,
)

router = APIRouter()


@router.post("/intent/analyze", response_model=AnalyzeIntentResponse)
async def analyze_research_intent(
    request: AnalyzeIntentRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Analyze user input to understand research intent.
    
    This endpoint uses AI to infer what the user really wants from their research:
    - What questions need answering
    - What deliverables they expect (statistics, quotes, case studies, etc.)
    - What depth and focus is appropriate
    
    The response includes quick options that can be shown in the UI for user confirmation.
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")
        
        logger.info(f"[Intent API] Analyzing intent for: {request.user_input[:50]}...")
        
        # Get research persona if requested
        research_persona = None
        competitor_data = None
        
        if request.use_persona or request.use_competitor_data:
            from services.research.research_persona_service import ResearchPersonaService
            from api.content_planning.services.content_strategy.onboarding import OnboardingDataIntegrationService
            from sqlalchemy.orm import Session
            
            # Get database session
            db = next(get_db())
            try:
                persona_service = ResearchPersonaService(db)
                integration_service = OnboardingDataIntegrationService()
                
                if request.use_persona:
                    research_persona = persona_service.get_or_generate(user_id)
                
                if request.use_competitor_data:
                    # Use SSOT integration service
                    integrated_data = integration_service.get_integrated_data_sync(user_id, db)
                    competitor_data = integrated_data.get('competitor_analysis', [])
            finally:
                db.close()
        
        # Use Unified Research Analyzer (single AI call for intent + queries + params)
        from services.research.intent.unified_research_analyzer import UnifiedResearchAnalyzer
        
        analyzer = UnifiedResearchAnalyzer()
        unified_result = await analyzer.analyze(
            user_input=request.user_input,
            keywords=request.keywords,
            research_persona=research_persona,
            competitor_data=competitor_data,
            industry=research_persona.default_industry if research_persona else None,
            target_audience=research_persona.default_target_audience if research_persona else None,
            user_id=user_id,
            user_provided_purpose=request.user_provided_purpose,
            user_provided_content_output=request.user_provided_content_output,
            user_provided_depth=request.user_provided_depth,
        )
        
        if not unified_result.get("success", False):
            logger.warning("Unified analysis failed, using fallback")
        
        # Extract results
        intent = unified_result.get("intent")
        queries = unified_result.get("queries", [])
        exa_config = unified_result.get("exa_config", {})
        tavily_config = unified_result.get("tavily_config", {})
        trends_config = unified_result.get("trends_config", {})  # NEW: Google Trends config
        
        # Build optimized config with AI-driven justifications
        optimized_config = {
            "provider": unified_result.get("recommended_provider", "exa"),
            "provider_justification": unified_result.get("provider_justification", ""),
            # Exa settings with justifications
            "exa_type": exa_config.get("type", "auto"),
            "exa_type_justification": exa_config.get("type_justification", ""),
            "exa_category": exa_config.get("category"),
            "exa_category_justification": exa_config.get("category_justification", ""),
            "exa_include_domains": exa_config.get("includeDomains", []),
            "exa_include_domains_justification": exa_config.get("includeDomains_justification", ""),
            "exa_num_results": exa_config.get("numResults", 10),
            "exa_num_results_justification": exa_config.get("numResults_justification", ""),
            "exa_date_filter": exa_config.get("startPublishedDate"),
            "exa_date_justification": exa_config.get("date_justification", ""),
            "exa_highlights": exa_config.get("highlights", True),
            "exa_highlights_justification": exa_config.get("highlights_justification", ""),
            "exa_context": exa_config.get("context", True),
            "exa_context_justification": exa_config.get("context_justification", ""),
            # Tavily settings with justifications
            "tavily_topic": tavily_config.get("topic", "general"),
            "tavily_topic_justification": tavily_config.get("topic_justification", ""),
            "tavily_search_depth": tavily_config.get("search_depth", "advanced"),
            "tavily_search_depth_justification": tavily_config.get("search_depth_justification", ""),
            "tavily_include_answer": tavily_config.get("include_answer", True),
            "tavily_include_answer_justification": tavily_config.get("include_answer_justification", ""),
            "tavily_time_range": tavily_config.get("time_range"),
            "tavily_time_range_justification": tavily_config.get("time_range_justification", ""),
            "tavily_max_results": tavily_config.get("max_results", 10),
            "tavily_max_results_justification": tavily_config.get("max_results_justification", ""),
            "tavily_raw_content": tavily_config.get("include_raw_content", "markdown"),
            "tavily_raw_content_justification": tavily_config.get("include_raw_content_justification", ""),
        }
        
        # Build trends config response (if enabled)
        trends_config_response = None
        if trends_config.get("enabled", False):
            trends_config_response = {
                "enabled": True,
                "keywords": trends_config.get("keywords", []),
                "keywords_justification": trends_config.get("keywords_justification", ""),
                "timeframe": trends_config.get("timeframe", "today 12-m"),
                "timeframe_justification": trends_config.get("timeframe_justification", ""),
                "geo": trends_config.get("geo", "US"),
                "geo_justification": trends_config.get("geo_justification", ""),
                "expected_insights": trends_config.get("expected_insights", []),
            }
        
        return AnalyzeIntentResponse(
            success=True,
            intent=intent.dict() if hasattr(intent, 'dict') else intent,
            analysis_summary=unified_result.get("analysis_summary", ""),
            suggested_queries=[q.dict() if hasattr(q, 'dict') else q for q in queries],
            suggested_keywords=unified_result.get("enhanced_keywords", []),
            suggested_angles=unified_result.get("research_angles", []),
            quick_options=[],  # Deprecated in unified approach
            confidence_reason=intent.confidence_reason if hasattr(intent, 'confidence_reason') else "",
            great_example=intent.great_example if hasattr(intent, 'great_example') else "",
            optimized_config=optimized_config,
            recommended_provider=unified_result.get("recommended_provider", "exa"),
            trends_config=trends_config_response,  # NEW: Google Trends configuration
        )
        
    except Exception as e:
        logger.error(f"[Intent API] Analyze failed: {e}")
        return AnalyzeIntentResponse(
            success=False,
            intent={},
            analysis_summary="",
            suggested_queries=[],
            suggested_keywords=[],
            suggested_angles=[],
            quick_options=[],
            confidence_reason=None,
            great_example=None,
            error_message=str(e),
        )


@router.post("/intent/research", response_model=IntentDrivenResearchResponse)
async def execute_intent_driven_research(
    request: IntentDrivenResearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Execute research based on user intent.
    
    This is the main endpoint for intent-driven research. It:
    1. Uses the confirmed intent (or infers from user_input if not provided)
    2. Generates targeted queries for each expected deliverable
    3. Executes research using Exa/Tavily/Google
    4. Analyzes results through the lens of user intent
    5. Returns exactly what the user needs
    
    The response is organized by deliverable type (statistics, quotes, case studies, etc.)
    instead of generic search results.
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = str(current_user.get('id', ''))
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user ID")
        
        logger.info(f"[Intent API] Executing intent-driven research for: {request.user_input[:50]}...")
        
        # Get database session
        db = next(get_db())
        
        try:
            # Get research persona
            from services.research.research_persona_service import ResearchPersonaService
            persona_service = ResearchPersonaService(db)
            research_persona = persona_service.get_or_generate(user_id)
            
            # Determine intent
            if request.confirmed_intent:
                # Use confirmed intent from UI
                intent = ResearchIntent(**request.confirmed_intent)
            elif not request.skip_inference:
                # Infer intent from user input
                intent_service = ResearchIntentInference()
                intent_response = await intent_service.infer_intent(
                    user_input=request.user_input,
                    research_persona=research_persona,
                    user_id=user_id,
                )
                intent = intent_response.intent
            else:
                # Create basic intent from input
                intent = ResearchIntent(
                    primary_question=f"What are the key insights about: {request.user_input}?",
                    purpose="learn",
                    content_output="general",
                    expected_deliverables=["key_statistics", "best_practices", "examples"],
                    depth="detailed",
                    original_input=request.user_input,
                    confidence=0.6,
                )
            
            # Generate or use provided queries
            if request.selected_queries:
                queries = [ResearchQuery(**q) for q in request.selected_queries]
            else:
                query_generator = IntentQueryGenerator()
                query_result = await query_generator.generate_queries(
                    intent=intent,
                    research_persona=research_persona,
                    user_id=user_id,
                )
                queries = query_result.get("queries", [])
            
            # Execute research using the Research Engine
            engine = ResearchEngine(db_session=db)
            
            # Build context from intent
            personalization = ResearchPersonalizationContext(
                creator_id=user_id,
                industry=research_persona.default_industry if research_persona else None,
                target_audience=research_persona.default_target_audience if research_persona else None,
            )
            
            # Use the highest priority query for the main search
            # (In a more advanced version, we could run multiple queries and merge)
            primary_query = queries[0] if queries else ResearchQuery(
                query=request.user_input,
                purpose=ExpectedDeliverable.KEY_STATISTICS,
                provider="exa",
                priority=5,
                expected_results="General research results",
            )
            
            context = ResearchContext(
                query=primary_query.query,
                keywords=request.user_input.split()[:10],
                goal=map_purpose_to_goal(intent.purpose),
                depth=map_depth_to_engine_depth(intent.depth),
                provider_preference=map_provider_to_preference(primary_query.provider),
                personalization=personalization,
                max_sources=request.max_sources,
                include_domains=request.include_domains,
                exclude_domains=request.exclude_domains,
            )
            
            # Execute research and trends in parallel
            research_task = asyncio.create_task(engine.research(context))
            
            # Execute trends analysis in parallel (if enabled)
            trends_task = None
            trends_data = None
            if request.trends_config and request.trends_config.get("enabled"):
                from api.research.utils import _fetch_research_trends
                trends_task = asyncio.create_task(
                    _fetch_research_trends(
                        keywords=request.trends_config.get("keywords", []),
                        timeframe=request.trends_config.get("timeframe", "today 12-m"),
                        geo=request.trends_config.get("geo", "US"),
                        user_id=user_id,
                    )
                )
            
            # Wait for research to complete
            raw_result = await research_task
            
            # Wait for trends if it was started
            if trends_task:
                try:
                    trends_data = await trends_task
                    logger.info(f"Trend data fetched: {len(trends_data.get('trends', []))} trends, {len(trends_data.get('items', []))} items")
                except Exception as e:
                    logger.error(f"Trend analysis failed: {e}")
                    trends_data = None
            
            # Analyze results using intent-aware analyzer
            analyzer = IntentAwareAnalyzer()
            analyzed_result = await analyzer.analyze(
                raw_results={
                    "content": raw_result.raw_content or "",
                    "sources": raw_result.sources,
                    "grounding_metadata": raw_result.grounding_metadata,
                },
                intent=intent,
                research_persona=research_persona,
                user_id=user_id,  # Required for subscription checking
            )
            
            # Merge Google Trends data into trends analysis
            if trends_data and analyzed_result.trends:
                analyzed_result = merge_trends_data(analyzed_result, trends_data)
            
            # Build response
            return IntentDrivenResearchResponse(
                success=True,
                primary_answer=analyzed_result.primary_answer,
                secondary_answers=analyzed_result.secondary_answers,
                focus_areas_coverage=analyzed_result.focus_areas_coverage,
                also_answering_coverage=analyzed_result.also_answering_coverage,
                statistics=[s.dict() for s in analyzed_result.statistics],
                expert_quotes=[q.dict() for q in analyzed_result.expert_quotes],
                case_studies=[cs.dict() for cs in analyzed_result.case_studies],
                trends=[t.dict() for t in analyzed_result.trends],
                comparisons=[c.dict() for c in analyzed_result.comparisons],
                best_practices=analyzed_result.best_practices,
                step_by_step=analyzed_result.step_by_step,
                pros_cons=analyzed_result.pros_cons.dict() if analyzed_result.pros_cons else None,
                definitions=analyzed_result.definitions,
                examples=analyzed_result.examples,
                predictions=analyzed_result.predictions,
                executive_summary=analyzed_result.executive_summary,
                key_takeaways=analyzed_result.key_takeaways,
                suggested_outline=analyzed_result.suggested_outline,
                sources=[s.dict() for s in analyzed_result.sources],
                confidence=analyzed_result.confidence,
                gaps_identified=analyzed_result.gaps_identified,
                follow_up_queries=analyzed_result.follow_up_queries,
                intent=intent.dict(),
                google_trends_data=trends_data,  # Include Google Trends data in response
            )
            
        finally:
            db.close()
        
    except Exception as e:
        logger.error(f"[Intent API] Research failed: {e}")
        import traceback
        traceback.print_exc()
        return IntentDrivenResearchResponse(
            success=False,
            error_message=str(e),
        )
