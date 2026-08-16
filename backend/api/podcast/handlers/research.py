"""
Podcast Research Handlers

Research endpoints using Exa provider and LLM summarization.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from types import SimpleNamespace
import json
import re
import time
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from api.story_writer.utils.auth import require_authenticated_user
from services.database import get_db
from services.blog_writer.research.exa_provider import ExaResearchProvider
from services.llm_providers.main_text_generation import llm_text_gen
from services.podcast_bible_service import PodcastBibleService
from services.database import get_db
from services.subscription import PricingService
from models.subscription_models import APIProvider
from loguru import logger
from ..cost_estimator import estimate_podcast_cost
from ..models import (
    PodcastExaResearchRequest,
    PodcastExaResearchResponse,
    PodcastExaSource,
    PodcastExaConfig,
    PodcastResearchInsight,
    PodcastResearchOutput,
    PodcastCostEst,
    PodcastCostBreakdownItem,
)

router = APIRouter()


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)


def _get_price_from_catalog(
    pricing_service: PricingService,
    provider: APIProvider,
    model_name: str,
    key: str,
    fallback: float = 0.0,
) -> float:
    try:
        pricing = pricing_service.get_pricing_for_provider_model(provider, model_name) or {}
        value = pricing.get(key)
        return float(value or fallback)
    except Exception:
        return fallback


def _build_research_cost_estimate(
    request: PodcastExaResearchRequest,
    raw_content: str,
    sources_count: int,
    provider_result: Dict[str, Any],
    user_id: str = "default",
) -> PodcastCostEst:
    # Fallback defaults mirror current catalog defaults.
    exa_per_request = 0.005
    gemini_in_token = 0.00000015
    gemini_out_token = 0.0000006

    try:
        from services.database import get_session_for_user
        db = get_session_for_user(user_id)
        if db:
            try:
                pricing_service = PricingService(db)
                exa_per_request = _get_price_from_catalog(
                    pricing_service, APIProvider.EXA, "exa-search", "cost_per_request", exa_per_request
                )
                gemini_pricing = pricing_service.get_pricing_for_provider_model(APIProvider.GEMINI, "gemini-2.5-flash") or {}
                gemini_in_token = float(gemini_pricing.get("cost_per_input_token") or gemini_in_token)
                gemini_out_token = float(gemini_pricing.get("cost_per_output_token") or gemini_out_token)
            finally:
                db.close()
    except Exception as pricing_err:
        logger.warning(f"[Podcast Research] Failed loading pricing catalog; using defaults: {pricing_err}")

    query_count = max(1, len(request.queries or []))
    source_count = max(1, sources_count)

    analyze_tokens = _estimate_tokens(request.topic) + sum(_estimate_tokens(q) for q in request.queries or [])
    gather_search_calls = max(1, query_count)
    gather_cost = gather_search_calls * exa_per_request

    write_input_tokens = _estimate_tokens(raw_content) + _estimate_tokens(request.topic) + (query_count * 40)
    write_output_tokens = max(500, int(write_input_tokens * 0.22))
    write_cost = (write_input_tokens * gemini_in_token) + (write_output_tokens * gemini_out_token)

    # "Produce" is shaping the final API payload and mapped artifacts.
    produce_tokens = max(120, source_count * 30)
    produce_cost = (produce_tokens * gemini_in_token) + (produce_tokens * 0.5 * gemini_out_token)

    analyze_cost = analyze_tokens * gemini_in_token

    provider_total = 0.0
    if isinstance(provider_result, dict):
        provider_total = float((provider_result.get("cost") or {}).get("total") or 0.0)

    # Prefer transparent estimate built from catalog + usage. If provider reports a higher measured value, keep it.
    estimated_total = analyze_cost + gather_cost + write_cost + produce_cost
    scale = (provider_total / estimated_total) if estimated_total > 0 and provider_total > estimated_total else 1.0

    breakdown = [
        PodcastCostBreakdownItem(phase="Analyze", cost=round(analyze_cost * scale, 6)),
        PodcastCostBreakdownItem(phase="Gather", cost=round(gather_cost * scale, 6)),
        PodcastCostBreakdownItem(phase="Write", cost=round(write_cost * scale, 6)),
        PodcastCostBreakdownItem(phase="Produce", cost=round(produce_cost * scale, 6)),
    ]
    total = round(sum(item.cost for item in breakdown), 6)

    return PodcastCostEst(
        total=total,
        breakdown=breakdown,
        currency="USD",
        last_updated=datetime.now(timezone.utc),
    )


@router.post("/research/exa", response_model=PodcastExaResearchResponse)
async def podcast_research_exa(
    request: PodcastExaResearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Run podcast research via Exa and then use LLM to extract deep insights.
    Uses Podcast Bible and Analysis context for hyper-personalization.
    """
    start_time = time.time()
    user_id = require_authenticated_user(current_user)
    
    # Log only essential info, not full request data
    logger.warning(f"[Podcast Research] ===== RESEARCH_START =====")
    logger.warning(f"[Podcast Research] user={user_id}, topic='{request.topic[:50]}...', queries={len(request.queries) if request.queries else 0}")


    queries = [q.strip() for q in request.queries if q and q.strip()]
    if not queries:
        raise HTTPException(status_code=400, detail="At least one query is required for research.")
    
    logger.warning(f"[Podcast Research] EXACT queries being sent to Exa: {queries}")

    exa_cfg = request.exa_config or PodcastExaConfig()
    cfg = SimpleNamespace(
        exa_search_type=exa_cfg.exa_search_type or "auto",
        exa_category=exa_cfg.exa_category,
        exa_include_domains=exa_cfg.exa_include_domains or [],
        exa_exclude_domains=exa_cfg.exa_exclude_domains or [],
        max_sources=exa_cfg.max_sources or 8,
        source_types=[],
    )

    provider = ExaResearchProvider()
    logger.warning(f"[Podcast Research] Provider initialized, starting Exa search...")
    
    # --- Context Building ---
    bible_service = PodcastBibleService()
    bible_context = ""
    bible_obj = None
    try:
        bible_obj, bible_context = bible_service.get_or_build_bible(user_id, request.bible, "temp_research")
    except Exception as exc:
        logger.warning(f"[Podcast Research] Failed to build bible: {exc}")

    analysis_context = ""
    if request.analysis:
        analysis_context = f"""
PODCAST ANALYSIS CONTEXT:
========================
Topic: {request.topic}
Target Audience: {request.analysis.get('audience', 'General')}
Content Type: {request.analysis.get('content_type', 'Informative')}
Top Keywords: {', '.join(request.analysis.get('top_keywords', []))}

Episode Hook (Intro): {request.analysis.get('episode_hook', 'N/A')}
Key Takeaways: {', '.join(request.analysis.get('key_takeaways', [])) or 'N/A'}
Guest Talking Points: {', '.join(request.analysis.get('guest_talking_points', [])) or 'N/A'}
Listener CTA: {request.analysis.get('listener_cta', 'N/A')}
"""

    # Exa search params (from the resolved bible — persona-seeded or explicit).
    industry = bible_obj.brand.industry if bible_obj else ""
    target_audience = ""
    if bible_obj:
        interests = ", ".join(bible_obj.audience.interests or [])
        target_audience = f"Expertise: {bible_obj.audience.expertise_level}. Interests: {interests}."

    # Preflight subscription check for Exa
    try:
        pricing_service = PricingService(db)
        can_proceed, message, usage_info = pricing_service.check_usage_limits(
            user_id=user_id,
            provider=APIProvider.EXA,
            tokens_requested=0,
            actual_provider_name="exa",
        )
        if not can_proceed:
            raise HTTPException(status_code=429, detail={
                'error': message, 'message': message,
                'provider': 'exa', 'usage_info': usage_info or {}
            })
        logger.info(f"[Podcast Research] Preflight check passed for user {user_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[Podcast Research] Preflight check failed: {e}")

    try:
        # 1. RUN EXA SEARCH
        logger.warning(f"[Podcast Research] Calling Exa search with topic: {request.topic[:100]}...")
        result = await provider.search(
            prompt=request.topic,
            topic=request.topic,
            industry=industry,
            target_audience=target_audience,
            config=cfg,
            user_id=user_id,
        )
        logger.warning(f"[Podcast Research] Exa search completed, got {len(result.get('sources', []))} sources")
    except Exception as exc:
        logger.error(f"[Podcast Exa Research] Search failed for user {user_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Exa research failed: {exc}")

    # 2. EXTRACT INSIGHTS VIA LLM
    raw_content = result.get("content", "")
    sources = result.get("sources", [])
    
    summary = ""
    key_insights = []
    expert_quotes = []
    listener_cta_suggestions = []
    mapped_angles = []
    
    if raw_content and sources:
        logger.warning(f"[Podcast Research] Extracting insights from {len(sources)} sources for user {user_id}")
        
        # Build list of research queries used for this search
        queries_used = ", ".join([f"Query {i+1}: {q}" for i, q in enumerate(queries)]) if queries else "No specific queries"
        
        prompt = f"""
You are an expert research analyst and content strategist for a high-end podcast production team. 
Your task is to analyze the research data and extract deep, podcast-ready insights.

PODCAST CONTEXT:
================
Main Topic: {request.topic}

RESEARCH QUERIES USED:
=====================
{queries_used}

PODCAST BIBLE & BRAND CONTEXT:
==============================
{bible_context}

PODCAST ANALYSIS (from AI Analysis phase):
==========================================
{analysis_context}

RESEARCH DATA (from {len(sources)} sources):
============================================
{raw_content}

YOUR TASK:
==========
As a podcast research expert, analyze this data and create content that will:
1. Engage the specific target audience identified above
2. Support the episode hook and key takeaways already planned
3. Provide talking points that complement the guest's expertise
4. Include a compelling call-to-action for listeners

REQUIRED OUTPUT (JSON):
======================
{{
  "summary": "2-3 paragraph comprehensive summary in Markdown. Start with a hook that matches the episode intro.",
  "key_insights": [
    {{
      "title": "Insight title",
      "content": "3-4 sentences with specific facts, quotes, or data for podcast host.",
      "source_indices": [1, 2],
      "podcast_talking_points": ["Point host can expand on", "Counter-point"]
    }}
  ],
  "expert_quotes": [
    {{
      "quote": "Direct quote from source text",
      "source_index": 1,
      "context": "Why this quote matters for the podcast"
    }}
  ],
  "listener_cta_suggestions": ["Action listener can take", "Resource to share", "Next episode preview"],
  "mapped_angles": [
    {{
      "title": "Content angle title",
      "why": "Why compelling for audience",
      "mapped_fact_ids": [1, 2]
    }}
  ]
}}

IMPORTANT: You must include ALL fields above with valid data. expert_quotes, listener_cta_suggestions, and mapped_angles must have content - do NOT leave them empty!

QUALITY STANDARDS:
=================
- Include at least 2 expert_quotes with source_index
- Include at least 2 listener_cta_suggestions 
- Include at least 2 mapped_angles
- Include specific data points, percentages, statistics
- Write in conversational tone
"""
        try:
            logger.warning(f"[Podcast Research] Calling LLM with json_struct...")
            llm_response = llm_text_gen(
                prompt=prompt,
                user_id=user_id,
                json_struct=PodcastResearchOutput.model_json_schema(),
                preferred_provider=None,
                flow_type="premium_tool",
            )
            logger.warning(f"[Podcast Research] LLM response received, length: {len(llm_response) if llm_response else 0}")
            
            # Normalize response - handle both string and dict responses
            data = None
            if isinstance(llm_response, str):
                try:
                    # Try to fix common JSON issues
                    fixed_response = llm_response.strip()
                    # Remove markdown code blocks if present
                    if fixed_response.startswith("```"):
                        fixed_response = fixed_response.split("```")[1]
                        if fixed_response.startswith("json"):
                            fixed_response = fixed_response[4:]
                    fixed_response = fixed_response.strip()
                    data = json.loads(fixed_response)
                except json.JSONDecodeError as json_err:
                    logger.warning(f"[Podcast Research] Failed to parse JSON: {json_err}. Response preview: {llm_response[:500]}...")
                    # Try to extract JSON from response using regex
                    json_match = re.search(r'\{.*\}', llm_response, re.DOTALL)
                    if json_match:
                        try:
                            data = json.loads(json_match.group())
                            logger.warning("[Podcast Research] Successfully extracted JSON via regex")
                        except:
                            pass
            else:
                data = llm_response
            
            if data:
                try:
                    summary = data.get("summary", "")
                    key_insights = [PodcastResearchInsight(**insight) for insight in data.get("key_insights", [])]
                    expert_quotes = data.get("expert_quotes", [])
                    listener_cta_suggestions = data.get("listener_cta_suggestions", [])
                    mapped_angles = data.get("mapped_angles", [])
                except Exception as insight_err:
                    logger.warning(f"[Podcast Research] Failed to parse insights: {insight_err}. Data keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")
                    summary = data.get("summary", "") if isinstance(data, dict) else ""
                    key_insights = []
                    expert_quotes = data.get("expert_quotes", []) if isinstance(data, dict) else []
                    listener_cta_suggestions = data.get("listener_cta_suggestions", []) if isinstance(data, dict) else []
                    mapped_angles = data.get("mapped_angles", []) if isinstance(data, dict) else []
            else:
                summary = ""
                key_insights = []
                expert_quotes = []
                listener_cta_suggestions = []
                mapped_angles = []
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"[Podcast Research] LLM Insight extraction failed: {exc}")
            raise HTTPException(status_code=500, detail=f"Research insight extraction failed: {exc}")
            
    # Fallback: if summary is still empty (e.g. LLM returned empty string), use raw content first paragraph or basic text
    if not summary:
        if raw_content:
            summary = raw_content[:2000] # Use first 2000 chars of raw content as summary
        else:
            summary = f"Research completed for '{request.topic}'. Found {len(sources)} sources."

    # 3. TRACK USAGE
    try:
        cost_total = 0.0
        if isinstance(result, dict):
            cost_total = result.get("cost", {}).get("total", 0.005) if result.get("cost") else 0.005
        provider.track_exa_usage(user_id, cost_total)
    except Exception as track_err:
        logger.warning(f"[Podcast Exa Research] Failed to track usage: {track_err}")

    sources_payload = []
    seen_urls = set()
    for src in sources:
        url = src.get("url", "")
        # Skip duplicates
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)
        
        try:
            sources_payload.append(PodcastExaSource(**src))
        except Exception:
            sources_payload.append(PodcastExaSource(**{
                "title": src.get("title", ""),
                "url": url,
                "excerpt": src.get("excerpt") or (src.get("highlights")[0] if src.get("highlights") else "") or src.get("summary", ""),
                "published_at": src.get("published_at"),
                "publishedDate": src.get("publishedDate"),
                "highlights": src.get("highlights"),
                "summary": src.get("summary"),
                "source_type": src.get("source_type"),
                "index": src.get("index"),
                "image": src.get("image"),
                "author": src.get("author"),
                "text": src.get("text"),
                "credibility_score": src.get("credibility_score"),
            }))

    duration_minutes = 10
    speakers = 1
    if request.analysis:
        duration_minutes = int(request.analysis.get("duration", 10) or 10)
        speakers = int(request.analysis.get("speakers", 1) or 1)

    estimate = estimate_podcast_cost(
        db=db,
        duration_minutes=duration_minutes,
        speakers=speakers,
        query_count=len(queries),
        include_avatar_phase=True,
    )

    duration_ms = int((time.time() - start_time) * 1000)
    logger.warning(f"[Podcast Research] ===== RESEARCH_END (took {duration_ms}ms) =====")
    logger.warning(f"[Podcast Research] sources={len(sources_payload)}, insights={len(key_insights)}, summary_len={len(summary)}")

    return PodcastExaResearchResponse(
        sources=sources_payload,
        search_queries=result.get("search_queries", queries) if isinstance(result, dict) else queries,
        summary=summary,
        key_insights=key_insights,
        cost_est=_build_research_cost_estimate(
            request=request,
            raw_content=raw_content,
            sources_count=len(sources_payload),
            provider_result=result if isinstance(result, dict) else {},
            user_id=user_id,
        ),
        search_type=result.get("search_type") if isinstance(result, dict) else None,
        provider=result.get("provider", "exa") if isinstance(result, dict) else "exa",
        content=raw_content,
        mapped_angles=mapped_angles,
        expert_quotes=expert_quotes,
        listener_cta_suggestions=listener_cta_suggestions,
        estimate=estimate,
    )
