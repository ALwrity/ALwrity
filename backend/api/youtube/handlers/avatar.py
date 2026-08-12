"""YouTube Creator avatar upload and AI optimization handlers."""

import json
import uuid
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from services.database import get_db
from services.llm_providers.main_image_editing import edit_image
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger

from ..paths import YOUTUBE_AVATARS_DIR, ensure_youtube_media_dirs
from .avatar_generation import _generate_avatar_from_context

router = APIRouter(prefix="/avatar", tags=["youtube-avatar"])
logger = get_service_logger("api.youtube.avatar")


def require_authenticated_user(current_user: Dict[str, Any]) -> str:
    """Extract and validate user ID from current user."""
    user_id = current_user.get("id") if current_user else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(user_id)


def _load_youtube_image_bytes(image_url: str) -> bytes:
    """Load avatar bytes from a stored YouTube avatar URL."""
    filename = image_url.split("/")[-1].split("?")[0]
    image_path = YOUTUBE_AVATARS_DIR / filename
    if not image_path.exists() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Avatar image not found")
    return image_path.read_bytes()


@router.post("/upload")
async def upload_youtube_avatar(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a YouTube creator avatar image."""
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_content = await file.read()

    # Validate size (max 5MB)
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file size must be less than 5MB")

    try:
        file_ext = Path(file.filename).suffix or ".png"
        unique_id = str(uuid.uuid4())[:8]
        avatar_filename = f"yt_avatar_{project_id or 'temp'}_{unique_id}{file_ext}"
        avatar_path = YOUTUBE_AVATARS_DIR / avatar_filename

        with open(avatar_path, "wb") as f:
            f.write(file_content)

        avatar_url = f"/api/youtube/images/avatars/{avatar_filename}"
        logger.info(f"[YouTube] Avatar uploaded: {avatar_path}")

        if project_id:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="image",
                    source_module="youtube_creator",
                    filename=avatar_filename,
                    file_url=avatar_url,
                    file_path=str(avatar_path),
                    file_size=len(file_content),
                    mime_type=file.content_type or "image/png",
                    title=f"YouTube Creator Avatar - {project_id}",
                    description="YouTube creator avatar image",
                    tags=["youtube", "avatar", project_id],
                    asset_metadata={
                        "project_id": project_id,
                        "type": "creator_avatar",
                        "status": "completed",
                    },
                )
            except Exception as e:
                logger.warning(f"[YouTube] Failed to save avatar asset: {e}")

        return {
            "avatar_url": avatar_url,
            "avatar_filename": avatar_filename,
            "message": "Avatar uploaded successfully",
        }
    except Exception as exc:
        logger.error(f"[YouTube] Avatar upload failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar upload failed: {str(exc)}")


@router.post("/make-presentable")
async def make_avatar_presentable(
    avatar_url: str = Form(...),
    project_id: Optional[str] = Form(None),
    video_type: Optional[str] = Form(None),
    target_audience: Optional[str] = Form(None),
    video_goal: Optional[str] = Form(None),
    brand_style: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Transform an uploaded avatar image into a YouTube-appropriate creator.
    Uses AI image editing with enhanced prompts to optimize the uploaded photo.
    """
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)

    try:
        avatar_bytes = _load_youtube_image_bytes(avatar_url)
        logger.info(f"[YouTube] 🔍 Starting avatar transformation for user_id={user_id}, project={project_id}")
        logger.info(f"[YouTube] Transforming avatar for project {project_id}")

        # Build context-aware transformation prompt using user inputs
        prompt_parts = [
            "Transform this photo into a professional YouTube creator avatar:",
            "Significantly enhance and optimize the image for YouTube video production;",
            "Apply professional photo editing: improve lighting, color grading, and composition;",
            "Enhance facial features: brighten eyes, smooth skin, add professional makeup if needed;",
            "Improve background: replace with clean, professional studio background or subtle gradient;",
            "Adjust clothing: ensure professional, YouTube-appropriate attire;",
            "Optimize for video: ensure the person looks natural and engaging on camera;",
            "Half-length portrait format, person looking directly at camera with confident, engaging expression;",
            "Professional studio lighting with soft shadows, high-quality photography;",
            "Maintain the person's core appearance and identity while making significant improvements;",
            "Ultra realistic, 4k quality, professional photography style;",
            "Suitable for video generation, thumbnails, and YouTube channel branding."
        ]

        # Add context from user inputs to make transformation more targeted
        if video_type:
            video_type_lower = video_type.lower()
            if video_type_lower == "tutorial":
                prompt_parts.append("Approachable instructor style, professional yet friendly appearance")
            elif video_type_lower == "review":
                prompt_parts.append("Trustworthy reviewer style, confident and credible appearance")
            elif video_type_lower == "educational":
                prompt_parts.append("Knowledgeable educator style, professional and warm appearance")
            elif video_type_lower == "entertainment":
                prompt_parts.append("Energetic creator style, expressive and fun appearance")
            elif video_type_lower == "vlog":
                prompt_parts.append("Authentic vlogger style, approachable and relatable appearance")
            elif video_type_lower == "product_demo":
                prompt_parts.append("Professional presenter style, polished and enthusiastic appearance")
            elif video_type_lower == "reaction":
                prompt_parts.append("Expressive creator style, authentic and engaging appearance")
            elif video_type_lower == "storytelling":
                prompt_parts.append("Storyteller style, warm and engaging narrator appearance")

        if target_audience:
            audience_lower = target_audience.lower()
            if "young" in audience_lower or "gen z" in audience_lower or "millennial" in audience_lower:
                prompt_parts.append("Modern, youthful, vibrant aesthetic")
            elif "executive" in audience_lower or "professional" in audience_lower or "business" in audience_lower:
                prompt_parts.append("Polished, credible, authoritative professional appearance")
            elif "creative" in audience_lower:
                prompt_parts.append("Artistic, expressive, creative professional style")

        if brand_style:
            style_lower = brand_style.lower()
            if "minimal" in style_lower or "minimalist" in style_lower:
                prompt_parts.append("Clean, minimalist aesthetic")
            if "tech" in style_lower or "modern" in style_lower:
                prompt_parts.append("Tech-forward, modern style")
            if "energetic" in style_lower or "colorful" in style_lower:
                prompt_parts.append("Vibrant, energetic appearance")

        base_prompt = " ".join(prompt_parts)

        # Optimize the prompt using WaveSpeed prompt optimizer for better results
        try:
            from services.wavespeed.client import WaveSpeedClient
            wavespeed_client = WaveSpeedClient()
            logger.info(f"[YouTube] Optimizing transformation prompt using WaveSpeed prompt optimizer")
            transformation_prompt = wavespeed_client.optimize_prompt(
                text=base_prompt,
                mode="image",
                style="realistic",  # Use realistic style for photo editing
                enable_sync_mode=True,
                timeout=30
            )
            logger.info(f"[YouTube] Prompt optimized successfully (length: {len(transformation_prompt)} chars)")
        except Exception as opt_error:
            logger.warning(f"[YouTube] Prompt optimization failed, using base prompt: {opt_error}")
            transformation_prompt = base_prompt

        # Use HuggingFace for image editing (only available option)
        # Note: This uses async processing with polling (~30 seconds expected)
        image_options = {
            "provider": "huggingface",  # Explicitly use HuggingFace (only option for image editing)
            "model": None,  # Use default model (Qwen/Qwen-Image-Edit)
        }

        logger.info(f"[YouTube] Starting avatar transformation (this may take ~30 seconds due to async processing)")
        result = edit_image(
            input_image_bytes=avatar_bytes,
            prompt=transformation_prompt,
            options=image_options,
            user_id=user_id,
        )
        logger.info(f"[YouTube] ✅ Avatar transformation completed successfully")

        unique_id = str(uuid.uuid4())[:8]
        transformed_filename = f"yt_presenter_{project_id or 'temp'}_{unique_id}.png"
        transformed_path = YOUTUBE_AVATARS_DIR / transformed_filename

        with open(transformed_path, "wb") as f:
            f.write(result.image_bytes)

        transformed_url = f"/api/youtube/images/avatars/{transformed_filename}"
        logger.info(f"[YouTube] Transformed avatar saved to: {transformed_path}")

        if project_id:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="image",
                    source_module="youtube_creator",
                    filename=transformed_filename,
                    file_url=transformed_url,
                    file_path=str(transformed_path),
                    file_size=len(result.image_bytes),
                    mime_type="image/png",
                    title=f"YouTube Creator (Transformed) - {project_id}",
                    description="AI-transformed YouTube creator avatar from uploaded photo",
                    prompt=transformation_prompt,
                    tags=["youtube", "avatar", "presenter", project_id],
                    provider=result.provider,
                    model=result.model,
                    asset_metadata={
                        "project_id": project_id,
                        "type": "transformed_presenter",
                        "original_avatar_url": avatar_url,
                        "status": "completed",
                    },
                )
            except Exception as e:
                logger.warning(f"[YouTube] Failed to save transformed avatar asset: {e}")

        return {
            "avatar_url": transformed_url,
            "avatar_filename": transformed_filename,
            "message": "Avatar transformed successfully",
        }
    except Exception as exc:
        logger.error(f"[YouTube] Avatar transformation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar transformation failed: {str(exc)}")


@router.post("/generate")
async def generate_creator_avatar(
    project_id: Optional[str] = Form(None),
    audience: Optional[str] = Form(None),
    content_type: Optional[str] = Form(None),
    video_plan_json: Optional[str] = Form(None),
    brand_style: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Auto-generate a YouTube creator avatar optimized from video plan context.

    Uses video plan data (if provided) and user inputs to generate an avatar that matches
    the video type, audience, tone, and brand style.
    """
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)

    try:
        return await _generate_avatar_from_context(
            user_id=user_id,
            project_id=project_id,
            audience=audience,
            content_type=content_type,
            video_plan_json=video_plan_json,
            brand_style=brand_style,
            db=db,
        )
    except Exception as exc:
        logger.error(f"[YouTube] Avatar generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar generation failed: {str(exc)}")


@router.post("/regenerate")
async def regenerate_creator_avatar(
    video_plan_json: str = Form(...),
    project_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Regenerate a YouTube creator avatar using the same video plan context.

    Takes the video plan JSON and regenerates an avatar with a different seed
    to provide variation while maintaining the same optimization based on plan data.
    """
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)

    try:
        plan_data = json.loads(video_plan_json)

        # Extract context from plan data
        audience = plan_data.get("target_audience", "")
        content_type = plan_data.get("video_type", "")
        brand_style = plan_data.get("visual_style", "")

        logger.info(
            f"[YouTube] Regenerating avatar for project {project_id}: "
            f"video_type={content_type}, audience={audience[:50] if audience else 'none'}"
        )

        avatar_response = await _generate_avatar_from_context(
            user_id=user_id,
            project_id=project_id,
            audience=audience,
            content_type=content_type,
            video_plan_json=video_plan_json,
            brand_style=brand_style,
            db=db,
        )

        # Return the avatar prompt along with the URL for the frontend
        return {
            "avatar_url": avatar_response.get("avatar_url"),
            "avatar_filename": avatar_response.get("avatar_filename"),
            "avatar_prompt": avatar_response.get("avatar_prompt"),
            "message": "Avatar regenerated successfully",
        }
    except Exception as exc:
        logger.error(f"[YouTube] Avatar regeneration failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar regeneration failed: {str(exc)}")
