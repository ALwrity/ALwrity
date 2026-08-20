/**
 * Client-side scene-build prompt template for the Scenes step.
 * Mirrors backend scene_builder_prompts.py (no LLM call until Build Scenes).
 */

import type { VideoPlan } from "../../../services/youtubeApi";

/** Matches backend SCENE_BUILDER_SYSTEM_PROMPT in scene_builder_prompts.py */
export const SCENE_BUILDER_SYSTEM_PROMPT_PREVIEW =
  "You are a master YouTube scriptwriter who creates viral, engaging content that " +
  "keeps viewers watching until the end. You understand YouTube algorithm optimization, " +
  "emotional storytelling, and creating irresistible hooks that make viewers hit 'like' and 'subscribe'. " +
  "Your scripts are conversational, valuable, and conversion-focused.";

export function buildScenePromptPreview(plan: VideoPlan): {
  systemPrompt: string;
  userPromptTemplate: string;
} {
  const durationMetadata = plan.duration_metadata || {};
  const sceneDurationRange = durationMetadata.scene_duration_range || [5, 15];
  const hookSeconds = durationMetadata.hook_seconds ?? 10;
  const targetSeconds = durationMetadata.target_seconds ?? 150;

  const outlineLines = (plan.content_outline || [])
    .map(
      (section) =>
        `• ${section.section || ""}: ${section.description || ""} (${section.duration_estimate ?? 0}s)`,
    )
    .join("\n");

  const userPromptTemplate = `You are a top YouTube scriptwriter specializing in engaging, viral content. Create compelling scenes that captivate viewers and maximize watch time.

**VIDEO PLAN:**
📝 Summary: ${plan.video_summary || ""}
🎯 Goal: ${plan.video_goal || ""}
💡 Key Message: ${plan.key_message || ""}
🎨 Visual Style: ${plan.visual_style || "cinematic"}
🎭 Tone: ${plan.tone || "professional"}

**🎣 HOOK STRATEGY:**
${plan.hook_strategy || ""}

**📋 CONTENT STRUCTURE:**
${outlineLines || "(no outline sections yet)"}

**🚀 CALL-TO-ACTION:**
${plan.call_to_action || ""}

**⏱️ TIMING CONSTRAINTS:**
• Scene duration: ${sceneDurationRange[0]}-${sceneDurationRange[1]} seconds each
• Total target: ${targetSeconds} seconds

**🎬 YOUR MISSION - CREATE VIRAL-WORTHY SCENES:**

Write narration that:
✨ **HOOKS IMMEDIATELY** - First ${hookSeconds}s must GRAB attention
🎭 **TELLS A STORY** - Each scene advances the narrative with emotional engagement
💡 **DELIVERS VALUE** - Provide insights, tips, or "aha!" moments in every scene
🔥 **BUILDS EXCITEMENT** - Use power words, questions, and cliffhangers
👥 **CONNECTS PERSONALLY** - Speak directly to the viewer's needs and desires
⚡ **MAINTAINS PACE** - Vary sentence length for natural rhythm
🎯 **DRIVES ACTION** - Build toward the CTA with increasing urgency

**REQUIRED SCENE ELEMENTS:**
1. **scene_number**: Sequential numbering
2. **title**: Catchy, descriptive title (5-8 words max)
3. **narration**: ENGAGING spoken script with conversational hooks and transitions
4. **visual_description**: Cinematic, professional YouTube visuals
5. **duration_estimate**: Realistic speaking time
6. **emphasis**: hook/main_content/transition/cta
7. **visual_cues**: e.g. ["dramatic_zoom", "text_overlay", "fast_cuts"]

**🎯 YOUTUBE OPTIMIZATION RULES:**
• **Hook Power**: First 3 seconds = make them stay or lose them
• **Value Density**: Every 10 seconds must deliver new insight
• **Emotional Arc**: Build curiosity → teach → inspire → convert
• **Natural Flow**: Scenes must connect seamlessly
• **CTA Momentum**: Final scene creates irresistible urge to act

Structured JSON schema is applied at build time (not shown here).`;

  return {
    systemPrompt: SCENE_BUILDER_SYSTEM_PROMPT_PREVIEW,
    userPromptTemplate,
  };
}
