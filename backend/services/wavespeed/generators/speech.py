"""
Speech generation generator for WaveSpeed API.
"""

import time
import base64
import requests
from typing import Optional
from requests import exceptions as requests_exceptions
from fastapi import HTTPException

from utils.logger_utils import get_service_logger

logger = get_service_logger("wavespeed.generators.speech")


class SpeechGenerator:
    """Speech generation generator."""
    
    def __init__(self, api_key: str, base_url: str, polling):
        """Initialize speech generator.
        
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
        model_path = "minimax/speech-02-hd"
        url = f"{self.base_url}/{model_path}"
        
        # Sanitize and validate parameters
        sanitized_text = str(text).strip()
        if not sanitized_text:
            raise ValueError("Text cannot be empty after sanitization")
            
        sanitized_voice_id = str(voice_id).strip()
        if not sanitized_voice_id:
            raise ValueError("Voice ID cannot be empty after sanitization")
        
        # Sanitize custom_voice_id if provided
        sanitized_custom_voice_id = None
        if custom_voice_id:
            sanitized_custom_voice_id = str(custom_voice_id).strip() or None
        
        # Ensure numeric parameters are proper floats and within valid ranges
        sanitized_speed = max(0.5, min(2.0, float(speed))) if speed is not None else 1.0
        sanitized_volume = max(0.1, min(10.0, float(volume))) if volume is not None else 1.0
        sanitized_pitch = max(-12.0, min(12.0, float(pitch))) if pitch is not None else 0.0
        
        # Sanitize emotion parameter - remove newlines and extra whitespace
        sanitized_emotion = str(emotion).strip().replace('\n', '').replace('\r', '')
        
        # Map common emotions to minimax valid values
        emotion_mapping = {
            'neutral': 'neutral',
            'happy': 'happy', 
            'sad': 'sad',
            'angry': 'angry',
            'excited': 'happy',
            'calm': 'neutral',
            'friendly': 'happy',
            'professional': 'neutral',
            'warm': 'happy',
            'serious': 'neutral'
        }
        
        # Use mapped emotion or default to 'happy'
        mapped_emotion = emotion_mapping.get(sanitized_emotion.lower(), 'happy')
        
        payload = {
            "text": sanitized_text,
            "voice_id": sanitized_voice_id,
            "speed": sanitized_speed,
            "volume": sanitized_volume,
            "pitch": sanitized_pitch,
            "emotion": mapped_emotion,
            "enable_sync_mode": bool(enable_sync_mode),
        }
        
        # Add custom voice clone ID if provided
        if sanitized_custom_voice_id:
            payload["custom_voice_id"] = sanitized_custom_voice_id
        
        # Add optional parameters with proper type validation
        optional_params = [
            "english_normalization",
            "sample_rate", 
            "bitrate",
            "channel",
            "format",
            "language_boost",
        ]
        for param in optional_params:
            if param in kwargs and kwargs[param] is not None:
                value = kwargs[param]
                # Convert to appropriate type based on parameter
                if param == "english_normalization":
                    payload[param] = bool(value)
                elif param in ["sample_rate", "bitrate"]:
                    payload[param] = int(value) if value is not None else None
                else:
                    payload[param] = str(value).strip() if value is not None else None
        
        logger.info(f"[WaveSpeed] Generating speech via {url} (voice={voice_id}, text_length={len(text)})")
        logger.debug(f"[WaveSpeed] Payload being sent: {payload}")

        # Retry on transient connection issues
        max_retries = 2
        retry_delay = 2.0
        for attempt in range(max_retries + 1):
            try:
                response = requests.post(
                    url,
                    headers=self._get_headers(),
                    json=payload,
                    timeout=(30, 60),  # connect, read
                )
                break
            except (requests_exceptions.ConnectTimeout, requests_exceptions.ConnectionError) as e:
                if attempt < max_retries:
                    logger.warning(
                        f"[WaveSpeed] Speech connection attempt {attempt + 1}/{max_retries + 1} failed, "
                        f"retrying in {retry_delay}s: {e}"
                    )
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                logger.error(f"[WaveSpeed] Speech connection failed after {max_retries + 1} attempts: {e}")
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "Connection to WaveSpeed speech API timed out",
                        "message": "Unable to reach the speech service. Please try again.",
                        "exception": str(e),
                        "retry_recommended": True,
                    },
                )
            except requests_exceptions.Timeout as e:
                logger.error(f"[WaveSpeed] Speech request timeout: {e}")
                raise HTTPException(
                    status_code=504,
                    detail={
                        "error": "WaveSpeed speech request timed out",
                        "message": "The speech generation request took too long. Please try again.",
                        "exception": str(e),
                    },
                )
        
        if response.status_code != 200:
            logger.error(f"[WaveSpeed] Speech generation failed: {response.status_code} {response.text}")
            
            # Check for custom voice ID specific errors
            response_text = response.text.lower()
            if "custom_voice" in response_text or "voice_id" in response_text:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "Invalid voice clone ID",
                        "message": "The custom voice ID is invalid or expired. Please create a new voice clone or use a predefined voice.",
                        "status_code": response.status_code,
                        "response": response.text,
                    },
                )
            
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed speech generation failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )
        
        response_json = response.json()
        data = response_json.get("data") or response_json
        
        # Handle sync mode - result should be directly in outputs
        if enable_sync_mode:
            outputs = data.get("outputs") or []
            if not outputs:
                logger.error(f"[WaveSpeed] No outputs in sync mode response: {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail="WaveSpeed speech generator returned no outputs",
                )
            
            audio_url = self._extract_audio_url(outputs)
            return self._download_audio(audio_url, timeout)
        
        # Async mode - return prediction ID for polling
        prediction_id = data.get("id")
        if not prediction_id:
            logger.error(f"[WaveSpeed] No prediction ID in async response: {response.text}")
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed response missing prediction id for async mode",
            )
        
        # Poll for result
        result = self.polling.poll_until_complete(prediction_id, timeout_seconds=120, interval_seconds=0.5)
        outputs = result.get("outputs") or []
        
        if not outputs:
            raise HTTPException(status_code=502, detail="WaveSpeed speech generator returned no outputs")
        
        audio_url = self._extract_audio_url(outputs)
        return self._download_audio(audio_url, timeout)

    def voice_design(
        self,
        text: str,
        voice_description: str,
        language: str = "auto",
        timeout: int = 180,
    ) -> bytes:
        """
        Generate speech using Qwen3 Voice Design (text + voice description).
        """
        url = f"{self.base_url}/wavespeed-ai/qwen3-tts/voice-design"
        
        payload = {
            "text": text,
            "voice_description": voice_description,
            "language": language
        }

        logger.info(f"[WaveSpeed] Voice design via {url}")

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=(30, 90),
            )
        except requests_exceptions.Timeout as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed Voice Design timed out", "message": str(e)})
        except (requests_exceptions.ConnectionError, requests_exceptions.ConnectTimeout) as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed Voice Design connection failed", "message": str(e)})

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail={"error": "WaveSpeed Voice Design failed", "message": response.text}
            )

        try:
            data = response.json()
            # The API is async and returns a task ID or direct output depending on implementation.
            # Based on user input, it returns a "data" object with "id" and we poll.
            # BUT wait, the Python example provided by user shows:
            # response = requests.post(url, ...)
            # if response.status_code == 200: result = response.json()["data"] ...
            # Then it polls /api/v3/predictions/{request_id}/result
            
            # Let's handle the async polling logic here or in the caller.
            # The user's Python example is very clear. It's an async task.
            
            if "data" in data and "id" in data["data"]:
                request_id = data["data"]["id"]
                return self._poll_prediction_result(request_id, timeout=timeout)
            
            # Fallback if it returns direct output (unlikely based on docs)
            if "data" in data and "outputs" in data["data"] and data["data"]["outputs"]:
                return self._download_audio(data["data"]["outputs"][0]["url"], timeout) # Assuming structure
            
            raise ValueError(f"Unexpected response format: {data}")

        except Exception as e:
            logger.error(f"[WaveSpeed] Error parsing Voice Design response: {e}")
            raise HTTPException(status_code=500, detail={"error": "Failed to parse Voice Design response", "message": str(e)})

    def _poll_prediction_result(self, request_id: str, timeout: int = 180) -> bytes:
        import time
        url = f"https://api.wavespeed.ai/api/v3/predictions/{request_id}/result"
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(url, headers=self._get_headers(), timeout=10)
                if response.status_code == 200:
                    result = response.json().get("data", {})
                    status = result.get("status")
                    
                    if status == "completed":
                        if result.get("outputs") and len(result["outputs"]) > 0:
                            audio_url = result["outputs"][0] # It's a URL string in the array
                            return self._download_audio(audio_url, timeout)
                        else:
                            raise ValueError("Completed task has no output URLs")
                    elif status == "failed":
                        raise ValueError(f"Task failed: {result.get('error')}")
                    
                    # If processing/created, continue polling
                    time.sleep(1)
                else:
                    logger.warning(f"Polling error {response.status_code}: {response.text}")
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Polling exception: {e}")
                time.sleep(1)
                
        raise HTTPException(status_code=504, detail="Voice Design generation timed out")

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
        url = f"{self.base_url}/minimax/voice-clone"

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        mime = audio_mime_type or "audio/wav"
        audio_data_url = f"data:{mime};base64,{audio_b64}"

        payload = {
            "audio": audio_data_url,
            "custom_voice_id": custom_voice_id,
            "model": model,
            "need_noise_reduction": need_noise_reduction,
            "need_volume_normalization": need_volume_normalization,
            "accuracy": accuracy,
        }
        if text:
            payload["text"] = text
        if language_boost:
            payload["language_boost"] = language_boost

        logger.info(f"[WaveSpeed] Voice clone via {url} (voice_id={custom_voice_id})")

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=(30, 90),
            )
        except requests_exceptions.Timeout as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed voice clone timed out", "message": str(e)})
        except (requests_exceptions.ConnectionError, requests_exceptions.ConnectTimeout) as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed voice clone connection failed", "message": str(e)})

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed voice clone failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )

        response_json = response.json()
        data = response_json.get("data") or response_json

        outputs = data.get("outputs") or []
        status = data.get("status")
        prediction_id = data.get("id")

        if not outputs and prediction_id and status in {"created", "processing"}:
            result = self.polling.poll_until_complete(prediction_id, timeout_seconds=timeout, interval_seconds=0.8)
            outputs = result.get("outputs") or []

        if not outputs:
            raise HTTPException(status_code=502, detail="WaveSpeed voice clone returned no outputs")

        audio_url = self._extract_audio_url(outputs)
        return self._download_audio(audio_url, timeout)

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
        url = f"{self.base_url}/wavespeed-ai/qwen3-tts/voice-clone"

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        mime = audio_mime_type or "audio/wav"
        audio_data_url = f"data:{mime};base64,{audio_b64}"

        payload = {
            "audio": audio_data_url,
            "text": text,
            "language": language or "auto",
        }
        if reference_text:
            payload["reference_text"] = reference_text

        logger.info(f"[WaveSpeed] Qwen3 voice clone via {url} (language={payload.get('language')})")

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=(30, 180),
            )
        except requests_exceptions.Timeout as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed Qwen3 voice clone timed out", "message": str(e)})
        except (requests_exceptions.ConnectionError, requests_exceptions.ConnectTimeout) as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed Qwen3 voice clone connection failed", "message": str(e)})

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed Qwen3 voice clone failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )

        response_json = response.json()
        data = response_json.get("data") or response_json

        outputs = data.get("outputs") or []
        status = data.get("status")
        prediction_id = data.get("id")

        if not outputs and prediction_id and status in {"created", "processing"}:
            result = self.polling.poll_until_complete(prediction_id, timeout_seconds=timeout, interval_seconds=0.8)
            outputs = result.get("outputs") or []

        if not outputs:
            raise HTTPException(status_code=502, detail="WaveSpeed Qwen3 voice clone returned no outputs")

        audio_url = self._extract_audio_url(outputs)
        downloaded_audio = self._download_audio(audio_url, timeout)
        logger.warning(f"[WaveSpeed] qwen3_voice_clone downloaded {len(downloaded_audio)} bytes")
        return downloaded_audio
    
    def cosyvoice_voice_clone(
        self,
        audio_bytes: bytes,
        text: str,
        *,
        model: str = "wavespeed-ai/cosyvoice-tts/voice-clone",
        audio_mime_type: str = "audio/wav",
        reference_text: Optional[str] = None,
        timeout: int = 180,
    ) -> bytes:
        url = f"{self.base_url}/{model}"

        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        mime = audio_mime_type or "audio/wav"
        audio_data_url = f"data:{mime};base64,{audio_b64}"

        payload = {
            "audio": audio_data_url,
            "text": text,
        }
        if reference_text:
            payload["reference_text"] = reference_text

        logger.info(f"[WaveSpeed] CosyVoice voice clone via {url}")

        try:
            response = requests.post(
                url,
                headers=self._get_headers(),
                json=payload,
                timeout=(30, 180),
            )
        except requests_exceptions.Timeout as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed CosyVoice voice clone timed out", "message": str(e)})
        except (requests_exceptions.ConnectionError, requests_exceptions.ConnectTimeout) as e:
            raise HTTPException(status_code=504, detail={"error": "WaveSpeed CosyVoice voice clone connection failed", "message": str(e)})

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "WaveSpeed CosyVoice voice clone failed",
                    "status_code": response.status_code,
                    "response": response.text,
                },
            )

        response_json = response.json()
        data = response_json.get("data") or response_json

        outputs = data.get("outputs") or []
        status = data.get("status")
        prediction_id = data.get("id")

        if not outputs and prediction_id and status in {"created", "processing"}:
            result = self.polling.poll_until_complete(prediction_id, timeout_seconds=timeout, interval_seconds=0.8)
            outputs = result.get("outputs") or []

        if not outputs:
            raise HTTPException(status_code=502, detail="WaveSpeed CosyVoice voice clone returned no outputs")

        audio_url = self._extract_audio_url(outputs)
        return self._download_audio(audio_url, timeout)

    def _extract_audio_url(self, outputs: list) -> str:
        """Extract audio URL from outputs."""
        if not isinstance(outputs, list) or len(outputs) == 0:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed speech generator output format not recognized",
            )
        
        first_output = outputs[0]
        if isinstance(first_output, str):
            audio_url = first_output
        elif isinstance(first_output, dict):
            audio_url = first_output.get("url") or first_output.get("output")
        else:
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed speech generator output format not recognized",
            )
        
        if not audio_url or not (audio_url.startswith("http://") or audio_url.startswith("https://")):
            raise HTTPException(
                status_code=502,
                detail="WaveSpeed speech generator output format not recognized",
            )
        
        return audio_url
    
    def _download_audio(self, audio_url: str, timeout: int) -> bytes:
        """Download audio from URL."""
        logger.info(f"[WaveSpeed] Fetching audio from URL: {audio_url}")
        audio_response = requests.get(audio_url, timeout=timeout)
        if audio_response.status_code == 200:
            audio_bytes = audio_response.content
            logger.info(f"[WaveSpeed] Speech generated successfully (size: {len(audio_bytes)} bytes)")
            return audio_bytes
        else:
            logger.error(f"[WaveSpeed] Failed to fetch audio from URL: {audio_response.status_code}")
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch generated audio from WaveSpeed URL",
            )
