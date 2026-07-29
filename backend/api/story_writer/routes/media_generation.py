from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from models.story_models import (
    StoryImageGenerationRequest,
    StoryImageGenerationResponse,
    StoryImageResult,
    RegenerateImageRequest,
    RegenerateImageResponse,
    StoryAudioGenerationRequest,
    StoryAudioGenerationResponse,
    StoryAudioResult,
    GenerateAIAudioRequest,
    GenerateAIAudioResponse,
    StoryScene,
)
from services.database import get_db
from services.story_writer.image_generation_service import StoryImageGenerationService
from services.story_writer.audio_generation_service import StoryAudioGenerationService
from utils.asset_tracker import save_asset_to_library

from ..utils.auth import require_authenticated_user
from ..utils.media_utils import resolve_story_media_path


router = APIRouter()
image_service = StoryImageGenerationService()
audio_service = StoryAudioGenerationService()


@router.post("/generate-images", response_model=StoryImageGenerationResponse)
async def generate_scene_images(
    request: StoryImageGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StoryImageGenerationResponse:
    """Generate images for story scenes."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.scenes or len(request.scenes) == 0:
            raise HTTPException(status_code=400, detail="At least one scene is required")

        logger.info(f"[StoryWriter] Generating images for {len(request.scenes)} scenes for user {user_id}")

        scenes_data = [scene.dict() if isinstance(scene, StoryScene) else scene for scene in request.scenes]
        image_results = image_service.generate_scene_images(
            scenes=scenes_data,
            user_id=user_id,
            provider=request.provider,
            width=request.width or 1024,
            height=request.height or 1024,
            model=request.model,
            db=db,
        )

        image_models: List[StoryImageResult] = [
            StoryImageResult(
                scene_number=result.get("scene_number", 0),
                scene_title=result.get("scene_title", "Untitled"),
                image_filename=result.get("image_filename", ""),
                image_url=result.get("image_url") or "",
                width=result.get("width", 1024),
                height=result.get("height", 1024),
                provider=result.get("provider", "unknown"),
                model=result.get("model"),
                seed=result.get("seed"),
                error=result.get("error"),
            )
            for result in image_results
        ]

        # Save assets to library
        for result in image_results:
            if not result.get("error") and result.get("image_url"):
                try:
                    scene_number = result.get("scene_number", 0)
                    # Safely get prompt from scenes_data with bounds checking
                    prompt = None
                    if scene_number > 0 and scene_number <= len(scenes_data):
                        prompt = scenes_data[scene_number - 1].get("image_prompt")
                    
                    save_asset_to_library(
                        db=db,
                        user_id=user_id,
                        asset_type="image",
                        source_module="story_writer",
                        filename=result.get("image_filename", ""),
                        file_url=result.get("image_url", ""),
                        file_path=result.get("image_path"),
                        file_size=result.get("file_size"),
                        mime_type="image/png",
                        title=f"Scene {scene_number}: {result.get('scene_title', 'Untitled')}",
                        description=f"Story scene image for scene {scene_number}",
                        prompt=prompt,
                        tags=["story_writer", "scene", f"scene_{scene_number}"],
                        provider=result.get("provider"),
                        model=result.get("model"),
                        asset_metadata={"scene_number": scene_number, "scene_title": result.get("scene_title"), "status": "completed"}
                    )
                except Exception as e:
                    logger.warning(f"[StoryWriter] Failed to save image asset to library: {e}")

        return StoryImageGenerationResponse(images=image_models, success=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate images: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/regenerate-images", response_model=RegenerateImageResponse)
async def regenerate_scene_image(
    request: RegenerateImageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> RegenerateImageResponse:
    """Regenerate a single scene image using a direct prompt (no AI prompt generation)."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt is required")

        logger.info(
            f"[StoryWriter] Regenerating image for scene {request.scene_number} "
            f"({request.scene_title}) for user {user_id}"
        )

        result = image_service.regenerate_scene_image(
            scene_number=request.scene_number,
            scene_title=request.scene_title,
            prompt=request.prompt.strip(),
            user_id=user_id,
            provider=request.provider,
            width=request.width or 1024,
            height=request.height or 1024,
            model=request.model,
        )

        return RegenerateImageResponse(
            scene_number=result.get("scene_number", request.scene_number),
            scene_title=result.get("scene_title", request.scene_title),
            image_filename=result.get("image_filename", ""),
            image_url=result.get("image_url") or "",
            width=result.get("width", request.width or 1024),
            height=result.get("height", request.height or 1024),
            provider=result.get("provider", "unknown"),
            model=result.get("model"),
            seed=result.get("seed"),
            success=True,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to regenerate image: {exc}")
        return RegenerateImageResponse(
            scene_number=request.scene_number,
            scene_title=request.scene_title,
            image_filename="",
            image_url="",
            width=request.width or 1024,
            height=request.height or 1024,
            provider=request.provider or "unknown",
            success=False,
            error=str(exc),
        )


@router.get("/images/{image_filename}")
async def serve_scene_image(
    image_filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve a generated story scene image.
    
    Supports authentication via Authorization header or token query parameter.
    Query parameter is useful for HTML elements like <img> that cannot send custom headers.
    """
    try:
        user_id = require_authenticated_user(current_user)
        image_path = resolve_story_media_path(image_filename, "image", user_id)
        return FileResponse(path=str(image_path), media_type="image/png", filename=image_filename)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to serve image: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-audio", response_model=StoryAudioGenerationResponse)
async def generate_scene_audio(
    request: StoryAudioGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StoryAudioGenerationResponse:
    """Generate audio narration for story scenes."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.scenes or len(request.scenes) == 0:
            raise HTTPException(status_code=400, detail="At least one scene is required")

        logger.info(f"[StoryWriter] Generating audio for {len(request.scenes)} scenes for user {user_id}")

        scenes_data = [scene.dict() if isinstance(scene, StoryScene) else scene for scene in request.scenes]
        audio_results = audio_service.generate_scene_audio_list(
            scenes=scenes_data,
            user_id=user_id,
            provider=request.provider or "gtts",
            lang=request.lang or "en",
            slow=request.slow or False,
            rate=request.rate or 150,
        )

        audio_models: List[StoryAudioResult] = []
        for result in audio_results:
            audio_url = result.get("audio_url") or ""
            audio_filename = result.get("audio_filename") or ""
            
            audio_models.append(
                StoryAudioResult(
                    scene_number=result.get("scene_number", 0),
                    scene_title=result.get("scene_title", "Untitled"),
                    audio_filename=audio_filename,
                    audio_url=audio_url,
                    provider=result.get("provider", "unknown"),
                    file_size=result.get("file_size", 0),
                    error=result.get("error"),
                )
            )

            # Save assets to library
            if not result.get("error") and audio_url:
                try:
                    scene_number = result.get("scene_number", 0)
                    # Safely get prompt from scenes_data with bounds checking
                    prompt = None
                    if scene_number > 0 and scene_number <= len(scenes_data):
                        prompt = scenes_data[scene_number - 1].get("text")
                    
                    save_asset_to_library(
                        db=db,
                        user_id=user_id,
                        asset_type="audio",
                        source_module="story_writer",
                        filename=audio_filename,
                        file_url=audio_url,
                        file_path=result.get("audio_path"),
                        file_size=result.get("file_size"),
                        mime_type="audio/mpeg",
                        title=f"Scene {scene_number}: {result.get('scene_title', 'Untitled')}",
                        description=f"Story scene audio narration for scene {scene_number}",
                        prompt=prompt,
                        tags=["story_writer", "audio", "narration", f"scene_{scene_number}"],
                        provider=result.get("provider"),
                        model=result.get("model"),
                        cost=result.get("cost"),
                        asset_metadata={"scene_number": scene_number, "scene_title": result.get("scene_title"), "status": "completed"}
                    )
                except Exception as e:
                    logger.warning(f"[StoryWriter] Failed to save audio asset to library: {e}")

        return StoryAudioGenerationResponse(audio_files=audio_models, success=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate audio: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/generate-ai-audio", response_model=GenerateAIAudioResponse)
async def generate_ai_audio(
    request: GenerateAIAudioRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> GenerateAIAudioResponse:
    """Generate AI audio for a single scene using WaveSpeed Minimax Speech 02 HD."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Text is required")

        logger.info(
            f"[StoryWriter] Generating AI audio for scene {request.scene_number} "
            f"({request.scene_title}) for user {user_id}"
        )

        result = audio_service.generate_ai_audio(
            scene_number=request.scene_number,
            scene_title=request.scene_title,
            text=request.text.strip(),
            user_id=user_id,
            voice_id=request.voice_id or "Wise_Woman",
            speed=request.speed or 1.0,
            volume=request.volume or 1.0,
            pitch=request.pitch or 0.0,
            emotion=request.emotion or "happy",
        )

        return GenerateAIAudioResponse(
            scene_number=result.get("scene_number", request.scene_number),
            scene_title=result.get("scene_title", request.scene_title),
            audio_filename=result.get("audio_filename", ""),
            audio_url=result.get("audio_url", ""),
            provider=result.get("provider", "wavespeed"),
            model=result.get("model", "minimax/speech-02-hd"),
            voice_id=result.get("voice_id", request.voice_id or "Wise_Woman"),
            text_length=result.get("text_length", len(request.text)),
            file_size=result.get("file_size", 0),
            cost=result.get("cost", 0.0),
            success=True,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to generate AI audio: {exc}")
        return GenerateAIAudioResponse(
            scene_number=request.scene_number,
            scene_title=request.scene_title,
            audio_filename="",
            audio_url="",
            provider="wavespeed",
            model="minimax/speech-02-hd",
            voice_id=request.voice_id or "Wise_Woman",
            text_length=len(request.text) if request.text else 0,
            file_size=0,
            cost=0.0,
            success=False,
            error=str(exc),
        )


@router.get("/audio/{audio_filename}")
async def serve_scene_audio(
    audio_filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Serve a generated story scene audio file."""
    try:
        user_id = require_authenticated_user(current_user)
        audio_path = resolve_story_media_path(audio_filename, "audio", user_id)
        return FileResponse(path=str(audio_path), media_type="audio/mpeg", filename=audio_filename)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to serve audio: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


class PromptOptimizeRequest(BaseModel):
    text: str = Field(..., description="The prompt text to optimize")
    mode: Optional[str] = Field(default="image", pattern="^(image|video)$", description="Optimization mode: 'image' or 'video'")
    style: Optional[str] = Field(
        default="default", 
        pattern="^(default|artistic|photographic|technical|anime|realistic)$",
        description="Style: 'default', 'artistic', 'photographic', 'technical', 'anime', or 'realistic'"
    )
    image: Optional[str] = Field(None, description="Base64-encoded image for context (optional)")


class PromptOptimizeResponse(BaseModel):
    optimized_prompt: str
    success: bool


@router.post("/optimize-prompt", response_model=PromptOptimizeResponse)
async def optimize_prompt(
    request: PromptOptimizeRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> PromptOptimizeResponse:
    """Optimize an image prompt using WaveSpeed prompt optimizer."""
    try:
        user_id = require_authenticated_user(current_user)

        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="Prompt text is required")

        logger.info(f"[StoryWriter] Optimizing prompt for user {user_id} (mode={request.mode}, style={request.style})")

        from services.wavespeed.client import WaveSpeedClient

        client = WaveSpeedClient()
        optimized_prompt = client.optimize_prompt(
            text=request.text.strip(),
            mode=request.mode or "image",
            style=request.style or "default",
            image=request.image,  # Optional base64 image
            enable_sync_mode=True,
            timeout=30
        )

        logger.info(f"[StoryWriter] Prompt optimized successfully for user {user_id}")

        return PromptOptimizeResponse(
            optimized_prompt=optimized_prompt,
            success=True
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to optimize prompt: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


