"""
Podcast Analysis Handlers

Analysis endpoint for podcast ideas.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import uuid
from sqlalchemy.orm import Session
from pydantic import BaseModel

from services.database import get_db
from middleware.auth_middleware import get_current_user
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_text_generation import llm_text_gen
from services.llm_providers.main_image_generation import generate_image
from services.podcast_bible_service import PodcastBibleService
from utils.asset_tracker import save_asset_to_library
from loguru import logger
import os
from ..constants import get_podcast_media_dir
from ..prompts import get_enhance_topic_prompt, format_website_context
from ..models import (
    PodcastAnalyzeRequest, 
    PodcastAnalyzeResponse,
    PodcastEnhanceIdeaRequest,
    PodcastEnhanceIdeaResponse,
    ExtractUrlRequest,
    ExtractUrlResponse,
    WebsiteAnalysisRequest,
    WebsiteAnalysisResponse,
    PodcastPreEstimateRequest,
    PodcastPreEstimateResponse,
)
from ..cost_estimator import estimate_podcast_cost

# Check if running in podcast-only demo mode
def _is_podcast_only_mode() -> bool:
    """Check if podcast-only demo mode is enabled."""
    return os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() == "podcast"

router = APIRouter()


@router.post("/pre-estimate", response_model=PodcastPreEstimateResponse)
async def pre_estimate_cost(
    request: PodcastPreEstimateRequest,
    db: Session = Depends(get_db),
):
    """
    Lightweight endpoint to estimate podcast creation cost before analysis.
    
    Takes user configuration (duration, speakers, query_count, podcast_mode) and returns
    a cost estimate WITHOUT running full analysis.
    
    Optional model overrides can be specified to estimate with different models.
    """
    try:
        include_avatar_phase = request.podcast_mode != "audio_only"
        
        estimate = estimate_podcast_cost(
            db=db,
            duration_minutes=request.duration,
            speakers=request.speakers,
            query_count=request.query_count,
            include_avatar_phase=include_avatar_phase,
            # Model overrides if provided
            gemini_model=request.gemini_model or "gemini-2.5-flash",
            audio_tts_model=request.audio_tts_model or "minimax/speech-02-hd",
            voice_clone_engine=request.voice_clone_engine or "qwen3",
            image_model=request.image_model or "qwen-image",
            video_model=request.video_model or "wan-2.5",
        )
        
        # Debug: get pricing row count and providers
        from models.subscription_models import APIProviderPricing
        pricing_count = db.query(APIProviderPricing).count()
        providers = db.query(APIProviderPricing.provider).distinct().all()
        provider_list = sorted([p[0].value for p in providers]) if providers else []
        
        debug_info = {
            "pricing_rows": pricing_count,
            "providers": provider_list,
        }
        
        # Log pricing debug info at warning level
        logger.warning(f"[PRE-ESTIMATE] Pricing debug: rows={pricing_count}, providers={provider_list}")
        logger.warning(f"[PRE-ESTIMATE] Models: llm={request.gemini_model}, tts={request.audio_tts_model}, video={request.video_model}")
        
        if estimate is None:
            return PodcastPreEstimateResponse(
                estimate=None,
                error="Pricing data unavailable. Please try again later.",
                pricing_available=False,
                debug=debug_info,
            )
        
        return PodcastPreEstimateResponse(
            estimate=estimate, 
            error=None,
            pricing_available=True,
            debug=debug_info,
        )
        
    except Exception as e:
        logger.error(f"Pre-estimate error: {e}")
        return PodcastPreEstimateResponse(
            estimate=None,
            error=str(e),
        )


@router.post("/idea/enhance", response_model=PodcastEnhanceIdeaResponse)
async def enhance_podcast_idea(
    request: PodcastEnhanceIdeaRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Take raw keywords/topic and use AI to craft a presentable, detailed podcast idea.
    Uses the user's Podcast Bible for hyper-personalization if available.
    """
    user_id = require_authenticated_user(current_user)
    
    # Serialize Bible context if provided or generate from onboarding
    # In podcast-only mode, skip bible generation since onboarding is disabled
    bible_context = ""
    if not _is_podcast_only_mode():
        logger.warning(f"[Podcast Enhance] Podcast mode=full — attempting Bible generation for user {user_id}")
        try:
            bible_service = PodcastBibleService()
            if request.bible:
                from models.podcast_bible_models import PodcastBible
                bible_data = PodcastBible(**request.bible)
                bible_context = bible_service.serialize_bible(bible_data)
            else:
                # Generate from onboarding data directly
                bible_obj = bible_service.generate_bible(user_id, "temp_enhance")
                bible_context = bible_service.serialize_bible(bible_obj)
        except Exception as exc:
            logger.warning(f"[Podcast Enhance] Failed to parse or generate bible context: {exc}")
    else:
        # In podcast mode, use the provided bible directly if available
        logger.warning(f"[Podcast Enhance] Podcast mode=podcast_only — skipping Bible generation for user {user_id}")
        if request.bible:
            try:
                from models.podcast_bible_models import PodcastBible
                bible_data = PodcastBible(**request.bible)
                bible_service = PodcastBibleService()
                bible_context = bible_service.serialize_bible(bible_data)
            except Exception as exc:
                logger.debug(f"[Podcast Enhance] Bible parsing skipped in podcast mode: {exc}")

    # Log what's being used for context
    context_used = []
    if bible_context:
        context_used.append("Podcast Bible")
    if request.website_data:
        context_used.append("Website Extraction")
    if request.topic_context:
        category = request.topic_context.get("category", "unknown")
        context_used.append(f"Category Research ({category})")
    
    logger.warning(f"[Podcast Enhance] Generating with context: {', '.join(context_used) if context_used else 'basic idea only'}")

    # Use new context builder for prompt generation
    from services.podcast_context_builder import context_builder
    context_result = context_builder.build_enhance_context(
        idea=request.idea,
        bible_context=bible_context,
        website_data=request.website_data,
        topic_context=request.topic_context,
    )
    prompt = context_result["prompt"]

    try:
        raw = llm_text_gen(
            prompt=prompt,
            user_id=user_id,
            json_struct=None,
            preferred_provider=None,
            flow_type="premium_tool",
        )
        
        # Normalize response
        if isinstance(raw, str):
            data = json.loads(raw)
        else:
            data = raw
            
        # Extract enhanced ideas and rationales with fallbacks
        enhanced_ideas = data.get("enhanced_ideas", [])
        rationales = data.get("rationales", [])
        
        # Handle case where LLM returns objects instead of strings
        normalized_ideas = []
        for idea in enhanced_ideas:
            if isinstance(idea, dict):
                # Extract title and description from object
                title = idea.get("title", "")
                description = idea.get("description", "") or idea.get("content", "")
                normalized_ideas.append(f"{title}: {description}" if description else title)
            elif isinstance(idea, str):
                normalized_ideas.append(idea)
        
        enhanced_ideas = normalized_ideas
        
        # Ensure we have exactly 3 ideas, fallback to original if needed
        if not isinstance(enhanced_ideas, list) or len(enhanced_ideas) != 3:
            # Fallback: create 3 variations of the original idea
            base_idea = request.idea
            enhanced_ideas = [
                f"Expert insights on {base_idea}: A deep dive into industry trends and best practices.",
                f"The human side of {base_idea}: Personal stories and real-world experiences that resonate.",
                f"Modern perspectives on {base_idea}: Current trends and forward-thinking approaches."
            ]
            rationales = [
                "Professional approach focusing on expertise and authority",
                "Storytelling approach emphasizing human connection",
                "Contemporary approach highlighting current relevance"
            ]
        
        # Ensure rationales match the number of ideas
        if not isinstance(rationales, list) or len(rationales) != 3:
            rationales = [
                "Professional angle with expert insights",
                "Storytelling angle with human interest", 
                "Trendy angle with contemporary relevance"
            ]
            
        return PodcastEnhanceIdeaResponse(
            enhanced_ideas=enhanced_ideas[:3],  # Ensure exactly 3
            rationales=rationales[:3]  # Ensure exactly 3
        )
    except HTTPException:
        # Re-raise HTTPExceptions (e.g., 429 subscription limit) - preserve error details
        raise
    except Exception as exc:
        logger.error(f"[Podcast Enhance] Failed for user {user_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Enhance failed: {exc}")


@router.post("/analyze", response_model=PodcastAnalyzeResponse)
async def analyze_podcast_idea(
    request: PodcastAnalyzeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze a podcast idea and return podcast-oriented outlines, keywords, and titles.
    If no avatar_url is provided, it generates one automatically based on the host's look.
    """
    user_id = require_authenticated_user(current_user)

    # Serialize Bible context if provided or generate from onboarding
    bible_context = ""
    bible_obj = None
    try:
        bible_service = PodcastBibleService()
        if request.bible:
            from models.podcast_bible_models import PodcastBible
            bible_data = PodcastBible(**request.bible)
            bible_context = bible_service.serialize_bible(bible_data)
            bible_obj = bible_data
        else:
            # Generate from onboarding data directly
            bible_obj = bible_service.generate_bible(user_id, "temp_analyze")
            bible_context = bible_service.serialize_bible(bible_obj)
            bible_obj = bible_obj
    except Exception as exc:
        logger.warning(f"[Podcast Analyze] Failed to parse or generate bible context: {exc}")

    # --- NEW: Generate Presenter Avatar if missing ---
    final_avatar_url = request.avatar_url
    final_avatar_prompt = None
    
    # Skip avatar generation for audio_only mode
    podcast_mode = getattr(request, 'podcast_mode', None) or 'video_only'
    should_generate_avatar = not final_avatar_url and podcast_mode != 'audio_only'
    
    if should_generate_avatar:
        logger.info(f"[Podcast Analyze] No avatar_url provided, generating one for user {user_id}")
        try:
            # 1. PRE-FLIGHT VALIDATION: Check subscription limits for image generation
            from services.subscription import PricingService
            from services.subscription.preflight_validator import validate_image_generation_operations
            pricing_service = PricingService(db)
            validate_image_generation_operations(
                pricing_service=pricing_service,
                user_id=user_id,
                num_images=1
            )
            
            # 2. Build avatar prompt from Bible host look or fallback
            host_look = bible_obj.host.look if bible_obj and bible_obj.host.look else "A professional podcast host"
            visual_style = bible_obj.visual_style.style_preset if bible_obj else "Realistic Photography"
            
            final_avatar_prompt = f"Professional headshot of a podcast host, {host_look}, {visual_style} style, clean background, soft studio lighting, center-focused, high resolution, sharp focus, professional photography quality, 16:9 aspect ratio."
            
            # 3. Generate the image
            logger.info(f"[Podcast Analyze] Generating avatar with prompt: {final_avatar_prompt}")
            image_result = generate_image(
                prompt=final_avatar_prompt,
                user_id=user_id,
                options={"width": 1024, "height": 1024}
            )
            
            # 4. Save to disk and library
            if image_result and image_result.image_bytes:
                img_id = str(uuid.uuid4())[:8]
                filename = f"presenter_podcast_{user_id}_{img_id}.png"
                images_dir = get_podcast_media_dir("image", user_id, ensure_exists=True)
                avatars_dir = images_dir / "avatars"
                avatars_dir.mkdir(parents=True, exist_ok=True)
                output_path = avatars_dir / filename
                
                with open(output_path, "wb") as f:
                    f.write(image_result.image_bytes)
                
                final_avatar_url = f"/api/podcast/images/avatars/{filename}"
                
                # Save to asset library for reuse
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="image",
                    source_module="podcast_analysis",
                    filename=filename,
                    file_url=final_avatar_url,
                    title=f"Presenter Avatar - {request.idea[:40]}",
                    description=f"AI-generated podcast presenter for: {request.idea}",
                    provider=image_result.provider,
                    model=image_result.model,
                    cost=0.0  # Cost tracked in generate_image
                )
                logger.info(f"[Podcast Analyze] ✅ Generated and saved avatar to {final_avatar_url}")
        except Exception as e:
            logger.error(f"[Podcast Analyze] ❌ Failed to generate avatar: {e}")
            # Non-fatal: continue analysis even if avatar generation fails
    
    # Incorporate user feedback if provided
    feedback_context = ""
    if request.feedback:
        feedback_context = f"""
USER REGENERATION FEEDBACK:
The user was not satisfied with the previous analysis. They provided the following instructions for improvement:
"{request.feedback}"
Please prioritize this feedback and adjust the analysis accordingly.
"""

    personalization_context = ""
    if bible_context:
        personalization_context = f"USER PERSONALIZATION CONTEXT (Podcast Bible):\n{bible_context}\n"

    prompt = f"""
You are an expert podcast producer and research strategist. Given a podcast idea, craft concise podcast-ready assets
that sound like episode plans (not fiction stories).

{personalization_context}
{feedback_context}

Podcast Idea: "{request.idea}"
Duration: ~{request.duration} minutes
Speakers: {request.speakers} (host + optional guest)

TASK:
1. Define the target audience and content type aligned with the Bible's "Audience DNA" and "Brand DNA".
2. Identify 5 high-impact keywords.
3. Propose 2 episode outlines with factual segments.
4. Suggest 3 titles.
5. IMPORTANT: Generate 4-6 specific research queries for Exa. These queries MUST be highly targeted to the episode's topic, the host's expertise level, and the audience's interests as defined in the Bible.
   * Do NOT use generic queries like "latest trends in X".
   * DO use queries that look for case studies, specific data points, expert opinions, or contrasting viewpoints that would make for a deep, insightful podcast conversation.

Return JSON with:
- audience: short target audience description
- content_type: podcast style/format
- top_keywords: 5 podcast-relevant keywords/phrases
- suggested_outlines: 2 items, each with title (<=60 chars) and 4-6 short segments (bullet-friendly, factual)
- title_suggestions: 3 concise episode titles
- episode_hook: one compelling 15-30 second opening hook/angle that grabs attention
- key_takeaways: 3-5 actionable insights listeners will learn
- guest_talking_points: (if guest included) 3-4 suggested questions/angles for guest interview
- listener_cta: one clear call-to-action for listeners
- research_queries: array of {{"query": "string", "rationale": "string"}}
- exa_suggested_config: suggested Exa search options with:
  - exa_search_type: "auto" | "neural" | "keyword"
  - exa_category: one of ["research paper","news","company","github","tweet","personal site","pdf","financial report","linkedin profile"]
  - exa_include_domains: up to 3 reputable domains
  - exa_exclude_domains: up to 3 domains
  - max_sources: 6-10
  - include_statistics: boolean
  - date_range: one of ["last_month","last_3_months","last_year","all_time"]

Requirements:
- Keep language factual, actionable, and suited for spoken audio.
- Avoid narrative fiction tone.
- For research queries: Mix of time-sensitive and evergreen queries:
  - 2-3 queries should focus on latest 2025-2026 developments, trends, and data (use year in query)
  - 2-3 queries should be evergreen/fundamental (concepts, definitions, best practices, proven strategies) - do NOT include years in these
- Today's date is April 2026.
"""

    try:
        raw = llm_text_gen(
            prompt=prompt,
            user_id=user_id,
            json_struct=None,
            preferred_provider=None,
            flow_type="premium_tool",
        )
    except HTTPException:
        # Re-raise HTTPExceptions (e.g., 429 subscription limit) - preserve error details
        raise
    except Exception as exc:
        logger.error(f"[Podcast Analyze] Analysis failed for user {user_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")

    # Normalize response (accept dict or JSON string)
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="LLM returned non-JSON output")
    elif isinstance(raw, dict):
        data = raw
    else:
        raise HTTPException(status_code=500, detail="Unexpected LLM response format")

    audience = data.get("audience") or "Growth-focused professionals"
    content_type = data.get("content_type") or "Interview + insights"
    top_keywords = data.get("top_keywords") or []
    suggested_outlines = data.get("suggested_outlines") or []
    title_suggestions = data.get("title_suggestions") or []
    episode_hook = data.get("episode_hook") or ""
    key_takeaways = data.get("key_takeaways") or []
    guest_talking_points = data.get("guest_talking_points") or []
    listener_cta = data.get("listener_cta") or ""
    research_queries = data.get("research_queries") or []
    exa_suggested_config = data.get("exa_suggested_config") or None
    estimate = estimate_podcast_cost(
        db=db,
        duration_minutes=request.duration,
        speakers=request.speakers,
        query_count=len(research_queries) if isinstance(research_queries, list) else 0,
        include_avatar_phase=podcast_mode != "audio_only",
    )

    return PodcastAnalyzeResponse(
        audience=audience,
        content_type=content_type,
        top_keywords=top_keywords,
        suggested_outlines=suggested_outlines,
        title_suggestions=title_suggestions,
        episode_hook=episode_hook,
        key_takeaways=key_takeaways,
        guest_talking_points=guest_talking_points,
        listener_cta=listener_cta,
        research_queries=research_queries,
        exa_suggested_config=exa_suggested_config,
        bible=bible_obj.model_dump() if bible_obj else None,
        avatar_url=final_avatar_url,
        avatar_prompt=final_avatar_prompt,
        estimate=estimate,
    )


class RegenerateQueriesRequest(BaseModel):
    idea: str
    feedback: str
    existing_analysis: Optional[Dict[str, Any]] = None
    bible: Optional[Dict[str, Any]] = None


class RegenerateQueriesResponse(BaseModel):
    research_queries: List[Dict[str, str]]


@router.post("/regenerate-queries", response_model=RegenerateQueriesResponse)
async def regenerate_research_queries(
    request: RegenerateQueriesRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Regenerate research queries based on user feedback and existing analysis.
    """
    user_id = require_authenticated_user(current_user)
    
    # Build context from existing analysis
    idea = request.idea
    feedback = request.feedback
    
    # Get topic, keywords, audience from existing analysis if provided
    topic = idea
    keywords = ""
    audience = ""
    if request.existing_analysis:
        topic = request.existing_analysis.get("title_suggestions", [idea])[0] if request.existing_analysis.get("title_suggestions") else idea
        keywords = ", ".join(request.existing_analysis.get("top_keywords", [])[:5])
        audience = request.existing_analysis.get("audience", "")
    
    # Serialize Bible context if provided
    bible_context = ""
    if request.bible:
        try:
            bible_service = PodcastBibleService()
            from models.podcast_bible_models import PodcastBible
            bible_data = PodcastBible(**request.bible)
            bible_context = bible_service.serialize_bible(bible_data)
        except Exception as e:
            logger.warning(f"Failed to serialize bible for query regeneration: {e}")
    
    feedback_block = ""
    if feedback:
        feedback_block = f"USER FEEDBACK: {feedback}"

    existing_analysis_block = ""
    if request.existing_analysis:
        existing_analysis_block = f"EXISTING ANALYSIS CONTEXT:\n- Topic: {topic}\n- Keywords: {keywords}\n- Audience: {audience}\n"

    bible_context_block = ""
    if bible_context:
        bible_context_block = f"PODCAST BIBLE CONTEXT:\n{bible_context}\n"

    prompt = f"""
You are a research strategist for podcast content. Given a podcast idea, existing analysis, and user feedback,
generate 7 new research queries that address the user's specific needs.

{feedback_block}

{existing_analysis_block}
{bible_context_block}

Podcast Idea: "{idea}"

TASK:
Generate exactly 7 research queries that:
1. Incorporate the user's feedback direction
2. Build on the existing analysis context
3. Mix of time-sensitive (2025-2026) and evergreen topics
4. Are highly specific to the podcast topic

Return JSON with:
- research_queries: array of {{"query": "string", "rationale": "string"}}

Requirements:
- At least 2-3 queries should focus on latest 2025-2026 developments (include year in query)
- At least 2-3 queries should be evergreen (concepts, definitions, best practices - NO year)
- Queries should be specific and actionable, not generic
"""
    
    try:
        from services.llm_providers.main_text_generation import llm_text_gen
        
        raw = llm_text_gen(
            prompt=prompt,
            user_id=user_id,
            json_struct={"research_queries": [{"query": "string", "rationale": "string"}]},
            preferred_provider=None,
            flow_type="premium_tool",
        )
        
        # Parse response
        if isinstance(raw, dict):
            queries = raw.get("research_queries", [])
        else:
            # Try to parse as JSON
            try:
                parsed = json.loads(raw) if isinstance(raw, str) else raw
                queries = parsed.get("research_queries", []) if isinstance(parsed, dict) else []
            except:
                queries = []
        
        return RegenerateQueriesResponse(research_queries=queries[:7])
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Regenerate Queries] Failed for user {user_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Regenerate queries failed: {exc}")


@router.post("/extract-url", response_model=ExtractUrlResponse)
async def extract_url_content(
    request: ExtractUrlRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Extract content from a URL using Exa's get_contents API.
    
    This allows users to paste a blog post or article URL as their podcast topic,
    and we'll extract the content to use as the podcast idea.
    """
    user_id = require_authenticated_user(current_user)
    
    from exa_py import Exa
    import os
    
    api_key = os.getenv("EXA_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EXA_API_KEY not configured")
    
    exa = Exa(api_key)
    
    logger.warning(f"[ExtractUrl] Extracting content from: {request.url} for user {user_id}")
    
    try:
        result = exa.get_contents(
            urls=[request.url],
            text=True,
            highlights=True,
            summary=True,
            subpages=2,
        )
    except Exception as exa_error:
        logger.error(f"[ExtractUrl] Exa call error: {exa_error}")
        return ExtractUrlResponse(
            success=False,
            url=request.url,
            error=f"Exa API error: {str(exa_error)}"
        )
    
    # Check for errors using the correct attribute (statuses is array of status objects)
    if hasattr(result, 'statuses') and result.statuses:
        for status in result.statuses:
            if status.status == "error":
                logger.error(f"[ExtractUrl] Failed to extract {status.id}: {status.error.tag if hasattr(status.error, 'tag') else 'unknown'}")
                return ExtractUrlResponse(
                    success=False,
                    url=request.url,
                    error=f"Failed to extract content: {status.error.tag if hasattr(status.error, 'tag') else 'unknown error'}"
                )
    
    if not result.results:
        return ExtractUrlResponse(
            success=False,
            url=request.url,
            error="No content found at the provided URL"
        )
    
    # Extract content - safe to access result now
    content = result.results[0]
    
    # Extract all available fields from Exa response
    extracted_text = content.text or ""
    extracted_summary = getattr(content, 'summary', "") or ""
    extracted_title = content.title or ""
    
    # Highlights - extract from content.highlights array if available
    highlights = []
    if hasattr(content, 'highlights') and content.highlights:
        highlights = [h for h in content.highlights if h]
    
    # Additional fields from Exa response
    image = getattr(content, 'image', None)
    favicon = getattr(content, 'favicon', None)
    
    # Subpages - extract with their own content
    subpages = []
    if hasattr(content, 'subpages') and content.subpages:
        for sp in content.subpages:
            subpages.append({
                'id': sp.get('id', ''),
                'title': sp.get('title', ''),
                'url': sp.get('url', ''),
                'summary': sp.get('summary', ''),
                'text': sp.get('text', '')[:500] if sp.get('text') else '',  # First 500 chars
            })
    
    logger.warning(f"[ExtractUrl] Successfully extracted {len(extracted_text)} chars from {request.url}")
    logger.warning(f"[ExtractUrl] title={extracted_title[:50]}, summary={extracted_summary[:50]}, highlights={len(highlights)}, subpages={len(subpages)}")
    
    return ExtractUrlResponse(
        success=True,
        title=extracted_title,
        text=extracted_text,
        summary=extracted_summary,
        author=getattr(content, 'author', None),
        highlights=highlights,
        url=request.url,
        image=image,
        favicon=favicon,
        subpages=subpages,
    )


@router.post("/website-analysis", response_model=WebsiteAnalysisResponse)
async def save_website_analysis(
    request: WebsiteAnalysisRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Save the user's website analysis for reuse in future podcasts."""
    user_id = require_authenticated_user(current_user)
    
    try:
        from services.user_data_service import user_data_service
        
        website_data = {
            "website_url": request.website_url,
            "extracted_at": datetime.now().isoformat(),
            "exa_content": request.exa_content,
            "full_analysis": None,
            "analysis_status": "pending",
        }
        
        success = user_data_service.save_user_data(
            user_id=user_id,
            data_key="website_analysis",
            data_value=website_data,
        )
        
        if success:
            logger.warning(f"[WebsiteAnalysis] Saved analysis for user {user_id}: {request.website_url}")
            return WebsiteAnalysisResponse(
                success=True,
                website_url=request.website_url,
                message="Website analysis saved successfully",
            )
        else:
            return WebsiteAnalysisResponse(
                success=False,
                error="Failed to save website analysis",
            )
            
    except Exception as exc:
        logger.error(f"[WebsiteAnalysis] Failed to save for user {user_id}: {exc}")
        return WebsiteAnalysisResponse(
            success=False,
            error=f"Failed to save: {str(exc)}"
        )


@router.get("/website-extraction")
async def get_saved_website_extraction(request: Request = None):
    """Get previously saved website extraction data for this user."""
    try:
        # Safely get current_user from Depends
        if request is None or not hasattr(request, 'state'):
            logger.warning("[WebsiteExtraction] No request or state - user not authenticated")
            return {"success": False, "data": None, "error": "Not authenticated"}
        
        current_user = getattr(request.state, 'user', None)
        if not current_user:
            logger.warning("[WebsiteExtraction] No user in request state")
            return {"success": False, "data": None, "error": "Not authenticated"}
            
        user_id = require_authenticated_user(current_user)
        
        from services.user_data_service import UserDataService
        from services.database import get_db
        db = next(get_db())
        
        user_service = UserDataService(db)
        extraction = user_service.get_website_extraction(user_id)
        
        if extraction:
            logger.info(f"[WebsiteExtraction] Found saved data for user {user_id}")
            return {
                "success": True,
                "data": extraction
            }
        else:
            logger.info(f"[WebsiteExtraction] No saved data for user {user_id}")
            return {
                "success": False,
                "data": None
            }
            
    except Exception as exc:
        logger.error(f"[WebsiteExtraction] Failed for user: {exc}", exc_info=True)
        return {
            "success": False,
            "error": str(exc)
        }


@router.post("/website-extraction")
async def save_website_extraction(
    extraction: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Save website extraction data for future use."""
    user_id = require_authenticated_user(current_user)
    
    try:
        from services.user_data_service import UserDataService
        from services.database import get_db
        db = next(get_db())
        
        user_service = UserDataService(db)
        success = user_service.save_website_extraction(user_id, extraction)
        
        if success:
            logger.info(f"[WebsiteExtraction] Saved for user {user_id}")
            return {
                "success": True,
                "message": "Website extraction saved"
            }
        else:
            return {
                "success": False,
                "error": "Failed to save"
            }
            
    except Exception as exc:
        logger.error(f"[WebsiteExtraction] Save failed: {exc}")
        return {
            "success": False,
            "error": str(exc)
        }


@router.post("/project/{project_id}/topic-context")
async def save_topic_context(
    project_id: str,
    topic_context: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Save topic context (category research) to a podcast project."""
    user_id = require_authenticated_user(current_user)
    
    try:
        from services.database import get_db
        from models.podcast_models import PodcastProject
        
        db = next(get_db())
        
        # Find the project
        project = db.query(PodcastProject).filter(
            PodcastProject.project_id == project_id,
            PodcastProject.user_id == user_id
        ).first()
        
        if not project:
            return {
                "success": False,
                "error": "Project not found"
            }
        
        # Update topic context
        project.topic_context = topic_context
        db.commit()
        
        logger.info(f"[TopicContext] Saved for project {project_id}")
        return {
            "success": True,
            "message": "Topic context saved"
        }
        
    except Exception as exc:
        logger.error(f"[TopicContext] Save failed: {exc}")
        return {
            "success": False,
            "error": str(exc)
        }


@router.get("/project/{project_id}/topic-context")
async def get_topic_context(
    project_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get topic context from a podcast project."""
    user_id = require_authenticated_user(current_user)
    
    try:
        from services.database import get_db
        from models.podcast_models import PodcastProject
        
        db = next(get_db())
        
        project = db.query(PodcastProject).filter(
            PodcastProject.project_id == project_id,
            PodcastProject.user_id == user_id
        ).first()
        
        if not project:
            return {
                "success": False,
                "error": "Project not found"
            }
        
        return {
            "success": True,
            "data": project.topic_context
        }
        
    except Exception as exc:
        logger.error(f"[TopicContext] Get failed: {exc}")
        return {
            "success": False,
            "error": str(exc)
        }
