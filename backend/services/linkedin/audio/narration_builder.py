"""
LinkedIn narration text builder.

Pure functions for assembling speakable narration from raw text or video script
structures, with LinkedIn-appropriate duration targeting (60–90 seconds).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

# ~150 words/minute ≈ 2.5 words/sec; average English word ≈ 5 chars → ~12.5 chars/sec.
_CHARS_PER_SECOND = 12.5
_LINKEDIN_MIN_DURATION = 30
_LINKEDIN_MAX_DURATION = 90
_DEFAULT_TARGET_DURATION = 75


def estimate_spoken_duration_seconds(text: str, speed: float = 1.0) -> float:
    """Estimate narration duration from character count and speech speed."""
    if not text:
        return 0.0
    effective_cps = _CHARS_PER_SECOND * max(speed, 0.5)
    return len(text.strip()) / effective_cps


def max_chars_for_duration(target_duration_seconds: int, speed: float = 1.0) -> int:
    """Return a safe character budget for a target spoken duration."""
    clamped = max(_LINKEDIN_MIN_DURATION, min(_LINKEDIN_MAX_DURATION, target_duration_seconds))
    effective_cps = _CHARS_PER_SECOND * max(speed, 0.5)
    return int(clamped * effective_cps)


def trim_to_char_budget(text: str, max_chars: int) -> str:
    """Trim text to a character budget without cutting mid-word when possible."""
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return text

    trimmed = text[:max_chars].rstrip()
    last_space = trimmed.rfind(" ")
    if last_space > max_chars * 0.6:
        trimmed = trimmed[:last_space].rstrip()
    return trimmed.rstrip(".,;:!?")


def build_narration_from_video_script(
    script: Union[Dict[str, Any], Any],
    *,
    include_conclusion: bool = True,
    target_duration_seconds: int = _DEFAULT_TARGET_DURATION,
    speed: float = 1.0,
) -> str:
    """
    Build speakable narration from a LinkedIn video script structure.

    Accepts a VideoScript model instance or dict with hook, main_content, conclusion.
    """
    if hasattr(script, "model_dump"):
        data = script.model_dump()
    elif isinstance(script, dict):
        data = script
    else:
        raise ValueError("video_script must be a dict or VideoScript model")

    parts: List[str] = []

    hook = (data.get("hook") or "").strip()
    if hook:
        parts.append(hook)

    for scene in data.get("main_content") or []:
        if isinstance(scene, dict):
            content = (scene.get("content") or "").strip()
        else:
            content = str(scene).strip()
        if content:
            parts.append(content)

    if include_conclusion:
        conclusion = (data.get("conclusion") or "").strip()
        if conclusion:
            parts.append(conclusion)

    narration = " ".join(parts)
    char_budget = max_chars_for_duration(target_duration_seconds, speed)
    return trim_to_char_budget(narration, char_budget)


def build_narration_text(
    *,
    text: Optional[str] = None,
    video_script: Optional[Union[Dict[str, Any], Any]] = None,
    target_duration_seconds: int = _DEFAULT_TARGET_DURATION,
    speed: float = 1.0,
) -> str:
    """
    Build final narration text from either raw text or a video script.

    Raises ValueError when neither input is provided or the result is empty.
    """
    if video_script is not None:
        narration = build_narration_from_video_script(
            video_script,
            target_duration_seconds=target_duration_seconds,
            speed=speed,
        )
    elif text and text.strip():
        char_budget = max_chars_for_duration(target_duration_seconds, speed)
        narration = trim_to_char_budget(text.strip(), char_budget)
    else:
        raise ValueError("Either text or video_script must be provided")

    if not narration.strip():
        raise ValueError("Narration text is empty after processing")

    return narration
