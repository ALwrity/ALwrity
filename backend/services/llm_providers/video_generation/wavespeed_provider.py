"""
WaveSpeed Text-to-Video Provider

Modular services for WaveSpeed text-to-video models:
- HunyuanVideo-1.5
- LTX-2 Pro
- LTX-2 Fast
- LTX-2 Retake

Each model has its own service class for separation of concerns.
"""

from __future__ import annotations

import asyncio
import requests
from typing import Optional, Dict, Any, Callable
from fastapi import HTTPException
from loguru import logger

from services.wavespeed.client import WaveSpeedClient
from services.subscription import get_video_model_cost
from utils.logger_utils import get_service_logger
from .base import VideoGenerationOptions, VideoGenerationResult

logger = get_service_logger("wavespeed.text_to_video")


class BaseWaveSpeedTextToVideoService:
    """Base class for WaveSpeed text-to-video services."""
    
    MODEL_PATH: str  # Must be set by subclasses
    MODEL_NAME: str  # Must be set by subclasses
    DEFAULT_COST: float = 0.10  # Default cost per second
    
    def __init__(self, client: Optional[WaveSpeedClient] = None):
        """Initialize the service.
        
        Args:
            client: Optional WaveSpeedClient instance (creates new if not provided)
        """
        self.client = client or WaveSpeedClient()
        logger.info(f"[{self.MODEL_NAME}] Service initialized")
    
    def calculate_cost(self, resolution: str, duration: int) -> float:
        """Calculate cost for video generation from pricing.yaml.
        
        Args:
            resolution: Output resolution (480p, 720p, 1080p)
            duration: Video duration in seconds
            
        Returns:
            Cost in USD
        """
        return get_video_model_cost(
            self.MODEL_NAME,
            duration_sec=duration,
            resolution=resolution,
            default=self.DEFAULT_COST * duration,
        )
    
    async def generate_video(
        self,
        prompt: str,
        duration: int = 5,
        resolution: str = "720p",
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        audio_base64: Optional[str] = None,
        enable_prompt_expansion: bool = True,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate video using the model.
        
        Args:
            prompt: Text prompt describing the video
            duration: Video duration in seconds (5 or 10)
            resolution: Output resolution (480p, 720p, 1080p)
            negative_prompt: Optional negative prompt
            seed: Optional random seed
            audio_base64: Optional audio file for synchronization
            enable_prompt_expansion: Enable prompt optimization
            progress_callback: Optional progress callback function
            **kwargs: Additional model-specific parameters
            
        Returns:
            Dictionary with video_bytes, prompt, duration, model_name, cost, etc.
        """
        raise NotImplementedError("Subclasses must implement generate_video()")
    
    def _validate_inputs(
        self,
        prompt: str,
        duration: int,
        resolution: str,
    ) -> None:
        """Validate input parameters.
        
        Args:
            prompt: Text prompt
            duration: Video duration
            resolution: Output resolution
            
        Raises:
            HTTPException: If validation fails
        """
        if not prompt or not prompt.strip():
            raise HTTPException(
                status_code=400,
                detail="Prompt is required and cannot be empty"
            )
        
        # Default validation - subclasses should override for model-specific requirements
        if duration not in [5, 8, 10]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid duration: {duration}. Must be 5, 8, or 10 seconds"
            )
        
        valid_resolutions = ["480p", "720p", "1080p"]
        if resolution not in valid_resolutions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resolution: {resolution}. Must be one of: {valid_resolutions}"
            )


class HunyuanVideoService(BaseWaveSpeedTextToVideoService):
    """
    Service for HunyuanVideo-1.5 text-to-video generation.
    
    HunyuanVideo-1.5 is Tencent's lightweight 8.3B parameter text-to-video model
    that generates high-quality videos with top-tier visual quality and motion coherence.
    """
    
    MODEL_PATH = "wavespeed-ai/hunyuan-video-1.5/text-to-video"
    MODEL_NAME = "hunyuan-video-1.5"
    
    # Pricing per second (from WaveSpeed docs)
    PRICING = {
        "480p": 0.02,  # $0.02 per second
        "720p": 0.04,  # $0.04 per second
    }
    
    # Size mapping: resolution -> size format (width*height)
    SIZE_MAPPING = {
        "480p": {
            "landscape": "832*480",
            "portrait": "480*832",
        },
        "720p": {
            "landscape": "1280*720",
            "portrait": "720*1280",
        },
    }
    
    def calculate_cost(self, resolution: str, duration: int) -> float:
        """Calculate cost for video generation.
        
        Args:
            resolution: Output resolution (480p, 720p)
            duration: Video duration in seconds (5 or 8)
            
        Returns:
            Cost in USD
        """
        cost_per_second = self.PRICING.get(resolution, self.PRICING["720p"])
        return cost_per_second * duration
    
    def _validate_inputs(
        self,
        prompt: str,
        duration: int,
        resolution: str,
    ) -> None:
        """Validate input parameters for HunyuanVideo-1.5.
        
        Args:
            prompt: Text prompt
            duration: Video duration (5, 8, or 10 seconds)
            resolution: Output resolution (480p or 720p)
            
        Raises:
            HTTPException: If validation fails
        """
        if not prompt or not prompt.strip():
            raise HTTPException(
                status_code=400,
                detail="Prompt is required and cannot be empty"
            )
        
        # HunyuanVideo-1.5 supports 5, 8, or 10 seconds (per official docs)
        if duration not in [5, 8, 10]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid duration: {duration}. Must be 5, 8, or 10 seconds for HunyuanVideo-1.5"
            )
        
        # HunyuanVideo-1.5 supports 480p and 720p only
        valid_resolutions = ["480p", "720p"]
        if resolution not in valid_resolutions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resolution: {resolution}. Must be one of: {valid_resolutions} for HunyuanVideo-1.5"
            )
    
    def _resolution_to_size(self, resolution: str, aspect_ratio: str = "16:9") -> str:
        """Convert resolution to size format (width*height).
        
        Args:
            resolution: Resolution (480p, 720p)
            aspect_ratio: Aspect ratio (16:9 for landscape, 9:16 for portrait)
            
        Returns:
            Size string in format "width*height"
        """
        # Determine orientation
        if aspect_ratio in ["9:16", "1:1"]:
            orientation = "portrait"
        else:
            orientation = "landscape"
        
        # Get size from mapping
        size_mapping = self.SIZE_MAPPING.get(resolution, {})
        size = size_mapping.get(orientation, size_mapping.get("landscape", "1280*720"))
        
        return size
    
    async def generate_video(
        self,
        prompt: str,
        duration: int = 5,
        resolution: str = "720p",
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        audio_base64: Optional[str] = None,
        enable_prompt_expansion: bool = True,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate video using HunyuanVideo-1.5.
        
        Reference: https://wavespeed.ai/docs/docs-api/wavespeed-ai/hunyuan-video-1.5-text-to-video
        
        Args:
            prompt: Text prompt describing the video
            duration: Video duration in seconds (5, 8, or 10)
            resolution: Output resolution (480p, 720p)
            negative_prompt: Optional negative prompt
            seed: Optional random seed (-1 for random)
            audio_base64: Not supported by HunyuanVideo-1.5 (ignored with warning)
            enable_prompt_expansion: Not supported by HunyuanVideo-1.5 (ignored with warning)
            progress_callback: Optional progress callback function
            **kwargs: Additional parameters (aspect_ratio for size calculation)
            
        Returns:
            Dictionary with video_bytes, prompt, duration, model_name, cost, etc.
        """
        # Validate inputs (HunyuanVideo-1.5 specific)
        self._validate_inputs(prompt, duration, resolution)
        
        # Get aspect ratio from kwargs (default to 16:9)
        aspect_ratio = kwargs.get("aspect_ratio", "16:9")
        
        # Convert resolution to size format
        size = self._resolution_to_size(resolution, aspect_ratio)
        
        # Build payload according to API spec
        payload = {
            "prompt": prompt.strip(),
            "duration": duration,
            "size": size,
        }
        
        # Add optional parameters
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt.strip()
        
        if seed is not None:
            payload["seed"] = seed
        else:
            payload["seed"] = -1  # Default to random seed
        
        # Note: audio_base64 and enable_prompt_expansion are not supported by HunyuanVideo-1.5
        if audio_base64:
            logger.warning("[HunyuanVideo] audio_base64 is not supported by HunyuanVideo-1.5, ignoring")
        if not enable_prompt_expansion:
            logger.warning("[HunyuanVideo] enable_prompt_expansion is not supported by HunyuanVideo-1.5, ignoring")
        
        logger.info(
            f"[HunyuanVideo] Generating video: resolution={resolution}, "
            f"duration={duration}s, size={size}, prompt_length={len(prompt)}"
        )
        
        # Progress callback: submission
        if progress_callback:
            progress_callback(10.0, "Submitting HunyuanVideo-1.5 request to WaveSpeed...")
        
        # Submit request using WaveSpeedClient
        try:
            prediction_id = self.client.submit_text_to_video(
                model_path=self.MODEL_PATH,
                payload=payload,
                timeout=60,
            )
        except HTTPException as e:
            logger.error(f"[HunyuanVideo] Submission failed: {e.detail}")
            raise
        
        logger.info(f"[HunyuanVideo] Request submitted: prediction_id={prediction_id}")
        
        # Progress callback: polling started
        if progress_callback:
            progress_callback(20.0, f"Polling for completion (prediction_id: {prediction_id})...")
        
        # Poll for completion with progress updates
        try:
            result = await asyncio.to_thread(
                self.client.poll_until_complete,
                prediction_id,
                timeout_seconds=600,  # 10 minutes max
                interval_seconds=0.5,  # Poll every 0.5 seconds (as per example)
                progress_callback=progress_callback,
            )
        except HTTPException as e:
            detail = e.detail or {}
            if isinstance(detail, dict):
                detail.setdefault("prediction_id", prediction_id)
                detail.setdefault("resume_available", True)
            logger.error(f"[HunyuanVideo] Polling failed: {detail}")
            raise HTTPException(status_code=e.status_code, detail=detail)
        
        # Progress callback: processing result
        if progress_callback:
            progress_callback(90.0, "Downloading generated video...")
        
        # Extract video URL from result
        outputs = result.get("outputs") or []
        if not outputs:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "HunyuanVideo-1.5 completed but returned no outputs",
                    "prediction_id": prediction_id,
                    "status": result.get("status"),
                }
            )
        
        video_url = outputs[0]
        if not isinstance(video_url, str) or not video_url.startswith("http"):
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Invalid video URL format: {video_url}",
                    "prediction_id": prediction_id,
                }
            )
        
        # Download video
        logger.info(f"[HunyuanVideo] Downloading video from: {video_url}")
        try:
            video_response = requests.get(video_url, timeout=180)
            if video_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "Failed to download HunyuanVideo-1.5 video",
                        "status_code": video_response.status_code,
                        "response": video_response.text[:200],
                        "prediction_id": prediction_id,
                    }
                )
        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Failed to download video: {str(e)}",
                    "prediction_id": prediction_id,
                }
            )
        
        video_bytes = video_response.content
        if len(video_bytes) == 0:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Downloaded video is empty",
                    "prediction_id": prediction_id,
                }
            )
        
        # Calculate cost
        cost = self.calculate_cost(resolution, duration)
        
        # Get video dimensions from size
        width, height = map(int, size.split("*"))
        
        # Extract metadata
        metadata = result.get("metadata", {})
        metadata.update({
            "has_nsfw_contents": result.get("has_nsfw_contents", []),
            "created_at": result.get("created_at"),
            "size": size,
        })
        
        logger.info(
            f"[HunyuanVideo] ✅ Generated video: {len(video_bytes)} bytes, "
            f"resolution={resolution}, duration={duration}s, cost=${cost:.2f}"
        )
        
        # Progress callback: completed
        if progress_callback:
            progress_callback(100.0, "Video generation completed!")
        
        # Return metadata dict
        return {
            "video_bytes": video_bytes,
            "prompt": prompt,
            "duration": float(duration),
            "model_name": self.MODEL_NAME,
            "cost": cost,
            "provider": "wavespeed",
            "resolution": resolution,
            "width": width,
            "height": height,
            "metadata": metadata,
            "source_video_url": video_url,
            "prediction_id": prediction_id,
        }


class LTX2ProService(BaseWaveSpeedTextToVideoService):
    """
    Service for Lightricks LTX-2 Pro text-to-video generation.
    
    LTX-2 Pro is a next-generation AI creative engine by Lightricks, designed for
    real production workflows. It generates high-quality, synchronized audio and
    1080p video directly from text.
    
    Official API Documentation:
    https://wavespeed.ai/docs/docs-api/lightricks/ltx-2-pro/text-to-video
    
    Features:
    - Video durations: 6s, 8s, or 10s
    - Fixed resolution: 1080p
    - Synchronized audio generation (optional)
    - Production-ready quality
    """
    
    MODEL_PATH = "lightricks/ltx-2-pro/text-to-video"
    MODEL_NAME = "lightricks/ltx-2-pro/text-to-video"
    
    # Pricing per second (from official docs: https://wavespeed.ai/docs/docs-api/lightricks/lightricks-ltx-2-pro-text-to-video)
    PRICING = {
        "1080p": 0.06,  # $0.06 per second for 1080p
    }
    
    def calculate_cost(self, resolution: str, duration: int) -> float:
        """Calculate cost for video generation.
        
        Args:
            resolution: Output resolution (always 1080p for LTX-2 Pro)
            duration: Video duration in seconds (6, 8, or 10)
            
        Returns:
            Cost in USD
        """
        # LTX-2 Pro is always 1080p
        cost_per_second = self.PRICING.get("1080p", 0.10)
        return cost_per_second * duration
    
    def _validate_inputs(
        self,
        prompt: str,
        duration: int,
        resolution: str,
    ) -> None:
        """Validate input parameters for LTX-2 Pro.
        
        Args:
            prompt: Text prompt
            duration: Video duration (6, 8, or 10 seconds)
            resolution: Output resolution (ignored - always 1080p)
            
        Raises:
            HTTPException: If validation fails
        """
        if not prompt or not prompt.strip():
            raise HTTPException(
                status_code=400,
                detail="Prompt is required and cannot be empty"
            )
        
        # LTX-2 Pro supports 6, 8, or 10 seconds
        if duration not in [6, 8, 10]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid duration: {duration}. Must be 6, 8, or 10 seconds for LTX-2 Pro"
            )
        
        # LTX-2 Pro is fixed at 1080p - resolution parameter is ignored
        # But we validate it's a valid resolution for consistency
        if resolution and resolution not in ["480p", "720p", "1080p"]:
            logger.warning(f"[LTX-2 Pro] Resolution {resolution} specified but LTX-2 Pro is fixed at 1080p")
    
    async def generate_video(
        self,
        prompt: str,
        duration: int = 6,
        resolution: str = "1080p",
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        audio_base64: Optional[str] = None,
        enable_prompt_expansion: bool = True,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate video using Lightricks LTX-2 Pro.
        
        Reference: https://wavespeed.ai/docs/docs-api/lightricks/ltx-2-pro/text-to-video
        
        Args:
            prompt: Text prompt describing the video
            duration: Video duration in seconds (6, 8, or 10)
            resolution: Output resolution (ignored - LTX-2 Pro is fixed at 1080p)
            negative_prompt: Not supported by LTX-2 Pro (ignored with warning)
            seed: Not supported by LTX-2 Pro (ignored with warning)
            audio_base64: Not supported by LTX-2 Pro (ignored with warning)
            enable_prompt_expansion: Not supported by LTX-2 Pro (ignored with warning)
            progress_callback: Optional progress callback function
            **kwargs: Additional parameters (generate_audio: bool, default: True)
            
        Returns:
            Dictionary with video_bytes, prompt, duration, model_name, cost, etc.
        """
        # Validate inputs (LTX-2 Pro specific)
        self._validate_inputs(prompt, duration, resolution)
        
        # Get generate_audio from kwargs (default: True)
        generate_audio = kwargs.get("generate_audio", True)
        if not isinstance(generate_audio, bool):
            generate_audio = True  # Default to True if invalid type
        
        # Build payload according to API spec
        payload = {
            "prompt": prompt.strip(),
            "duration": duration,
            "generate_audio": generate_audio,
        }
        
        # Note: negative_prompt, seed, audio_base64, enable_prompt_expansion are not supported
        if negative_prompt:
            logger.warning("[LTX-2 Pro] negative_prompt is not supported by LTX-2 Pro, ignoring")
        if seed is not None:
            logger.warning("[LTX-2 Pro] seed is not supported by LTX-2 Pro, ignoring")
        if audio_base64:
            logger.warning("[LTX-2 Pro] audio_base64 is not supported by LTX-2 Pro, ignoring")
        if not enable_prompt_expansion:
            logger.warning("[LTX-2 Pro] enable_prompt_expansion is not supported by LTX-2 Pro, ignoring")
        
        logger.info(
            f"[LTX-2 Pro] Generating video: duration={duration}s, "
            f"generate_audio={generate_audio}, prompt_length={len(prompt)}"
        )
        
        # Progress callback: submission
        if progress_callback:
            progress_callback(10.0, "Submitting LTX-2 Pro request to WaveSpeed...")
        
        # Submit request using WaveSpeedClient
        try:
            prediction_id = self.client.submit_text_to_video(
                model_path=self.MODEL_PATH,
                payload=payload,
                timeout=60,
            )
        except HTTPException as e:
            logger.error(f"[LTX-2 Pro] Submission failed: {e.detail}")
            raise
        
        logger.info(f"[LTX-2 Pro] Request submitted: prediction_id={prediction_id}")
        
        # Progress callback: polling started
        if progress_callback:
            progress_callback(20.0, f"Polling for completion (prediction_id: {prediction_id})...")
        
        # Poll for completion with progress updates
        try:
            result = await asyncio.to_thread(
                self.client.poll_until_complete,
                prediction_id,
                timeout_seconds=600,  # 10 minutes max
                interval_seconds=0.5,  # Poll every 0.5 seconds
                progress_callback=progress_callback,
            )
        except HTTPException as e:
            detail = e.detail or {}
            if isinstance(detail, dict):
                detail.setdefault("prediction_id", prediction_id)
                detail.setdefault("resume_available", True)
            logger.error(f"[LTX-2 Pro] Polling failed: {detail}")
            raise HTTPException(status_code=e.status_code, detail=detail)
        
        # Progress callback: processing result
        if progress_callback:
            progress_callback(90.0, "Downloading generated video...")
        
        # Extract video URL from result
        outputs = result.get("outputs") or []
        if not outputs:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "LTX-2 Pro completed but returned no outputs",
                    "prediction_id": prediction_id,
                    "status": result.get("status"),
                }
            )
        
        video_url = outputs[0]
        if not isinstance(video_url, str) or not video_url.startswith("http"):
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Invalid video URL format: {video_url}",
                    "prediction_id": prediction_id,
                }
            )
        
        # Download video
        logger.info(f"[LTX-2 Pro] Downloading video from: {video_url}")
        try:
            video_response = requests.get(video_url, timeout=180)
            if video_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "Failed to download LTX-2 Pro video",
                        "status_code": video_response.status_code,
                        "response": video_response.text[:200],
                        "prediction_id": prediction_id,
                    }
                )
        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Failed to download video: {str(e)}",
                    "prediction_id": prediction_id,
                }
            )
        
        video_bytes = video_response.content
        if len(video_bytes) == 0:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Downloaded video is empty",
                    "prediction_id": prediction_id,
                }
            )
        
        # Calculate cost
        cost = self.calculate_cost("1080p", duration)
        
        # LTX-2 Pro is fixed at 1080p
        width, height = 1920, 1080
        
        # Extract metadata
        metadata = result.get("metadata", {})
        metadata.update({
            "has_nsfw_contents": result.get("has_nsfw_contents", []),
            "created_at": result.get("created_at"),
            "generate_audio": generate_audio,
            "resolution": "1080p",  # Fixed resolution
        })
        
        logger.info(
            f"[LTX-2 Pro] ✅ Generated video: {len(video_bytes)} bytes, "
            f"duration={duration}s, generate_audio={generate_audio}, cost=${cost:.2f}"
        )
        
        # Progress callback: completed
        if progress_callback:
            progress_callback(100.0, "Video generation completed!")
        
        # Return metadata dict
        return {
            "video_bytes": video_bytes,
            "prompt": prompt,
            "duration": float(duration),
            "model_name": self.MODEL_NAME,
            "cost": cost,
            "provider": "wavespeed",
            "resolution": "1080p",
            "width": width,
            "height": height,
            "metadata": metadata,
            "source_video_url": video_url,
            "prediction_id": prediction_id,
        }


class GoogleVeo31Service(BaseWaveSpeedTextToVideoService):
    """
    Service for Google Veo 3.1 text-to-video generation.
    
    Google Veo 3.1 converts text prompts into videos with synchronized audio
    at native 1080p for high-quality outputs. Designed for professional content creation.
    
    Official API Documentation:
    https://wavespeed.ai/docs/docs-api/google/veo3.1/text-to-video
    
    Features:
    - Video durations: 4s, 6s, or 8s
    - Resolutions: 720p or 1080p
    - Aspect ratios: 16:9 or 9:16
    - Synchronized audio generation (optional)
    - Negative prompt support
    - Seed control for reproducibility
    """
    
    MODEL_PATH = "google/veo3.1/text-to-video"
    MODEL_NAME = "google/veo3.1/text-to-video"
    
    # Pricing per second (TODO: Update with actual pricing from docs)
    PRICING = {
        "720p": 0.08,   # Placeholder - update with actual pricing
        "1080p": 0.12,  # Placeholder - update with actual pricing
    }
    
    def calculate_cost(self, resolution: str, duration: int) -> float:
        """Calculate cost for video generation.
        
        Args:
            resolution: Output resolution (720p, 1080p)
            duration: Video duration in seconds (4, 6, or 8)
            
        Returns:
            Cost in USD
        """
        cost_per_second = self.PRICING.get(resolution, self.PRICING["1080p"])
        return cost_per_second * duration
    
    def _validate_inputs(
        self,
        prompt: str,
        duration: int,
        resolution: str,
    ) -> None:
        """Validate input parameters for Google Veo 3.1.
        
        Args:
            prompt: Text prompt
            duration: Video duration (4, 6, or 8 seconds)
            resolution: Output resolution (720p or 1080p)
            
        Raises:
            HTTPException: If validation fails
        """
        if not prompt or not prompt.strip():
            raise HTTPException(
                status_code=400,
                detail="Prompt is required and cannot be empty"
            )
        
        # Google Veo 3.1 supports 4, 6, or 8 seconds
        if duration not in [4, 6, 8]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid duration: {duration}. Must be 4, 6, or 8 seconds for Google Veo 3.1"
            )
        
        # Google Veo 3.1 supports 720p and 1080p
        valid_resolutions = ["720p", "1080p"]
        if resolution not in valid_resolutions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resolution: {resolution}. Must be one of: {valid_resolutions} for Google Veo 3.1"
            )
    
    async def generate_video(
        self,
        prompt: str,
        duration: int = 8,
        resolution: str = "1080p",
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        audio_base64: Optional[str] = None,
        enable_prompt_expansion: bool = True,
        progress_callback: Optional[Callable[[float, str], None]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate video using Google Veo 3.1.
        
        Reference: https://wavespeed.ai/docs/docs-api/google/veo3.1/text-to-video
        
        Args:
            prompt: Text prompt describing the video
            duration: Video duration in seconds (4, 6, or 8)
            resolution: Output resolution (720p, 1080p)
            negative_prompt: Optional negative prompt
            seed: Optional random seed for reproducibility
            audio_base64: Not supported by Veo 3.1 (ignored with warning)
            enable_prompt_expansion: Not supported by Veo 3.1 (ignored with warning)
            progress_callback: Optional progress callback function
            **kwargs: Additional parameters (aspect_ratio: "16:9" or "9:16", generate_audio: bool)
            
        Returns:
            Dictionary with video_bytes, prompt, duration, model_name, cost, etc.
        """
        # Validate inputs (Google Veo 3.1 specific)
        self._validate_inputs(prompt, duration, resolution)
        
        # Get aspect_ratio from kwargs (default: "16:9")
        aspect_ratio = kwargs.get("aspect_ratio", "16:9")
        if aspect_ratio not in ["16:9", "9:16"]:
            aspect_ratio = "16:9"  # Default to 16:9 if invalid
        
        # Get generate_audio from kwargs (default: True)
        generate_audio = kwargs.get("generate_audio", True)
        if not isinstance(generate_audio, bool):
            generate_audio = True  # Default to True if invalid type
        
        # Build payload according to API spec
        payload = {
            "prompt": prompt.strip(),
            "duration": duration,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
            "generate_audio": generate_audio,
        }
        
        # Add optional parameters
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt.strip()
        
        if seed is not None:
            payload["seed"] = seed
        
        # Note: audio_base64 and enable_prompt_expansion are not supported
        if audio_base64:
            logger.warning("[Google Veo 3.1] audio_base64 is not supported by Veo 3.1, ignoring")
        if not enable_prompt_expansion:
            logger.warning("[Google Veo 3.1] enable_prompt_expansion is not supported by Veo 3.1, ignoring")
        
        logger.info(
            f"[Google Veo 3.1] Generating video: resolution={resolution}, "
            f"duration={duration}s, aspect_ratio={aspect_ratio}, generate_audio={generate_audio}, prompt_length={len(prompt)}"
        )
        
        # Progress callback: submission
        if progress_callback:
            progress_callback(10.0, "Submitting Google Veo 3.1 request to WaveSpeed...")
        
        # Submit request using WaveSpeedClient
        try:
            prediction_id = self.client.submit_text_to_video(
                model_path=self.MODEL_PATH,
                payload=payload,
                timeout=60,
            )
        except HTTPException as e:
            logger.error(f"[Google Veo 3.1] Submission failed: {e.detail}")
            raise
        
        logger.info(f"[Google Veo 3.1] Request submitted: prediction_id={prediction_id}")
        
        # Progress callback: polling started
        if progress_callback:
            progress_callback(20.0, f"Polling for completion (prediction_id: {prediction_id})...")
        
        # Poll for completion with progress updates
        try:
            result = await asyncio.to_thread(
                self.client.poll_until_complete,
                prediction_id,
                timeout_seconds=600,  # 10 minutes max
                interval_seconds=0.5,  # Poll every 0.5 seconds
                progress_callback=progress_callback,
            )
        except HTTPException as e:
            detail = e.detail or {}
            if isinstance(detail, dict):
                detail.setdefault("prediction_id", prediction_id)
                detail.setdefault("resume_available", True)
            logger.error(f"[Google Veo 3.1] Polling failed: {detail}")
            raise HTTPException(status_code=e.status_code, detail=detail)
        
        # Progress callback: processing result
        if progress_callback:
            progress_callback(90.0, "Downloading generated video...")
        
        # Extract video URL from result
        outputs = result.get("outputs") or []
        if not outputs:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Google Veo 3.1 completed but returned no outputs",
                    "prediction_id": prediction_id,
                    "status": result.get("status"),
                }
            )
        
        video_url = outputs[0]
        if not isinstance(video_url, str) or not video_url.startswith("http"):
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Invalid video URL format: {video_url}",
                    "prediction_id": prediction_id,
                }
            )
        
        # Download video
        logger.info(f"[Google Veo 3.1] Downloading video from: {video_url}")
        try:
            video_response = requests.get(video_url, timeout=180)
            if video_response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail={
                        "error": "Failed to download Google Veo 3.1 video",
                        "status_code": video_response.status_code,
                        "response": video_response.text[:200],
                        "prediction_id": prediction_id,
                    }
                )
        except requests.exceptions.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": f"Failed to download video: {str(e)}",
                    "prediction_id": prediction_id,
                }
            )
        
        video_bytes = video_response.content
        if len(video_bytes) == 0:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Downloaded video is empty",
                    "prediction_id": prediction_id,
                }
            )
        
        # Calculate cost
        cost = self.calculate_cost(resolution, duration)
        
        # Get video dimensions from resolution and aspect ratio
        if resolution == "720p":
            width, height = (1280, 720) if aspect_ratio == "16:9" else (720, 1280)
        else:  # 1080p
            width, height = (1920, 1080) if aspect_ratio == "16:9" else (1080, 1920)
        
        # Extract metadata
        metadata = result.get("metadata", {})
        metadata.update({
            "has_nsfw_contents": result.get("has_nsfw_contents", []),
            "created_at": result.get("created_at"),
            "generate_audio": generate_audio,
            "aspect_ratio": aspect_ratio,
            "resolution": resolution,
        })
        
        logger.info(
            f"[Google Veo 3.1] ✅ Generated video: {len(video_bytes)} bytes, "
            f"resolution={resolution}, duration={duration}s, aspect_ratio={aspect_ratio}, cost=${cost:.2f}"
        )
        
        # Progress callback: completed
        if progress_callback:
            progress_callback(100.0, "Video generation completed!")
        
        # Return metadata dict
        return {
            "video_bytes": video_bytes,
            "prompt": prompt,
            "duration": float(duration),
            "model_name": self.MODEL_NAME,
            "cost": cost,
            "provider": "wavespeed",
            "resolution": resolution,
            "width": width,
            "height": height,
            "metadata": metadata,
            "source_video_url": video_url,
            "prediction_id": prediction_id,
        }


def get_wavespeed_text_to_video_service(model: str) -> BaseWaveSpeedTextToVideoService:
    """
    Get the appropriate WaveSpeed text-to-video service for the given model.
    
    Args:
        model: Model identifier (e.g., "hunyuan-video-1.5", "ltx-2-pro")
        
    Returns:
        Appropriate service instance
        
    Raises:
        ValueError: If model is not supported
    """
    model_mapping = {
        "hunyuan-video-1.5": HunyuanVideoService,
        "wavespeed-ai/hunyuan-video-1.5": HunyuanVideoService,
        "wavespeed-ai/hunyuan-video-1.5/text-to-video": HunyuanVideoService,
        "ltx-2-pro": LTX2ProService,
        "lightricks/ltx-2-pro": LTX2ProService,
        "lightricks/ltx-2-pro/text-to-video": LTX2ProService,
        "veo3.1": GoogleVeo31Service,
        "google/veo3.1": GoogleVeo31Service,
        "google/veo3.1/text-to-video": GoogleVeo31Service,
        # TODO: Add other models as they are implemented
        # "lightricks/ltx-2-fast": LTX2FastService,
        # "lightricks/ltx-2-retake": LTX2RetakeService,
    }
    
    # Try exact match first
    service_class = model_mapping.get(model)
    if service_class:
        return service_class()
    
    # Try partial match (e.g., "hunyuan" -> "hunyuan-video-1.5")
    model_lower = model.lower()
    for key, service_class in model_mapping.items():
        if model_lower in key.lower() or key.lower() in model_lower:
            return service_class()
    
    raise ValueError(
        f"Unsupported WaveSpeed text-to-video model: {model}. "
        f"Supported models: {list(model_mapping.keys())}"
    )
