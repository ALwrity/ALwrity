"""LLM scene generation for YouTube scene builder."""

from typing import Dict, Any, List
import json

from fastapi import HTTPException

from services.llm_providers.main_text_generation import llm_text_gen
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_builder_generation")


def _parse_scenes_response(response: Any) -> List[Any]:
    """Normalize llm_text_gen output into a list of scene payloads."""
    if isinstance(response, list):
        return response
    if isinstance(response, dict) and isinstance(response.get("scenes"), list):
        return response["scenes"]
    if isinstance(response, str):
        parsed = json.loads(response)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get("scenes"), list):
            return parsed["scenes"]
        raise ValueError("LLM string response did not contain a scenes array")
    raise ValueError(f"Unexpected LLM response type: {type(response).__name__}")


def generate_scenes_from_plan(
    video_plan: Dict[str, Any],
    duration_metadata: Dict[str, Any],
    user_id: str,
) -> List[Dict[str, Any]]:
    """Generate scenes from video plan using AI."""
    duration_type = video_plan.get("duration_type", "medium")
    raw_content_outline = video_plan.get("content_outline", [])
    content_outline: List[Dict[str, Any]] = []
    for item in raw_content_outline:
        if isinstance(item, dict):
            content_outline.append(item)
        else:
            content_outline.append(
                {
                    "section": str(item),
                    "description": "",
                    "duration_estimate": 0,
                }
            )

    if not content_outline:
        logger.error(
            "[YouTubeSceneBuilder] Refusing scene generation with empty outline "
            "duration=%s user=%s",
            duration_type,
            user_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Video plan has no content outline. Regenerate the plan before building scenes.",
        )

    hook_strategy = video_plan.get("hook_strategy", "")
    call_to_action = video_plan.get("call_to_action", "")
    visual_style = video_plan.get("visual_style", "cinematic")
    tone = video_plan.get("tone", "professional")

    scene_duration_range = duration_metadata.get("scene_duration_range", (5, 15))
    logger.info(
        "[YouTubeSceneBuilder] Generating scenes via llm_text_gen "
        "duration=%s outline_sections=%s user=%s",
        duration_type,
        len(content_outline),
        user_id,
    )

    scene_generation_prompt = f"""You are a top YouTube scriptwriter specializing in engaging, viral content. Create compelling scenes that captivate viewers and maximize watch time.

**VIDEO PLAN:**
📝 Summary: {video_plan.get('video_summary', '')}
🎯 Goal: {video_plan.get('video_goal', '')}
💡 Key Message: {video_plan.get('key_message', '')}
🎨 Visual Style: {visual_style}
🎭 Tone: {tone}

**🎣 HOOK STRATEGY:**
{hook_strategy}

**📋 CONTENT STRUCTURE:**
{chr(10).join([f"• {section.get('section', '')}: {section.get('description', '')} ({section.get('duration_estimate', 0)}s)" for section in content_outline])}

**🚀 CALL-TO-ACTION:**
{call_to_action}

**⏱️ TIMING CONSTRAINTS:**
• Scene duration: {scene_duration_range[0]}-{scene_duration_range[1]} seconds each
• Total target: {duration_metadata.get('target_seconds', 150)} seconds

**🎬 YOUR MISSION - CREATE VIRAL-WORTHY SCENES:**

Write narration that:
✨ **HOOKS IMMEDIATELY** - First {duration_metadata.get('hook_seconds', 10)}s must GRAB attention
🎭 **TELLS A STORY** - Each scene advances the narrative with emotional engagement
💡 **DELIVERS VALUE** - Provide insights, tips, or "aha!" moments in every scene
🔥 **BUILDS EXCITEMENT** - Use power words, questions, and cliffhangers
👥 **CONNECTS PERSONALLY** - Speak directly to the viewer's needs and desires
⚡ **MAINTAINS PACE** - Vary sentence length for natural rhythm
🎯 **DRIVES ACTION** - Build toward the CTA with increasing urgency

**REQUIRED SCENE ELEMENTS:**
1. **scene_number**: Sequential numbering
2. **title**: Catchy, descriptive title (5-8 words max)
3. **narration**: ENGAGING spoken script with:
   - Conversational language ("you know what I mean?")
   - Rhetorical questions ("Have you ever wondered...?")
   - Power transitions ("But here's the game-changer...")
   - Emotional hooks ("Imagine this...")
   - Action-oriented language ("Let's dive in...")
4. **visual_description**: Cinematic, professional YouTube visuals
5. **duration_estimate**: Realistic speaking time
6. **emphasis**: hook/main_content/transition/cta
7. **visual_cues**: ["dramatic_zoom", "text_overlay", "fast_cuts"]

**🎯 YOUTUBE OPTIMIZATION RULES:**
• **Hook Power**: First 3 seconds = make them stay or lose them
• **Value Density**: Every 10 seconds must deliver new insight
• **Emotional Arc**: Build curiosity → teach → inspire → convert
• **Natural Flow**: Scenes must connect seamlessly
• **CTA Momentum**: Final scene creates irresistible urge to act

**📊 FORMAT AS JSON ARRAY:**
[
  {{
    "scene_number": 1,
    "title": "The Shocking Truth They Hide",
    "narration": "You won't believe what just happened in my latest discovery! I was scrolling through the usual content when BAM - this completely changed everything I thought about [topic]. And get this - it could transform YOUR results too!",
    "visual_description": "Dynamic opening shot with shocking text overlay, fast cuts of social media feeds, energetic music swell, close-up of surprised reaction",
    "duration_estimate": 8,
    "emphasis": "hook",
    "visual_cues": ["shocking_text", "fast_cuts", "music_swell", "reaction_shot"]
  }},
  ...
]

**🔥 SUCCESS CRITERIA:**
✅ First scene hooks in 3 seconds
✅ Each scene delivers 1-2 key insights
✅ Narration feels like talking to a friend
✅ Total story arc creates emotional journey
✅ CTA feels like the natural next step
✅ Scenes fit duration perfectly"""
    
    system_prompt = (
        "You are a master YouTube scriptwriter who creates viral, engaging content that "
        "keeps viewers watching until the end. You understand YouTube algorithm optimization, "
        "emotional storytelling, and creating irresistible hooks that make viewers hit 'like' and 'subscribe'. "
        "Your scripts are conversational, valuable, and conversion-focused."
    )
    
    try:
        response = llm_text_gen(
            prompt=scene_generation_prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            json_struct={
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "scene_number": {"type": "number"},
                        "title": {"type": "string"},
                        "narration": {"type": "string"},
                        "visual_description": {"type": "string"},
                        "duration_estimate": {"type": "number"},
                        "emphasis": {"type": "string"},
                        "visual_cues": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": [
                        "scene_number", "title", "narration", "visual_description",
                        "duration_estimate", "emphasis"
                    ]
                }
            }
        )
    except Exception as exc:
        logger.error(
            "[YouTubeSceneBuilder] llm_text_gen failed during scene generation "
            "duration=%s outline_sections=%s user=%s error=%s",
            duration_type,
            len(content_outline),
            user_id,
            str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate scenes: {str(exc)}",
        ) from exc

    try:
        scenes = _parse_scenes_response(response)
    except Exception as exc:
        logger.error(
            "[YouTubeSceneBuilder] Failed to parse scene LLM response "
            "duration=%s user=%s response_type=%s error=%s",
            duration_type,
            user_id,
            type(response).__name__,
            str(exc),
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Scene generation returned an invalid response. Please try again.",
        ) from exc

    if not scenes:
        logger.error(
            "[YouTubeSceneBuilder] LLM returned zero scenes duration=%s user=%s",
            duration_type,
            user_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Scene generation returned no scenes. Please try again.",
        )

    # Normalize scene data
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
        "[YouTubeSceneBuilder] Scene LLM generation complete "
        "duration=%s scene_count=%s user=%s",
        duration_type,
        len(normalized_scenes),
        user_id,
    )
    return normalized_scenes
