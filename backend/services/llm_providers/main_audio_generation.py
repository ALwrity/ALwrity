"""
Main Audio Generation Service for ALwrity Backend.

This service provides AI-powered text-to-speech functionality using WaveSpeed Minimax Speech 02 HD.
"""

from __future__ import annotations

import sys
from typing import Optional, Dict, Any
from datetime import datetime
from loguru import logger
from fastapi import HTTPException

from services.wavespeed.client import WaveSpeedClient
from utils.logger_utils import get_service_logger
from .tenant_provider_config import tenant_provider_config_resolver

logger = get_service_logger("audio_generation")


def _get_wavespeed_client(user_id: Optional[str]) -> WaveSpeedClient:
    key, _source = tenant_provider_config_resolver.resolve_provider_key("wavespeed", user_id=user_id)
    return WaveSpeedClient(api_key=key)

class AudioGenerationResult:
    """Result of audio generation."""
    
    def __init__(
        self,
        audio_bytes: bytes,
        provider: str,
        model: str,
        voice_id: str,
        text_length: int,
        file_size: int,
    ):
        self.audio_bytes = audio_bytes
        self.provider = provider
        self.model = model
        self.voice_id = voice_id
        self.text_length = text_length
        self.file_size = file_size


class VoiceCloneResult:
    def __init__(
        self,
        preview_audio_bytes: bytes,
        provider: str,
        model: str,
        custom_voice_id: str,
        file_size: int,
    ):
        self.preview_audio_bytes = preview_audio_bytes
        self.provider = provider
        self.model = model
        self.custom_voice_id = custom_voice_id
        self.file_size = file_size


def generate_audio(
    text: str,
    voice_id: str = "Wise_Woman",
    custom_voice_id: Optional[str] = None,
    speed: float = 1.0,
    volume: float = 1.0,
    pitch: float = 0.0,
    emotion: str = "happy",
    user_id: Optional[str] = None,
    **kwargs
) -> AudioGenerationResult:
    """
    Generate audio using AI text-to-speech with subscription tracking.
    
    Args:
        text: Text to convert to speech (max 10000 characters)
        voice_id: Voice ID (default: "Wise_Woman")
        speed: Speech speed (0.5-2.0, default: 1.0)
        volume: Speech volume (0.1-10.0, default: 1.0)
        pitch: Speech pitch (-12 to 12, default: 0.0)
        emotion: Emotion (default: "happy")
        user_id: User ID for subscription checking (required)
        **kwargs: Additional parameters (sample_rate, bitrate, format, etc.)
        
    Returns:
        AudioGenerationResult: Generated audio result
        
    Raises:
        RuntimeError: If subscription limits are exceeded or user_id is missing.
    """
    try:
        # VALIDATION: Check inputs before any processing or API calls
        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            raise ValueError("Text input is required and cannot be empty")
        
        text = text.strip()  # Normalize whitespace
        
        if len(text) > 10000:
            raise ValueError(f"Text is too long ({len(text)} characters). Maximum is 10,000 characters.")
        
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")
        
        logger.info("[audio_gen] Starting audio generation")
        logger.debug(f"[audio_gen] Text length: {len(text)} characters, voice: {voice_id}")
        
        # Calculate cost via SSOT pricing lookup
        from services.subscription import get_audio_tts_cost
        character_count = len(text)
        estimated_cost = get_audio_tts_cost("minimax/speech-02-hd", text_length=character_count, default_per_char=0.00005)
        
        try:
            from services.database import get_session_for_user
            from services.subscription import PricingService
            from models.subscription_models import UsageSummary, APIProvider
            
            db = get_session_for_user(user_id)
            if not db:
                raise RuntimeError("Failed to get database session")
            try:
                pricing_service = PricingService(db)
                
                # Check limits using sync method from pricing service (strict enforcement)
                # Use AUDIO provider for audio generation
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    tokens_requested=character_count,  # Use character count as "tokens" for audio
                    actual_provider_name="wavespeed"  # Actual provider is WaveSpeed
                )
                
                if not can_proceed:
                    logger.warning(f"[audio_gen] Subscription limit exceeded for user {user_id}: {message}")
                    error_detail = {
                        'error': message,
                        'message': message,
                        'provider': 'wavespeed',
                        'usage_info': usage_info if usage_info else {}
                    }
                    raise HTTPException(status_code=429, detail=error_detail)
                
                # Get current usage for limit checking
                current_period = pricing_service.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
                usage = db.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == current_period
                ).first()
                
            finally:
                db.close()
        except HTTPException:
            raise
        except RuntimeError:
            raise
        except Exception as sub_error:
            logger.error(f"[audio_gen] Subscription check failed for user {user_id}: {sub_error}")
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")
        
        # Generate audio using WaveSpeed
        try:
            # Avoid passing duplicate enable_sync_mode; allow override via kwargs
            enable_sync_mode = kwargs.pop("enable_sync_mode", True)

            # Filter out None values from kwargs to prevent WaveSpeed validation errors
            filtered_kwargs = {k: v for k, v in kwargs.items() if v is not None}
            logger.info(f"[audio_gen] Filtered kwargs (removed None values): {filtered_kwargs}")

            # Track response time
            import time
            start_time = time.time()
            client = _get_wavespeed_client(user_id)
            audio_bytes = client.generate_speech(
                text=text,
                voice_id=voice_id,
                custom_voice_id=custom_voice_id,
                speed=speed,
                volume=volume,
                pitch=pitch,
                emotion=emotion,
                enable_sync_mode=enable_sync_mode,
                **filtered_kwargs
            )
            response_time = time.time() - start_time
            
            logger.info(f"[audio_gen] ✅ API call successful, generated {len(audio_bytes)} bytes in {response_time:.2f}s")
            
        except HTTPException:
            raise
        except Exception as api_error:
            logger.error(f"[audio_gen] Audio generation API failed: {api_error}")
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Audio generation failed",
                    "message": str(api_error)
                }
            )
        
        # TRACK USAGE after successful API call
        if audio_bytes:
            logger.info(f"[audio_gen] ✅ API call successful, tracking usage for user {user_id}")
            try:
                db_track = get_session_for_user(user_id)
                if not db_track:
                    logger.error(f"[audio_gen] ❌ Failed to get database session for tracking")
                    raise RuntimeError("Failed to get database session")
                
                try:
                    from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
                    from services.subscription import PricingService
                    
                    pricing = PricingService(db_track)
                    current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")
                    
                    # Get or create usage summary
                    summary = db_track.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()
                    
                    if not summary:
                        summary = UsageSummary(
                            user_id=user_id,
                            billing_period=current_period
                        )
                        db_track.add(summary)
                        db_track.flush()
                    
                    # Get current values before update
                    current_calls_before = getattr(summary, "audio_calls", 0) or 0
                    current_cost_before = getattr(summary, "audio_cost", 0.0) or 0.0
                    
                    # Update audio calls and cost
                    new_calls = current_calls_before + 1
                    new_cost = current_cost_before + estimated_cost
                    
                    # Use direct SQL UPDATE for dynamic attributes
                    # Import sqlalchemy.text with alias to avoid shadowing the 'text' parameter
                    from sqlalchemy import text as sql_text
                    now_utc = datetime.utcnow()
                    update_query = sql_text("""
                        UPDATE usage_summaries 
                        SET audio_calls = :new_calls,
                            audio_cost = :new_cost,
                            total_calls = COALESCE(total_calls, 0) + 1,
                            total_cost = COALESCE(total_cost, 0.0) + :cost,
                            updated_at = :now
                        WHERE user_id = :user_id AND billing_period = :period
                    """)
                    db_track.execute(update_query, {
                        'new_calls': new_calls,
                        'new_cost': new_cost,
                        'cost': estimated_cost,
                        'user_id': user_id,
                        'period': current_period,
                        'now': now_utc,
                    })
                    
                    # Create usage log
                    # Store the text parameter in a local variable before any imports to prevent shadowing
                    text_param = text  # Capture function parameter before any potential shadowing
                    
                    # Detect actual provider name (WaveSpeed, Google, OpenAI, etc.)
                    from services.subscription.provider_detection import detect_actual_provider
                    actual_provider = detect_actual_provider(
                        provider_enum=APIProvider.AUDIO,
                        model_name="minimax/speech-02-hd",
                        endpoint="/audio-generation/wavespeed"
                    )
                    
                    usage_log = APIUsageLog(
                        user_id=user_id,
                        provider=APIProvider.AUDIO,
                        endpoint="/audio-generation/wavespeed",
                        method="POST",
                        model_used="minimax/speech-02-hd",
                        actual_provider_name=actual_provider,  # Track actual provider (WaveSpeed, etc.)
                        tokens_input=character_count,
                        tokens_output=0,
                        tokens_total=character_count,
                        cost_input=0.0,
                        cost_output=0.0,
                        cost_total=estimated_cost,
                        response_time=response_time,  # Use actual response time
                        status_code=200,
                        request_size=len(text_param.encode("utf-8")),  # Use captured parameter
                        response_size=len(audio_bytes),
                        billing_period=current_period,
                    )
                    db_track.add(usage_log)
                    
                    # Get plan details for unified log
                    limits = pricing.get_user_limits(user_id)
                    plan_name = limits.get('plan_name', 'unknown') if limits else 'unknown'
                    tier = limits.get('tier', 'unknown') if limits else 'unknown'
                    audio_limit = limits['limits'].get("audio_calls", 0) if limits else 0
                    # Only show ∞ for Enterprise tier when limit is 0 (unlimited)
                    audio_limit_display = audio_limit if (audio_limit > 0 or tier != 'enterprise') else '∞'
                    
                    # Get related stats for unified log
                    current_image_calls = getattr(summary, "stability_calls", 0) or 0
                    image_limit = limits['limits'].get("stability_calls", 0) if limits else 0
                    current_image_edit_calls = getattr(summary, "image_edit_calls", 0) or 0
                    image_edit_limit = limits['limits'].get("image_edit_calls", 0) if limits else 0
                    current_video_calls = getattr(summary, "video_calls", 0) or 0
                    video_limit = limits['limits'].get("video_calls", 0) if limits else 0
                    
                    db_track.commit()
                    from services.subscription.cache import clear_dashboard_cache
                    clear_dashboard_cache(user_id)
                    logger.info(f"[audio_gen] ✅ Successfully tracked usage: user {user_id} -> audio -> {new_calls} calls, ${estimated_cost:.4f}")
                    
                    try:
                        sys.stdout.write(f"\n[SUBSCRIPTION] Audio Generation user={user_id} model=minimax/speech-02-hd cost=${estimated_cost:.4f}\n")
                        sys.stdout.flush()
                    except Exception:
                        pass
                    
                except Exception as track_error:
                    logger.error(f"[audio_gen] ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
                    db_track.rollback()
                finally:
                    db_track.close()
            except Exception as usage_error:
                logger.error(f"[audio_gen] ❌ Failed to track usage: {usage_error}", exc_info=True)
        
        return AudioGenerationResult(
            audio_bytes=audio_bytes,
            provider="wavespeed",
            model="minimax/speech-02-hd",
            voice_id=voice_id,
            text_length=character_count,
            file_size=len(audio_bytes),
        )
        
    except HTTPException:
        raise
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"[audio_gen] Error generating audio: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Audio generation failed",
                "message": str(e)
            }
        )


def clone_voice(
    audio_bytes: bytes,
    custom_voice_id: str,
    model: str = "speech-02-hd",
    *,
    audio_mime_type: Optional[str] = None,
    text: Optional[str] = None,
    need_noise_reduction: bool = False,
    need_volume_normalization: bool = False,
    accuracy: float = 0.7,
    language_boost: Optional[str] = None,
    user_id: Optional[str] = None,
) -> VoiceCloneResult:
    try:
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")

        if not audio_bytes or not isinstance(audio_bytes, (bytes, bytearray)) or len(audio_bytes) == 0:
            raise ValueError("Audio is required and cannot be empty")

        if len(audio_bytes) > 15 * 1024 * 1024:
            raise ValueError("Audio file too large. Maximum is 15MB.")

        if not custom_voice_id or not isinstance(custom_voice_id, str):
            raise ValueError("custom_voice_id is required")
        custom_voice_id = custom_voice_id.strip()
        if len(custom_voice_id) < 8:
            raise ValueError("custom_voice_id must be at least 8 characters long")
        if not custom_voice_id[0].isalpha():
            raise ValueError("custom_voice_id must start with a letter")
        if not any(c.isalpha() for c in custom_voice_id) or not any(c.isdigit() for c in custom_voice_id):
            raise ValueError("custom_voice_id must include both letters and numbers")

        from services.subscription import get_voice_clone_cost
        voice_clone_cost = get_voice_clone_cost("minimax/voice-clone", default_per_request=0.50)

        from services.database import get_session_for_user
        from services.subscription import PricingService
        from models.subscription_models import APIProvider

        try:
            db = get_session_for_user(user_id)
            if not db:
                raise RuntimeError("Failed to get database session")
            try:
                pricing_service = PricingService(db)
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    tokens_requested=1,
                    actual_provider_name="wavespeed",
                )
                if not can_proceed:
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": message,
                            "message": message,
                            "provider": "wavespeed",
                            "usage_info": usage_info if usage_info else {},
                        },
                    )
            finally:
                db.close()
        except HTTPException:
            raise
        except Exception as sub_error:
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")

        import time
        start_time = time.time()
        client = _get_wavespeed_client(user_id)
        preview_audio_bytes = client.voice_clone(
            audio_bytes=bytes(audio_bytes),
            custom_voice_id=custom_voice_id,
            model=model,
            audio_mime_type=audio_mime_type or "audio/wav",
            text=text,
            need_noise_reduction=need_noise_reduction,
            need_volume_normalization=need_volume_normalization,
            accuracy=accuracy,
            language_boost=language_boost,
        )
        response_time = time.time() - start_time

        if preview_audio_bytes:
            try:
                db_track = get_session_for_user(user_id)
                if not db_track:
                    logger.error(f"[clone_voice] ❌ Failed to get database session for tracking")
                    raise RuntimeError("Failed to get database session")
                
                try:
                    from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
                    from services.subscription import PricingService
                    from sqlalchemy import text as sql_text
                    from services.subscription.provider_detection import detect_actual_provider

                    pricing = PricingService(db_track)
                    current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")

                    summary = db_track.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()

                    if not summary:
                        summary = UsageSummary(user_id=user_id, billing_period=current_period)
                        db_track.add(summary)
                        db_track.flush()
                    current_calls_before = getattr(summary, "audio_calls", 0) or 0
                    current_cost_before = getattr(summary, "audio_cost", 0.0) or 0.0
                    new_calls = current_calls_before + 1
                    new_cost = current_cost_before + voice_clone_cost

                    now_utc = datetime.utcnow()
                    update_query = sql_text("""
                        UPDATE usage_summaries 
                        SET audio_calls = :new_calls,
                            audio_cost = :new_cost,
                            total_calls = COALESCE(total_calls, 0) + 1,
                            total_cost = COALESCE(total_cost, 0.0) + :cost,
                            updated_at = :now
                        WHERE user_id = :user_id AND billing_period = :period
                    """)
                    db_track.execute(update_query, {
                        "new_calls": new_calls,
                        "new_cost": new_cost,
                        "cost": voice_clone_cost,
                        "user_id": user_id,
                        "period": current_period,
                        "now": now_utc,
                    })

                    actual_provider = detect_actual_provider(
                        provider_enum=APIProvider.AUDIO,
                        model_name="minimax/voice-clone",
                        endpoint="/audio-generation/wavespeed/voice-clone",
                    )

                    usage_log = APIUsageLog(
                        user_id=user_id,
                        provider=APIProvider.AUDIO,
                        endpoint="/audio-generation/wavespeed/voice-clone",
                        method="POST",
                        model_used="minimax/voice-clone",
                        actual_provider_name=actual_provider,
                        tokens_input=0,
                        tokens_output=0,
                        tokens_total=0,
                        cost_input=0.0,
                        cost_output=0.0,
                        cost_total=voice_clone_cost,
                        response_time=response_time,
                        status_code=200,
                        request_size=len(audio_bytes),
                        response_size=len(preview_audio_bytes),
                        billing_period=current_period,
                    )
                    db_track.add(usage_log)
                    db_track.commit()
                    from services.subscription.cache import clear_dashboard_cache
                    clear_dashboard_cache(user_id)

                    try:
                        sys.stdout.write(f"\n[SUBSCRIPTION] Voice Clone user={user_id} model=minimax/voice-clone cost=${voice_clone_cost:.4f}\n")
                        sys.stdout.flush()
                    except Exception:
                        pass
                except Exception as track_error:
                    logger.error(f"[voice_clone] ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
                    db_track.rollback()
                finally:
                    db_track.close()
            except Exception as usage_error:
                logger.error(f"[voice_clone] ❌ Failed to track usage: {usage_error}", exc_info=True)

        return VoiceCloneResult(
            preview_audio_bytes=preview_audio_bytes,
            provider="wavespeed",
            model=f"minimax/voice-clone:{model}",
            custom_voice_id=custom_voice_id,
            file_size=len(preview_audio_bytes),
        )
    except HTTPException:
        raise
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"[voice_clone] Error cloning voice: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Voice cloning failed",
                "message": str(e),
            },
        )


def qwen3_voice_clone(
    audio_bytes: bytes,
    text: str,
    *,
    reference_text: Optional[str] = None,
    language: str = "auto",
    audio_mime_type: Optional[str] = None,
    user_id: Optional[str] = None,
) -> VoiceCloneResult:
    try:
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")

        if not audio_bytes or not isinstance(audio_bytes, (bytes, bytearray)) or len(audio_bytes) == 0:
            raise ValueError("Audio is required and cannot be empty")

        if len(audio_bytes) > 15 * 1024 * 1024:
            raise ValueError("Audio file too large. Maximum is 15MB.")

        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            raise ValueError("Text is required and cannot be empty")
        text = text.strip()
        if len(text) > 4000:
            raise ValueError("Text too long. Please keep it under 4000 characters.")

        from services.subscription import get_voice_clone_cost
        char_count = len(text)
        estimated_cost = get_voice_clone_cost("wavespeed-ai/qwen3-tts/voice-clone", char_count=char_count, default_per_request=0.005)

        from services.database import get_session_for_user
        from services.subscription import PricingService
        from models.subscription_models import APIProvider

        try:
            db = get_session_for_user(user_id)
            if not db:
                raise RuntimeError("Failed to get database session")
            try:
                pricing_service = PricingService(db)
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    tokens_requested=char_count,
                    actual_provider_name="wavespeed",
                )
                if not can_proceed:
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": message,
                            "message": message,
                            "provider": "wavespeed",
                            "usage_info": usage_info if usage_info else {},
                        },
                    )
            finally:
                db.close()
        except HTTPException:
            raise
        except Exception as sub_error:
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")

        import time
        start_time = time.time()
        client = _get_wavespeed_client(user_id)
        preview_audio_bytes = client.qwen3_voice_clone(
            audio_bytes=bytes(audio_bytes),
            text=text,
            audio_mime_type=audio_mime_type or "audio/wav",
            language=language or "auto",
            reference_text=reference_text,
        )
        response_time = time.time() - start_time

        if preview_audio_bytes:
            try:
                db_track = get_session_for_user(user_id)
                if not db_track:
                    logger.error(f"[qwen3_voice_clone] ❌ Failed to get database session for tracking")
                    raise RuntimeError("Failed to get database session")
                
                try:
                    from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
                    from services.subscription import PricingService
                    from sqlalchemy import text as sql_text
                    from services.subscription.provider_detection import detect_actual_provider

                    pricing = PricingService(db_track)
                    current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")

                    summary = db_track.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()

                    if not summary:
                        summary = UsageSummary(user_id=user_id, billing_period=current_period)
                        db_track.add(summary)
                        db_track.flush()

                    current_calls_before = getattr(summary, "audio_calls", 0) or 0
                    current_cost_before = getattr(summary, "audio_cost", 0.0) or 0.0
                    new_calls = current_calls_before + 1
                    new_cost = current_cost_before + float(estimated_cost)

                    now_utc = datetime.utcnow()
                    update_query = sql_text("""
                        UPDATE usage_summaries 
                        SET audio_calls = :new_calls,
                            audio_cost = :new_cost,
                            total_calls = COALESCE(total_calls, 0) + 1,
                            total_cost = COALESCE(total_cost, 0.0) + :cost,
                            updated_at = :now
                        WHERE user_id = :user_id AND billing_period = :period
                    """)
                    db_track.execute(update_query, {
                        "new_calls": new_calls,
                        "new_cost": new_cost,
                        "cost": float(estimated_cost),
                        "user_id": user_id,
                        "period": current_period,
                        "now": now_utc,
                    })

                    actual_provider = detect_actual_provider(
                        provider_enum=APIProvider.AUDIO,
                        model_name="wavespeed-ai/qwen3-tts/voice-clone",
                        endpoint="/audio-generation/wavespeed/qwen3-tts/voice-clone",
                    )

                    usage_log = APIUsageLog(
                        user_id=user_id,
                        provider=APIProvider.AUDIO,
                        endpoint="/audio-generation/wavespeed/qwen3-tts/voice-clone",
                        method="POST",
                        model_used="wavespeed-ai/qwen3-tts/voice-clone",
                        actual_provider_name=actual_provider,
                        tokens_input=char_count,
                        tokens_output=0,
                        tokens_total=char_count,
                        cost_input=0.0,
                        cost_output=0.0,
                        cost_total=float(estimated_cost),
                        response_time=response_time,
                        status_code=200,
                        request_size=len(audio_bytes) + len(text.encode("utf-8")),
                        response_size=len(preview_audio_bytes),
                        billing_period=current_period,
                    )
                    db_track.add(usage_log)
                    db_track.commit()
                    from services.subscription.cache import clear_dashboard_cache
                    clear_dashboard_cache(user_id)

                    try:
                        sys.stdout.write(f"\n[SUBSCRIPTION] Qwen3 Voice Clone user={user_id} model=wavespeed-ai/qwen3-tts/voice-clone cost=${float(estimated_cost):.4f}\n")
                        sys.stdout.flush()
                    except Exception:
                        pass
                except Exception as track_error:
                    logger.error(f"[qwen3_voice_clone] ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
                    db_track.rollback()
                finally:
                    db_track.close()
            except Exception as usage_error:
                logger.error(f"[qwen3_voice_clone] ❌ Failed to track usage: {usage_error}", exc_info=True)

        return VoiceCloneResult(
            preview_audio_bytes=preview_audio_bytes,
            provider="wavespeed",
            model="wavespeed-ai/qwen3-tts/voice-clone",
            custom_voice_id="",
            file_size=len(preview_audio_bytes),
        )
    except HTTPException:
        raise
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"[qwen3_voice_clone] Error cloning voice: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Qwen3 voice cloning failed",
                "message": str(e),
            },
        )


def qwen3_voice_design(
    text: str,
    voice_description: str,
    *,
    language: str = "auto",
    user_id: Optional[str] = None,
) -> VoiceCloneResult:
    try:
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")

        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            raise ValueError("Text is required and cannot be empty")
        text = text.strip()
        
        if not voice_description or not isinstance(voice_description, str) or len(voice_description.strip()) == 0:
            raise ValueError("Voice description is required")
        voice_description = voice_description.strip()

        from services.subscription import get_voice_clone_cost
        char_count = len(text)
        estimated_cost = get_voice_clone_cost("wavespeed-ai/qwen3-tts/voice-design", char_count=char_count, default_per_request=0.005)

        from services.database import get_session_for_user
        from services.subscription import PricingService
        from models.subscription_models import APIProvider

        try:
            db = get_session_for_user(user_id)
            if not db:
                raise RuntimeError("Failed to get database session")
            try:
                pricing_service = PricingService(db)
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    tokens_requested=char_count,
                    actual_provider_name="wavespeed",
                )
                if not can_proceed:
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": message,
                            "message": message,
                            "provider": "wavespeed",
                            "usage_info": usage_info if usage_info else {},
                        },
                    )
            finally:
                db.close()
        except HTTPException:
            raise
        except Exception as sub_error:
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")

        import time
        start_time = time.time()
        client = _get_wavespeed_client(user_id)
        preview_audio_bytes = client.voice_design(
            text=text,
            voice_description=voice_description,
            language=language
        )
        response_time = time.time() - start_time

        # Track usage
        try:
            db_track = get_session_for_user(user_id)
            if not db_track:
                logger.error(f"[qwen3_voice_design] ❌ Failed to get database session for tracking")
                raise RuntimeError("Failed to get database session")
            
            try:
                from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
                from services.subscription import PricingService
                from sqlalchemy import text as sql_text
                from services.subscription.provider_detection import detect_actual_provider

                pricing = PricingService(db_track)
                current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")

                summary = db_track.query(UsageSummary).filter(
                    UsageSummary.user_id == user_id,
                    UsageSummary.billing_period == current_period
                ).first()

                if not summary:
                    summary = UsageSummary(user_id=user_id, billing_period=current_period)
                    db_track.add(summary)
                    db_track.flush()

                current_calls_before = getattr(summary, "audio_calls", 0) or 0
                current_cost_before = getattr(summary, "audio_cost", 0.0) or 0.0
                new_calls = current_calls_before + 1
                new_cost = current_cost_before + float(estimated_cost)

                now_utc = datetime.utcnow()
                update_query = sql_text("""
                    UPDATE usage_summaries 
                    SET audio_calls = :new_calls,
                        audio_cost = :new_cost,
                        total_calls = COALESCE(total_calls, 0) + 1,
                        total_cost = COALESCE(total_cost, 0.0) + :cost,
                        updated_at = :now
                    WHERE user_id = :user_id AND billing_period = :period
                """)
                db_track.execute(update_query, {
                    "new_calls": new_calls,
                    "new_cost": new_cost,
                    "cost": float(estimated_cost),
                    "user_id": user_id,
                    "period": current_period,
                    "now": now_utc,
                })

                actual_provider = detect_actual_provider(
                    provider_enum=APIProvider.AUDIO,
                    model_name="wavespeed-ai/qwen3-tts/voice-design",
                    endpoint="/audio-generation/wavespeed/qwen3-tts/voice-design",
                )

                usage_log = APIUsageLog(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    endpoint="/audio-generation/wavespeed/qwen3-tts/voice-design",
                    method="POST",
                    model_used="wavespeed-ai/qwen3-tts/voice-design",
                    actual_provider_name=actual_provider,
                    tokens_input=char_count,
                    tokens_output=0,
                    tokens_total=char_count,
                    cost_input=0.0,
                    cost_output=0.0,
                    cost_total=float(estimated_cost),
                    response_time=response_time,
                    status_code=200,
                    request_size=len(text) + len(voice_description),
                    response_size=len(preview_audio_bytes),
                    billing_period=current_period,
                )
                db_track.add(usage_log)
                db_track.commit()
                from services.subscription.cache import clear_dashboard_cache
                clear_dashboard_cache(user_id)

                try:
                    sys.stdout.write(f"\n[SUBSCRIPTION] Qwen3 Voice Design user={user_id} model=wavespeed-ai/qwen3-tts/voice-design cost=${float(estimated_cost):.4f}\n")
                    sys.stdout.flush()
                except Exception:
                    pass
            except Exception as track_error:
                logger.error(f"[qwen3_voice_design] ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
                db_track.rollback()
            finally:
                db_track.close()
        except Exception as usage_error:
            logger.error(f"[qwen3_voice_design] ❌ Failed to track usage: {usage_error}", exc_info=True)

        return VoiceCloneResult(
            preview_audio_bytes=preview_audio_bytes,
            provider="wavespeed",
            model="wavespeed-ai/qwen3-tts/voice-design",
            custom_voice_id="", # No persistent ID for design usually, unless we save it
            file_size=len(preview_audio_bytes),
        )
    except HTTPException:
        raise
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"[qwen3_voice_design] Error designing voice: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Qwen3 voice design failed",
                "message": str(e),
            },
        )


def cosyvoice_voice_clone(
    audio_bytes: bytes,
    text: str,
    *,
    reference_text: Optional[str] = None,
    audio_mime_type: Optional[str] = None,
    user_id: Optional[str] = None,
) -> VoiceCloneResult:
    try:
        if not user_id:
            raise RuntimeError("user_id is required for subscription checking. Please provide Clerk user ID.")

        if not audio_bytes or not isinstance(audio_bytes, (bytes, bytearray)) or len(audio_bytes) == 0:
            raise ValueError("Audio is required and cannot be empty")

        if len(audio_bytes) > 15 * 1024 * 1024:
            raise ValueError("Audio file too large. Maximum is 15MB.")

        if not text or not isinstance(text, str) or len(text.strip()) == 0:
            raise ValueError("Text is required and cannot be empty")
        text = text.strip()
        if len(text) > 4000:
            raise ValueError("Text too long. Please keep it under 4000 characters.")

        from services.subscription import get_voice_clone_cost
        char_count = len(text)
        estimated_cost = get_voice_clone_cost("wavespeed-ai/cosyvoice-tts/voice-clone", char_count=char_count, default_per_request=0.005)

        from services.database import get_session_for_user
        from services.subscription import PricingService
        from models.subscription_models import APIProvider

        try:
            db = get_session_for_user(user_id)
            if not db:
                raise RuntimeError("Failed to get database session")
            try:
                pricing_service = PricingService(db)
                can_proceed, message, usage_info = pricing_service.check_usage_limits(
                    user_id=user_id,
                    provider=APIProvider.AUDIO,
                    tokens_requested=char_count,
                    actual_provider_name="wavespeed",
                )
                if not can_proceed:
                    raise HTTPException(
                        status_code=429,
                        detail={
                            "error": message,
                            "message": message,
                            "provider": "wavespeed",
                            "usage_info": usage_info if usage_info else {},
                        },
                    )
            finally:
                db.close()
        except HTTPException:
            raise
        except Exception as sub_error:
            raise RuntimeError(f"Subscription check failed: {str(sub_error)}")

        import time
        start_time = time.time()
        client = _get_wavespeed_client(user_id)
        preview_audio_bytes = client.cosyvoice_voice_clone(
            audio_bytes=bytes(audio_bytes),
            text=text,
            audio_mime_type=audio_mime_type or "audio/wav",
            reference_text=reference_text,
        )
        response_time = time.time() - start_time

        if preview_audio_bytes:
            try:
                db_track = get_session_for_user(user_id)
                if not db_track:
                    logger.error(f"[cosyvoice_voice_clone] ❌ Failed to get database session for tracking")
                    raise RuntimeError("Failed to get database session")
                
                try:
                    from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
                    from services.subscription import PricingService
                    from sqlalchemy import text as sql_text
                    from services.subscription.provider_detection import detect_actual_provider

                    pricing = PricingService(db_track)
                    current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")

                    summary = db_track.query(UsageSummary).filter(
                        UsageSummary.user_id == user_id,
                        UsageSummary.billing_period == current_period
                    ).first()

                    if not summary:
                        summary = UsageSummary(user_id=user_id, billing_period=current_period)
                        db_track.add(summary)
                        db_track.flush()

                    current_calls_before = getattr(summary, "audio_calls", 0) or 0
                    current_cost_before = getattr(summary, "audio_cost", 0.0) or 0.0
                    new_calls = current_calls_before + 1
                    new_cost = current_cost_before + float(estimated_cost)

                    now_utc = datetime.utcnow()
                    update_query = sql_text("""
                        UPDATE usage_summaries 
                        SET audio_calls = :new_calls,
                            audio_cost = :new_cost,
                            total_calls = COALESCE(total_calls, 0) + 1,
                            total_cost = COALESCE(total_cost, 0.0) + :cost,
                            updated_at = :now
                        WHERE user_id = :user_id AND billing_period = :period
                    """)
                    db_track.execute(update_query, {
                        "new_calls": new_calls,
                        "new_cost": new_cost,
                        "cost": float(estimated_cost),
                        "user_id": user_id,
                        "period": current_period,
                        "now": now_utc,
                    })

                    actual_provider = detect_actual_provider(
                        provider_enum=APIProvider.AUDIO,
                        model_name="wavespeed-ai/cosyvoice-tts/voice-clone",
                        endpoint="/audio-generation/wavespeed/cosyvoice-tts/voice-clone",
                    )

                    usage_log = APIUsageLog(
                        user_id=user_id,
                        provider=APIProvider.AUDIO,
                        endpoint="/audio-generation/wavespeed/cosyvoice-tts/voice-clone",
                        method="POST",
                        model_used="wavespeed-ai/cosyvoice-tts/voice-clone",
                        actual_provider_name=actual_provider,
                        tokens_input=char_count,
                        tokens_output=0,
                        tokens_total=char_count,
                        cost_input=0.0,
                        cost_output=0.0,
                        cost_total=float(estimated_cost),
                        response_time=response_time,
                        status_code=200,
                        request_size=len(audio_bytes) + len(text.encode("utf-8")),
                        response_size=len(preview_audio_bytes),
                        billing_period=current_period,
                    )
                    db_track.add(usage_log)
                    db_track.commit()
                    from services.subscription.cache import clear_dashboard_cache
                    clear_dashboard_cache(user_id)

                    try:
                        sys.stdout.write(f"\n[SUBSCRIPTION] CosyVoice Voice Clone user={user_id} model=wavespeed-ai/cosyvoice-tts/voice-clone cost=${float(estimated_cost):.4f}\n")
                        sys.stdout.flush()
                    except Exception:
                        pass
                except Exception as track_error:
                    logger.error(f"[cosyvoice_voice_clone] ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
                    db_track.rollback()
                finally:
                    db_track.close()
            except Exception as usage_error:
                logger.error(f"[cosyvoice_voice_clone] ❌ Failed to track usage: {usage_error}", exc_info=True)

        return VoiceCloneResult(
            preview_audio_bytes=preview_audio_bytes,
            provider="wavespeed",
            model="wavespeed-ai/cosyvoice-tts/voice-clone",
            custom_voice_id="",
            file_size=len(preview_audio_bytes),
        )
    except HTTPException:
        raise
    except RuntimeError:
        raise
    except Exception as e:
        logger.error(f"[cosyvoice_voice_clone] Error cloning voice: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "CosyVoice voice cloning failed",
                "message": str(e),
            },
        )

