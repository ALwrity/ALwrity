"""Pitch and expansion prompts/schemas for YouTube progressive plan generation.

Finalized GPT-OSS-120B system prompts from Issue #434. JSON shape is enforced
via json_struct passed to llm_text_gen — prompt text has no inline JSON templates.
"""

from typing import Any, Dict, Optional

from services.youtube.planner_config import (
    DEFAULT_CONTENT_LANGUAGE_LABEL,
    get_duration_context,
    get_spoken_word_budget,
    resolve_content_language,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_pitch_prompts")

PITCH_SYSTEM_PROMPT = """You are ALwrity's YouTube Script Architect. You operate as ALwrity's backend JSON engine.
The end user never writes a prompt; ALwrity injects their form fields and chosen creative angle into the user message.

MISSION: Generate ONE short, punchy video pitch. Do NOT write a full script.

RULES:
- Use the provided creative angle as the primary strategic lens.
- Ground every beat in the video idea. If research is present, use it only for factual angles — never invent statistics.
- Title: irresistible curiosity, clear payoff, ≤70 characters.
- Output: title, 2-sentence summary, hook concept (1–2 sentences), exactly the main-beat count from the user message (shorts 3, medium 4, long 5).
- Write all generated copy in the Content language from the user message. Do not mix English except proper nouns, brand names, and widely used loanwords.
- Reply with the JSON object specified by the API schema. No markdown, no commentary.
"""

EXPANSION_SYSTEM_PROMPT = """You are ALwrity's YouTube Script Architect. Expand an approved pitch into a full, production-ready YouTube script.
ALwrity injects the original idea, approved pitch, duration budget, and form context in the user message.

CORE PHILOSOPHY — EXPECTATION < REALITY: over-deliver on the title's promise.

HOOK — 5-PART director notes: (1) Context, (2) Common belief, (3) Contrarian turn, (4) Proof (research-grounded only), (5) Plan statement. Those fields are not spoken. Provide spoken_script as the only spoken hook.

BODY — VALUE LOOP per beat: Context / Application / Frame / mini_hook_out are director notes, not extra spoken copy. Only spoken_script is spoken. Order beats with escalating value.

OUTRO and CTA: spoken. They share the same word budget as the hook and beats.

PACING: estimated_duration_seconds per beat must sum to target duration (±20%). Spoken words (hook spoken_script + beat spoken_script + outro + CTA) must hit the word budget in the user message (±20%) at 150 words per minute.

OUTPUT: JSON per API schema only. Do NOT output echoed inputs (audience, tone, style, goal). Do NOT output a separate full_script — spoken parts will be assembled programmatically.
Write spoken_script, outro, CTA, titles, and other generated copy in the Content language from the user message. Do not mix English except proper nouns, brand names, and widely used loanwords.
"""


def build_pitch_json_struct() -> Dict[str, Any]:
    """Minimal pitch schema — generated assets only, no echoed Step-1 fields."""
    return {
        "type": "object",
        "properties": {
            "selected_title": {"type": "string"},
            "video_summary": {"type": "string"},
            "hook_concept": {"type": "string"},
            "main_content_beats": {
                "type": "array",
                "items": {"type": "string"},
            },
            "angle_used": {"type": "string"},
        },
        "required": [
            "selected_title",
            "video_summary",
            "hook_concept",
            "main_content_beats",
            "angle_used",
        ],
    }


def build_expansion_json_struct() -> Dict[str, Any]:
    """Script-only expansion schema. full_script is assembled in code, not by the LLM."""
    hook_properties = {
        "context": {"type": "string"},
        "common_belief": {"type": "string"},
        "contrarian_turn": {"type": "string"},
        "proof": {"type": "string"},
        "plan_statement": {"type": "string"},
        "spoken_script": {"type": "string"},
    }
    beat_properties = {
        "scene_number": {"type": "number"},
        "section_title": {"type": "string"},
        "context": {"type": "string"},
        "application": {"type": "string"},
        "frame": {"type": "string"},
        "mini_hook_out": {"type": "string"},
        "spoken_script": {"type": "string"},
        "visual": {"type": "string"},
        "estimated_duration_seconds": {"type": "number"},
    }
    return {
        "type": "object",
        "properties": {
            "hook": {
                "type": "object",
                "properties": hook_properties,
                "required": list(hook_properties.keys()),
            },
            "main_content_outline": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": beat_properties,
                    "required": list(beat_properties.keys()),
                },
            },
            "outro": {"type": "string"},
            "call_to_action": {"type": "string"},
            "key_message": {"type": "string"},
            "seo_keywords": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": [
            "hook",
            "main_content_outline",
            "outro",
            "call_to_action",
            "key_message",
            "seo_keywords",
        ],
    }


def build_content_language_prompt_block(language_code: Optional[str] = None) -> str:
    """User-message language contract. Always uses a display label, never raw hi/en only."""
    try:
        label = resolve_content_language(language_code).label
    except Exception:
        logger.exception(
            "[YouTubePlanner] Content language prompt block failed; using English"
        )
        label = DEFAULT_CONTENT_LANGUAGE_LABEL
    if label == DEFAULT_CONTENT_LANGUAGE_LABEL:
        instruction = "Write every field in English."
    else:
        instruction = (
            f"Write every field in {label}. Do not mix English except proper nouns, "
            "brand names, and widely used loanwords."
        )
    return f"**Content language:** {label}\n{instruction}"


PITCH_RESEARCH_PLACEHOLDER = "{{EXA_RESEARCH}}"
PITCH_RESEARCH_PROMPT_HEADING = "**Research (facts only — do not invent):**"


def build_pitch_research_placeholder() -> str:
    """Labeled research stand-in for preview. Does not call Exa."""
    return (
        f"{PITCH_RESEARCH_PLACEHOLDER}\n"
        "Live web research is appended here when you generate a pitch. "
        "It is not fetched for this preview."
    )


def pitch_user_prompt_non_research_prefix(user_prompt: str) -> str:
    """Pitch user prompt before the research block (placeholder or live facts)."""
    try:
        text = user_prompt if isinstance(user_prompt, str) else str(user_prompt or "")
    except Exception:
        logger.exception("[YouTubePlanner] Failed to coerce pitch prompt for prefix split")
        return ""
    if PITCH_RESEARCH_PROMPT_HEADING in text:
        return text.split(PITCH_RESEARCH_PROMPT_HEADING, 1)[0].rstrip()
    return text.rstrip()


def build_pitch_user_prompt(
    *,
    user_idea: str,
    creative_angle: str,
    duration_type: str,
    video_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    persona_context: str = "",
    channel_bible_context: str = "",
    research_context: str = "",
    source_article_title: Optional[str] = None,
    source_article_summary: Optional[str] = None,
    language: Optional[str] = None,
) -> str:
    """Lightweight user message for a single pitch. No full-script rules, no JSON example."""
    duration_context = get_duration_context(duration_type)
    budget = get_spoken_word_budget(duration_type)
    parts = [
        f'Create ONE short video pitch for: "{user_idea.strip()}"',
        "",
        f"**Creative angle (primary lens):** {creative_angle.strip()}",
        f"**Duration:** {duration_type} ({duration_context['target_seconds']}s target)",
        f"**Main beats:** exactly {budget['beat_count']} short phrases "
        f"(shorts=3, medium=4, long=5).",
        build_content_language_prompt_block(language),
    ]
    if video_type:
        parts.append(f"**Video type:** {video_type}")
    if target_audience:
        parts.append(f"**Audience (do not echo in JSON):** {target_audience}")
    if video_goal:
        parts.append(f"**Goal (do not echo in JSON):** {video_goal}")
    if brand_style:
        parts.append(f"**Style (do not echo in JSON):** {brand_style}")
    if persona_context:
        parts.extend(["", persona_context.strip()])
    if channel_bible_context:
        parts.extend(["", channel_bible_context.strip()])
    article_summary = (source_article_summary or "").strip()[:4000]
    if article_summary:
        title = (source_article_title or "").strip() or "N/A"
        parts.extend(
            [
                "",
                "**Source article (facts only — do not invent):**",
                f"- Title: {title}",
                article_summary,
            ]
        )
    if research_context:
        parts.extend(
            [
                "",
                PITCH_RESEARCH_PROMPT_HEADING,
                research_context.strip(),
            ]
        )
    parts.extend(
        [
            "",
            "Return only the schema fields: selected_title, video_summary, hook_concept, "
            f"main_content_beats (exactly {budget['beat_count']} short phrases), angle_used.",
        ]
    )
    return "\n".join(parts)


def build_expansion_user_prompt(
    *,
    user_idea: str,
    approved_pitch: Dict[str, Any],
    duration_type: str,
    video_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    persona_context: str = "",
    channel_bible_context: str = "",
    research_context: str = "",
    language: Optional[str] = None,
) -> str:
    """User message to expand an approved pitch into a production script. No JSON example."""
    duration_context = get_duration_context(duration_type)
    budget = get_spoken_word_budget(duration_type)
    beats = approved_pitch.get("main_content_beats") or []
    beat_lines = "\n".join(f"- {beat}" for beat in beats if str(beat).strip())
    parts = [
        f'Expand this approved pitch into one full YouTube script for: "{user_idea.strip()}"',
        "",
        "**Approved pitch:**",
        f"- Title: {approved_pitch.get('selected_title') or ''}",
        f"- Summary: {approved_pitch.get('video_summary') or ''}",
        f"- Hook concept: {approved_pitch.get('hook_concept') or ''}",
        f"- Angle used: {approved_pitch.get('angle_used') or approved_pitch.get('creative_angle') or ''}",
        "- Main beats:",
        beat_lines or "- (none provided)",
        "",
        f"**Duration budget:** {duration_type} — target {duration_context['target_seconds']}s "
        f"(hook {duration_context['hook_seconds']}s, main {duration_context['main_seconds']}s, "
        f"CTA {duration_context['cta_seconds']}s). Max scenes: {duration_context['max_scenes']}.",
        f"**Spoken word budget (150 WPM):** {budget['max_spoken_words']} words total (±20%) "
        f"including hook spoken_script, every beat spoken_script, outro, and CTA.",
        f"**Per-section word caps:** hook ≤{budget['hook_words']}, each beat ≤{budget['per_beat_words']}, "
        f"outro+CTA together ≤{budget['cta_outro_words']}.",
        f"**Beat count:** exactly {budget['beat_count']} outline beats.",
        "context / application / frame / mini_hook_out are director notes — do not speak them.",
        "Only spoken_script, outro, and call_to_action are spoken.",
        "Beat estimated_duration_seconds must sum to the target (±20%).",
        build_content_language_prompt_block(language),
    ]
    if video_type:
        parts.append(f"**Video type:** {video_type}")
    if target_audience:
        parts.append(f"**Audience (context only — do not echo):** {target_audience}")
    if video_goal:
        parts.append(f"**Goal (context only — do not echo):** {video_goal}")
    if brand_style:
        parts.append(f"**Style (context only — do not echo):** {brand_style}")
    if persona_context:
        parts.extend(["", persona_context.strip()])
    if channel_bible_context:
        parts.extend(["", channel_bible_context.strip()])
    if research_context:
        parts.extend(["", research_context.strip()])
    parts.extend(
        [
            "",
            "Fill hook (5-part + spoken_script), value-loop beats, outro, call_to_action, "
            "key_message, and seo_keywords. Do not output full_script or echoed Step-1 fields.",
        ]
    )
    return "\n".join(parts)


def build_pitch_preview_prompts(
    *,
    user_idea: str,
    creative_angle: str,
    duration_type: str,
    video_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    persona_context: str = "",
    channel_bible_context: str = "",
    source_article_title: Optional[str] = None,
    source_article_summary: Optional[str] = None,
    language: Optional[str] = None,
    enable_research: bool = True,
) -> Dict[str, str]:
    """Same pitch system + user builder as generate. Research is a placeholder, never Exa."""
    try:
        research_context = build_pitch_research_placeholder() if enable_research else ""
        user_prompt = build_pitch_user_prompt(
            user_idea=user_idea,
            creative_angle=creative_angle,
            duration_type=duration_type,
            video_type=video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            persona_context=persona_context,
            channel_bible_context=channel_bible_context,
            research_context=research_context,
            source_article_title=source_article_title,
            source_article_summary=source_article_summary,
            language=language,
        )
        if not (user_prompt or "").strip():
            raise ValueError("Pitch preview user prompt was empty")
        logger.info(
            "[YouTubePlanner] Pitch preview prompts built duration={} research_placeholder={} "
            "user_len={} system_len={} language_len={}",
            duration_type,
            bool(enable_research),
            len(user_prompt),
            len(PITCH_SYSTEM_PROMPT),
            len((language or "").strip()),
        )
        return {
            "system_prompt": PITCH_SYSTEM_PROMPT,
            "user_prompt": user_prompt,
        }
    except Exception:
        logger.exception(
            "[YouTubePlanner] Failed to build pitch preview prompts duration={} research={}",
            duration_type,
            bool(enable_research),
        )
        raise
