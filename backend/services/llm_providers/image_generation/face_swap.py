"""Face swap operations — generate_face_swap and related helpers."""

from typing import Optional, Dict, Any
from fastapi import HTTPException

from .base import FaceSwapOptions, FaceSwapProvider, ImageGenerationResult
from .wavespeed_face_swap_provider import WaveSpeedFaceSwapProvider
from .helpers import _validate_image_operation, _track_image_operation_usage
from utils.logger_utils import get_service_logger

logger = get_service_logger("image_generation.face_swap")


def _get_face_swap_provider(provider_name: str) -> FaceSwapProvider:
    """Get face swap provider by name."""
    if provider_name == "wavespeed":
        return WaveSpeedFaceSwapProvider()
    raise ValueError(f"Unknown face swap provider: {provider_name}")


def generate_face_swap(
    base_image_base64: str,
    face_image_base64: str,
    model: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None
) -> ImageGenerationResult:
    """Generate face swap with pre-flight validation and usage tracking.

    Args:
        base_image_base64: Base64-encoded base image (or data URI)
        face_image_base64: Base64-encoded face image to swap (or data URI)
        model: Model ID to use (default: auto-select)
        options: Additional options (target_face_index, target_gender, etc.)
        user_id: User ID for validation and tracking

    Returns:
        ImageGenerationResult with swapped face image

    Raises:
        HTTPException: If validation fails or face swap fails
        ValueError: If options are invalid
    """
    # 1. REUSE: Validation helper
    _validate_image_operation(
        user_id=user_id,
        operation_type="face-swap",
        num_operations=1,
        log_prefix="[Face Swap]"
    )

    # 2. Get provider (default to wavespeed)
    provider_name = "wavespeed"
    provider = _get_face_swap_provider(provider_name)

    # 3. Prepare options
    face_swap_options = FaceSwapOptions(
        base_image_base64=base_image_base64,
        face_image_base64=face_image_base64,
        model=model,
        target_face_index=options.get("target_face_index") if options else None,
        target_gender=options.get("target_gender") if options else None,
        extra=options,
    )

    # 4. Swap face
    try:
        result = provider.swap_face(face_swap_options)

        # 5. REUSE: Tracking helper
        if user_id and result and result.image_bytes:
            logger.info(f"[Face Swap] ✅ API call successful, tracking usage for user {user_id}")

            model_id = model or (list(WaveSpeedFaceSwapProvider.SUPPORTED_MODELS.keys())[0] if WaveSpeedFaceSwapProvider.SUPPORTED_MODELS else "image-face-swap-pro")
            from services.subscription import get_face_swap_model_cost
            if result.metadata and "estimated_cost" in result.metadata:
                estimated_cost = float(result.metadata["estimated_cost"])
            else:
                estimated_cost = get_face_swap_model_cost(model_id, default=0.025)

            _track_image_operation_usage(
                user_id=user_id,
                provider=provider_name,
                model=model_id,
                operation_type="face-swap",
                result_bytes=result.image_bytes,
                cost=estimated_cost,
                prompt=None,
                endpoint="/image-studio/face-swap/process",
                metadata={
                    "base_image_size": len(base_image_base64),
                    "face_image_size": len(face_image_base64),
                },
                log_prefix="[Face Swap]"
            )
        else:
            logger.warning(f"[Face Swap] ⚠️ Skipping usage tracking: user_id={user_id}")

        return result

    except HTTPException:
        raise
    except Exception as api_error:
        logger.error(f"[Face Swap] Face swap API failed: {api_error}")
        raise HTTPException(
            status_code=502,
            detail={"error": "Face swap failed", "message": str(api_error)}
        )
