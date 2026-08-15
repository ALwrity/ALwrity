"""
Step 4 Persona Test Drive Routes

Side-by-side "test with your data" endpoints for the onboarding persona
step: text (with/without brand voice), voice (synthesize with the stored
voice clone), and image (platform-tuned avatar variation).

Extracted from step4_persona_routes.py so the test-drive router can be
mounted independently of the persona generation router.
"""

import asyncio
import time
from collections import defaultdict
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from loguru import logger
from sqlalchemy import desc

from middleware.auth_middleware import get_current_user
from services.database import get_session_for_user
from models.content_asset_models import ContentAsset, AssetType, AssetSource
from services.llm_providers.main_audio_generation import generate_audio
from services.llm_providers.main_image_generation import generate_image_variation
from services.llm_providers.main_text_generation import llm_text_gen
from utils.asset_tracker import save_asset_to_library
from utils.file_storage import save_file_safely, generate_unique_filename
from utils.storage_paths import get_user_workspace

from .step4_persona_routes import _extract_user_id

router = APIRouter()


# ---------------------------------------------------------------------------
# Server-side session caps (defense-in-depth)
#
# The frontend enforces per-session caps in sessionStorage (Text 5, Image 3);
# these mirror them server-side so the limits can't be bypassed by clearing
# client state, and add a Voice cap. State is in-memory and transient by
# design (resets on process restart). A DB-backed store can replace this later.
# ---------------------------------------------------------------------------
TEST_DRIVE_LIMITS = {"text": 5, "image": 3, "voice": 5}
TEST_DRIVE_WINDOW_SECONDS = 24 * 60 * 60

_test_drive_usage: Dict[str, List[float]] = defaultdict(list)


def _prune_bucket(key: str, now: float) -> List[float]:
    return [t for t in _test_drive_usage.get(key, []) if now - t < TEST_DRIVE_WINDOW_SECONDS]


def _test_drive_limit_hit(user_id: str, feature: str) -> bool:
    """True when the user has already hit the cap for ``feature`` (non-mutating)."""
    limit = TEST_DRIVE_LIMITS.get(feature)
    if limit is None:
        return False
    key = f"{user_id}:{feature}"
    bucket = _prune_bucket(key, time.time())
    _test_drive_usage[key] = bucket
    return len(bucket) >= limit


def _record_test_drive_usage(user_id: str, feature: str) -> None:
    """Record a successful test-drive generation (matches client success counting)."""
    _test_drive_usage[f"{user_id}:{feature}"].append(time.time())


def _rate_limit_response(feature: str) -> Dict[str, Any]:
    limit = TEST_DRIVE_LIMITS.get(feature, 0)
    return {
        "success": False,
        "message": (
            f"You've reached the {limit} per-session limit for {feature} test drives. "
            "Please try again later."
        ),
        "error": "rate_limit_reached",
    }


class TestTextRequest(BaseModel):
    """Request body for /step4/test-text — side-by-side text generation."""
    prompt: str
    persona: Dict[str, Any] = {}
    platform: Optional[str] = "blog"


class TestVoiceRequest(BaseModel):
    """Request body for /step4/test-voice — synthesize new text with stored voice clone."""
    text: str


class TestImageRequest(BaseModel):
    """Request body for /step4/test-image — platform-tuned avatar variation."""
    platform: str
    prompt_override: Optional[str] = None


@router.post("/step4/test-voice", response_model=Dict[str, Any])
async def test_voice_with_clone(
    request: TestVoiceRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Synthesize user-provided text using their stored voice clone.

    Looks up the user's most recent voice_clone asset and reuses its
    `custom_voice_id` + `engine` to call the existing `generate_audio`
    provider. Returns the synthesized audio as a URL the browser can
    play (or as base64 if the provider returned inline data).
    """
    try:
        user_id = _extract_user_id(current_user)
        text = (request.text or "").strip()

        if not text:
            return {"success": False, "message": "Please type some text to read.", "error": "empty_text"}
        if len(text) > 500:
            return {
                "success": False,
                "message": "Text is too long. Please keep it under 500 characters for the test drive.",
                "error": "text_too_long",
            }

        # Look up the user's latest voice clone asset
        db = get_session_for_user(user_id)
        if not db:
            return {"success": False, "message": "Could not connect to database.", "error": "db_unavailable"}

        try:
            asset = (
                db.query(ContentAsset)
                .filter(
                    ContentAsset.user_id == user_id,
                    ContentAsset.asset_type == AssetType.AUDIO,
                    ContentAsset.source_module == AssetSource.VOICE_CLONER,
                )
                .order_by(desc(ContentAsset.created_at))
                .first()
            )

            if not asset:
                return {
                    "success": False,
                    "message": "No voice clone found. Generate a voice clone first.",
                    "error": "no_voice_clone",
                }

            meta = asset.asset_metadata or {}
            custom_voice_id = meta.get("custom_voice_id")
            engine = meta.get("engine") or "qwen3"

            if not custom_voice_id:
                return {
                    "success": False,
                    "message": "Your voice clone is missing a reusable voice ID. Please re-create the voice clone.",
                    "error": "missing_voice_id",
                }
        finally:
            db.close()

        if _test_drive_limit_hit(user_id, "voice"):
            return _rate_limit_response("voice")

        logger.info(
            f"[test-voice] Synthesizing with voice_id={custom_voice_id} engine={engine} text_len={len(text)} user={user_id}"
        )
        result = generate_audio(
            text=text,
            custom_voice_id=custom_voice_id,
            model="speech-02-hd" if engine == "minimax" else "alwrity-ai/qwen3-tts",
            user_id=user_id,
        )

        audio_url: Optional[str] = None
        audio_base64: Optional[str] = None
        audio_format: Optional[str] = None

        if isinstance(result, dict):
            audio_url = (
                result.get("audio_url")
                or result.get("url")
                or result.get("preview_audio_url")
            )
            audio_base64 = result.get("audio_base64")
            audio_format = result.get("format")
        elif isinstance(result, (bytes, bytearray)):
            import base64
            audio_base64 = base64.b64encode(bytes(result)).decode("ascii")
            audio_format = "audio/mpeg"

        if not audio_url and not audio_base64:
            return {
                "success": False,
                "message": "Voice synthesis completed but no audio was returned. Please try again.",
                "error": "empty_audio",
            }

        _record_test_drive_usage(user_id, "voice")

        return {
            "success": True,
            "audio_url": audio_url,
            "audio_base64": audio_base64,
            "format": audio_format,
            "engine": engine,
            "voice_id": custom_voice_id,
        }

    except HTTPException:
        raise
    except RuntimeError as re:
        msg = str(re)
        logger.warning(f"[test-voice] runtime error: {msg}")
        return {"success": False, "message": msg, "error": "runtime_error"}
    except Exception as e:
        logger.error(f"[test-voice] Error: {e}", exc_info=True)
        return {
            "success": False,
            "message": "We hit a snag while synthesizing the audio. Please try again.",
            "error": "internal_error",
        }


# ---------------------------------------------------------------------------
# Platform-tuned image prompts (hardcoded for the test drive)
# ---------------------------------------------------------------------------
PLATFORM_IMAGE_PROMPTS = {
    'blog':      'professional blog header, modern flat design, brand colors, includes space for headline text',
    'podcast':   'square podcast cover art, bold typography, eye-catching, brand identity',
    'youtube':   'youtube thumbnail style, dramatic lighting, expressive, brand-aligned, 16:9 cinematic',
    'instagram': 'instagram post, lifestyle aesthetic, modern, brand colors, square 1:1',
    'linkedin':  'linkedin banner, professional, clean, corporate-friendly, wide format',
    'twitter':   'twitter header, minimal, brand-aligned, attention-grabbing',
}

PLATFORM_ASPECT_RATIOS = {
    'blog':      '16:9',
    'podcast':   '1:1',
    'youtube':   '16:9',
    'instagram': '1:1',
    'linkedin':  '16:9',
    'twitter':   '16:9',
}


@router.post("/step4/test-image", response_model=Dict[str, Any])
async def test_image_variation(
    request: TestImageRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate a platform-tuned avatar variation for the user.

    Looks up the user's most recent brand_avatar asset, reads its file,
    and calls `generate_image_variation` with a hardcoded platform prompt.
    Returns the variation as base64 (so the browser can render it directly
    without an extra round-trip). Cap is enforced client-side (3 per session).
    """
    import base64 as _b64
    from pathlib import Path as _Path

    try:
        user_id = _extract_user_id(current_user)
        platform = (request.platform or "").strip().lower()

        if platform not in PLATFORM_IMAGE_PROMPTS:
            return {
                "success": False,
                "message": f"Unsupported platform: {platform}. Use one of: {', '.join(PLATFORM_IMAGE_PROMPTS.keys())}.",
                "error": "invalid_platform",
            }

        # Look up the user's latest brand avatar
        db = get_session_for_user(user_id)
        if not db:
            return {"success": False, "message": "Could not connect to database.", "error": "db_unavailable"}

        try:
            asset = (
                db.query(ContentAsset)
                .filter(
                    ContentAsset.user_id == user_id,
                    ContentAsset.asset_type == AssetType.IMAGE,
                    ContentAsset.source_module == AssetSource.BRAND_AVATAR_GENERATOR,
                )
                .order_by(desc(ContentAsset.created_at))
                .first()
            )

            if not asset:
                # Fallback to legacy storage (story_writer + metadata category='brand_avatar')
                candidates = (
                    db.query(ContentAsset)
                    .filter(
                        ContentAsset.user_id == user_id,
                        ContentAsset.asset_type == AssetType.IMAGE,
                        ContentAsset.source_module == AssetSource.STORY_WRITER,
                    )
                    .order_by(desc(ContentAsset.created_at))
                    .limit(20)
                    .all()
                )
                for c in candidates:
                    meta = c.asset_metadata or {}
                    if meta.get('category') == 'brand_avatar':
                        asset = c
                        break

            if not asset or not asset.file_path:
                return {
                    "success": False,
                    "message": "No brand avatar found. Generate a brand visual first.",
                    "error": "no_brand_avatar",
                }

            avatar_path = _Path(asset.file_path)
            if not avatar_path.exists():
                # Try resolving relative to workspace
                avatar_path = get_user_workspace(user_id) / asset.file_path
            if not avatar_path.exists():
                return {
                    "success": False,
                    "message": "Could not read your stored brand avatar. Please regenerate it.",
                    "error": "avatar_file_missing",
                }

            avatar_bytes = avatar_path.read_bytes()
            base_prompt = (asset.prompt or asset.asset_metadata.get('prompt', '') if asset.asset_metadata else '') or ''
        finally:
            db.close()

        # Build the platform-tuned prompt
        platform_prompt = PLATFORM_IMAGE_PROMPTS[platform]
        if base_prompt:
            final_prompt = f"{base_prompt}, {platform_prompt}"
        else:
            final_prompt = platform_prompt
        if request.prompt_override:
            final_prompt = f"{final_prompt}, {request.prompt_override}"

        aspect_ratio = PLATFORM_ASPECT_RATIOS[platform]

        if _test_drive_limit_hit(user_id, "image"):
            return _rate_limit_response("image")

        logger.info(
            f"[test-image] Generating {platform} variation for user {user_id} (avatar bytes={len(avatar_bytes)})"
        )

        # Reuse the existing variation flow (subscription/usage tracking included)
        result = await generate_image_variation(
            image=avatar_bytes,
            prompt=final_prompt,
            user_id=user_id,
            aspect_ratio=aspect_ratio,
        )

        if not result.get("success"):
            return {
                "success": False,
                "message": result.get("error", "Image variation failed."),
                "error": "image_variation_failed",
            }

        image_base64 = result.get("image_base64")
        if not image_base64:
            return {
                "success": False,
                "message": "No image was returned. Please try again.",
                "error": "empty_image",
            }

        # Persist the variation so it can be reused later (e.g. in podcast/youtube)
        image_url = None
        try:
            import base64 as __b64
            image_bytes_out = __b64.b64decode(image_base64)
            filename = generate_unique_filename(f"avatar_{platform}", "png")
            user_assets_dir = get_user_workspace(user_id) / "assets" / "avatars"
            saved_path, error = save_file_safely(
                image_bytes_out, user_assets_dir, filename
            )
            if not error and saved_path:
                image_url = f"/api/assets/{user_id}/avatars/{filename}"
                save_db = get_session_for_user(user_id)
                if save_db:
                    try:
                        save_asset_to_library(
                            db=save_db,
                            user_id=user_id,
                            asset_type="image",
                            source_module="brand_avatar_variation",
                            filename=filename,
                            file_url=image_url,
                            file_path=str(saved_path),
                            prompt=final_prompt,
                            asset_metadata={
                                "category": "brand_avatar_variation",
                                "platform": platform,
                                "source_avatar_id": asset.id,
                            },
                        )
                    finally:
                        save_db.close()
        except Exception as persist_err:
            # Non-blocking — return the variation even if we couldn't persist it
            logger.warning(f"[test-image] Could not persist variation: {persist_err}")
            image_url = None

        _record_test_drive_usage(user_id, "image")

        return {
            "success": True,
            "image_base64": image_base64,
            "image_url": image_url,
            "format": "image/png",
            "platform": platform,
            "prompt": final_prompt,
        }

    except HTTPException:
        raise
    except RuntimeError as re:
        msg = str(re)
        logger.warning(f"[test-image] runtime error: {msg}")
        return {"success": False, "message": msg, "error": "runtime_error"}
    except Exception as e:
        logger.error(f"[test-image] Error: {e}", exc_info=True)
        return {
            "success": False,
            "message": "We hit a snag while generating the image. Please try again.",
            "error": "internal_error",
        }


# ---------------------------------------------------------------------------
# Helpers for /test-text (build a concise system prompt from the persona)
# ---------------------------------------------------------------------------
def _persona_to_system_prompt(persona: Dict[str, Any], platform: str) -> str:
    """
    Convert a core persona dict into a short system prompt for the
    "with voice" branch of /test-text.

    Reads the new schema (identity / linguistic_fingerprint / tonal_range /
    evidence) and grounds the system prompt in real fields — no generic
    fallbacks like "confident, warm" or "the brand's expert voice" if
    those fields weren't actually populated.

    Reads from BOTH the new schema (`identity.*`, `tonal_range.default_tone`,
    `linguistic_fingerprint.lexical_features.go_to_phrases`) AND the
    legacy schema (`writing_style.*`, `brand_voice.tone`) for backward
    compatibility with personas generated before the schema upgrade.
    """
    if not persona:
        return (
            "You are a careful copywriter. You don't have a specific brand "
            f"voice to mimic, so write in plain, direct language for {platform}. "
            "Be specific. Avoid clichés and generic AI-speak."
        )

    identity = persona.get("identity") or {}
    ling = persona.get("linguistic_fingerprint") or {}
    tonal = persona.get("tonal_range") or {}
    evidence = persona.get("evidence") or {}

    # NEW schema fields
    persona_name = identity.get("persona_name")
    archetype = identity.get("archetype")
    core_belief = identity.get("core_belief")
    brand_voice_desc = identity.get("brand_voice_description")
    default_tone = tonal.get("default_tone")
    new_go_to_phrases = (
        ling.get("lexical_features", {}).get("go_to_phrases") or []
    )
    new_avoid = ling.get("lexical_features", {}).get("avoid_words") or []
    new_vocab = ling.get("lexical_features", {}).get("vocabulary_level")
    new_sentence = ling.get("sentence_metrics", {}).get("preferred_sentence_type")

    # LEGACY schema fields (for backward compat)
    legacy_brand_voice = persona.get("brand_voice") or {}
    legacy_writing_style = persona.get("writing_style") or {}
    legacy_tone = legacy_brand_voice.get("tone")
    legacy_vocab = (
        legacy_writing_style.get("vocabulary")
        or legacy_writing_style.get("vocabulary_level")
    )
    legacy_sentence = legacy_writing_style.get("sentence_structure")

    # Prefer new schema, fall back to legacy
    tone = default_tone or legacy_tone
    vocabulary = new_vocab or legacy_vocab
    sentence_style = new_sentence or legacy_sentence
    go_to_phrases = list(new_go_to_phrases) if new_go_to_phrases else []

    # If persona is meaningfully empty, refuse to fake it.
    meaningful_fields = [persona_name, archetype, core_belief, tone, vocabulary, sentence_style, brand_voice_desc]
    meaningful = [f for f in meaningful_fields if f and str(f).strip()]
    if len(meaningful) < 2:
        return (
            "You are a careful copywriter. The brand voice data you have is too thin "
            f"to mimic specifically, so write in plain, direct language for {platform}. "
            "Be specific. Avoid clichés and generic AI-speak."
        )

    parts: List[str] = []

    # Identity
    if persona_name or archetype:
        who = persona_name or archetype
        role = archetype if persona_name and archetype else None
        if who and role:
            parts.append(f"You write as {who} — {role}.")
        else:
            parts.append(f"You write as {who}.")
    if core_belief:
        parts.append(f"Your core belief: {core_belief}.")
    if brand_voice_desc:
        parts.append(f"Voice in plain terms: {brand_voice_desc}")

    # Tone + style
    if tone:
        parts.append(f"Tone: {tone}.")
    if vocabulary:
        parts.append(f"Vocabulary: {vocabulary}.")
    if sentence_style:
        parts.append(f"Sentence style: {sentence_style}.")

    # Lexical features (verbatim phrases from the brand's own content)
    if go_to_phrases:
        phrase_list = "; ".join(f'"{p}"' for p in go_to_phrases[:6])
        parts.append(f"Go-to phrases (use these in your output): {phrase_list}.")
    if new_avoid:
        avoid_list = ", ".join(new_avoid[:8])
        parts.append(f"Words/phrases to avoid: {avoid_list}.")

    # Evidence-grounded reminder
    if evidence:
        archetype_basis = evidence.get("archetype_basis")
        if archetype_basis and archetype and archetype_basis != "null":
            parts.append(
                f'You were assigned the archetype "{archetype}" because: {archetype_basis}'
            )

    parts.append(
        f"Keep the output natural for {platform}. Open with a hook. Be specific, not generic. "
        "Avoid corporate jargon and AI-speak ('innovative', 'cutting-edge', 'leverage' — unless the persona explicitly uses them)."
    )
    return " ".join(parts)


def _generic_system_prompt(platform: str) -> str:
    """Generic AI assistant system prompt for the 'without voice' branch."""
    return (
        f"You are a helpful AI assistant. Write a {platform} post that is professional, "
        "informative, and on-brand for a typical business. Use natural, varied sentence lengths."
    )


@router.post("/step4/test-text", response_model=Dict[str, Any])
async def test_text_with_persona(
    request: TestTextRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate text with and without the persona in parallel (per design).

    The 'with_voice' branch is fed a system prompt derived from the user's
    core persona (archetype, core_belief, tone, vocabulary, sentence style).
    The 'without_voice' branch is given a generic system prompt.
    Both calls go through `llm_text_gen` which handles provider routing
    (GPT_PROVIDER), subscription checks, and usage tracking.
    """
    try:
        user_id = _extract_user_id(current_user)
        prompt = (request.prompt or "").strip()
        platform = (request.platform or "blog").strip().lower() or "blog"
        persona = request.persona or {}

        if not prompt:
            return {
                "success": False,
                "message": "Please type a prompt first.",
                "error": "empty_prompt",
            }
        if len(prompt) > 1000:
            return {
                "success": False,
                "message": "Prompt is too long. Please keep it under 1000 characters.",
                "error": "prompt_too_long",
            }

        if _test_drive_limit_hit(user_id, "text"):
            return _rate_limit_response("text")

        with_voice_system = _persona_to_system_prompt(persona, platform)
        without_voice_system = _generic_system_prompt(platform)

        logger.info(
            f"[test-text] Generating 2 variants in parallel for user {user_id} "
            f"(prompt_len={len(prompt)}, platform={platform}, has_persona={bool(persona)})"
        )

        # Per design: run both calls in parallel via asyncio.gather.
        # llm_text_gen handles subscription/usage tracking internally.
        async def _gen(system_prompt: str, flow_tag: str) -> str:
            return await asyncio.to_thread(
                llm_text_gen,
                prompt=prompt,
                system_prompt=system_prompt,
                user_id=user_id,
                flow_type=flow_tag,
                max_tokens=400,
                temperature=0.7,
            )

        with_text, without_text = await asyncio.gather(
            _gen(with_voice_system, "test_drive_with_voice"),
            _gen(without_voice_system, "test_drive_without_voice"),
        )

        _record_test_drive_usage(user_id, "text")

        return {
            "success": True,
            "with_voice": with_text.strip() if with_text else "",
            "without_voice": without_text.strip() if without_text else "",
            "platform": platform,
        }

    except HTTPException:
        raise
    except RuntimeError as re:
        # Subscription limit / 429 from the LLM gateway
        msg = str(re)
        logger.warning(f"[test-text] runtime error: {msg}")
        return {"success": False, "message": msg, "error": "runtime_error"}
    except Exception as e:
        logger.error(f"[test-text] Error: {e}", exc_info=True)
        return {
            "success": False,
            "message": "We hit a snag while generating the text. Please try again.",
            "error": "internal_error",
        }
