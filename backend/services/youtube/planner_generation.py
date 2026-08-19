"""Attach plan-generation transparency metadata (prompt + research flags).

Does not select or override the text LLM. Routing stays in llm_text_gen.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_generation")


def configured_text_provider() -> str:
    """Return the first GPT_PROVIDER token, or a stable gateway label."""
    try:
        raw = (os.getenv("GPT_PROVIDER") or "").strip()
        if not raw:
            logger.debug("[YouTubePlanner] GPT_PROVIDER unset; using gateway label llm_text_gen")
            return "llm_text_gen"
        first = raw.split(",")[0].strip()
        return first or "llm_text_gen"
    except Exception as exc:
        logger.warning("[YouTubePlanner] Could not read GPT_PROVIDER: %s", exc)
        return "llm_text_gen"


def attach_plan_generation_metadata(
    plan_data: Optional[Dict[str, Any]],
    *,
    system_prompt: str,
    user_prompt: str,
    research_enabled: bool,
    research_context: str,
) -> Dict[str, Any]:
    """Add additive `generation` fields so the UI can show the exact LLM payload.

    Never raises: plan generation must succeed even if metadata attach fails.
    Does not log prompt bodies (length + flags only).
    """
    if not isinstance(plan_data, dict):
        logger.error(
            "[YouTubePlanner] Cannot attach generation metadata: plan_data type=%s",
            type(plan_data).__name__,
        )
        return plan_data if isinstance(plan_data, dict) else {}

    try:
        research_injected = bool((research_context or "").strip())
        system_text = system_prompt or ""
        user_text = user_prompt or ""
        provider = configured_text_provider()
        plan_data["generation"] = {
            "text_gateway": "llm_text_gen",
            "configured_provider": provider,
            "system_prompt": system_text,
            "user_prompt": user_text,
            "research_enabled": bool(research_enabled),
            "research_injected": research_injected,
            "json_schema_applied": True,
        }
        logger.info(
            "[YouTubePlanner] Generation metadata attached: "
            "provider=%s system_prompt_len=%s user_prompt_len=%s "
            "research_enabled=%s research_injected=%s",
            provider,
            len(system_text),
            len(user_text),
            bool(research_enabled),
            research_injected,
        )
    except Exception as exc:
        logger.exception(
            "[YouTubePlanner] Failed to attach generation metadata; returning plan without it: %s",
            exc,
        )
    return plan_data
