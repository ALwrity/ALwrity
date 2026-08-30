from __future__ import annotations

import base64
from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException
from loguru import logger

from .client import WaveSpeedClient
from services.subscription import get_video_model_cost

INFINITALK_MODEL_PATH = "wavespeed-ai/infinitetalk"
INFINITALK_MODEL_NAME = "wavespeed-ai/infinitetalk"
MAX_DURATION_SECONDS = 600  # 10 minutes maximum duration supported by WaveSpeed per single API request
MIN_DURATION_SECONDS = 3    # Minimum billable duration (seconds)
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50MB safety cap


def _as_data_uri(content_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(content_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _generate_simple_infinitetalk_prompt(
    scene_data: Dict[str, Any],
    story_context: Dict[str, Any],
) -> Optional[str]:
    """
    Generate an enhanced prompt for InfiniteTalk video generation.
    Includes scene content, analysis, bible context, and visual elements.
    
    Returns None if no meaningful prompt can be generated.
    """
    title = (scene_data.get("title") or "").strip()
    description = (scene_data.get("description") or "").strip()
    image_prompt = (scene_data.get("image_prompt") or "").strip()
    lines = scene_data.get("lines", [])
    narration = ""
    if lines:
        # Combine first few lines for context
        narration = " ".join([str(l.get("text", "")) for l in lines[:3]])[:150]
    
    # Build enhanced prompt with multiple context sources
    parts = []
    
    # Add main scene title
    if title and len(title) > 5 and title.lower() not in ("scene", "podcast", "episode"):
        parts.append(title)
    
    # Add analysis context
    analysis = story_context.get("analysis", {})
    if analysis:
        content_type = analysis.get("content_type")
        if content_type:
            parts.append(f"Content type: {content_type}")
        
        # Add key takeaways if available
        key_takeaways = analysis.get("keyTakeaways", [])
        if key_takeaways and isinstance(key_takeaways, list) and len(key_takeaways) > 0:
            takeaway = str(key_takeaways[0])[:80]
            if takeaway:
                parts.append(f"Key insight: {takeaway}")
        
        # Audience
        audience = analysis.get("audience")
        if audience:
            short_audience = " ".join(audience.split()[:3])
            parts.append(f"Target audience: {short_audience}")
        
        # Guest info
        guest_name = analysis.get("guestName")
        guest_expertise = analysis.get("guestExpertise")
        if guest_name:
            parts.append(f"Guest: {guest_name}")
        if guest_expertise:
            parts.append(f"Expertise: {guest_expertise}")
    
    # Add bible context
    bible = story_context.get("bible", {})
    if bible:
        host_persona = bible.get("host_persona")
        tone = bible.get("tone")
        visual_style = bible.get("visual_style")
        background = bible.get("background")
        
        if host_persona:
            parts.append(f"Host persona: {host_persona}")
        if tone:
            parts.append(f"Tone: {tone}")
        if visual_style:
            parts.append(f"Visual style: {visual_style}")
        if background:
            parts.append(f"Background: {background}")
    
    # Add original image prompt as fallback context
    if image_prompt and len(parts) < 3:
        img_part = image_prompt.split('.')[0][:100].strip()
        if img_part:
            parts.append(f"Visual context: {img_part}")
    
    # Add narration snippet if available
    if narration and len(parts) < 4:
        parts.append(f"Discussing: {narration}")
    
    # Inject scene emotion and visual atmosphere — prioritize this high-value scene cue
    emotion = (scene_data.get("emotion") or "").strip().lower()
    visual_atmosphere = (scene_data.get("visual_atmosphere") or "").strip()

    mood_phrase = ""
    if emotion and visual_atmosphere:
        mood_phrase = f"Speaker appears {emotion}, {visual_atmosphere}"
    elif emotion:
        mood_phrase = f"Speaker appears {emotion}"
    elif visual_atmosphere:
        mood_phrase = visual_atmosphere

    # Build prompt: [title] -> [mood_phrase] -> [essential context] -> [quality suffix]
    quality_suffix = "Cinematic lighting, high detail, smooth motion. With subtle natural movement."
    
    # Core components guaranteed to be included
    core_parts = []
    if title and len(title) > 5 and title.lower() not in ("scene", "podcast", "episode"):
        core_parts.append(title)
    if mood_phrase:
        core_parts.append(mood_phrase)
    
    # Secondary context parts (analysis, bible, narration) - added only if budget permits
    secondary_parts = [p for p in parts if p != title]
    
    # Assemble within the 350 character cap
    assembled_parts = list(core_parts)
    # Calculate available budget for secondary context
    base_len = sum(len(p) + 2 for p in core_parts) + len(quality_suffix) + 2
    budget = 350 - base_len

    for sec in secondary_parts:
        if len(sec) + 2 <= budget:
            assembled_parts.append(sec)
            budget -= (len(sec) + 2)

    assembled_parts.append(quality_suffix)
    prompt = ". ".join(assembled_parts).strip()

    # Clean up trailing punctuation
    if prompt.endswith(","):
        prompt = prompt[:-1].strip()

    return prompt if len(prompt) >= 15 else None


def animate_scene_with_voiceover(
    *,
    image_bytes: bytes,
    audio_bytes: bytes,
    scene_data: Dict[str, Any],
    story_context: Dict[str, Any],
    user_id: str,
    resolution: str = "720p",
    prompt_override: Optional[str] = None,
    mask_image_bytes: Optional[bytes] = None,
    seed: Optional[int] = -1,
    image_mime: str = "image/png",
    audio_mime: str = "audio/mpeg",
    client: Optional[WaveSpeedClient] = None,
) -> Dict[str, Any]:
    """
    Animate a scene image with narration audio using WaveSpeed InfiniteTalk.
    Returns dict with video bytes, prompt used, model name, and cost.
    """

    if not image_bytes:
        raise HTTPException(status_code=404, detail="Scene image bytes missing for animation.")
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Scene audio bytes missing for animation.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Scene image exceeds 10MB limit required by WaveSpeed InfiniteTalk.",
        )
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Scene audio exceeds 50MB limit allowed for InfiniteTalk requests.",
        )

    if resolution not in {"480p", "720p"}:
        raise HTTPException(status_code=400, detail="Resolution must be '480p' or '720p'.")

    # Generate simple, concise prompt for InfiniteTalk (audio-driven, less need for elaborate descriptions)
    animation_prompt = prompt_override or _generate_simple_infinitetalk_prompt(scene_data, story_context)

    payload: Dict[str, Any] = {
        "image": _as_data_uri(image_bytes, image_mime),
        "audio": _as_data_uri(audio_bytes, audio_mime),
        "resolution": resolution,
    }
    # Only include prompt if we have a meaningful one (InfiniteTalk works fine without it)
    if animation_prompt:
        payload["prompt"] = animation_prompt
    if mask_image_bytes:
        payload["mask_image"] = _as_data_uri(mask_image_bytes, image_mime)
    if seed is not None:
        payload["seed"] = seed

    client = client or WaveSpeedClient()
    prediction_id = client.submit_image_to_video(INFINITALK_MODEL_PATH, payload, timeout=60)

    try:
        # Poll faster (0.5s) to mirror reference pattern; allow up to 10 minutes
        result = client.poll_until_complete(prediction_id, timeout_seconds=600, interval_seconds=0.5)
    except HTTPException as exc:
        detail = exc.detail or {}
        if isinstance(detail, dict):
            detail.setdefault("prediction_id", prediction_id)
            detail.setdefault("resume_available", True)
        raise

    outputs = result.get("outputs") or []
    if not outputs:
        raise HTTPException(status_code=502, detail="WaveSpeed InfiniteTalk completed but returned no outputs.")

    video_url = outputs[0]
    video_response = requests.get(video_url, timeout=180)
    if video_response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Failed to download InfiniteTalk video",
                "status_code": video_response.status_code,
                "response": video_response.text[:200],
            },
        )

    metadata = result.get("metadata") or {}
    duration = metadata.get("duration_seconds") or metadata.get("duration") or 0
    actual_duration = float(duration) if duration else 5.0

    cost = get_video_model_cost(
        INFINITALK_MODEL_NAME,
        duration_sec=actual_duration,
        resolution=resolution,
        default=0.30 if resolution == "720p" else 0.15,
    )

    logger.info(
        "[InfiniteTalk] Generated talking avatar video user=%s scene=%s resolution=%s duration=%.1fs cost=$%.4f size=%s bytes",
        user_id,
        scene_data.get("scene_number"),
        resolution,
        actual_duration,
        cost,
        len(video_response.content),
    )

    return {
        "video_bytes": video_response.content,
        "prompt": animation_prompt,
        "duration": actual_duration,
        "model_name": INFINITALK_MODEL_NAME,
        "cost": cost,
        "provider": "wavespeed",
        "source_video_url": video_url,
        "prediction_id": prediction_id,
    }


