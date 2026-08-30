"""Image editing operations — generate_image_edit and related helpers."""

from typing import Optional, Dict, Any
from fastapi import HTTPException

from .base import ImageEditOptions, ImageGenerationResult, ImageEditProvider
from .wavespeed_edit_provider import WaveSpeedEditProvider
from .helpers import _validate_image_operation, _track_image_operation_usage
from utils.logger_utils import get_service_logger

logger = get_service_logger("image_generation.edit")


def _get_edit_provider(provider_name: str) -> ImageEditProvider:
    """Get editing provider instance by name."""
    if provider_name == "wavespeed":
        return WaveSpeedEditProvider()
    raise ValueError(f"Unknown edit provider: {provider_name}")


def generate_image_edit(
    image_base64: str,
    prompt: str,
    operation: str = "general_edit",
    model: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None
) -> ImageGenerationResult:
    """Generate edited image with pre-flight validation and usage tracking.

    Args:
        image_base64: Base64-encoded input image (or data URI)
        prompt: Edit instruction prompt
        operation: Type of edit operation (e.g., "general_edit", "inpaint", "outpaint")
        model: Model ID to use (default: auto-select based on provider)
        options: Additional options (mask_base64, negative_prompt, width, height, etc.)
        user_id: User ID for validation and tracking

    Returns:
        ImageGenerationResult with edited image

    Raises:
        HTTPException: If validation fails or editing fails
        ValueError: If options are invalid
    """
    # 1. REUSE: Validation helper
    _validate_image_operation(
        user_id=user_id,
        operation_type="image-edit",
        num_operations=1,
        log_prefix="[Image Edit]"
    )

    # 2. Determine provider from model or default to wavespeed
    opts = options or {}
    provider_name = opts.get("provider", "wavespeed")

    if model and (model.startswith("wavespeed") or model.startswith("qwen") or model.startswith("flux") or model.startswith("nano-banana")):
        provider_name = "wavespeed"

    # 3. Get provider
    try:
        provider = _get_edit_provider(provider_name)
    except ValueError as e:
        logger.error(f"[Image Edit] ❌ Provider error: {str(e)}")
        raise ValueError(f"Unsupported edit provider: {provider_name}")

    # 4. Prepare edit options
    edit_options = ImageEditOptions(
        image_base64=image_base64,
        prompt=prompt,
        operation=operation,
        mask_base64=opts.get("mask_base64"),
        negative_prompt=opts.get("negative_prompt"),
        model=model,
        width=opts.get("width"),
        height=opts.get("height"),
        guidance_scale=opts.get("guidance_scale"),
        steps=opts.get("steps"),
        seed=opts.get("seed"),
        extra=opts.get("extra"),
    )

    # 5. Edit image
    logger.info(f"[Image Edit] Starting edit: operation={operation}, model={model}, provider={provider_name}")
    try:
        result = provider.edit(edit_options)
    except Exception as e:
        logger.error(f"[Image Edit] ❌ Edit failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail={"error": "Image editing failed", "message": str(e)}
        )

    # 6. REUSE: Tracking helper
    if user_id and result and result.image_bytes:
        logger.info(f"[Image Edit] ✅ API call successful, tracking usage for user {user_id}")
        estimated_cost = 0.0
        if result.metadata and "estimated_cost" in result.metadata:
            estimated_cost = float(result.metadata["estimated_cost"])
        else:
            from services.subscription import get_image_edit_model_cost
            resolution = (opts.get("extra") or {}).get("resolution") if opts else None
            estimated_cost = get_image_edit_model_cost(
                model_name=result.model or model or "qwen-edit",
                resolution=resolution,
                default=0.02
            )

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
        logger.warning(f"[Image Edit] ⚠️ Skipping usage tracking: user_id={user_id}")

    # 7. Return result
    return result
