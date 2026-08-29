"""Prompt templates for YouTube scene generation from a video plan."""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from services.youtube.planner_config import (
    DEFAULT_CONTENT_LANGUAGE_LABEL,
    get_spoken_word_budget,
    resolve_content_language,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_builder_prompts")

SCENE_BUILDER_SYSTEM_PROMPT = (
    "You are a master YouTube scriptwriter who creates viral, engaging content that "
    "keeps viewers watching until the end. You understand YouTube algorithm optimization, "
    "emotional storytelling, and creating irresistible hooks that make viewers hit 'like' and 'subscribe'. "
    "Your scripts are conversational, valuable, and conversion-focused."
)


def _normalize_content_outline(raw_content_outline: Any) -> List[Dict[str, Any]]:
    """Normalize plan outline items into dicts for prompt interpolation."""
    content_outline: List[Dict[str, Any]] = []
    for item in raw_content_outline or []:
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
    return content_outline


def build_scene_generation_prompts(
    video_plan: Dict[str, Any],
    duration_metadata: Dict[str, Any],
) -> Tuple[str, str]:
    """Build the system and user prompts sent to llm_text_gen for scene generation."""
    raw_content_outline = video_plan.get("content_outline", [])
    content_outline = _normalize_content_outline(raw_content_outline)

    hook_strategy = video_plan.get("hook_strategy", "")
    call_to_action = video_plan.get("call_to_action", "")
    visual_style = video_plan.get("visual_style", "cinematic")
    tone = video_plan.get("tone", "professional")
    scene_duration_range = duration_metadata.get("scene_duration_range", (5, 15))
    hook_seconds = duration_metadata.get("hook_seconds", 10)
    target_seconds = duration_metadata.get("target_seconds", 150)
    try:
        language_label = resolve_content_language(
            video_plan.get("language") if isinstance(video_plan.get("language"), str) else None
        ).label
    except Exception:
        logger.exception("[YouTubeSceneBuilder] Content language resolve failed; using English")
        language_label = DEFAULT_CONTENT_LANGUAGE_LABEL
    try:
        duration_type = str(video_plan.get("duration_type") or "medium")
        spoken_budget = get_spoken_word_budget(duration_type)
    except Exception:
        logger.exception("[YouTubeSceneBuilder] Spoken word budget failed; using medium")
        spoken_budget = get_spoken_word_budget("medium")

    outline_lines = "\n".join(
        [
            f"• {section.get('section', '')}: {section.get('description', '')} "
            f"({section.get('duration_estimate', 0)}s)"
            for section in content_outline
        ]
    )

    user_prompt = f"""You are a top YouTube scriptwriter specializing in engaging, viral content. Create compelling scenes that captivate viewers and maximize watch time.

**VIDEO PLAN:**
📝 Summary: {video_plan.get('video_summary', '')}
🎯 Goal: {video_plan.get('video_goal', '')}
💡 Key Message: {video_plan.get('key_message', '')}
🎨 Visual Style: {visual_style}
🎭 Tone: {tone}

**🎣 HOOK STRATEGY:**
{hook_strategy}

**📋 CONTENT STRUCTURE:**
{outline_lines}

**🚀 CALL-TO-ACTION:**
{call_to_action}

**⏱️ TIMING CONSTRAINTS:**
• Scene duration: {scene_duration_range[0]}-{scene_duration_range[1]} seconds each
• Total target: {target_seconds} seconds
• Spoken word budget: {spoken_budget["max_spoken_words"]} words for all narration (±20% at 150 WPM)

**🌐 CONTENT LANGUAGE:** {language_label}
Write every narration field in {language_label}. Do not rewrite the script into English.

**🎬 YOUR MISSION - CREATE VIRAL-WORTHY SCENES:**

Write narration that:
✨ **HOOKS IMMEDIATELY** - First {hook_seconds}s must GRAB attention
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

    logger.debug(
        "[YouTubeSceneBuilder] Built scene generation prompts outline_sections=%s user_prompt_len=%s",
        len(content_outline),
        len(user_prompt),
    )
    return SCENE_BUILDER_SYSTEM_PROMPT, user_prompt
