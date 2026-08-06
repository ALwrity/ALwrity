"""
Podcast Avatar Handlers

Avatar upload and presenter generation endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pathlib import Path
import uuid
import hashlib

from services.database import get_db, get_session_for_user
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_image_generation import generate_image
from services.llm_providers.main_image_editing import edit_image
from utils.asset_tracker import save_asset_to_library
from models.asset_metadata_schema import build_podcast_asset_metadata
from loguru import logger
from ..constants import get_podcast_media_dir, PODCAST_AVATARS_SUBDIR
from ..presenter_personas import choose_persona_id, get_persona

router = APIRouter()

# Avatar subdirectory
AVATAR_SUBDIR = PODCAST_AVATARS_SUBDIR


async def _get_db_or_none(current_user: Dict[str, Any]):
    """Try to get a database session, returning None on failure (non-fatal for uploads)."""
    try:
        user_id = current_user.get('id') or current_user.get('clerk_user_id')
        if not user_id:
            return None
        return get_session_for_user(user_id)
    except Exception as e:
        logger.warning(f"[Podcast] DB session unavailable (non-fatal): {e}")
        return None


def _get_podcast_avatars_dir(user_id: str) -> Path:
    """Get podcast avatars directory for a user (workspace-aware)."""
    avatars_dir = get_podcast_media_dir("image", user_id, ensure_exists=True) / AVATAR_SUBDIR
    avatars_dir.mkdir(parents=True, exist_ok=True)
    return avatars_dir


@router.post("/avatar/upload")
async def upload_podcast_avatar(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a presenter avatar image for a podcast project.
    Returns the avatar URL for use in scene image generation.
    """
    try:
        user_id = require_authenticated_user(current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Podcast] Avatar upload auth failed: {e}", exc_info=True)
        raise HTTPException(status_code=401, detail="Authentication failed")

    logger.info(f"[Podcast] Avatar upload request - user_id={user_id}, project_id={project_id}, content_type={file.content_type}")

    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image file size must be less than 5MB")
    
    try:
        # Generate filename
        file_ext = Path(file.filename).suffix or '.png'
        unique_id = str(uuid.uuid4())[:8]
        avatar_filename = f"avatar_{project_id or 'temp'}_{unique_id}{file_ext}"
        avatars_dir = _get_podcast_avatars_dir(user_id)
        logger.info(f"[Podcast] Saving avatar to: {avatars_dir / avatar_filename}")
        avatar_path = avatars_dir / avatar_filename
        
        # Save file
        with open(avatar_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"[Podcast] Avatar uploaded successfully: {avatar_path}")
        
        # Create avatar URL
        avatar_url = f"/api/podcast/images/{AVATAR_SUBDIR}/{avatar_filename}"
        
        # Save to asset library if project_id provided and DB session available
        if project_id and db:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="image",
                    source_module="podcast_maker",
                    filename=avatar_filename,
                    file_url=avatar_url,
                    file_path=str(avatar_path),
                    file_size=len(file_content),
                    mime_type=file.content_type,
                    title=f"Podcast Presenter Avatar - {project_id}",
                    description="Podcast presenter avatar image",
                    tags=["podcast", "avatar", project_id],
                    asset_metadata=build_podcast_asset_metadata(
                        asset_role="presenter_avatar",
                        project_id=project_id,
                        origin="podcast.avatar.upload",
                    ),
                )
            except Exception as e:
                logger.warning(f"[Podcast] Failed to save avatar asset (non-fatal): {e}")
        elif project_id and not db:
            logger.warning(f"[Podcast] DB session unavailable, skipping asset library save for avatar")
        
        return {
            "avatar_url": avatar_url,
            "avatar_filename": avatar_filename,
            "message": "Avatar uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Podcast] Avatar upload failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar upload failed: {str(exc)}")


@router.post("/avatar/make-presentable")
async def make_avatar_presentable(
    avatar_url: str = Form(...),
    project_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Transform an uploaded avatar image into a podcast-appropriate presenter.
    Uses AI image editing to convert the uploaded photo into a professional podcast presenter.
    """
    # CRITICAL: Log at the very start before any logic
    logger.info(f"[Podcast] ===== MAKE PRESENTABLE ENDPOINT START =====")
    
    user_id = require_authenticated_user(current_user)
    logger.info(f"[Podcast] Make presentable request received - user_id={user_id}, avatar_url={avatar_url}, project_id={project_id}")
    
    try:
        # Load the uploaded avatar image
        from ..utils import load_podcast_image_bytes
        logger.info(f"[Podcast] Loading avatar image from {avatar_url}")
        avatar_bytes = load_podcast_image_bytes(avatar_url, user_id=user_id)
        logger.info(f"[Podcast] Avatar loaded successfully - size={len(avatar_bytes)} bytes")
        
        logger.info(f"[Podcast] Transforming avatar to podcast presenter for project {project_id}")
        
        # Create transformation prompt based on WaveSpeed AI recommendations
        # Transform the uploaded image into a professional podcast presenter
        transformation_prompt = """Transform this image into a professional podcast presenter:
- Half-length portrait format, looking at camera
- Professional attire (white shirt and light gray blazer or business casual)
- Confident, friendly, engaging expression
- Soft studio lighting, plain light-gray or neutral background
- Professional podcast host appearance, suitable for video generation
- Clean composition, center-focused for avatar overlay
- Maintain the person's appearance and identity while making it podcast-appropriate
- Ultra realistic, 4k quality, professional photography style"""
        
        # Transform the image using image editing
        image_options = {
            "provider": None,  # Auto-select provider
            "model": None,  # Use default model
        }
        
        logger.info(f"[Podcast] Calling edit_image with user_id={user_id}")
        try:
            result = edit_image(
                input_image_bytes=avatar_bytes,
                prompt=transformation_prompt,
                options=image_options,
                user_id=user_id
            )
            logger.info(f"[Podcast] edit_image completed successfully - provider={result.provider}, model={result.model}")
        except Exception as edit_err:
            logger.error(f"[Podcast] edit_image failed: {edit_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Image editing failed: {str(edit_err)}")
        
        # Save transformed avatar
        unique_id = str(uuid.uuid4())[:8]
        transformed_filename = f"presenter_transformed_{project_id or 'temp'}_{unique_id}.png"
        avatars_dir = _get_podcast_avatars_dir(user_id)
        transformed_path = avatars_dir / transformed_filename
        
        with open(transformed_path, "wb") as f:
            f.write(result.image_bytes)
        
        transformed_url = f"/api/podcast/images/{AVATAR_SUBDIR}/{transformed_filename}"
        
        logger.info(f"[Podcast] Transformed avatar saved to: {transformed_path}")
        
        # Save to asset library
        if project_id:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="image",
                    source_module="podcast_maker",
                    filename=transformed_filename,
                    file_url=transformed_url,
                    file_path=str(transformed_path),
                    file_size=len(result.image_bytes),
                    mime_type="image/png",
                    title=f"Podcast Presenter (Transformed) - {project_id}",
                    description="AI-transformed podcast presenter avatar from uploaded photo",
                    prompt=transformation_prompt,
                    tags=["podcast", "avatar", "presenter", "transformed", project_id],
                    provider=result.provider,
                    model=result.model,
                    asset_metadata=build_podcast_asset_metadata(
                        asset_role="transformed_presenter",
                        project_id=project_id,
                        origin="podcast.avatar.make_presentable",
                        extras={"original_avatar_url": avatar_url},
                    ),
                )
            except Exception as e:
                logger.warning(f"[Podcast] Failed to save transformed avatar asset: {e}")
        
        return {
            "avatar_url": transformed_url,
            "avatar_filename": transformed_filename,
            "message": "Avatar transformed into podcast presenter successfully"
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except RuntimeError as rt_err:
        # Handle missing API keys or configuration errors
        logger.error(f"[Podcast] Avatar transformation configuration error: {rt_err}")
        raise HTTPException(
            status_code=503,  # Service Unavailable
            detail=f"Image editing service not configured: {str(rt_err)}. Please contact support."
        )
    except Exception as exc:
        logger.error(f"[Podcast] Avatar transformation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Avatar transformation failed: {str(exc)}")


@router.post("/avatar/generate")
async def generate_podcast_presenters(
    speakers: int = Form(...),
    project_id: Optional[str] = Form(None),
    audience: Optional[str] = Form(None),
    content_type: Optional[str] = Form(None),
    top_keywords: Optional[str] = Form(None),  # JSON string array
    persona_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate presenter avatar images based on number of speakers and AI analysis insights.
    Uses analysis data (audience, content_type, keywords) to create more relevant presenters.
    Returns list of avatar URLs.
    Based on WaveSpeed AI recommendations for professional podcast presenters.
    """
    user_id = require_authenticated_user(current_user)
    
    if speakers < 1 or speakers > 2:
        raise HTTPException(status_code=400, detail="Speakers must be between 1 and 2")
    
    try:
        # Parse keywords if provided
        keywords_list = []
        if top_keywords:
            try:
                import json
                keywords_list = json.loads(top_keywords) if isinstance(top_keywords, str) else top_keywords
            except:
                keywords_list = []
        
        # Choose persona (market-fit + style) using analysis if not explicitly provided.
        # Do not infer sensitive traits (like ethnicity); personas represent market + style only.
        selected_persona_id = persona_id or choose_persona_id(
            audience=audience,
            content_type=content_type,
            top_keywords=keywords_list,
        )
        persona = get_persona(selected_persona_id)

        generated_avatars = []
        
        for i in range(speakers):
            # Generate presenter-specific prompt based on WaveSpeed AI recommendations
            # Enhanced with analysis insights for more relevant presenter appearance
            gender = "female" if i == 0 else "male"  # First speaker female, second male
            
            # Build context-aware prompt using analysis insights + persona preset
            prompt_parts = [
                f"Half-length portrait of a professional podcast presenter ({gender}, 25-35 years old)",
                "photo-realistic, professional photography",
            ]

            if persona:
                prompt_parts.append(persona.prompt)
            
            # Use content_type to influence attire/style
            if content_type:
                content_lower = content_type.lower()
                if "business" in content_lower or "corporate" in content_lower:
                    prompt_parts.append("business professional attire (white shirt and light gray blazer)")
                elif "casual" in content_lower or "conversational" in content_lower:
                    prompt_parts.append("business casual attire (smart casual, approachable)")
                elif "tech" in content_lower or "technology" in content_lower:
                    prompt_parts.append("modern professional attire (tech-forward, contemporary style)")
                else:
                    prompt_parts.append("professional attire (white shirt and light gray blazer or business casual)")
            else:
                prompt_parts.append("professional attire (white shirt and light gray blazer or business casual)")
            
            # Use audience to influence expression and style
            if audience:
                audience_lower = audience.lower()
                if "young" in audience_lower or "millennial" in audience_lower or "gen z" in audience_lower:
                    prompt_parts.append("modern, energetic, approachable expression")
                elif "executive" in audience_lower or "professional" in audience_lower or "business" in audience_lower:
                    prompt_parts.append("confident, authoritative, professional expression")
                else:
                    prompt_parts.append("confident, friendly, engaging expression")
            else:
                prompt_parts.append("confident, friendly expression")
            
            # Add keywords context if available (for visual style hints)
            if keywords_list and len(keywords_list) > 0:
                # Extract visual-relevant keywords
                visual_keywords = [k for k in keywords_list[:3] if any(word in k.lower() for word in ["tech", "business", "creative", "modern", "professional"])]
                if visual_keywords:
                    prompt_parts.append(f"context: {', '.join(visual_keywords[:2])}")
            
            # Technical requirements
            prompt_parts.extend([
                "looking at camera",
                "soft studio lighting, plain light-gray or neutral background",
                "ultra realistic, 4k quality, 85mm lens, f/2.8",
                "professional podcast host appearance, suitable for video generation",
                "clean composition, center-focused for avatar overlay"
            ])
            
            prompt = ", ".join(prompt_parts)
            
            logger.info(f"[Podcast] Generating presenter {i+1}/{speakers} for project {project_id}")
            
            # Generate image
            # Use a deterministic seed per (project_id, speaker_number, persona_id) to keep presenter identity stable.
            # Note: determinism may vary by provider/model, but seed improves consistency substantially.
            seed_source = f"{project_id or 'temp'}|speaker={i+1}|persona={selected_persona_id}"
            seed = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest()[:8], 16)
            image_options = {
                "provider": None,  # Auto-select provider
                "width": 1024,
                "height": 1024,
                "seed": seed,
            }
            
            result = generate_image(
                prompt=prompt,
                options=image_options,
                user_id=user_id
            )
            
            # Save avatar
            unique_id = str(uuid.uuid4())[:8]
            avatar_filename = f"presenter_{project_id or 'temp'}_{i+1}_{unique_id}.png"
            avatars_dir = _get_podcast_avatars_dir(user_id)
            avatar_path = avatars_dir / avatar_filename
            
            with open(avatar_path, "wb") as f:
                f.write(result.image_bytes)
            
            avatar_url = f"/api/podcast/images/{AVATAR_SUBDIR}/{avatar_filename}"
            
            # Save to asset library
            if project_id:
                try:
                    save_asset_to_library(
                        db=db,
                        user_id=user_id,
                        asset_type="image",
                        source_module="podcast_maker",
                        filename=avatar_filename,
                        file_url=avatar_url,
                        file_path=str(avatar_path),
                        file_size=len(result.image_bytes),
                        mime_type="image/png",
                        title=f"Podcast Presenter {i+1} - {project_id}",
                        description=f"Generated podcast presenter avatar for speaker {i+1}",
                        prompt=prompt,
                        tags=["podcast", "avatar", "presenter", project_id],
                        provider=result.provider,
                        model=result.model,
                        asset_metadata=build_podcast_asset_metadata(
                            asset_role="generated_presenter",
                            project_id=project_id,
                            origin="podcast.avatar.generate",
                            extras={"speaker_number": i + 1, "persona_id": selected_persona_id, "seed": seed},
                        ),
                    )
                except Exception as e:
                    logger.warning(f"[Podcast] Failed to save presenter asset: {e}")
            
            generated_avatars.append({
                "avatar_url": avatar_url,
                "avatar_filename": avatar_filename,
                "speaker_number": i + 1,
                "prompt": prompt,  # Include the prompt used for generation
                "persona_id": selected_persona_id,
                "seed": seed,
            })
        
        return {
            "avatars": generated_avatars,
            "message": f"Generated {speakers} presenter avatar(s)",
            "persona_id": selected_persona_id,
        }
    except Exception as exc:
        logger.error(f"[Podcast] Presenter generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Presenter generation failed: {str(exc)}")

