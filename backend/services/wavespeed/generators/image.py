"""
Image generation generator for WaveSpeed API.
"""

import time
import requests
from typing import Optional
from requests import exceptions as requests_exceptions
from fastapi import HTTPException

from utils.logger_utils import get_service_logger

logger = get_service_logger("wavespeed.generators.image")


class ImageGenerator:
    """Image generation generator."""
    
    def __init__(self, api_key: str, base_url: str, polling):
        """Initialize image generator.
        
        Args:
            api_key: WaveSpeed API key
            base_url: WaveSpeed API base URL
            polling: WaveSpeedPolling instance for async operations
        """
        self.api_key = api_key
        self.base_url = base_url
        self.polling = polling
    
    def _get_headers(self) -> dict:
        """Get HTTP headers for API requests."""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    @staticmethod
    def _aspect_ratio_from_dimensions(width: int, height: int) -> str:
        """Map pixel dimensions to a Gemini-supported aspect_ratio string."""
        exact = {
            (1024, 1024): "1:1",
            (1920, 1080): "16:9",
            (1080, 1920): "9:16",
            (1366, 1024): "4:3",
            (1080, 1440): "3:4",
            # LinkedIn-optimized dimensions from LinkedInImageGenerator
            (1200, 627): "16:9",   # 1.91:1 feed landscape
            (1080, 1350): "3:4",   # 1:1.25 feed portrait
        }
        if (width, height) in exact:
            return exact[(width, height)]

        ratio = width / height if height else 1.0
        candidates = [
            ("1:1", 1.0),
            ("16:9", 16 / 9),
            ("9:16", 9 / 16),
            ("4:3", 4 / 3),
            ("3:4", 3 / 4),
        ]
        return min(candidates, key=lambda item: abs(item[1] - ratio))[0]

    def generate_image(
        self,
        model: str,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        num_inference_steps: Optional[int] = None,
        guidance_scale: Optional[float] = None,
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        enable_sync_mode: bool = True,
        timeout: int = 120,
        **kwargs
    ) -> bytes:
        """
        Generate image using WaveSpeed AI models (Ideogram, Qwen, FLUX, Gemini).
        
        Args:
            model: Model id (e.g. ideogram-v3-turbo, qwen-image, flux-kontext-pro, gemini-3-pro-image)
            prompt: Text prompt for image generation
            width: Image width (default: 1024); used for Gemini aspect_ratio derivation
            height: Image height (default: 1024); used for Gemini aspect_ratio derivation
            num_inference_steps: Number of inference steps (ignored for Gemini)
            guidance_scale: Guidance scale for generation (ignored for Gemini)
            negative_prompt: Negative prompt (what to avoid; ignored for Gemini)
            seed: Random seed for reproducibility (ignored for Gemini)
            enable_sync_mode: If True, wait for result and return it directly (default: True).
                Forced False for gemini-3-pro-image per WaveSpeed API guidance.
            timeout: Request timeout in seconds (default: 120)
            **kwargs: Additional parameters
            
        Returns:
            bytes: Generated image bytes
        """
        # Map model names to WaveSpeed API paths
        model_paths = {
            "ideogram-v3-turbo": "ideogram-ai/ideogram-v3-turbo",
            "qwen-image": "wavespeed-ai/qwen-image/text-to-image",
            "flux-kontext-pro": "wavespeed-ai/flux-kontext-pro/text-to-image",
            "gemini-3-pro-image": "google/gemini-3-pro-image/text-to-image",
        }
        
        model_path = model_paths.get(model)
        if not model_path:
            raise ValueError(f"Unsupported image model: {model}. Supported: {list(model_paths.keys())}")
        
        url = f"{self.base_url}/{model_path}"

        # Gemini uses aspect_ratio/resolution (not width/height) and async submit+poll.
        if model == "gemini-3-pro-image":
            aspect_ratio = self._aspect_ratio_from_dimensions(width, height)
            enable_sync_mode = False
            resolution = kwargs.pop("resolution", "1k")
            output_format = kwargs.pop("output_format", "png")
            payload = {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
                "resolution": resolution,
                "output_format": output_format,
                "enable_sync_mode": False,
                "enable_base64_output": False,
            }
            logger.info(
                "[WaveSpeed] Generating Gemini image via {} "
                "(aspect_ratio={}, resolution={}, prompt_length={})",
                url,
                aspect_ratio,
                resolution,
                len(prompt),
            )
        else:
            payload = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "enable_sync_mode": enable_sync_mode,
            }

            # Add optional parameters (existing models only)
            if num_inference_steps is not None:
                payload["num_inference_steps"] = num_inference_steps
            if guidance_scale is not None:
                payload["guidance_scale"] = guidance_scale
            if negative_prompt:
                payload["negative_prompt"] = negative_prompt
            if seed is not None:
                payload["seed"] = seed

            logger.info(
                f"[WaveSpeed] Generating image via {url} (model={model}, prompt_length={len(prompt)})"
            )

        # Add any extra parameters (safe for both branches)
        for key, value in kwargs.items():
            if key not in payload:
                payload[key] = value

        response = requests.post(url, headers=self._get_headers(), json=payload, timeout=timeout)
        
        if response.status_code != 200:
            logger.error(f"[WaveSpeed] Image generation failed: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed image generation failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )
        
        response_json = response.json()
        data = response_json.get("data") or response_json
        
        # Check status - if "created" or "processing", we need to poll even in sync mode
        status = data.get("status", "").lower()
        outputs = data.get("outputs") or []
        prediction_id = data.get("id")
        
        # Handle sync mode - result should be directly in outputs
        if enable_sync_mode:
            # If we have outputs and status is "completed", use them directly
            if outputs and status == "completed":
                logger.info(f"[WaveSpeed] Got immediate results from sync mode (status: {status})")
                image_url = self._extract_image_url(outputs)
                return self._download_image(image_url, timeout)
            
            # Sync mode returned "created" or "processing" status - need to poll
            if not prediction_id:
                logger.error(f"[WaveSpeed] Sync mode returned status '{status}' but no prediction ID: {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail="WaveSpeed sync mode returned async response without prediction ID",
                )
            
            logger.info(
                f"[WaveSpeed] Sync mode returned status '{status}' with no outputs. "
                f"Falling back to polling (prediction_id: {prediction_id})"
            )
        
        # Async mode OR sync mode that returned "created"/"processing" - poll for result
        if not prediction_id:
            logger.error(f"[WaveSpeed] No prediction ID in response: {response.text}")
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed response missing prediction id",
            )
        
        # Poll for result (use longer timeout for image generation)
        logger.info(f"[WaveSpeed] Polling for image generation result (prediction_id: {prediction_id}, status: {status})")
        result = self.polling.poll_until_complete(prediction_id, timeout_seconds=240, interval_seconds=1.0)
        outputs = result.get("outputs") or []
        
        if not outputs:
            raise HTTPException(status_code=502, detail="WaveSpeed image generator returned no outputs")
        
        image_url = self._extract_image_url(outputs)
        return self._download_image(image_url, timeout=60)
    
    def generate_character_image(
        self,
        prompt: str,
        reference_image_bytes: bytes,
        style: str = "Auto",
        aspect_ratio: str = "16:9",
        rendering_speed: str = "Default",
        timeout: Optional[int] = None,
    ) -> bytes:
        """
        Generate image using Ideogram Character API to maintain character consistency.
        Creates variations of a reference character image while respecting the base appearance.
        
        Note: This API is always async and requires polling for results.
        
        Args:
            prompt: Text prompt describing the scene/context for the character
            reference_image_bytes: Reference image bytes (base avatar)
            style: Character style type ("Auto", "Fiction", or "Realistic")
            aspect_ratio: Aspect ratio ("1:1", "16:9", "9:16", "4:3", "3:4")
            rendering_speed: Rendering speed ("Default", "Turbo", "Quality")
            timeout: Total timeout in seconds for submission + polling (default: 180)
            
        Returns:
            bytes: Generated image bytes with consistent character
        """
        import base64
        
        # Encode reference image to base64
        image_base64 = base64.b64encode(reference_image_bytes).decode('utf-8')
        # Add data URI prefix
        image_data_uri = f"data:image/png;base64,{image_base64}"
        
        url = f"{self.base_url}/ideogram-ai/ideogram-character"
        
        payload = {
            "prompt": prompt,
            "image": image_data_uri,
            "style": style,
            "aspect_ratio": aspect_ratio,
            "rendering_speed": rendering_speed,
        }
        
        logger.info(f"[WaveSpeed] Generating character image via Ideogram Character (prompt_length={len(prompt)})")
        
        # Retry on transient connection failures
        max_retries = 2
        retry_delay = 2.0
        
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(
                    url, 
                    headers=self._get_headers(), 
                    json=payload, 
                    timeout=(30, 30)
                )
                break
            except (requests_exceptions.ConnectTimeout, requests_exceptions.ConnectionError) as e:
                if attempt < max_retries:
                    logger.warning(f"[WaveSpeed] Connection attempt {attempt + 1}/{max_retries + 1} failed, retrying in {retry_delay}s: {e}")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    error_type = "Connection timeout" if isinstance(e, requests_exceptions.ConnectTimeout) else "Connection error"
                    logger.error(f"[WaveSpeed] {error_type} to Ideogram Character API after {max_retries + 1} attempts: {e}")
                    raise HTTPException(
                        status_code=504 if isinstance(e, requests_exceptions.ConnectTimeout) else 502,
                        detail={
                            "error": f"{error_type} to WaveSpeed Ideogram Character API",
                            "message": "Unable to establish connection to the image generation service after multiple attempts. Please check your network connection and try again.",
                            "exception": str(e),
                            "retry_recommended": True,
                        },
                    )
            except requests_exceptions.Timeout as e:
                logger.error(f"[WaveSpeed] Request timeout to Ideogram Character API: {e}")
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "Request timeout to WaveSpeed Ideogram Character API",
                        "message": "The image generation request took too long. Please try again.",
                        "exception": str(e),
                    },
                )
        
        if response.status_code != 200:
            logger.error(f"[WaveSpeed] Character image generation failed: {response.status_code} {response.text}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed Ideogram Character generation failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )
        
        response_json = response.json()
        data = response_json.get("data") or response_json
        
        # Extract prediction ID
        prediction_id = data.get("id")
        if not prediction_id:
            logger.error(f"[WaveSpeed] No prediction ID in response: {response.text}")
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed Ideogram Character response missing prediction id",
            )
        
        # Ideogram Character API is always async - check status and poll if needed
        outputs = data.get("outputs") or []
        status = data.get("status", "unknown")
        
        logger.info(f"[WaveSpeed] Ideogram Character task created: prediction_id={prediction_id}, status={status}")
        
        # If status is already completed, use outputs directly (unlikely but possible)
        if outputs and status == "completed":
            logger.info(f"[WaveSpeed] Got immediate results from Ideogram Character")
        else:
            # Always need to poll for results (API is async)
            logger.info(f"[WaveSpeed] Polling for Ideogram Character result (status: {status}, prediction_id: {prediction_id})")
            polling_timeout = timeout if timeout else None
            result = self.polling.poll_until_complete(
                prediction_id,
                timeout_seconds=polling_timeout,
                interval_seconds=0.5,
            )
            
            if not isinstance(result, dict):
                logger.error(f"[WaveSpeed] Unexpected result type: {type(result)}, value: {result}")
                raise HTTPException(
                    status_code=502,
                    detail="WaveSpeed Ideogram Character returned unexpected response format",
                )
            
            outputs = result.get("outputs") or []
            status = result.get("status", "unknown")
            
            if status != "completed":
                error_msg = "Unknown error"
                if isinstance(result, dict):
                    error_msg = result.get("error") or result.get("message") or str(result.get("details", "Unknown error"))
                else:
                    error_msg = str(result)
                
                logger.error(f"[WaveSpeed] Ideogram Character task did not complete: status={status}, error={error_msg}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "WaveSpeed Ideogram Character task failed",
                        "status": status,
                        "message": error_msg,
                    }
                )
        
        # Extract image URL from outputs
        if not outputs:
            logger.error(f"[WaveSpeed] No outputs after polling: status={status}")
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed Ideogram Character returned no outputs",
            )
        
        image_url = self._extract_image_url(outputs)
        return self._download_image(image_url, timeout=60)
    
    def _extract_image_url(self, outputs: list) -> str:
        """Extract image URL from outputs."""
        if not isinstance(outputs, list) or len(outputs) == 0:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed image generator output format not recognized",
            )
        
        first_output = outputs[0]
        if isinstance(first_output, str):
            image_url = first_output
        elif isinstance(first_output, dict):
            image_url = first_output.get("url") or first_output.get("image_url") or first_output.get("output")
        else:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed image generator output format not recognized",
            )
        
        if not image_url or not (image_url.startswith("http://") or image_url.startswith("https://")):
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed image generator output format not recognized",
            )
        
        return image_url
    
    def _download_image(self, image_url: str, timeout: int = 60) -> bytes:
        """Download image from URL."""
        logger.info(f"[WaveSpeed] Fetching image from URL: {image_url}")
        image_response = requests.get(image_url, timeout=timeout)
        if image_response.status_code == 200:
            image_bytes = image_response.content
            logger.info(f"[WaveSpeed] Image generated successfully (size: {len(image_bytes)} bytes)")
            return image_bytes
        else:
            logger.error(f"[WaveSpeed] Failed to fetch image from URL: {image_response.status_code}")
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch generated image from WaveSpeed URL",
            )
