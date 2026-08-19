"""
YouTube Video Planner Service

Generates video plans, outlines, and insights using AI with persona integration.
Supports optional Exa research for enhanced, data-driven plans.
"""

from typing import Dict, Any, Optional, List
import json

from fastapi import HTTPException

from services.llm_providers.main_text_generation import llm_text_gen
from utils.logger_utils import get_service_logger
from services.youtube.planner_config import VIDEO_TYPE_CONFIGS, get_duration_context
from services.youtube.planner_prompts import (
    PLANNER_SYSTEM_PROMPT,
    build_planning_prompt,
    build_plan_json_struct,
)
from services.youtube.planner_research import perform_exa_research
from services.youtube.planner_generation import attach_plan_generation_metadata
from services.persona.youtube.youtube_persona_service import YouTubePersonaService

logger = get_service_logger("youtube.planner")

# Re-export for any callers that imported configs from this module
__all__ = ["YouTubePlannerService", "VIDEO_TYPE_CONFIGS"]


class YouTubePlannerService:
    """Service for planning YouTube videos with AI assistance."""

    def __init__(self):
        """Initialize the planner service."""
        logger.info("[YouTubePlanner] Service initialized")

    async def generate_plan(
        self,
        user_idea: str,
        duration_type: str,  # "shorts", "medium", "long"
        video_type: Optional[str] = None,  # "tutorial", "review", etc.
        target_audience: Optional[str] = None,
        video_goal: Optional[str] = None,
        brand_style: Optional[str] = None,
        # Two-tier personalization: this is the user's YouTube BASE persona (the
        # platform_personas['youtube'] dict — stable form: tone/pacing, visual
        # style, script structure, audience, prompt_defaults). It supplies DEFAULTS
        # only; episode inputs (target_audience/video_goal/brand_style above) always
        # win. Rendered into the prompt by _build_persona_context.
        persona_data: Optional[Dict[str, Any]] = None,
        reference_image_description: Optional[str] = None,
        source_content_id: Optional[str] = None,  # For blog/story conversion
        source_content_type: Optional[str] = None,  # "blog", "story"
        user_id: str = None,
        avatar_url: Optional[str] = None,
        include_scenes: bool = False,  # For shorts: combine plan + scenes in one call
        enable_research: bool = True,  # Always enable research by default for enhanced plans
        source_article_url: Optional[str] = None,
        source_article_title: Optional[str] = None,
        source_article_summary: Optional[str] = None,
        channel_bible_context: str = "",
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive video plan from user input.

        Returns:
            Dictionary with video plan, outline, insights, and metadata
        """
        try:
            logger.info(
                f"[YouTubePlanner] Generating plan: idea={user_idea[:50]}..., "
                f"duration={duration_type}, video_type={video_type}, user={user_id}, "
                f"has_channel_bible={bool((channel_bible_context or '').strip())}"
            )

            video_type_config = {}
            if video_type and video_type in VIDEO_TYPE_CONFIGS:
                video_type_config = VIDEO_TYPE_CONFIGS[video_type]

            persona_context = self._build_persona_context(persona_data)
            duration_context = self._get_duration_context(duration_type)

            if video_type_config:
                default_tone = video_type_config.get('tone', 'Professional and engaging')
                default_visual_style = video_type_config.get('visual_style', 'Professional and engaging')
                default_goal = video_goal or f"Create engaging {video_type} content"
                default_audience = target_audience or f"Viewers interested in {video_type} content"
            else:
                default_tone = 'Professional and engaging'
                default_visual_style = 'Professional and engaging'
                default_goal = video_goal or 'Engage and inform viewers'
                default_audience = target_audience or 'General YouTube audience'

            research_context = ""
            research_sources = []
            research_enabled = False
            if enable_research:
                logger.info(
                    f"[YouTubePlanner] 🔍 Starting Exa research for plan generation "
                    f"(idea: {user_idea[:50]}...)"
                )
                research_enabled = True
                try:
                    research_context, research_sources = await self._perform_exa_research(
                        user_idea=user_idea,
                        video_type=video_type,
                        target_audience=default_audience,
                        user_id=user_id
                    )
                    if research_sources:
                        logger.info(
                            f"[YouTubePlanner] ✅ Exa research completed successfully: "
                            f"{len(research_sources)} sources found. "
                            f"Research context length: {len(research_context)} chars"
                        )
                    else:
                        logger.warning(
                            "[YouTubePlanner] ⚠️ Exa research completed but no sources returned"
                        )
                except HTTPException as http_ex:
                    error_detail = http_ex.detail
                    if isinstance(error_detail, dict):
                        error_msg = error_detail.get("message", error_detail.get("error", str(http_ex)))
                    else:
                        error_msg = str(error_detail)
                    logger.warning(
                        f"[YouTubePlanner] ⚠️ Exa research skipped due to subscription limits "
                        f"or error: {error_msg} (status={http_ex.status_code}). "
                        f"Continuing without research."
                    )
                except Exception as e:
                    logger.warning(
                        f"[YouTubePlanner] ⚠️ Exa research failed (non-critical): {e}. "
                        f"Continuing without research."
                    )
            else:
                logger.info("[YouTubePlanner] ℹ️ Exa research disabled for this plan generation")

            planning_prompt = build_planning_prompt(
                user_idea=user_idea,
                duration_type=duration_type,
                video_type=video_type,
                video_type_config=video_type_config,
                duration_context=duration_context,
                default_audience=default_audience,
                default_goal=default_goal,
                default_tone=default_tone,
                default_visual_style=default_visual_style,
                brand_style=brand_style,
                target_audience=target_audience,
                video_goal=video_goal,
                persona_context=persona_context,
                persona_data=persona_data,
                source_content_id=source_content_id,
                source_content_type=source_content_type,
                source_article_url=source_article_url,
                source_article_title=source_article_title,
                source_article_summary=source_article_summary,
                reference_image_description=reference_image_description,
                research_context=research_context,
                include_scenes=include_scenes,
                channel_bible_context=channel_bible_context or "",
            )
            json_struct = build_plan_json_struct(
                include_scenes=include_scenes,
                duration_type=duration_type,
            )

            response = llm_text_gen(
                prompt=planning_prompt,
                system_prompt=PLANNER_SYSTEM_PROMPT,
                user_id=user_id,
                json_struct=json_struct,
                flow_type="youtube_plan",
            )

            if isinstance(response, dict):
                plan_data = response
            else:
                try:
                    plan_data = json.loads(response)
                except json.JSONDecodeError as e:
                    logger.error(f"[YouTubePlanner] Failed to parse JSON response: {e}")
                    logger.debug(f"[YouTubePlanner] Raw response: {response[:500]}")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to parse video plan response. Please try again."
                    )

            plan_data = self._validate_and_enhance_plan(
                plan_data, duration_context, video_type, video_type_config
            )

            plan_data["duration_type"] = duration_type
            plan_data["duration_metadata"] = duration_context
            plan_data["user_idea"] = user_idea

            plan_data["research_enabled"] = research_enabled
            if research_sources:
                plan_data["research_sources"] = research_sources
                plan_data["research_sources_count"] = len(research_sources)
            else:
                plan_data["research_sources"] = []
                plan_data["research_sources_count"] = 0

            if research_enabled:
                logger.info(
                    f"[YouTubePlanner] 📊 Plan metadata: research_enabled=True, "
                    f"research_sources_count={plan_data.get('research_sources_count', 0)}, "
                    f"research_context_length={len(research_context)} chars"
                )

            if include_scenes and duration_type == "shorts":
                plan_data = self._finalize_shorts_scenes(plan_data, duration_context)

            if source_article_url:
                plan_data["source_article_url"] = source_article_url

            try:
                plan_data = attach_plan_generation_metadata(
                    plan_data,
                    system_prompt=PLANNER_SYSTEM_PROMPT,
                    user_prompt=planning_prompt,
                    research_enabled=research_enabled,
                    research_context=research_context,
                )
            except Exception as meta_err:
                logger.exception(
                    "[YouTubePlanner] Generation metadata attach failed; "
                    "returning plan without prompt transparency. err=%s",
                    meta_err,
                )

            logger.info("[YouTubePlanner] ✅ Plan generated successfully")
            return plan_data

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[YouTubePlanner] Error generating plan: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate video plan: {str(e)}"
            )

    def _finalize_shorts_scenes(
        self,
        plan_data: Dict[str, Any],
        duration_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Validate/trim shorts scenes returned with the plan."""
        if "scenes" in plan_data and plan_data["scenes"]:
            scenes = plan_data["scenes"]
            scene_count = len(scenes)
            total_scene_duration = sum(
                scene.get("duration_estimate", 0) for scene in scenes
            )

            max_scenes = duration_context["max_scenes"]
            target_duration = duration_context["target_seconds"]

            if scene_count > max_scenes:
                logger.warning(
                    f"[YouTubePlanner] Scene count ({scene_count}) exceeds max ({max_scenes}). "
                    f"Truncating to first {max_scenes} scenes."
                )
                plan_data["scenes"] = scenes[:max_scenes]

            if abs(total_scene_duration - target_duration) > target_duration * 0.3:
                logger.warning(
                    f"[YouTubePlanner] Total scene duration ({total_scene_duration}s) "
                    f"differs significantly from target ({target_duration}s)"
                )

            plan_data["_scenes_included"] = True
            logger.info(
                f"[YouTubePlanner] ✅ Plan + {len(plan_data['scenes'])} scenes "
                f"generated in 1 AI call (optimized for shorts)"
            )
        else:
            plan_data["_scenes_included"] = False
            logger.warning(
                "[YouTubePlanner] Shorts optimization requested but no scenes returned; "
                "scene builder will generate scenes separately."
            )
        return plan_data

    def _build_persona_context(self, persona_data: Optional[Dict[str, Any]]) -> str:
        """Build persona context string for prompts (YouTube persona schema).

        Delegates to ``YouTubePersonaService.build_prompt_context`` so the renderer
        lives next to the schema it consumes. Returns "" when no persona is present,
        in which case ``build_planning_prompt`` omits the persona block entirely and
        the planner falls back to its generic, persona-free behavior.
        """
        return YouTubePersonaService.build_prompt_context(persona_data)

    def _get_duration_context(self, duration_type: str) -> Dict[str, Any]:
        """Get duration-specific context and constraints."""
        return get_duration_context(duration_type)

    def _validate_and_enhance_plan(
        self,
        plan_data: Dict[str, Any],
        duration_context: Dict[str, Any],
        video_type: Optional[str],
        video_type_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Validate and enhance plan quality before returning.

        Performs quality checks:
        - Validates required fields
        - Validates content outline duration matches target
        - Ensures SEO keywords are present
        - Validates avatar recommendations
        - Adds quality metadata
        """
        required_fields = [
            "video_summary", "target_audience", "video_goal", "key_message",
            "hook_strategy", "content_outline", "call_to_action",
            "visual_style", "tone", "seo_keywords"
        ]

        missing_fields = [field for field in required_fields if not plan_data.get(field)]
        if missing_fields:
            logger.warning(f"[YouTubePlanner] Missing required fields: {missing_fields}")
            for field in missing_fields:
                if field == "seo_keywords":
                    plan_data[field] = []
                elif field == "content_outline":
                    plan_data[field] = []
                else:
                    plan_data[field] = f"[{field} not generated]"

        if plan_data.get("content_outline"):
            total_duration = sum(
                section.get("duration_estimate", 0)
                for section in plan_data["content_outline"]
            )
            target_duration = duration_context.get("target_seconds", 150)

            tolerance = target_duration * 0.2
            if abs(total_duration - target_duration) > tolerance:
                logger.warning(
                    f"[YouTubePlanner] Content outline duration ({total_duration}s) "
                    f"doesn't match target ({target_duration}s). Adjusting..."
                )
                if total_duration > 0:
                    scale_factor = target_duration / total_duration
                    for section in plan_data["content_outline"]:
                        if "duration_estimate" in section:
                            section["duration_estimate"] = round(
                                section["duration_estimate"] * scale_factor, 1
                            )

        if not plan_data.get("seo_keywords") or len(plan_data["seo_keywords"]) < 3:
            logger.warning(
                f"[YouTubePlanner] Insufficient SEO keywords "
                f"({len(plan_data.get('seo_keywords', []))}). "
                f"Plan may need enhancement."
            )

        raw_titles = plan_data.get("title_suggestions")
        suggestions: List[str] = []
        if isinstance(raw_titles, list):
            seen_titles: set[str] = set()
            for item in raw_titles:
                if not isinstance(item, str):
                    continue
                title = item.strip()[:70]
                key = title.lower()
                if not title or key in seen_titles:
                    continue
                seen_titles.add(key)
                suggestions.append(title)
                if len(suggestions) >= 5:
                    break
        plan_data["title_suggestions"] = suggestions

        selected = plan_data.get("selected_title")
        selected_title = selected.strip()[:70] if isinstance(selected, str) else ""
        if not selected_title:
            if suggestions:
                selected_title = suggestions[0]
            else:
                summary = plan_data.get("video_summary")
                selected_title = (
                    summary.strip()[:80] if isinstance(summary, str) and summary.strip() else ""
                )
        plan_data["selected_title"] = selected_title
        logger.info(
            f"[YouTubePlanner] Title fields normalized: "
            f"suggestion_count={len(suggestions)}, has_selected={bool(selected_title)}"
        )

        if not plan_data.get("avatar_recommendations"):
            logger.warning(
                "[YouTubePlanner] Avatar recommendations missing. Generating defaults..."
            )
            plan_data["avatar_recommendations"] = {
                "description": video_type_config.get("avatar_style", "Professional YouTube creator"),
                "style": plan_data.get("visual_style", "Professional"),
                "energy": plan_data.get("tone", "Engaging")
            }
        else:
            avatar_rec = plan_data["avatar_recommendations"]
            if not avatar_rec.get("description"):
                avatar_rec["description"] = video_type_config.get(
                    "avatar_style", "Professional YouTube creator"
                )
            if not avatar_rec.get("style"):
                avatar_rec["style"] = plan_data.get("visual_style", "Professional")
            if not avatar_rec.get("energy"):
                avatar_rec["energy"] = plan_data.get("tone", "Engaging")

        plan_data["_quality_checks"] = {
            "content_outline_validated": bool(plan_data.get("content_outline")),
            "seo_keywords_count": len(plan_data.get("seo_keywords", [])),
            "avatar_recommendations_present": bool(plan_data.get("avatar_recommendations")),
            "all_required_fields_present": len(missing_fields) == 0,
        }

        logger.info(
            f"[YouTubePlanner] Plan quality validated: "
            f"outline_sections={len(plan_data.get('content_outline', []))}, "
            f"seo_keywords={len(plan_data.get('seo_keywords', []))}, "
            f"avatar_recs={'yes' if plan_data.get('avatar_recommendations') else 'no'}"
        )

        return plan_data

    async def _perform_exa_research(
        self,
        user_idea: str,
        video_type: Optional[str],
        target_audience: str,
        user_id: str
    ) -> tuple[str, List[Dict[str, Any]]]:
        """Delegate Exa research to the shared helper (keeps patch.object compatible)."""
        return await perform_exa_research(
            user_idea=user_idea,
            video_type=video_type,
            target_audience=target_audience,
            user_id=user_id,
        )
