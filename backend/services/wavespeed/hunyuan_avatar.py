"""
Hunyuan Avatar Service

Service for creating talking avatars using Hunyuan Avatar model.
Reference: https://wavespeed.ai/models/wavespeed-ai/hunyuan-avatar
"""

from __future__ import annotations

import base64
from typing import Any, Dict, Optional

import requests
from fastapi import HTTPException
from loguru import logger

from .client import WaveSpeedClient
from services.subscription import get_video_model_cost

HUNYUAN_AVATAR_MODEL_PATH = "wavespeed-ai/hunyuan-avatar"
HUNYUAN_AVATAR_MODEL_NAME = "wavespeed-ai/hunyuan-avatar"
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50MB safety cap
MAX_DURATION_SECONDS = 120  # 2 minutes maximum
MIN_DURATION_SECONDS = 5  # Minimum billable duration


def _as_data_uri(content_bytes: bytes, mime_type: str) -> str:
    """Convert bytes to data URI."""
    encoded = base64.b64encode(content_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def calculate_hunyuan_avatar_cost(resolution: str, duration: float) -> float:
    """
    Calculate cost for Hunyuan Avatar video from pricing.yaml.
    
    Pricing:
    - 480p: $0.15 per 5 seconds
    - 720p: $0.30 per 5 seconds
    - Minimum charge: 5 seconds
    - Maximum billable: 120 seconds
    
    Args:
        resolution: Output resolution (480p or 720p)
        duration: Video duration in seconds
        
    Returns:
        Cost in USD
    """
    return get_video_model_cost(
        f"hunyuan-avatar-{resolution}",
        duration_sec=duration,
        resolution=resolution,
        default=0.15 if resolution == "480p" else 0.30,
    )


def create_hunyuan_avatar(
    *,
    image_bytes: bytes,
    audio_bytes: bytes,
    resolution: str = "480p",
    prompt: Optional[str] = None,
    seed: Optional[int] = None,
    user_id: str = "video_studio",
    image_mime: str = "image/png",
    audio_mime: str = "audio/mpeg",
    client: Optional[WaveSpeedClient] = None,
    progress_callback: Optional[callable] = None,
) -> Dict[str, Any]:
    """
    Create talking avatar video using Hunyuan Avatar.
    
    Reference: https://wavespeed.ai/docs/docs-api/wavespeed-ai/hunyuan-avatar
    
    Args:
        image_bytes: Portrait image as bytes
        audio_bytes: Audio file as bytes
        resolution: Output resolution (480p or 720p, default: 480p)
        prompt: Optional text to guide expression or style
        seed: Optional random seed (-1 for random)
        user_id: User ID for tracking
        image_mime: MIME type of image
        audio_mime: MIME type of audio
        client: Optional WaveSpeedClient instance
        progress_callback: Optional progress callback function
        
    Returns:
        Dictionary with video_bytes, prompt, duration, model_name, cost, etc.
    """
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image bytes are required for Hunyuan Avatar.")
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio bytes are required for Hunyuan Avatar.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image exceeds {MAX_IMAGE_BYTES / (1024 * 1024):.0f}MB limit required by Hunyuan Avatar.",
        )
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Audio exceeds {MAX_AUDIO_BYTES / (1024 * 1024):.0f}MB limit allowed for Hunyuan Avatar requests.",
        )

    if resolution not in {"480p", "720p"}:
        raise HTTPException(status_code=400, detail="Resolution must be '480p' or '720p'.")

    # Build payload
    payload: Dict[str, Any] = {
        "image": _as_data_uri(image_bytes, image_mime),
        "audio": _as_data_uri(audio_bytes, audio_mime),
        "resolution": resolution,
    }
    
    if prompt:
        payload["prompt"] = prompt.strip()
    if seed is not None:
        payload["seed"] = seed

    client = client or WaveSpeedClient()
    
    # Progress callback: submission
    if progress_callback:
        progress_callback(10.0, "Submitting Hunyuan Avatar request to WaveSpeed...")
    
    prediction_id = client.submit_image_to_video(HUNYUAN_AVATAR_MODEL_PATH, payload, timeout=60)

    try:
        # Poll for completion
        if progress_callback:
            progress_callback(20.0, f"Polling for completion (prediction_id: {prediction_id})...")
        
        result = client.poll_until_complete(
            prediction_id,
            timeout_seconds=600,  # 10 minutes max
            interval_seconds=0.5,  # Poll every 0.5 seconds
            progress_callback=progress_callback,
        )
    except HTTPException as exc:
        detail = exc.detail or {}
        if isinstance(detail, dict):
            detail.setdefault("prediction_id", prediction_id)
            detail.setdefault("resume_available", True)
        raise

    outputs = result.get("outputs") or []
    if not outputs:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Hunyuan Avatar completed but returned no outputs",
                "prediction_id": prediction_id,
            }
        )

    video_url = outputs[0]
    if not isinstance(video_url, str) or not video_url.startswith("http"):
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"Invalid video URL format: {video_url}",
                "prediction_id": prediction_id,
            }
        )

    # Progress callback: downloading video
    if progress_callback:
        progress_callback(90.0, "Downloading generated video...")

    # Download video
    try:
        video_response = requests.get(video_url, timeout=180)
        if video_response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Failed to download Hunyuan Avatar video",
                    "status_code": video_response.status_code,
                    "response": video_response.text[:200],
                    "prediction_id": prediction_id,
                }
            )
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail={
                "error": f"Failed to download video: {str(e)}",
                "prediction_id": prediction_id,
            }
        )

    video_bytes = video_response.content
    if len(video_bytes) == 0:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Downloaded video is empty",
                "prediction_id": prediction_id,
            }
        )

    # Estimate duration (we don't get exact duration from API, so estimate from audio or use default)
    # For now, we'll use a default estimate - in production, you might want to analyze the audio file
    estimated_duration = 10.0  # Default estimate
    
    # Calculate cost
    cost = calculate_hunyuan_avatar_cost(resolution, estimated_duration)

    # Get video dimensions from resolution
    resolution_dims = {
        "480p": (854, 480),
        "720p": (1280, 720),
    }
    width, height = resolution_dims.get(resolution, (854, 480))

    # Extract metadata
    metadata = result.get("metadata", {})
    metadata.update({
        "has_nsfw_contents": result.get("has_nsfw_contents", []),
        "created_at": result.get("created_at"),
        "resolution": resolution,
        "max_duration": MAX_DURATION_SECONDS,
    })

    logger.info(
        f"[Hunyuan Avatar] ✅ Generated video: {len(video_bytes)} bytes, "
        f"resolution={resolution}, cost=${cost:.2f}"
    )

    # Progress callback: completed
    if progress_callback:
        progress_callback(100.0, "Avatar generation completed!")

    return {
        "video_bytes": video_bytes,
        "prompt": prompt or "",
        "duration": estimated_duration,
        "model_name": HUNYUAN_AVATAR_MODEL_NAME,
        "cost": cost,
        "provider": "wavespeed",
        "resolution": resolution,
        "width": width,
        "height": height,
        "metadata": metadata,
        "source_video_url": video_url,
        "prediction_id": prediction_id,
    }
