"""
Research API Utilities

Helper functions for research endpoints.
"""

from typing import Dict, Any
from services.research.core import (
    ResearchContext,
    ResearchPersonalizationContext,
    ContentType,
    ResearchGoal,
    ResearchDepth,
    ProviderPreference,
)
from models.research_intent_models import TrendAnalysis
from services.research.trends import TavilyTrendProvider, TrendPlatform, synthesize_trends


def convert_to_research_context(request, user_id: str) -> ResearchContext:
    """Convert API request to ResearchContext."""
    from .models import ResearchRequest
    
    # Map string enums
    goal_map = {
        "factual": ResearchGoal.FACTUAL,
        "trending": ResearchGoal.TRENDING,
        "competitive": ResearchGoal.COMPETITIVE,
        "educational": ResearchGoal.EDUCATIONAL,
        "technical": ResearchGoal.TECHNICAL,
        "inspirational": ResearchGoal.INSPIRATIONAL,
    }
    
    depth_map = {
        "quick": ResearchDepth.QUICK,
        "standard": ResearchDepth.STANDARD,
        "comprehensive": ResearchDepth.COMPREHENSIVE,
        "expert": ResearchDepth.EXPERT,
    }
    
    provider_map = {
        "auto": ProviderPreference.AUTO,
        "exa": ProviderPreference.EXA,
        "tavily": ProviderPreference.TAVILY,
        "google": ProviderPreference.GOOGLE,
        "hybrid": ProviderPreference.HYBRID,
    }
    
    content_type_map = {
        "blog": ContentType.BLOG,
        "podcast": ContentType.PODCAST,
        "video": ContentType.VIDEO,
        "social": ContentType.SOCIAL,
        "email": ContentType.EMAIL,
        "newsletter": ContentType.NEWSLETTER,
        "whitepaper": ContentType.WHITEPAPER,
        "general": ContentType.GENERAL,
    }
    
    # Build personalization context
    personalization = ResearchPersonalizationContext(
        creator_id=user_id,
        content_type=content_type_map.get(request.content_type or "general", ContentType.GENERAL),
        industry=request.industry,
        target_audience=request.target_audience,
        tone=request.tone,
    )
    
    return ResearchContext(
        query=request.query,
        keywords=request.keywords,
        goal=goal_map.get(request.goal or "factual", ResearchGoal.FACTUAL),
        depth=depth_map.get(request.depth or "standard", ResearchDepth.STANDARD),
        provider_preference=provider_map.get(request.provider or "auto", ProviderPreference.AUTO),
        personalization=personalization,
        max_sources=request.max_sources,
        recency=request.recency,
        include_domains=request.include_domains,
        exclude_domains=request.exclude_domains,
        advanced_mode=request.advanced_mode,
        exa_category=request.exa_category,
        exa_search_type=request.exa_search_type,
        tavily_topic=request.tavily_topic,
        tavily_search_depth=request.tavily_search_depth,
        tavily_include_answer=request.tavily_include_answer,
        tavily_time_range=request.tavily_time_range,
    )


def map_purpose_to_goal(purpose: str) -> ResearchGoal:
    """Map intent purpose to research goal."""
    mapping = {
        "learn": ResearchGoal.EDUCATIONAL,
        "create_content": ResearchGoal.FACTUAL,
        "make_decision": ResearchGoal.FACTUAL,
        "compare": ResearchGoal.COMPETITIVE,
        "solve_problem": ResearchGoal.EDUCATIONAL,
        "find_data": ResearchGoal.FACTUAL,
        "explore_trends": ResearchGoal.TRENDING,
        "validate": ResearchGoal.FACTUAL,
        "generate_ideas": ResearchGoal.INSPIRATIONAL,
    }
    return mapping.get(purpose, ResearchGoal.FACTUAL)


def map_depth_to_engine_depth(depth: str) -> ResearchDepth:
    """Map intent depth to research engine depth."""
    mapping = {
        "overview": ResearchDepth.QUICK,
        "detailed": ResearchDepth.STANDARD,
        "expert": ResearchDepth.COMPREHENSIVE,
    }
    return mapping.get(depth, ResearchDepth.STANDARD)


def map_provider_to_preference(provider: str) -> ProviderPreference:
    """Map query provider to engine preference."""
    mapping = {
        "exa": ProviderPreference.EXA,
        "tavily": ProviderPreference.TAVILY,
        "google": ProviderPreference.GOOGLE,
    }
    return mapping.get(provider, ProviderPreference.AUTO)


def merge_trends_data(analyzed_result: Any, trends_data: Dict[str, Any]) -> Any:
    """
    Merge Google Trends data into analyzed result trends.
    
    Enhances AI-extracted trends with Google Trends data.
    """
    from services.research.intent.intent_aware_analyzer import IntentDrivenResearchResult
    
    if not analyzed_result.trends:
        return analyzed_result
    
    # Enhance each trend with Google Trends data
    enhanced_trends = []
    for trend in analyzed_result.trends:
        # Create enhanced trend with Google Trends data
        trend_dict = trend.dict() if hasattr(trend, 'dict') else trend
        trend_dict["google_trends_data"] = trends_data
        
        # Add interest score if available
        if trends_data.get("interest_over_time"):
            # Calculate average interest score
            interest_values = []
            for point in trends_data["interest_over_time"]:
                for key, value in point.items():
                    if key not in ["date", "isPartial"] and isinstance(value, (int, float)):
                        interest_values.append(value)
            if interest_values:
                trend_dict["interest_score"] = sum(interest_values) / len(interest_values)
        
        # Add related topics/queries
        if trends_data.get("related_topics"):
            top_topics = [t.get("topic_title", "") for t in trends_data["related_topics"].get("top", [])[:5]]
            rising_topics = [t.get("topic_title", "") for t in trends_data["related_topics"].get("rising", [])[:5]]
            trend_dict["related_topics"] = {"top": top_topics, "rising": rising_topics}
        
        if trends_data.get("related_queries"):
            top_queries = [q.get("query", "") for q in trends_data["related_queries"].get("top", [])[:5]]
            rising_queries = [q.get("query", "") for q in trends_data["related_queries"].get("rising", [])[:5]]
            trend_dict["related_queries"] = {"top": top_queries, "rising": rising_queries}
        
        # Add regional interest
        if trends_data.get("interest_by_region"):
            regional_interest = {}
            for region in trends_data["interest_by_region"][:10]:  # Top 10 regions
                region_name = region.get("geoName", "")
                if region_name:
                    # Get interest value (first numeric column)
                    for key, value in region.items():
                        if key != "geoName" and isinstance(value, (int, float)):
                            regional_interest[region_name] = value
                            break
            trend_dict["regional_interest"] = regional_interest
        
        enhanced_trends.append(TrendAnalysis(**trend_dict))
    
    # Update analyzed result with enhanced trends
    analyzed_result.trends = enhanced_trends
    return analyzed_result


async def _fetch_research_trends(
    keywords: list,
    timeframe: str,
    geo: str,
    user_id: str,
    provider=None,
) -> Dict[str, Any]:
    """Fetch and synthesize Tavily trends for the research intent endpoint."""
    provider = provider or TavilyTrendProvider()
    items = await provider.fetch_trends(
        TrendPlatform.WEB, industry="", keywords=keywords, user_id=user_id
    )
    report = await synthesize_trends(
        items, TrendPlatform.WEB, user_id=user_id, focus="trend analysis"
    )
    return {
        "summary": report.get("summary", ""),
        "trends": report.get("trends", []),
        "items": [item.to_dict() for item in items],
        "keywords": keywords,
        "timeframe": timeframe,
        "geo": geo,
        "platform": TrendPlatform.WEB.value,
    }
