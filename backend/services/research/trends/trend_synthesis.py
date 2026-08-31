"""Single-LLM synthesis of trend items into a user-facing trend report.

One ``llm_text_gen`` call (with a JSON schema) turns raw Tavily results into a
concise, actionable report — replacing the legacy per-trend LLM calls in the
trend surfer.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional

from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.research.trends.trend_provider import TrendItem, TrendPlatform

_SYNTHESIS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "trends": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "momentum": {"type": "string"},
                    "why_it_matters": {"type": "string"},
                    "suggested_angle": {"type": "string"},
                },
                "required": ["topic", "suggested_angle"],
            },
        },
    },
    "required": ["summary", "trends"],
}

_EMPTY = {"summary": "", "trends": []}


async def synthesize_trends(
    items: List[TrendItem],
    platform: TrendPlatform = TrendPlatform.WEB,
    user_id: Optional[str] = None,
    focus: str = "",
) -> Dict[str, Any]:
    """Synthesize trend items into ``{summary, trends:[{topic, momentum, why_it_matters, suggested_angle}]}``."""
    if not items:
        return _EMPTY

    prompt = _build_prompt(items, platform, focus)
    try:
        raw = await asyncio.to_thread(
            llm_text_gen,
            prompt=prompt,
            json_struct=_SYNTHESIS_SCHEMA,
            user_id=user_id,
            flow_type="trend_synthesis",
        )
    except Exception as exc:
        logger.warning(f"Trend synthesis LLM call failed: {exc}")
        return _EMPTY

    result = raw
    if isinstance(raw, str):
        try:
            result = json.loads(raw)
        except Exception:
            return _EMPTY
    if not isinstance(result, dict):
        return _EMPTY
    return result


def _build_prompt(items: List[TrendItem], platform: TrendPlatform, focus: str) -> str:
    lines: List[str] = []
    for i, item in enumerate(items[:15], 1):
        date = item.published_date or "unknown date"
        lines.append(f"{i}. {item.title} ({date}) — {item.snippet[:200]}")
    focus_line = f"Focus: {focus}" if focus else "Focus: general trend analysis"
    return (
        f"Analyze the following {platform.value} trend signals and produce a concise, "
        f"actionable report for an end user.\n"
        f"{focus_line}\n\n"
        "Trends:\n" + "\n".join(lines) + "\n\n"
        "Return JSON with a 2-3 sentence summary and a list of trends, each with topic, "
        "momentum (rising/stable/declining), why_it_matters, and suggested_angle."
    )
