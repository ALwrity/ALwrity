import os
import time
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import base64

# Import our LinkedIn image generation services
from services.linkedin.image_generation import LinkedInImageGenerator, LinkedInImageStorage
from services.linkedin.image_prompts import LinkedInPromptGenerator
from services.onboarding.api_key_manager import APIKeyManager
from middleware.auth_middleware import get_current_user

# Set up logging
from loguru import logger

# Initialize router
router = APIRouter(prefix="/api/linkedin", tags=["linkedin-image-generation"])

# Initialize services
api_key_manager = APIKeyManager()
image_generator = LinkedInImageGenerator(api_key_manager)
prompt_generator = LinkedInPromptGenerator(api_key_manager)
image_storage = LinkedInImageStorage(api_key_manager=api_key_manager)

# Request/Response models
class ImagePromptRequest(BaseModel):
    content_type: str
    topic: str
    industry: str
    content: str

class ImageGenerationRequest(BaseModel):
    prompt: str
    content_context: Dict[str, Any]
    aspect_ratio: Optional[str] = "1:1"
    model: Optional[str] = None

class ImagePromptResponse(BaseModel):
    style: str
    prompt: str
    description: str
    prompt_index: int
    enhanced_at: Optional[str] = None
    linkedin_optimized: Optional[bool] = None
    fallback: Optional[bool] = None
    content_context: Optional[Dict[str, Any]] = None

class ImageGenerationResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    image_id: Optional[str] = None
    style: Optional[str] = None
    aspect_ratio: Optional[str] = None
    error: Optional[str] = None

class ImageEditRequest(BaseModel):
    image_base64: Optional[str] = None
    image_id: Optional[str] = None
    prompt: str
    content_context: Dict[str, Any]

class ImageEditResponse(BaseModel):
    success: bool
    image_data: Optional[str] = None
    image_id: Optional[str] = None
    image_url: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None

@router.post("/generate-image-prompts", response_model=List[ImagePromptResponse])
async def generate_image_prompts(request: ImagePromptRequest):
    """
    Generate three AI-optimized image prompts for LinkedIn content
    """
    try:
        logger.info(f"Generating image prompts for {request.content_type} about {request.topic}")
        
        # Use our LinkedIn prompt generator service
        prompts = await prompt_generator.generate_three_prompts({
            'content_type': request.content_type,
            'topic': request.topic,
            'industry': request.industry,
            'content': request.content
        })
        
        logger.info(f"Generated {len(prompts)} image prompts successfully")
        return prompts
        
    except Exception as e:
        logger.error(f"Error generating image prompts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image prompts: {str(e)}")

@router.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_linkedin_image(
    request: ImageGenerationRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate LinkedIn-optimized image from selected prompt
    """
    try:
        user_id = current_user.get("id")
        start_time = time.time()
        logger.info(
            f"[LinkedInImageGen] Request received user={user_id} "
            f"aspect_ratio={request.aspect_ratio} model={request.model or 'default'} "
            f"prompt_len={len(request.prompt)}"
        )

        image_result = await image_generator.generate_image(
            prompt=request.prompt,
            content_context=request.content_context,
            aspect_ratio=request.aspect_ratio or "1:1",
            user_id=user_id,
            model=request.model,
        )
        
        if image_result and image_result.get('success'):
            logger.info("[LinkedInImageGen] Provider generation complete, storing image...")
            # Store the generated image
            store_result = await image_storage.store_image(
                image_data=image_result['image_data'],
                metadata={
                    'prompt': request.prompt,
                    'style': request.content_context.get('style', 'Generated'),
                    'aspect_ratio': request.aspect_ratio,
                    'content_type': request.content_context.get('content_type'),
                    'topic': request.content_context.get('topic'),
                    'industry': request.content_context.get('industry')
                },
                content_type=request.content_context.get('content_type') or 'post',
                user_id=user_id
            )

            if not store_result.get('success'):
                error_msg = store_result.get('error', 'Failed to store generated image')
                logger.error(f"[LinkedInImageGen] Image storage failed: {error_msg}")
                return ImageGenerationResponse(
                    success=False,
                    error=error_msg
                )

            image_id = store_result['image_id']
            elapsed = time.time() - start_time
            logger.info(
                f"[LinkedInImageGen] Complete image_id={image_id} "
                f"storage_path={store_result.get('storage_path')} elapsed={elapsed:.2f}s"
            )
            
            return ImageGenerationResponse(
                success=True,
                image_url=image_result.get('image_url'),
                image_id=image_id,
                style=request.content_context.get('style', 'Generated'),
                aspect_ratio=request.aspect_ratio
            )
        else:
            error_msg = image_result.get('error', 'Unknown error during image generation')
            logger.error(f"[LinkedInImageGen] Image generation failed: {error_msg}")
            return ImageGenerationResponse(
                success=False,
                error=error_msg
            )
            
    except Exception as e:
        logger.error(f"[LinkedInImageGen] Error generating LinkedIn image: {str(e)}")
        return ImageGenerationResponse(
            success=False,
            error=f"Failed to generate image: {str(e)}"
        )

@router.post("/edit-image", response_model=ImageEditResponse)
async def edit_linkedin_image(
    request: ImageEditRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Edit a LinkedIn-optimized image using natural language.
    Provide the image as base64 and describe the desired edits.
    """
    try:
        user_id = current_user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt is required for image editing")

        logger.info(f"Editing LinkedIn image with prompt: {request.prompt[:100]}... for user {user_id}")

        # Get input image bytes — from image_id (fetch from storage) or image_base64 (direct decode)
        input_image_bytes = None
        if request.image_id:
            stored = await image_storage.retrieve_image(request.image_id, user_id)
            if not stored or not stored.get('success'):
                raise HTTPException(status_code=404, detail=f"Image not found: {request.image_id}")
            input_image_bytes = stored['image_data']
            logger.info(f"Fetched image {request.image_id} from storage ({len(input_image_bytes)} bytes)")
        elif request.image_base64:
            input_image_bytes = base64.b64decode(request.image_base64)
        else:
            raise HTTPException(status_code=400, detail="Either image_id or image_base64 is required")

        # Use LinkedIn image generator with common editing infrastructure
        image_result = await image_generator.edit_image(
            input_image_bytes=input_image_bytes,
            edit_prompt=request.prompt,
            content_context=request.content_context,
            user_id=user_id,
        )

        if image_result and image_result.get('success'):
            image_b64 = base64.b64encode(image_result['image_data']).decode("utf-8")

            # Store the edited image — log but don't fail if storage has issues
            new_image_id = None
            stored_result = await image_storage.store_image(
                image_data=image_result['image_data'],
                metadata={
                    'prompt': request.prompt,
                    'style': request.content_context.get('style', 'Edited'),
                    'content_type': request.content_context.get('content_type'),
                    'topic': request.content_context.get('topic'),
                    'industry': request.content_context.get('industry'),
                    'is_edit': True,
                    'original_prompt': request.prompt,
                    'source_image_id': request.image_id,
                },
                user_id=user_id
            )
            if stored_result and stored_result.get('success'):
                new_image_id = stored_result.get('image_id')
                logger.info(f"Edited image stored with ID: {new_image_id}")
            else:
                logger.warning(f"Edited image not stored: {stored_result.get('error', 'unknown reason')}")

            return ImageEditResponse(
                success=True,
                image_data=image_b64,
                image_id=new_image_id,
                image_url=image_result.get('image_url'),
                width=image_result.get('width'),
                height=image_result.get('height'),
                provider=image_result.get('provider'),
                model=image_result.get('model'),
            )
        else:
            error_msg = image_result.get('error', 'Unknown error during image editing')
            logger.error(f"Image editing failed: {error_msg}")
            return ImageEditResponse(
                success=False,
                error=error_msg
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error editing LinkedIn image: {str(e)}", exc_info=True)
        return ImageEditResponse(
            success=False,
            error=f"Failed to edit image: {str(e)}"
        )


@router.get("/image-status/{image_id}")
async def get_image_status(
    image_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Check the status of an image generation request
    """
    try:
        user_id = current_user.get("id")
        # Get image metadata from storage
        metadata = await image_storage.get_image_metadata(image_id, user_id)
        if metadata:
            return {
                "success": True,
                "status": "completed",
                "metadata": metadata
            }
        else:
            return {
                "success": False,
                "status": "not_found",
                "error": "Image not found"
            }
    except Exception as e:
        logger.error(f"Error checking image status: {str(e)}")
        return {
            "success": False,
            "status": "error",
            "error": str(e)
        }

@router.get("/images/{image_id}")
async def get_generated_image(
    image_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve a generated image by ID.
    Returns the image file directly as a PNG response.
    """
    try:
        user_id = current_user.get("id")
        image_result = await image_storage.retrieve_image(image_id, user_id)
        
        if image_result.get('success') and image_result.get('image_path'):
            return FileResponse(
                path=image_result['image_path'],
                media_type="image/png",
                filename=f"{image_id}.png"
            )
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve image: {str(e)}")

@router.delete("/images/{image_id}")
async def delete_generated_image(
    image_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete a generated image by ID
    """
    try:
        user_id = current_user.get("id")
        result = await image_storage.delete_image(image_id, user_id)
        if result.get('success'):
            return {"success": True, "message": "Image deleted successfully"}
        else:
            return {"success": False, "message": "Failed to delete image"}
    except Exception as e:
        logger.error(f"Error deleting image: {str(e)}")
        return {"success": False, "error": str(e)}

# Health check endpoint
@router.get("/image-generation-health")
async def health_check():
    """
    Lightweight health check for image generation services.
    Verifies configuration and service availability without making API calls.
    """
    try:
        services = {}
        all_healthy = True

        # Check API key configuration (no actual API call)
        image_api_key = api_key_manager.get_api_key("image_generation") or os.getenv("WAVESPEED_API_KEY") or os.getenv("HF_TOKEN")
        services["image_api_key_configured"] = bool(image_api_key)

        # Check storage accessibility
        stats = await image_storage.get_storage_stats()
        storage_ok = stats.get('success', False)
        services["image_storage"] = "operational" if storage_ok else "unavailable"
        if storage_ok:
            services["storage_stats"] = {
                "total_images": stats.get('total_files', 0),
                "total_size_gb": stats.get('total_size_gb', 0),
                "limit_gb": stats.get('storage_limit_gb', 0),
            }

        # Check prompt generator initialization
        prompt_ok = prompt_generator is not None and hasattr(prompt_generator, 'generate_three_prompts')
        services["prompt_generator"] = "operational" if prompt_ok else "unavailable"

        # Check image generator initialization
        gen_ok = image_generator is not None and hasattr(image_generator, 'generate_image')
        services["image_generator"] = "operational" if gen_ok else "unavailable"

        if not all(v == "operational" or v is True for v in services.values()):
            all_healthy = False

        return {
            "status": "healthy" if all_healthy else "degraded",
            "services": services
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
