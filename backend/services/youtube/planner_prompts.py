"""Prompt and JSON-schema builders for YouTube video planning."""

from typing import Any, Dict, Optional


PLANNER_SYSTEM_PROMPT = (
    "You are an expert YouTube content strategist. Create clear, actionable video plans "
    "that are optimized for the specified video type and audience. Focus on accuracy and "
    "specificity - these plans will be used to generate actual video content."
)


def build_persona_context(persona_data: Optional[Dict[str, Any]]) -> str:
    """Build persona context string for prompts."""
    if not persona_data:
        return """
**Persona Context:**
- Using default professional tone
- No specific persona constraints
"""

    core_persona = persona_data.get("core_persona", {})
    tone = core_persona.get("tone", "professional")
    voice = core_persona.get("voice_characteristics", {})

    return f"""
**Persona Context:**
- Tone: {tone}
- Voice Style: {voice.get('style', 'professional')}
- Communication Style: {voice.get('communication_style', 'clear and direct')}
- Brand Values: {core_persona.get('core_belief', 'value-driven content')}
- Use this persona to guide the video's tone, style, and messaging approach.
"""


def build_planning_prompt(
    *,
    user_idea: str,
    duration_type: str,
    video_type: Optional[str],
    video_type_config: Dict[str, Any],
    duration_context: Dict[str, Any],
    default_audience: str,
    default_goal: str,
    default_tone: str,
    default_visual_style: str,
    brand_style: Optional[str],
    target_audience: Optional[str],
    video_goal: Optional[str],
    persona_context: str,
    persona_data: Optional[Dict[str, Any]],
    source_content_id: Optional[str],
    source_content_type: Optional[str],
    reference_image_description: Optional[str],
    research_context: str,
    include_scenes: bool,
    source_article_url: Optional[str] = None,
    source_article_title: Optional[str] = None,
    source_article_summary: Optional[str] = None,
) -> str:
    """Build the LLM planning prompt (optionally including shorts scenes)."""
    source_context = ""
    if source_content_id and source_content_type:
        source_context = f"""
**Source Content:**
- Type: {source_content_type}
- ID: {source_content_id}
- Note: This video should be based on the existing {source_content_type} content.
"""

    article_url = (source_article_url or "").strip()
    article_title = (source_article_title or "").strip()
    article_summary = (source_article_summary or "").strip()[:4000]
    source_article_context = ""
    if article_url or article_summary:
        source_article_context = f"""
**Source Article:**
- URL: {article_url or "N/A"}
- Title: {article_title or "N/A"}
- Summary:
{article_summary or "N/A"}

Plan the video from this article. Keep facts consistent with the summary. Do not invent claims that are not in the article.
"""

    image_context = ""
    if reference_image_description:
        image_context = f"""
**Reference Image:**
{reference_image_description}
- Use this as visual inspiration for the video
"""

    video_type_context = ""
    if video_type_config:
        video_type_context = f"""
**Video Type: {video_type}**
Follow these guidelines:
- Structure: {video_type_config.get('structure', '')}
- Hook: {video_type_config.get('hook_strategy', '')}
- Visual: {video_type_config.get('visual_style', '')}
- Tone: {video_type_config.get('tone', '')}
- CTA: {video_type_config.get('cta_focus', '')}
"""

    planning_prompt = f"""Create a YouTube video plan for: "{user_idea}"

**Video Format:** {video_type or 'General'} | **Duration:** {duration_type} ({duration_context['target_seconds']}s target)
**Audience:** {default_audience}
**Goal:** {default_goal}
**Style:** {brand_style or default_visual_style}

{video_type_context}

**Constraints:**
- Duration: {duration_context['target_seconds']}s (Hook: {duration_context['hook_seconds']}s, Main: {duration_context['main_seconds']}s, CTA: {duration_context['cta_seconds']}s)
- Max scenes: {duration_context['max_scenes']}

{persona_context if persona_data else ""}
{source_context if source_content_id else ""}
{source_article_context}
{image_context if reference_image_description else ""}
{research_context if research_context else ""}

**Generate a plan with:**
1. **Video Summary**: 2-3 sentences capturing the essence
2. **Target Audience**: {f"Match: {target_audience}" if target_audience else f"Infer from video idea and {video_type or 'content type'}"}
3. **Video Goal**: {f"Align with: {video_goal}" if video_goal else f"Infer appropriate goal for {video_type or 'this'} content"}
4. **Key Message**: Single memorable takeaway
5. **Hook Strategy**: Engaging opening for first {duration_context['hook_seconds']}s{f" ({video_type_config.get('hook_strategy', '')})" if video_type_config else ""}
6. **Content Outline**: 3-5 sections totaling {duration_context['target_seconds']}s{f" following: {video_type_config.get('structure', '')}" if video_type_config else ""}
7. **Call-to-Action**: Actionable CTA{f" ({video_type_config.get('cta_focus', '')})" if video_type_config else ""}
8. **Visual Style**: Match {brand_style or default_visual_style}
9. **Tone**: {default_tone}
10. **SEO Keywords**: 5-7 relevant terms based on video idea
11. **Avatar Recommendations**: {f"{video_type_config.get('avatar_style', '')} " if video_type_config else ""}matching audience and style

**Response Format (JSON):**
{{
  "video_summary": "...",
  "target_audience": "...",
  "video_goal": "...",
  "key_message": "...",
  "hook_strategy": "...",
  "content_outline": [
    {{"section": "...", "description": "...", "duration_estimate": 30}},
    {{"section": "...", "description": "...", "duration_estimate": 45}}
  ],
  "call_to_action": "...",
  "visual_style": "...",
  "tone": "...",
  "seo_keywords": ["keyword1", "keyword2", ...],
  "avatar_recommendations": {{
    "description": "...",
    "style": "...",
    "energy": "..."
  }}
}}

**Critical:** Content outline durations must sum to {duration_context['target_seconds']}s (±20%).
"""

    if include_scenes and duration_type == "shorts":
        planning_prompt += f"""

**IMPORTANT: Since this is a SHORTS video, also generate the complete scene breakdown in the same response.**

**Additional Task - Generate Detailed Scenes:**
Create detailed scenes (up to {duration_context['max_scenes']} scenes) that include:
1. Scene number and title
2. Narration text (what will be spoken) - keep it concise for shorts
3. Visual description (what viewers will see)
4. Duration estimate (2-8 seconds each)
5. Emphasis tags (hook, main_content, transition, cta)

**Scene Format:**
Each scene should be detailed enough for video generation. Total duration must fit within {duration_context['target_seconds']} seconds.

**Update JSON structure to include "scenes" array and "avatar_recommendations":**
Add a "scenes" field with the complete scene breakdown, and include "avatar_recommendations" with ideal presenter appearance, style, and energy.
"""

    return planning_prompt


def build_plan_json_struct(*, include_scenes: bool, duration_type: str) -> Dict[str, Any]:
    """Build the structured JSON schema for llm_text_gen."""
    if include_scenes and duration_type == "shorts":
        return {
            "type": "object",
            "properties": {
                "video_summary": {"type": "string"},
                "target_audience": {"type": "string"},
                "video_goal": {"type": "string"},
                "key_message": {"type": "string"},
                "hook_strategy": {"type": "string"},
                "content_outline": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "section": {"type": "string"},
                            "description": {"type": "string"},
                            "duration_estimate": {"type": "number"}
                        }
                    }
                },
                "call_to_action": {"type": "string"},
                "visual_style": {"type": "string"},
                "tone": {"type": "string"},
                "seo_keywords": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "scenes": {
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
                },
                "avatar_recommendations": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "style": {"type": "string"},
                        "energy": {"type": "string"}
                    }
                }
            },
            "required": [
                "video_summary", "target_audience", "video_goal", "key_message",
                "hook_strategy", "content_outline", "call_to_action",
                "visual_style", "tone", "seo_keywords", "scenes", "avatar_recommendations"
            ]
        }

    return {
        "type": "object",
        "properties": {
            "video_summary": {"type": "string"},
            "target_audience": {"type": "string"},
            "video_goal": {"type": "string"},
            "key_message": {"type": "string"},
            "hook_strategy": {"type": "string"},
            "content_outline": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "section": {"type": "string"},
                        "description": {"type": "string"},
                        "duration_estimate": {"type": "number"}
                    }
                }
            },
            "call_to_action": {"type": "string"},
            "visual_style": {"type": "string"},
            "tone": {"type": "string"},
            "seo_keywords": {
                "type": "array",
                "items": {"type": "string"}
            },
            "avatar_recommendations": {
                "type": "object",
                "properties": {
                    "description": {"type": "string"},
                    "style": {"type": "string"},
                    "energy": {"type": "string"}
                }
            }
        },
        "required": [
            "video_summary", "target_audience", "video_goal", "key_message",
            "hook_strategy", "content_outline", "call_to_action",
            "visual_style", "tone", "seo_keywords", "avatar_recommendations"
        ]
    }
