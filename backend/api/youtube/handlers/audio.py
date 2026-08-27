"""YouTube Creator scene audio generation handlers."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from services.database import get_db
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from api.story_writer.utils.auth import require_authenticated_user
from utils.asset_tracker import save_asset_to_library
from models.story_models import StoryAudioResult
from services.story_writer.audio_generation_service import StoryAudioGenerationService
from services.youtube.youtube_scene_audio_prompts import (
    build_youtube_scene_audio_generation_metadata,
    preprocess_youtube_narration_text,
    youtube_scene_speech_clock,
)
from utils.logger_utils import get_service_logger

router = APIRouter(tags=["youtube-audio"])
logger = get_service_logger("api.youtube.audio")

# Audio output directory
from ..paths import YOUTUBE_AUDIO_DIR, ensure_youtube_media_dirs

# Initialize audio service
audio_service = StoryAudioGenerationService(output_dir=str(YOUTUBE_AUDIO_DIR))

# WaveSpeed Minimax Speech voice ids include language-specific voices
# Ref: https://wavespeed.ai/docs/docs-api/minimax/minimax_speech_voice_id
LANGUAGE_CODE_TO_LANGUAGE_BOOST = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
    "hi": "Hindi",
    "ar": "Arabic",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "tr": "Turkish",
    "nl": "Dutch",
    "pl": "Polish",
    "th": "Thai",
    "uk": "Ukrainian",
    "el": "Greek",
    "cs": "Czech",
    "fi": "Finnish",
    "ro": "Romanian",
}

# Default language-specific Minimax voices (first-choice). We keep English on the existing "persona" voices.
LANGUAGE_BOOST_TO_DEFAULT_VOICE_ID = {
    "Spanish": "Spanish_male_1_v1",
    "French": "French_male_1_v1",
    "German": "German_male_1_v1",
    "Portuguese": "Portuguese_male_1_v1",
    "Italian": "Italian_male_1_v1",
    "Hindi": "Hindi_male_1_v1",
    "Arabic": "Arabic_male_1_v1",
    "Russian": "Russian_male_1_v1",
    "Japanese": "Japanese_male_1_v1",
    "Korean": "Korean_male_1_v1",
    "Chinese": "Chinese_male_1_v1",
    "Vietnamese": "Vietnamese_male_1_v1",
    "Indonesian": "Indonesian_male_1_v1",
    "Turkish": "Turkish_male_1_v1",
    "Dutch": "Dutch_male_1_v1",
    "Polish": "Polish_male_1_v1",
    "Thai": "Thai_male_1_v1",
    "Ukrainian": "Ukrainian_male_1_v1",
    "Greek": "Greek_male_1_v1",
    "Czech": "Czech_male_1_v1",
    "Finnish": "Finnish_male_1_v1",
    "Romanian": "Romanian_male_1_v1",
}


def _resolve_language_boost(language: Optional[str], explicit_language_boost: Optional[str]) -> str:
    """
    Determine the effective WaveSpeed `language_boost`.
    - If user explicitly provided language_boost, use it (including "auto").
    - Else if language code provided, map to the WaveSpeed boost label.
    - Else default to English (backwards compatible).
    """
    if explicit_language_boost is not None and str(explicit_language_boost).strip() != "":
        return str(explicit_language_boost).strip()

    if language is not None and str(language).strip() != "":
        lang_code = str(language).strip().lower()
        return LANGUAGE_CODE_TO_LANGUAGE_BOOST.get(lang_code, "auto")

    return "English"

def select_optimal_emotion(scene_title: str, narration: str, video_plan_context: Optional[Dict[str, Any]] = None) -> str:
    """
    Intelligently select the best emotion for YouTube content based on scene analysis.

    Available emotions: "happy", "sad", "angry", "fearful", "disgusted", "surprised", "neutral"

    Returns the selected emotion string.
    """
    # Default to happy for engaging YouTube content
    selected_emotion = "happy"

    scene_text = f"{scene_title} {narration}".lower()

    # Hook scenes need excitement and energy
    if "hook" in scene_title.lower() or any(word in scene_text for word in ["exciting", "amazing", "unbelievable", "shocking", "wow"]):
        selected_emotion = "surprised"  # Excited and attention-grabbing

    # Emotional stories or inspirational content
    elif any(word in scene_text for word in ["emotional", "touching", "heartwarming", "inspiring", "motivational"]):
        selected_emotion = "happy"  # Warm and uplifting

    # Serious or professional content
    elif any(word in scene_text for word in ["important", "critical", "serious", "professional", "expert"]):
        selected_emotion = "neutral"  # Professional and serious

    # Problem-solving or tutorial content
    elif any(word in scene_text for word in ["problem", "solution", "fix", "help", "guide"]):
        selected_emotion = "happy"  # Helpful and encouraging

    # Call-to-action scenes
    elif "cta" in scene_title.lower() or any(word in scene_text for word in ["subscribe", "like", "comment", "share", "action"]):
        selected_emotion = "happy"  # Confident and encouraging

    # Negative or concerning topics
    elif any(word in scene_text for word in ["warning", "danger", "risk", "problem", "issue"]):
        selected_emotion = "neutral"  # Serious but not alarming

    # Check video plan context for overall tone
    if video_plan_context:
        tone = video_plan_context.get("tone", "").lower()
        if "serious" in tone or "professional" in tone:
            selected_emotion = "neutral"
        elif "fun" in tone or "entertaining" in tone:
            selected_emotion = "happy"

    return selected_emotion


def select_optimal_voice(scene_title: str, narration: str, video_plan_context: Optional[Dict[str, Any]] = None) -> str:
    """
    Intelligently select the best voice for YouTube content based on scene analysis.

    Analyzes scene title, narration content, and video plan context to choose
    the most appropriate voice from available Minimax voices.

    Available voices: Wise_Woman, Friendly_Person, Inspirational_girl, Deep_Voice_Man,
    Calm_Woman, Casual_Guy, Lively_Girl, Patient_Man, Young_Knight, Determined_Man,
    Lovely_Girl, Decent_Boy, Imposing_Manner, Elegant_Man, Abbess, Sweet_Girl_2, Exuberant_Girl

    Returns the selected voice_id string.
    """
    # Default to Casual_Guy for engaging YouTube content
    selected_voice = "Casual_Guy"

    # Analyze video plan context for content type
    if video_plan_context:
        video_type = video_plan_context.get("video_type", "").lower()
        target_audience = video_plan_context.get("target_audience", "").lower()
        tone = video_plan_context.get("tone", "").lower()

        # Educational/Professional content
        if any(keyword in video_type for keyword in ["tutorial", "educational", "how-to", "guide", "course"]):
            if "professional" in tone or "expert" in target_audience:
                selected_voice = "Wise_Woman"  # Authoritative and trustworthy
            else:
                selected_voice = "Patient_Man"  # Clear and instructional

        # Entertainment/Casual content
        elif any(keyword in video_type for keyword in ["entertainment", "vlog", "lifestyle", "story", "review"]):
            if "young" in target_audience or "millennial" in target_audience:
                selected_voice = "Casual_Guy"  # Friendly and relatable
            elif "female" in target_audience or "women" in target_audience:
                selected_voice = "Lively_Girl"  # Energetic and engaging
            else:
                selected_voice = "Friendly_Person"  # Approachable

        # Motivational/Inspirational content
        elif any(keyword in video_type for keyword in ["motivational", "inspirational", "success", "mindset"]):
            selected_voice = "Inspirational_girl"  # Uplifting and motivational

        # Business/Corporate content
        elif any(keyword in video_type for keyword in ["business", "corporate", "finance", "marketing"]):
            selected_voice = "Elegant_Man"  # Professional and sophisticated

        # Tech/Gaming content
        elif any(keyword in video_type for keyword in ["tech", "gaming", "software", "app"]):
            selected_voice = "Young_Knight"  # Energetic and modern

    # Analyze scene content for specific voice requirements
    scene_text = f"{scene_title} {narration}".lower()

    # Hook scenes need energetic, attention-grabbing voices
    if "hook" in scene_title.lower() or any(word in scene_text for word in ["attention", "grab", "exciting", "amazing", "unbelievable"]):
        selected_voice = "Exuberant_Girl"  # Very energetic and enthusiastic

    # Emotional/stories need more expressive voices
    elif any(word in scene_text for word in ["story", "emotional", "heartwarming", "touching", "inspiring"]):
        selected_voice = "Inspirational_girl"  # Emotional and inspiring

    # Technical explanations need clear, precise voices
    elif any(word in scene_text for word in ["technical", "explain", "step-by-step", "process", "how-to"]):
        selected_voice = "Calm_Woman"  # Clear and methodical

    # Call-to-action scenes need confident, persuasive voices
    elif "cta" in scene_title.lower() or any(word in scene_text for word in ["subscribe", "like", "comment", "share", "now", "today"]):
        selected_voice = "Determined_Man"  # Confident and persuasive

    logger.info(f"[VoiceSelection] Selected '{selected_voice}' for scene: {scene_title[:50]}...")
    return selected_voice


class YouTubeAudioRequest(BaseModel):
    scene_id: str
    scene_title: str
    text: str
    voice_id: Optional[str] = None  # Will auto-select based on content if not provided
    language: Optional[str] = None  # Language code for multilingual audio (e.g., "en", "es", "fr")
    speed: float = 1.0
    volume: float = 1.0
    pitch: float = 0.0
    emotion: str = "happy"  # More engaging for YouTube content
    english_normalization: bool = False
    # Enhanced defaults for high-quality YouTube audio using Minimax Speech 02 HD
    # Higher quality settings for professional YouTube content
    sample_rate: Optional[int] = 44100  # CD quality: 44100 Hz (valid values: 8000, 16000, 22050, 24000, 32000, 44100)
    bitrate: int = 256000  # Highest quality: 256kbps (valid values: 32000, 64000, 128000, 256000)
    channel: Optional[str] = "2"  # Stereo for richer audio (valid values: "1" or "2")
    format: Optional[str] = "mp3"  # Universal format for web
    language_boost: Optional[str] = None  # If not provided, inferred from `language` (or defaults to English)
    enable_sync_mode: bool = True
    # Context for intelligent voice/emotion selection
    video_plan_context: Optional[Dict[str, Any]] = None  # Optional video plan for context-aware voice selection
    duration_estimate: Optional[float] = None  # Maps to WAN 5s/10s clip for speech-clock validation


class YouTubeAudioResponse(BaseModel):
    scene_id: str
    scene_title: str
    audio_filename: str
    audio_url: str
    provider: str
    model: str
    voice_id: str
    text_length: int
    file_size: int
    cost: float
    generation: Optional[Dict[str, Any]] = None


@router.post("/audio", response_model=YouTubeAudioResponse)
async def generate_youtube_scene_audio(
    request: YouTubeAudioRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate AI audio for a YouTube scene using shared audio service.
    Similar to Podcast's audio generation endpoint.
    """
    user_id = require_authenticated_user(current_user)
    ensure_youtube_media_dirs(user_id)
    logger.info(
        "[YouTubeAudio] Scene audio request scene_id={} text_len={} duration_estimate={}",
        request.scene_id,
        len(request.text or ""),
        request.duration_estimate,
    )

    if not request.text or not request.text.strip():
        logger.warning("[YouTubeAudio] Empty text scene_id={}", request.scene_id)
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        processed_text = preprocess_youtube_narration_text(
            request.text,
            scene_title=request.scene_title,
        )

        if not processed_text:
            logger.warning(
                "[YouTubeAudio] Narration empty after preprocess scene_id={} input_len={}",
                request.scene_id,
                len(request.text),
            )
            raise HTTPException(status_code=400, detail="Text became empty after removing instructions. Please provide clean narration text.")

        logger.info(
            "[YouTubeAudio] Text preprocessing scene_id={} input_len={} output_len={}",
            request.scene_id,
            len(request.text),
            len(processed_text),
        )
        clip_seconds, speech_seconds = youtube_scene_speech_clock(
            processed_text,
            request.duration_estimate,
        )

        effective_language_boost = _resolve_language_boost(request.language, request.language_boost)

        # Intelligent voice and emotion selection based on content analysis
        if not request.voice_id:
            # If non-English language is selected, default to the language-specific Minimax voice_id.
            # Otherwise keep the existing English persona voice selection logic.
            if effective_language_boost in LANGUAGE_BOOST_TO_DEFAULT_VOICE_ID and effective_language_boost not in ["English", "auto"]:
                selected_voice = LANGUAGE_BOOST_TO_DEFAULT_VOICE_ID[effective_language_boost]
                logger.info(
                    f"[VoiceSelection] Using language-specific default voice '{selected_voice}' "
                    f"(language_boost={effective_language_boost}, language={request.language})"
                )
            else:
                selected_voice = select_optimal_voice(
                    request.scene_title,
                    processed_text,
                    request.video_plan_context
                )
        else:
            selected_voice = request.voice_id

        # Auto-select emotion if not specified or if using defaults
        if request.emotion == "happy":  # This means it wasn't specifically set by user
            selected_emotion = select_optimal_emotion(
                request.scene_title,
                processed_text,
                request.video_plan_context
            )
        else:
            selected_emotion = request.emotion

        logger.info(
            "[YouTubeAudio] Voice and clip clock scene_id={} voice={} emotion={} "
            "language={} language_boost={} clip_seconds={} speech_seconds={}",
            request.scene_id,
            selected_voice,
            selected_emotion,
            request.language,
            effective_language_boost,
            clip_seconds,
            speech_seconds,
        )

        # Build kwargs for optional parameters - use defaults if None
        # WaveSpeed API requires specific values, so we provide sensible defaults
        # This matches Podcast's approach but with explicit defaults to avoid None errors
        optional_kwargs = {}

        # DEBUG: Log what values we received
        logger.info(
            f"[YouTubeAudio] Request parameters: sample_rate={request.sample_rate}, bitrate={request.bitrate}, "
            f"channel={request.channel}, format={request.format}, language_boost={request.language_boost}, "
            f"effective_language_boost={effective_language_boost}, language={request.language}"
        )

        # sample_rate: Use provided value or omit (WaveSpeed will use default)
        if request.sample_rate is not None:
            optional_kwargs["sample_rate"] = request.sample_rate

        # bitrate: Always provide a value (default: 128000 = 128kbps)
        # Valid values: 32000, 64000, 128000, 256000
        # Model already has default of 128000, so request.bitrate will never be None
        optional_kwargs["bitrate"] = request.bitrate

        # channel: Only include if valid (WaveSpeed only accepts "1" or "2" as strings)
        # If None, empty string, or invalid, omit it and WaveSpeed will use default
        # NEVER include channel if it's not exactly "1" or "2"
        if request.channel is not None and str(request.channel).strip() in ["1", "2"]:
            optional_kwargs["channel"] = str(request.channel).strip()
            logger.info(f"[YouTubeAudio] Including valid channel: {optional_kwargs['channel']}")
        else:
            logger.info(f"[YouTubeAudio] Omitting invalid channel: {request.channel}")

        # format: Use provided value or omit (WaveSpeed will use default)
        if request.format is not None:
            optional_kwargs["format"] = request.format

        # language_boost: always send resolved value (improves pronunciation and helps multilingual voices)
        if effective_language_boost is not None and str(effective_language_boost).strip() != "":
            optional_kwargs["language_boost"] = effective_language_boost

        logger.info(f"[YouTubeAudio] Final optional_kwargs: {optional_kwargs}")
        
        result: StoryAudioResult = audio_service.generate_ai_audio(
            scene_number=0,
            scene_title=request.scene_title,
            text=processed_text,
            user_id=user_id,
            voice_id=selected_voice,
            speed=request.speed or 1.0,
            volume=request.volume or 1.0,
            pitch=request.pitch or 0.0,
            emotion=selected_emotion,
            english_normalization=request.english_normalization or False,
            enable_sync_mode=request.enable_sync_mode,
            **optional_kwargs,
        )
        
        # Override URL to use YouTube endpoint instead of story endpoint
        if result.get("audio_url") and "/api/story/audio/" in result.get("audio_url", ""):
            audio_filename = result.get("audio_filename", "")
            result["audio_url"] = f"/api/youtube/audio/{audio_filename}"
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[YouTubeAudio] Audio generation failed scene_id={}",
            request.scene_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Audio generation failed: {exc}",
        ) from exc

    # Save to asset library (youtube_creator module)
    try:
        if result.get("audio_url"):
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="audio",
                source_module="youtube_creator",
                filename=result.get("audio_filename", ""),
                file_url=result.get("audio_url", ""),
                file_path=result.get("audio_path"),
                file_size=result.get("file_size"),
                mime_type="audio/mpeg",
                title=f"{request.scene_title} - YouTube",
                description="YouTube scene narration",
                tags=["youtube_creator", "audio", request.scene_id],
                provider=result.get("provider"),
                model=result.get("model"),
                cost=result.get("cost"),
                asset_metadata={
                    "scene_id": request.scene_id,
                    "scene_title": request.scene_title,
                    "status": "completed",
                },
            )
    except Exception as e:
        logger.warning(f"[YouTube] Failed to save audio asset: {e}")

    return YouTubeAudioResponse(
        scene_id=request.scene_id,
        scene_title=request.scene_title,
        audio_filename=result.get("audio_filename", ""),
        audio_url=result.get("audio_url", ""),
        provider=result.get("provider", "wavespeed"),
        model=result.get("model", "minimax/speech-02-hd"),
        voice_id=result.get("voice_id", selected_voice),
        text_length=result.get("text_length", len(request.text)),
        file_size=result.get("file_size", 0),
        cost=result.get("cost", 0.0),
        generation=build_youtube_scene_audio_generation_metadata(
            input_text=request.text,
            speech_text=processed_text,
            voice_id=result.get("voice_id", selected_voice),
            emotion=selected_emotion,
            language_boost=effective_language_boost,
            provider=result.get("provider", "wavespeed"),
            model=result.get("model", "minimax/speech-02-hd"),
            target_clip_seconds=clip_seconds,
            estimated_speech_seconds=speech_seconds,
        ),
    )


@router.get("/audio/{filename}")
async def serve_youtube_audio(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve generated YouTube scene audio files.
    
    Supports authentication via Authorization header or token query parameter.
    Query parameter is useful for HTML elements like <audio> that cannot send custom headers.
    """
    require_authenticated_user(current_user)
    
    # Security check: ensure filename doesn't contain path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    audio_path = (YOUTUBE_AUDIO_DIR / filename).resolve()
    
    # Security check: ensure path is within YOUTUBE_AUDIO_DIR
    if not str(audio_path).startswith(str(YOUTUBE_AUDIO_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(audio_path, media_type="audio/mpeg")

