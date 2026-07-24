"""Prompt builder for Comment Assistant Draft with ALwrity (Issue #188)."""

from __future__ import annotations

from typing import Any, Optional

from models.linkedin_comment_assistant_draft_models import (
    CommentAssistantDraftReplyRequest,
)


COMMENT_DRAFT_SYSTEM_PROMPT = """You are ALwrity, a LinkedIn engagement assistant.
Your job is to draft a short, natural reply to a comment on the user's LinkedIn post.

Rules:
- Reply in the user's voice and tone (use the provided persona and platform voice).
- Keep it conversational, professional, and authentic.
- Acknowledge the commenter's point directly.
- Add value when possible (insight, example, or follow-up thought).
- Match the tone selected by the user.
- Do not invent facts, links, or statistics the user cannot verify.
- Do not use hashtags unless they naturally fit the conversation.
- Output ONLY valid JSON matching the requested schema.
"""


def _voice_snippet(persona_data: Optional[dict[str, Any]]) -> str:
    """Extract a short voice/persona description for the prompt."""
    if not persona_data:
        return ""
    core = persona_data.get("core_persona") or {}
    platform = persona_data.get("platform_adaptation") or {}
    parts: list[str] = []
    if core.get("voice_description"):
        parts.append(f"Voice: {core['voice_description']}")
    if platform.get("linkedin_voice"):
        parts.append(f"LinkedIn voice: {platform['linkedin_voice']}")
    if platform.get("linkedin_writing_style"):
        parts.append(f"LinkedIn style: {platform['linkedin_writing_style']}")
    if not parts and core.get("summary"):
        parts.append(f"Persona: {core['summary']}")
    return "\n".join(parts) if parts else ""


def build_comment_assistant_draft_prompt(
    request: CommentAssistantDraftReplyRequest,
    persona_data: Optional[dict[str, Any]],
    industry: str,
) -> str:
    """Build a user prompt for drafting a LinkedIn comment reply."""
    voice = _voice_snippet(persona_data)
    tone = request.tone

    lines = [
        "ORIGINAL POST:",
        request.post_text,
        "",
        "COMMENT TO REPLY TO:",
        request.comment_text,
    ]
    if request.parent_comment_text:
        lines.extend(
            [
                "",
                "PARENT COMMENT (for context):",
                request.parent_comment_text,
            ]
        )
    lines.extend(
        [
            "",
            f"TONE: {tone}",
            f"INDUSTRY: {industry}",
            f"END WITH QUESTION: {'yes' if request.include_question else 'no'}",
        ]
    )
    if voice:
        lines.extend(["", "USER VOICE:", voice])
    lines.extend(
        [
            "",
            "Return a JSON object with this exact schema:",
            '{"reply": "string", "alternative_replies": ["string", "string"]}',
            "",
            "Requirements:",
            "- 'reply' is the primary drafted reply (1-3 short paragraphs).",
            "- 'alternative_replies' is an optional array of 0-2 alternative phrasings.",
            "- Do not include markdown, emojis, or hashtags unless they fit naturally.",
        ]
    )
    return "\n".join(lines)
