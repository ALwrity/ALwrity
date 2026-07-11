"""
Podcast Audio Handlers

Audio generation, combining, and serving endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pathlib import Path
from urllib.parse import urlparse
import tempfile
import uuid
import hashlib
import time
import shutil
import requests
import asyncio
from concurrent.futures import ThreadPoolExecutor

import asyncio
from concurrent.futures import ThreadPoolExecutor

from services.database import get_db
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from api.story_writer.utils.auth import require_authenticated_user
from utils.asset_tracker import save_asset_to_library
from models.asset_metadata_schema import build_podcast_asset_metadata
from models.story_models import StoryAudioResult
from loguru import logger
from ..constants import get_podcast_audio_service, get_podcast_media_dir
from ..utils import _resolve_podcast_media_file
from ..models import (
    PodcastAudioRequest,
    PodcastAudioResponse,
    PodcastCombineAudioRequest,
    PodcastCombineAudioResponse,
)

router = APIRouter()

# Thread pool for CPU/IO-intensive voice clone operations
_audio_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="podcast_audio")

# In-memory LRU cache for voice samples (per user) to avoid re-downloading
_voice_sample_cache: dict[str, tuple[float, bytes]] = {}
_VOICE_SAMPLE_CACHE_TTL = 1800  # 30 minutes


def _get_cached_voice_sample(cache_key: str) -> Optional[bytes]:
    """Get voice sample bytes from in-memory cache if fresh."""
    if cache_key in _voice_sample_cache:
        ts, data = _voice_sample_cache[cache_key]
        if time.time() - ts < _VOICE_SAMPLE_CACHE_TTL:
            logger.debug(f"[Podcast] Voice sample cache hit for {cache_key[:16]}...")
            return data
        del _voice_sample_cache[cache_key]
    return None


def _cache_voice_sample(cache_key: str, data: bytes) -> None:
    """Store voice sample bytes in in-memory cache."""
    # Evict oldest entries if cache grows too large
    if len(_voice_sample_cache) > 50:
        oldest_key = min(_voice_sample_cache, key=lambda k: _voice_sample_cache[k][0])
        del _voice_sample_cache[oldest_key]
    _voice_sample_cache[cache_key] = (time.time(), data)


def _get_latest_voice_sample_url(user_id: str, db) -> Optional[str]:
    """Get the latest voice sample URL for a user from their voice clone assets."""
    try:
        from models.content_asset_models import ContentAsset, AssetType, AssetSource
        from sqlalchemy import desc
        
        asset = db.query(ContentAsset).filter(
            ContentAsset.user_id == user_id,
            ContentAsset.asset_type == AssetType.AUDIO,
            ContentAsset.source_module == AssetSource.VOICE_CLONER,
        ).order_by(desc(ContentAsset.created_at)).first()
        
        if asset and asset.file_url:
            logger.info(f"[Podcast] Found voice sample for user {user_id}: {asset.file_url}")
            return asset.file_url
        
        logger.warning(f"[Podcast] No voice sample asset found for user {user_id}")
        return None
    except Exception as e:
        logger.error(f"[Podcast] Error fetching voice sample URL: {e}")
        return None


def _fetch_voice_sample(voice_sample_url: str, user_id: str) -> Optional[bytes]:
    """Fetch voice sample audio bytes from URL, with caching."""
    cache_key = hashlib.md5(f"{user_id}:{voice_sample_url}".encode()).hexdigest()
    
    # Check in-memory cache first
    cached = _get_cached_voice_sample(cache_key)
    if cached is not None:
        return cached
    
    try:
        from utils.media_utils import resolve_media_path

        # Try resolving as a local workspace path first (fastest)
        if "/api/assets/" in voice_sample_url:
            # Resolve user workspace path directly
            sanitized_uid = "".join(c for c in user_id if c.isalnum() or c in ("-", "_"))
            from api.podcast.constants import ROOT_DIR
            parts = voice_sample_url.split("/")
            # Expected: /api/assets/{user_id}/voice_samples/{filename}
            try:
                idx = parts.index("voice_samples")
                filename = parts[idx + 1].split("?")[0]
                local_path = ROOT_DIR / "workspace" / f"workspace_{sanitized_uid}" / "assets" / "voice_samples" / filename
                if local_path.exists():
                    data = local_path.read_bytes()
                    _cache_voice_sample(cache_key, data)
                    logger.info(f"[Podcast] Voice sample loaded from workspace: {local_path}")
                    return data
            except (ValueError, IndexError):
                pass

            # Fall back to media utils resolver
            local_path = resolve_media_path(voice_sample_url)
            if local_path and local_path.exists():
                data = local_path.read_bytes()
                _cache_voice_sample(cache_key, data)
                return data

        # Try resolving as a podcast audio file
        if "/api/podcast/audio/" in voice_sample_url:
            filename = voice_sample_url.split("/api/podcast/audio/")[-1].split("?")[0]
            try:
                audio_dir = get_podcast_media_dir("audio", user_id)
                local_path = audio_dir / filename
                if local_path.exists():
                    data = local_path.read_bytes()
                    _cache_voice_sample(cache_key, data)
                    return data
            except Exception:
                pass

        # Try direct HTTP fetch as fallback
        if voice_sample_url.startswith("http"):
            logger.info(f"[Podcast] Fetching voice sample via HTTP: {voice_sample_url[:80]}...")
            resp = requests.get(voice_sample_url, timeout=30)
            if resp.status_code == 200:
                data = resp.content
                _cache_voice_sample(cache_key, data)
                logger.info(f"[Podcast] Voice sample fetched via HTTP ({len(data)} bytes)")
                return data

        logger.warning(f"[Podcast] Could not fetch voice sample from: {voice_sample_url}")
        return None
    except Exception as e:
        logger.error(f"[Podcast] Error fetching voice sample: {e}")
        return None


@router.post("/audio/upload")
async def upload_podcast_audio(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload an audio file (voice sample) for a podcast project.
    Returns the audio URL for use in video generation.
    """
    user_id = require_authenticated_user(current_user)
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('audio/'):
        # Allow octet-stream if extension is audio
        allowed_exts = ['.mp3', '.wav', '.m4a', '.aac']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_exts and file.content_type != 'application/octet-stream':
             raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Validate file size (max 20MB)
    file_content = await file.read()
    if len(file_content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file size must be less than 20MB")
    
    try:
        # Generate filename
        file_ext = Path(file.filename).suffix or '.mp3'
        unique_id = str(uuid.uuid4())[:8]
        audio_filename = f"audio_{project_id or 'temp'}_{unique_id}{file_ext}"
        audio_base_dir = get_podcast_media_dir("audio", user_id, ensure_exists=True)
        audio_path = audio_base_dir / audio_filename
        
        # Save file
        with open(audio_path, "wb") as f:
            f.write(file_content)
        
        logger.info(f"[Podcast] Audio uploaded: {audio_path}")
        
        # Create audio URL
        audio_url = f"/api/podcast/audio/{audio_filename}"
        
        # Save to asset library if project_id provided
        if project_id:
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="audio",
                    source_module="podcast_maker",
                    filename=audio_filename,
                    file_url=audio_url,
                    file_path=str(audio_path),
                    file_size=len(file_content),
                    mime_type=file.content_type,
                    title=f"Uploaded Audio - {project_id}",
                    description="Uploaded podcast audio/voice sample",
                    tags=["podcast", "audio", "upload", project_id],
                    asset_metadata=build_podcast_asset_metadata(
                        asset_role="uploaded_audio",
                        project_id=project_id,
                        origin="podcast.audio.upload",
                    ),
                )
            except Exception as e:
                logger.warning(f"[Podcast] Failed to save audio asset: {e}")
        
        return {
            "audio_url": audio_url,
            "audio_filename": audio_filename,
            "message": "Audio uploaded successfully"
        }
    except Exception as exc:
        logger.error(f"[Podcast] Audio upload failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio upload failed: {str(exc)}")


@router.post("/audio", response_model=PodcastAudioResponse)
async def generate_podcast_audio(
    request: PodcastAudioRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate AI audio for a podcast scene using shared audio service.
    """
    user_id = require_authenticated_user(current_user)

    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        # Determine if we should use voice clone path
        # Voice clone is used when: explicitly requested, OR when voice_id/custom_voice_id indicates a clone
        # (cloned voice IDs start with "vc_" or match the placeholder "MY_VOICE_CLONE")
        _vid = request.voice_id or ""
        _cvid = request.custom_voice_id or ""
        is_voice_clone = request.use_voice_clone or (
            _cvid.startswith("vc_") or _cvid == "MY_VOICE_CLONE"
        ) or (
            _vid.startswith("vc_") or _vid == "MY_VOICE_CLONE"
        )
        
        # If voice_id is a clone ID, normalize it to use Wise_Woman for TTS fallback
        effective_voice_id = _vid if not (_vid.startswith("vc_") or _vid == "MY_VOICE_CLONE") else "Wise_Woman"

        logger.warning(f"[Podcast] Audio request: use_voice_clone={request.use_voice_clone}, voice_id={request.voice_id}, custom_voice_id={request.custom_voice_id}, is_voice_clone={is_voice_clone}, voice_sample_url={request.voice_sample_url}, voice_clone_engine={request.voice_clone_engine}")

        # Voice clone path: use user's voice sample with scene text as reference
        if is_voice_clone:
            # If no voice_sample_url provided, try to fetch it from the user's latest voice clone
            voice_sample_url = request.voice_sample_url
            if not voice_sample_url:
                try:
                    voice_sample_url = _get_latest_voice_sample_url(user_id, db)
                    logger.warning(f"[Podcast] DB fallback voice sample URL for user {user_id}: {voice_sample_url}")
                except Exception as e:
                    logger.warning(f"[Podcast] Could not fetch voice sample URL: {e}")

            if voice_sample_url:
                from services.llm_providers.main_audio_generation import qwen3_voice_clone, cosyvoice_voice_clone
                from utils.media_utils import detect_audio_format
                
                engine = (request.voice_clone_engine or "qwen3").lower()
                logger.warning(f"[Podcast] 🔊 Voice clone path: engine={engine}, scene='{request.scene_title}', voice_sample_url={voice_sample_url[:80]}...")
                
                # Download voice sample from URL (with caching)
                logger.warning(f"[Podcast] Fetching voice sample from: {voice_sample_url}")
                try:
                    voice_sample_bytes = _fetch_voice_sample(voice_sample_url, user_id)
                except Exception as fetch_err:
                    logger.error(f"[Podcast] ❌ Failed to fetch voice sample: {fetch_err}", exc_info=True)
                    raise HTTPException(status_code=400, detail=f"Could not fetch voice sample: {str(fetch_err)}")
                logger.warning(f"[Podcast] Voice sample fetch result: {len(voice_sample_bytes) if voice_sample_bytes else 0} bytes")
                if not voice_sample_bytes:
                    raise HTTPException(status_code=400, detail=f"Could not fetch voice sample from {voice_sample_url}")
                
                # Detect actual audio format from bytes (may differ from file extension)
                detected_fmt, detected_mime = detect_audio_format(voice_sample_bytes)
                logger.warning(f"[Podcast] 🔊 Detected voice sample format: {detected_fmt} ({detected_mime}), {len(voice_sample_bytes)} bytes")
                voice_mime_type = detected_mime or "audio/wav"

                scene_text = request.text.strip()
                if len(scene_text) > 4000:
                    scene_text = scene_text[:4000]

                # Run voice clone in thread pool to avoid blocking the event loop
                loop = asyncio.get_event_loop()
                
                try:
                    if engine == "minimax":
                        from services.llm_providers.main_audio_generation import clone_voice
                        import random
                        import string
                        random_suffix = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
                        custom_vid = request.custom_voice_id or f"vc_{random_suffix}"
                        
                        result_obj = await loop.run_in_executor(
                            _audio_executor,
                            lambda cv=custom_vid: clone_voice(
                                audio_bytes=voice_sample_bytes,
                                custom_voice_id=cv,
                                text=scene_text,
                                user_id=user_id,
                            ),
                        )
                        audio_bytes = result_obj.preview_audio_bytes
                        provider = "minimax"
                        model = "minimax/voice-clone"
                    elif engine == "cosyvoice":
                        result_obj = await loop.run_in_executor(
                            _audio_executor,
                            lambda: cosyvoice_voice_clone(
                                audio_bytes=voice_sample_bytes,
                                text=scene_text,
                                user_id=user_id,
                                audio_mime_type=voice_mime_type,
                            ),
                        )
                        audio_bytes = result_obj.preview_audio_bytes
                        provider = "wavespeed-ai"
                        model = "wavespeed-ai/cosyvoice-tts/voice-clone"
                    else:
                        result_obj = await loop.run_in_executor(
                            _audio_executor,
                            lambda: qwen3_voice_clone(
                                audio_bytes=voice_sample_bytes,
                                text=scene_text,
                                user_id=user_id,
                                audio_mime_type=voice_mime_type,
                            ),
                        )
                        audio_bytes = result_obj.preview_audio_bytes
                        provider = "wavespeed-ai"
                        model = "wavespeed-ai/qwen3-tts/voice-clone"
                    
                    logger.warning(f"[Podcast] 🔊 Voice clone result: {len(audio_bytes) if audio_bytes else 0} bytes, provider={provider}")
                except HTTPException:
                    raise
                except Exception as clone_err:
                    logger.error(f"[Podcast] ❌ Voice clone failed: {clone_err}", exc_info=True)
                    raise HTTPException(status_code=500, detail=f"Voice clone generation failed: {str(clone_err)}")

            # Save audio bytes to file
            audio_service = get_podcast_audio_service(user_id)
            audio_filename = f"scene_{request.scene_id}_{uuid.uuid4().hex[:8]}.mp3"
            audio_path = audio_service.output_dir / audio_filename
            
            with open(audio_path, "wb") as f:
                f.write(audio_bytes)
            
            file_size = len(audio_bytes)
            audio_url = f"/api/podcast/audio/{audio_filename}"
            cost = max(0.005, 0.005 * (len(scene_text) / 100.0))

            result = {
                "audio_path": str(audio_path),
                "audio_filename": audio_filename,
                "audio_url": audio_url,
                "file_size": file_size,
                "provider": provider,
                "model": model,
                "cost": cost,
                "scene_number": 0,
                "scene_title": request.scene_title,
            }

        else:
            # Standard TTS path - but NOT if custom_voice_id is a clone ID
            # Clone IDs (vc_*, MY_VOICE_CLONE) are not valid for minimax TTS
            if is_voice_clone:
                logger.warning(f"[Podcast] ⚠️ Voice clone detected but no voice sample available - falling back to standard TTS with voice_id={effective_voice_id}")
            effective_custom_voice_id = request.custom_voice_id
            if effective_custom_voice_id and (
                effective_custom_voice_id.startswith("vc_") or
                effective_custom_voice_id == "MY_VOICE_CLONE"
            ):
                logger.warning(f"[Podcast] Ignoring clone ID '{effective_custom_voice_id}' in standard TTS path - no voice sample URL available")
                effective_custom_voice_id = None
            
            audio_service = get_podcast_audio_service(user_id)
            logger.warning(f"[Podcast] Standard TTS path: voice_id={effective_voice_id}, custom_voice_id={effective_custom_voice_id}")
            result: StoryAudioResult = audio_service.generate_ai_audio(
                scene_number=0,
                scene_title=request.scene_title,
                text=request.text.strip(),
                user_id=user_id,
                voice_id=effective_voice_id,
                custom_voice_id=effective_custom_voice_id,
                speed=request.speed or 1.0,  # Normal speed (was 0.9, but too slow - causing duration issues)
                volume=request.volume or 1.0,
                pitch=request.pitch or 0.0,  # Normal pitch (0.0 = neutral)
                emotion=request.emotion or "neutral",
                english_normalization=request.english_normalization or False,
                sample_rate=request.sample_rate,
                bitrate=request.bitrate,
                channel=request.channel,
                format=request.format,
                language_boost=request.language_boost,
                enable_sync_mode=request.enable_sync_mode,
            )
            
            # Override URL to use podcast endpoint instead of story endpoint
            if result.get("audio_url") and "/api/story/audio/" in result.get("audio_url", ""):
                audio_filename = result.get("audio_filename", "")
                result["audio_url"] = f"/api/podcast/audio/{audio_filename}"
            
            logger.warning(f"[Podcast] Audio generated - path: {result.get('audio_path')}, url: {result.get('audio_url')}")
    except HTTPException:
        raise
    except Exception as exc:
        exc_type = type(exc).__name__
        exc_msg = str(exc)[:500]
        logger.error(f"[Podcast] Audio generation failed ({exc_type}): {exc_msg}")
        logger.error(f"[Podcast] Audio generation traceback:", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio generation failed ({exc_type}): {exc_msg}")

    # Save to asset library (podcast module)
    try:
        if result.get("audio_url"):
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="audio",
                source_module="podcast_maker",
                filename=result.get("audio_filename", ""),
                file_url=result.get("audio_url", ""),
                file_path=result.get("audio_path"),
                file_size=result.get("file_size"),
                mime_type="audio/mpeg",
                title=f"{request.scene_title} - Podcast",
                description="Podcast scene narration",
                tags=["podcast", "audio", request.scene_id],
                provider=result.get("provider"),
                model=result.get("model"),
                cost=result.get("cost"),
                asset_metadata=build_podcast_asset_metadata(
                    asset_role="podcast_audio",
                    project_id=request.project_id,
                    origin="podcast.audio.generate",
                    extras={"scene_id": request.scene_id, "scene_title": request.scene_title},
                ),
            )
    except Exception as e:
        logger.warning(f"[Podcast] Failed to save audio asset: {e}")

    return PodcastAudioResponse(
        scene_id=request.scene_id,
        scene_title=request.scene_title,
        audio_filename=result.get("audio_filename", ""),
        audio_url=result.get("audio_url", ""),
        provider=result.get("provider", "wavespeed"),
        model=result.get("model", "minimax/speech-02-hd"),
        voice_id=result.get("voice_id", request.voice_id or "Wise_Woman"),
        text_length=result.get("text_length", len(request.text)),
        file_size=result.get("file_size", 0),
        cost=result.get("cost", 0.0),
    )


@router.post("/combine-audio", response_model=PodcastCombineAudioResponse)
async def combine_podcast_audio(
    request: PodcastCombineAudioRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Combine multiple scene audio files into a single podcast audio file.
    """
    user_id = require_authenticated_user(current_user)
    
    if not request.scene_ids or not request.scene_audio_urls:
        raise HTTPException(status_code=400, detail="Scene IDs and audio URLs are required")
    
    if len(request.scene_ids) != len(request.scene_audio_urls):
        raise HTTPException(status_code=400, detail="Scene IDs and audio URLs count must match")
    
    try:
        # Import moviepy for audio concatenation
        try:
            from moviepy import AudioFileClip, concatenate_audioclips
        except ImportError:
            logger.error("[Podcast] MoviePy not available for audio combination")
            raise HTTPException(
                status_code=500,
                detail="Audio combination requires MoviePy. Please install: pip install moviepy"
            )
        
        # Create temporary directory for audio processing
        temp_dir = Path(tempfile.gettempdir()) / f"podcast_combine_{uuid.uuid4().hex[:8]}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        audio_clips = []
        total_duration = 0.0
        
        try:
            # Log incoming request for debugging
            logger.info(f"[Podcast] Combining audio: {len(request.scene_audio_urls)} URLs received")
            for idx, url in enumerate(request.scene_audio_urls):
                logger.info(f"[Podcast] URL {idx+1}: {url}")
            
            # Download and load each audio file from podcast_audio directory
            for idx, audio_url in enumerate(request.scene_audio_urls):
                try:
                    # Normalize audio URL - handle both absolute and relative paths
                    if audio_url.startswith("http"):
                        # External URL - would need to download
                        logger.error(f"[Podcast] External URLs not supported: {audio_url}")
                        raise HTTPException(
                            status_code=400,
                            detail=f"External URLs not supported. Please use local file paths."
                        )
                    
                    # Handle relative paths - only /api/podcast/audio/... URLs are supported
                    audio_path = None
                    if audio_url.startswith("/api/"):
                        # Extract filename from URL
                        parsed = urlparse(audio_url)
                        path = parsed.path if parsed.scheme else audio_url
                        
                        # Handle both /api/podcast/audio/ and /api/story/audio/ URLs (for backward compatibility)
                        if "/api/podcast/audio/" in path:
                            filename = path.split("/api/podcast/audio/", 1)[1].split("?", 1)[0].strip()
                        elif "/api/story/audio/" in path:
                            # Convert story audio URLs to podcast audio (they're in the same directory now)
                            filename = path.split("/api/story/audio/", 1)[1].split("?", 1)[0].strip()
                            logger.info(f"[Podcast] Converting story audio URL to podcast: {audio_url} -> {filename}")
                        else:
                            logger.error(f"[Podcast] Unsupported audio URL format: {audio_url}. Expected /api/podcast/audio/ or /api/story/audio/ URLs.")
                            continue
                        
                        if not filename:
                            logger.error(f"[Podcast] Could not extract filename from URL: {audio_url}")
                            continue
                        
                        # Podcast audio files are stored in podcast_audio directory
                        audio_path = _resolve_podcast_media_file(filename, "audio", user_id)
                    else:
                        logger.warning(f"[Podcast] Non-API URL format, treating as direct path: {audio_url}")
                        audio_path = Path(audio_url)
                    
                    if not audio_path or not audio_path.exists():
                        logger.error(f"[Podcast] Audio file not found: {audio_path} (from URL: {audio_url})")
                        continue
                    
                    # Load audio clip
                    audio_clip = AudioFileClip(str(audio_path))
                    audio_clips.append(audio_clip)
                    total_duration += audio_clip.duration
                    logger.info(f"[Podcast] Loaded audio {idx+1}/{len(request.scene_audio_urls)}: {audio_path.name} ({audio_clip.duration:.2f}s)")
                    
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"[Podcast] Failed to load audio {idx+1}: {e}", exc_info=True)
                    # Continue with other audio files
                    continue
            
            if not audio_clips:
                raise HTTPException(status_code=400, detail="No valid audio files found to combine")
            
            # Concatenate all audio clips
            logger.info(f"[Podcast] Combining {len(audio_clips)} audio clips (total duration: {total_duration:.2f}s)")
            combined_audio = concatenate_audioclips(audio_clips)
            
            # Generate output filename
            output_filename = f"podcast_combined_{request.project_id}_{uuid.uuid4().hex[:8]}.mp3"
            audio_base_dir = get_podcast_media_dir("audio", user_id, ensure_exists=True)
            output_path = audio_base_dir / output_filename
            
            # Write combined audio file
            combined_audio.write_audiofile(
                str(output_path),
                codec="mp3",
                bitrate="192k",
                logger=None,  # Suppress moviepy logging
            )
            
            # Close audio clips to free resources
            for clip in audio_clips:
                clip.close()
            combined_audio.close()
            
            file_size = output_path.stat().st_size
            audio_url = f"/api/podcast/audio/{output_filename}"
            
            logger.info(f"[Podcast] Combined audio saved: {output_path} ({file_size} bytes)")
            
            # Save to asset library
            try:
                save_asset_to_library(
                    db=db,
                    user_id=user_id,
                    asset_type="audio",
                    source_module="podcast_maker",
                    filename=output_filename,
                    file_url=audio_url,
                    file_path=str(output_path),
                    file_size=file_size,
                    mime_type="audio/mpeg",
                    title=f"Combined Podcast - {request.project_id}",
                    description=f"Combined podcast audio from {len(request.scene_ids)} scenes",
                    tags=["podcast", "audio", "combined", request.project_id],
                    asset_metadata=build_podcast_asset_metadata(
                        asset_role="combined_podcast_audio",
                        project_id=request.project_id,
                        origin="podcast.audio.combine",
                        extras={"scene_ids": request.scene_ids, "scene_count": len(request.scene_ids), "total_duration": total_duration},
                    ),
                )
            except Exception as e:
                logger.warning(f"[Podcast] Failed to save combined audio asset: {e}")
            
            return PodcastCombineAudioResponse(
                combined_audio_url=audio_url,
                combined_audio_filename=output_filename,
                total_duration=total_duration,
                file_size=file_size,
                scene_count=len(request.scene_ids),
            )
            
        finally:
            # Cleanup temporary directory
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"[Podcast] Failed to cleanup temp directory: {e}")
                
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[Podcast] Audio combination failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audio combination failed: {exc}")


@router.get("/audio/{filename}")
async def serve_podcast_audio(
    filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve generated podcast scene audio files.
    
    Supports authentication via Authorization header or token query parameter.
    Query parameter is useful for HTML elements like <audio> that cannot send custom headers.
    """
    
    # Security check: ensure filename doesn't contain path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    user_id = require_authenticated_user(current_user)
    logger.info(f"[Podcast] serve_podcast_audio: filename={filename}, user_id={user_id}")
    
    audio_path = _resolve_podcast_media_file(filename, "audio", user_id)
    logger.info(f"[Podcast] Audio resolved path: {audio_path}, exists={audio_path.exists()}")
    audio_path = _resolve_podcast_media_file(filename, "audio", user_id)
    logger.debug(f"[Podcast] Resolved audio path: {audio_path}")
    
    return FileResponse(audio_path, media_type="audio/mpeg")

