"""Parse expanded fullScript into scenes with spoken-word durations and distinct visuals."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from loguru import logger

from services.youtube.planner_config import SPOKEN_WORDS_PER_MINUTE

DURATION_SUM_TOLERANCE = 0.20


def _range_bounds(scene_duration_range: Any) -> Tuple[int, int]:
    if isinstance(scene_duration_range, (list, tuple)) and len(scene_duration_range) >= 2:
        return int(scene_duration_range[0]), int(scene_duration_range[1])
    return 5, 15


def _target_seconds(duration_metadata: Dict[str, Any], duration_type: str) -> int:
    raw = duration_metadata.get("target_seconds")
    if isinstance(raw, (int, float)) and raw > 0:
        return int(raw)
    defaults = {"shorts": 30, "medium": 150, "long": 420}
    return defaults.get(duration_type, 150)


def duration_from_word_count(text: str, lo: int, hi: int) -> int:
    """Spoken-word estimate clamped to this duration's scene range."""
    words = len((text or "").split())
    raw = max(1, round(words * 60 / SPOKEN_WORDS_PER_MINUTE))
    return max(lo, min(hi, raw))


def rebalance_scene_durations(
    durations: Sequence[int],
    target_seconds: int,
    lo: int,
    hi: int,
) -> List[int]:
    """Scale then nudge durations so the sum is within ±20% of target_seconds."""
    n = len(durations)
    if n == 0:
        return []
    target = max(1, int(target_seconds))
    if sum(durations) <= 0:
        base = max(lo, min(hi, max(1, round(target / n))))
        result = [base] * n
    else:
        scale = target / sum(durations)
        result = [max(lo, min(hi, max(1, round(d * scale)))) for d in durations]

    band = target * DURATION_SUM_TOLERANCE
    for _ in range(200):
        total = sum(result)
        if abs(total - target) <= band:
            break
        if total < target:
            growable = [i for i, v in enumerate(result) if v < hi]
            if not growable:
                break
            idx = min(growable, key=lambda i: result[i])
            result[idx] += 1
        else:
            shrinkable = [i for i, v in enumerate(result) if v > lo]
            if not shrinkable:
                break
            idx = max(shrinkable, key=lambda i: result[i])
            result[idx] -= 1
    logger.debug(
        "Rebalanced {} scene durations: sum={} target={} range=[{}, {}]",
        n,
        sum(result),
        target,
        lo,
        hi,
    )
    return result


def distinct_visual(visual: str, narration: str) -> str:
    """Never copy narration into visual_prompt / visual_description."""
    vis = (visual or "").strip()
    nar = (narration or "").strip()
    if not vis or vis.lower() == nar.lower():
        return ""
    return vis


def scene_needs_visual_enhance(scene: Dict[str, Any]) -> bool:
    vis = (scene.get("visual_prompt") or scene.get("visual_description") or "").strip()
    nar = (scene.get("narration") or "").strip()
    return not vis or vis.lower() == nar.lower()


def backfill_empty_visual_prompt_from_enhance(scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Copy enhanced shot into visual_prompt when parse left it empty (hook/outro/CTA).

    Does not copy narration. Does not overwrite a distinct expand beat visual.
    """
    for scene in scenes:
        narration = str(scene.get("narration") or "")
        existing = distinct_visual(
            str(scene.get("visual_prompt") or scene.get("visual_description") or ""),
            narration,
        )
        if existing:
            continue
        shot = distinct_visual(str(scene.get("enhanced_visual_prompt") or ""), narration)
        if not shot:
            continue
        scene["visual_prompt"] = shot
        scene["visual_description"] = shot
        logger.info(
            "Backfilled empty visual_prompt from enhance scene={} prompt_len={}",
            scene.get("scene_number"),
            len(shot),
        )
    return scenes


_HOOK_SHOT_SUFFIX = (
    "Opening shot, same person, wardrobe, and location, looking toward camera."
)
_OUTRO_SHOT_SUFFIX = (
    "Same person, wardrobe, and location, winding-down medium shot."
)
_CTA_SHOT_SUFFIX = (
    "Same person, wardrobe, and location, addressing the camera for the call to action."
)
_BEAT_SHOT_SUFFIX = (
    "Same person, wardrobe, and location, this beat's action continues."
)


def _continuity_shot_suffix(scene: Dict[str, Any]) -> str:
    emphasis = str(scene.get("emphasis") or "").lower()
    title = str(scene.get("title") or "").strip().lower()
    if emphasis == "hook" or title == "hook":
        return _HOOK_SHOT_SUFFIX
    if emphasis == "cta" or "call to action" in title:
        return _CTA_SHOT_SUFFIX
    if title == "outro":
        return _OUTRO_SHOT_SUFFIX
    return _BEAT_SHOT_SUFFIX


def seed_empty_visuals_from_continuity(scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """If hook/outro/CTA still have no shot, reuse a beat visual (same world, new framing)."""
    donor = ""
    for scene in scenes:
        shot = distinct_visual(
            str(scene.get("visual_prompt") or scene.get("visual_description") or ""),
            str(scene.get("narration") or ""),
        )
        if shot:
            donor = shot
            break
    if not donor:
        logger.warning(
            "No distinct beat visual available to seed empty hook/outro/CTA prompts"
        )
        return scenes

    for scene in scenes:
        narration = str(scene.get("narration") or "")
        if distinct_visual(
            str(scene.get("visual_prompt") or scene.get("visual_description") or ""),
            narration,
        ):
            continue
        seeded = distinct_visual(f"{donor} {_continuity_shot_suffix(scene)}", narration)
        if not seeded:
            continue
        scene["visual_prompt"] = seeded
        scene["visual_description"] = seeded
        if not distinct_visual(str(scene.get("enhanced_visual_prompt") or ""), narration):
            scene["enhanced_visual_prompt"] = seeded
        logger.info(
            "Seeded empty visual_prompt from beat continuity scene={} donor_len={}",
            scene.get("scene_number"),
            len(donor),
        )
    return scenes


def finalize_youtube_scene_visuals(scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Fill visual_prompt for Assets UI: enhance first, then beat continuity."""
    backfill_empty_visual_prompt_from_enhance(scenes)
    seed_empty_visuals_from_continuity(scenes)
    return scenes


def _split_paragraphs(script: str) -> List[str]:
    return [p.strip() for p in re.split(r"\n\s*\n", script.strip()) if p.strip()]


def _build_spoken_slots(
    video_plan: Dict[str, Any],
    duration_metadata: Dict[str, Any],
) -> List[Dict[str, Any]]:
    hook_seconds = _safe_duration(duration_metadata.get("hook_seconds"), 3)
    cta_seconds = _safe_duration(duration_metadata.get("cta_seconds"), 3)
    slots: List[Dict[str, Any]] = []

    hook = str(video_plan.get("hook_strategy") or "").strip()
    if hook:
        slots.append({
            "section": "Hook",
            "description": hook,
            "duration_estimate": hook_seconds,
            "visual": "",
            "emphasis": "hook",
        })

    for item in video_plan.get("content_outline") or []:
        if not isinstance(item, dict):
            continue
        section = str(item.get("section") or "").strip() or "Beat"
        desc = str(item.get("description") or "").strip()
        slots.append({
            "section": section,
            "description": desc,
            "duration_estimate": _safe_duration(item.get("duration_estimate"), hook_seconds),
            "visual": str(item.get("visual") or "").strip(),
            "emphasis": "main_content",
        })

    outro = str(video_plan.get("outro") or "").strip()
    if outro:
        outro_dur = max(1, cta_seconds // 2)
        slots.append({
            "section": "Outro",
            "description": outro,
            "duration_estimate": outro_dur,
            "visual": "",
            "emphasis": "main_content",
        })

    cta = str(video_plan.get("call_to_action") or "").strip()
    if cta:
        remaining = max(1, cta_seconds - (cta_seconds // 2 if outro else 0))
        if not outro:
            remaining = cta_seconds
        slots.append({
            "section": "Call to action",
            "description": cta,
            "duration_estimate": remaining,
            "visual": "",
            "emphasis": "cta",
        })
    return slots


def _safe_duration(value: Any, default: int = 1) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return default


def _outline_slots(video_plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    slots: List[Dict[str, Any]] = []
    for item in video_plan.get("content_outline") or []:
        if not isinstance(item, dict):
            continue
        slots.append({
            "section": str(item.get("section") or "").strip() or "Beat",
            "description": str(item.get("description") or "").strip(),
            "duration_estimate": _safe_duration(item.get("duration_estimate"), 1),
            "visual": str(item.get("visual") or "").strip(),
            "emphasis": "main_content",
        })
    return slots


def _align_slots(
    paragraphs: List[str],
    video_plan: Dict[str, Any],
    duration_metadata: Dict[str, Any],
) -> Optional[List[Dict[str, Any]]]:
    spoken = _build_spoken_slots(video_plan, duration_metadata)
    outline = _outline_slots(video_plan)
    n = len(paragraphs)
    if spoken and n == len(spoken):
        logger.info("Custom script aligned 1:1 with hook/outline/outro/CTA slots ({})", n)
        return spoken
    if outline and n == len(outline):
        logger.info("Custom script aligned 1:1 with content_outline ({})", n)
        return outline
    logger.info(
        "Custom script paragraph count {} does not match outline {} or spoken slots {}; using WPM fallback",
        n,
        len(outline),
        len(spoken),
    )
    return None


def parse_youtube_custom_script(
    custom_script: str,
    duration_type: str,
    duration_metadata: Dict[str, Any],
    video_plan: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Turn expanded fullScript paragraphs into scene dicts (no LLM)."""
    plan = video_plan if isinstance(video_plan, dict) else {}
    lo, hi = _range_bounds(duration_metadata.get("scene_duration_range"))
    target = _target_seconds(duration_metadata, duration_type)

    script = (custom_script or "").strip()
    if not script:
        logger.warning("Empty custom_script; no scenes to parse")
        return []

    visual_pattern = re.compile(
        r"(?P<narration>.*?)(?:\nVisual:\s*(?P<visual>.*?))?(?:\n---|\Z)",
        re.DOTALL,
    )
    raw_matches = list(visual_pattern.finditer(script))
    marker_split = any(
        (m.group("visual") or "").strip() for m in raw_matches
    ) or "\nVisual:" in script or "\n---" in script

    if marker_split and raw_matches:
        parts: List[Tuple[str, str]] = []
        for match in raw_matches:
            narration = (match.group("narration") or "").strip()
            visual = (match.group("visual") or "").strip()
            if narration:
                parts.append((narration, visual))
        paragraphs = [p[0] for p in parts]
        marker_visuals = [p[1] for p in parts]
        logger.debug("Parsed custom script with Visual:/--- markers ({} parts)", len(parts))
    else:
        paragraphs = _split_paragraphs(script)
        marker_visuals = [""] * len(paragraphs)

    if not paragraphs:
        return []

    aligned = None if marker_split else _align_slots(paragraphs, plan, duration_metadata)

    scenes: List[Dict[str, Any]] = []
    raw_durations: List[int] = []
    for i, narration in enumerate(paragraphs):
        slot = aligned[i] if aligned else None
        if slot:
            title = str(slot.get("section") or "").strip() or f"Beat {i + 1}"
            duration = max(lo, min(hi, _safe_duration(slot.get("duration_estimate"), lo)))
            visual = distinct_visual(str(slot.get("visual") or ""), narration)
            emphasis = str(slot.get("emphasis") or "main_content")
        else:
            duration = duration_from_word_count(narration, lo, hi)
            visual = distinct_visual(marker_visuals[i] if i < len(marker_visuals) else "", narration)
            if i == 0:
                title = "Hook"
                emphasis = "hook"
            elif i == len(paragraphs) - 1:
                title = "Call to action"
                emphasis = "cta"
            else:
                title = f"Beat {i + 1}"
                emphasis = "main_content"
        raw_durations.append(duration)
        scenes.append({
            "scene_number": i + 1,
            "title": title,
            "narration": narration,
            "visual_description": visual,
            "visual_prompt": visual,
            "on_screen_text": "",
            "duration_estimate": duration,
            "emphasis": emphasis,
            "visual_cues": [],
        })

    balanced = rebalance_scene_durations(raw_durations, target, lo, hi)
    for scene, dur in zip(scenes, balanced):
        scene["duration_estimate"] = dur

    logger.info(
        "Parsed custom script into {} scenes duration_type={} duration_sum={} target={}",
        len(scenes),
        duration_type,
        sum(balanced),
        target,
    )
    return scenes
