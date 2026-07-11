"""API endpoints for Product Marketing Suite - Product asset creation only."""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from services.product_marketing import (
    BrandDNASyncService,
    ProductAnimationService,
    ProductAnimationRequest,
    ProductVideoService,
    ProductVideoRequest,
    ProductAvatarService,
    ProductAvatarRequest,
    IntelligentPromptBuilder,
    PersonalizationService,
)
from services.product_marketing.product_marketing_templates import (
    ProductMarketingTemplates,
    TemplateCategory,
)
from services.product_marketing.product_image_service import ProductImageService, ProductImageRequest
from middleware.auth_middleware import get_current_user
from utils.logger_utils import get_service_logger


logger = get_service_logger("api.product_marketing")
router = APIRouter(prefix="/api/product-marketing", tags=["product-marketing"])


def _require_user_id(current_user: Dict[str, Any], operation: str) -> str:
    """Ensure user_id is available for protected operations."""
    user_id = current_user.get("sub") or current_user.get("user_id") or current_user.get("id")
    if not user_id:
        logger.error(
            "[Product Marketing] ❌ Missing user_id for %s operation - blocking request",
            operation,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user required for product marketing operations.",
        )
    return str(user_id)


# ====================
# PRODUCT ASSET ENDPOINTS (Product Marketing Suite - Product Assets)
# ====================

class ProductPhotoshootRequest(BaseModel):
    """Request for product image photoshoot generation."""
    product_name: str = Field(..., description="Product name")
    product_description: str = Field(..., description="Product description")
    environment: str = Field(default="studio", description="Environment: studio, lifestyle, outdoor, minimalist, luxury")
    background_style: str = Field(default="white", description="Background: white, transparent, lifestyle, branded")
    lighting: str = Field(default="natural", description="Lighting: natural, studio, dramatic, soft")
    product_variant: Optional[str] = Field(None, description="Product variant (color, size, etc.)")
    angle: Optional[str] = Field(None, description="Product angle: front, side, top, 360")
    style: str = Field(default="photorealistic", description="Style: photorealistic, minimalist, luxury, technical")
    resolution: str = Field(default="1024x1024", description="Resolution (e.g., 1024x1024, 1280x720)")
    num_variations: int = Field(default=1, description="Number of variations to generate")
    brand_colors: Optional[List[str]] = Field(None, description="Brand color palette")
    additional_context: Optional[str] = Field(None, description="Additional context for generation")


def get_product_image_service() -> ProductImageService:
    """Get Product Image Service instance."""
    return ProductImageService()


@router.post("/products/photoshoot", summary="Generate Product Image")
async def generate_product_image(
    request: ProductPhotoshootRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    product_image_service: ProductImageService = Depends(get_product_image_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Generate professional product images using AI.
    
    This endpoint:
    - Generates product images optimized for e-commerce
    - Supports multiple environments and styles
    - Integrates with brand DNA for personalization
    - Automatically saves to Asset Library
    """
    try:
        user_id = _require_user_id(current_user, "product image generation")
        logger.info(f"[Product Marketing] Generating product image for '{request.product_name}'")
        
        # Get brand DNA for personalization
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception as brand_error:
            logger.warning(f"[Product Marketing] Could not load brand DNA: {str(brand_error)}")
        
        # Convert request to service request
        service_request = ProductImageRequest(
            product_name=request.product_name,
            product_description=request.product_description,
            environment=request.environment,
            background_style=request.background_style,
            lighting=request.lighting,
            product_variant=request.product_variant,
            angle=request.angle,
            style=request.style,
            resolution=request.resolution,
            num_variations=request.num_variations,
            brand_colors=request.brand_colors,
            additional_context=request.additional_context,
        )
        
        # Generate product image
        result = await product_image_service.generate_product_image(
            request=service_request,
            user_id=user_id,
            brand_context=brand_context,
        )
        
        if not result.success:
            raise HTTPException(status_code=500, detail=result.error or "Product image generation failed")
        
        logger.info(f"[Product Marketing] ✅ Generated product image: {result.asset_id}")
        
        # Return result (image_bytes will be served via separate endpoint)
        return {
            "success": True,
            "product_name": result.product_name,
            "image_url": result.image_url,
            "asset_id": result.asset_id,
            "provider": result.provider,
            "model": result.model,
            "cost": result.cost,
            "generation_time": result.generation_time,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error generating product image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Product image generation failed: {str(e)}")


@router.get("/products/images/{filename}", summary="Serve Product Image")
async def serve_product_image(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Serve generated product images."""
    try:
        from fastapi.responses import FileResponse
        from pathlib import Path
        
        _require_user_id(current_user, "serving product image")
        
        # Locate image file
        base_dir = Path(__file__).parent.parent.parent
        image_path = base_dir / "product_images" / filename
        
        if not image_path.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        
        return FileResponse(
            path=str(image_path),
            media_type="image/png",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error serving product image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# PRODUCT ANIMATION ENDPOINTS
# ====================

class ProductAnimationRequestModel(BaseModel):
    """Request for product animation."""
    product_image_base64: str = Field(..., description="Base64 encoded product image")
    animation_type: str = Field(..., description="Animation type: reveal, rotation, demo, lifestyle")
    product_name: str = Field(..., description="Product name")
    product_description: Optional[str] = Field(None, description="Product description")
    resolution: str = Field(default="720p", description="Video resolution: 480p, 720p, 1080p")
    duration: int = Field(default=5, description="Video duration: 5 or 10 seconds")
    audio_base64: Optional[str] = Field(None, description="Optional audio for synchronization")
    additional_context: Optional[str] = Field(None, description="Additional context for animation")


def get_product_animation_service() -> ProductAnimationService:
    """Get Product Animation Service instance."""
    return ProductAnimationService()


@router.post("/products/animate", summary="Animate Product Image")
async def animate_product(
    request: ProductAnimationRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    animation_service: ProductAnimationService = Depends(get_product_animation_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Animate a product image into a video.
    
    This endpoint:
    - Uses WAN 2.5 Image-to-Video via Transform Studio
    - Supports multiple animation types (reveal, rotation, demo, lifestyle)
    - Applies brand DNA for consistent styling
    - Returns video URL and metadata
    """
    try:
        user_id = _require_user_id(current_user, "product animation")
        logger.info(f"[Product Marketing] Animating product '{request.product_name}' with type '{request.animation_type}'")
        
        # Get brand DNA for personalization
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception as brand_error:
            logger.warning(f"[Product Marketing] Could not load brand DNA: {str(brand_error)}")
        
        # Create animation request
        animation_request = ProductAnimationRequest(
            product_image_base64=request.product_image_base64,
            animation_type=request.animation_type,
            product_name=request.product_name,
            product_description=request.product_description,
            resolution=request.resolution,
            duration=request.duration,
            audio_base64=request.audio_base64,
            brand_context=brand_context,
            additional_context=request.additional_context,
        )
        
        # Generate animation
        result = await animation_service.animate_product(animation_request, user_id)
        
        logger.info(f"[Product Marketing] ✅ Product animation completed: cost=${result.get('cost', 0):.2f}")
        
        return {
            "success": True,
            "product_name": result.get("product_name"),
            "animation_type": result.get("animation_type"),
            "video_url": result.get("video_url"),
            "video_filename": result.get("filename"),
            "cost": result.get("cost", 0.0),
            "resolution": request.resolution,
            "duration": request.duration,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error animating product: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Product animation failed: {str(e)}")


@router.post("/products/animate/reveal", summary="Create Product Reveal Animation")
async def create_product_reveal(
    request: ProductAnimationRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    animation_service: ProductAnimationService = Depends(get_product_animation_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product reveal animation (elegant product unveiling)."""
    try:
        user_id = _require_user_id(current_user, "product reveal animation")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await animation_service.create_product_reveal(
            product_image_base64=request.product_image_base64,
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            duration=request.duration,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "animation_type": "reveal",
            "video_url": result.get("video_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating reveal: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/animate/rotation", summary="Create Product Rotation Animation")
async def create_product_rotation(
    request: ProductAnimationRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    animation_service: ProductAnimationService = Depends(get_product_animation_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create 360° product rotation animation."""
    try:
        user_id = _require_user_id(current_user, "product rotation animation")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await animation_service.create_product_rotation(
            product_image_base64=request.product_image_base64,
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            duration=request.duration or 10,  # Default 10s for rotation
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "animation_type": "rotation",
            "video_url": result.get("video_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating rotation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/animate/demo", summary="Create Product Demo Animation")
async def create_product_demo_animation(
    request: ProductAnimationRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    animation_service: ProductAnimationService = Depends(get_product_animation_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product demo animation (image-to-video: product in use, demonstrating features)."""
    try:
        user_id = _require_user_id(current_user, "product demo animation")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await animation_service.create_product_demo(
            product_image_base64=request.product_image_base64,
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            duration=request.duration or 10,  # Default 10s for demo
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "animation_type": "demo",
            "video_subtype": "animation",  # Image-to-video
            "video_url": result.get("video_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating demo animation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# PRODUCT VIDEO ENDPOINTS (Text-to-Video)
# ====================

class ProductVideoRequestModel(BaseModel):
    """Request for product demo video (text-to-video)."""
    product_name: str = Field(..., description="Product name")
    product_description: str = Field(..., description="Product description")
    video_type: str = Field(default="demo", description="Video type: demo, storytelling, feature_highlight, launch")
    resolution: str = Field(default="720p", description="Video resolution: 480p, 720p, 1080p")
    duration: int = Field(default=10, description="Video duration: 5 or 10 seconds")
    audio_base64: Optional[str] = Field(None, description="Optional audio for synchronization")
    additional_context: Optional[str] = Field(None, description="Additional context for video")


def get_product_video_service() -> ProductVideoService:
    """Get Product Video Service instance."""
    return ProductVideoService()


@router.post("/products/video/demo", summary="Create Product Demo Video (Text-to-Video)")
async def create_product_demo_video(
    request: ProductVideoRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    video_service: ProductVideoService = Depends(get_product_video_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product demo video using WAN 2.5 Text-to-Video.
    
    This endpoint:
    - Uses WAN 2.5 Text-to-Video via main_video_generation
    - Generates video from product description (no image required)
    - Applies brand DNA for consistent styling
    - Returns video URL and metadata
    """
    try:
        user_id = _require_user_id(current_user, "product demo video")
        logger.info(f"[Product Marketing] Creating {request.video_type} video for product '{request.product_name}'")
        
        # Get brand DNA for personalization
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception as brand_error:
            logger.warning(f"[Product Marketing] Could not load brand DNA: {str(brand_error)}")
        
        # Create video request
        video_request = ProductVideoRequest(
            product_name=request.product_name,
            product_description=request.product_description,
            video_type=request.video_type,
            resolution=request.resolution,
            duration=request.duration,
            audio_base64=request.audio_base64,
            brand_context=brand_context,
            additional_context=request.additional_context,
        )
        
        # Generate video using unified ai_video_generate()
        result = await video_service.generate_product_video(video_request, user_id)
        
        logger.info(f"[Product Marketing] ✅ Product demo video completed: cost=${result.get('cost', 0):.2f}")
        
        return {
            "success": True,
            "product_name": result.get("product_name"),
            "video_type": result.get("video_type"),
            "video_url": result.get("file_url"),
            "video_filename": result.get("filename"),
            "cost": result.get("cost", 0.0),
            "resolution": request.resolution,
            "duration": request.duration,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating product demo video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Product demo video generation failed: {str(e)}")


@router.post("/products/video/storytelling", summary="Create Product Storytelling Video")
async def create_product_storytelling(
    request: ProductVideoRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    video_service: ProductVideoService = Depends(get_product_video_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product storytelling video (narrative-driven product showcase)."""
    try:
        user_id = _require_user_id(current_user, "product storytelling video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await video_service.create_product_storytelling(
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            duration=request.duration,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "video_type": "storytelling",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating storytelling video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/video/feature-highlight", summary="Create Product Feature Highlight Video")
async def create_product_feature_highlight(
    request: ProductVideoRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    video_service: ProductVideoService = Depends(get_product_video_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product feature highlight video (close-up shots of key features)."""
    try:
        user_id = _require_user_id(current_user, "product feature highlight video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await video_service.create_product_feature_highlight(
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            duration=request.duration,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "video_type": "feature_highlight",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating feature highlight video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/video/launch", summary="Create Product Launch Video")
async def create_product_launch(
    request: ProductVideoRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    video_service: ProductVideoService = Depends(get_product_video_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product launch video (exciting unveiling, launch event aesthetic)."""
    try:
        user_id = _require_user_id(current_user, "product launch video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await video_service.create_product_launch(
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution or "1080p",  # Higher quality for launch
            duration=request.duration,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "video_type": "launch",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating launch video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/products/videos/{user_id}/{filename}", summary="Serve Product Video")
async def serve_product_video(
    user_id: str,
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Serve generated product videos."""
    try:
        from fastapi.responses import FileResponse
        from pathlib import Path
        
        # Verify user owns the video
        current_user_id = _require_user_id(current_user, "serving product video")
        if current_user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Locate video file
        base_dir = Path(__file__).parent.parent.parent
        video_path = base_dir / "product_videos" / user_id / filename
        
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video not found")
        
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error serving product video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# PRODUCT AVATAR ENDPOINTS (InfiniteTalk)
# ====================

class ProductAvatarRequestModel(BaseModel):
    """Request for product explainer video with talking avatar."""
    avatar_image_base64: str = Field(..., description="Avatar image (product, spokesperson, or mascot) in base64")
    script_text: Optional[str] = Field(None, description="Text script to convert to audio (alternative to audio_base64)")
    audio_base64: Optional[str] = Field(None, description="Pre-generated audio in base64 (alternative to script_text)")
    product_name: str = Field(..., description="Product name")
    product_description: Optional[str] = Field(None, description="Product description")
    explainer_type: str = Field(default="product_overview", description="Explainer type: product_overview, feature_explainer, tutorial, brand_message")
    resolution: str = Field(default="720p", description="Video resolution: 480p or 720p")
    prompt: Optional[str] = Field(None, description="Optional prompt for expression/style")
    mask_image_base64: Optional[str] = Field(None, description="Optional mask image for animatable regions")
    additional_context: Optional[str] = Field(None, description="Additional context for avatar animation")


def get_product_avatar_service() -> ProductAvatarService:
    """Get Product Avatar Service instance."""
    return ProductAvatarService()


@router.post("/products/avatar/explainer", summary="Create Product Explainer Video (Talking Avatar)")
async def create_product_explainer(
    request: ProductAvatarRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    avatar_service: ProductAvatarService = Depends(get_product_avatar_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product explainer video using InfiniteTalk (talking avatar).
    
    This endpoint:
    - Uses InfiniteTalk for precise lip-sync avatar videos
    - Supports up to 10 minutes duration
    - Generates audio from text script (or accepts pre-generated audio)
    - Applies brand DNA for consistent styling
    - Returns video URL and metadata
    
    Use Cases:
    - Product overview videos
    - Feature explainer videos
    - Tutorial videos
    - Brand message videos
    """
    try:
        user_id = _require_user_id(current_user, "product explainer video")
        logger.info(f"[Product Marketing] Creating {request.explainer_type} explainer for product '{request.product_name}'")
        
        # Validate that either script_text or audio_base64 is provided
        if not request.script_text and not request.audio_base64:
            raise HTTPException(
                status_code=400,
                detail="Either script_text or audio_base64 must be provided"
            )
        
        # Get brand DNA for personalization
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception as brand_error:
            logger.warning(f"[Product Marketing] Could not load brand DNA: {str(brand_error)}")
        
        # Create avatar request
        avatar_request = ProductAvatarRequest(
            avatar_image_base64=request.avatar_image_base64,
            script_text=request.script_text,
            audio_base64=request.audio_base64,
            product_name=request.product_name,
            product_description=request.product_description,
            explainer_type=request.explainer_type,
            resolution=request.resolution,
            prompt=request.prompt,
            mask_image_base64=request.mask_image_base64,
            brand_context=brand_context,
            additional_context=request.additional_context,
        )
        
        # Generate explainer video
        result = await avatar_service.generate_product_explainer(avatar_request, user_id)
        
        logger.info(f"[Product Marketing] ✅ Product explainer video completed: cost=${result.get('cost', 0):.2f}, duration={result.get('duration', 0):.1f}s")
        
        return {
            "success": True,
            "product_name": result.get("product_name"),
            "explainer_type": result.get("explainer_type"),
            "video_url": result.get("file_url"),
            "video_filename": result.get("filename"),
            "cost": result.get("cost", 0.0),
            "duration": result.get("duration", 0.0),
            "resolution": request.resolution,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating product explainer: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Product explainer generation failed: {str(e)}")


@router.post("/products/avatar/overview", summary="Create Product Overview Explainer")
async def create_product_overview(
    request: ProductAvatarRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    avatar_service: ProductAvatarService = Depends(get_product_avatar_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product overview explainer video (professional product presentation)."""
    try:
        user_id = _require_user_id(current_user, "product overview explainer")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await avatar_service.create_product_overview(
            avatar_image_base64=request.avatar_image_base64,
            script_text=request.script_text or "",
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "explainer_type": "product_overview",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating overview: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/avatar/feature", summary="Create Feature Explainer Video")
async def create_feature_explainer(
    request: ProductAvatarRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    avatar_service: ProductAvatarService = Depends(get_product_avatar_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product feature explainer video (detailed feature demonstration)."""
    try:
        user_id = _require_user_id(current_user, "feature explainer video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await avatar_service.create_feature_explainer(
            avatar_image_base64=request.avatar_image_base64,
            script_text=request.script_text or "",
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "explainer_type": "feature_explainer",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating feature explainer: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/avatar/tutorial", summary="Create Product Tutorial Video")
async def create_tutorial(
    request: ProductAvatarRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    avatar_service: ProductAvatarService = Depends(get_product_avatar_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create product tutorial video (step-by-step instruction)."""
    try:
        user_id = _require_user_id(current_user, "tutorial video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await avatar_service.create_tutorial(
            avatar_image_base64=request.avatar_image_base64,
            script_text=request.script_text or "",
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "explainer_type": "tutorial",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating tutorial: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/products/avatar/brand-message", summary="Create Brand Message Video")
async def create_brand_message(
    request: ProductAvatarRequestModel,
    current_user: Dict[str, Any] = Depends(get_current_user),
    avatar_service: ProductAvatarService = Depends(get_product_avatar_service),
    brand_dna_sync: BrandDNASyncService = Depends(lambda: BrandDNASyncService())
):
    """Create brand message video (authentic brand storytelling)."""
    try:
        user_id = _require_user_id(current_user, "brand message video")
        
        # Get brand DNA
        brand_context = None
        try:
            brand_dna = brand_dna_sync.get_brand_dna_tokens(user_id)
            brand_context = {
                "visual_identity": brand_dna.get("visual_identity", {}),
                "persona": brand_dna.get("persona", {}),
            }
        except Exception:
            pass
        
        result = await avatar_service.create_brand_message(
            avatar_image_base64=request.avatar_image_base64,
            script_text=request.script_text or "",
            product_name=request.product_name,
            product_description=request.product_description,
            user_id=user_id,
            resolution=request.resolution,
            audio_base64=request.audio_base64,
            brand_context=brand_context
        )
        
        return {
            "success": True,
            "explainer_type": "brand_message",
            "video_url": result.get("file_url"),
            "cost": result.get("cost", 0.0),
        }
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error creating brand message: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/avatars/{user_id}/{filename}", summary="Serve Product Avatar Video")
async def serve_product_avatar(
    user_id: str,
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Serve generated product avatar videos."""
    try:
        from fastapi.responses import FileResponse
        from pathlib import Path
        
        # Verify user owns the video
        current_user_id = _require_user_id(current_user, "serving product avatar video")
        if current_user_id != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Restrict to a filename only (no nested paths)
        requested_name = Path(filename)
        if requested_name.is_absolute() or requested_name.name != filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Locate and validate video file path within user's avatar directory
        base_dir = Path(__file__).parent.parent.parent
        user_root = (base_dir / "product_avatars" / current_user_id).resolve()
        video_path = (user_root / requested_name).resolve()

        try:
            video_path.relative_to(user_root)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="Video not found")
        
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=requested_name.name
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Product Marketing] ❌ Error serving product avatar video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# TEMPLATES LIBRARY
# ====================

@router.get("/templates", summary="Get Product Marketing Templates")
async def get_templates(
    category: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get available product marketing templates.
    
    Templates provide pre-configured settings for common use cases:
    - Product image templates (e-commerce, lifestyle, luxury, etc.)
    - Product video templates (demo, storytelling, feature highlight, launch)
    - Product avatar templates (overview, feature explainer, tutorial, brand message)
    
    Args:
        category: Filter by category (product_image, product_video, product_avatar)
    
    Returns:
        List of templates
    """
    try:
        templates = []
        
        if not category or category == "product_image":
            templates.extend(ProductMarketingTemplates.get_templates_by_category(TemplateCategory.PRODUCT_IMAGE))
        
        if not category or category == "product_video":
            templates.extend(ProductMarketingTemplates.get_templates_by_category(TemplateCategory.PRODUCT_VIDEO))
        
        if not category or category == "product_avatar":
            templates.extend(ProductMarketingTemplates.get_templates_by_category(TemplateCategory.PRODUCT_AVATAR))
        
        return {
            "templates": templates,
            "total": len(templates),
            "categories": {
                "product_image": len(ProductMarketingTemplates.get_product_image_templates()),
                "product_video": len(ProductMarketingTemplates.get_product_video_templates()),
                "product_avatar": len(ProductMarketingTemplates.get_product_avatar_templates()),
            }
        }
        
    except Exception as e:
        logger.error(f"[Templates] ❌ Error getting templates: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_id}", summary="Get Template by ID")
async def get_template(
    template_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get a specific template by ID.
    
    Args:
        template_id: Template ID
    
    Returns:
        Template details
    """
    try:
        template = ProductMarketingTemplates.get_template_by_id(template_id)
        
        if not template:
            raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Templates] ❌ Error getting template: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/{template_id}/apply", summary="Apply Template")
async def apply_template(
    template_id: str,
    product_name: str,
    product_description: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Apply a template to product data.
    
    This returns a template configuration ready for use with product generation endpoints.
    
    Args:
        template_id: Template ID to apply
        product_name: Product name
        product_description: Product description (optional)
    
    Returns:
        Template configuration with formatted prompts/scripts
    """
    try:
        template_config = ProductMarketingTemplates.apply_template(
            template_id=template_id,
            product_name=product_name,
            product_description=product_description,
        )
        
        return {
            "template_id": template_id,
            "product_name": product_name,
            "product_description": product_description,
            "configuration": template_config,
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[Templates] ❌ Error applying template: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ====================
# INTELLIGENT PROMPT INFERENCE
# ====================

class IntelligentPromptRequest(BaseModel):
    """Request for intelligent prompt inference."""
    user_input: str = Field(..., description="Minimal user input (e.g., 'iPhone case for my store')")
    asset_type: Optional[str] = Field(None, description="Optional asset type hint (image, video, animation, avatar)")


@router.post("/intelligent-prompt", summary="Infer Requirements from Minimal Input")
async def infer_requirements(
    request: IntelligentPromptRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Infer complete requirements from minimal user input.
    
    Uses onboarding data and AI to infer:
    - Product name and description
    - Asset type and configuration
    - Style preferences
    - Platform preferences
    - Template matching
    
    Example:
        Input: "iPhone case for my store"
        Output: Complete configuration with all fields pre-filled
    
    Args:
        request: User input and optional asset type hint
        
    Returns:
        Complete configuration dictionary ready for product generation
    """
    try:
        user_id = _require_user_id(current_user, "intelligent prompt inference")
        logger.info(f"[Intelligent Prompt] Inferring requirements from: '{request.user_input}'")
        
        # Initialize intelligent prompt builder
        prompt_builder = IntelligentPromptBuilder()
        
        # Infer requirements
        inferred_config = prompt_builder.infer_requirements(
            user_input=request.user_input,
            user_id=user_id,
            asset_type=request.asset_type
        )
        
        logger.info(f"[Intelligent Prompt] ✅ Inferred configuration for '{inferred_config.get('product_name', 'Unknown')}'")
        
        return {
            "success": True,
            "user_input": request.user_input,
            "configuration": inferred_config,
            "confidence": inferred_config.get("confidence", 0.5),
            "inferred_fields": inferred_config.get("inferred_fields", []),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intelligent Prompt] ❌ Error inferring requirements: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Intelligent prompt inference failed: {str(e)}")


# ====================
# PERSONALIZATION ENDPOINTS
# ====================

@router.get("/personalization/preferences", summary="Get User Preferences")
async def get_user_preferences(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get comprehensive user preferences from onboarding data.
    
    Returns personalized preferences including:
    - Industry and target audience
    - Platform preferences
    - Content preferences
    - Style preferences
    - Recommended templates and channels
    """
    try:
        user_id = _require_user_id(current_user, "get user preferences")
        logger.info(f"[Personalization] Getting preferences for user {user_id}")
        
        personalization_service = PersonalizationService()
        preferences = personalization_service.get_user_preferences(user_id)
        
        return {
            "success": True,
            "preferences": preferences,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Personalization] ❌ Error getting preferences: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get user preferences: {str(e)}")


@router.get("/personalization/defaults/{form_type}", summary="Get Personalized Form Defaults")
async def get_personalized_defaults(
    form_type: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get personalized defaults for a specific form type.
    
    Form types:
    - product_photoshoot: Defaults for product image generation
    - campaign_creator: Defaults for campaign creation
    - product_video: Defaults for product video generation
    - product_avatar: Defaults for avatar video generation
    
    Returns pre-filled form values based on user's onboarding data.
    """
    try:
        user_id = _require_user_id(current_user, "get personalized defaults")
        logger.info(f"[Personalization] Getting defaults for form type: {form_type}")
        
        personalization_service = PersonalizationService()
        defaults = personalization_service.get_personalized_defaults(user_id, form_type)
        
        return {
            "success": True,
            "form_type": form_type,
            "defaults": defaults,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Personalization] ❌ Error getting defaults: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get personalized defaults: {str(e)}")


@router.get("/personalization/recommendations", summary="Get Personalized Recommendations")
async def get_recommendations(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get personalized recommendations for user.
    
    Returns:
    - Recommended templates matching user's industry
    - Recommended channels based on platform personas
    - Recommended asset types matching content preferences
    """
    try:
        user_id = _require_user_id(current_user, "get recommendations")
        logger.info(f"[Personalization] Getting recommendations for user {user_id}")
        
        personalization_service = PersonalizationService()
        recommendations = personalization_service.get_recommendations(user_id)
        
        return {
            "success": True,
            "recommendations": recommendations,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Personalization] ❌ Error getting recommendations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


# ====================
# HEALTH CHECK
# ====================

@router.get("/health", summary="Health Check")
async def health_check():
    """Health check endpoint for Product Marketing Suite."""
    return {
        "status": "healthy",
        "service": "product_marketing",
        "version": "1.0.0",
        "modules": {
            "brand_dna_sync": "available",
            "product_image_service": "available",
            "product_animation_service": "available",
            "product_video_service": "available",
            "product_avatar_service": "available",
            "templates": "available",
        }
    }

