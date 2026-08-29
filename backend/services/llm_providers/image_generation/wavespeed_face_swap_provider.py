"""WaveSpeed Face Swap Provider for Image Studio."""

from __future__ import annotations

import base64
import io
from typing import Optional, Dict, Any
from PIL import Image

from services.llm_providers.image_generation.base import (
    FaceSwapOptions,
    FaceSwapProvider,
    ImageGenerationResult,
)
from services.wavespeed.client import WaveSpeedClient
from utils.logger_utils import get_service_logger

logger = get_service_logger("llm_providers.wavespeed_face_swap")


class WaveSpeedFaceSwapProvider:
    """WaveSpeed provider for face swap operations."""

    SUPPORTED_MODELS = {
        "image-face-swap-pro": {
            "model_path": "wavespeed-ai/image-face-swap-pro",
            "name": "Image Face Swap Pro",
            "description": "Instant online AI face swap for photos with no watermark, delivering realistic, shareable results in seconds.",
            "cost": 0.025,
            "tier": "mid",
            "capabilities": ["face_swap", "realistic_blending"],
            "features": ["Enhanced blending", "Realistic results", "Watermark-free"],
            "max_faces": 1,
            "api_params": {
                "output_format": "jpeg",
                "supports_base64": True,
                "supports_sync": True,
            },
        },
        "image-head-swap": {
            "model_path": "wavespeed-ai/image-head-swap",
            "name": "Image Head Swap",
            "description": "Instant online AI head & face swap for photos with no watermark. Replaces entire head (face + hair + outline) while preserving body, pose and background.",
            "cost": 0.025,
            "tier": "mid",
            "capabilities": ["head_swap", "full_head_replacement", "realistic_blending"],
            "features": ["Full head replacement", "Hair included", "Pose preservation", "Watermark-free"],
            "max_faces": 1,
            "api_params": {
                "output_format": "jpeg",
                "supports_base64": True,
                "supports_sync": True,
            },
        },
        "akool-face-swap": {
            "model_path": "akool/image-face-swap",
            "name": "Akool Image Face Swap",
            "description": "Powerful AI-powered face swapping with multi-face replacement for group photos. Seamlessly replaces faces with natural lighting and skin tone matching.",
            "cost": 0.16,
            "tier": "premium",
            "capabilities": ["face_swap", "multi_face", "realistic_blending", "face_enhancement"],
            "features": ["Multi-face swapping (up to 5)", "Face enhancement", "Group photos", "High-quality blending"],
            "max_faces": 5,  # Supports 1-5 faces
            "api_params": {
                "uses_source_target_arrays": True,  # Uses source_image and target_image arrays
                "supports_face_enhance": True,
                "supports_base64": True,
                "supports_sync": False,  # May need polling
            },
        },
        "infinite-you": {
            "model_path": "wavespeed-ai/infinite-you",
            "name": "InfiniteYou",
            "description": "High-quality face swapping powered by ByteDance's zero-shot identity preservation technology. Maintains facial identity characteristics with exceptional realism.",
            "cost": 0.03,
            "tier": "mid",
            "capabilities": ["face_swap", "identity_preservation", "realistic_blending"],
            "features": ["Zero-shot learning", "Identity preservation", "High-quality results", "Fast processing"],
            "max_faces": 1,
            "api_params": {
                "uses_source_target_names": True,  # Uses source_image and target_image (not image/face_image)
                "target_is_base": True,  # target_image is the base image (where face will be swapped)
                "source_is_face": True,  # source_image is the face to swap in
                "supports_seed": True,  # Supports seed parameter
                "supports_base64": True,
                "supports_sync": True,
            },
        },
        # Placeholder for additional models (will be added as docs are provided)
        # "image-face-swap": {...},  # Basic version ($0.01)
    }

    def __init__(self):
        self.client = WaveSpeedClient()

    def _validate_options(self, options: FaceSwapOptions) -> None:
        """Validate face swap options."""
        if not options.base_image_base64:
            raise ValueError("base_image_base64 is required")
        if not options.face_image_base64:
            raise ValueError("face_image_base64 is required")

        # Validate model
        if options.model and options.model not in self.SUPPORTED_MODELS:
            raise ValueError(
                f"Unsupported model: {options.model}. "
                f"Supported models: {list(self.SUPPORTED_MODELS.keys())}"
            )

    def _extract_image_url(self, data_url: str) -> str:
        """Extract image URL from data URL or return as-is if already a URL."""
        if data_url.startswith("data:image"):
            # It's a data URL, we'll need to upload it
            return data_url
        return data_url

    def _upload_image_if_needed(self, image_data: str) -> str:
        """Upload image if it's a base64 data URL, otherwise return URL."""
        if image_data.startswith("data:image"):
            # Extract base64 data
            header, encoded = image_data.split(",", 1)
            image_bytes = base64.b64decode(encoded)
            
            # Upload to temporary storage (or use WaveSpeed upload endpoint if available)
            # For now, we'll return the data URL and let the API handle it
            # In production, you might want to upload to S3/CloudFlare first
            return image_data
        return image_data

    def _call_wavespeed_face_swap_api(
        self, options: FaceSwapOptions, model_info: Dict[str, Any]
    ) -> ImageGenerationResult:
        """Call WaveSpeed face swap API."""
        import requests
        from fastapi import HTTPException
        
        model_path = model_info["model_path"]
        api_params = model_info.get("api_params", {})
        uses_source_target_arrays = api_params.get("uses_source_target_arrays", False)

        # Prepare images - extract base64 if data URI
        base_image = options.base_image_base64
        if base_image.startswith("data:image"):
            # Keep as data URI - API should accept it
            pass
        elif not base_image.startswith("http"):
            # Assume it's base64, convert to data URI
            base_image = f"data:image/png;base64,{base_image}"
        
        face_image = options.face_image_base64
        if face_image.startswith("data:image"):
            # Keep as data URI
            pass
        elif not face_image.startswith("http"):
            # Assume it's base64, convert to data URI
            face_image = f"data:image/png;base64,{face_image}"

        # Build API payload - handle different API formats
        uses_source_target_names = api_params.get("uses_source_target_names", False)
        
        if uses_source_target_arrays:
            # Akool format: uses source_image and target_image as arrays
            # For single face swap: source_image is the new face, target_image is reference from main image
            # Since we only have one face_image, we'll use it as source and the base_image as target reference
            payload = {
                "image": base_image,
                "source_image": [face_image],  # Array of source faces (1-5) - the new face to swap in
                "target_image": [base_image],  # Array of target faces (1-5) - reference from main image
                "face_enhance": api_params.get("supports_face_enhance", True),  # Default to True for Akool
                "enable_base64_output": True,
            }
            
            # Allow override from extra params
            if options.extra:
                if "source_image" in options.extra:
                    payload["source_image"] = options.extra["source_image"]
                if "target_image" in options.extra:
                    payload["target_image"] = options.extra["target_image"]
                if "face_enhance" in options.extra:
                    payload["face_enhance"] = options.extra["face_enhance"]
        elif uses_source_target_names:
            # InfiniteYou format: uses source_image and target_image (single values, different names)
            # target_image = base image (where face will be swapped)
            # source_image = face image (face to swap in)
            payload = {
                "target_image": base_image,  # Base image where face will be swapped
                "source_image": face_image,  # Face to swap in
                "enable_base64_output": True,
            }
            
            # Add seed if supported
            if api_params.get("supports_seed", False):
                seed = options.extra.get("seed") if options.extra else None
                payload["seed"] = seed if seed is not None else -1  # Default to -1 (random)
            
            # Allow override from extra params
            if options.extra:
                if "source_image" in options.extra:
                    payload["source_image"] = options.extra["source_image"]
                if "target_image" in options.extra:
                    payload["target_image"] = options.extra["target_image"]
                if "seed" in options.extra and api_params.get("supports_seed", False):
                    payload["seed"] = options.extra["seed"]
        else:
            # Standard format: uses image and face_image (single values)
            payload = {
                "image": base_image,
                "face_image": face_image,
                "output_format": api_params.get("output_format", "jpeg"),
                "enable_base64_output": True,  # Always get base64 for our use case
                "enable_sync_mode": True,  # Use sync mode for immediate results
            }

        # Add any extra parameters (filter out already handled ones)
        if options.extra:
            handled_keys = {"source_image", "target_image", "face_enhance", "output_format", "enable_sync_mode", "seed"}
            for key, value in options.extra.items():
                if key not in handled_keys:
                    payload[key] = value

        url = f"{self.client.BASE_URL}/{model_path}"
        headers = self.client._headers()

        logger.info(f"[Face Swap] Calling WaveSpeed API: {url}")
        logger.debug(f"[Face Swap] Payload keys: {list(payload.keys())}")

        try:
            # Call API
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            
            if response.status_code != 200:
                logger.error(f"[Face Swap] API call failed: {response.status_code} {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "WaveSpeed face swap failed",
                        "status_code": response.status_code,
                        "response": response.text,
                    },
                )

            response_json = response.json()
            data = response_json.get("data") or response_json
            
            # Check status - Akool uses different status values
            status = data.get("status", "").lower()
            # Akool uses "output" (singular), others use "outputs" (plural)
            outputs = data.get("outputs") or data.get("output") or []
            # Normalize to list if it's a single value
            if not isinstance(outputs, list):
                outputs = [outputs] if outputs else []
            
            prediction_id = data.get("id")
            
            # Handle completed status - Akool uses "succeeded", others use "completed"
            is_completed = status in ["completed", "succeeded"]
            
            # Handle sync mode - result should be directly in outputs
            if outputs and is_completed:
                logger.info(f"[Face Swap] Got immediate results (status: {status})")
                # Extract image URL or base64
                output = outputs[0]
                if output.startswith("data:image") or output.startswith("http"):
                    if output.startswith("http"):
                        # Download from URL
                        import requests
                        img_response = requests.get(output, timeout=60)
                        img_response.raise_for_status()
                        image_bytes = img_response.content
                    else:
                        # Extract base64 from data URI
                        image_bytes = base64.b64decode(output.split(",", 1)[1])
                else:
                    # Assume it's base64 string
                    image_bytes = base64.b64decode(output)
            elif prediction_id:
                # Need to poll
                logger.info(f"[Face Swap] Polling for result (prediction_id: {prediction_id}, status: {status})")
                result = self.client.poll_until_complete(prediction_id, timeout_seconds=120, interval_seconds=1.0)
                # Check both outputs and output fields
                outputs = result.get("outputs") or result.get("output") or []
                if not isinstance(outputs, list):
                    outputs = [outputs] if outputs else []
                if not outputs:
                    raise HTTPException(status_code=502, detail="WaveSpeed face swap returned no outputs")
                output = outputs[0]
                if output.startswith("http"):
                    import requests
                    img_response = requests.get(output, timeout=60)
                    img_response.raise_for_status()
                    image_bytes = img_response.content
                elif output.startswith("data:image"):
                    image_bytes = base64.b64decode(output.split(",", 1)[1])
                else:
                    image_bytes = base64.b64decode(output)
            else:
                raise HTTPException(status_code=502, detail="WaveSpeed face swap response missing outputs and prediction ID")

            # Get image dimensions
            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size

            logger.info(f"[Face Swap] ✅ Successfully swapped face: {len(image_bytes)} bytes, {width}x{height}")

            from services.subscription import get_face_swap_model_cost
            model_key = options.model or model_path
            estimated_cost = get_face_swap_model_cost(model_key, default=model_info.get("cost", 0.025))

            return ImageGenerationResult(
                image_bytes=image_bytes,
                width=width,
                height=height,
                provider="wavespeed",
                model=model_key,
                metadata={
                    "model_path": model_path,
                    "status": status,
                    "created_at": data.get("created_at"),
                    "estimated_cost": estimated_cost,
                },
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[Face Swap] API call failed: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Face swap failed",
                    "message": str(e)
                }
            )

    def swap_face(self, options: FaceSwapOptions) -> ImageGenerationResult:
        """Swap face in image using WaveSpeed models."""
        self._validate_options(options)

        # Determine model
        model_id = options.model
        if not model_id:
            # Default to first available model
            model_id = list(self.SUPPORTED_MODELS.keys())[0]
            logger.info(f"[Face Swap] No model specified, using default: {model_id}")

        model_info = self.SUPPORTED_MODELS[model_id]

        # Call API
        return self._call_wavespeed_face_swap_api(options, model_info)

    @classmethod
    def get_available_models(cls) -> dict:
        """Get available face swap models and their information."""
        return cls.SUPPORTED_MODELS

    @classmethod
    def get_models_by_tier(cls, tier: str) -> dict:
        """Get models filtered by tier (budget, mid, premium)."""
        return {
            model_id: model_info
            for model_id, model_info in cls.SUPPORTED_MODELS.items()
            if model_info.get("tier") == tier
        }

    @classmethod
    def get_models_by_capability(cls, capability: str) -> dict:
        """Get models that support a specific capability."""
        return {
            model_id: model_info
            for model_id, model_info in cls.SUPPORTED_MODELS.items()
            if capability in model_info.get("capabilities", [])
        }
