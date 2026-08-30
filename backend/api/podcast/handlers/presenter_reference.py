"""
Podcast Presenter Reference Image Handler

Generates (or retrieves) a single base reference image for the episode presenter.
This image is used as the image-to-image anchor for all scene generations,
eliminating per-scene character / skin-tone drift.
"""

import base64
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pathlib import Path

from services.database import get_db
from middleware.auth_middleware import get_current_user
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_image_generation import generate_image
from loguru import logger
from ..constants import get_podcast_media_dir
from ..models import PresenterReferenceRequest, PresenterReferenceResponse

# Re-use character-lock helpers from images module (same package, no circular import)
from .images import (
    _is_concrete_anchor,
    _resolve_or_create_character_lock,
    _get_session_key,
)

router = APIRouter()

# Filename template: deterministic per project, so re-generation always overwrites the same file.
_REF_FILENAME_TPL = "presenter_ref_{project_id}.png"


def _build_reference_prompt(character_desc: str) -> str:
    parts = [
        f"Host Appearance: {character_desc}, identical natural skin tone, same locked wardrobe and outfit",
        "Professional podcast recording studio",
        "Modern minimalist studio background with soft depth of field",
        "Neutral relaxed expression, direct camera eye contact",
        "Medium shot, chest-up portrait, generous headroom above hair",
        "Entire head and complete hairstyle fully visible with clearance above the frame",
        "Shoulders and chest visible, not cropped",
        "Consistent calibrated studio key lighting, natural skin exposure, 5600K daylight balanced white balance",
        "Even fill lighting, no harsh shadows on face",
        "16:9 aspect ratio optimized for video",
        "Center-focused composition for talking avatar overlay",
        "High resolution, sharp focus, professional photography quality",
        "No text, no logos, no distracting elements",
        "Realistic photography style, not illustration or cartoon",
        "Professional broadcast quality",
    ]
    return ", ".join(parts)


@router.post("/presenter-reference", response_model=PresenterReferenceResponse)
async def generate_presenter_reference(
    request: PresenterReferenceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = require_authenticated_user(current_user)

    try:
        from services.podcast_schema_utils import ensure_podcast_projects_columns
        ensure_podcast_projects_columns(db)
    except Exception:
        pass

    project_id = request.project_id.strip() if request.project_id else f"podcast_{int(time.time() * 1000)}_{uuid.uuid4().hex[:4]}"
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    from models.podcast_models import PodcastProject

    project = db.query(PodcastProject).filter(
        PodcastProject.user_id == user_id,
        PodcastProject.project_id == project_id,
    ).first()

    # If project doesn't exist yet, it's being generated from the creator form draft phase.
    images_dir = get_podcast_media_dir("image", user_id, ensure_exists=True)
    ref_filename = _REF_FILENAME_TPL.format(project_id=project_id)
    ref_path = images_dir / ref_filename
    ref_url = f"/api/podcast/images/{ref_filename}"

    # Return cached reference if it already exists and file is still on disk (unless force_regenerate)
    if not request.force_regenerate and request.style_index is None:
        db_ref_url = getattr(project, "presenter_reference_url", None) if project else None
        if (db_ref_url or ref_path.exists()) and ref_path.exists():
            logger.info(f"[PresenterRef] Returning cached reference for project {project_id}: {ref_url}")
            return PresenterReferenceResponse(project_id=project_id, reference_url=ref_url, was_cached=True)

    styles = [
        "East Asian male tech lead, early 30s, clean-shaven, sharp structured jawline, neat short black hair with a subtle side part, warm dark eyes, wearing a tailored navy blazer over a crisp white collared shirt",
        "South Asian female tech entrepreneur, early 30s, warm almond eyes, defined cheekbones, sleek shoulder-length dark hair tucked behind ears, wearing a tailored dark emerald blazer over a cream blouse",
        "Hispanic male tech host, early 30s, neatly trimmed light stubble beard, strong square jawline, short textured dark brown hair, wearing a structured charcoal blazer over a white open-collar shirt",
        "Caucasian female podcast host, early 30s, distinct hazel eyes, clear facial structure, shoulder-length wavy honey brown hair, wearing a tailored midnight blue blazer over a silk ivory top",
        "Black male tech innovator, early 30s, clean-shaven, sharp defined jawline, short neat fade haircut, expressive confident eyes, wearing a tailored navy suit jacket over a crisp white shirt",
    ]

    # Resolve character-lock description
    character_desc = None
    if request.style_index is not None:
        character_desc = styles[request.style_index % len(styles)]
        # Update session cache with selected style
        from .images import _CHARACTER_LOCK_CACHE
        session_key = f"{user_id}:{project_id}"
        _CHARACTER_LOCK_CACHE[session_key] = {
            "description": character_desc,
            "created_at": time.time(),
        }
    else:
        bible_obj = None
        try:
            from services.podcast_bible_service import PodcastBibleService
            bible_service = PodcastBibleService()

            class _FakeRequest:
                project_id = request.project_id
                bible = request.bible
                idea = request.idea

            fake_req = _FakeRequest()
            bible_obj, _ = bible_service.get_or_build_bible(user_id, request.bible, "temp_ref")
            character_desc = _resolve_or_create_character_lock(user_id, fake_req, bible_obj, db)
        except Exception as exc:
            logger.warning(f"[PresenterRef] Bible/character-lock error (non-fatal): {exc}")

    if not character_desc:
        import hashlib
        seed_val = int(hashlib.md5(f"{user_id}:{project_id}".encode()).hexdigest()[:8], 16)
        character_desc = styles[seed_val % len(styles)]

    # If project exists, sync character look to bible
    if project:
        try:
            bible_data = dict(project.bible) if project.bible and isinstance(project.bible, dict) else {}
            host_data = dict(bible_data.get("host", {}))
            host_data["look"] = character_desc
            bible_data["host"] = host_data
            project.bible = bible_data
        except Exception as sync_err:
            logger.warning(f"[PresenterRef] Could not sync look to project bible: {sync_err}")

    ref_prompt = _build_reference_prompt(character_desc)
    logger.info(f"[PresenterRef] Generating reference image for project {project_id} (prompt_len={len(ref_prompt)})")

    # Pre-flight subscription check
    try:
        from services.subscription import PricingService
        from services.subscription.preflight_validator import validate_image_generation_operations
        pricing_service = PricingService(db)
        validate_image_generation_operations(pricing_service=pricing_service, user_id=user_id, num_images=1)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"[PresenterRef] Pre-flight check non-fatal error: {exc}")

    # Generate image (Path B FLUX)
    try:
        image_options = {
            "provider": None,
            "width": 1024,
            "height": 1024,
            "negative_prompt": (
                "cropped head, cropped face, cut off forehead, cut off chin, out of frame, "
                "close-up crop, extreme close-up, distorted features, extra limbs, disfigured, "
                "low quality, blurry, watermark, text, logo"
            ),
        }
        result = generate_image(prompt=ref_prompt, options=image_options, user_id=user_id)
    except HTTPException:
        raise
    except Exception as gen_err:
        logger.error(f"[PresenterRef] Image generation failed: {gen_err}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail={"error": "Presenter reference image generation failed", "message": str(gen_err), "retry_recommended": True},
        )

    # Save to disk
    with open(ref_path, "wb") as f:
        f.write(result.image_bytes)

    logger.info(f"[PresenterRef] Saved reference image: {ref_path}")

    # Persist URL to DB if project exists
    if project:
        try:
            project.presenter_reference_url = ref_url
            db.commit()
            logger.info(f"[PresenterRef] Updated presenter_reference_url in DB for project {project_id}")
        except Exception as db_err:
            logger.warning(f"[PresenterRef] DB update non-fatal error: {db_err}")
            try:
                db.rollback()
            except Exception:
                pass

    return PresenterReferenceResponse(project_id=project_id, reference_url=ref_url, was_cached=False)

