"""LinkedIn audio narration generation API routes."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from loguru import logger
from sqlalchemy.orm import Session

from api.linkedin_router_utils import (
    ERROR_CODES,
    check_rate_limit,
    error_response,
    get_db,
    log_api_request,
    resolve_linkedin_user_id,
    resolve_linkedin_user_id_optional,
)
from middleware.auth_middleware import get_current_user
from models.linkedin_models import (
    LinkedInAudioMetadata,
    LinkedInAudioNarrationRequest,
    LinkedInAudioNarrationResponse,
    LinkedInVideoScriptRequest,
)
from services.linkedin.audio import LinkedInAudioService, LinkedInAudioStorage
from services.linkedin_service import LinkedInService

router = APIRouter(prefix="/api/linkedin", tags=["linkedin-audio-generation"])

linkedin_service = LinkedInService()
linkedin_audio_service = LinkedInAudioService()
linkedin_audio_storage = LinkedInAudioStorage()


@router.post(
    "/generate-audio-narration",
    response_model=LinkedInAudioNarrationResponse,
    summary="Generate LinkedIn Audio Narration",
    description="""
    Generate professional narration audio for LinkedIn video content.

    Accepts either raw narration text or a LinkedIn video script (hook, scenes,
    conclusion). Output is optimized for LinkedIn voiceover clips (30–90 seconds)
    using WaveSpeed Minimax Speech 02 HD.
    """,
)
async def generate_audio_narration(
    request: LinkedInAudioNarrationRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    """Generate LinkedIn narration audio from text or a video script."""
    start_time = time.time()

    try:
        user_id = resolve_linkedin_user_id(current_user, http_request)

        retry_after = check_rate_limit(user_id)
        if retry_after:
            raise HTTPException(
                status_code=429,
                detail=error_response(
                    ERROR_CODES["RATE_LIMITED"],
                    f"Rate limit exceeded. Retry after {retry_after} seconds.",
                ),
                headers={"Retry-After": str(retry_after)},
            )

        tone_value = (
            request.tone.value
            if hasattr(request.tone, "value")
            else str(request.tone or "professional")
        )

        result = await linkedin_audio_service.generate_narration(
            user_id=user_id,
            text=request.text,
            video_script=request.video_script,
            target_duration_seconds=request.target_duration_seconds,
            voice_id=request.voice_id,
            custom_voice_id=request.custom_voice_id,
            speed=request.speed,
            volume=request.volume,
            pitch=request.pitch,
            emotion=request.emotion,
            tone=tone_value,
            topic=request.topic,
            industry=request.industry,
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=error_response(
                    ERROR_CODES["GENERATION_FAILED"],
                    result.get("error", "Audio generation failed"),
                ),
            )

        duration = time.time() - start_time
        background_tasks.add_task(log_api_request, http_request, db, duration, 200)

        meta = result.get("metadata") or {}
        return LinkedInAudioNarrationResponse(
            success=True,
            audio_id=result.get("audio_id"),
            download_path=result.get("download_path"),
            metadata=LinkedInAudioMetadata(**meta),
        )

    except HTTPException:
        raise
    except Exception as exc:
        duration = time.time() - start_time
        logger.error("Error generating LinkedIn audio narration: {}", exc)
        background_tasks.add_task(log_api_request, http_request, db, duration, 500)
        raise HTTPException(
            status_code=500,
            detail=error_response(
                ERROR_CODES["GENERATION_FAILED"],
                f"Failed to generate LinkedIn audio narration: {exc}",
            ),
        )


@router.post(
    "/generate-audio-from-script",
    response_model=LinkedInAudioNarrationResponse,
    summary="Generate Audio from LinkedIn Video Script Request",
    description="""
    Convenience endpoint: generate a LinkedIn video script from a topic, then
    synthesize narration audio from that script in one call.
    """,
)
async def generate_audio_from_script_request(
    request: LinkedInVideoScriptRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    """Generate video script content, then produce narration audio."""
    start_time = time.time()

    try:
        user_id = resolve_linkedin_user_id(current_user, http_request)

        script_response = await linkedin_service.generate_linkedin_video_script(request)
        if not script_response.success or not script_response.data:
            raise HTTPException(
                status_code=500,
                detail=error_response(
                    ERROR_CODES["GENERATION_FAILED"],
                    script_response.error or "Video script generation failed",
                ),
            )

        target_duration = min(max(getattr(request, "video_duration", 60), 30), 90)
        tone_value = (
            request.tone.value if hasattr(request.tone, "value") else str(request.tone)
        )

        result = await linkedin_audio_service.generate_narration(
            user_id=user_id,
            video_script=script_response.data,
            target_duration_seconds=target_duration,
            tone=tone_value,
            topic=request.topic,
            industry=request.industry,
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=error_response(
                    ERROR_CODES["GENERATION_FAILED"],
                    result.get("error", "Audio generation failed"),
                ),
            )

        duration = time.time() - start_time
        background_tasks.add_task(log_api_request, http_request, db, duration, 200)

        meta = result.get("metadata") or {}
        return LinkedInAudioNarrationResponse(
            success=True,
            audio_id=result.get("audio_id"),
            download_path=result.get("download_path"),
            metadata=LinkedInAudioMetadata(**meta),
        )

    except HTTPException:
        raise
    except Exception as exc:
        duration = time.time() - start_time
        logger.error("Error generating LinkedIn audio from script: {}", exc)
        background_tasks.add_task(log_api_request, http_request, db, duration, 500)
        raise HTTPException(
            status_code=500,
            detail=error_response(
                ERROR_CODES["GENERATION_FAILED"],
                f"Failed to generate LinkedIn audio from script: {exc}",
            ),
        )


@router.get(
    "/audio/{audio_id}",
    summary="Download LinkedIn Narration Audio",
    description="Retrieve a generated LinkedIn narration audio file by ID.",
)
async def get_linkedin_audio(
    audio_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    user_id = resolve_linkedin_user_id_optional(current_user)

    result = await linkedin_audio_storage.retrieve_audio(audio_id, user_id)
    if not result.get("success") or not result.get("audio_path"):
        raise HTTPException(status_code=404, detail="Audio not found")

    return FileResponse(
        path=result["audio_path"],
        media_type="audio/mpeg",
        filename=f"{audio_id}.mp3",
    )


@router.get(
    "/audio-status/{audio_id}",
    summary="Get LinkedIn Audio Status",
    description="Check metadata for a generated LinkedIn narration audio file.",
)
async def get_linkedin_audio_status(
    audio_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    user_id = resolve_linkedin_user_id_optional(current_user)

    metadata = await linkedin_audio_storage.get_metadata(audio_id, user_id)
    if not metadata:
        return {"success": False, "status": "not_found", "error": "Audio not found"}

    return {"success": True, "status": "completed", "metadata": metadata}


@router.delete(
    "/audio/{audio_id}",
    summary="Delete LinkedIn Narration Audio",
    description="Delete a generated LinkedIn narration audio file by ID.",
)
async def delete_linkedin_audio(
    audio_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    user_id = resolve_linkedin_user_id_optional(current_user)

    result = await linkedin_audio_storage.delete_audio(audio_id, user_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", "Audio not found"))
    return result
