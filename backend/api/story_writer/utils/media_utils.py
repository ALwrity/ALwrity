from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional
from urllib.parse import urlparse

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.orm import Session

from services.database import get_session_for_user
from services.user_workspace_manager import UserWorkspaceManager


BASE_DIR = Path(__file__).resolve().parents[4]  # repository root
DATA_MEDIA_DIR = (BASE_DIR / "data" / "media").resolve()
LEGACY_STORY_VIDEOS_DIR = (BASE_DIR / "story_videos").resolve()
LEGACY_WORKSPACE_MEDIA_DIR = (BASE_DIR / "workspace" / "media").resolve()

STORY_MEDIA_SUBDIRS = {
    "image": "story_images",
    "audio": "story_audio",
    "video": "story_videos",
}


# Authoritative policy:
# - New reads/writes should use workspace/workspace_<id>/media/story_*.
# Compatibility fallback order for reads:
# 1) workspace/workspace_<id>/media/story_*
# 2) legacy workspace paths (e.g. content/story_audio, workspace/media/story_videos)
# 3) global data/media/story_*
# 4) old root-level story_videos/*
def _workspace_story_media_dir(workspace_path: Path, media_type: str) -> Path:
    return (workspace_path / "media" / STORY_MEDIA_SUBDIRS[media_type]).resolve()


def _workspace_legacy_dirs(workspace_path: Path, media_type: str) -> List[Path]:
    if media_type == "audio":
        return [(workspace_path / "content" / "story_audio").resolve()]
    if media_type == "video":
        return [(workspace_path / "media" / "story_videos").resolve()]
    return []


def _global_story_media_dir(media_type: str) -> Path:
    return (DATA_MEDIA_DIR / STORY_MEDIA_SUBDIRS[media_type]).resolve()


def _global_legacy_dirs(media_type: str) -> List[Path]:
    if media_type == "video":
        return [
            (LEGACY_WORKSPACE_MEDIA_DIR / "story_videos").resolve(),
            LEGACY_STORY_VIDEOS_DIR,
        ]
    return []


def _get_workspace_path(user_id: str, db: Optional[Session] = None) -> Optional[Path]:
    if not user_id:
        return None

    session = db
    own_session = False
    try:
        if session is None:
            session = get_session_for_user(user_id)
            if session is None:
                logger.warning(f"[StoryWriter] Could not open database session for {user_id}")
                return None
            own_session = True

        workspace_manager = UserWorkspaceManager(session)
        workspace = workspace_manager.get_user_workspace(user_id)
        if workspace and workspace.get("workspace_path"):
            return Path(workspace["workspace_path"]).resolve()
    except Exception as exc:
        logger.warning(f"[StoryWriter] Failed to resolve workspace for {user_id}: {exc}")
    finally:
        if own_session and session is not None:
            try:
                session.close()
            except Exception:
                pass

    return None


def get_story_media_write_dir(media_type: str, user_id: Optional[str] = None, db: Optional[Session] = None) -> Path:
    """Return the canonical directory used for newly generated story media files."""
    if media_type not in STORY_MEDIA_SUBDIRS:
        raise ValueError(f"Unsupported media type: {media_type}")

    if user_id:
        workspace_path = _get_workspace_path(user_id, db)
        if workspace_path:
            canonical = _workspace_story_media_dir(workspace_path, media_type)
            canonical.mkdir(parents=True, exist_ok=True)
            return canonical

    fallback = _global_story_media_dir(media_type)
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def _safe_candidate(base_dir: Path, filename: str) -> Optional[Path]:
    try:
        base_resolved = base_dir.resolve()
        candidate = (base_resolved / filename).resolve()
        candidate.relative_to(base_resolved)
        return candidate
    except Exception:
        return None


def _iter_read_dirs(media_type: str, user_id: Optional[str], db: Optional[Session]) -> Iterable[Path]:
    if media_type not in STORY_MEDIA_SUBDIRS:
        raise ValueError(f"Unsupported media type: {media_type}")

    workspace_path = _get_workspace_path(user_id, db) if user_id else None
    if workspace_path:
        yield _workspace_story_media_dir(workspace_path, media_type)
        for legacy in _workspace_legacy_dirs(workspace_path, media_type):
            yield legacy

    yield _global_story_media_dir(media_type)
    for legacy in _global_legacy_dirs(media_type):
        yield legacy


def resolve_story_media_path(
    filename: str,
    media_type: str,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
    extra_subdir: Optional[str] = None,
) -> Path:
    """Resolve story media with canonical-first lookup and legacy fallbacks."""
    filename = filename.split("?")[0].strip()
    if not filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    for base_dir in _iter_read_dirs(media_type, user_id, db):
        search_dir = base_dir / extra_subdir if extra_subdir else base_dir
        candidate = _safe_candidate(search_dir, filename)
        if not candidate:
            continue
        if candidate.exists():
            return candidate

        alternate = _find_alternate_media_file(search_dir, filename)
        if alternate:
            logger.warning(
                "[StoryWriter] Requested media '%s' missing in '%s'; serving '%s'",
                filename,
                search_dir,
                alternate.name,
            )
            return alternate

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found: {filename}")


def resolve_media_file(base_dir: Path, filename: str) -> Path:
    """Backwards-compatible helper for existing route handlers."""
    filename = filename.split("?")[0].strip()
    resolved = _safe_candidate(base_dir, filename)
    if not resolved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if resolved.exists():
        return resolved

    alternate = _find_alternate_media_file(base_dir, filename)
    if alternate:
        logger.warning(
            "[StoryWriter] Requested media file '%s' missing; serving closest match '%s'",
            filename,
            alternate.name,
        )
        return alternate

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found: {filename}")


def load_story_image_bytes(image_url: str, user_id: Optional[str] = None) -> Optional[bytes]:
    if not image_url:
        return None

    try:
        parsed = urlparse(image_url)
        path = parsed.path if parsed.scheme else image_url
        prefix = "/api/story/images/"
        if prefix not in path:
            logger.warning(f"[StoryWriter] Unsupported image URL for video reference: {image_url}")
            return None

        filename = path.split(prefix, 1)[1].split("?", 1)[0].strip()
        if not filename:
            return None

        try:
            file_path = resolve_story_media_path(filename, "image", user_id)
            return file_path.read_bytes()
        except HTTPException:
            logger.warning(f"[StoryWriter] Referenced scene image not found: {filename}")
            return None
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to load reference image for video gen: {exc}")
        return None


def load_story_audio_bytes(audio_url: str, user_id: Optional[str] = None) -> Optional[bytes]:
    if not audio_url:
        return None

    try:
        parsed = urlparse(audio_url)
        path = parsed.path if parsed.scheme else audio_url
        prefix = "/api/story/audio/"
        if prefix not in path:
            logger.warning(f"[StoryWriter] Unsupported audio URL for video reference: {audio_url}")
            return None

        filename = path.split(prefix, 1)[1].split("?", 1)[0].strip()
        if not filename:
            return None

        try:
            file_path = resolve_story_media_path(filename, "audio", user_id)
            return file_path.read_bytes()
        except HTTPException:
            logger.warning(f"[StoryWriter] Referenced scene audio not found: {filename}")
            return None
    except Exception as exc:
        logger.error(f"[StoryWriter] Failed to load reference audio for video gen: {exc}")
        return None


def _find_alternate_media_file(base_dir: Path, filename: str) -> Optional[Path]:
    try:
        base_dir = base_dir.resolve()
    except Exception:
        return None

    stem = Path(filename).stem
    suffix = Path(filename).suffix

    if not suffix or "_" not in stem:
        return None

    prefix = stem.rsplit("_", 1)[0]
    pattern = f"{prefix}_*{suffix}"

    try:
        candidates = sorted(
            (p for p in base_dir.glob(pattern) if p.is_file()),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
    except Exception as exc:
        logger.debug(f"[StoryWriter] Failed to search alternate media files for {filename}: {exc}")
        return None

    return candidates[0] if candidates else None
