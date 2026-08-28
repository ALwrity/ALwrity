"""
YouTube Scene Builder Service

Converts video plans into structured scenes with narration, visual prompts, and timing.
"""

from typing import Dict, Any, Optional, List

from fastapi import HTTPException

from services.story_writer.prompt_enhancer_service import PromptEnhancerService
from utils.logger_utils import get_service_logger
from services.youtube.scene_builder_enhance import (
    batch_enhance_prompts,
    enhance_visual_prompts_batch,
)
from services.youtube.scene_builder_generation import generate_scenes_from_plan
from services.youtube.scene_builder_generation_metadata import attach_scene_generation_metadata
from services.youtube.scene_builder_parse import parse_youtube_custom_script
from services.youtube.scene_builder_prompts import build_scene_generation_prompts

logger = get_service_logger("youtube.scene_builder")


class YouTubeSceneBuilderService:
    """Service for building structured video scenes from plans."""

    def __init__(self):
        """Initialize the scene builder service."""
        self.prompt_enhancer = PromptEnhancerService()
        logger.info("[YouTubeSceneBuilder] Service initialized")

    def build_scenes_from_plan(
        self,
        video_plan: Dict[str, Any],
        user_id: str,
        custom_script: Optional[str] = None,
    ) -> Dict[str, Any]:
        # PHASE-3B (deferred): this builds scene narration + visual_prompt WITHOUT
        # the YouTube persona. Flow the persona in (visual_style, script_structure,
        # prompt_defaults.video_base_prompt) from plan.py /scenes so medium/long
        # scenes stay on-brand. APPEND persona fragment, never replace the
        # scene-specific content; an explicit custom_script always wins.
        """
        Build structured scenes from a video plan.

        This method is optimized to minimize AI calls:
        - For shorts: Reuses scenes if already generated in plan (0 AI calls)
        - For medium/long: Generates scenes + batch enhances (1-3 AI calls total)
        - Custom script: Parses script without AI calls (0 AI calls)

        Args:
            video_plan: Video plan from planner service
            user_id: Clerk user ID for subscription checking
            custom_script: Optional custom script to use instead of generating

        Returns:
            Dict with `scenes` and optional `generation` metadata for UI transparency.
        """
        try:
            duration_type = video_plan.get('duration_type', 'medium')
            logger.info(
                f"[YouTubeSceneBuilder] Building scenes from plan: "
                f"duration={duration_type}, "
                f"sections={len(video_plan.get('content_outline', []))}, "
                f"user={user_id}"
            )

            duration_metadata = video_plan.get("duration_metadata", {})
            max_scenes = duration_metadata.get("max_scenes", 10)
            system_prompt, user_prompt = build_scene_generation_prompts(
                video_plan, duration_metadata
            )
            llm_called = False
            scenes_reused_from_plan = False
            custom_script_used = False

            # Optimization: Check if scenes already exist in plan (prevents duplicate generation)
            # This can happen if plan was generated with include_scenes=True for shorts
            existing_scenes = video_plan.get("scenes", [])
            if existing_scenes and video_plan.get("_scenes_included"):
                # Scenes already generated in plan - reuse them (0 AI calls)
                logger.info(
                    f"[YouTubeSceneBuilder] ♻️ Reusing {len(existing_scenes)} scenes from plan "
                    f"(duration={duration_type}) - skipping generation to save AI calls"
                )
                scenes = self._normalize_scenes_from_plan(video_plan, duration_metadata)
                scenes_reused_from_plan = True
            # If custom script provided, parse it into scenes (0 AI calls for parsing)
            elif custom_script:
                logger.info(
                    f"[YouTubeSceneBuilder] Parsing custom script for scene generation "
                    f"(0 AI calls required)"
                )
                custom_script_used = True
                scenes = self._parse_custom_script(
                    custom_script, video_plan, duration_metadata, user_id
                )
            # For shorts, check if scenes were already generated in plan (optimization)
            elif video_plan.get("_scenes_included") and duration_type == "shorts":
                prebuilt = video_plan.get("scenes") or []
                if prebuilt:
                    logger.info(
                        f"[YouTubeSceneBuilder] Using scenes from optimized plan+scenes call "
                        f"({len(prebuilt)} scenes)"
                    )
                    scenes = self._normalize_scenes_from_plan(video_plan, duration_metadata)
                    scenes_reused_from_plan = True
                else:
                    logger.warning(
                        "[YouTubeSceneBuilder] Plan marked _scenes_included but no scenes present; "
                        "regenerating scenes normally."
                    )
                    scenes = self._generate_scenes_from_plan(
                        video_plan, duration_metadata, user_id
                    )
                    llm_called = True
            else:
                # Generate scenes from plan
                scenes = self._generate_scenes_from_plan(
                    video_plan, duration_metadata, user_id
                )
                llm_called = True

            # Limit LLM-generated scenes. Parsed scripts keep 1:1 paragraphs so
            # duration rebalance still targets 30 / 150 / 420 seconds.
            if len(scenes) > max_scenes and not custom_script_used:
                logger.warning(
                    f"[YouTubeSceneBuilder] Truncating {len(scenes)} scenes to {max_scenes}"
                )
                scenes = scenes[:max_scenes]
            elif len(scenes) > max_scenes:
                logger.info(
                    "[YouTubeSceneBuilder] Keeping {} parsed script scenes "
                    "(max_scenes={} applies to LLM generation only)",
                    len(scenes),
                    max_scenes,
                )

            # Enhance visual prompts efficiently based on duration type
            duration_type = video_plan.get("duration_type", "medium")
            scenes = self._enhance_visual_prompts_batch(
                scenes, video_plan, user_id, duration_type
            )

            logger.info(f"[YouTubeSceneBuilder] ✅ Built {len(scenes)} scenes")
            return attach_scene_generation_metadata(
                {"scenes": scenes},
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                llm_called=llm_called,
                scenes_reused_from_plan=scenes_reused_from_plan,
                custom_script_used=custom_script_used,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[YouTubeSceneBuilder] Error building scenes: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to build scenes: {str(e)}"
            )

    def _generate_scenes_from_plan(
        self,
        video_plan: Dict[str, Any],
        duration_metadata: Dict[str, Any],
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Generate scenes from video plan using AI."""
        return generate_scenes_from_plan(video_plan, duration_metadata, user_id)

    def _normalize_scenes_from_plan(
        self,
        video_plan: Dict[str, Any],
        duration_metadata: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Normalize scenes that were generated as part of the plan (optimization for shorts)."""
        scenes = video_plan.get("scenes", [])
        scene_duration_range = duration_metadata.get("scene_duration_range", (2, 8))

        normalized_scenes = []
        for idx, scene in enumerate(scenes, 1):
            if isinstance(scene, dict):
                scene_data = scene
            else:
                scene_data = {
                    "scene_number": idx,
                    "title": f"Scene {idx}",
                    "narration": str(scene),
                    "visual_description": "",
                    "duration_estimate": scene_duration_range[0],
                    "emphasis": "main_content",
                    "visual_cues": [],
                }
            normalized_scenes.append(
                {
                    "scene_number": scene_data.get("scene_number", idx),
                    "title": scene_data.get("title", f"Scene {idx}"),
                    "narration": scene_data.get("narration", ""),
                    "visual_description": scene_data.get("visual_description", ""),
                    "duration_estimate": scene_data.get(
                        "duration_estimate", scene_duration_range[0]
                    ),
                    "emphasis": scene_data.get("emphasis", "main_content"),
                    "visual_cues": scene_data.get("visual_cues", []),
                    "visual_prompt": scene_data.get("visual_description", ""),
                }
            )

        logger.info(
            f"[YouTubeSceneBuilder] ✅ Normalized {len(normalized_scenes)} scenes "
            f"from optimized plan (saved 1 AI call)"
        )
        return normalized_scenes

    def _parse_custom_script(
        self,
        custom_script: str,
        video_plan: Dict[str, Any],
        duration_metadata: Dict[str, Any],
        user_id: str,
    ) -> List[Dict[str, Any]]:
        """Parse expanded fullScript into scenes (durations, titles, distinct visuals)."""
        logger.debug(
            "[YouTubeSceneBuilder] Parsing custom script user_present={}",
            bool(user_id),
        )
        return parse_youtube_custom_script(
            custom_script=custom_script,
            duration_type=str(video_plan.get("duration_type") or "medium"),
            duration_metadata=duration_metadata or {},
            video_plan=video_plan,
        )

    def _enhance_visual_prompts_batch(
        self,
        scenes: List[Dict[str, Any]],
        video_plan: Dict[str, Any],
        user_id: str,
        duration_type: str,
    ) -> List[Dict[str, Any]]:
        """
        Efficiently enhance visual prompts based on video duration type.

        Strategy:
        - Shorts: Skip only when visuals are already distinct from narration;
          otherwise one batch call (same as medium)
        - Medium: Batch enhance all scenes in 1 call - 1 AI call
        - Long: Batch enhance in 2 calls (split scenes) - 2 AI calls max
        """
        return enhance_visual_prompts_batch(
            scenes=scenes,
            video_plan=video_plan,
            user_id=user_id,
            duration_type=duration_type,
            batch_enhance_fn=self._batch_enhance_prompts,
        )

    def _batch_enhance_prompts(
        self,
        scene_data_list: List[Dict[str, Any]],
        story_context: Dict[str, Any],
        user_id: str,
    ) -> Dict[int, str]:
        """
        Enhance multiple scene prompts in a single AI call.

        Returns:
            Dictionary mapping scene index to enhanced prompt
        """
        return batch_enhance_prompts(scene_data_list, story_context, user_id)
