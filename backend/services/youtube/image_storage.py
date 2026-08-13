"""
YouTube image storage helpers.

Canonical on-disk location for YouTube Creator scene/avatar images:
  {user_workspace}/media/youtube_images/

Falls back to the global YouTube media dir (YOUTUBE_IMAGES_DIR).
Scene images are served at /api/youtube/images/scenes/{filename}.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from sqlalchemy.orm import Session

from api.youtube.paths import YOUTUBE_IMAGES_DIR
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.image_storage")


def get_youtube_image_dir(user_id: Optional[str] = None, db: Optional[Session] = None) -> Path:
    """
    Return the canonical write directory for YouTube images.

    Prefer the per-user workspace media folder; fall back to global YOUTUBE_IMAGES_DIR.
    """
    logger.debug(
        f"[YouTubeImageStorage] Resolving image dir "
        f"(user_id={'set' if user_id else 'none'}, db={'set' if db else 'none'})"
    )

    if user_id and db is not None:
        try:
            from services.user_workspace_manager import UserWorkspaceManager

            workspace = UserWorkspaceManager(db).get_user_workspace(user_id)
            if workspace and workspace.get("workspace_path"):
                image_dir = Path(workspace["workspace_path"]) / "media" / "youtube_images"
                image_dir.mkdir(parents=True, exist_ok=True)
                logger.debug(
                    f"[YouTubeImageStorage] Using user image dir for {user_id}: {image_dir}"
                )
                return image_dir

            logger.debug(
                f"[YouTubeImageStorage] No workspace path for user {user_id}; "
                "falling back to global image dir"
            )
        except Exception as exc:
            logger.warning(
                f"[YouTubeImageStorage] Failed to resolve user workspace for {user_id}: {exc}",
                exc_info=True,
            )

    try:
        YOUTUBE_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        logger.error(
            f"[YouTubeImageStorage] Failed to create global image dir {YOUTUBE_IMAGES_DIR}: {exc}",
            exc_info=True,
        )
        raise

    logger.debug(f"[YouTubeImageStorage] Using global image dir: {YOUTUBE_IMAGES_DIR}")
    return YOUTUBE_IMAGES_DIR


def list_youtube_image_search_dirs(
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Path]:
    """Ordered directories to search when locating an existing YouTube image file."""
    dirs: List[Path] = []
    seen: set[str] = set()

    def _add(path: Path) -> None:
        key = str(path.resolve()) if path.exists() else str(path)
        if key in seen:
            return
        seen.add(key)
        dirs.append(path)

    _add(get_youtube_image_dir(user_id=user_id, db=db))
    _add(YOUTUBE_IMAGES_DIR)

    logger.debug(
        f"[YouTubeImageStorage] Image search dirs for user_id={user_id or 'none'}: "
        f"{[str(d) for d in dirs]}"
    )
    return dirs


def find_youtube_image_file(
    filename: str,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Path]:
    """Find a YouTube image file by filename across canonical + global dirs."""
    logger.debug(
        f"[YouTubeImageStorage] Finding image file {filename!r} "
        f"for user_id={user_id or 'none'}"
    )

    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"[YouTubeImageStorage] Rejected unsafe filename: {filename!r}")
        return None

    search_dirs = list_youtube_image_search_dirs(user_id=user_id, db=db)
    for directory in search_dirs:
        candidate = directory / filename
        if candidate.exists() and candidate.is_file():
            logger.info(
                f"[YouTubeImageStorage] Found {filename} at {candidate} "
                f"({candidate.stat().st_size} bytes)"
            )
            return candidate

    logger.warning(
        f"[YouTubeImageStorage] Image not found: {filename} "
        f"(searched {[str(d) for d in search_dirs]})"
    )
    return None
