from __future__ import annotations

import os
import sys
import base64
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

from .image_generation import (
    ImageGenerationOptions,
    ImageGenerationResult,
    ImageEditOptions,
    ImageEditProvider,
    HuggingFaceImageProvider,
    GeminiImageProvider,
    StabilityImageProvider,
    WaveSpeedImageProvider,
)
from .image_generation.helpers import _validate_image_operation, _track_image_operation_usage
from .image_generation.edit import generate_image_edit
from .image_generation.face_swap import generate_face_swap
from utils.logger_utils import get_service_logger
from .tenant_provider_config import tenant_provider_config_resolver


logger = get_service_logger("image_generation.facade")

# Models that can render readable text directly in generated images
_TEXT_CAPABLE = {"flux-kontext-pro", "flux-2-flex", "glm-image"}


def _select_provider(explicit: Optional[str], user_id: Optional[str] = None) -> str:
    cfg = tenant_provider_config_resolver.resolve(
        modality="image",
        user_id=user_id,
        explicit_provider=explicit,
    )
    return (cfg.selected_providers or [explicit or "huggingface"])[0]


def _get_provider(provider_name: str, user_id: Optional[str] = None):
    key, _source = tenant_provider_config_resolver.resolve_provider_key(provider_name, user_id=user_id)
    if provider_name == "huggingface":
        return HuggingFaceImageProvider(api_key=key)
    if provider_name == "gemini":
        if key:
            os.environ["GEMINI_API_KEY"] = key
            os.environ.setdefault("GOOGLE_API_KEY", key)
        return GeminiImageProvider()
    if provider_name == "stability":
        return StabilityImageProvider(api_key=key)
    if provider_name == "wavespeed":
        return WaveSpeedImageProvider(api_key=key)
    raise ValueError(f"Unknown image provider: {provider_name}")


def generate_image(prompt: str, options: Optional[Dict[str, Any]] = None, user_id: Optional[str] = None) -> ImageGenerationResult:
    """Generate image with pre-flight validation.
    
    Args:
        prompt: Image generation prompt
        options: Image generation options (provider, model, width, height, etc.)
        user_id: User ID for subscription checking (optional, but required for validation)
    """
    opts = options or {}
    provider_name = _select_provider(opts.get("provider"), user_id=user_id)

    # PRE-FLIGHT VALIDATION: Run after provider selection so enforcement checks correct limit
    _validate_image_operation(
        user_id=user_id,
        operation_type="image-generation",
        num_operations=1,
        log_prefix="[Image Generation]",
        provider_name=provider_name,
    )

    image_options = ImageGenerationOptions(
        prompt=prompt,
        negative_prompt=opts.get("negative_prompt"),
        width=int(opts.get("width", 1024)),
        height=int(opts.get("height", 1024)),
        guidance_scale=opts.get("guidance_scale"),
        steps=opts.get("steps"),
        seed=opts.get("seed"),
        model=opts.get("model"),
        extra=opts,
    )

    # Normalize obvious model/provider mismatches
    model_lower = (image_options.model or "").lower()
    
    # Detect Wavespeed models and remap provider if needed
    wavespeed_models = ["qwen-image", "ideogram-v3-turbo", "flux-kontext-pro"]
    if model_lower in wavespeed_models and provider_name != "wavespeed":
        logger.info("Remapping provider to wavespeed for model=%s", image_options.model)
        provider_name = "wavespeed"
    
    # Detect HuggingFace models and remap provider if needed
    if provider_name == "stability" and (model_lower.startswith("black-forest-labs/") or model_lower.startswith("runwayml/") or model_lower.startswith("stabilityai/flux")):
        logger.info("Remapping provider to huggingface for model=%s", image_options.model)
        provider_name = "huggingface"
    
    # Detect HuggingFace models when provider is not explicitly set
    if not opts.get("provider") and (model_lower.startswith("black-forest-labs/") or model_lower.startswith("runwayml/") or model_lower.startswith("stabilityai/flux")):
        logger.info("Auto-detecting provider as huggingface for model=%s", image_options.model)
        provider_name = "huggingface"

    if provider_name == "huggingface" and not image_options.model:
        # Provide a sensible default HF model if none specified
        image_options.model = "black-forest-labs/FLUX.1-Krea-dev"
    
    if provider_name == "wavespeed" and not image_options.model:
        # Default to FLUX Kontext Pro (professional typography, lower cost)
        image_options.model = "flux-kontext-pro"

    # Append overlay text for text-capable models
    overlay_text = opts.get("overlay_text")
    if overlay_text and image_options.model and image_options.model.lower() in _TEXT_CAPABLE:
        image_options.prompt += f" Include the text '{overlay_text}' as a typographic element in the image."

    logger.info(f"Generating image via provider={provider_name} model={image_options.model}")
    provider = _get_provider(provider_name, user_id=user_id)
    
    # Track response time
    import time
    start_time = time.time()
    result = provider.generate(image_options)
    response_time = time.time() - start_time
    
    # TRACK USAGE after successful API call - Reuse extracted helper
    if user_id and result and result.image_bytes:
        logger.info(f"[Image Generation] ✅ API call successful, tracking usage for user {user_id}")
        
        # Calculate cost from result metadata or estimate
        estimated_cost = 0.0
        if result.metadata and "estimated_cost" in result.metadata:
            estimated_cost = float(result.metadata["estimated_cost"])
        else:
            # Fallback: estimate based on provider/model
            if provider_name == "wavespeed":
                estimated_cost = 0.30
            elif provider_name == "stability":
                estimated_cost = 0.30
            else:
                estimated_cost = 0.30
        
        # Reuse tracking helper
        _track_image_operation_usage(
            user_id=user_id,
            provider=provider_name,
            model=result.model or "unknown",
            operation_type="image-generation",
            result_bytes=result.image_bytes,
            cost=estimated_cost,
            prompt=prompt,
            endpoint="/image-generation",
            metadata=result.metadata,
            log_prefix="[Image Generation]",
            response_time=response_time
        )
    else:
        logger.warning(f"[Image Generation] ⚠️ Skipping usage tracking: user_id={user_id}, image_bytes={len(result.image_bytes) if result.image_bytes else 0} bytes")
    
    return result


def generate_character_image(
    prompt: str,
    reference_image_bytes: bytes,
    user_id: Optional[str] = None,
    style: str = "Realistic",
    aspect_ratio: str = "16:9",
    rendering_speed: str = "Quality",
    timeout: Optional[int] = None,
) -> bytes:
    """Generate character-consistent image with pre-flight validation and usage tracking.
    
    Uses Ideogram Character API via WaveSpeed to maintain character consistency.
    
    Args:
        prompt: Text prompt describing the scene/context for the character
        reference_image_bytes: Reference image bytes (base avatar)
        user_id: User ID for subscription checking (required)
        style: Character style type ("Auto", "Fiction", or "Realistic")
        aspect_ratio: Aspect ratio ("1:1", "16:9", "9:16", "4:3", "3:4")
        rendering_speed: Rendering speed ("Default", "Turbo", "Quality")
        timeout: Total timeout in seconds for submission + polling (default: 180)
        
    Returns:
        bytes: Generated image bytes with consistent character
    """
    # PRE-FLIGHT VALIDATION: Reuse extracted helper
    _validate_image_operation(
        user_id=user_id,
        operation_type="character-image-generation",
        num_operations=1,
        log_prefix="[Character Image Generation]"
    )
    
    # Generate character image via WaveSpeed
    from services.wavespeed.client import WaveSpeedClient
    from fastapi import HTTPException
    
    try:
        wavespeed_client = WaveSpeedClient()
        image_bytes = wavespeed_client.generate_character_image(
            prompt=prompt,
            reference_image_bytes=reference_image_bytes,
            style=style,
            aspect_ratio=aspect_ratio,
            rendering_speed=rendering_speed,
            timeout=timeout,
        )
        
        # TRACK USAGE after successful API call - Reuse extracted helper
        if user_id and image_bytes:
            logger.info(f"[Character Image Generation] ✅ API call successful, tracking usage for user {user_id}")
            
            # Character image cost
            estimated_cost = 0.30
            
            # Reuse tracking helper
            _track_image_operation_usage(
                user_id=user_id,
                provider="wavespeed",
                model="ideogram-character",
                operation_type="character-image-generation",
                result_bytes=image_bytes,
                cost=estimated_cost,
                prompt=prompt,
                endpoint="/image-generation/character",
                metadata=None,
                log_prefix="[Character Image Generation]"
            )
        else:
            logger.warning(f"[Character Image Generation] ⚠️ Skipping usage tracking: user_id={user_id}, image_bytes={len(image_bytes) if image_bytes else 0} bytes")
        
        return image_bytes
        
    except HTTPException:
        raise
    except Exception as api_error:
        logger.error(f"[Character Image Generation] Character image generation API failed: {api_error}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Character image generation failed",
                "message": str(api_error)
            }
        )



        
    except HTTPException:
        raise
    except Exception as api_error:
        logger.error(f"[Face Swap] Face swap API failed: {api_error}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": "Face swap failed",
                "message": str(api_error)
            }
        )
    
    # 6. REUSE: Tracking helper
    if user_id and result and result.image_bytes:
        logger.info(f"[Image Edit] ✅ API call successful, tracking usage for user {user_id}")
        
        # Get cost from result metadata or estimate
        estimated_cost = 0.0
        if result.metadata and "estimated_cost" in result.metadata:
            estimated_cost = float(result.metadata["estimated_cost"])
        else:
            estimated_cost = 0.30
        
        # Reuse tracking helper
        _track_image_operation_usage(
            user_id=user_id,
            provider=provider_name,
            model=result.model or model or "unknown",
            operation_type="image-edit",
            result_bytes=result.image_bytes,
            cost=estimated_cost,
            prompt=prompt,
            endpoint="/image-generation/edit",
            metadata=result.metadata,
            log_prefix="[Image Edit]"
        )
    else:
        logger.warning(f"[Image Edit] ⚠️ Skipping usage tracking: user_id={user_id}, image_bytes={len(result.image_bytes) if result.image_bytes else 0} bytes")
    
    return result


async def generate_image_with_provider(
    prompt: str,
    user_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Async wrapper for generate_image to support step4_asset_routes.
    """
    # Construct options from kwargs
    options = kwargs.copy()
    
    try:
        # Run in threadpool since generate_image is blocking
        result = await run_in_threadpool(
            generate_image,
            prompt=prompt,
            options=options,
            user_id=user_id
        )
        
        image_base64 = base64.b64encode(result.image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "image_base64": image_base64,
            "image_url": None, 
            "error": None,
            "metadata": result.metadata
        }
    except Exception as e:
        logger.error(f"Error in generate_image_with_provider: {e}")
        # Propagate specific error message if available
        error_detail = str(e)
        if "402" in error_detail or "Payment Required" in error_detail:
            raise HTTPException(status_code=402, detail=f"Payment Required: {error_detail}")
        
        return {
            "success": False,
            "error": error_detail
        }


import time
from services.database import get_session_for_user
from models.onboarding import WebsiteAnalysis, OnboardingSession, CompetitorAnalysis

async def enhance_image_prompt(prompt: str, user_id: Optional[str] = None) -> str:
    """
    Enhance image prompt using WaveSpeed's specialized prompt optimizer.
    Restructures and enriches prompts for visual clarity and cinematic detail.
    Uses Step 2 (Website Analysis) and Step 3 (Competitor Analysis) context if available.
    """
    start_time = time.time()
    try:
        from services.wavespeed.client import WaveSpeedClient
        
        # 1. Pre-flight Validation
        if user_id:
            _validate_image_operation(
                user_id=user_id,
                operation_type="prompt-enhancement",
                num_operations=1,
                log_prefix="[Prompt Enhancement]"
            )

        # 2. Fetch Context from Step 2 & 3
        context_instruction = ""
        if user_id:
            try:
                db_session = get_session_for_user(user_id)
                try:
                    # Get Onboarding Session
                    session = db_session.query(OnboardingSession).filter(
                        OnboardingSession.user_id == user_id
                    ).first()
                    
                    if session:
                        # Step 2: Website Analysis
                        website_analysis = db_session.query(WebsiteAnalysis).filter(
                            WebsiteAnalysis.session_id == session.id
                        ).first()
                        
                        if website_analysis:
                            # Handle potential JSON or dict types
                            brand_voice = website_analysis.brand_analysis
                            style = website_analysis.style_guidelines
                            target_audience = website_analysis.target_audience
                            
                            context_instruction += "\n\nCONTEXT FROM WEBSITE ANALYSIS:\n"
                            if target_audience:
                                context_instruction += f"Target Audience: {target_audience}\n"
                            
                            if brand_voice and isinstance(brand_voice, dict):
                                context_instruction += f"Brand Voice: {brand_voice.get('voice_characteristics', '')} - {brand_voice.get('tone', '')}\n"
                            
                            if style and isinstance(style, dict):
                                context_instruction += f"Visual Style: {style.get('visual_style', '')} - {style.get('color_palette', '')}\n"

                        # Step 3: Competitor Analysis (Limit to top 3)
                        competitors = db_session.query(CompetitorAnalysis).filter(
                            CompetitorAnalysis.session_id == session.id
                        ).limit(3).all()
                        
                        if competitors:
                            context_instruction += "\nCOMPETITOR VISUAL INSIGHTS:\n"
                            for comp in competitors:
                                if comp.analysis_data and isinstance(comp.analysis_data, dict):
                                    comp_title = comp.analysis_data.get('title', 'Competitor')
                                    # Try to extract visual/content insights if available
                                    highlights = comp.analysis_data.get('highlights', [])
                                    if highlights:
                                        context_instruction += f"- {comp_title}: {', '.join(highlights[:2])}\n"
                                    
                finally:
                    db_session.close()
            except Exception as db_ex:
                logger.warning(f"Failed to fetch context for prompt enhancement: {db_ex}")
        
        # Combine prompt with context
        full_input_text = prompt
        if context_instruction:
            logger.info(f"Enhancing prompt for user {user_id} with Step 2/3 context")
            # We append context as instruction for the optimizer
            full_input_text = f"Original Request: {prompt}\n\n{context_instruction}\n\nTask: Generate a hyper-personalized, detailed image generation prompt based on the Original Request and the provided Context. Ensure the visual style aligns with the Brand Voice and Visual Style."
        else:
            logger.info(f"Enhancing prompt for user {user_id} (no context found)")

        # 3. Call WaveSpeed
        client = WaveSpeedClient()
        # Use 'image' mode for avatar/image generation workflows
        # Use 'photographic' style as requested for avatars
        optimized_prompt = client.optimize_prompt(
            text=full_input_text,
            mode="image", 
            style="photographic",
            enable_sync_mode=True,
            timeout=30
        )
        
        # 4. Track Usage
        if user_id:
            duration = time.time() - start_time
            # Track as 0 cost for now unless we have specific pricing for prompt opt
            # But we track it as an operation
            _track_image_operation_usage(
                user_id=user_id,
                provider="wavespeed",
                model="wavespeed-prompt-opt",
                operation_type="prompt-enhancement",
                result_bytes=b"", # No image
                cost=0.0, 
                prompt=prompt,
                endpoint="/enhance-prompt",
                metadata={"duration": duration, "context_added": bool(context_instruction)},
                log_prefix="[Prompt Enhancement]",
                response_time=duration
            )
        
        return optimized_prompt
        
    except Exception as e:
        logger.error(f"Failed to enhance prompt via WaveSpeed: {e}")
        # Fallback to original prompt on failure
        return prompt


async def generate_image_variation(
    image: Any, 
    prompt: str,
    user_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Generate variation of an existing image using image-to-image editing.
    Wrapper for step4_asset_routes.
    """
    try:
        # Handle image input (bytes, file, or base64)
        image_bytes = None
        if isinstance(image, bytes):
            image_bytes = image
        elif hasattr(image, "read"):
            image_bytes = await image.read()
        elif isinstance(image, str):
            # Assume base64 or path
            if os.path.exists(image):
                with open(image, "rb") as f:
                    image_bytes = f.read()
            else:
                # Try base64 decode
                try:
                    if "base64," in image:
                        image = image.split("base64,")[1]
                    image_bytes = base64.b64decode(image)
                except:
                    pass
        
        if not image_bytes:
            return {"success": False, "error": "Invalid image input"}

        # Convert to base64 for internal function
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use generate_image_edit with "variation" intent
        # For variation, we typically use general_edit with specific prompt
        result = await run_in_threadpool(
            generate_image_edit,
            image_base64=image_base64,
            prompt=prompt,
            operation="general_edit",
            model=kwargs.get("model", "qwen-edit-plus"), # Default to capable model
            options=kwargs,
            user_id=user_id
        )
        
        result_base64 = base64.b64encode(result.image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "image_base64": result_base64,
            "metadata": result.metadata
        }
        
    except Exception as e:
        logger.error(f"Error in generate_image_variation: {e}")
        return {
            "success": False, 
            "error": str(e)
        }


async def generate_image_enhance(
    image: Any,
    user_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Enhance/Upscale an existing image.
    Wrapper for step4_asset_routes.
    """
    try:
        # Handle image input
        image_bytes = None
        if isinstance(image, bytes):
            image_bytes = image
        elif hasattr(image, "read"):
            image_bytes = await image.read()
        elif isinstance(image, str):
            if os.path.exists(image):
                with open(image, "rb") as f:
                    image_bytes = f.read()
            else:
                try:
                    if "base64," in image:
                        image = image.split("base64,")[1]
                    image_bytes = base64.b64decode(image)
                except:
                    pass
        
        if not image_bytes:
            return {"success": False, "error": "Invalid image input"}

        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use generate_image_edit with "enhance" intent
        # Use high-res model like nano-banana-pro-edit-ultra
        result = await run_in_threadpool(
            generate_image_edit,
            image_base64=image_base64,
            prompt="enhance details, high resolution, professional quality, 4k, sharp focus",
            operation="general_edit",
            model="nano-banana-pro-edit-ultra",
            options={**kwargs, "resolution": "4k"},
            user_id=user_id
        )
        
        result_base64 = base64.b64encode(result.image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "image_base64": result_base64,
            "metadata": result.metadata
        }
        
    except Exception as e:
        logger.error(f"Error in generate_image_enhance: {e}")
        return {
            "success": False, 
            "error": str(e)
        }



