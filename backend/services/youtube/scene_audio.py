"""
YouTube scene audio helpers for video rendering.

Resolves narration audio for a scene by:
1) loading an existing audio URL from local disk / asset library, or
2) generating new audio when enabled.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.scene_audio")

_REPO_ROOT = Path(__file__).resolve().parents[3]
_LEGACY_YOUTUBE_AUDIO_DIR = _REPO_ROOT / "youtube_audio"


def resolve_scene_audio_base64(
    *,
    scene_number: int,
    scene_audio_url: Optional[str],
    narration: str,
    generate_audio_enabled: bool,
    voice_id: str,
    user_id: str,
) -> Optional[str]:
    """
    Return base64 audio for lip-sync, or None when unavailable.

    Preserves prior renderer behavior: try existing audio first, then optionally generate.
    """
    audio_base64: Optional[str] = None

    if scene_audio_url:
        try:
            audio_base64 = _load_existing_audio_base64(
                scene_number=scene_number,
                scene_audio_url=scene_audio_url,
                user_id=user_id,
            )
        except FileNotFoundError as exc:
            logger.warning(
                f"[YouTubeRenderer] ❌ Audio file not found: {exc}. "
                "Will generate new audio if enabled."
            )
            scene_audio_url = None
        except Exception as exc:
            logger.warning(
                f"[YouTubeRenderer] ❌ Failed to load existing audio: {exc}. "
                "Will generate new audio if enabled.",
                exc_info=True,
            )
            scene_audio_url = None

    if not audio_base64 and generate_audio_enabled and narration and len(narration.strip()) > 0:
        try:
            from services.llm_providers.main_audio_generation import generate_audio

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
            logger.info(f"[YouTubeRenderer] Generated new audio for scene {scene_number}")
        except Exception as exc:
            logger.warning(
                f"[YouTubeRenderer] Audio generation failed: {exc}, continuing without audio"
            )

    return audio_base64


def _load_existing_audio_base64(
    *,
    scene_number: int,
    scene_audio_url: str,
    user_id: str,
) -> str:
    """Load existing scene audio as base64 from local path or asset library."""
    logger.info(
        f"[YouTubeRenderer] Attempting to load existing audio for scene {scene_number} "
        f"from URL: {scene_audio_url}"
    )

    parsed_url = urlparse(scene_audio_url)
    audio_filename = Path(parsed_url.path).name
    youtube_audio_dir = _LEGACY_YOUTUBE_AUDIO_DIR
    audio_path = youtube_audio_dir / audio_filename

    if not audio_path.exists():
        logger.debug(
            f"[YouTubeRenderer] Audio file not found at {audio_path}. "
            "Searching for alternative matches..."
        )
        if youtube_audio_dir.exists():
            all_files = list(youtube_audio_dir.glob("*.mp3"))
            logger.debug(f"[YouTubeRenderer] Found {len(all_files)} MP3 files in directory")

            expected_parts = audio_filename.replace(".mp3", "").split("_")
            if len(expected_parts) >= 3:
                scene_num_str = expected_parts[1] if expected_parts[0] == "scene" else None
                title_part = expected_parts[2] if len(expected_parts) > 2 else None

                matching_files = []
                for file_path in all_files:
                    file_parts = file_path.stem.split("_")
                    if len(file_parts) >= 3 and file_parts[0] == "scene":
                        file_scene_num = file_parts[1]
                        file_title = file_parts[2] if len(file_parts) > 2 else ""

                        if scene_num_str:
                            scene_num_int = int(scene_num_str)
                            file_scene_int = (
                                int(file_scene_num) if file_scene_num.isdigit() else None
                            )
                            if file_scene_int in {
                                scene_num_int,
                                scene_num_int - 1,
                                scene_num_int + 1,
                            }:
                                matching_files.append(file_path.name)
                        elif title_part and title_part.lower() in file_title.lower():
                            matching_files.append(file_path.name)

                if matching_files:
                    logger.info(
                        f"[YouTubeRenderer] Found potential audio file matches for scene "
                        f"{scene_number}: {matching_files[:3]}. Expected: {audio_filename}"
                    )
                    alternative_path = youtube_audio_dir / matching_files[0]
                    if alternative_path.exists() and alternative_path.is_file():
                        logger.info(
                            f"[YouTubeRenderer] Using alternative audio file: {matching_files[0]}"
                        )
                        audio_path = alternative_path
                        audio_filename = matching_files[0]
                    else:
                        logger.warning(
                            f"[YouTubeRenderer] Alternative match found but file doesn't exist: "
                            f"{alternative_path}"
                        )
            else:
                sample_files = [
                    f.name for f in all_files[:10] if f.name.startswith("scene_")
                ]
                if sample_files:
                    logger.debug(
                        f"[YouTubeRenderer] Sample scene audio files in directory: {sample_files}"
                    )

    if audio_path.exists() and audio_path.is_file():
        with open(audio_path, "rb") as handle:
            audio_bytes = handle.read()
        audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
        logger.info(
            f"[YouTubeRenderer] ✅ Using existing audio for scene {scene_number} from local file: "
            f"{audio_filename} ({len(audio_bytes)} bytes)"
        )
        return audio_base64

    logger.warning(
        f"[YouTubeRenderer] Audio file not found locally at {audio_path}. "
        f"Attempting to load from asset library (filename: {audio_filename})"
    )

    try:
        from services.content_asset_service import ContentAssetService
        from services.database import get_session_for_user
        from models.content_asset_models import AssetType, AssetSource

        db = get_session_for_user(user_id)
        if not db:
            raise FileNotFoundError(f"Database session unavailable for user {user_id}")
        try:
            asset_service = ContentAssetService(db)
            assets = asset_service.get_assets(
                user_id=user_id,
                asset_type=AssetType.AUDIO,
                source_module=AssetSource.YOUTUBE_CREATOR,
                limit=100,
            )

            matching_asset = None
            for asset in assets:
                if asset.filename == audio_filename:
                    matching_asset = asset
                    break

            if matching_asset and matching_asset.file_path:
                asset_path = Path(matching_asset.file_path)
                if asset_path.exists() and asset_path.is_file():
                    with open(asset_path, "rb") as handle:
                        audio_bytes = handle.read()
                    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                    logger.info(
                        f"[YouTubeRenderer] ✅ Loaded audio for scene {scene_number} from asset library: "
                        f"{audio_filename} ({len(audio_bytes)} bytes)"
                    )
                    return audio_base64
                raise FileNotFoundError(
                    f"Asset library file path does not exist: {asset_path}"
                )
            raise FileNotFoundError(
                f"Audio asset not found in library for filename: {audio_filename}"
            )
        finally:
            db.close()
    except Exception as asset_error:
        logger.warning(
            f"[YouTubeRenderer] Failed to load audio from asset library: {asset_error}. "
            f"Original path attempted: {audio_path}"
        )
        raise FileNotFoundError(
            f"Audio file not found at {audio_path} and not found in asset library: {asset_error}"
        ) from asset_error
