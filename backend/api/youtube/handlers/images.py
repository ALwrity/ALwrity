from pathlib import Path
"""YouTube Creator scene image generation handlers."""

from typing import Dict, Any, Optional
import uuid
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from services.database import get_db
from services.subscription import PricingService
from services.subscription.preflight_validator import validate_image_generation_operations
from services.llm_providers.main_image_generation import generate_image, generate_character_image
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger
from utils.media_utils import load_media_bytes
from ..task_manager import task_manager

router = APIRouter(tags=["youtube-image"])
logger = get_service_logger("api.youtube.image")

from ..paths import YOUTUBE_IMAGES_DIR, YOUTUBE_AVATARS_DIR, ensure_youtube_media_dirs

# Thread pool for background image generation
_image_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="youtube_image")


class YouTubeImageRequest(BaseModel):
    scene_id: str
    scene_title: Optional[str] = None
    scene_content: Optional[str] = None
    base_avatar_url: Optional[str] = None
    idea: Optional[str] = None
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    custom_prompt: Optional[str] = None
    style: Optional[str] = None  # e.g., "Realistic", "Fiction"
    rendering_speed: Optional[str] = None  # e.g., "Quality", "Turbo"
    aspect_ratio: Optional[str] = None  # e.g., "16:9"
    model: Optional[str] = None  # e.g., "ideogram-v3-turbo", "qwen-image"


def require_authenticated_user(current_user: Dict[str, Any]) -> str:
    """Extract and validate user ID from current user."""
    user_id = current_user.get("id") if current_user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(user_id)


def _load_base_avatar_bytes(avatar_url: str) -> Optional[bytes]:
    """Load base avatar bytes for character consistency."""
    # REUSE: Use centralized media loader
    avatar_bytes = load_media_bytes(avatar_url)
    
    if avatar_bytes:
        logger.info(f"[YouTube] Successfully loaded avatar from: {avatar_url}")
        return avatar_bytes
    
    logger.warning(f"[YouTube] Avatar file not found for URL: {avatar_url}")
    return None


def _save_scene_image(image_bytes: bytes, scene_id: str) -> Dict[str, str]:
    """Persist generated scene image and return file/url info."""
    unique_id = str(uuid.uuid4())[:8]
    image_filename = f"yt_scene_{scene_id}_{unique_id}.png"
    image_path = YOUTUBE_IMAGES_DIR / image_filename
    with open(image_path, "wb") as f:
        f.write(image_bytes)

    image_url = f"/api/youtube/images/scenes/{image_filename}"
    return {
        "image_filename": image_filename,
        "image_path": str(image_path),
        "image_url": image_url,
    }


class YouTubeImageTaskResponse(BaseModel):
    success: bool
    task_id: str
    message: str

@router.post("/image", response_model=YouTubeImageTaskResponse)
async def generate_youtube_scene_image(
    background_tasks: BackgroundTasks,
    request: YouTubeImageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a YouTube scene image with background task processing."""
    logger.info(f"[YouTube] Image generation request received: scene='{request.scene_title}', user={current_user.get('id')}")
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)
    logger.info(f"[YouTube] User authenticated: {user_id}")

    if not request.scene_title:
        raise HTTPException(status_code=400, detail="Scene title is required")

    try:
        # Pre-flight subscription validation
        pricing_service = PricingService(db)
        validate_image_generation_operations(
            pricing_service=pricing_service,
            user_id=user_id,
            num_images=1,
        )
        logger.info(f"[YouTube] ✅ Pre-flight validation passed for user {user_id}")

        # Create background task
        logger.info(f"[YouTube] Creating task for user {user_id}")
        task_id = task_manager.create_task("youtube_image_generation")
        logger.info(
            f"[YouTube] Created image generation task {task_id} for user {user_id}, "
            f"scene='{request.scene_title}'"
        )

        # Verify task was created
        initial_status = task_manager.get_task_status(task_id)
        if not initial_status:
            logger.error(f"[YouTube] Failed to create task {task_id} - task not found immediately after creation")
            return YouTubeImageTaskResponse(
                success=False,
                task_id="",
                message="Failed to create image generation task. Please try again."
            )

        # Add background task (pass request data, not database session)
        try:
            background_tasks.add_task(
                _execute_image_generation_task,
                task_id=task_id,
                request_data=request.dict(),  # Convert to dict for background task
                user_id=user_id,
            )
            logger.info(f"[YouTube] Background image generation task added for task {task_id}")
        except Exception as bg_error:
            logger.error(f"[YouTube] Failed to add background task for {task_id}: {bg_error}", exc_info=True)
            # Mark task as failed
            task_manager.update_task_status(
                task_id,
                "failed",
                error=str(bg_error),
                message="Failed to start image generation task"
            )
            return YouTubeImageTaskResponse(
                success=False,
                task_id="",
                message=f"Failed to start image generation task: {str(bg_error)}"
            )

        logger.info(f"[YouTube] Returning success response for task {task_id}")
        return YouTubeImageTaskResponse(
            success=True,
            task_id=task_id,
            message=f"Image generation started for '{request.scene_title}'"
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[YouTube] Failed to create image generation task: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start image generation: {str(exc)}")


def _execute_image_generation_task(task_id: str, request_data: dict, user_id: str):
    """Background task to generate YouTube scene image."""
    # Reconstruct request object from dict
    request = YouTubeImageRequest(**request_data)

    logger.info(
        f"[YouTubeImageGen] Background task started for task {task_id}, "
        f"scene='{request.scene_title}', user={user_id}"
    )

    db = None
    try:
        # Update task status to processing
        task_manager.update_task_status(
            task_id, "processing", progress=10.0, message="Preparing image generation..."
        )

        # Get database session for this background task
        from services.database import get_db
        db = next(get_db())
        logger.info(f"[YouTubeImageGen] Database session acquired for task {task_id}")

        # Load avatar if provided
        base_avatar_bytes = None
        if request.base_avatar_url:
            base_avatar_bytes = _load_base_avatar_bytes(request.base_avatar_url)
            if base_avatar_bytes:
                logger.info(f"[YouTubeImageGen] Loaded base avatar for task {task_id}")
            else:
                logger.warning(f"[YouTubeImageGen] Could not load base avatar for task {task_id}")

        # Build prompt (same logic as before)
        if base_avatar_bytes:
            prompt_parts = []
            if request.scene_title:
                prompt_parts.append(f"Scene: {request.scene_title}")
            if request.scene_content:
                content_preview = request.scene_content[:200].replace("\n", " ").strip()
                prompt_parts.append(f"Context: {content_preview}")
            if request.idea:
                prompt_parts.append(f"Video idea: {request.idea[:80].strip()}")
            prompt_parts.append("YouTube creator on camera, engaging and dynamic framing")
            prompt_parts.append("Clean background, good lighting, thumbnail-friendly composition")
            image_prompt = ", ".join(prompt_parts)
        else:
            prompt_parts = [
                "YouTube creator scene",
                "clean, modern background",
                "good lighting, high contrast for thumbnail clarity",
            ]
            if request.scene_title:
                prompt_parts.append(f"Scene theme: {request.scene_title}")
            if request.scene_content:
                prompt_parts.append(f"Context: {request.scene_content[:120].replace(chr(10), ' ')}")
            if request.idea:
                prompt_parts.append(f"Topic: {request.idea[:80]}")
            prompt_parts.append("video-optimized composition, 16:9 aspect ratio")
            image_prompt = ", ".join(prompt_parts)

        task_manager.update_task_status(
            task_id, "processing", progress=30.0, message="Generating image..."
        )

        logger.info(f"[YouTubeImageGen] Starting image generation for task {task_id}")

        # Generate image (same logic as before)
        provider = "wavespeed"
        model = "ideogram-v3-turbo"
        if base_avatar_bytes:
            logger.info(f"[YouTubeImageGen] Using character-consistent generation for task {task_id}")
            style = request.style or "Realistic"
            rendering_speed = request.rendering_speed or "Quality"
            aspect_ratio = request.aspect_ratio or "16:9"
            width = request.width or 1024
            height = request.height or 576

            try:
                # Use centralized character image generation with subscription checks and tracking
                image_bytes = generate_character_image(
                    prompt=image_prompt,
                    reference_image_bytes=base_avatar_bytes,
                    user_id=user_id,
                    style=style,
                    aspect_ratio=aspect_ratio,
                    rendering_speed=rendering_speed,
                    timeout=60,
                )
                model = "ideogram-character"
                logger.info(f"[YouTubeImageGen] Character image generation successful for task {task_id}")
            except Exception as char_error:
                logger.warning(f"[YouTubeImageGen] Character generation failed for task {task_id}: {char_error}")
                logger.info(f"[YouTubeImageGen] Falling back to regular image generation for task {task_id}")
                # Fall back to regular image generation with subscription tracking
                image_options = {
                    "provider": "wavespeed",
                    "model": request.model or "ideogram-v3-turbo",
                    "width": width,
                    "height": height,
                }
                result = generate_image(
                    prompt=image_prompt,
                    options=image_options,
                    user_id=user_id,
                )
                image_bytes = result.image_bytes
        else:
            logger.info(f"[YouTubeImageGen] Generating scene from scratch for task {task_id}")
            # Use centralized image generation with subscription tracking
            image_options = {
                "provider": "wavespeed",
                "model": request.model or "ideogram-v3-turbo",
                "width": request.width or 1024,
                "height": request.height or 576,
            }
            result = generate_image(
                prompt=request.custom_prompt or image_prompt,
                options=image_options,
                user_id=user_id,
            )
            image_bytes = result.image_bytes

        # Validate image bytes before saving
        if not image_bytes or len(image_bytes) == 0:
            raise ValueError("Image generation returned empty bytes")
        
        # Basic validation: check if it's a valid image (PNG/JPEG header)
        if not (image_bytes.startswith(b'\x89PNG') or image_bytes.startswith(b'\xff\xd8\xff')):
            logger.warning(f"[YouTubeImageGen] Generated image may not be valid PNG/JPEG for task {task_id}")
            # Don't fail - some formats might be valid, but log warning

        task_manager.update_task_status(
            task_id, "processing", progress=80.0, message="Saving image..."
        )

        # Save image with validation
        try:
            image_metadata = _save_scene_image(image_bytes, request.scene_id)
            
            # Verify file was saved correctly
            saved_path = Path(image_metadata["image_path"])
            if not saved_path.exists() or saved_path.stat().st_size == 0:
                raise IOError(f"Image file was not saved correctly: {saved_path}")
            
            logger.info(f"[YouTubeImageGen] Image saved successfully: {saved_path} ({saved_path.stat().st_size} bytes)")
        except Exception as save_error:
            logger.error(f"[YouTubeImageGen] Failed to save image for task {task_id}: {save_error}", exc_info=True)
            raise

        # Save to asset library
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="image",
                source_module="youtube_creator",
                filename=image_metadata["image_filename"],
                file_url=image_metadata["image_url"],
                file_path=image_metadata["image_path"],
                file_size=len(image_bytes),
                mime_type="image/png",
                title=f"{request.scene_title} - YouTube Scene",
                description=f"YouTube scene image for: {request.scene_title}",
                tags=["youtube_creator", "scene_image", f"scene_{request.scene_id}"],
                provider=provider,
                model=model,
                cost=0.10 if model == "ideogram-v3-turbo" else 0.05,
                asset_metadata={
                    "scene_id": request.scene_id,
                    "scene_title": request.scene_title,
                    "generation_type": "character" if base_avatar_bytes else "scene",
                    "width": request.width or 1024,
                    "height": request.height or 576,
                },
            )
        except Exception as e:
            logger.warning(f"[YouTubeImageGen] Failed to save image asset to library: {e}")

        # Success!
        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message=f"Image generated successfully for '{request.scene_title}'",
            result={
                "scene_id": request.scene_id,
                "scene_title": request.scene_title,
                "image_filename": image_metadata["image_filename"],
                "image_url": image_metadata["image_url"],
                "provider": provider,
                "model": model,
                "width": request.width or 1024,
                "height": request.height or 576,
                "file_size": len(image_bytes),
                "cost": 0.10 if model == "ideogram-v3-turbo" else 0.05,
            }
        )

        logger.info(f"[YouTubeImageGen] ✅ Task {task_id} completed successfully")

    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"[YouTubeImageGen] Task {task_id} failed: {error_msg}", exc_info=True)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Image generation failed: {error_msg}"
        )
    finally:
        if db:
            db.close()
            logger.info(f"[YouTubeImageGen] Database session closed for task {task_id}")


@router.get("/image/status/{task_id}")
async def get_image_generation_status(
    task_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get the status of an image generation task.

    Returns current progress, status, and result when complete.
    """
    require_authenticated_user(current_user)

    logger.info(f"[YouTubeAPI] Getting image generation status for task: {task_id}")
    task_status = task_manager.get_task_status(task_id)
    if task_status:
        logger.info(f"[YouTubeAPI] Task {task_id} status: {task_status.get('status', 'unknown')}, progress: {task_status.get('progress', 0)}, has_result: {'result' in task_status}")
    if not task_status:
        logger.warning(
            f"[YouTubeAPI] Image generation task {task_id} not found."
        )
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Task not found",
                "message": "The image generation task was not found. It may have expired, been cleaned up, or the server may have restarted.",
                "task_id": task_id,
                "user_action": "Please try generating the image again."
            }
        )

    return task_status


@router.get("/images/{category}/{filename}")
async def serve_youtube_image(
    category: str,
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """
    Serve stored YouTube images (avatars or scenes).
    Supports authentication via Authorization header or ?token= query parameter.
    Query parameter is required for <img> tags which cannot send custom headers.
    """
    require_authenticated_user(current_user)

    if category not in {"avatars", "scenes"}:
        raise HTTPException(status_code=400, detail="Invalid image category. Must be 'avatars' or 'scenes'")

    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    directory = YOUTUBE_AVATARS_DIR if category == "avatars" else YOUTUBE_IMAGES_DIR
    image_path = directory / filename
    
    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(
        path=str(image_path),
        media_type="image/png",
        filename=filename,
    )
