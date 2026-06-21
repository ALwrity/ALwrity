"""
Step 4 Brand Asset Routes
Handles brand avatar generation, enhancement, and variation.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from loguru import logger
from middleware.auth_middleware import get_current_user


def _extract_user_id(user: Dict[str, Any]) -> str:
    """Extract a stable user ID from Clerk-authenticated user payloads.
    Prefers 'clerk_user_id' or 'id', falls back to 'user_id', else 'unknown'.
    """
    if not isinstance(user, dict):
        return 'unknown'
    return (
        user.get('clerk_user_id')
        or user.get('id')
        or user.get('user_id')
        or 'unknown'
    )
import base64
import os
from pathlib import Path
from utils.file_storage import save_file_safely, generate_unique_filename
from services.database import get_db
from utils.storage_paths import get_user_workspace, sanitize_user_id
from utils.asset_tracker import save_asset_to_library
from models.content_asset_models import ContentAsset, AssetType, AssetSource
from sqlalchemy import desc

from services.llm_providers.main_image_generation import (
    generate_image_with_provider,
    enhance_image_prompt,
    generate_image_variation,
    generate_image_enhance
)
from services.llm_providers.main_audio_generation import clone_voice, qwen3_voice_clone, cosyvoice_voice_clone, qwen3_voice_design
import asyncio
import random
import string

router = APIRouter(prefix="/onboarding/assets")

# --- Models ---
class VoiceDesignRequest(BaseModel):
    user_id: Optional[str] = None
    text: str
    voice_description: str
    language: str = "auto"

class AvatarPromptRequest(BaseModel):
    user_id: Optional[str] = None
    prompt: str
    aspect_ratio: str = "1:1"
    style_preset: Optional[str] = None
    negative_prompt: Optional[str] = None
    num_inference_steps: int = 30
    guidance_scale: float = 7.5
    model: Optional[str] = None
    rendering_speed: Optional[str] = None
    provider: Optional[str] = None

class AvatarEnhanceRequest(BaseModel):
    user_id: Optional[str] = None
    prompt: str

class VoiceCloneRequest(BaseModel):
    user_id: Optional[str] = None
    voice_name: str
    description: Optional[str] = None
    engine: str = "qwen3" # qwen3 or minimax

# --- Routes ---

@router.get("/latest-avatar")
async def get_latest_avatar(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest generated brand avatar for the user."""
    try:
        user_id = _extract_user_id(current_user)

        # Per-call status reports — demoted from warning to debug
        # so they don't pollute the log on every dashboard refresh.
        logger.debug(f"[latest-avatar] Looking for avatar for user_id: {user_id}")

        # Search for assets that are either:
        # 1. Saved with source_module=BRAND_AVATAR_GENERATOR (new)
        # 2. Saved with source_module=STORY_WRITER but have metadata category='brand_avatar' (legacy)

        # Fetch candidates (limit to recent 20 to avoid performance issues)
        candidates = db.query(ContentAsset).filter(
            ContentAsset.user_id == user_id,
            ContentAsset.asset_type == AssetType.IMAGE,
            ContentAsset.source_module.in_([
                AssetSource.BRAND_AVATAR_GENERATOR,
                AssetSource.STORY_WRITER
            ])
        ).order_by(desc(ContentAsset.created_at)).limit(50).all()

        logger.debug(f"[latest-avatar] Found {len(candidates)} candidate(s)")
        
        asset = None
        for candidate in candidates:
            # Check for direct match (new assets)
            if candidate.source_module == AssetSource.BRAND_AVATAR_GENERATOR:
                asset = candidate
                break
            
            # Check for legacy match (metadata category)
            if candidate.source_module == AssetSource.STORY_WRITER:
                meta = candidate.asset_metadata or {}
                if meta.get('category') == 'brand_avatar':
                    asset = candidate
                    break
        
        if not asset:
            return {"success": False, "message": "No avatar found"}
            
        # Fallback to metadata prompt if main column is empty (legacy support)
        prompt = asset.prompt
        if not prompt and asset.asset_metadata:
            prompt = asset.asset_metadata.get('prompt', '')
            
        return {
            "success": True,
            "image_url": asset.file_url,
            "prompt": prompt,
            "asset_id": asset.id,
            "provider": asset.provider
        }
    except Exception as e:
        logger.error(f"Failed to fetch latest avatar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest-voice-clone")
async def get_latest_voice_clone(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest generated voice clone for the user."""
    try:
        user_id = _extract_user_id(current_user)
        
        # Fetch latest voice clone asset
        asset = db.query(ContentAsset).filter(
            ContentAsset.user_id == user_id,
            ContentAsset.asset_type == AssetType.AUDIO,
            ContentAsset.source_module == AssetSource.VOICE_CLONER
        ).order_by(desc(ContentAsset.created_at)).first()
        
        if not asset:
            # Try to find legacy assets or assets that might have been saved differently
            # For example, voice designs might be saved as VOICE_CLONER too?
            # Or check for 'voice_design' logic if needed, but 'voice_cloner' is primary
            return {"success": False, "message": "No voice clone found"}
            
        meta = asset.asset_metadata or {}
        
        return {
            "success": True,
            "custom_voice_id": meta.get("custom_voice_id"),
            "preview_audio_url": meta.get("preview_url") or asset.file_url,
            "asset_id": asset.id,
            "voice_name": meta.get("voice_name"),
            "engine": meta.get("engine")
        }
    except Exception as e:
        logger.error(f"Failed to fetch latest voice clone: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-avatar")
async def generate_avatar(
    request: AvatarPromptRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a brand avatar using available image providers."""
    try:
        user_id = _extract_user_id(current_user)
        
        logger.warning(f"Generating avatar for user {user_id} with prompt: {request.prompt}")
        
        # 1. Generate Image
        result = await generate_image_with_provider(
            prompt=request.prompt,
            aspect_ratio=request.aspect_ratio,
            negative_prompt=request.negative_prompt,
            num_inference_steps=request.num_inference_steps,
            guidance_scale=request.guidance_scale,
            style_preset=request.style_preset,
            model=request.model,
            rendering_speed=request.rendering_speed,
            provider=request.provider,
            user_id=user_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Generation failed"))
            
        # 2. Save to local storage and Asset Library
        # The result typically contains image_base64 or image_url
        # For simplicity, we assume image_base64 is returned or we download the URL
        
        image_data = result.get("image_base64")
        if not image_data and result.get("image_url"):
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    response = await client.get(result["image_url"], timeout=30.0)
                    response.raise_for_status()
                    image_data = response.content
            except ImportError:
                # Fallback to requests if httpx is not installed
                import requests
                response = requests.get(result["image_url"], timeout=30.0)
                response.raise_for_status()
                image_data = response.content
            except Exception as e:
                logger.error(f"Failed to download image from URL: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to download generated image: {str(e)}")
            
        if image_data:
            # Decode if needed (usually it's already base64 string)
            # Save file
            filename = generate_unique_filename("avatar", "png")
            # If image_data is bytes (from URL download), pass it directly
            # If it's base64 string (from API), decode it
            content_to_save = base64.b64decode(image_data) if isinstance(image_data, str) else image_data
            
            # Construct user assets directory
            user_assets_dir = get_user_workspace(user_id) / "assets" / "avatars"
            
            saved_path, error = save_file_safely(
                content_to_save,
                user_assets_dir,
                filename
            )
            
            if error or not saved_path:
                raise HTTPException(status_code=500, detail=f"Failed to save image file: {error}")
            
            # Construct public URL
            image_url = f"/api/assets/{user_id}/avatars/{filename}"
            
            # Save to Asset Library
            asset_id = save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="image",
                source_module="brand_avatar_generator",
                filename=filename,
                file_url=image_url,
                file_path=str(saved_path),
                prompt=request.prompt,
                asset_metadata={
                    "provider": result.get("provider", "unknown"),
                    "style": request.style_preset,
                    "category": "brand_avatar"
                }
            )
            
            return {
                "success": True,
                "image_url": image_url,
                "image_base64": image_data if isinstance(image_data, str) else base64.b64encode(image_data).decode('utf-8'),
                "asset_id": asset_id
            }
            
        return {"success": False, "error": "No image data returned"}

    except Exception as e:
        logger.error(f"Avatar generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enhance-prompt")
async def enhance_prompt_route(
    request: AvatarEnhanceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Enhance a simple prompt into a detailed midjourney-style prompt."""
    try:
        user_id = _extract_user_id(current_user)
        logger.warning(f"Enhancing prompt for user {user_id}: {request.prompt}")
        
        enhanced_prompt = await enhance_image_prompt(request.prompt, user_id=user_id)
        
        return {
            "success": True,
            "original_prompt": request.prompt,
            "optimized_prompt": enhanced_prompt
        }
    except Exception as e:
        logger.error(f"Prompt enhancement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-variation")
async def create_variation_route(
    prompt: str = Form(...),
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None), # Ignored in favor of authenticated user
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Generate a variation of an existing avatar."""
    try:
        user_id = _extract_user_id(current_user)
        logger.warning(f"Creating variation for user {user_id} with prompt: {prompt}")
        
        # Read file
        file_content = await file.read()
        
        result = await generate_image_variation(
            image=file_content,
            prompt=prompt,
            user_id=user_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Variation generation failed"))
            
        # Save result
        image_data = result.get("image_base64")
        if image_data:
            filename = generate_unique_filename("avatar_variation", "png")
            content_to_save = base64.b64decode(image_data)
            
            # Construct user assets directory
            user_assets_dir = get_user_workspace(user_id) / "assets" / "avatars"
            
            saved_path, error = save_file_safely(
                content_to_save,
                user_assets_dir,
                filename
            )
            
            if error or not saved_path:
                raise HTTPException(status_code=500, detail=f"Failed to save variation file: {error}")
            
            # Construct public URL
            image_url = f"/api/assets/{user_id}/avatars/{filename}"
            
            # Save to Asset Library
            asset_id = save_asset_to_library(
                db=next(get_db()),
                user_id=user_id,
                asset_type="image",
                source_module="brand_avatar_variation",
                filename=filename,
                file_url=image_url,
                file_path=str(saved_path),
                asset_metadata={
                    "prompt": prompt,
                    "provider": "wavespeed",
                    "original_filename": file.filename,
                    "category": "brand_avatar_variation"
                }
            )
            
            return {
                "success": True,
                "image_url": image_url,
                "image_base64": image_data,
                "asset_id": asset_id
            }
            
        return {"success": False, "error": "No image data returned"}
        
    except Exception as e:
        logger.error(f"Variation generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enhance-avatar")
async def enhance_avatar_route(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None), # Ignored in favor of authenticated user
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Enhance/Upscale an existing avatar."""
    try:
        user_id = _extract_user_id(current_user)
        logger.warning(f"Enhancing avatar for user {user_id}")
        
        # Read file
        file_content = await file.read()
        
        result = await generate_image_enhance(
            image=file_content,
            user_id=user_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Enhancement failed"))
            
        # Save result
        image_data = result.get("image_base64")
        if image_data:
            filename = generate_unique_filename("avatar_enhanced", "png")
            content_to_save = base64.b64decode(image_data)
            
            # Construct user assets directory
            user_assets_dir = get_user_workspace(user_id) / "assets" / "avatars"
            
            saved_path, error = save_file_safely(
                content_to_save,
                user_assets_dir,
                filename
            )
            
            if error or not saved_path:
                raise HTTPException(status_code=500, detail=f"Failed to save enhanced file: {error}")
            
            # Construct public URL
            image_url = f"/api/assets/{user_id}/avatars/{filename}"
            
            # Save to Asset Library
            asset_id = save_asset_to_library(
                db=next(get_db()),
                user_id=user_id,
                asset_type="image",
                source_module="brand_avatar_enhancer",
                filename=filename,
                file_url=image_url,
                file_path=str(saved_path),
                asset_metadata={
                    "provider": "wavespeed",
                    "category": "brand_avatar_enhanced",
                    "original_filename": file.filename
                }
            )
            
            return {
                "success": True,
                "image_url": image_url,
                "image_base64": image_data,
                "asset_id": asset_id
            }
            
        return {"success": False, "error": "No image data returned"}
        
    except Exception as e:
        logger.error(f"Avatar enhancement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-voice-clone")
async def create_voice_clone(
    voice_name: str = Form(...),
    description: str = Form(None),
    engine: str = Form("qwen3"),
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None), # Ignored in favor of authenticated user
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a voice clone from an audio file."""
    try:
        user_id = _extract_user_id(current_user)
        logger.warning(f"[VoiceClone] Creating voice clone '{voice_name}' (engine={engine}) for user {user_id}")
        
        # 1. Save uploaded audio file
        file_content = await file.read()
        filename = generate_unique_filename("voice_sample", Path(file.filename).suffix.lstrip("."))
        
        user_voice_dir = get_user_workspace(user_id) / "assets" / "voice_samples"
        saved_path, error = save_file_safely(file_content, user_voice_dir, filename)
        
        if error or not saved_path:
             raise HTTPException(status_code=500, detail=f"Failed to save voice sample: {error}")
             
        file_path = str(saved_path)
        
        # 2. Call Voice Cloning API
        preview_audio_bytes = None
        custom_voice_id = None
        
        loop = asyncio.get_event_loop()
        
        # Default preview text
        preview_text = "Hello! This is a preview of my cloned voice using AI technology. I hope you like it!"
        
        if engine.lower() == "minimax":
            # Generate valid voice ID for Minimax (alphanumeric, starts with letter, 8+ chars)
            random_suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            custom_voice_id = f"vc_{random_suffix}"
            
            logger.warning(f"Cloning voice with Minimax, ID: {custom_voice_id}")
            
            # Run blocking call in executor
            result = await loop.run_in_executor(
                None,
                lambda: clone_voice(
                    audio_bytes=file_content,
                    custom_voice_id=custom_voice_id,
                    text=preview_text,
                    user_id=user_id
                )
            )
            preview_audio_bytes = result.preview_audio_bytes
            
        elif engine.lower() == "cosyvoice":
            logger.warning("Cloning voice with CosyVoice")
            result = await loop.run_in_executor(
                None,
                lambda: cosyvoice_voice_clone(
                    audio_bytes=file_content,
                    text=preview_text,
                    user_id=user_id
                )
            )
            preview_audio_bytes = result.preview_audio_bytes
            # CosyVoice doesn't persist ID on provider side, but we need one for DB
            asset_uuid = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            custom_voice_id = f"vc_cosy_{asset_uuid}"
            
        else: # qwen3 (default)
            logger.warning("Cloning voice with Qwen3")
            result = await loop.run_in_executor(
                None,
                lambda: qwen3_voice_clone(
                    audio_bytes=file_content,
                    text=preview_text,
                    user_id=user_id
                )
            )
            preview_audio_bytes = result.preview_audio_bytes
            # Qwen3 doesn't persist ID on provider side
            asset_uuid = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
            custom_voice_id = f"vc_qwen_{asset_uuid}"

        # 3. Save Preview Audio (if generated)
        preview_url = None
        preview_mime_type = "audio/wav"
        actual_filename = None  # Default if preview save fails
        
        if preview_audio_bytes and len(preview_audio_bytes) > 0:
            from utils.media_utils import detect_audio_format, ensure_audio_extension
            
            detected_fmt, preview_mime_type = detect_audio_format(preview_audio_bytes)
            logger.warning(f"[VoiceClone] Detected preview audio format: {detected_fmt} ({preview_mime_type}), {len(preview_audio_bytes)} bytes")

            # Build filename with correct extension based on actual content format
            original_stem = Path(filename).stem
            preview_filename = f"preview_{original_stem}"
            preview_filename = ensure_audio_extension(preview_filename, preview_audio_bytes)
            
            user_voice_dir = get_user_workspace(user_id) / "assets" / "voice_samples"
            saved_preview_path, error = save_file_safely(preview_audio_bytes, user_voice_dir, preview_filename)
            
            if not error and saved_preview_path:
                # Use actual saved filename (may have UUID suffix added by save_file_safely)
                actual_filename = saved_preview_path.name
                preview_url = f"/api/assets/{user_id}/voice_samples/{actual_filename}"
                logger.warning(f"[VoiceClone] Saved preview: {actual_filename} ({saved_preview_path.stat().st_size} bytes, {preview_mime_type})")
                
                # Verify file exists
                if not saved_preview_path.exists():
                    logger.warning(f"[VoiceClone] Preview file does not exist after save: {saved_preview_path}")
                    preview_url = None
            else:
                logger.warning(f"[VoiceClone] Failed to save preview audio: {error}")
            
        # 4. Save to Asset Library
        # Use the preview file (with corrected .wav extension) as the main asset file
        has_valid_preview = preview_audio_bytes and len(preview_audio_bytes) > 0 and saved_preview_path
        stored_filename = actual_filename if has_valid_preview else filename
        asset_id = save_asset_to_library(
            db=db,
            user_id=user_id,
            file_path=file_path,
            asset_type="audio",
            source_module="voice_cloner",
            filename=stored_filename,
            file_url=f"/api/assets/{user_id}/voice_samples/{stored_filename}",
            asset_metadata={
                "voice_name": voice_name,
                "engine": engine,
                "description": description,
                "original_filename": file.filename,
                "custom_voice_id": custom_voice_id,
                "preview_url": preview_url,
                "category": "voice_clone"
            }
        )
        
        return {
            "success": True,
            "custom_voice_id": custom_voice_id,
            "preview_audio_url": preview_url or f"/api/assets/{user_id}/voice_samples/{stored_filename}",
            "asset_id": asset_id,
            "message": "Voice clone created successfully"
        }
        
    except Exception as e:
        logger.error(f"Voice cloning failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-voice-design")
async def create_voice_design(
    request: VoiceDesignRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a voice from text description (Voice Design)."""
    try:
        user_id = _extract_user_id(current_user)
        logger.warning(f"Designing voice for user {user_id}")
        
        loop = asyncio.get_event_loop()
        
        result = await loop.run_in_executor(
            None,
            lambda: qwen3_voice_design(
                text=request.text,
                voice_description=request.voice_description,
                language=request.language,
                user_id=user_id
            )
        )
        
        # Save the result to a file with correct extension based on content
        from utils.media_utils import detect_audio_format, ensure_audio_extension
        detected_fmt, mime_type = detect_audio_format(result.preview_audio_bytes)
        logger.warning(f"[VoiceDesign] Detected audio format: {detected_fmt} ({mime_type})")

        filename = generate_unique_filename("voice_design_preview", detected_fmt)
        filename = ensure_audio_extension(filename, result.preview_audio_bytes)

        user_voice_dir = get_user_workspace(user_id) / "assets" / "voice_samples"
        saved_path, error = save_file_safely(result.preview_audio_bytes, user_voice_dir, filename)
        
        if error or not saved_path:
             raise HTTPException(status_code=500, detail=f"Failed to save voice design: {error}")
             
        # Generate URL
        preview_url = f"/api/assets/{user_id}/voice_samples/{filename}"
        
        # Save to Asset Library
        asset_id = save_asset_to_library(
            db=db,
            user_id=user_id,
            file_path=str(saved_path),
            asset_type="audio",
            source_module="voice_cloner",
            filename=filename,
            file_url=preview_url,
            asset_metadata={
                "voice_description": request.voice_description,
                "text": request.text,
                "language": request.language,
                "engine": "qwen3-design",
                "category": "voice_design",
                "preview_url": preview_url
            }
        )
        
        return {
            "success": True,
            "preview_audio_url": preview_url,
            "asset_id": asset_id,
            "message": "Voice generated successfully"
        }
        
    except Exception as e:
        logger.error(f"Voice design failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
