"""
Podcast Image Handlers

Image generation and serving endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
from pathlib import Path
import uuid

from services.database import get_db
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_image_generation import generate_image, generate_character_image
from utils.asset_tracker import save_asset_to_library
from models.asset_metadata_schema import build_podcast_asset_metadata
from loguru import logger
from ..constants import get_podcast_media_dir
from ..models import PodcastImageRequest, PodcastImageResponse

router = APIRouter()


@router.post("/image", response_model=PodcastImageResponse)
async def generate_podcast_scene_image(
    request: PodcastImageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an AI image for a podcast scene.
    Creates a professional, podcast-appropriate image based on scene title and content.
    """
    user_id = require_authenticated_user(current_user)

    if not request.scene_title:
        raise HTTPException(status_code=400, detail="Scene title is required")

    try:
        # PRE-FLIGHT VALIDATION: Check subscription limits before any API calls
        from services.subscription import PricingService
        from services.subscription.preflight_validator import validate_image_generation_operations
        from fastapi import HTTPException as FastAPIHTTPException
        
        pricing_service = PricingService(db)
        try:
            # Raises HTTPException immediately if validation fails
            validate_image_generation_operations(
                pricing_service=pricing_service,
                user_id=user_id,
                num_images=1
            )
            logger.info(f"[Podcast] ✅ Pre-flight validation passed for user {user_id}")
        except FastAPIHTTPException as http_ex:
            logger.error(f"[Podcast] ❌ Pre-flight validation failed for user {user_id}: {http_ex.detail}")
            raise
        
        # If base avatar is provided, create scene-specific variation
        # Otherwise, generate from scratch
        logger.info(f"[Podcast] Image generation request for scene {request.scene_id}")
        logger.info(f"[Podcast] base_avatar_url={request.base_avatar_url}")
        logger.info(f"[Podcast] custom_prompt={request.custom_prompt}")
        logger.info(f"[Podcast] style={request.style}, rendering_speed={request.rendering_speed}, aspect_ratio={request.aspect_ratio}")
        
        if request.base_avatar_url:
            # Load base avatar image for reference
            from ..utils import load_podcast_image_bytes
            try:
                logger.info(f"[Podcast] Attempting to load base avatar from: {request.base_avatar_url}")
                base_avatar_bytes = load_podcast_image_bytes(request.base_avatar_url, user_id=user_id)
                logger.info(f"[Podcast] ✅ Successfully loaded base avatar ({len(base_avatar_bytes)} bytes) for scene {request.scene_id}")
            except Exception as e:
                logger.error(f"[Podcast] ❌ Failed to load base avatar from {request.base_avatar_url}: {e}", exc_info=True)
                # If base avatar fails to load, we cannot maintain character consistency
                # Raise an error instead of falling back to standard generation
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "Failed to load base avatar",
                        "message": f"Could not load the base avatar image for character consistency: {str(e)}. Please ensure the avatar image is accessible.",
                    },
                )
        else:
            logger.info(f"[Podcast] No base avatar URL provided, will generate from scratch")
            base_avatar_bytes = None
        
        # Extract Podcast Bible context for hyper-personalization
        bible_context = ""
        bible_obj = None
        if request.bible:
            try:
                from services.podcast_bible_service import PodcastBibleService
                from models.podcast_bible_models import PodcastBible
                bible_service = PodcastBibleService()
                bible_obj = PodcastBible(**request.bible)
                bible_context = bible_service.serialize_bible(bible_obj)
            except Exception as exc:
                logger.warning(f"[Podcast Image] Failed to serialize podcast bible: {exc}")

        # Build optimized prompt for scene image generation
        # When base avatar is provided, use Ideogram Character to maintain consistency
        # Otherwise, generate from scratch with podcast-optimized prompt
        image_prompt = ""  # Initialize prompt variable
        
        # Emotion to lighting mapping for visual tone
        emotion_lighting = {
            "happy": "warm, bright lighting, cheerful atmosphere",
            "excited": "dynamic, energetic lighting with highlights",
            "serious": "professional, balanced lighting, authoritative feel",
            "curious": "soft, inviting lighting, thoughtful atmosphere",
            "confident": "strong, dramatic lighting, authoritative look",
            "neutral": "professional, balanced lighting"
        }
        
        if base_avatar_bytes:
            # Use Ideogram Character API for consistent character generation
            # Use custom prompt if provided, otherwise build scene-specific prompt
            if request.custom_prompt:
                # User provided custom prompt - use it directly
                image_prompt = request.custom_prompt
                logger.info(f"[Podcast] Using custom prompt from user for scene {request.scene_id}")
            else:
                # Build scene-specific prompt that respects the base avatar
                prompt_parts = []
                
                # Scene context (primary focus)
                if request.scene_title:
                    prompt_parts.append(f"Scene: {request.scene_title}")
                
                # Use Bible visual style if available
                if bible_obj:
                    prompt_parts.append(f"Style: {bible_obj.visual_style.style_preset}")
                    prompt_parts.append(f"Environment: {bible_obj.visual_style.environment}")
                    prompt_parts.append(f"Lighting: {bible_obj.visual_style.lighting}")
                    if bible_obj.host.look:
                        prompt_parts.append(f"Host Look: {bible_obj.host.look}")
                
                # Scene emotion for visual tone
                emotion_lighting = {
                    "happy": "warm, bright lighting, cheerful atmosphere",
                    "excited": "dynamic, energetic lighting with highlights",
                    "serious": "professional, balanced lighting, authoritative feel",
                    "curious": "soft, inviting lighting, thoughtful atmosphere",
                    "confident": "strong, dramatic lighting, authoritative look",
                    "neutral": "professional, balanced lighting"
                }
                scene_emotion = request.scene_emotion
                if scene_emotion and scene_emotion in emotion_lighting:
                    prompt_parts.append(emotion_lighting[scene_emotion])
                
                # AI Analysis context for visual relevance
                if request.analysis:
                    keywords = request.analysis.get("topKeywords", [])[:5]
                    if keywords:
                        prompt_parts.append(f"Keywords: {', '.join(keywords)}")
                    audience = request.analysis.get("audience", "")
                    if audience:
                        prompt_parts.append(f"Target: {audience}")
                
                # Scene content insights for visual context
                if request.scene_content:
                    content_preview = request.scene_content[:200].replace("\n", " ").strip()
                    # Extract visualizable themes
                    visual_keywords = []
                    content_lower = content_preview.lower()
                    if any(word in content_lower for word in ["data", "statistics", "numbers", "chart", "graph"]):
                        visual_keywords.append("data visualization background")
                    if any(word in content_lower for word in ["technology", "tech", "digital", "ai", "software"]):
                        visual_keywords.append("modern tech studio setting")
                    if any(word in content_lower for word in ["business", "growth", "strategy", "market"]):
                        visual_keywords.append("professional business studio")
                    if any(word in content_lower for word in ["nature", "outdoor", "environment", "green"]):
                        visual_keywords.append("natural outdoor setting")
                    if any(word in content_lower for word in ["medical", "health", "wellness"]):
                        visual_keywords.append("clean medical studio")
                    if any(word in content_lower for word in ["education", "learning", "students"]):
                        visual_keywords.append("classroom or educational setting")
                    if visual_keywords:
                        prompt_parts.append(", ".join(visual_keywords))
                
                # Podcast theme context
                if request.idea:
                    idea_preview = request.idea[:60].strip()
                    prompt_parts.append(f"Topic: {idea_preview}")
                
                # Studio setting (maintains podcast aesthetic)
                if not bible_obj:
                    prompt_parts.extend([
                        "Professional podcast recording studio",
                        "Modern microphone setup",
                        "Clean background, professional lighting"
                    ])
                
                prompt_parts.append("16:9 aspect ratio, video-optimized composition")
                
                image_prompt = ", ".join(prompt_parts)
            
            logger.info(f"[Podcast] Using Ideogram Character for scene {request.scene_id} with base avatar")
            logger.info(f"[Podcast] Scene prompt: {image_prompt[:150]}...")
            
            # Use centralized character image generation with subscription checks and tracking
            # Use custom settings if provided, otherwise use defaults
            style = request.style or "Realistic"  # Default to Realistic for professional podcast presenters
            rendering_speed = request.rendering_speed or "Quality"  # Default to Quality for podcast videos
            
            # Calculate aspect ratio from custom setting or dimensions
            if request.aspect_ratio:
                aspect_ratio = request.aspect_ratio
            else:
                aspect_ratio_map = {
                    (1024, 1024): "1:1",
                    (1920, 1080): "16:9",
                    (1080, 1920): "9:16",
                    (1280, 960): "4:3",
                    (960, 1280): "3:4",
                }
                aspect_ratio = aspect_ratio_map.get((request.width, request.height), "16:9")
            
            logger.info(f"[Podcast] Ideogram Character settings: style={style}, rendering_speed={rendering_speed}, aspect_ratio={aspect_ratio}")
            
            try:
                image_bytes = generate_character_image(
                    prompt=image_prompt,
                    reference_image_bytes=base_avatar_bytes,
                    user_id=user_id,
                    style=style,
                    aspect_ratio=aspect_ratio,
                    rendering_speed=rendering_speed,
                    timeout=None,  # No timeout - poll until WaveSpeed says it's done or failed
                )
                
                # Create result object compatible with ImageGenerationResult
                from services.llm_providers.image_generation.base import ImageGenerationResult
                result = ImageGenerationResult(
                    image_bytes=image_bytes,
                    provider="wavespeed",
                    model="ideogram-ai/ideogram-character",
                    width=request.width,
                    height=request.height,
                )
                
                logger.info(f"[Podcast] ✅ Successfully generated character-consistent scene image")
            except HTTPException as http_err:
                # Re-raise HTTPExceptions from wavespeed client as-is
                logger.error(f"[Podcast] ❌ Ideogram Character HTTPException: {http_err.status_code} - {http_err.detail}")
                raise
            except Exception as char_error:
                error_msg = str(char_error)
                error_type = type(char_error).__name__
                logger.error(f"[Podcast] ❌ Ideogram Character failed: {error_type}: {error_msg}", exc_info=True)
                
                # If Ideogram Character fails, we should NOT fall back to standard generation
                # because that would lose character consistency. Instead, raise an error.
                # However, if it's a timeout/connection issue, we can provide a helpful message.
                error_msg_lower = error_msg.lower()
                if "timeout" in error_msg_lower or "connection" in error_msg_lower or "504" in error_msg:
                    raise HTTPException(
                        status_code=504,
                        detail={
                            "error": "Image generation service unavailable",
                            "message": "The character-consistent image generation service is currently unavailable. Please try again in a few moments. If the problem persists, the service may be experiencing high load.",
                            "retry_recommended": True,
                        },
                    )
                else:
                    raise HTTPException(
                        status_code=502,
                        detail={
                            "error": "Character-consistent image generation failed",
                            "message": f"Failed to generate image with character consistency: {error_msg}",
                            "retry_recommended": True,
                        },
                    )
        
        # CRITICAL: If base_avatar_url was provided but we don't have base_avatar_bytes,
        # this means either loading failed (already raised error) or Ideogram Character failed (already raised error)
        # So this path should only be reached if NO base_avatar_url was provided in the first place
        if not base_avatar_bytes:
            logger.info(f"[Podcast] No base avatar provided - generating standard image from scratch")
            # Standard generation from scratch (no base avatar provided)
            prompt_parts = []
            
            # Use Bible visual style if available
            if bible_obj:
                prompt_parts.append(f"Style: {bible_obj.visual_style.style_preset}")
                prompt_parts.append(f"Environment: {bible_obj.visual_style.environment}")
                prompt_parts.append(f"Lighting: {bible_obj.visual_style.lighting}")
                if bible_obj.host.look:
                    prompt_parts.append(f"Host Look: {bible_obj.host.look}")
            else:
                # Core podcast studio elements
                prompt_parts.extend([
                    "Professional podcast recording studio",
                    "Modern podcast setup with high-quality microphone",
                    "Clean, minimalist background suitable for video",
                    "Professional studio lighting with soft, even illumination",
                    "Podcast host environment, professional and inviting"
                ])
            
            # Scene-specific context
            if request.scene_title:
                prompt_parts.append(f"Scene theme: {request.scene_title}")
            
            # Scene emotion for visual tone (no avatar branch)
            if request.scene_emotion and request.scene_emotion in emotion_lighting:
                prompt_parts.append(emotion_lighting[request.scene_emotion])
            
            # AI Analysis context (no avatar branch)
            if request.analysis:
                keywords = request.analysis.get("topKeywords", [])[:5]
                if keywords:
                    prompt_parts.append(f"Keywords: {', '.join(keywords)}")
                audience = request.analysis.get("audience", "")
                if audience:
                    prompt_parts.append(f"Target: {audience}")
            
            # Content context for visual relevance
            if request.scene_content:
                content_preview = request.scene_content[:150].replace("\n", " ").strip()
                visual_keywords = []
                content_lower = content_preview.lower()
                if any(word in content_lower for word in ["data", "statistics", "numbers", "chart", "graph"]):
                    visual_keywords.append("data visualization elements")
                if any(word in content_lower for word in ["technology", "tech", "digital", "ai", "software"]):
                    visual_keywords.append("modern technology aesthetic")
                if any(word in content_lower for word in ["business", "growth", "strategy", "market"]):
                    visual_keywords.append("professional business environment")
                if any(word in content_lower for word in ["nature", "outdoor", "environment"]):
                    visual_keywords.append("natural outdoor setting")
                if any(word in content_lower for word in ["medical", "health", "wellness"]):
                    visual_keywords.append("clean medical studio")
                if any(word in content_lower for word in ["education", "learning", "students"]):
                    visual_keywords.append("classroom or educational setting")
                if visual_keywords:
                    prompt_parts.append(", ".join(visual_keywords))
            
            # Podcast theme context
            if request.idea:
                idea_preview = request.idea[:80].strip()
                prompt_parts.append(f"Podcast topic context: {idea_preview}")
            
            # Technical requirements for video generation
            prompt_parts.extend([
                "16:9 aspect ratio optimized for video",
                "Center-focused composition for talking avatar overlay",
                "Neutral color palette with professional tones",
                "High resolution, sharp focus, professional photography quality",
                "No text, no logos, no distracting elements",
                "Suitable for InfiniteTalk video generation with animated avatar"
            ])
            
            # Style constraints
            if not bible_obj:
                prompt_parts.extend([
                    "Realistic photography style, not illustration or cartoon",
                    "Professional broadcast quality",
                    "Warm, inviting atmosphere",
                    "Clean composition with breathing room for avatar placement"
                ])
            
            image_prompt = ", ".join(prompt_parts)
            
            logger.info(f"[Podcast] Generating image for scene {request.scene_id}: {request.scene_title}")

            # Generate image using main_image_generation service
            image_options = {
                "provider": None,  # Auto-select provider
                "width": request.width,
                "height": request.height,
            }
            
            result = generate_image(
                prompt=image_prompt,
                options=image_options,
                user_id=user_id
            )

        # Save image to podcast images directory (workspace-aware)
        images_dir = get_podcast_media_dir("image", user_id, ensure_exists=True)

        # Generate filename
        clean_title = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in request.scene_title[:30])
        unique_id = str(uuid.uuid4())[:8]
        image_filename = f"scene_{request.scene_id}_{clean_title}_{unique_id}.png"
        image_path = images_dir / image_filename

        # Save image
        with open(image_path, "wb") as f:
            f.write(result.image_bytes)

        logger.info(f"[Podcast] Saved image to: {image_path}")

        # Create image URL (served via API endpoint)
        image_url = f"/api/podcast/images/{image_filename}"

        # Estimate cost (rough estimate: ~$0.04 per image for most providers, ~$0.10 for Ideogram Character)
        # Note: Actual usage tracking is handled by centralized generate_image()/generate_character_image() functions
        cost = 0.10 if result.provider == "wavespeed" and result.model == "ideogram-ai/ideogram-character" else 0.04

        # Save to asset library
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="image",
                source_module="podcast_maker",
                filename=image_filename,
                file_url=image_url,
                file_path=str(image_path),
                file_size=len(result.image_bytes),
                mime_type="image/png",
                title=f"{request.scene_title} - Podcast Scene",
                description=f"Podcast scene image: {request.scene_title}",
                prompt=image_prompt,
                tags=["podcast", "scene", request.scene_id],
                provider=result.provider,
                model=result.model,
                asset_metadata=build_podcast_asset_metadata(
                    asset_role="podcast_scene_image",
                    project_id=request.project_id,
                    origin="podcast.images.generate",
                    extras={"scene_id": request.scene_id, "scene_title": request.scene_title},
                ),
            )
        except Exception as e:
            logger.warning(f"[Podcast] Failed to save image asset: {e}")

        return PodcastImageResponse(
            scene_id=request.scene_id,
            scene_title=request.scene_title,
            image_filename=image_filename,
            image_url=image_url,
            width=result.width,
            height=result.height,
            provider=result.provider,
            model=result.model,
            cost=cost,
            image_prompt=image_prompt,
        )

    except HTTPException:
        # Re-raise HTTPExceptions as-is (they already have proper error details)
        raise
    except Exception as exc:
        # Log the full exception for debugging
        error_msg = str(exc)
        error_type = type(exc).__name__
        logger.error(f"[Podcast] Image generation failed: {error_type}: {error_msg}", exc_info=True)
        
        # Create a safe error detail
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Image generation failed",
                "message": error_msg,
                "type": error_type,
            }
        )


@router.get("/images/{path:path}")
async def serve_podcast_image(
    path: str,  # Changed from filename to path to support subdirectories
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve generated podcast scene images and avatars.
    
    Supports authentication via Authorization header or token query parameter.
    Query parameter is useful for HTML elements like <img> that cannot send custom headers.
    Supports subdirectories like avatars/
    """
    user_id = require_authenticated_user(current_user)
    
    # Security check: ensure path doesn't contain path traversal or absolute paths
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    images_dir = get_podcast_media_dir("image", user_id)
    image_path = (images_dir / path).resolve()
    
    # Security check: ensure resolved path is within images_dir
    if not str(image_path).startswith(str(images_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image_path, media_type="image/png")

