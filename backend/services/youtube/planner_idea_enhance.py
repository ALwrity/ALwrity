"""Enhance a Plan Your Video topic into three distinct choices."""

from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from services.llm_providers.json_parsing import robust_json_loads
from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.planner_config import get_duration_context, resolve_content_language
from services.youtube.planner_idea_enhance_prompts import (
    IDEA_ENHANCE_SYSTEM_PROMPT,
    build_idea_enhance_json_struct,
    build_idea_enhance_user_prompt,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_idea_enhance")

FLOW_TYPE = "youtube_plan_idea_enhance"


class IdeaEnhanceError(Exception):
    """LLM returned an unusable enhance payload."""


def _idea_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("idea", "text", "topic", "enhanced_idea"):
            text = value.get(key)
            if isinstance(text, str) and text.strip():
                return text.strip()
    return ""


def parse_enhanced_idea_payload(payload: Any) -> Dict[str, List[str]]:
    """Require exactly three non-empty ideas. Do not invent fallback copies."""
    data: Any = payload
    if isinstance(payload, str):
        try:
            data = robust_json_loads(payload)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            logger.error("[YouTubePlanIdeaEnhance] JSON parse failed err={}", exc)
            raise IdeaEnhanceError("Failed to parse enhanced topic response as JSON.") from exc
    if not isinstance(data, dict):
        raise IdeaEnhanceError("Enhanced topic response must be a JSON object.")
    if data.get("error") and "enhanced_ideas" not in data:
        raise IdeaEnhanceError("Enhanced topic LLM response was empty or invalid JSON.")

    raw_ideas = data.get("enhanced_ideas")
    if not isinstance(raw_ideas, list) or len(raw_ideas) != 3:
        logger.warning(
            "[YouTubePlanIdeaEnhance] Expected 3 ideas; got count={}",
            len(raw_ideas) if isinstance(raw_ideas, list) else None,
        )
        raise IdeaEnhanceError("Expected exactly 3 enhanced ideas.")

    ideas = [_idea_text(item) for item in raw_ideas]
    if any(not idea for idea in ideas):
        raise IdeaEnhanceError("Each enhanced idea must be a non-empty string.")

    raw_rationales = data.get("rationales")
    if not isinstance(raw_rationales, list):
        raw_rationales = []
    rationales: List[str] = []
    for index in range(3):
        value = raw_rationales[index] if index < len(raw_rationales) else ""
        rationales.append(value.strip() if isinstance(value, str) else "")

    logger.info("[YouTubePlanIdeaEnhance] Parsed 3 enhanced ideas")
    return {"enhanced_ideas": ideas, "rationales": rationales}


def enhance_youtube_plan_idea(
    *,
    user_idea: str,
    duration_type: Optional[str] = None,
    language: Optional[str] = None,
    channel_bible_context: str = "",
    user_id: Optional[str] = None,
) -> Dict[str, List[str]]:
    """Call llm_text_gen and return three topic choices."""
    idea = (user_idea or "").strip()
    if not idea:
        raise IdeaEnhanceError("A video topic is required.")

    resolved = resolve_content_language(language)
    duration_key = duration_type if duration_type in ("shorts", "medium", "long") else "medium"
    duration_ctx = get_duration_context(duration_key)
    prompt = build_idea_enhance_user_prompt(
        user_idea=idea,
        language_label=resolved.label,
        duration_description=str(duration_ctx.get("description") or duration_key),
        channel_bible_context=channel_bible_context or "",
    )
    prompt_token_est = max(1, (len(prompt) + len(IDEA_ENHANCE_SYSTEM_PROMPT)) // 4)
    started = time.perf_counter()
    logger.info(
        "[YouTubePlanIdeaEnhance] LLM start flow_type={} idea_len={} language={} "
        "duration={} has_bible={} prompt_token_est={}",
        FLOW_TYPE,
        len(idea),
        resolved.code,
        duration_key,
        bool((channel_bible_context or "").strip()),
        prompt_token_est,
    )
    try:
        response = llm_text_gen(
            prompt=prompt,
            system_prompt=IDEA_ENHANCE_SYSTEM_PROMPT,
            user_id=user_id,
            json_struct=build_idea_enhance_json_struct(),
            flow_type=FLOW_TYPE,
        )
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.exception(
            "[YouTubePlanIdeaEnhance] LLM failed duration_ms={}",
            elapsed_ms,
        )
        raise IdeaEnhanceError("Could not enhance this topic. Please try again.") from exc

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    logger.info(
        "[YouTubePlanIdeaEnhance] LLM complete duration_ms={} language={}",
        elapsed_ms,
        resolved.code,
    )
    if isinstance(response, dict) and response.get("error") and "raw_response" in response:
        response = response.get("raw_response")
    return parse_enhanced_idea_payload(response)
