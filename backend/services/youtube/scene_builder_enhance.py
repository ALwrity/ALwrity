"""Visual prompt batch enhancement for YouTube scenes."""

from typing import Dict, Any, List, Callable
import json

from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.scene_builder_parse import scene_needs_visual_enhance
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_builder_enhance")


def enhance_visual_prompts_batch(
    scenes: List[Dict[str, Any]],
    video_plan: Dict[str, Any],
    user_id: str,
    duration_type: str,
    batch_enhance_fn: Callable[..., Dict[int, str]],
) -> List[Dict[str, Any]]:
    """
    Efficiently enhance visual prompts based on video duration type.
    
    Strategy:
    - Shorts: Skip only when each scene already has a visual distinct from narration.
      Otherwise one batch call (product-correct, not a workaround).
    - Medium: Batch enhance all scenes in 1 call - 1 AI call
    - Long: Batch enhance in 2 calls (split scenes) - 2 AI calls max
    """
    if duration_type == "shorts":
        if not any(scene_needs_visual_enhance(scene) for scene in scenes):
            logger.info(
                "[YouTubeSceneBuilder] Skipping prompt enhancement for shorts "
                "({} scenes); visuals already distinct from narration",
                len(scenes),
            )
            for scene in scenes:
                scene["enhanced_visual_prompt"] = scene.get(
                    "visual_prompt", scene.get("visual_description", "")
                )
            return scenes
        logger.info(
            "[YouTubeSceneBuilder] Batch enhancing {} shorts scenes in 1 AI call "
            "(empty visual or visual copied narration)",
            len(scenes),
        )
        duration_type = "medium"
    
    # Build story context for prompt enhancer
    story_context = {
        "story_setting": video_plan.get("visual_style", "cinematic"),
        "story_tone": video_plan.get("tone", "professional"),
        "writing_style": video_plan.get("visual_style", "cinematic"),
    }
    
    # Convert scenes to format expected by enhancer
    scene_data_list = [
        {
            "scene_number": scene.get("scene_number", idx + 1),
            "title": scene.get("title", ""),
            "description": scene.get("visual_description", ""),
            "image_prompt": scene.get("visual_prompt", ""),
        }
        for idx, scene in enumerate(scenes)
    ]
    
    # For medium videos, enhance all scenes in one batch call
    if duration_type == "medium":
        logger.info(
            f"[YouTubeSceneBuilder] Batch enhancing {len(scenes)} scenes "
            f"for medium video in 1 AI call"
        )
        try:
            # Use a single batch enhancement call
            enhanced_prompts = batch_enhance_fn(
                scene_data_list, story_context, user_id
            )
            for idx, scene in enumerate(scenes):
                scene["enhanced_visual_prompt"] = enhanced_prompts.get(
                    idx, scene.get("visual_prompt", scene.get("visual_description", ""))
                )
        except Exception as e:
            logger.warning(
                f"[YouTubeSceneBuilder] Batch enhancement failed: {e}, "
                f"using original prompts"
            )
            for scene in scenes:
                scene["enhanced_visual_prompt"] = scene.get(
                    "visual_prompt", scene.get("visual_description", "")
                )
        return scenes
    
    # For long videos, split into 2 batches to avoid token limits
    if duration_type == "long":
        logger.info(
            f"[YouTubeSceneBuilder] Batch enhancing {len(scenes)} scenes "
            f"for long video in 2 AI calls"
        )
        mid_point = len(scenes) // 2
        batches = [
            scene_data_list[:mid_point],
            scene_data_list[mid_point:],
        ]
        
        all_enhanced = {}
        for batch_idx, batch in enumerate(batches):
            try:
                enhanced = batch_enhance_fn(
                    batch, story_context, user_id
                )
                start_idx = 0 if batch_idx == 0 else mid_point
                for local_idx, enhanced_prompt in enhanced.items():
                    all_enhanced[start_idx + local_idx] = enhanced_prompt
            except Exception as e:
                logger.warning(
                    f"[YouTubeSceneBuilder] Batch {batch_idx + 1} enhancement "
                    f"failed: {e}, using original prompts"
                )
                start_idx = 0 if batch_idx == 0 else mid_point
                for local_idx, scene_data in enumerate(batch):
                    all_enhanced[start_idx + local_idx] = scene_data.get(
                        "image_prompt", scene_data.get("description", "")
                    )
        
        for idx, scene in enumerate(scenes):
            scene["enhanced_visual_prompt"] = all_enhanced.get(
                idx, scene.get("visual_prompt", scene.get("visual_description", ""))
            )
        return scenes
    
    # Fallback: use original prompts
    logger.warning(
        f"[YouTubeSceneBuilder] Unknown duration type '{duration_type}', "
        f"using original prompts"
    )
    for scene in scenes:
        scene["enhanced_visual_prompt"] = scene.get(
            "visual_prompt", scene.get("visual_description", "")
        )
    return scenes


def batch_enhance_prompts(
    scene_data_list: List[Dict[str, Any]],
    story_context: Dict[str, Any],
    user_id: str,
) -> Dict[int, str]:
    """
    Enhance multiple scene prompts in a single AI call.
    
    Returns:
        Dictionary mapping scene index to enhanced prompt
    """
    try:
        # Build batch enhancement prompt
        scenes_text = "\n\n".join([
            f"Scene {scene.get('scene_number', idx + 1)}: {scene.get('title', '')}\n"
            f"Description: {scene.get('description', '')}\n"
            f"Current Prompt: {scene.get('image_prompt', '')}"
            for idx, scene in enumerate(scene_data_list)
        ])
        
        batch_prompt = f"""You are optimizing visual prompts for AI video generation. Enhance the following scenes to be more detailed and video-optimized.

**Video Style Context:**
- Setting: {story_context.get('story_setting', 'cinematic')}
- Tone: {story_context.get('story_tone', 'professional')}
- Style: {story_context.get('writing_style', 'cinematic')}

**Scenes to Enhance:**
{scenes_text}

**Your Task:**
For each scene, create an enhanced visual prompt (200-300 words) that:
1. Is detailed and specific for video generation
2. Includes camera movements, lighting, composition
3. Maintains consistency with the video style
4. Is optimized for WAN 2.5 text-to-video model

**Format as JSON array with enhanced prompts:**
[
  {{"scene_index": 0, "enhanced_prompt": "detailed enhanced prompt for scene 1..."}},
  {{"scene_index": 1, "enhanced_prompt": "detailed enhanced prompt for scene 2..."}},
  ...
]

Make sure the array length matches the number of scenes provided ({len(scene_data_list)}).
"""
        
        system_prompt = (
            "You are an expert at creating detailed visual prompts for AI video generation. "
            "Your prompts are specific, cinematic, and optimized for video models."
        )
        
        response = llm_text_gen(
            prompt=batch_prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            json_struct={
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "scene_index": {"type": "number"},
                        "enhanced_prompt": {"type": "string"}
                    },
                    "required": ["scene_index", "enhanced_prompt"]
                }
            }
        )
        
        # Parse response
        if isinstance(response, list):
            enhanced_list = response
        elif isinstance(response, str):
            import json
            enhanced_list = json.loads(response)
        else:
            enhanced_list = response
        
        # Build result dictionary
        result = {}
        for item in enhanced_list:
            idx = item.get("scene_index", 0)
            prompt = item.get("enhanced_prompt", "")
            if prompt:
                result[idx] = prompt
            else:
                # Fallback to original
                original_scene = scene_data_list[idx] if idx < len(scene_data_list) else {}
                result[idx] = original_scene.get(
                    "image_prompt", original_scene.get("description", "")
                )
        
        # Fill in any missing scenes with original prompts
        for idx in range(len(scene_data_list)):
            if idx not in result:
                original_scene = scene_data_list[idx]
                result[idx] = original_scene.get(
                    "image_prompt", original_scene.get("description", "")
                )
        
        logger.info(
            f"[YouTubeSceneBuilder] ✅ Batch enhanced {len(result)} prompts "
            f"in 1 AI call"
        )
        return result
        
    except Exception as e:
        logger.error(
            f"[YouTubeSceneBuilder] Batch enhancement failed: {e}",
            exc_info=True
        )
        # Return original prompts as fallback
        return {
            idx: scene.get("image_prompt", scene.get("description", ""))
            for idx, scene in enumerate(scene_data_list)
        }
