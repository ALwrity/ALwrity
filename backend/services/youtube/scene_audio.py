"""
YouTube scene audio helpers for video rendering.

Resolves narration audio for a scene by:
1) loading an existing audio URL from canonical storage / asset library, or
2) generating new audio when enabled.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from models.content_asset_models import AssetSource, AssetType
from services.youtube.audio_storage import (
    _LEGACY_YOUTUBE_AUDIO_DIR,
    find_youtube_audio_file,
)
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_audio")


def resolve_scene_audio_base64(
    *,
    scene_number: int,
    scene_audio_url: Optional[str],
    narration: str,
    generate_audio_enabled: bool,
    voice_id: str,
    user_id: str,
    db: Optional[Session] = None,
) -> Optional[str]:
    """
    Return base64 audio for lip-sync, or None when unavailable.

    Preserves prior renderer behavior: try existing audio first, then optionally generate.
    """
    logger.debug(
        f"[YouTubeSceneAudio] resolve_scene_audio_base64 entry "
        f"(scene={scene_number}, has_url={bool(scene_audio_url)}, "
        f"generate_enabled={generate_audio_enabled}, user_id={user_id})"
    )

    audio_base64: Optional[str] = None

    if scene_audio_url:
        try:
            audio_base64 = _load_existing_audio_base64(
                scene_number=scene_number,
                scene_audio_url=scene_audio_url,
                user_id=user_id,
                db=db,
            )
        except FileNotFoundError as exc:
            logger.warning(
                f"[YouTubeSceneAudio] Scene {scene_number} audio file not found: {exc}. "
                "Will generate new audio if enabled."
            )
            scene_audio_url = None
        except OSError as exc:
            logger.error(
                f"[YouTubeSceneAudio] Scene {scene_number} audio read error: {exc}",
                exc_info=True,
            )
            scene_audio_url = None
        except Exception as exc:
            logger.warning(
                f"[YouTubeSceneAudio] Scene {scene_number} failed to load existing audio: {exc}. "
                "Will generate new audio if enabled.",
                exc_info=True,
            )
            scene_audio_url = None

    if not audio_base64 and generate_audio_enabled and narration and len(narration.strip()) > 0:
        try:
            from services.llm_providers.main_audio_generation import generate_audio

            logger.info(
                f"[YouTubeSceneAudio] Generating narration audio for scene {scene_number} "
                f"(voice_id={voice_id}, narration_length={len(narration.strip())})"
            )
            audio_result = generate_audio(
                text=narration,
                voice_id=voice_id,
                user_id=user_id,
            )
            audio_bytes = (
                audio_result.audio_bytes
                if hasattr(audio_result, "audio_bytes")
                else audio_result
            )
            audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
            logger.info(
                f"[YouTubeSceneAudio] Generated new audio for scene {scene_number} "
                f"({len(audio_bytes)} bytes)"
            )
        except Exception as exc:
            logger.warning(
                f"[YouTubeSceneAudio] Scene {scene_number} audio generation failed: {exc}; "
                "continuing without audio",
                exc_info=True,
            )

    if audio_base64:
        logger.debug(
            f"[YouTubeSceneAudio] Scene {scene_number} audio resolved "
            f"(base64_length={len(audio_base64)})"
        )
    else:
        logger.debug(
            f"[YouTubeSceneAudio] Scene {scene_number} proceeding without audio input"
        )

    return audio_base64


def _read_audio_file(audio_path: Path, *, scene_number: int, source: str) -> str:
    """Read an audio file and return base64-encoded content."""
    try:
        audio_bytes = audio_path.read_bytes()
    except OSError as exc:
        logger.error(
            f"[YouTubeSceneAudio] Failed to read audio for scene {scene_number} "
            f"from {source} ({audio_path}): {exc}",
            exc_info=True,
        )
        raise

    if not audio_bytes:
        logger.warning(
            f"[YouTubeSceneAudio] Empty audio file for scene {scene_number} "
            f"from {source}: {audio_path}"
        )

    logger.info(
        f"[YouTubeSceneAudio] Loaded audio for scene {scene_number} from {source}: "
        f"{audio_path.name} ({len(audio_bytes)} bytes)"
    )
    return base64.b64encode(audio_bytes).decode("utf-8")


def _load_existing_audio_base64(
    *,
    scene_number: int,
    scene_audio_url: str,
    user_id: str,
    db: Optional[Session] = None,
) -> str:
    """Load existing scene audio as base64 from canonical storage or asset library."""
    logger.info(
        f"[YouTubeSceneAudio] Loading existing audio for scene {scene_number} "
        f"from URL: {scene_audio_url}"
    )

    parsed_url = urlparse(scene_audio_url)
    audio_filename = Path(parsed_url.path).name
    if not audio_filename:
        raise FileNotFoundError(
            f"Could not extract audio filename from URL: {scene_audio_url}"
        )

    audio_path = find_youtube_audio_file(audio_filename, user_id=user_id, db=db)
    if audio_path and audio_path.is_file():
        return _read_audio_file(audio_path, scene_number=scene_number, source="canonical storage")

    logger.debug(
        f"[YouTubeSceneAudio] Scene {scene_number} audio not in canonical dirs; "
        f"trying legacy fuzzy match for {audio_filename}"
    )
    audio_path = _find_legacy_fuzzy_audio_match(scene_number, audio_filename)
    if audio_path and audio_path.is_file():
        return _read_audio_file(
            audio_path, scene_number=scene_number, source="legacy fuzzy match"
        )

    logger.warning(
        f"[YouTubeSceneAudio] Scene {scene_number} audio not found in storage for "
        f"{audio_filename}. Attempting asset library fallback."
    )

    audio_bytes = _load_audio_from_asset_library(audio_filename, user_id)
    if audio_bytes:
        logger.info(
            f"[YouTubeSceneAudio] Loaded audio for scene {scene_number} from asset library: "
            f"{audio_filename} ({len(audio_bytes)} bytes)"
        )
        return base64.b64encode(audio_bytes).decode("utf-8")

    raise FileNotFoundError(
        f"Audio file not found for filename {audio_filename} in storage or asset library"
    )


def _find_legacy_fuzzy_audio_match(scene_number: int, audio_filename: str) -> Optional[Path]:
    """
    Last-resort local fuzzy match against legacy repo-root youtube_audio directory.
    """
    youtube_audio_dir = _LEGACY_YOUTUBE_AUDIO_DIR
    if not youtube_audio_dir.exists():
        logger.debug(
            f"[YouTubeSceneAudio] Legacy audio dir missing for fuzzy match: {youtube_audio_dir}"
        )
        return None

    all_files = list(youtube_audio_dir.glob("*.mp3"))
    expected_parts = audio_filename.replace(".mp3", "").split("_")
    if len(expected_parts) < 3:
        logger.debug(
            f"[YouTubeSceneAudio] Skipping fuzzy match; unexpected filename format: "
            f"{audio_filename}"
        )
        return None

    scene_num_str = expected_parts[1] if expected_parts[0] == "scene" else None
    title_part = expected_parts[2] if len(expected_parts) > 2 else None
    matching_files = []

    for file_path in all_files:
        file_parts = file_path.stem.split("_")
        if len(file_parts) < 3 or file_parts[0] != "scene":
            continue

        file_scene_num = file_parts[1]
        file_title = file_parts[2] if len(file_parts) > 2 else ""

        if scene_num_str:
            try:
                scene_num_int = int(scene_num_str)
            except ValueError:
                logger.debug(
                    f"[YouTubeSceneAudio] Invalid scene number in filename: {audio_filename}"
                )
                return None

            file_scene_int = int(file_scene_num) if file_scene_num.isdigit() else None
            if file_scene_int in {scene_num_int, scene_num_int - 1, scene_num_int + 1}:
                matching_files.append(file_path.name)
        elif title_part and title_part.lower() in file_title.lower():
            matching_files.append(file_path.name)

    if not matching_files:
        logger.debug(
            f"[YouTubeSceneAudio] No fuzzy legacy audio matches for scene {scene_number}: "
            f"{audio_filename}"
        )
        return None

    alternative_path = youtube_audio_dir / matching_files[0]
    if alternative_path.exists() and alternative_path.is_file():
        logger.info(
            f"[YouTubeSceneAudio] Found fuzzy legacy audio match for scene {scene_number}: "
            f"{matching_files[0]}"
        )
        return alternative_path

    logger.warning(
        f"[YouTubeSceneAudio] Fuzzy match candidate missing on disk for scene {scene_number}: "
        f"{alternative_path}"
    )
    return None


def _load_audio_from_asset_library(filename: str, user_id: str) -> Optional[bytes]:
    """Load a YouTube Creator audio asset by filename from the content asset library."""
    from services.content_asset_service import ContentAssetService
    from services.database import get_session_for_user

    logger.debug(
        f"[YouTubeSceneAudio] Querying asset library for audio {filename!r} "
        f"(user_id={user_id})"
    )

    db = get_session_for_user(user_id)
    if not db:
        logger.warning(
            f"[YouTubeSceneAudio] Database session unavailable for user {user_id}"
        )
        return None

    try:
        asset_service = ContentAssetService(db)
        assets, total = asset_service.get_user_assets(
            user_id=user_id,
            asset_type=AssetType.AUDIO,
            source_module=AssetSource.YOUTUBE_CREATOR,
            limit=100,
        )
        logger.debug(
            f"[YouTubeSceneAudio] Asset library returned {len(assets)} audio asset(s) "
            f"(total={total}) for user {user_id}"
        )

        for asset in assets:
            if asset.filename != filename or not asset.file_path:
                continue

            asset_path = Path(asset.file_path)
            if not asset_path.exists() or not asset_path.is_file():
                logger.warning(
                    f"[YouTubeSceneAudio] Asset library path missing for {filename}: "
                    f"{asset_path}"
                )
                return None

            try:
                return asset_path.read_bytes()
            except OSError as exc:
                logger.error(
                    f"[YouTubeSceneAudio] Failed to read asset file {asset_path}: {exc}",
                    exc_info=True,
                )
                return None

        logger.debug(
            f"[YouTubeSceneAudio] No matching audio asset in library for {filename}"
        )
        return None
    except Exception as exc:
        logger.error(
            f"[YouTubeSceneAudio] Asset library lookup failed for {filename}: {exc}",
            exc_info=True,
        )
        return None
    finally:
        db.close()
