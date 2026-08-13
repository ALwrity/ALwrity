"""
YouTube audio storage helpers.

Canonical on-disk location for YouTube Creator scene narration audio:
  {user_workspace}/media/youtube_audio/

Falls back to the global YouTube media dir and legacy repo-root youtube_audio.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from sqlalchemy.orm import Session

from api.youtube.paths import YOUTUBE_AUDIO_DIR
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.audio_storage")

_REPO_ROOT = Path(__file__).resolve().parents[3]
_LEGACY_YOUTUBE_AUDIO_DIR = _REPO_ROOT / "youtube_audio"


def get_youtube_audio_dir(user_id: Optional[str] = None, db: Optional[Session] = None) -> Path:
    """
    Return the canonical write directory for YouTube audio.

    Prefer the per-user workspace media folder; fall back to global YOUTUBE_AUDIO_DIR.
    """
    logger.debug(
        f"[YouTubeAudioStorage] Resolving audio dir "
        f"(user_id={'set' if user_id else 'none'}, db={'set' if db else 'none'})"
    )

    if user_id and db is not None:
        try:
            from services.user_workspace_manager import UserWorkspaceManager

            workspace = UserWorkspaceManager(db).get_user_workspace(user_id)
            if workspace and workspace.get("workspace_path"):
                audio_dir = Path(workspace["workspace_path"]) / "media" / "youtube_audio"
                audio_dir.mkdir(parents=True, exist_ok=True)
                logger.debug(
                    f"[YouTubeAudioStorage] Using user audio dir for {user_id}: {audio_dir}"
                )
                return audio_dir

            logger.debug(
                f"[YouTubeAudioStorage] No workspace path for user {user_id}; "
                "falling back to global audio dir"
            )
        except Exception as exc:
            logger.warning(
                f"[YouTubeAudioStorage] Failed to resolve user workspace for {user_id}: {exc}",
                exc_info=True,
            )

    try:
        YOUTUBE_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.error(
            f"[YouTubeAudioStorage] Failed to create global audio dir {YOUTUBE_AUDIO_DIR}: {exc}",
            exc_info=True,
        )
        raise

    logger.debug(f"[YouTubeAudioStorage] Using global audio dir: {YOUTUBE_AUDIO_DIR}")
    return YOUTUBE_AUDIO_DIR


def list_youtube_audio_search_dirs(
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Path]:
    """Ordered directories to search when locating an existing YouTube audio file."""
    dirs: List[Path] = []
    seen: set[str] = set()

    def _add(path: Path) -> None:
        key = str(path.resolve()) if path.exists() else str(path)
        if key in seen:
            return
        seen.add(key)
        dirs.append(path)

    _add(get_youtube_audio_dir(user_id=user_id, db=db))
    _add(YOUTUBE_AUDIO_DIR)
    _add(_LEGACY_YOUTUBE_AUDIO_DIR)

    logger.debug(
        f"[YouTubeAudioStorage] Audio search dirs for user_id={user_id or 'none'}: "
        f"{[str(d) for d in dirs]}"
    )
    return dirs


def find_youtube_audio_file(
    filename: str,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Path]:
    """Find a YouTube audio file by filename across canonical + legacy dirs."""
    logger.debug(
        f"[YouTubeAudioStorage] Finding audio file {filename!r} "
        f"for user_id={user_id or 'none'}"
    )

    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"[YouTubeAudioStorage] Rejected unsafe filename: {filename!r}")
        return None

    search_dirs = list_youtube_audio_search_dirs(user_id=user_id, db=db)
    for directory in search_dirs:
        candidate = directory / filename
        if candidate.exists() and candidate.is_file():
            logger.info(
                f"[YouTubeAudioStorage] Found {filename} at {candidate} "
                f"({candidate.stat().st_size} bytes)"
            )
            return candidate

    logger.warning(
        f"[YouTubeAudioStorage] Audio not found: {filename} "
        f"(searched {[str(d) for d in search_dirs]})"
    )
    return None
