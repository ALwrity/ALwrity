"""
WaveSpeed AI API Client

Thin HTTP client for the WaveSpeed AI API.
Handles authentication, submission, and delegates to specialized generators.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Callable

from fastapi import HTTPException

from services.onboarding.api_key_manager import APIKeyManager
from utils.logger_utils import get_service_logger
from .polling import WaveSpeedPolling
from .generators.prompt import PromptGenerator
from .generators.image import ImageGenerator
from .generators.video import VideoGenerator
from .generators.speech import SpeechGenerator

logger = get_service_logger("wavespeed.client")


class WaveSpeedClient:
    """
    Thin HTTP client for the WaveSpeed AI API.
    Handles authentication, submission, and polling helpers.
    """

    BASE_URL = "https://api.wavespeed.ai/api/v3"

    def __init__(self, api_key: Optional[str] = None):
        manager = APIKeyManager()
        self.api_key = api_key or manager.get_api_key("wavespeed")
        if not self.api_key:
            raise RuntimeError("WAVESPEED_API_KEY is not configured. Please add it to your environment.")
        
        # Initialize polling utilities
        self.polling = WaveSpeedPolling(self.api_key, self.BASE_URL)
        
        # Initialize generators
        self.prompt = PromptGenerator(self.api_key, self.BASE_URL, self.polling)
        self.image = ImageGenerator(self.api_key, self.BASE_URL, self.polling)
        self.video = VideoGenerator(self.api_key, self.BASE_URL, self.polling)
        self.speech = SpeechGenerator(self.api_key, self.BASE_URL, self.polling)

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    # Core submission methods (delegated to video generator)
    def submit_image_to_video(
        self,
        model_path: str,
        payload: Dict[str, Any],
        timeout: int = 30,
    ) -> str:
        """
        Submit an image-to-video generation request.

        Returns the prediction ID for polling.
        """
        return self.video.submit_image_to_video(model_path, payload, timeout)

    def submit_text_to_video(
        self,
        model_path: str,
        payload: Dict[str, Any],
        timeout: int = 60,
    ) -> str:
        """
        Submit a text-to-video generation request to WaveSpeed.
        
        Args:
            model_path: Model path (e.g., "alibaba/wan-2.5/text-to-video")
            payload: Request payload with prompt, resolution, duration, optional audio
            timeout: Request timeout in seconds
            
        Returns:
            Prediction ID for polling
        """
        return self.video.submit_text_to_video(model_path, payload, timeout)

    # Polling methods (delegated to polling utilities)
    def get_prediction_result(self, prediction_id: str, timeout: int = 30) -> Dict[str, Any]:
        """
        Fetch the current status/result for a prediction.
        Matches the example pattern: simple GET request, check status_code == 200, return data.
        """
        return self.polling.get_prediction_result(prediction_id, timeout)

    def poll_until_complete(
        self,
        prediction_id: str,
        timeout_seconds: Optional[int] = None,
        interval_seconds: float = 1.0,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Poll WaveSpeed until the job completes or fails.
        Matches the example pattern: simple polling loop until status is "completed" or "failed".
        
        Args:
            prediction_id: The prediction ID to poll for
            timeout_seconds: Optional timeout in seconds. If None, polls indefinitely until completion/failure.
            interval_seconds: Seconds to wait between polling attempts (default: 1.0, faster than 2.0)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
        
        Returns:
            Dict containing the completed result
            
        Raises:
            HTTPException: If the task fails, polling fails, or times out (if timeout_seconds is set)
        """
        return self.polling.poll_until_complete(
            prediction_id,
            timeout_seconds=timeout_seconds,
            interval_seconds=interval_seconds,
            progress_callback=progress_callback,
        )

    # Generator methods (delegated to specialized generators)
    def optimize_prompt(
        self,
        text: str,
        mode: str = "image",
        style: str = "default",
        image: Optional[str] = None,
        enable_sync_mode: bool = True,
        timeout: int = 30,
    ) -> str:
        """
        Optimize a prompt using WaveSpeed prompt optimizer.
        
        Args:
            text: The prompt text to optimize
            mode: "image" or "video" (default: "image")
            style: "default", "artistic", "photographic", "technical", "anime", "realistic" (default: "default")
            image: Base64-encoded image for context (optional)
            enable_sync_mode: If True, wait for result and return it directly (default: True)
            timeout: Request timeout in seconds (default: 30)
            
        Returns:
            Optimized prompt text
        """
        return self.prompt.optimize_prompt(
            text=text,
            mode=mode,
            style=style,
            image=image,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
        )

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
        Generate image using WaveSpeed AI models (Ideogram V3 or Qwen Image).
        
        Args:
            model: Model to use ("ideogram-v3-turbo" or "qwen-image")
            prompt: Text prompt for image generation
            width: Image width (default: 1024)
            height: Image height (default: 1024)
            num_inference_steps: Number of inference steps
            guidance_scale: Guidance scale for generation
            negative_prompt: Negative prompt (what to avoid)
            seed: Random seed for reproducibility
            enable_sync_mode: If True, wait for result and return it directly (default: True)
            timeout: Request timeout in seconds (default: 120)
            **kwargs: Additional parameters
            
        Returns:
            bytes: Generated image bytes
        """
        return self.image.generate_image(
            model=model,
            prompt=prompt,
            width=width,
            height=height,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            negative_prompt=negative_prompt,
            seed=seed,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            **kwargs
        )

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
        return self.image.generate_character_image(
            prompt=prompt,
            reference_image_bytes=reference_image_bytes,
            style=style,
            aspect_ratio=aspect_ratio,
            rendering_speed=rendering_speed,
            timeout=timeout,
        )

    def generate_speech(
        self,
        text: str,
        voice_id: str,
        custom_voice_id: Optional[str] = None,
        speed: float = 1.0,
        volume: float = 1.0,
        pitch: float = 0.0,
        emotion: str = "happy",
        enable_sync_mode: bool = True,
        timeout: int = 120,
        **kwargs
    ) -> bytes:
        """
        Generate speech audio using Minimax Speech 02 HD via WaveSpeed.
        
        Args:
            text: Text to convert to speech (max 10000 characters)
            voice_id: Voice ID (e.g., "Wise_Woman", "Friendly_Person", etc.)
            custom_voice_id: Custom voice clone ID for using cloned voice
            speed: Speech speed (0.5-2.0, default: 1.0)
            volume: Speech volume (0.1-10.0, default: 1.0)
            pitch: Speech pitch (-12 to 12, default: 0.0)
            emotion: Emotion ("happy", "sad", "angry", etc., default: "happy")
            enable_sync_mode: If True, wait for result and return it directly (default: True)
            timeout: Request timeout in seconds (default: 60)
            **kwargs: Additional parameters (sample_rate, bitrate, format, etc.)
            
        Returns:
            bytes: Generated audio bytes
        """
        return self.speech.generate_speech(
            text=text,
            voice_id=voice_id,
            custom_voice_id=custom_voice_id,
            speed=speed,
            volume=volume,
            pitch=pitch,
            emotion=emotion,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            **kwargs
        )

    def voice_clone(
        self,
        audio_bytes: bytes,
        custom_voice_id: str,
        model: str = "speech-02-hd",
        *,
        audio_mime_type: str = "audio/wav",
        text: Optional[str] = None,
        need_noise_reduction: bool = False,
        need_volume_normalization: bool = False,
        accuracy: float = 0.7,
        language_boost: Optional[str] = None,
        timeout: int = 180,
    ) -> bytes:
        return self.speech.voice_clone(
            audio_bytes=audio_bytes,
            custom_voice_id=custom_voice_id,
            model=model,
            audio_mime_type=audio_mime_type,
            text=text,
            need_noise_reduction=need_noise_reduction,
            need_volume_normalization=need_volume_normalization,
            accuracy=accuracy,
            language_boost=language_boost,
            timeout=timeout,
        )

    def qwen3_voice_clone(
        self,
        audio_bytes: bytes,
        text: str,
        *,
        audio_mime_type: str = "audio/wav",
        language: str = "auto",
        reference_text: Optional[str] = None,
        timeout: int = 180,
    ) -> bytes:
        return self.speech.qwen3_voice_clone(
            audio_bytes=audio_bytes,
            text=text,
            audio_mime_type=audio_mime_type,
            language=language,
            reference_text=reference_text,
            timeout=timeout,
        )

    def voice_design(
        self,
        text: str,
        voice_description: str,
        language: str = "auto",
        timeout: int = 180,
    ) -> bytes:
        return self.speech.voice_design(
            text=text,
            voice_description=voice_description,
            language=language,
            timeout=timeout,
        )

    def cosyvoice_voice_clone(
        self,
        audio_bytes: bytes,
        text: str,
        *,
        model: str = "wavespeed-ai/qwen3-tts/voice-clone",
        audio_mime_type: str = "audio/wav",
        reference_text: Optional[str] = None,
        timeout: int = 180,
    ) -> bytes:
        return self.speech.cosyvoice_voice_clone(
            audio_bytes=audio_bytes,
            text=text,
            model=model,
            audio_mime_type=audio_mime_type,
            reference_text=reference_text,
            timeout=timeout,
        )

    def generate_text_video(
        self,
        prompt: str,
        resolution: str = "720p",  # 480p, 720p, 1080p
        duration: int = 5,  # 5 or 10 seconds
        audio_base64: Optional[str] = None,  # Optional audio for lip-sync
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        enable_prompt_expansion: bool = True,
        enable_sync_mode: bool = False,
        timeout: int = 180,
    ) -> Dict[str, Any]:
        """
        Generate video from text prompt using WAN 2.5 text-to-video.
        
        Args:
            prompt: Text prompt describing the video
            resolution: Output resolution (480p, 720p, 1080p)
            duration: Video duration in seconds (5 or 10)
            audio_base64: Optional audio file (wav/mp3, 3-30s, ≤15MB) for lip-sync
            negative_prompt: Optional negative prompt
            seed: Optional random seed for reproducibility
            enable_prompt_expansion: Enable prompt optimizer
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds
            
        Returns:
            Dictionary with video bytes, metadata, and cost
        """
        return self.video.generate_text_video(
            prompt=prompt,
            resolution=resolution,
            duration=duration,
            audio_base64=audio_base64,
            negative_prompt=negative_prompt,
            seed=seed,
            enable_prompt_expansion=enable_prompt_expansion,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
        )
    
    def upscale_video(
        self,
        video: str,
        target_resolution: str = "1080p",
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Upscale video using FlashVSR.
        
        Args:
            video: Base64-encoded video data URI or public URL
            target_resolution: Target resolution ("720p", "1080p", "2k", "4k")
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300 for long videos)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Upscaled video bytes
        """
        return self.video.upscale_video(
            video=video,
            target_resolution=target_resolution,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def extend_video(
        self,
        video: str,
        prompt: str,
        model: str = "wan-2.5",
        audio: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        resolution: str = "720p",
        duration: int = 5,
        enable_prompt_expansion: bool = False,
        generate_audio: bool = True,
        camera_fixed: bool = False,
        seed: Optional[int] = None,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Extend video duration using WAN 2.5, WAN 2.2 Spicy, or Seedance 1.5 Pro video-extend.
        
        Args:
            video: Base64-encoded video data URI or public URL
            prompt: Text prompt describing how to extend the video
            model: Model to use ("wan-2.5", "wan-2.2-spicy", or "seedance-1.5-pro")
            audio: Optional audio URL to guide generation (WAN 2.5 only)
            negative_prompt: Optional negative prompt (WAN 2.5 only)
            resolution: Output resolution (varies by model)
            duration: Duration of extended video in seconds (varies by model)
            enable_prompt_expansion: Enable prompt optimizer (WAN 2.5 only)
            generate_audio: Generate audio for extended video (Seedance 1.5 Pro only)
            camera_fixed: Fix camera position (Seedance 1.5 Pro only)
            seed: Random seed for reproducibility (-1 for random)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Extended video bytes
        """
        return self.video.extend_video(
            video=video,
            prompt=prompt,
            model=model,
            audio=audio,
            negative_prompt=negative_prompt,
            resolution=resolution,
            duration=duration,
            enable_prompt_expansion=enable_prompt_expansion,
            generate_audio=generate_audio,
            camera_fixed=camera_fixed,
            seed=seed,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def face_swap(
        self,
        image: str,
        video: str,
        prompt: Optional[str] = None,
        resolution: str = "480p",
        seed: Optional[int] = None,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Perform face/character swap using MoCha (wavespeed-ai/wan-2.1/mocha).
        
        Args:
            image: Base64-encoded image data URI or public URL (reference character)
            video: Base64-encoded video data URI or public URL (source video)
            prompt: Optional prompt to guide the swap
            resolution: Output resolution ("480p" or "720p")
            seed: Random seed for reproducibility (-1 for random)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Face-swapped video bytes
        """
        return self.video.face_swap(
            image=image,
            video=video,
            prompt=prompt,
            resolution=resolution,
            seed=seed,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def video_face_swap(
        self,
        video: str,
        face_image: str,
        target_gender: str = "all",
        target_index: int = 0,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Perform face swap using Video Face Swap (wavespeed-ai/video-face-swap).
        
        Args:
            video: Base64-encoded video data URI or public URL (source video)
            face_image: Base64-encoded image data URI or public URL (reference face)
            target_gender: Filter which faces to swap ("all", "female", "male")
            target_index: Select which face to swap (0 = largest, 1 = second largest, etc.)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Face-swapped video bytes
        """
        return self.video.video_face_swap(
            video=video,
            face_image=face_image,
            target_gender=target_gender,
            target_index=target_index,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def video_translate(
        self,
        video: str,
        output_language: str = "English",
        enable_sync_mode: bool = False,
        timeout: int = 600,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Translate video to target language using HeyGen Video Translate.
        
        Args:
            video: Base64-encoded video data URI or public URL (source video)
            output_language: Target language for translation (default: "English")
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 600)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Translated video bytes
        """
        return self.video.video_translate(
            video=video,
            output_language=output_language,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def remove_background(
        self,
        video: str,
        background_image: Optional[str] = None,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Remove or replace video background using Video Background Remover.
        
        Args:
            video: Base64-encoded video data URI or public URL (source video)
            background_image: Optional base64-encoded image data URI or public URL (replacement background)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Video with background removed/replaced
        """
        return self.video.remove_background(
            video=video,
            background_image=background_image,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def hunyuan_video_foley(
        self,
        video: str,
        prompt: Optional[str] = None,
        seed: int = -1,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Generate realistic Foley and ambient audio from video using Hunyuan Video Foley.
        
        Args:
            video: Base64-encoded video data URI or public URL (source video)
            prompt: Optional text prompt describing desired sounds (e.g., "ocean waves, seagulls")
            seed: Random seed for reproducibility (-1 for random)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Video with generated audio
        """
        return self.video.hunyuan_video_foley(
            video=video,
            prompt=prompt,
            seed=seed,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
    
    def think_sound(
        self,
        video: str,
        prompt: Optional[str] = None,
        seed: int = -1,
        enable_sync_mode: bool = False,
        timeout: int = 300,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> bytes:
        """
        Generate realistic sound effects and audio tracks from video using Think Sound.
        
        Args:
            video: Base64-encoded video data URI or public URL (source video)
            prompt: Optional text prompt describing desired sounds (e.g., "engine roaring, footsteps on gravel")
            seed: Random seed for reproducibility (-1 for random)
            enable_sync_mode: If True, wait for result and return it directly
            timeout: Request timeout in seconds (default: 300)
            progress_callback: Optional callback function(progress: float, message: str) for progress updates
            
        Returns:
            bytes: Video with generated audio
        """
        return self.video.think_sound(
            video=video,
            prompt=prompt,
            seed=seed,
            enable_sync_mode=enable_sync_mode,
            timeout=timeout,
            progress_callback=progress_callback,
        )
