"""
Medium Blog Generator Service

Handles generation of medium-length blogs (≤1000 words) using structured AI calls.
"""

import time
import json
from datetime import datetime
from typing import Dict, Any, List
from loguru import logger
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.blog_models import (
    MediumBlogGenerateRequest,
    MediumBlogGenerateResult,
    MediumGeneratedSection,
    ResearchSource,
)
from services.llm_providers.main_text_generation import llm_text_gen
from services.cache.persistent_content_cache import persistent_content_cache


def _resolve_persona_block(req, user_id: str) -> str:
    """Return the brand-voice block for the system prompt.

    Phase C.3 — curated brand-voice injection: prefer the rich onboarding
    persona (PersonaData) block over the simple ``req.persona``, so the blog is
    written in the brand's actual voice (tone, phrases, sentence style). The
    TOPIC / sections / keywords are separate and remain user-driven — the
    persona constrains HOW the brand writes, never WHAT it writes about.
    Falls back to the legacy ``req.persona`` (or "") when no curated persona.
    """
    try:
        from services.persona.persona_resolver import resolve_persona_context
        curated = resolve_persona_context(user_id, 'blog')
        if curated:
            return curated
    except Exception as e:
        logger.warning(f"Curated persona resolve failed (falling back to req.persona): {e}")

    if req.persona:
        return f"""
            PERSONA GUIDELINES:
            - Industry: {req.persona.industry or 'General'}
            - Tone: {req.persona.tone or 'Professional'}
            - Audience: {req.persona.audience or 'General readers'}
            
            Write content that reflects this persona's expertise and communication style.
            Use industry-specific terminology and examples where appropriate.
            Maintain consistent voice and authority throughout all sections.
            """
    return ""


class MediumBlogGenerator:
    """Service for generating medium-length blog content using structured AI calls."""
    
    def __init__(self):
        self.cache = persistent_content_cache
    
    async def generate_medium_blog_with_progress(self, req: MediumBlogGenerateRequest, task_id: str, user_id: str, db: Session = None) -> MediumBlogGenerateResult:
        """Use Gemini structured JSON to generate a medium-length blog in one call.
        
        Args:
            req: Medium blog generation request
            task_id: Task ID for progress updates
            user_id: User ID (required for subscription checks and usage tracking)
            
        Raises:
            ValueError: If user_id is not provided
        """
        if not user_id:
            raise ValueError("user_id is required for medium blog generation (subscription checks and usage tracking)")
        
        import time
        start = time.time()

        # Prepare sections data for cache key generation
        sections_for_cache = []
        for s in req.sections:
            sections_for_cache.append({
                "id": s.id,
                "heading": s.heading,
                "keyPoints": getattr(s, "key_points", []) or getattr(s, "keyPoints", []),
                "subheadings": getattr(s, "subheadings", []),
                "keywords": getattr(s, "keywords", []),
                "targetWords": getattr(s, "target_words", None) or getattr(s, "targetWords", None),
            })

        # Check cache first
        cached_result = self.cache.get_cached_content(
            keywords=req.researchKeywords or [],
            sections=sections_for_cache,
            global_target_words=req.globalTargetWords or 1000,
            persona_data=req.persona.dict() if req.persona else None,
            tone=req.tone,
            audience=req.audience
        )
        
        if cached_result:
            logger.info(f"Using cached content for keywords: {req.researchKeywords} (saved expensive generation)")
            # Add cache hit marker to distinguish from fresh generation
            cached_result['generation_time_ms'] = 0  # Mark as cache hit
            cached_result['cache_hit'] = True
            return MediumBlogGenerateResult(**cached_result)

        # Cache miss - proceed with AI generation
        logger.info(f"Cache miss - generating new content for keywords: {req.researchKeywords}")

        # Build schema expected from the model
        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "sections": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "heading": {"type": "string"},
                            "content": {"type": "string"},
                            "wordCount": {"type": "number"},
                            "sources": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {"title": {"type": "string"}, "url": {"type": "string"}},
                                },
                            },
                        },
                    },
                },
            },
        }

        # Compose prompt
        def section_block(s):
            return {
                "id": s.id,
                "heading": s.heading,
                "outline": {
                    "keyPoints": getattr(s, "key_points", []) or getattr(s, "keyPoints", []),
                    "subheadings": getattr(s, "subheadings", []),
                    "keywords": getattr(s, "keywords", []),
                    "targetWords": getattr(s, "target_words", None) or getattr(s, "targetWords", None),
                    "references": [
                        {"title": r.title, "url": r.url} for r in getattr(s, "references", [])
                    ],
                },
            }

        payload = {
            "title": req.title,
            "globalTargetWords": req.globalTargetWords or 1000,
            "sections": [section_block(s) for s in req.sections],
        }

        # Build persona-aware system prompt.
        persona_context = _resolve_persona_block(req, user_id)
        
        system = (
            f"You are a professional blog writer in {datetime.now().year}. "
            "Generate high-quality, persona-driven content for each section based on the provided outline. "
            "Write engaging, informative content that follows the section's key points and target word count. "
            "Ensure the content flows naturally and maintains consistent voice and authority. "
            "Format content with proper paragraph breaks using double line breaks (\\n\\n) between paragraphs. "
            "Structure content with clear paragraphs - aim for 2-4 sentences per paragraph. "
            f"{persona_context}"
            "Return ONLY valid JSON with no markdown formatting or explanations."
        )

        prompt = (
            f"Write blog content for the following sections. Total target: {req.globalTargetWords or 1000} words, distributed across all sections.\n\n"
            f"Blog Title: {req.title}\n\n"
            "For each section, write engaging content that:\n"
            "- Follows the key points provided\n"
            "- Uses the suggested keywords naturally\n"
            "- Meets the target word count\n"
            "- Breaks content into clear paragraphs (2-4 sentences each)\n"
            "- Uses double line breaks (\\n\\n) between paragraphs\n"
            "- Starts with an engaging opening paragraph\n"
            "- Ends with a strong concluding paragraph\n\n"
            "Return a JSON object with 'title' and 'sections' array. Each section must have 'id', 'heading', 'content', 'wordCount', and 'sources'.\n\n"
            f"Sections:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        try:
            ai_resp = llm_text_gen(
                prompt=prompt,
                json_struct=schema,
                system_prompt=system,
                user_id=user_id,
                max_tokens=None,
                temperature=0.3,
            )
        except HTTPException:
            # Re-raise HTTPExceptions (e.g., 429 subscription limit) to preserve error details
            raise
        except Exception as llm_error:
            # Wrap other errors
            logger.error(f"AI generation failed: {llm_error}")
            raise Exception(f"AI generation failed: {str(llm_error)}")

        # Check for errors in AI response
        if not ai_resp or ai_resp.get("error"):
            error_msg = ai_resp.get("error", "Empty generation result from model") if ai_resp else "No response from model"
            logger.error(f"AI generation failed: {error_msg}")
            raise Exception(f"AI generation failed: {error_msg}")

        # Normalize output
        title = ai_resp.get("title") or req.title
        out_sections = []
        for s in ai_resp.get("sections", []) or []:
            out_sections.append(
                MediumGeneratedSection(
                    id=str(s.get("id")),
                    heading=s.get("heading") or "",
                    content=s.get("content") or "",
                    wordCount=int(s.get("wordCount") or 0),
                    sources=[
                        # map to ResearchSource shape if possible; keep minimal
                        ResearchSource(title=src.get("title", ""), url=src.get("url", ""))
                        for src in (s.get("sources") or [])
                    ] or None,
                )
            )

        duration_ms = int((time.time() - start) * 1000)
        result = MediumBlogGenerateResult(
            success=True,
            title=title,
            sections=out_sections,
            model="gemini-2.5-flash",
            generation_time_ms=duration_ms,
            safety_flags=None,
        )
        
        # Cache the result for future use
        try:
            self.cache.cache_content(
                keywords=req.researchKeywords or [],
                sections=sections_for_cache,
                global_target_words=req.globalTargetWords or 1000,
                persona_data=req.persona.dict() if req.persona else None,
                tone=req.tone or "professional",
                audience=req.audience or "general",
                result=result.dict()
            )
            logger.info(f"Cached content result for keywords: {req.researchKeywords}")
        except Exception as cache_error:
            logger.warning(f"Failed to cache content result: {cache_error}")
            # Don't fail the entire operation if caching fails
        
        # Save content to user workspace if db session is available
        if user_id and db:
            try:
                # Construct full blog content
                full_content = f"# {result.title}\n\n"
                for section in result.sections:
                    full_content += f"## {section.heading}\n\n"
                    full_content += f"{section.content}\n\n"
                
                # Save to workspace
                save_and_track_text_content(
                    db=db,
                    user_id=user_id,
                    content=full_content,
                    source_module="blog_writer",
                    title=result.title,
                    description=f"Blog: {result.title}",
                    tags=req.researchKeywords or ["blog", "ai_generated"],
                    asset_metadata={
                        "blog_type": "medium",
                        "model": result.model,
                        "generation_time_ms": result.generation_time_ms,
                        "word_count": sum(s.wordCount for s in result.sections),
                        "section_count": len(result.sections),
                    },
                    subdirectory="blogs"
                )
                logger.info(f"Saved medium blog content to user workspace for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to save medium blog content to workspace: {e}")
        elif not db:
             logger.warning("Database session not provided, skipping workspace save for medium blog")

        return result
