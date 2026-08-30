"""Normalize WaveSpeed/LLM visual-enhance JSON into 0-based scene prompts."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_enhance_response")


def _youtube_enhance_items(response: Any) -> List[Any]:
    if isinstance(response, str):
        try:
            response = json.loads(response)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.warning("[YouTubeSceneBuilder] Enhance response was not JSON: {}", exc)
            return []
    if isinstance(response, dict):
        for key in ("enhanced_prompts", "scenes", "items", "data"):
            nested = response.get(key)
            if isinstance(nested, list):
                return nested
        return []
    if isinstance(response, list):
        return response
    logger.warning(
        "[YouTubeSceneBuilder] Unexpected enhance response type={}",
        type(response).__name__,
    )
    return []


def _youtube_enhance_index(raw: Any, scene_count: int, one_based: bool) -> Optional[int]:
    try:
        idx = int(float(raw))
    except (TypeError, ValueError):
        return None
    if one_based:
        idx -= 1
    if 0 <= idx < scene_count:
        return idx
    return None


def map_youtube_enhance_response(
    response: Any,
    scene_data_list: List[Dict[str, Any]],
) -> Dict[int, str]:
    """Map LLM enhance output to 0-based scene indexes. Accepts dicts or strings."""
    scene_count = len(scene_data_list)
    items = _youtube_enhance_items(response)
    numeric_ids: List[int] = []
    for item in items:
        if isinstance(item, dict):
            raw = item.get("scene_index", item.get("scene_number"))
            try:
                numeric_ids.append(int(float(raw)))
            except (TypeError, ValueError):
                continue
    one_based = bool(numeric_ids) and 0 not in numeric_ids and all(
        1 <= value <= scene_count for value in numeric_ids
    )

    result: Dict[int, str] = {}
    for seq, item in enumerate(items):
        prompt = ""
        raw_idx: Any = seq
        if isinstance(item, str):
            prompt = item.strip()
        elif isinstance(item, dict):
            prompt = str(item.get("enhanced_prompt") or item.get("prompt") or "").strip()
            raw_idx = item.get("scene_index", item.get("scene_number", seq))
        else:
            logger.warning(
                "[YouTubeSceneBuilder] Skipping enhance item type={}",
                type(item).__name__,
            )
            continue
        idx = _youtube_enhance_index(raw_idx, scene_count, one_based)
        if idx is None or not prompt:
            continue
        result[idx] = prompt

    for idx, scene in enumerate(scene_data_list):
        if idx not in result:
            result[idx] = str(scene.get("image_prompt") or scene.get("description") or "")
    logger.debug(
        "[YouTubeSceneBuilder] Mapped enhance items={} filled={} one_based={}",
        len(items),
        sum(1 for text in result.values() if text.strip()),
        one_based,
    )
    return result
