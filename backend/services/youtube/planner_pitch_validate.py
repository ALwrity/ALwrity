"""Validate YouTube pitch/expansion JSON and assemble the spoken script."""

from typing import Any, Dict, List

from services.youtube.planner_config import get_duration_context
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.planner_pitch")

PITCH_BEAT_MIN = 3
PITCH_BEAT_MAX = 5
DURATION_TOLERANCE = 0.2
ECHOED_PITCH_KEYS = ("target_audience", "tone", "visual_style", "video_goal")
HOOK_REQUIRED_KEYS = (
    "context",
    "common_belief",
    "contrarian_turn",
    "proof",
    "plan_statement",
    "spoken_script",
)
BEAT_REQUIRED_KEYS = (
    "scene_number",
    "section_title",
    "context",
    "application",
    "frame",
    "mini_hook_out",
    "spoken_script",
    "visual",
    "estimated_duration_seconds",
)


class PitchValidationError(ValueError):
    """Pitch or expansion JSON failed required-field / duration checks."""


def assemble_full_script(expansion_result: Dict[str, Any]) -> str:
    """Stitch spoken hook, beats, outro, and CTA into one script for the UI."""
    if not isinstance(expansion_result, dict):
        raise PitchValidationError("Expansion result must be an object.")

    parts: List[str] = []
    hook = expansion_result.get("hook")
    if isinstance(hook, dict):
        spoken = str(hook.get("spoken_script") or "").strip()
        if spoken:
            parts.append(spoken)

    outline = expansion_result.get("main_content_outline")
    if isinstance(outline, list):
        for beat in outline:
            if not isinstance(beat, dict):
                continue
            spoken = str(beat.get("spoken_script") or "").strip()
            if spoken:
                parts.append(spoken)

    outro = str(expansion_result.get("outro") or "").strip()
    if outro:
        parts.append(outro)
    cta = str(expansion_result.get("call_to_action") or "").strip()
    if cta:
        parts.append(cta)

    script = "\n\n".join(parts).strip()
    if not script:
        raise PitchValidationError("Could not assemble a full script from spoken parts.")
    return script


def validate_pitch(pitch: Dict[str, Any], *, creative_angle: str) -> Dict[str, Any]:
    """Require pitch assets only; strip echoed Step-1 fields. No mock fill-ins."""
    if not isinstance(pitch, dict):
        raise PitchValidationError("Pitch response must be a JSON object.")

    cleaned = {key: pitch[key] for key in pitch if key not in ECHOED_PITCH_KEYS}
    title = str(cleaned.get("selected_title") or "").strip()[:70]
    summary = str(cleaned.get("video_summary") or "").strip()
    hook = str(cleaned.get("hook_concept") or "").strip()
    raw_beats = cleaned.get("main_content_beats")
    if not isinstance(raw_beats, list):
        raise PitchValidationError("Pitch main_content_beats must be a list of 3–5 phrases.")
    beats = [str(item).strip() for item in raw_beats if str(item).strip()]
    if not (PITCH_BEAT_MIN <= len(beats) <= PITCH_BEAT_MAX):
        raise PitchValidationError(
            f"Pitch must include {PITCH_BEAT_MIN}–{PITCH_BEAT_MAX} main beats; got {len(beats)}."
        )
    if not title or not summary or not hook:
        raise PitchValidationError(
            "Pitch is missing selected_title, video_summary, or hook_concept."
        )

    angle_used = str(cleaned.get("angle_used") or "").strip() or creative_angle.strip()
    if not angle_used:
        raise PitchValidationError("Pitch is missing angle_used.")

    logger.info(
        "[YouTubePlanner] Pitch validated: title_len=%s beats=%s",
        len(title),
        len(beats),
    )
    return {
        "selected_title": title,
        "video_summary": summary,
        "hook_concept": hook,
        "main_content_beats": beats,
        "angle_used": angle_used,
    }


def validate_expansion(
    expansion: Dict[str, Any],
    *,
    duration_type: str,
) -> Dict[str, Any]:
    """Require script fields and duration sum ±20%. Does not invent missing copy."""
    if not isinstance(expansion, dict):
        raise PitchValidationError("Expansion response must be a JSON object.")

    hook = expansion.get("hook")
    if not isinstance(hook, dict):
        raise PitchValidationError("Expansion hook must be an object.")
    missing_hook = [key for key in HOOK_REQUIRED_KEYS if not str(hook.get(key) or "").strip()]
    if missing_hook:
        raise PitchValidationError(f"Expansion hook is missing: {', '.join(missing_hook)}.")

    outline = expansion.get("main_content_outline")
    if not isinstance(outline, list) or not outline:
        raise PitchValidationError("Expansion main_content_outline must be a non-empty list.")

    cleaned_beats: List[Dict[str, Any]] = []
    duration_sum = 0.0
    for index, beat in enumerate(outline):
        if not isinstance(beat, dict):
            raise PitchValidationError(f"Outline beat {index + 1} must be an object.")
        missing_beat = [
            key
            for key in BEAT_REQUIRED_KEYS
            if beat.get(key) is None or (isinstance(beat.get(key), str) and not str(beat.get(key)).strip())
        ]
        if missing_beat:
            raise PitchValidationError(
                f"Outline beat {index + 1} is missing: {', '.join(missing_beat)}."
            )
        try:
            seconds = float(beat.get("estimated_duration_seconds") or 0)
        except (TypeError, ValueError) as exc:
            raise PitchValidationError(
                f"Outline beat {index + 1} has an invalid duration."
            ) from exc
        if seconds <= 0:
            raise PitchValidationError(f"Outline beat {index + 1} duration must be > 0.")
        duration_sum += seconds
        cleaned_beats.append(beat)

    duration_context = get_duration_context(duration_type)
    target = float(duration_context["target_seconds"])
    if abs(duration_sum - target) > target * DURATION_TOLERANCE:
        raise PitchValidationError(
            f"Beat durations sum to {duration_sum:.0f}s; target is {target:.0f}s (±20%)."
        )

    outro = str(expansion.get("outro") or "").strip()
    cta = str(expansion.get("call_to_action") or "").strip()
    key_message = str(expansion.get("key_message") or "").strip()
    if not outro or not cta or not key_message:
        raise PitchValidationError("Expansion is missing outro, call_to_action, or key_message.")

    keywords = expansion.get("seo_keywords")
    if not isinstance(keywords, list):
        raise PitchValidationError("Expansion seo_keywords must be a list.")
    cleaned_keywords = [str(item).strip() for item in keywords if str(item).strip()]

    logger.info(
        "[YouTubePlanner] Expansion validated: beats=%s duration_sum=%s target=%s",
        len(cleaned_beats),
        duration_sum,
        target,
    )
    return {
        "hook": hook,
        "main_content_outline": cleaned_beats,
        "outro": outro,
        "call_to_action": cta,
        "key_message": key_message,
        "seo_keywords": cleaned_keywords,
    }
