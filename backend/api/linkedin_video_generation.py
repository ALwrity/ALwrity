import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from loguru import logger

from services.linkedin.video_generation import LinkedInVideoGenerator, LinkedInVideoStorage
from services.linkedin.video_generation.tasks import execute_linkedin_video_generation_task
from services.onboarding.api_key_manager import APIKeyManager
from middleware.auth_middleware import get_current_user
from api.story_writer.task_manager import task_manager

router = APIRouter(prefix="/api/linkedin", tags=["linkedin-video-generation"])

api_key_manager = APIKeyManager()
video_generator = LinkedInVideoGenerator(api_key_manager)
video_storage = LinkedInVideoStorage(api_key_manager=api_key_manager)


class VideoGenerationRequest(BaseModel):
    prompt: str
    content_context: Dict[str, Any]
    aspect_ratio: Optional[str] = "16:9"
    duration: Optional[int] = Field(default=5, ge=5, le=10)
    resolution: Optional[str] = "720p"
    motion_preset: Optional[str] = "medium"
    model: Optional[str] = None


class VideoGenerationStartResponse(BaseModel):
    task_id: str
    status: str
    message: str


@router.post("/generate-video", response_model=VideoGenerationStartResponse)
async def generate_linkedin_video(
    request: VideoGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Start async LinkedIn video generation from selected content context."""
    try:
        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt is required")

        logger.info(
            f"[LinkedInVideoGen] Request user={user_id} model={request.model or 'default'} "
            f"prompt_len={len(request.prompt)}"
        )

        task_id = task_manager.create_task(
            "linkedin_video_generation",
            metadata={"owner_user_id": user_id},
        )

        background_tasks.add_task(
            execute_linkedin_video_generation_task,
            task_id=task_id,
            user_id=user_id,
            prompt=request.prompt,
            content_context=request.content_context,
            aspect_ratio=request.aspect_ratio or "16:9",
            duration=request.duration or 5,
            resolution=request.resolution or "720p",
            motion_preset=request.motion_preset or "medium",
            model=request.model,
        )

        return VideoGenerationStartResponse(
            task_id=task_id,
            status="pending",
            message=(
                f"LinkedIn video generation started. "
                f"Poll /api/linkedin/video-generation/{task_id}/status for updates."
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start LinkedIn video generation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start video generation: {e}",
        )


@router.get("/video-generation/{task_id}/status")
async def get_video_generation_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Poll LinkedIn video generation task status."""
    try:
        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        status = task_manager.get_task_status(task_id, requester_user_id=user_id)
        if not status:
            raise HTTPException(status_code=404, detail="Task not found or expired")

        return status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking video generation status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {e}")


@router.get("/videos/{video_id}")
async def get_generated_video(
    video_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve a generated LinkedIn video by ID."""
    try:
        user_id = current_user.get("id")
        video_result = await video_storage.retrieve_video(video_id, user_id)

        if video_result.get("success") and video_result.get("video_path"):
            return FileResponse(
                path=video_result["video_path"],
                media_type="video/mp4",
                filename=f"{video_id}.mp4",
            )
        raise HTTPException(status_code=404, detail="Video not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving LinkedIn video: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve video: {e}")


@router.get("/video-generation-health")
async def video_generation_health_check():
    """Lightweight health check for LinkedIn video generation services."""
    try:
        services: Dict[str, Any] = {}
        all_healthy = True

        video_api_key = (
            api_key_manager.get_api_key("video_generation")
            or os.getenv("WAVESPEED_API_KEY")
            or os.getenv("HF_TOKEN")
        )
        services["video_api_key_configured"] = bool(video_api_key)

        stats = await video_storage.get_storage_stats()
        storage_ok = stats.get("success", False)
        services["video_storage"] = "operational" if storage_ok else "unavailable"
        if storage_ok:
            services["storage_stats"] = {
                "total_videos": stats.get("total_files", 0),
                "total_size_gb": stats.get("total_size_gb", 0),
            }

        gen_ok = video_generator is not None and hasattr(video_generator, "generate_video")
        services["video_generator"] = "operational" if gen_ok else "unavailable"

        if not all(v == "operational" or v is True for v in services.values()):
            all_healthy = False

        return {"status": "healthy" if all_healthy else "degraded", "services": services}
    except Exception as e:
        logger.error(f"Video health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}
