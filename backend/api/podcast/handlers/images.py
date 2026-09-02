"""
Podcast Image Handlers

Image generation and serving endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pathlib import Path
import uuid
import base64

from services.database import get_db
from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from api.story_writer.utils.auth import require_authenticated_user
from services.llm_providers.main_image_generation import generate_image, generate_character_image
from utils.asset_tracker import save_asset_to_library
from loguru import logger
from ..constants import get_podcast_media_dir
from ..models import PodcastImageRequest, PodcastImageResponse
import hashlib
import time

# In-memory character consistency lock per podcast session
# Key: "{user_id}:{session_key}" -> Value: {"description": str, "created_at": float}
_CHARACTER_LOCK_CACHE: Dict[str, Dict[str, Any]] = {}
_CHARACTER_LOCK_TTL_SECONDS = 3600  # 1 hour TTL per podcast generation session

# Deterministic presenter-reference filename pattern (must match presenter_reference.py)
_PRESENTER_REF_FILENAME_TPL = "presenter_ref_{project_id}.png"


def _resolve_presenter_reference_image(
    user_id: str,
    project_id: Optional[str],
    db: Optional[Session],
) -> Optional[bytes]:
    """Return bytes of the saved presenter reference image, or None if not yet generated.

    Checks PodcastProject.presenter_reference_url in DB and, if set, loads the file
    from disk. Returns None gracefully on any error so the caller can fall back to
    text-only generation without crashing.
    """
    if not project_id or not db:
        return None
    try:
        try:
            from services.podcast_schema_utils import ensure_podcast_projects_columns
            ensure_podcast_projects_columns(db)
        except Exception:
            pass

        from models.podcast_models import PodcastProject
        project = db.query(PodcastProject).filter(
            PodcastProject.user_id == user_id,
            PodcastProject.project_id == project_id,
        ).first()
        if not project:
            return None
        ref_url = getattr(project, "presenter_reference_url", None)
        if not ref_url:
            return None
        # ref_url is like "/api/podcast/images/presenter_ref_<project_id>.png"
        ref_filename = _PRESENTER_REF_FILENAME_TPL.format(project_id=project_id)
        images_dir = get_podcast_media_dir("image", user_id, ensure_exists=False)
        ref_path = images_dir / ref_filename
        if not ref_path.exists():
            logger.warning(f"[PresenterRef] Reference file missing: {ref_path}")
            return None
        ref_bytes = ref_path.read_bytes()
        logger.info(
            f"[PresenterRef] Loaded presenter reference ({len(ref_bytes)} bytes) "
            f"for project {project_id}"
        )
        return ref_bytes
    except Exception as exc:
        logger.warning(f"[PresenterRef] Failed to load reference image (non-fatal): {exc}")
        return None




def _get_session_key(user_id: str, request: PodcastImageRequest) -> str:
    """Derive a stable session key from project_id, bible project_id, or idea hash."""
    if request.project_id and request.project_id.strip():
        return f"{user_id}:{request.project_id.strip()}"
    if request.bible and isinstance(request.bible, dict) and request.bible.get("project_id"):
        return f"{user_id}:{str(request.bible['project_id']).strip()}"
    # Fallback to hashed idea so all scenes in a generation run share the same character
    idea_seed = (request.idea or "default_podcast").strip().lower()
    idea_hash = hashlib.md5(idea_seed.encode("utf-8")).hexdigest()[:12]
    return f"{user_id}:{idea_hash}"


def _is_concrete_anchor(desc: Optional[str]) -> bool:
    """Return True only if the description has concrete facial/demographic and wardrobe anchors."""
    if not desc or len(desc.strip()) < 40:
        return False
    d = desc.lower().strip()
    generic_phrases = [
        "professional individual",
        "business-casual attire",
        "business casual attire",
        "dressed professionally",
        "professional attire",
        "standard podcast host",
        "expert presenter",
    ]
    if any(gp in d for gp in generic_phrases) and len(d) < 100:
        return False
    has_face_hair = any(k in d for k in ["hair", "eyes", "jawline", "beard", "shaven", "features", "cheekbones"])
    has_clothing = any(k in d for k in ["blazer", "suit", "shirt", "jacket", "blouse", "hoodie", "sweater", "collar"])
    return has_face_hair and has_clothing


def _resolve_or_create_character_lock(
    user_id: str,
    request: PodcastImageRequest,
    bible_obj: Any,
    db: Optional[Session] = None,
) -> str:
    """
    Return a locked character visual description for the session.
    First checks in-memory cache, then checks DB (PodcastProject) for cross-worker persistence,
    and generates/stores a concrete character description if none exists yet.
    """
    now = time.time()
    session_key = _get_session_key(user_id, request)

    # 1. In-memory cache check (fast path)
    cached = _CHARACTER_LOCK_CACHE.get(session_key)
    if cached and (now - cached.get("created_at", 0)) < _CHARACTER_LOCK_TTL_SECONDS:
        if _is_concrete_anchor(cached.get("description")):
            return cached["description"]

    # 2. Check DB PodcastProject if project_id and db are available (cross-worker persistence)
    locked_desc = None
    project = None
    if db and request.project_id:
        try:
            try:
                from services.podcast_schema_utils import ensure_podcast_projects_columns
                ensure_podcast_projects_columns(db)
            except Exception:
                pass

            from models.podcast_models import PodcastProject
            project = db.query(PodcastProject).filter(
                PodcastProject.user_id == user_id,
                PodcastProject.project_id == request.project_id
            ).first()
            if project and project.bible and isinstance(project.bible, dict):
                host_dict = project.bible.get("host")
                if host_dict and isinstance(host_dict, dict) and host_dict.get("look"):
                    candidate_look = host_dict["look"].strip()
                    if _is_concrete_anchor(candidate_look):
                        locked_desc = candidate_look
        except Exception as db_err:
            logger.debug(f"[CharacterLock] DB lookup non-critical error: {db_err}")

    # 3. If not found in DB, check bible_obj or generate concrete anchor
    if not locked_desc:
        if bible_obj and getattr(bible_obj, "host", None) and bible_obj.host.look:
            candidate = bible_obj.host.look.strip()
            if _is_concrete_anchor(candidate):
                locked_desc = candidate

        if not locked_desc:
            # Deterministic character anchor generation based on session_key with concrete facial/demographic anchors
            seed_val = int(hashlib.md5(session_key.encode("utf-8")).hexdigest()[:8], 16)
            styles = [
                "East Asian male tech lead, early 30s, clean-shaven, sharp structured jawline, neat short black hair with a subtle side part, warm dark eyes, wearing a tailored navy blazer over a crisp white collared shirt",
                "South Asian female tech entrepreneur, early 30s, warm almond eyes, defined cheekbones, sleek shoulder-length dark hair tucked behind ears, wearing a tailored dark emerald blazer over a cream blouse",
                "Hispanic male tech host, early 30s, neatly trimmed light stubble beard, strong square jawline, short textured dark brown hair, wearing a structured charcoal blazer over a white open-collar shirt",
                "Caucasian female podcast host, early 30s, distinct hazel eyes, clear facial structure, shoulder-length wavy honey brown hair, wearing a tailored midnight blue blazer over a silk ivory top",
                "Black male tech innovator, early 30s, clean-shaven, sharp defined jawline, short neat fade haircut, expressive confident eyes, wearing a tailored navy suit jacket over a crisp white shirt",
            ]
            locked_desc = styles[seed_val % len(styles)]

        # If DB project exists, persist locked look to project.bible so multiple worker processes share it
        if project and db:
            try:
                bible_data = dict(project.bible) if project.bible and isinstance(project.bible, dict) else {}
                host_data = dict(bible_data.get("host", {}))
                host_data["look"] = locked_desc
                bible_data["host"] = host_data
                project.bible = bible_data
                db.commit()
                logger.info(f"[CharacterLock] Persisted concrete character description to DB for project {request.project_id}")
            except Exception as save_err:
                logger.warning(f"[CharacterLock] Could not persist to DB (non-blocking): {save_err}")
                db.rollback()

    # 4. Save to in-memory cache
    _CHARACTER_LOCK_CACHE[session_key] = {
        "description": locked_desc,
        "created_at": now
    }
    logger.info(f"[CharacterLock] Locked character description for {session_key}: {locked_desc[:60]}...")
    return locked_desc

router = APIRouter()


@router.post("/image", response_model=PodcastImageResponse)
async def generate_podcast_scene_image(
    request: PodcastImageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an AI image for a podcast scene.
    Creates a professional, podcast-appropriate image based on scene title and content.
    """
    user_id = require_authenticated_user(current_user)

    if not request.scene_title:
        raise HTTPException(status_code=400, detail="Scene title is required")

    try:
        # PRE-FLIGHT VALIDATION: Check subscription limits before any API calls
        from services.subscription import PricingService
        from services.subscription.preflight_validator import validate_image_generation_operations
        from fastapi import HTTPException as FastAPIHTTPException
        
        pricing_service = PricingService(db)
        try:
            # Raises HTTPException immediately if validation fails
            validate_image_generation_operations(
                pricing_service=pricing_service,
                user_id=user_id,
                num_images=1
            )
            logger.info(f"[Podcast] ✅ Pre-flight validation passed for user {user_id}")
        except FastAPIHTTPException as http_ex:
            logger.error(f"[Podcast] ❌ Pre-flight validation failed for user {user_id}: {http_ex.detail}")
            raise
        
        # If base avatar is provided, create scene-specific variation
        # Otherwise, generate from scratch
        logger.info(f"[Podcast] Image generation request for scene {request.scene_id}")
        logger.info(f"[Podcast] base_avatar_url={request.base_avatar_url}")
        logger.info(f"[Podcast] custom_prompt={request.custom_prompt}")
        logger.info(f"[Podcast] style={request.style}, rendering_speed={request.rendering_speed}, aspect_ratio={request.aspect_ratio}")
        
        # Check user plan tier to determine image generation model path
        # Pro/Enterprise/Basic: Path A (Ideogram Character)
        # Free tier with uploaded avatar: Free-Tier Face Cloning (FLUX Kontext Pro img2img edit, $0.04/image)
        # Free tier without avatar: Path B (FLUX studio presenter from scratch / reference anchor, $0.04/image)
        is_free_tier = True
        try:
            from services.subscription import PricingService
            pricing_service = PricingService(db)
            limits = pricing_service.get_user_limits(user_id)
            tier = str(limits.get("tier", "free")).lower() if limits else "free"
            plan_name = str(limits.get("plan_name", "free")).lower() if limits else "free"
            if tier in ["pro", "enterprise", "basic"] or plan_name in ["pro", "enterprise", "basic"]:
                is_free_tier = False
        except Exception as exc:
            logger.warning(f"[Podcast] Error checking user plan for {user_id}: {exc}")
            is_free_tier = True
        
        if request.base_avatar_url:
            # Load base avatar image for reference (both Free tier FLUX img2img and Pro Ideogram Character)
            from ..utils import load_podcast_image_bytes
            try:
                logger.info(f"[Podcast] Attempting to load base avatar from: {request.base_avatar_url}")
                base_avatar_bytes = load_podcast_image_bytes(request.base_avatar_url, user_id=user_id)
                logger.info(f"[Podcast] ✅ Successfully loaded base avatar ({len(base_avatar_bytes)} bytes) for scene {request.scene_id}")
            except Exception as e:
                logger.error(f"[Podcast] ❌ Failed to load base avatar from {request.base_avatar_url}: {e}", exc_info=True)
                # If base avatar fails to load, we cannot maintain character consistency
                # Raise an error instead of falling back to standard generation
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "Failed to load base avatar",
                        "message": f"Could not load the base avatar image for character consistency: {str(e)}. Please ensure the avatar image is accessible.",
                    },
                )
        else:
            logger.info(f"[Podcast] No base avatar URL provided, will generate from scratch (Path B)")
            base_avatar_bytes = None
        
        # Extract Podcast Bible context for hyper-personalization. Seeded from the
        # user's podcast persona when no explicit bible is provided.
        bible_context = ""
        bible_obj = None
        try:
            from services.podcast_bible_service import PodcastBibleService
            bible_service = PodcastBibleService()
            bible_obj, bible_context = bible_service.get_or_build_bible(user_id, request.bible, "temp_image")
        except Exception as exc:
            logger.warning(f"[Podcast Image] Failed to build podcast bible: {exc}")

        # Build optimized prompt for scene image generation
        # When base avatar is provided, use Ideogram Character to maintain consistency
        # Otherwise, generate from scratch with podcast-optimized prompt
        # PHASE-4B (deferred): APPEND the podcast persona's prompt_defaults here —
        # studio_prompt (setting) + negative_prompt — on top of the scene-specific
        # content below. An explicit request.custom_prompt always wins.
        image_prompt = ""  # Initialize prompt variable
        
        # Mappings for single continuous recording session
        # 1. Facial expression and demeanor per emotion
        emotion_expression = {
            "happy": "Host facial expression: bright engaging smile, warm and friendly demeanor",
            "excited": "Host facial expression: enthusiastic animated smile, energized expressive eyes",
            "serious": "Host facial expression: serious focused expression, thoughtful authoritative gaze, steady demeanor",
            "curious": "Host facial expression: intrigued inquisitive expression, subtle interested smile",
            "confident": "Host facial expression: poised confident smile, assertive authoritative presence",
            "neutral": "Host facial expression: professional balanced expression, direct eye contact"
        }

        # 2. Bounded lighting tone / mood (maintains calibrated subject skin exposure and 5600K neutral white balance)
        emotion_lighting = {
            "happy": "consistent calibrated studio key lighting, subtle warm background fill, natural skin exposure, 5600K daylight balanced white balance",
            "excited": "consistent calibrated studio key lighting, clear crisp background accent, natural skin exposure, 5600K daylight balanced white balance",
            "serious": "consistent calibrated studio key lighting, subtle soft contrast in background set, natural skin exposure, 5600K daylight balanced white balance",
            "curious": "consistent calibrated studio key lighting, soft focused background illumination, natural skin exposure, 5600K daylight balanced white balance",
            "confident": "consistent calibrated studio key lighting, clean balanced studio illumination, natural skin exposure, 5600K daylight balanced white balance",
            "neutral": "consistent calibrated studio key lighting, even balanced studio illumination, natural skin exposure, 5600K daylight balanced white balance"
        }
        
        if base_avatar_bytes:
            # Calculate aspect ratio from custom setting or dimensions
            if request.aspect_ratio:
                aspect_ratio = request.aspect_ratio
            else:
                aspect_ratio_map = {
                    (1024, 1024): "1:1",
                    (1920, 1080): "16:9",
                    (1080, 1920): "9:16",
                    (1280, 960): "4:3",
                    (960, 1280): "3:4",
                }
                aspect_ratio = aspect_ratio_map.get((request.width, request.height), "16:9")

            if is_free_tier:
                # ── FREE TIER FACE CLONING: FLUX Kontext Pro ($0.04/image) ───────────
                # When a free-tier user provides an uploaded/captured photo, route through
                # edit_image() using flux-kontext-pro in image-to-image mode.
                logger.info(f"[Podcast] Free tier user with base avatar — using FLUX Kontext Pro img2img edit for scene {request.scene_id}")

                scene_emotion = (request.scene_emotion or "neutral").lower().strip()
                _camera_angle_map = {
                    "wide_shot": ["wide shot", "full body visible", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                    "medium_shot": ["medium shot", "chest-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                    "close_up": ["medium close-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered composition", "35mm equivalent"],
                    "over_shoulder": ["three-quarter angle shot", "slight side angle view of host", "unobstructed clear view of host, no foreground occlusions", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "35mm equivalent"],
                }
                scene_camera_angle = (request.camera_angle or "medium_shot").strip()
                framing_directives = _camera_angle_map.get(scene_camera_angle, _camera_angle_map["medium_shot"])

                if request.custom_prompt:
                    image_prompt = request.custom_prompt
                else:
                    edit_prompt_parts = []
                    # 1. Host facial expression
                    edit_prompt_parts.append(emotion_expression.get(scene_emotion, emotion_expression["neutral"]))

                    # 2. Bounded lighting (background-only, calibrated subject exposure)
                    lighting_tone = emotion_lighting.get(scene_emotion, emotion_lighting["neutral"])
                    if request.visual_atmosphere and request.visual_atmosphere.strip():
                        edit_prompt_parts.append(
                            f"Lighting: {lighting_tone}, subtle background ambience: {request.visual_atmosphere.strip()}, constant subject exposure across scenes"
                        )
                    else:
                        edit_prompt_parts.append(f"Lighting: {lighting_tone}")

                    # 3. Camera framing
                    edit_prompt_parts.extend(framing_directives)

                    # 4. Identity & studio consistency directives
                    edit_prompt_parts.extend([
                        "Keep the presenter's exact appearance, identical skin tone, identical face, identical hair, identical wardrobe",
                        "Consistent color calibration, natural skin tone preservation, constant subject exposure and white balance",
                        "Professional modern podcast studio background, professional condenser microphone on boom arm",
                        "16:9 aspect ratio, professional broadcast quality, no text, no logos",
                    ])
                    image_prompt = ", ".join(edit_prompt_parts)

                logger.info(f"[Podcast] Free-tier face clone edit prompt (len={len(image_prompt)}): {image_prompt[:120]}...")

                from services.llm_providers.main_image_editing import edit_image
                try:
                    result = edit_image(
                        input_image_bytes=base_avatar_bytes,
                        prompt=image_prompt,
                        options={
                            "provider": "wavespeed",
                            "model": "flux-kontext-pro",
                            "aspect_ratio": aspect_ratio,
                            "guidance_scale": 3.5,
                            "width": request.width,
                            "height": request.height,
                        },
                        user_id=user_id,
                    )
                    logger.info(f"[Podcast] ✅ Successfully generated free-tier face-cloned scene image via FLUX Kontext Pro")
                except HTTPException as http_err:
                    logger.error(f"[Podcast] ❌ Free-tier FLUX edit HTTPException: {http_err.status_code} - {http_err.detail}")
                    raise
                except Exception as edit_error:
                    logger.error(f"[Podcast] ❌ Free-tier FLUX edit failed: {edit_error}", exc_info=True)
                    raise HTTPException(
                        status_code=502,
                        detail={
                            "error": "Face-cloned image generation failed",
                            "message": f"Failed to generate face-cloned image: {str(edit_error)}",
                            "retry_recommended": True,
                        },
                    )
            else:
                # ── PATH A: Pro / Paid Tier Character Generation via Ideogram Character ($0.10/$0.20) ──
                # Use Ideogram Character API for consistent character generation
                # Use custom prompt if provided, otherwise build scene-specific prompt
                if request.custom_prompt:
                    # User provided custom prompt - use it directly
                    image_prompt = request.custom_prompt
                    logger.info(f"[Podcast] Using custom prompt from user for scene {request.scene_id}")
                else:
                    # Build scene-specific prompt that respects the base avatar & fixed studio session
                    prompt_parts = []
                    
                    # 1. Host appearance character lock (consistent visual subject, locked skin tone, and locked wardrobe)
                    character_desc = _resolve_or_create_character_lock(user_id, request, bible_obj, db)
                    prompt_parts.append(f"Host Appearance: {character_desc}, identical natural skin tone, same locked wardrobe and outfit")
                    
                    # 2. Fixed Studio Environment (Identical set and room across all scenes)
                    env_desc = bible_obj.visual_style.environment if bible_obj else "Professional modern office studio set, fixed studio room and background"
                    prompt_parts.append(f"Studio Set: {env_desc}, identical fixed studio set and background across all scenes")
                    if bible_obj:
                        prompt_parts.append(f"Style: {bible_obj.visual_style.style_preset}")

                    # 3. Dynamic Host Facial Expression (Driven by scene emotion)
                    scene_emotion = (request.scene_emotion or "neutral").lower().strip()
                    prompt_parts.append(emotion_expression.get(scene_emotion, emotion_expression["neutral"]))

                    # 4. Bounded Dynamic Lighting Tone (preserves calibrated skin exposure and white balance)
                    lighting_tone = emotion_lighting.get(scene_emotion, emotion_lighting["neutral"])
                    if request.visual_atmosphere and request.visual_atmosphere.strip():
                        prompt_parts.append(f"Lighting: {lighting_tone}, subtle background ambience: {request.visual_atmosphere.strip()}, constant subject exposure across scenes")
                    else:
                        prompt_parts.append(f"Lighting: {lighting_tone}")

                    # 5. Framing directives — driven by camera_angle from scene JSON with strong positive headroom
                    _camera_angle_map = {
                        "wide_shot": ["wide shot", "full body visible", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                        "medium_shot": ["medium shot", "chest-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                        "close_up": ["medium close-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered composition", "35mm equivalent"],
                        "over_shoulder": ["three-quarter angle shot", "slight side angle view of host", "unobstructed clear view of host, no foreground occlusions", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "35mm equivalent"],
                    }
                    scene_camera_angle = (request.camera_angle or "medium_shot").strip()
                    framing_directives = _camera_angle_map.get(scene_camera_angle, _camera_angle_map["medium_shot"])
                    prompt_parts.extend(framing_directives)

                    # 6. Technical & Quality Requirements
                    prompt_parts.extend([
                        "16:9 aspect ratio, video-optimized composition",
                        "generous headroom above hair, full hairstyle in frame",
                        "shoulders and chest visible, not cropped",
                        "center-focused composition",
                        "consistent color calibration, natural skin tone preservation, constant subject exposure and white balance across scenes",
                        "continuous podcast recording session in same studio room, high resolution, sharp focus, professional photography quality"
                    ])
                    
                    image_prompt = ", ".join(prompt_parts)
                
                logger.info(f"[Podcast] Using Ideogram Character for scene {request.scene_id} with base avatar")
                logger.info(f"[Podcast] Scene prompt: {image_prompt[:150]}...")
                
                # Use centralized character image generation with subscription checks and tracking
                # Use custom settings if provided, otherwise use defaults
                style = request.style or "Realistic"  # Default to Realistic for professional podcast presenters
                rendering_speed = request.rendering_speed or "Quality"  # Default to Quality for podcast videos
                
                logger.info(f"[Podcast] Ideogram Character settings: style={style}, rendering_speed={rendering_speed}, aspect_ratio={aspect_ratio}")
                
                try:
                    image_bytes = generate_character_image(
                        prompt=image_prompt,
                        reference_image_bytes=base_avatar_bytes,
                        user_id=user_id,
                        style=style,
                        aspect_ratio=aspect_ratio,
                        rendering_speed=rendering_speed,
                        timeout=None,  # No timeout - poll until WaveSpeed says it's done or failed
                    )
                    
                    # Create result object compatible with ImageGenerationResult
                    from services.llm_providers.image_generation.base import ImageGenerationResult
                    result = ImageGenerationResult(
                        image_bytes=image_bytes,
                        provider="wavespeed",
                        model="ideogram-ai/ideogram-character",
                        width=request.width,
                        height=request.height,
                    )
                    
                    logger.info(f"[Podcast] ✅ Successfully generated character-consistent scene image")
                except HTTPException as http_err:
                    # Re-raise HTTPExceptions from wavespeed client as-is
                    logger.error(f"[Podcast] ❌ Ideogram Character HTTPException: {http_err.status_code} - {http_err.detail}")
                    raise
                except Exception as char_error:
                    error_msg = str(char_error)
                    error_type = type(char_error).__name__
                    logger.error(f"[Podcast] ❌ Ideogram Character failed: {error_type}: {error_msg}", exc_info=True)
                    
                    # If Ideogram Character fails, we should NOT fall back to standard generation
                    # because that would lose character consistency. Instead, raise an error.
                    # However, if it's a timeout/connection issue, we can provide a helpful message.
                    error_msg_lower = error_msg.lower()
                    if "timeout" in error_msg_lower or "connection" in error_msg_lower or "504" in error_msg:
                        raise HTTPException(
                            status_code=504,
                            detail={
                                "error": "Image generation service unavailable",
                                "message": "The character-consistent image generation service is currently unavailable. Please try again in a few moments. If the problem persists, the service may be experiencing high load.",
                                "retry_recommended": True,
                            },
                        )
                    else:
                        raise HTTPException(
                            status_code=502,
                            detail={
                                "error": "Character-consistent image generation failed",
                                "message": f"Failed to generate image with character consistency: {error_msg}",
                                "retry_recommended": True,
                            },
                        )
        
        # CRITICAL: If base_avatar_url was provided but we don't have base_avatar_bytes,
        # this means either loading failed (already raised error) or Ideogram Character failed (already raised error)
        # So this path should only be reached if NO base_avatar_url was provided in the first place
        if not base_avatar_bytes:
            # ── PATH B: FLUX studio generation ───────────────────────────────
            # Attempt to load a persisted presenter reference image for img2img anchoring.
            # If the reference exists, we use FLUX Kontext Pro image edit (identity-preserving)
            # with a minimal scene-specific prompt (framing + emotion only).
            # If no reference exists yet, we fall back to the full text-only prompt path.
            presenter_ref_bytes = _resolve_presenter_reference_image(
                user_id=user_id,
                project_id=request.project_id,
                db=db,
            )

            # ── Build scene-specific prompt parts (framing + emotion) ─────────
            # These are used regardless of whether we have a reference image.
            scene_emotion = (request.scene_emotion or "neutral").lower().strip()
            _camera_angle_map = {
                "wide_shot": ["wide shot", "full body visible", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                "medium_shot": ["medium shot", "chest-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered vertical-third", "35mm equivalent"],
                "close_up": ["medium close-up portrait", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "centered composition", "35mm equivalent"],
                "over_shoulder": ["three-quarter angle shot", "slight side angle view of host", "unobstructed clear view of host, no foreground occlusions", "generous headroom above hair", "entire head and complete hairstyle fully visible with clearance above the frame", "shoulders and chest visible, not cropped", "35mm equivalent"],
            }
            scene_camera_angle = (request.camera_angle or "medium_shot").strip()
            framing_directives = _camera_angle_map.get(scene_camera_angle, _camera_angle_map["medium_shot"])

            if presenter_ref_bytes:
                # ── PATH B1: img2img via FLUX Kontext Pro edit endpoint ──────
                # Identity is anchored by the reference image — prompt covers only framing
                # and expression so the model does NOT resample identity from text.
                logger.info(
                    f"[Podcast] PATH B1 (img2img) for scene {request.scene_id} "
                    f"using reference image ({len(presenter_ref_bytes)} bytes)"
                )
                edit_prompt_parts = []

                # Expression driven by scene emotion
                edit_prompt_parts.append(emotion_expression.get(scene_emotion, emotion_expression["neutral"]))

                # Bounded lighting (background-only, calibrated subject exposure)
                lighting_tone = emotion_lighting.get(scene_emotion, emotion_lighting["neutral"])
                if request.visual_atmosphere and request.visual_atmosphere.strip():
                    edit_prompt_parts.append(
                        f"Lighting: {lighting_tone}, subtle background ambience: {request.visual_atmosphere.strip()}, constant subject exposure across scenes"
                    )
                else:
                    edit_prompt_parts.append(f"Lighting: {lighting_tone}")

                # Camera framing
                edit_prompt_parts.extend(framing_directives)

                # Anchoring directives — tell the model to preserve the reference identity
                edit_prompt_parts.extend([
                    "Keep the presenter's exact appearance, identical skin tone, identical face, identical hair, identical wardrobe",
                    "Consistent color calibration, natural skin tone preservation, constant subject exposure and white balance",
                    "16:9 aspect ratio, professional broadcast quality, no text, no logos",
                ])

                image_prompt = ", ".join(edit_prompt_parts)
                logger.info(f"[Podcast] PATH B1 edit prompt (len={len(image_prompt)}): {image_prompt[:120]}...")

                # Encode reference image as base64 for generate_image_edit
                ref_b64 = base64.b64encode(presenter_ref_bytes).decode("utf-8")

                from services.llm_providers.image_generation.edit import generate_image_edit
                result = generate_image_edit(
                    image_base64=ref_b64,
                    prompt=image_prompt,
                    operation="general_edit",
                    model="flux-kontext-pro",
                    options={
                        "provider": "wavespeed",
                        "guidance_scale": 3.5,  # Default: preserves reference identity
                        "width": request.width,
                        "height": request.height,
                    },
                    user_id=user_id,
                )

            else:
                # ── PATH B2: text-only generation (no reference image yet) ───
                # Full character description needed to establish visual identity from scratch.
                logger.info(f"[Podcast] PATH B2 (text-only) for scene {request.scene_id} — no reference image available yet")
                prompt_parts = []

                # 1. Host appearance character lock (full description needed)
                character_desc = _resolve_or_create_character_lock(user_id, request, bible_obj, db)
                prompt_parts.append(f"Host Appearance: {character_desc}, identical natural skin tone, same locked wardrobe and outfit")

                # 2. Fixed Studio environment and visual style (identical set across all scenes)
                env_desc = bible_obj.visual_style.environment if bible_obj else "Professional modern office studio set, fixed studio room and background"
                prompt_parts.append(f"Studio Set: {env_desc}, identical fixed background set across all scenes")
                if bible_obj:
                    prompt_parts.append(f"Style: {bible_obj.visual_style.style_preset}")
                else:
                    prompt_parts.extend([
                        "Professional podcast recording studio",
                        "Modern minimalist studio background"
                    ])

                # 3. Dynamic Host Facial Expression (Driven by scene emotion)
                prompt_parts.append(emotion_expression.get(scene_emotion, emotion_expression["neutral"]))

                # 4. Bounded Dynamic Lighting Tone (preserves calibrated skin exposure and white balance)
                lighting_tone = emotion_lighting.get(scene_emotion, emotion_lighting["neutral"])
                if request.visual_atmosphere and request.visual_atmosphere.strip():
                    prompt_parts.append(f"Lighting: {lighting_tone}, subtle background ambience: {request.visual_atmosphere.strip()}, constant subject exposure across scenes")
                else:
                    prompt_parts.append(f"Lighting: {lighting_tone}")

                # 5. Framing directives
                prompt_parts.extend(framing_directives)

                # Technical requirements for video generation
                prompt_parts.extend([
                    "16:9 aspect ratio optimized for video",
                    "Center-focused composition for talking avatar overlay",
                    "Neutral color palette with professional tones",
                    "High resolution, sharp focus, professional photography quality",
                    "No text, no logos, no distracting elements",
                    "Consistent color calibration, natural skin tone preservation, constant subject exposure and white balance across scenes",
                    "Suitable for InfiniteTalk video generation with animated avatar",
                    "Continuous podcast recording session in same studio room with identical background set"
                ])

                # Style constraints
                if not bible_obj:
                    prompt_parts.extend([
                        "Realistic photography style, not illustration or cartoon",
                        "Professional broadcast quality",
                        "Clean composition with breathing room for avatar placement"
                    ])

                image_prompt = ", ".join(prompt_parts)
                logger.info(f"[Podcast] PATH B2 text-only prompt (len={len(image_prompt)}): {image_prompt[:80]}...")

                # Generate image using main_image_generation service
                image_options = {
                    "provider": None,  # Auto-select provider
                    "width": request.width,
                    "height": request.height,
                    "negative_prompt": "cropped head, cropped face, cut off forehead, cut off chin, out of frame, close-up crop, extreme close-up, distorted features, extra limbs, disfigured, low quality, blurry, watermark, text, logo",
                }

                result = generate_image(
                    prompt=image_prompt,
                    options=image_options,
                    user_id=user_id
                )


        # Save image to podcast images directory (workspace-aware)
        images_dir = get_podcast_media_dir("image", user_id, ensure_exists=True)

        # Generate filename
        clean_title = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in request.scene_title[:30])
        unique_id = str(uuid.uuid4())[:8]
        image_filename = f"scene_{request.scene_id}_{clean_title}_{unique_id}.png"
        image_path = images_dir / image_filename

        # Save image
        with open(image_path, "wb") as f:
            f.write(result.image_bytes)

        logger.info(f"[Podcast] Saved image to: {image_path}")

        # Create image URL (served via API endpoint)
        image_url = f"/api/podcast/images/{image_filename}"

        # Estimate cost (rough estimate: ~$0.04 per image for most providers, ~$0.10 for Ideogram Character)
        # Note: Actual usage tracking is handled by centralized generate_image()/generate_character_image() functions
        cost = 0.10 if result.provider == "wavespeed" and result.model == "ideogram-ai/ideogram-character" else 0.04

        # Save to asset library
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="image",
                source_module="podcast_maker",
                filename=image_filename,
                file_url=image_url,
                file_path=str(image_path),
                file_size=len(result.image_bytes),
                mime_type="image/png",
                title=f"{request.scene_title} - Podcast Scene",
                description=f"Podcast scene image: {request.scene_title}",
                prompt=image_prompt,
                tags=["podcast", "scene", request.scene_id],
                provider=result.provider,
                model=result.model,
                asset_metadata={
                    "scene_id": request.scene_id,
                    "scene_title": request.scene_title,
                    "status": "completed",
                },
            )
        except Exception as e:
            logger.warning(f"[Podcast] Failed to save image asset: {e}")

        return PodcastImageResponse(
            scene_id=request.scene_id,
            scene_title=request.scene_title,
            image_filename=image_filename,
            image_url=image_url,
            width=result.width,
            height=result.height,
            provider=result.provider,
            model=result.model,
            cost=cost,
            image_prompt=image_prompt,
        )

    except HTTPException:
        # Re-raise HTTPExceptions as-is (they already have proper error details)
        raise
    except Exception as exc:
        # Log the full exception for debugging
        error_msg = str(exc)
        error_type = type(exc).__name__
        logger.opt(exception=True).error("[Podcast] Image generation failed: {}: {}", error_type, error_msg)
        
        # Create a safe error detail
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Image generation failed",
                "message": error_msg,
                "type": error_type,
            }
        )


@router.get("/images/{path:path}")
async def serve_podcast_image(
    path: str,  # Changed from filename to path to support subdirectories
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
):
    """Serve generated podcast scene images and avatars.
    
    Supports authentication via Authorization header or token query parameter.
    Query parameter is useful for HTML elements like <img> that cannot send custom headers.
    Supports subdirectories like avatars/
    """
    user_id = require_authenticated_user(current_user)
    
    # Security check: ensure path doesn't contain path traversal or absolute paths
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    
    images_dir = get_podcast_media_dir("image", user_id)
    image_path = (images_dir / path).resolve()
    
    # Security check: ensure resolved path is within images_dir
    if not str(image_path).startswith(str(images_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(image_path, media_type="image/png")

