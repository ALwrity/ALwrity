"""
Audio Dubbing Service for ALwrity.

Provides audio dubbing functionality:
- STT: Speech-to-text using Whisper/Gemini
- Translate: Text translation using DeepL
- TTS: Text-to-speech using WaveSpeed

This is a COMMON module that can be used across the application:
- Podcast Maker: Dub podcast audio to different languages
- Video Studio: Add translated voiceovers
- Content Creation: Multilingual audio content

Usage:
    from services.dubbing import AudioDubbingService
    
    service = AudioDubbingService()
    result = await service.dub_audio(
        source_audio_path="/path/to/audio.mp3",
        target_language="Spanish",
        voice_id="Wise_Woman"
    )
"""

import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, Any, List, Callable

from loguru import logger
from utils.logger_utils import get_service_logger

from services.translation import translate_text, TranslationQuality
from services.llm_providers.main_audio_generation import generate_audio, AudioGenerationResult

logger = get_service_logger("dubbing.audio")

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}


@dataclass
class DubbingResult:
    dubbed_audio_path: str
    dubbed_audio_url: str
    original_transcript: str
    translated_transcript: str
    source_language: str
    target_language: str
    voice_id: str
    duration_seconds: int
    file_size: int
    cost: float
    quality: str
    voice_clone_used: bool = False
    cloned_voice_id: Optional[str] = None


@dataclass
class VoiceCloneInfo:
    voice_id: str
    voice_url: str
    source_language: str
    accuracy: float
    file_size: int


class AudioDubbingService:
    
    def __init__(
        self,
        output_dir: Optional[Path] = None,
        default_voice_id: str = "Wise_Woman",
    ):
        self.output_dir = output_dir or self._get_default_output_dir()
        self.default_voice_id = default_voice_id
        self._ensure_output_dir()
        
        logger.info(f"[AudioDubbingService] Initialized with output dir: {self.output_dir}")
    
    def _get_default_output_dir(self) -> Path:
        from pathlib import Path
        return Path(__file__).resolve().parents[3] / "data" / "media" / "dubbed_audio"
    
    def _ensure_output_dir(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def _download_audio(self, source: str) -> tuple[bytes, str]:
        if source.startswith(("http://", "https://")):
            import httpx
            with httpx.Client(timeout=60.0) as client:
                response = client.get(source)
                response.raise_for_status()
                content_type = response.headers.get("content-type", "audio/mpeg")
                return response.content, content_type
        else:
            path = Path(source)
            if not path.exists():
                raise FileNotFoundError(f"Audio file not found: {source}")
            return path.read_bytes(), self._get_mime_type(path)
    
    def _get_mime_type(self, path: Path) -> str:
        ext = path.suffix.lower()
        mime_types = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
            ".ogg": "audio/ogg",
            ".flac": "audio/flac",
        }
        return mime_types.get(ext, "audio/mpeg")
    
    def _transcribe_audio(self, audio_path: str, audio_bytes: Optional[bytes] = None) -> str:
        from services.llm_providers.audio_to_text_generation.gemini_audio_text import transcribe_audio
        
        temp_path = None
        try:
            if audio_bytes:
                import tempfile
                suffix = ".mp3"
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                    f.write(audio_bytes)
                    temp_path = f.name
                    audio_path = temp_path
            
            transcript = transcribe_audio(audio_path)
            
            if not transcript:
                raise RuntimeError("Failed to transcribe audio")
            
            logger.info(f"[AudioDubbing] Transcribed {len(transcript)} characters")
            return transcript
            
        finally:
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def _save_audio(self, audio_bytes: bytes, suffix: str = ".mp3") -> tuple[Path, str, int]:
        unique_id = str(uuid.uuid4())[:8]
        filename = f"dubbed_{unique_id}{suffix}"
        filepath = self.output_dir / filename
        
        filepath.write_bytes(audio_bytes)
        
        audio_url = f"/api/podcast/dub/audio/{filename}"
        file_size = len(audio_bytes)
        
        logger.info(f"[AudioDubbing] Saved dubbed audio: {filepath} ({file_size} bytes)")
        
        return filepath, audio_url, file_size
    
    def _detect_source_language(self, transcript: str) -> str:
        try:
            from services.llm_providers.audio_to_text_generation.gemini_audio_text import transcribe_audio
            return "en"
        except Exception:
            return "auto"
    
    def clone_voice_from_audio(
        self,
        source_audio: str,
        custom_voice_id: Optional[str] = None,
        accuracy: float = 0.7,
        language_boost: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> VoiceCloneInfo:
        """
        Clone voice from source audio file.
        
        Args:
            source_audio: Path or URL to source audio
            custom_voice_id: Custom name for the cloned voice
            accuracy: Cloning accuracy (0.1-1.0, default: 0.7)
            language_boost: Language to boost (e.g., "Spanish")
            user_id: User ID for tracking
            
        Returns:
            VoiceCloneInfo with cloned voice details
        """
        audio_bytes, content_type = self._download_audio(source_audio)
        
        if not custom_voice_id:
            unique_suffix = str(uuid.uuid4())[:8]
            custom_voice_id = f"cloned_voice_{unique_suffix}"
        
        from services.llm_providers.main_audio_generation import clone_voice
        
        result = clone_voice(
            audio_bytes=audio_bytes,
            custom_voice_id=custom_voice_id,
            accuracy=accuracy,
            language_boost=language_boost,
            user_id=user_id,
        )
        
        self._ensure_output_dir()
        voice_filename = f"voice_{custom_voice_id}.mp3"
        voice_path = self.output_dir / voice_filename
        voice_path.write_bytes(result.preview_audio_bytes)
        
        voice_url = f"/api/podcast/dub/voices/{voice_filename}"
        
        logger.info(f"[AudioDubbing] Voice cloned: {custom_voice_id}")
        
        return VoiceCloneInfo(
            voice_id=custom_voice_id,
            voice_url=voice_url,
            source_language=language_boost or "auto",
            accuracy=accuracy,
            file_size=result.file_size,
        )
    
    def dub_audio_with_voice_clone(
        self,
        source_audio: str,
        target_language: str,
        source_language: Optional[str] = None,
        custom_voice_id: Optional[str] = None,
        accuracy: float = 0.7,
        speed: float = 1.0,
        emotion: str = "happy",
        quality: str = "high",
        user_id: Optional[str] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> DubbingResult:
        """
        Dub audio to target language while preserving original voice.
        
        Pipeline: Source Audio → Voice Clone → STT → Translate → TTS (cloned voice) → Dubbed Audio
        
        Args:
            source_audio: Path or URL to source audio file
            target_language: Target language for dubbing
            source_language: Source language (auto-detected if None)
            custom_voice_id: Custom name for the cloned voice
            accuracy: Voice cloning accuracy (0.1-1.0)
            speed: Speech speed (0.5-2.0)
            emotion: Emotion for TTS voice
            quality: Translation quality ("high" recommended for voice clone)
            user_id: User ID for tracking
            progress_callback: Optional callback for progress updates
            
        Returns:
            DubbingResult with dubbed audio details
        """
        try:
            if progress_callback:
                progress_callback(0.05, "Cloning source voice...")
            
            voice_info = self.clone_voice_from_audio(
                source_audio=source_audio,
                custom_voice_id=custom_voice_id,
                accuracy=accuracy,
                language_boost=target_language,
                user_id=user_id,
            )
            
            if progress_callback:
                progress_callback(0.15, "Voice cloned. Downloading audio...")
            
            audio_bytes, content_type = self._download_audio(source_audio)
            
            if progress_callback:
                progress_callback(0.20, "Transcribing audio...")
            
            transcript = self._transcribe_audio(source_audio, audio_bytes)
            if not source_language:
                source_language = self._detect_source_language(transcript)
            
            logger.info(f"[AudioDubbing] Transcript: {transcript[:100]}...")
            
            if progress_callback:
                progress_callback(0.40, "Translating text...")
            
            translation_result = translate_text(
                text=transcript,
                target_language=target_language,
                source_language=source_language,
                quality=TranslationQuality.HIGH,
            )
            translated_text = translation_result.translated_text
            
            logger.info(f"[AudioDubbing] Translated to {target_language}: {translated_text[:100]}...")
            
            if progress_callback:
                progress_callback(0.65, "Generating dubbed audio with cloned voice...")
            
            audio_result = generate_audio(
                text=translated_text,
                voice_id=voice_info.voice_id,
                speed=speed,
                emotion=emotion,
                user_id=user_id,
                language_boost=target_language,
            )
            
            if progress_callback:
                progress_callback(0.90, "Saving dubbed audio...")
            
            suffix = ".mp3"
            filepath, audio_url, file_size = self._save_audio(
                audio_result.audio_bytes, 
                suffix
            )
            
            if progress_callback:
                progress_callback(1.0, "Dubbing with voice clone complete!")
            
            voice_clone_cost = 0.05
            total_cost = voice_clone_cost + translation_result.metadata.get("estimated_cost", 0.0)
            
            logger.info(f"[AudioDubbing] Voice clone dubbing complete! Output: {filepath}")
            
            return DubbingResult(
                dubbed_audio_path=str(filepath),
                dubbed_audio_url=audio_url,
                original_transcript=transcript,
                translated_transcript=translated_text,
                source_language=source_language or "auto",
                target_language=target_language,
                voice_id=voice_info.voice_id,
                duration_seconds=0,
                file_size=file_size,
                cost=total_cost,
                quality=quality,
                voice_clone_used=True,
                cloned_voice_id=voice_info.voice_id,
            )
            
        except Exception as e:
            logger.error(f"[AudioDubbing] Voice clone dubbing error: {str(e)}")
            raise
    
    def dub_audio(
        self,
        source_audio: str,
        target_language: str,
        source_language: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
        emotion: str = "happy",
        quality: str = "low",
        use_voice_clone: bool = False,
        custom_voice_id: Optional[str] = None,
        accuracy: float = 0.7,
        user_id: Optional[str] = None,
        progress_callback: Optional[Callable[[float, str], None]] = None,
    ) -> DubbingResult:
        """
        Dub audio to target language.
        
        Pipeline: Source Audio → STT → Translate → TTS → Dubbed Audio
        
        If use_voice_clone=True:
        Pipeline: Source Audio → Voice Clone → STT → Translate → TTS (cloned voice) → Dubbed Audio
        
        Args:
            source_audio: Path or URL to source audio file
            target_language: Target language for dubbing
            source_language: Source language (auto-detected if None)
            voice_id: Voice ID for TTS (default: "Wise_Woman")
            speed: Speech speed (0.5-2.0)
            emotion: Emotion for TTS voice
            quality: Translation quality ("low" for DeepL, "high" for WaveSpeed)
            use_voice_clone: Use voice cloning to preserve original voice (recommended for high quality)
            custom_voice_id: Custom name for the cloned voice
            accuracy: Voice cloning accuracy (0.1-1.0) when use_voice_clone=True
            user_id: User ID for tracking
            progress_callback: Optional callback for progress updates
            
        Returns:
            DubbingResult with dubbed audio details
        """
        if use_voice_clone:
            return self.dub_audio_with_voice_clone(
                source_audio=source_audio,
                target_language=target_language,
                source_language=source_language,
                custom_voice_id=custom_voice_id,
                accuracy=accuracy,
                speed=speed,
                emotion=emotion,
                quality=quality,
                user_id=user_id,
                progress_callback=progress_callback,
            )
        
        voice_id = voice_id or self.default_voice_id
        translation_quality = TranslationQuality.HIGH if quality == "high" else TranslationQuality.LOW
        
        try:
            if progress_callback:
                progress_callback(0.1, "Downloading source audio...")
            
            audio_bytes, content_type = self._download_audio(source_audio)
            logger.info(f"[AudioDubbing] Downloaded audio: {len(audio_bytes)} bytes")
            
            if progress_callback:
                progress_callback(0.2, "Transcribing audio...")
            
            transcript = self._transcribe_audio(source_audio, audio_bytes)
            if not source_language:
                source_language = self._detect_source_language(transcript)
            
            logger.info(f"[AudioDubbing] Transcript: {transcript[:100]}...")
            
            if progress_callback:
                progress_callback(0.4, "Translating text...")
            
            translation_result = translate_text(
                text=transcript,
                target_language=target_language,
                source_language=source_language,
                quality=translation_quality,
            )
            translated_text = translation_result.translated_text
            
            logger.info(f"[AudioDubbing] Translated to {target_language}: {translated_text[:100]}...")
            
            if progress_callback:
                progress_callback(0.6, "Generating dubbed audio...")
            
            audio_result = generate_audio(
                text=translated_text,
                voice_id=voice_id,
                speed=speed,
                emotion=emotion,
                user_id=user_id,
            )
            
            if progress_callback:
                progress_callback(0.9, "Saving dubbed audio...")
            
            suffix = ".mp3"
            filepath, audio_url, file_size = self._save_audio(
                audio_result.audio_bytes, 
                suffix
            )
            
            if progress_callback:
                progress_callback(1.0, "Dubbing complete!")
            
            cost = translation_result.metadata.get("estimated_cost", 0.0)
            
            logger.info(f"[AudioDubbing] Complete! Output: {filepath}")
            
            return DubbingResult(
                dubbed_audio_path=str(filepath),
                dubbed_audio_url=audio_url,
                original_transcript=transcript,
                translated_transcript=translated_text,
                source_language=source_language or "auto",
                target_language=target_language,
                voice_id=voice_id,
                duration_seconds=0,
                file_size=file_size,
                cost=cost,
                quality=quality,
                voice_clone_used=False,
            )
            
        except Exception as e:
            logger.error(f"[AudioDubbing] Error: {str(e)}")
            raise
    
    def dub_audio_batch(
        self,
        source_audios: List[str],
        target_language: str,
        source_language: Optional[str] = None,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
        quality: str = "low",
        user_id: Optional[str] = None,
    ) -> List[DubbingResult]:
        """
        Dub multiple audio files to target language.
        
        Args:
            source_audios: List of audio paths/URLs
            target_language: Target language
            source_language: Source language (auto-detected if None)
            voice_id: Voice ID for TTS
            speed: Speech speed
            quality: Translation quality
            user_id: User ID
            
        Returns:
            List of DubbingResult
        """
        results = []
        
        for i, audio in enumerate(source_audios):
            logger.info(f"[AudioDubbing] Processing {i+1}/{len(source_audios)}: {audio}")
            
            result = self.dub_audio(
                source_audio=audio,
                target_language=target_language,
                source_language=source_language,
                voice_id=voice_id,
                speed=speed,
                quality=quality,
                user_id=user_id,
            )
            results.append(result)
        
        return results
    
    def estimate_cost(
        self,
        audio_duration_seconds: float,
        target_language: str,
        quality: str = "low",
        use_voice_clone: bool = False,
    ) -> Dict[str, Any]:
        """
        Estimate the cost for dubbing.
        
        Args:
            audio_duration_seconds: Duration of source audio
            target_language: Target language
            quality: Translation quality
            use_voice_clone: Whether voice cloning is used
            
        Returns:
            Dictionary with cost breakdown
        """
        estimated_chars = int(audio_duration_seconds * 15)
        
        if quality == "low":
            translation_cost = estimated_chars * 0.00001
        else:
            translation_cost = estimated_chars * 0.0001
        
        from services.subscription import get_audio_tts_cost, get_voice_clone_cost
        
        tts_cost = get_audio_tts_cost("minimax/speech-02-hd", text_length=estimated_chars, default_per_char=0.00005)
        voice_clone_cost = get_voice_clone_cost("wavespeed-ai/qwen3-tts/voice-clone", char_count=estimated_chars, default_per_request=0.005) if use_voice_clone else 0.0
        
        return {
            "estimated_characters": estimated_chars,
            "translation_cost": translation_cost,
            "tts_cost": tts_cost,
            "voice_clone_cost": voice_clone_cost,
            "total_cost": translation_cost + tts_cost + voice_clone_cost,
            "currency": "USD",
            "breakdown": {
                "low_quality": {
                    "translation": f"${translation_cost:.4f} ({estimated_chars} chars @ $0.00001/char)",
                    "tts": f"${tts_cost:.4f} ({estimated_chars} chars @ $0.001/char)",
                    "voice_clone": f"${voice_clone_cost:.2f}" if voice_clone_cost else "N/A",
                },
                "high_quality": {
                    "translation": f"${estimated_chars * 0.0001:.4f}",
                    "tts": f"${tts_cost:.4f}",
                    "voice_clone": f"${voice_clone_cost:.2f}" if voice_clone_cost else "N/A",
                }
            }
        }
