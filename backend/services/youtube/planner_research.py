"""Exa research helper for YouTube video planning."""

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from services.youtube.planner_research_compact import (
    PROMPT_SOURCE_LIMIT,
    build_compact_research_prompt_block,
    format_youtube_research_sources_for_ui,
    select_top_youtube_research_sources,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_research")


async def perform_exa_research(
    user_idea: str,
    video_type: Optional[str],
    target_audience: str,
    user_id: str,
    language: Optional[str] = None,
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Perform Exa research directly using ExaResearchProvider (common module).
    Uses the same pattern as podcast research with proper subscription checks.

        Returns:
        Tuple of (compact research prompt block, research_sources_list with URLs).
        Exa queries stay English-only (no content-language label). `language` is
        logged for debugging; pitch/expand still use it for LLM output elsewhere.
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

        # Build research query (English-only: do not append content-language labels)
        query_parts = [user_idea]
        if video_type:
            query_parts.append(f"{video_type} video")
        if target_audience and target_audience != "General YouTube audience":
            query_parts.append(target_audience)

        research_query = " ".join(query_parts)
        logger.info(
            "[YouTubePlanner] Exa research query idea_len={} video_type={} requested_language={} english_only=True",
            len((user_idea or "").strip()),
            video_type or "",
            language or "",
        )

        cfg = SimpleNamespace(
            exa_search_type="neural",
            exa_category="web",
            exa_include_domains=[],
            exa_exclude_domains=[],
            max_sources=10,
            source_types=[],
            exa_highlights=True,
            exa_highlights_num_sentences=2,
            exa_highlights_per_url=2,
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
        try:
            formatted_sources = format_youtube_research_sources_for_ui(sources)
            selected = select_top_youtube_research_sources(
                sources,
                user_idea,
                limit=PROMPT_SOURCE_LIMIT,
            )
            research_context = build_compact_research_prompt_block(selected)
        except Exception:
            logger.exception(
                "[YouTubePlanner] Compact research block failed; continuing without prompt facts"
            )
            formatted_sources = format_youtube_research_sources_for_ui(sources)
            research_context = ""

        logger.info(
            "[YouTubePlanner] Exa research completed source_count={} compact_block_len={} highlights={}",
            len(formatted_sources),
            len(research_context),
            bool(getattr(cfg, "exa_highlights", False)),
        )
        return research_context, formatted_sources

    except HTTPException:
        # Re-raise HTTPException (subscription limits, etc.)
        raise
    except Exception as e:
        logger.error(f"[YouTubePlanner] Research error: {e}", exc_info=True)
        # Non-critical failure - return empty research
        return "", []
