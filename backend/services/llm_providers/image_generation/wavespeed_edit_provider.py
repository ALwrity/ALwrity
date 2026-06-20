"""WaveSpeed AI image editing provider (14 editing models)."""

import io
import os
import requests
from typing import Optional
from PIL import Image
from fastapi import HTTPException

from .base import ImageEditProvider, ImageEditOptions, ImageGenerationResult
from services.wavespeed.client import WaveSpeedClient
from utils.logger_utils import get_service_logger


logger = get_service_logger("wavespeed.edit_provider")


class WaveSpeedEditProvider(ImageEditProvider):
    """WaveSpeed AI image editing provider supporting 14 editing models.
    
    REUSES: WaveSpeedClient, model registry pattern, result format
    """
    
    # Model registry - populated with WaveSpeed editing models
    SUPPORTED_MODELS = {
        "qwen-edit": {
            "model_path": "wavespeed-ai/qwen-image/edit",
            "name": "Qwen Image Edit",
            "description": "20B MMDiT image-to-image model offering precise bilingual (Chinese & English) text edits while preserving style. Single-image editing with style preservation.",
            "cost": 0.02,  # Same as Plus version
            "max_resolution": (1536, 1536),  # Based on docs: similar to Plus
            "capabilities": ["general_edit", "style_transfer", "text_edit"],
            "tier": "budget",
            "supports_multi_image": False,  # Single image only (uses "image" not "images")
            "supports_controlnet": False,  # Not mentioned in docs
            "languages": ["en", "zh"],
            "api_params": {
                "uses_size": True,  # Uses "size" parameter (width*height)
                "uses_aspect_ratio": False,
                "uses_resolution": False,
                "uses_image_singular": True,  # Uses "image" (singular) not "images" (array)
                "default_output_format": "jpeg",  # Per API docs: default is "jpeg"
                "supports_seed": True,  # Per API docs: seed parameter supported
            }
        },
        "qwen-edit-plus": {
            "model_path": "wavespeed-ai/qwen-image/edit-plus",
            "name": "Qwen Image Edit Plus",
            "description": "20B MMDiT image editor with multi-image editing, single-image consistency and native ControlNet support. Bilingual (CN/EN) text editing, appearance-level and semantic-level edits.",
            "cost": 0.02,
            "max_resolution": (1536, 1536),  # Based on docs: 256-1536 per dimension
            "capabilities": ["general_edit", "style_transfer", "text_edit", "multi_image"],
            "tier": "budget",
            "supports_multi_image": True,  # Up to 3 reference images
            "supports_controlnet": True,
            "languages": ["en", "zh"],
            "api_params": {
                "uses_size": True,  # Uses "size" parameter (width*height)
                "uses_aspect_ratio": False,
                "uses_resolution": False,
                "uses_image_singular": False,  # Uses "images" (array)
                "supports_seed": True,  # Seed parameter supported (default for Qwen models)
            }
        },
        "nano-banana-pro-edit-ultra": {
            "model_path": "google/nano-banana-pro/edit-ultra",
            "name": "Google Nano Banana Pro Edit Ultra",
            "description": "High-resolution image editing with 4K/8K native output. Natural language instructions, multilingual text support. Premium quality editing for professional marketing and high-res work.",
            "cost": 0.15,  # 4K - from enhancement proposal
            "cost_8k": 0.18,  # 8K - from enhancement proposal
            "max_resolution": (8192, 8192),  # 8K support
            "capabilities": ["general_edit", "high_res", "professional", "typography"],
            "tier": "premium",
            "supports_multi_image": True,  # Up to 14 reference images
            "supports_controlnet": False,
            "languages": ["en", "multilingual"],
            "api_params": {
                "uses_size": False,  # Uses aspect_ratio and resolution instead
                "uses_aspect_ratio": True,  # "1:1", "16:9", etc.
                "uses_resolution": True,  # "4k" or "8k"
                "max_images": 14,
                "default_output_format": "png",  # Per API docs: default is "png"
                "supports_seed": False,  # Per API docs: no seed parameter
            }
        },
        "seedream-v4.5-edit": {
            "model_path": "bytedance/seedream-v4.5/edit",
            "name": "Bytedance Seedream V4.5 Edit",
            "description": "Preserves facial features, lighting, and color tone from reference images, delivering professional, high-fidelity edits up to 4K with strong prompt adherence. Reference-faithful editing with multi-image support.",
            "cost": 0.04,  # Per generated image
            "max_resolution": (4096, 4096),  # 4K support (1024-4096 per dimension)
            "capabilities": ["general_edit", "portrait_retouching", "fashion_edit", "product_edit", "multi_image"],
            "tier": "mid",
            "supports_multi_image": True,  # Up to 10 reference images
            "supports_controlnet": False,
            "languages": ["en"],
            "api_params": {
                "uses_size": True,  # Uses "size" parameter (width*height format, 1024-4096 per dimension)
                "uses_aspect_ratio": False,
                "uses_resolution": False,
                "max_images": 10,
                "default_output_format": "png",
                "supports_seed": False,  # No seed parameter in API docs (Seedream V4.5)
            }
        },
        "flux-kontext-pro": {
            "model_path": "wavespeed-ai/flux-kontext-pro",
            "name": "FLUX Kontext Pro",
            "description": "FLUX.1 Kontext [pro] offers improved prompt adherence and accurate typography generation for consistent, high-quality edits at speed. Typography-focused editing with improved prompt adherence.",
            "cost": 0.04,  # From enhancement proposal
            "max_resolution": (2048, 2048),  # Estimated, not specified in docs
            "capabilities": ["general_edit", "typography", "text_edit", "style_transfer"],
            "tier": "mid",
            "supports_multi_image": False,  # Single image only (uses "image" not "images")
            "supports_controlnet": False,
            "languages": ["en"],
            "api_params": {
                "uses_size": False,  # Uses aspect_ratio instead
                "uses_aspect_ratio": True,  # Aspect ratio as string (e.g., "16:9", "1:1")
                "uses_resolution": False,
                "uses_image_singular": True,  # Uses "image" (singular) not "images" (array)
                "supports_guidance_scale": True,  # Has guidance_scale parameter (default 3.5, range 1-20)
                "default_guidance_scale": 3.5,  # Per API docs
                "supports_seed": False,  # No seed parameter in API docs
            }
        },
        # TODO: Add remaining 9 models once docs are provided
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize WaveSpeed edit provider.
        
        Args:
            api_key: WaveSpeed API key (falls back to env var if not provided)
        """
        self.api_key = api_key or os.getenv("WAVESPEED_API_KEY")
        if not self.api_key:
            raise ValueError("WaveSpeed API key not found. Set WAVESPEED_API_KEY environment variable.")
        
        # REUSE: Same client as generation provider
        self.client = WaveSpeedClient(api_key=self.api_key)
        logger.info(
            "[WaveSpeed Edit Provider] Initialized with {} models",
            len(self.SUPPORTED_MODELS),
        )
    
    def _validate_options(self, options: ImageEditOptions) -> None:
        """Validate editing options.
        
        Args:
            options: Image editing options
            
        Raises:
            ValueError: If options are invalid
        """
        model = options.model or list(self.SUPPORTED_MODELS.keys())[0] if self.SUPPORTED_MODELS else None
        
        if not model:
            raise ValueError("No model specified and no default model available")
        
        if model not in self.SUPPORTED_MODELS:
            raise ValueError(
                f"Unsupported model: {model}. "
                f"Supported models: {list(self.SUPPORTED_MODELS.keys())}"
            )
        
        model_info = self.SUPPORTED_MODELS[model]
        max_width, max_height = model_info.get("max_resolution", (4096, 4096))
        
        if options.width and options.width > max_width:
            raise ValueError(
                f"Width {options.width} exceeds maximum {max_width} for model {model}"
            )
        
        if options.height and options.height > max_height:
            raise ValueError(
                f"Height {options.height} exceeds maximum {max_height} for model {model}"
            )
        
        if not options.prompt or len(options.prompt.strip()) == 0:
            raise ValueError("Prompt cannot be empty")
        
        if not options.image_base64:
            raise ValueError("Image base64 cannot be empty")
    
    def edit(self, options: ImageEditOptions) -> ImageGenerationResult:
        """Edit image using WaveSpeed AI models.
        
        Args:
            options: Image editing options
            
        Returns:
            ImageGenerationResult with edited image
            
        Raises:
            ValueError: If options are invalid
            RuntimeError: If editing fails
        """
        # Validate options
        self._validate_options(options)
        
        # Determine model
        model = options.model or (list(self.SUPPORTED_MODELS.keys())[0] if self.SUPPORTED_MODELS else None)
        if not model:
            raise ValueError("No model available for editing")
        
        model_info = self.SUPPORTED_MODELS[model]
        model_path = model_info["model_path"]
        
        logger.info(
            "[WaveSpeed Edit] Starting edit: model={}, operation={}, prompt={}",
            model, options.operation, options.prompt[:100],
        )
        
        try:
            # Prepare extra parameters based on model capabilities
            extra_params = options.extra or {}
            
            # Add model-specific parameters if needed
            api_params = model_info.get("api_params", {})
            if api_params.get("uses_resolution", False):
                # For Nano Banana: determine resolution from dimensions or use default
                if options.width and options.height:
                    if options.width >= 4096 or options.height >= 4096:
                        extra_params["resolution"] = "8k"
                    else:
                        extra_params["resolution"] = "4k"
                elif "resolution" not in extra_params:
                    extra_params["resolution"] = "4k"  # Default to 4K
            
            if api_params.get("uses_aspect_ratio", False) and not extra_params.get("aspect_ratio"):
                # Calculate aspect ratio if dimensions provided
                if options.width and options.height:
                    aspect_ratio = self._calculate_aspect_ratio(options.width, options.height)
                    if aspect_ratio:
                        extra_params["aspect_ratio"] = aspect_ratio
            
            # Call WaveSpeed API for editing
            result = self._call_wavespeed_edit_api(
                model_path=model_path,
                image_base64=options.image_base64,
                prompt=options.prompt,
                operation=options.operation,
                mask_base64=options.mask_base64,
                negative_prompt=options.negative_prompt,
                width=options.width,
                height=options.height,
                guidance_scale=options.guidance_scale,
                steps=options.steps,
                seed=options.seed,
                extra=extra_params
            )
            
            # Extract image bytes from result
            if isinstance(result, bytes):
                image_bytes = result
            elif isinstance(result, dict) and "image" in result:
                image_bytes = result["image"]
            elif isinstance(result, dict) and "image_bytes" in result:
                image_bytes = result["image_bytes"]
            else:
                raise ValueError(f"Unexpected response format from WaveSpeed API: {type(result)}")
            
            # Load image to get dimensions
            image = Image.open(io.BytesIO(image_bytes))
            width, height = image.size
            
            # Calculate estimated cost - handle resolution-based pricing
            estimated_cost = model_info.get("cost", 0.02)
            if api_params.get("uses_resolution", False):
                # Check if 8K was requested
                resolution = extra_params.get("resolution", "4k")
                if resolution == "8k" and "cost_8k" in model_info:
                    estimated_cost = model_info["cost_8k"]
            
            logger.info(
                "[WaveSpeed Edit] ✅ Successfully edited image: {} bytes, {}x{}",
                len(image_bytes), width, height,
            )
            
            # REUSE: Same result format as generation
            return ImageGenerationResult(
                image_bytes=image_bytes,
                width=width,
                height=height,
                provider="wavespeed",
                model=model,
                seed=options.seed,
                metadata={
                    "provider": "wavespeed",
                    "model": model,
                    "model_name": model_info.get("name", model),
                    "operation": options.operation,
                    "prompt": options.prompt,
                    "negative_prompt": options.negative_prompt,
                    "estimated_cost": estimated_cost,
                    "tier": model_info.get("tier", "mid"),
                }
            )
            
        except Exception as e:
            logger.error("[WaveSpeed Edit] ❌ Error editing image: %s", str(e), exc_info=True)
            raise RuntimeError(f"WaveSpeed edit failed: {str(e)}")
    
    def _call_wavespeed_edit_api(
        self,
        model_path: str,
        image_base64: str,
        prompt: str,
        operation: str,
        mask_base64: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        guidance_scale: Optional[float] = None,
        steps: Optional[int] = None,
        seed: Optional[int] = None,
        extra: Optional[dict] = None
    ) -> bytes:
        """Call WaveSpeed API for image editing.
        
        REUSES: Same pattern as ImageGenerator.generate_image()
        
        Args:
            model_path: Full model path (e.g., "wavespeed-ai/qwen-image/edit-plus")
            image_base64: Base64-encoded input image
            prompt: Edit instruction prompt
            operation: Type of operation
            mask_base64: Optional mask for inpainting
            negative_prompt: Optional negative prompt
            width: Optional target width
            height: Optional target height
            guidance_scale: Optional guidance scale (not used by all models)
            steps: Optional number of steps (not used by all models)
            seed: Optional seed
            extra: Optional extra parameters
            
        Returns:
            Edited image bytes
            
        Raises:
            RuntimeError: If API call fails
        """
        import requests
        from fastapi import HTTPException
        
        # Build URL - REUSES same pattern as ImageGenerator
        url = f"{self.client.BASE_URL}/{model_path}"
        
        # Prepare images array - WaveSpeed expects array of image strings
        # Format: base64 strings or data URIs (data:image/png;base64,...)
        # For Qwen Image Edit Plus: supports up to 3 reference images
        images = []
        
        # Add main image - check if it's already a data URI or just base64
        if image_base64.startswith("data:image"):
            # Already a data URI
            images.append(image_base64)
        else:
            # Assume it's base64, convert to data URI
            # Try to detect format from base64 or default to PNG
            images.append(f"data:image/png;base64,{image_base64}")
        
        # If mask is provided, add it as second image
        # Note: Some models may need mask in different format - will adjust per model
        if mask_base64:
            if mask_base64.startswith("data:image"):
                images.append(mask_base64)
            else:
                images.append(f"data:image/png;base64,{mask_base64}")
        
        # Get model info to determine API parameter structure
        model_info = self.SUPPORTED_MODELS.get(model_path.split("/")[-1] if "/" in model_path else model_path)
        if not model_info:
            # Fallback: try to find model by matching path
            for model_id, info in self.SUPPORTED_MODELS.items():
                if info["model_path"] == model_path:
                    model_info = info
                    break
        
        if not model_info:
            raise ValueError(f"Model info not found for: {model_path}")
        
        api_params = model_info.get("api_params", {})
        
        # Build payload - following WaveSpeed API structure
        # Note: output_format default varies by model (PNG for most, but can be JPEG)
        default_output_format = api_params.get("default_output_format", "png")
        
        # Some models use "image" (singular) instead of "images" (array)
        uses_image_singular = api_params.get("uses_image_singular", False)
        
        payload = {
            "prompt": prompt,
            "enable_sync_mode": True,  # Use sync mode for immediate results
            "enable_base64_output": False,  # Get URL, then download
            "output_format": default_output_format,
        }
        
        # Add image(s) based on model API format
        if uses_image_singular:
            # Models like Qwen Edit (basic) use "image" (singular)
            # Use first image only (single image editing)
            if images:
                payload["image"] = images[0]
            else:
                raise ValueError("At least one image is required")
        else:
            # Models like Qwen Edit Plus, Nano Banana use "images" (array)
            payload["images"] = images
        
        # Allow override of output_format from extra params
        if extra and "output_format" in extra:
            payload["output_format"] = extra["output_format"]
        
        # Model-specific parameter handling
        if api_params.get("uses_size", True):
            # Models like Qwen Edit Plus use "size" parameter (width*height format)
            if width and height:
                payload["size"] = f"{width}*{height}"
            elif width:
                payload["size"] = f"{width}*{width}"  # Square if only width provided
            elif height:
                payload["size"] = f"{height}*{height}"  # Square if only height provided
        
        if api_params.get("uses_aspect_ratio", False):
            # Models like Nano Banana and FLUX Kontext Pro use "aspect_ratio" parameter
            if width and height:
                # Calculate aspect ratio from dimensions
                aspect_ratio = self._calculate_aspect_ratio(width, height)
                if aspect_ratio:
                    payload["aspect_ratio"] = aspect_ratio
            elif extra and "aspect_ratio" in extra:
                payload["aspect_ratio"] = extra["aspect_ratio"]
        
        if api_params.get("uses_resolution", False):
            # Models like Nano Banana use "resolution" parameter ("4k" or "8k")
            if extra and "resolution" in extra:
                payload["resolution"] = extra["resolution"]
            else:
                # Default to 4K, or 8K if dimensions suggest high-res
                if width and height and (width >= 4096 or height >= 4096):
                    payload["resolution"] = "8k"
                else:
                    payload["resolution"] = "4k"  # Default to 4K per API docs
        
        # Add optional parameters (model-agnostic)
        # Guidance scale: Only add if model supports it (e.g., FLUX Kontext Pro)
        if api_params.get("supports_guidance_scale", False):
            default_guidance = api_params.get("default_guidance_scale", 3.5)
            if guidance_scale is not None:
                # Clamp to valid range (1-20 per FLUX Kontext Pro docs)
                payload["guidance_scale"] = max(1, min(20, guidance_scale))
            elif extra and "guidance_scale" in extra:
                payload["guidance_scale"] = max(1, min(20, extra["guidance_scale"]))
            else:
                payload["guidance_scale"] = default_guidance
        
        # Seed parameter: Only add if model supports it
        if api_params.get("supports_seed", True):  # Default to True for backward compatibility
            if seed is not None:
                payload["seed"] = seed
            else:
                payload["seed"] = -1  # Random seed (per API docs default)
        
        # Add any extra parameters
        if extra:
            # Filter out parameters we've already handled
            handled_params = {"aspect_ratio", "resolution", "size", "seed", "guidance_scale"}
            for key, value in extra.items():
                if key not in handled_params:
                    payload[key] = value
        
        logger.info(f"[WaveSpeed Edit] Submitting edit request to {url} (model={model_path}, prompt_length={len(prompt)})")
        
        # Make API call - REUSES same pattern as ImageGenerator
        try:
            response = requests.post(
                url,
                headers=self.client._headers(),
                json=payload,
                timeout=120
            )
            
            if response.status_code != 200:
                logger.error(f"[WaveSpeed Edit] API call failed: {response.status_code} {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "WaveSpeed image editing failed",
                        "status_code": response.status_code,
                        "response": response.text[:500],
                    },
                )
            
            response_json = response.json()
            data = response_json.get("data") or response_json
            
            # Check status
            status = data.get("status", "").lower()
            outputs = data.get("outputs") or []
            prediction_id = data.get("id")
            
            logger.debug(
                f"[WaveSpeed Edit] Response: status='{status}', outputs_count={len(outputs)}, "
                f"prediction_id={prediction_id}"
            )
            
            # Handle sync mode - result should be directly in outputs
            if outputs and status == "completed":
                logger.info(f"[WaveSpeed Edit] Got immediate results from sync mode")
                image_url = self._extract_image_url(outputs)
                return self._download_image(image_url, timeout=120)
            
            # Sync mode returned "created" or "processing" - need to poll
            if not prediction_id:
                logger.error(f"[WaveSpeed Edit] Sync mode returned status '{status}' but no prediction ID")
                raise HTTPException(
                    status_code=502,
                    detail="WaveSpeed sync mode returned async response without prediction ID",
                )
            
            logger.info(
                f"[WaveSpeed Edit] Sync mode returned status '{status}' with no outputs. "
                f"Polling for result (prediction_id: {prediction_id})"
            )
            
            # Poll for result - REUSES polling utility
            result = self.client.poll_until_complete(
                prediction_id,
                timeout_seconds=180,
                interval_seconds=2.0,
            )
            
            outputs = result.get("outputs") or []
            if not outputs:
                raise HTTPException(
                    status_code=502,
                    detail="WaveSpeed edit returned no outputs after polling"
                )
            
            # Extract image URL from outputs - REUSE helper method
            image_url = self._extract_image_url(outputs)
            return self._download_image(image_url, timeout=120)
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[WaveSpeed Edit] Unexpected error: {str(e)}", exc_info=True)
            raise RuntimeError(f"WaveSpeed edit API call failed: {str(e)}")
    
    def _extract_image_url(self, outputs: list) -> str:
        """Extract image URL from outputs - REUSES same pattern as ImageGenerator.
        
        Args:
            outputs: Array of output URLs or objects
            
        Returns:
            Image URL string
            
        Raises:
            HTTPException: If output format is invalid
        """
        if not isinstance(outputs, list) or len(outputs) == 0:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed edit returned no outputs",
            )
        
        first_output = outputs[0]
        if isinstance(first_output, str):
            image_url = first_output
        elif isinstance(first_output, dict):
            image_url = first_output.get("url") or first_output.get("image_url") or first_output.get("output")
        else:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed edit output format not recognized",
            )
        
        if not image_url or not (image_url.startswith("http://") or image_url.startswith("https://")):
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed edit returned invalid image URL",
            )
        
        return image_url
    
    def _download_image(self, image_url: str, timeout: int = 120) -> bytes:
        """Download image from URL - REUSES same pattern as ImageGenerator.
        
        Args:
            image_url: URL to download from
            timeout: Request timeout in seconds
            
        Returns:
            Image bytes
            
        Raises:
            HTTPException: If download fails
        """
        logger.info(f"[WaveSpeed Edit] Downloading edited image from: {image_url}")
        image_response = requests.get(image_url, timeout=timeout)
        
        if image_response.status_code != 200:
            logger.error(f"[WaveSpeed Edit] Failed to download image: {image_response.status_code}")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to download edited image: {image_response.status_code}"
            )
        
        logger.info(f"[WaveSpeed Edit] Successfully downloaded image ({len(image_response.content)} bytes)")
        return image_response.content
    
    def _calculate_aspect_ratio(self, width: int, height: int) -> Optional[str]:
        """Calculate aspect ratio string from dimensions.
        
        Args:
            width: Image width
            height: Image height
            
        Returns:
            Aspect ratio string (e.g., "16:9") or None if not standard
        """
        # Common aspect ratios (includes FLUX Kontext Pro supported ratios)
        ratios = {
            (1, 1): "1:1",
            (3, 2): "3:2",
            (2, 3): "2:3",
            (3, 4): "3:4",
            (4, 3): "4:3",
            (4, 5): "4:5",
            (5, 4): "5:4",
            (9, 16): "9:16",
            (16, 9): "16:9",
            (21, 9): "21:9",
            (9, 21): "9:21",  # FLUX Kontext Pro also supports 9:21
        }
        
        # Calculate GCD to simplify ratio
        def gcd(a, b):
            while b:
                a, b = b, a % b
            return a
        
        divisor = gcd(width, height)
        simplified = (width // divisor, height // divisor)
        
        # Check if it matches a standard ratio (with some tolerance)
        for (w, h), ratio_str in ratios.items():
            # Allow small tolerance for rounding
            if abs(simplified[0] / simplified[1] - w / h) < 0.01:
                return ratio_str
        
        # If no match, return None (model may not support custom aspect ratios)
        return None
    
    @classmethod
    def get_available_models(cls) -> dict:
        """Get available editing models and their information.
        
        Returns:
            Dictionary of available models
        """
        return cls.SUPPORTED_MODELS
    
    @classmethod
    def get_models_by_tier(cls, tier: str) -> dict:
        """Get models filtered by tier (budget, mid, premium).
        
        Args:
            tier: Tier name ("budget", "mid", "premium")
            
        Returns:
            Dictionary of models in the specified tier
        """
        return {
            model_id: model_info
            for model_id, model_info in cls.SUPPORTED_MODELS.items()
            if model_info.get("tier") == tier
        }
    
    @classmethod
    def get_models_by_operation(cls, operation: str) -> dict:
        """Get models that support a specific operation.
        
        Args:
            operation: Operation type (e.g., "inpaint", "outpaint", "general_edit")
            
        Returns:
            Dictionary of models supporting the operation
        """
        return {
            model_id: model_info
            for model_id, model_info in cls.SUPPORTED_MODELS.items()
            if operation in model_info.get("capabilities", [])
        }
