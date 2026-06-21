"""WaveSpeed AI image generation provider (Ideogram V3 Turbo & Qwen Image)."""

import io
import os
from typing import Optional
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .base import ImageGenerationProvider, ImageGenerationOptions, ImageGenerationResult
from services.wavespeed.client import WaveSpeedClient
from utils.logger_utils import get_service_logger


logger = get_service_logger("wavespeed.image_provider")


class WaveSpeedImageProvider(ImageGenerationProvider):
    """WaveSpeed AI image generation provider supporting Ideogram V3 and Qwen.
    
    Implements robust error handling and retries for production stability.
    """
    
    SUPPORTED_MODELS = {
        "ideogram-v3-turbo": {
            "name": "Ideogram V3 Turbo",
            "description": "Photorealistic generation with superior text rendering",
            "cost_per_image": 0.30,
            "max_resolution": (1024, 1024),
            "default_steps": 20,
        },
        "qwen-image": {
            "name": "Qwen Image",
            "description": "Fast, high-quality text-to-image generation",
            "cost_per_image": 0.30,
            "max_resolution": (1024, 1024),
            "default_steps": 15,
        },
        "flux-kontext-pro": {
            "name": "FLUX Kontext Pro",
            "description": "Professional typography and text rendering with improved prompt adherence",
            "cost_per_image": 0.30,
            "max_resolution": (1024, 1024),
            "default_steps": 20,
        }
    }
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize WaveSpeed image provider.
        
        Args:
            api_key: WaveSpeed API key (falls back to env var if not provided)
        """
        self.api_key = api_key or os.getenv("WAVESPEED_API_KEY")
        if not self.api_key:
            raise ValueError("WaveSpeed API key not found. Set WAVESPEED_API_KEY environment variable.")
        
        self.client = WaveSpeedClient(api_key=self.api_key)
        logger.info(
            "[WaveSpeed Image Provider] Initialized with available models: {}",
            list(self.SUPPORTED_MODELS.keys()),
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((RuntimeError, IOError)),
        reraise=True
    )
    def _call_api_with_retry(self, method, **kwargs):
        """Execute API call with retry logic.
        
        Args:
            method: Callable API method
            **kwargs: Arguments for the method
            
        Returns:
            API response
        """
        try:
            return method(**kwargs)
        except Exception as e:
            logger.warning(f"WaveSpeed API call failed (retrying): {str(e)}")
            raise

    def _validate_options(self, options: ImageGenerationOptions) -> None:
        """Validate generation options.
        
        Args:
            options: Image generation options
            
        Raises:
            ValueError: If options are invalid
        """
        model = options.model or "ideogram-v3-turbo"
        
        if model not in self.SUPPORTED_MODELS:
            raise ValueError(
                f"Unsupported model: {model}. "
                f"Supported models: {list(self.SUPPORTED_MODELS.keys())}"
            )
        
        model_info = self.SUPPORTED_MODELS[model]
        max_width, max_height = model_info["max_resolution"]
        
        if options.width > max_width or options.height > max_height:
            raise ValueError(
                f"Resolution {options.width}x{options.height} exceeds maximum "
                f"{max_width}x{max_height} for model {model}"
            )
        
        if not options.prompt or len(options.prompt.strip()) == 0:
            raise ValueError("Prompt cannot be empty")
    
    def _generate_ideogram_v3(self, options: ImageGenerationOptions) -> bytes:
        """Generate image using Ideogram V3 Turbo.
        
        Args:
            options: Image generation options
            
        Returns:
            Image bytes
        """
        logger.info("[Ideogram V3] Starting image generation: {}", options.prompt[:100])
        
        try:
            # Prepare parameters for WaveSpeed Ideogram V3 API
            # Note: Adjust these based on actual WaveSpeed API documentation
            params = {
                "model": "ideogram-v3-turbo",
                "prompt": options.prompt,
                "width": options.width,
                "height": options.height,
                "num_inference_steps": options.steps or self.SUPPORTED_MODELS["ideogram-v3-turbo"]["default_steps"],
            }
            
            # Add optional parameters
            if options.negative_prompt:
                params["negative_prompt"] = options.negative_prompt
            
            if options.guidance_scale:
                params["guidance_scale"] = options.guidance_scale
            
            if options.seed:
                params["seed"] = options.seed
            
            # Call WaveSpeed API (using generic image generation method)
            # This will need to be adjusted based on actual WaveSpeed client implementation
            result = self._call_api_with_retry(self.client.generate_image, **params)
            
            # Extract image bytes from result
            # Adjust based on actual WaveSpeed API response format
            if isinstance(result, bytes):
                image_bytes = result
            elif isinstance(result, dict) and "image" in result:
                image_bytes = result["image"]
            else:
                raise ValueError(f"Unexpected response format from WaveSpeed API: {type(result)}")
            
            logger.info("[Ideogram V3] ✅ Successfully generated image: {} bytes", len(image_bytes))
            return image_bytes
            
        except Exception as e:
            logger.error("[Ideogram V3] ❌ Error generating image: {}", str(e), exc_info=True)
            raise RuntimeError(f"Ideogram V3 generation failed: {str(e)}")
    
    def _generate_qwen_image(self, options: ImageGenerationOptions) -> bytes:
        """Generate image using Qwen Image.
        
        Args:
            options: Image generation options
            
        Returns:
            Image bytes
        """
        logger.info("[Qwen Image] Starting image generation: {}", options.prompt[:100])
        
        try:
            # Prepare parameters for WaveSpeed Qwen Image API
            params = {
                "model": "qwen-image",
                "prompt": options.prompt,
                "width": options.width,
                "height": options.height,
                "num_inference_steps": options.steps or self.SUPPORTED_MODELS["qwen-image"]["default_steps"],
            }
            
            # Add optional parameters
            if options.negative_prompt:
                params["negative_prompt"] = options.negative_prompt
            
            if options.guidance_scale:
                params["guidance_scale"] = options.guidance_scale
            
            if options.seed:
                params["seed"] = options.seed
            
            # Call WaveSpeed API
            result = self._call_api_with_retry(self.client.generate_image, **params)
            
            # Extract image bytes from result
            if isinstance(result, bytes):
                image_bytes = result
            elif isinstance(result, dict) and "image" in result:
                image_bytes = result["image"]
            else:
                raise ValueError(f"Unexpected response format from WaveSpeed API: {type(result)}")
            
            logger.info("[Qwen Image] ✅ Successfully generated image: {} bytes", len(image_bytes))
            return image_bytes
            
        except Exception as e:
            logger.error("[Qwen Image] ❌ Error generating image: {}", str(e), exc_info=True)
            raise RuntimeError(f"Qwen Image generation failed: {str(e)}")
    
    def _generate_flux_kontext_pro(self, options: ImageGenerationOptions) -> bytes:
        """Generate image using FLUX Kontext Pro.
        
        Args:
            options: Image generation options
            
        Returns:
            Image bytes
        """
        logger.info("[FLUX Kontext Pro] Starting image generation: {}", options.prompt)
        
        try:
            # Prepare parameters for WaveSpeed FLUX Kontext Pro API
            params = {
                "model": "flux-kontext-pro",
                "prompt": options.prompt,
                "width": options.width,
                "height": options.height,
                "num_inference_steps": options.steps or self.SUPPORTED_MODELS["flux-kontext-pro"]["default_steps"],
            }
            
            # Add optional parameters
            if options.negative_prompt:
                params["negative_prompt"] = options.negative_prompt
            
            if options.guidance_scale:
                params["guidance_scale"] = options.guidance_scale
            
            if options.seed:
                params["seed"] = options.seed
            
            # Call WaveSpeed API
            result = self._call_api_with_retry(self.client.generate_image, **params)
            
            # Extract image bytes from result
            if isinstance(result, bytes):
                image_bytes = result
            elif isinstance(result, dict) and "image" in result:
                image_bytes = result["image"]
            else:
                raise ValueError(f"Unexpected response format from WaveSpeed API: {type(result)}")
            
            logger.info("[FLUX Kontext Pro] ✅ Successfully generated image: {} bytes", len(image_bytes))
            return image_bytes
            
        except Exception as e:
            logger.error("[FLUX Kontext Pro] ❌ Error generating image: {}", str(e), exc_info=True)
            raise RuntimeError(f"FLUX Kontext Pro generation failed: {str(e)}")
    
    def generate(self, options: ImageGenerationOptions) -> ImageGenerationResult:
        """Generate image using WaveSpeed AI models.
        
        Args:
            options: Image generation options
            
        Returns:
            ImageGenerationResult with generated image
            
        Raises:
            ValueError: If options are invalid
            RuntimeError: If generation fails
        """
        # Validate options
        self._validate_options(options)
        
        # Determine model
        model = options.model or "ideogram-v3-turbo"
        
        # Generate based on model
        if model == "ideogram-v3-turbo":
            image_bytes = self._generate_ideogram_v3(options)
        elif model == "qwen-image":
            image_bytes = self._generate_qwen_image(options)
        elif model == "flux-kontext-pro":
            image_bytes = self._generate_flux_kontext_pro(options)
        else:
            raise ValueError(f"Unsupported model: {model}")
        
        # Load image to get dimensions
        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size
        
        # Calculate estimated cost
        model_info = self.SUPPORTED_MODELS[model]
        estimated_cost = model_info["cost_per_image"]
        
        # Return result
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
                "model_name": model_info["name"],
                "prompt": options.prompt,
                "negative_prompt": options.negative_prompt,
                "steps": options.steps or model_info["default_steps"],
                "guidance_scale": options.guidance_scale,
                "estimated_cost": estimated_cost,
            }
        )
    
    @classmethod
    def get_available_models(cls) -> dict:
        """Get available models and their information.
        
        Returns:
            Dictionary of available models
        """
        return cls.SUPPORTED_MODELS

