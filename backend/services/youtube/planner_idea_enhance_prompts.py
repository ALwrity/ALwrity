"""Prompts for YouTube Plan idea enhance (three topic choices)."""

from __future__ import annotations

from typing import Any, Dict

IDEA_ENHANCE_SYSTEM_PROMPT = """You are a YouTube Creator Studio editor.
Rewrite a creator's raw video topic into exactly three distinct, production-ready topic options.
Each option is 1–2 sentences naming what the video is about. Do not write a full script, title list, or podcast episode pitch.
Keep the creator's intent. Vary the angle (how-to, story, myth-bust) without inventing a different product or niche.
Write every option in the requested content language.
Return JSON only."""


def build_idea_enhance_json_struct() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "enhanced_ideas": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 3,
            },
            "rationales": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 3,
            },
        },
        "required": ["enhanced_ideas", "rationales"],
    }


def build_idea_enhance_user_prompt(
    *,
    user_idea: str,
    language_label: str,
    duration_description: str,
    channel_bible_context: str = "",
) -> str:
    bible = (channel_bible_context or "").strip()
    bible_block = f"\nChannel Bible (optional context):\n{bible}\n" if bible else ""
    return f"""Content language: {language_label}
Duration: {duration_description}

Original topic:
{user_idea.strip()}
{bible_block}
Return exactly 3 enhanced_ideas (strings) and exactly 3 short rationales.
Each idea must stay a topic the creator can paste into Plan Your Video, not a finished pitch."""
