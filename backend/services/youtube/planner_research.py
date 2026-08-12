"""Exa research helper for YouTube video planning."""

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_research")


async def perform_exa_research(
    user_idea: str,
    video_type: Optional[str],
    target_audience: str,
    user_id: str,
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Perform Exa research directly using ExaResearchProvider (common module).
    Uses the same pattern as podcast research with proper subscription checks.

    Returns:
        Tuple of (research_context_string, research_sources_list)
    """
    try:
        # Pre-flight validation for Exa search only (not full blog writer workflow)
        # We only need to validate Exa API calls, not LLM operations
        from services.database import get_session_for_user
        from services.subscription import PricingService
        from models.subscription_models import APIProvider

        db = get_session_for_user(user_id)
        if not db:
            logger.warning(
                f"[YouTubePlanner] Unable to open DB session for user {user_id} during Exa preflight"
            )
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable for research validation",
            )
        try:
            pricing_service = PricingService(db)
            # Only validate Exa API call, not the full research workflow
            operations_to_validate = [
                {
                    'provider': APIProvider.EXA,
                    'tokens_requested': 0,
                    'actual_provider_name': 'exa',
                    'operation_type': 'exa_neural_search'
                }
            ]

            can_proceed, message, error_details = pricing_service.check_comprehensive_limits(
                user_id=user_id,
                operations=operations_to_validate
            )

            if not can_proceed:
                usage_info = error_details.get('usage_info', {}) if error_details else {}
                logger.warning(
                    f"[YouTubePlanner] Exa search blocked for user {user_id}: {message}"
                )
                raise HTTPException(
                    status_code=429,
                    detail={
                        'error': message,
                        'message': message,
                        'provider': 'exa',
                        'usage_info': usage_info if usage_info else error_details
                    }
                )

            logger.info(f"[YouTubePlanner] Exa search pre-flight validation passed for user {user_id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"[YouTubePlanner] Exa search pre-flight validation failed: {e}")
            raise
        finally:
            db.close()

        # Use ExaResearchProvider directly (common module, same as podcast)
        from services.blog_writer.research.exa_provider import ExaResearchProvider
        from types import SimpleNamespace

        # Build research query
        query_parts = [user_idea]
        if video_type:
            query_parts.append(f"{video_type} video")
        if target_audience and target_audience != "General YouTube audience":
            query_parts.append(target_audience)

        research_query = " ".join(query_parts)

        # Configure Exa research (same pattern as podcast)
        cfg = SimpleNamespace(
            exa_search_type="neural",
            exa_category="web",  # Focus on web content for YouTube
            exa_include_domains=[],
            exa_exclude_domains=[],
            max_sources=10,  # Limit sources for cost efficiency
            source_types=[],
        )

        # Perform research
        provider = ExaResearchProvider()
        result = await provider.search(
            prompt=research_query,
            topic=user_idea,
            industry="",
            target_audience=target_audience,
            config=cfg,
            user_id=user_id,
        )

        # Track usage
        cost_total = 0.0
        if isinstance(result, dict):
            cost_total = result.get("cost", {}).get("total", 0.005) if result.get("cost") else 0.005
        provider.track_exa_usage(user_id, cost_total)

        # Extract sources and content
        sources = result.get("sources", []) or []
        research_content = result.get("content", "")

        # Build research context for prompt
        research_context = ""
        if research_content and sources:
            # Limit content to 2000 chars to avoid token bloat
            limited_content = research_content[:2000]
            research_context = f"""
**Research & Current Information:**
Based on current web research, here are relevant insights and trends:

{limited_content}

**Key Research Sources ({len(sources)} sources):**
"""
            # Add top 5 sources for context
            for idx, source in enumerate(sources[:5], 1):
                title = source.get("title", "Untitled") or "Untitled"
                url = source.get("url", "") or ""
                excerpt = (source.get("excerpt", "") or "")[:200]
                if not excerpt:
                    excerpt = (source.get("summary", "") or "")[:200]
                research_context += f"\n{idx}. {title}\n   {excerpt}\n   Source: {url}\n"

            research_context += "\n**Use this research to:**\n"
            research_context += "- Identify current trends and popular angles\n"
            research_context += "- Enhance SEO keywords with real search data\n"
            research_context += "- Ensure content is relevant and up-to-date\n"
            research_context += "- Reference credible sources in the plan\n"
            research_context += "- Identify gaps or unique angles not covered by competitors\n"

        # Format sources for response
        formatted_sources = []
        for source in sources:
            formatted_sources.append({
                "title": source.get("title", "") or "",
                "url": source.get("url", "") or "",
                "excerpt": (source.get("excerpt", "") or "")[:300],
                "published_at": source.get("published_at"),
                "credibility_score": source.get("credibility_score", 0.85) or 0.85,
            })

        logger.info(f"[YouTubePlanner] Exa research completed: {len(formatted_sources)} sources found")
        return research_context, formatted_sources

    except HTTPException:
        # Re-raise HTTPException (subscription limits, etc.)
        raise
    except Exception as e:
        logger.error(f"[YouTubePlanner] Research error: {e}", exc_info=True)
        # Non-critical failure - return empty research
        return "", []
