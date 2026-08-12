"""
YouTube video storage helpers.

Canonical on-disk location for YouTube Creator scene/final videos:
  {user_workspace}/media/youtube_videos/

Falls back to the global YouTube media dir and a few legacy locations so
older renders remain findable for serve/combine.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import List, Optional

from sqlalchemy.orm import Session

from api.youtube.paths import YOUTUBE_VIDEO_DIR
from utils.logger_utils import get_service_logger

logger = get_service_logger("youtube.video_storage")

_REPO_ROOT = Path(__file__).resolve().parents[3]
_LEGACY_ROOT_YOUTUBE_VIDEOS = _REPO_ROOT / "youtube_videos"


def get_youtube_video_dir(user_id: Optional[str] = None, db: Optional[Session] = None) -> Path:
    """
    Return the canonical write directory for YouTube videos.

    Prefer the per-user workspace media folder; fall back to global YOUTUBE_VIDEO_DIR.
    """
    if user_id and db is not None:
        try:
            from services.user_workspace_manager import UserWorkspaceManager

            workspace = UserWorkspaceManager(db).get_user_workspace(user_id)
            if workspace and workspace.get("workspace_path"):
                video_dir = Path(workspace["workspace_path"]) / "media" / "youtube_videos"
                video_dir.mkdir(parents=True, exist_ok=True)
                logger.debug(
                    f"[YouTubeVideoStorage] Using user video dir for {user_id}: {video_dir}"
                )
                return video_dir
        except Exception as exc:
            logger.warning(
                f"[YouTubeVideoStorage] Failed to resolve user workspace for {user_id}: {exc}"
            )

    YOUTUBE_VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    return YOUTUBE_VIDEO_DIR


def list_youtube_video_search_dirs(
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> List[Path]:
    """
    Ordered directories to search when locating an existing YouTube video file.

    Includes legacy Story/content paths so previously mis-saved files still resolve.
    """
    dirs: List[Path] = []
    seen: set[str] = set()

    def _add(path: Path) -> None:
        key = str(path.resolve()) if path.exists() else str(path)
        if key in seen:
            return
        seen.add(key)
        dirs.append(path)

    _add(get_youtube_video_dir(user_id=user_id, db=db))
    _add(YOUTUBE_VIDEO_DIR)

    if user_id and db is not None:
        try:
            from services.user_workspace_manager import UserWorkspaceManager

            workspace = UserWorkspaceManager(db).get_user_workspace(user_id)
            if workspace and workspace.get("workspace_path"):
                root = Path(workspace["workspace_path"])
                # Legacy mis-routed locations from earlier YouTube/Story path bugs
                _add(root / "media" / "story_videos")
                _add(root / "content" / "videos")
        except Exception as exc:
            logger.debug(
                f"[YouTubeVideoStorage] Skipping workspace legacy dirs for {user_id}: {exc}"
            )

    _add(_LEGACY_ROOT_YOUTUBE_VIDEOS)
    return dirs


def find_youtube_video_file(
    filename: str,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Path]:
    """Find a YouTube video file by filename across canonical + legacy dirs."""
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        logger.warning(f"[YouTubeVideoStorage] Rejected unsafe filename: {filename!r}")
        return None

    for directory in list_youtube_video_search_dirs(user_id=user_id, db=db):
        candidate = directory / filename
        if candidate.exists() and candidate.is_file():
            logger.debug(f"[YouTubeVideoStorage] Found {filename} at {candidate}")
            return candidate

    logger.warning(
        f"[YouTubeVideoStorage] Video not found: {filename} "
        f"(searched {[str(d) for d in list_youtube_video_search_dirs(user_id=user_id, db=db)]})"
    )
    return None


def save_youtube_scene_video(
    video_bytes: bytes,
    scene_number: int,
    user_id: str,
    db: Optional[Session] = None,
) -> dict:
    """
    Persist a rendered scene video into the canonical YouTube video directory.

    Returns metadata compatible with the previous StoryVideoGenerationService.save_scene_video shape.
    """
    if not video_bytes:
        raise ValueError("Cannot save empty video bytes")

    output_dir = get_youtube_video_dir(user_id=user_id, db=db)
    clean_user_id = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in user_id[:16])
    filename = f"scene_{scene_number}_{clean_user_id}_{uuid.uuid4().hex[:8]}.mp4"
    video_path = output_dir / filename

    try:
        with open(video_path, "wb") as handle:
            handle.write(video_bytes)
        file_size = video_path.stat().st_size
        if file_size <= 0:
            raise IOError(f"Video file was written empty: {video_path}")

        video_url = f"/api/youtube/videos/{filename}"
        logger.info(
            f"[YouTubeVideoStorage] Saved scene {scene_number} video: {filename} "
            f"({file_size} bytes) -> {video_path}"
        )
        return {
            "video_filename": filename,
            "video_url": video_url,
            "video_path": str(video_path),
            "file_size": file_size,
        }
    except Exception:
        logger.error(
            f"[YouTubeVideoStorage] Failed to save scene {scene_number} video for user {user_id}",
            exc_info=True,
        )
        raise
