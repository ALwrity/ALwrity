"""
Prompt builders for POST /api/brainstorm/ideas.

Keeps LinkedIn and YouTube system/user prompts out of the API router so
brainstorm.py stays under the 500-line modular limit.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, Tuple


SUPPORTED_PLATFORMS = frozenset({"linkedin", "youtube"})


def normalize_platform(platform: Optional[str]) -> str:
    """Return canonical platform name; default linkedin when unset/blank."""
    if platform is None or not str(platform).strip():
        return "linkedin"
    return str(platform).strip().lower()


def build_linkedin_ideas_prompts(
    *,
    seed: str,
    count: int,
    sources_block: str,
    persona_block: str = "",
    platform_block: str = "",
) -> Tuple[str, str]:
    """
    Build LinkedIn brainstorm prompts.

    Must stay behaviorally identical to the historical inline prompts in
    brainstorm.py so existing LinkedIn Studio brainstorm is unchanged.
    """
    today_str = date.today().strftime("%B %d, %Y")
    sys_prompt = (
        "You are an enterprise-grade LinkedIn strategist who proposes specific, non-generic "
        "content angles that executives can immediately use as post topics. "
        "You ground every angle in real evidence from the provided web sources. "
        "You never use markdown, emojis, or bullet points in the topic headline. "
        "You prefer thought-leadership, contrarian takes backed by data, and practical playbooks. "
        f"Today's date is {today_str}. Every angle must feel current as of this date."
    )
    prompt = f"""TODAY'S DATE: {today_str}

SEED IDEA: {seed}
{persona_block}{platform_block}
RECENT WEB SOURCES (numbered list):
{sources_block}

Generate exactly {count} LinkedIn post angles in JSON.

Each angle must be a JSON object with these fields:
- prompt: short, specific headline (5-15 words, no markdown, no emojis, no bullets)
- rationale: 1-2 sentences explaining why this resonates now
- evidence: specific finding from a source above formatted as "Source [N]: <data point>", or null if none

Rules:
- Avoid: latest trends, the future of, why you should, mastering, unlocking.
- Prefer: contrarian with evidence, how-to with steps, or opinion with data.
- Every angle must feel specific to {seed}, not generic."""
    return sys_prompt, prompt


def build_youtube_ideas_prompts(
    *,
    seed: str,
    count: int,
    sources_block: str,
    channel_bible_context: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Build YouTube video-idea brainstorm prompts.

    Duration-agnostic video angles (who it's for, what they learn, CTA-friendly).
    Injects Channel Bible context when provided; does not invent a niche.
    """
    today_str = date.today().strftime("%B %d, %Y")
    bible = (channel_bible_context or "").strip()
    bible_block = f"\nCHANNEL BIBLE CONTEXT:\n{bible}\n" if bible else ""

    sys_prompt = (
        "You are an expert YouTube content strategist who proposes specific, non-generic "
        "video topic ideas creators can film immediately. "
        "You ground every idea in real evidence from the provided web sources when available. "
        "You never use markdown, emojis, or bullet points in the topic headline. "
        "You prefer clear viewer outcomes, strong hooks, and practical watch-value. "
        f"Today's date is {today_str}. Every idea must feel current as of this date."
    )
    prompt = f"""TODAY'S DATE: {today_str}

SEED IDEA: {seed}
{bible_block}
RECENT WEB SOURCES (numbered list):
{sources_block}

Generate exactly {count} YouTube video ideas in JSON.

Each idea must be a JSON object with these fields:
- prompt: short, specific video topic headline (5-15 words, no markdown, no emojis, no bullets)
- rationale: 1-2 sentences on who the video is for and what viewers will learn or do
- evidence: specific finding from a source above formatted as "Source [N]: <data point>", or null if none

Rules:
- Prefer concrete video angles (tutorial, explainer, myth-bust, case study, checklist).
- Include an implied audience and viewer outcome in the rationale.
- Keep ideas duration-agnostic (works for Shorts or longer videos).
- Make ideas CTA-friendly (subscribe, comment, try the tip) without writing the full CTA.
- Every idea must feel specific to {seed}, not generic.
- Do not write LinkedIn post angles or LinkedIn-style executive thought-leadership posts."""
    return sys_prompt, prompt
