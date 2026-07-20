"""
LinkedIn profile photo routes — upload, serve, download, and AI-enhance
profile photos. Kept separate from linkedin_social_routes.py to avoid
further growth of that module.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from loguru import logger

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])

_PROFILE_PHOTO_SUBDIR = "profile_photos"


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


def _get_profile_photos_dir(user_id: str) -> Path:
    """Get the profile photos directory for a user."""
    from services.workspace_paths import get_user_workspace_dir
    photos_dir = get_user_workspace_dir(user_id) / "media" / "linkedin" / _PROFILE_PHOTO_SUBDIR
    photos_dir.mkdir(parents=True, exist_ok=True)
    return photos_dir


def _resolve_profile_photo_path(photo_url: str, user_id: str) -> Path:
    """Resolve a local profile photo URL to an absolute file path."""
    parsed = urlparse(photo_url)
    path = parsed.path
    prefix = "/api/linkedin-social/profile-photo/"
    if not path.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid profile photo URL")
    filename = path[len(prefix):].split("?", 1)[0].strip()
    safe_name = Path(filename).name
    photos_dir = _get_profile_photos_dir(user_id)
    file_path = (photos_dir / safe_name).resolve()
    if not str(file_path).startswith(str(photos_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")
    return file_path


@router.post("/profile-photo/upload")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Upload a LinkedIn profile photo for optimization.

    Saves the image to the user's workspace and returns a local URL.
    Max file size: 5MB. Must be an image.
    """
    user_id = _user_id(current_user)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file size must be less than 5MB")

    try:
        file_ext = Path(file.filename).suffix if file.filename else ".png"
        unique_id = str(uuid.uuid4())[:8]
        filename = f"profile_photo_{unique_id}{file_ext}"
        photos_dir = _get_profile_photos_dir(user_id)
        file_path = photos_dir / filename

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        photo_url = f"/api/linkedin-social/profile-photo/{filename}"
        logger.info("[ProfilePhoto] Uploaded for user_id={}: {}", user_id, filename)

        return {"photo_url": photo_url, "filename": filename}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[ProfilePhoto] Upload failed for user_id={}: {}", user_id, exc)
        raise HTTPException(status_code=500, detail=f"Photo upload failed: {str(exc)}")


@router.get("/profile-photo/{filename:str}")
async def serve_profile_photo(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve an uploaded profile photo."""
    user_id = _user_id(current_user)
    photos_dir = _get_profile_photos_dir(user_id)
    # Prevent path traversal
    safe_name = Path(filename).name
    file_path = (photos_dir / safe_name).resolve()

    if not str(file_path).startswith(str(photos_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(file_path, media_type="image/jpeg")


@router.get("/profile-photo/download/{filename:str}")
async def download_profile_photo(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Download a profile photo with Content-Disposition header to trigger browser download."""
    user_id = _user_id(current_user)
    photos_dir = _get_profile_photos_dir(user_id)
    safe_name = Path(filename).name
    file_path = (photos_dir / safe_name).resolve()

    if not str(file_path).startswith(str(photos_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    download_filename = f"linkedin_profile_photo_{safe_name}"
    return FileResponse(
        file_path,
        media_type="image/jpeg",
        filename=download_filename,
        headers={"Content-Disposition": f'attachment; filename="{download_filename}"'},
    )


@router.post("/profile-photo/make-presentable")
async def make_profile_photo_presentable(
    photo_url: str = Form(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Transform an uploaded LinkedIn profile photo into a polished, professional headshot.

    Uses AI image editing to enhance the photo with LinkedIn-appropriate styling:
    professional attire, clean background, studio lighting, confident expression.
    """
    user_id = _user_id(current_user)
    logger.info("[ProfilePhoto/MakePresentable] Transforming photo for user_id={}: {}", user_id, photo_url)

    try:
        # Resolve the uploaded photo to bytes
        photo_path = _resolve_profile_photo_path(photo_url, user_id)
        photo_bytes = photo_path.read_bytes()
        logger.info("[ProfilePhoto/MakePresentable] Loaded {} bytes from {}", len(photo_bytes), photo_path)

        transformation_prompt = """Transform this image into a professional LinkedIn profile headshot:
- Head-and-shoulders portrait, looking directly at camera
- Professional attire (business or business casual)
- Confident, approachable, engaging expression
- Soft studio lighting with neutral or gradient background
- Clean composition, centered framing for a circular profile picture
- Maintain the person's identity and natural appearance
- Professional photography quality, suitable for a corporate or executive LinkedIn profile
- No heavy filters or unrealistic alterations"""

        from services.llm_providers.main_image_editing import edit_image

        image_options = {
            "provider": None,
            "model": None,
        }

        result = edit_image(
            input_image_bytes=photo_bytes,
            prompt=transformation_prompt,
            options=image_options,
            user_id=user_id,
        )
        logger.info("[ProfilePhoto/MakePresentable] edit_image done: provider={}, model={}", result.provider, result.model)

        # Save the transformed photo
        unique_id = str(uuid.uuid4())[:8]
        transformed_filename = f"profile_photo_transformed_{unique_id}.png"
        photos_dir = _get_profile_photos_dir(user_id)
        transformed_path = photos_dir / transformed_filename

        with open(transformed_path, "wb") as f:
            f.write(result.image_bytes)

        transformed_url = f"/api/linkedin-social/profile-photo/{transformed_filename}"
        logger.info("[ProfilePhoto/MakePresentable] Saved transformed photo: {}", transformed_path)

        return {
            "photo_url": transformed_url,
            "filename": transformed_filename,
            "message": "Profile photo transformed into professional headshot",
        }
    except HTTPException:
        raise
    except RuntimeError as rt_err:
        logger.error("[ProfilePhoto/MakePresentable] Configuration error: {}", rt_err)
        raise HTTPException(
            status_code=503,
            detail=f"Image editing service not configured: {str(rt_err)}. Please contact support.",
        )
    except Exception as exc:
        logger.error("[ProfilePhoto/MakePresentable] Transformation failed: {}", exc)
        raise HTTPException(status_code=500, detail=f"Photo transformation failed: {str(exc)}")