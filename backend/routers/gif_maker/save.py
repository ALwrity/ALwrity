"""Save GIF Maker session frames and GIF to the unified asset library."""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from services.database import get_db
from utils.logger_utils import get_service_logger
from utils.storage_paths import get_repo_root, sanitize_user_id

logger = get_service_logger("api.gif_maker")
router = APIRouter(tags=["gif-maker"])


def _require_user_id(current_user: Dict[str, Any], operation: str) -> str:
    user_id = current_user.get('id') or current_user.get('clerk_user_id') or current_user.get('sub')
    if not user_id:
        logger.warning(f"Missing user_id in current_user for {operation}")
        raise HTTPException(status_code=401, detail="User not authenticated")
    return user_id


@router.post("/save-session")
async def save_session(
    metadata: str = Form(..., description="JSON string with topic, pageTitle, pageUrl, createdAt, frames[]"),
    gif: Optional[UploadFile] = None,
    frames: List[UploadFile] = File(default=[]),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a GIF Maker session to the asset library.

    Each frame and the GIF (if provided) are saved as individual assets,
    tagged with a shared session tag for retrieval by the target app.
    """
    user_id = _require_user_id(current_user, "save-session")

    safe_user = sanitize_user_id(user_id)
    repo_root = get_repo_root()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    session_tag = f"gif-maker-session-{timestamp}"

    # Parse metadata JSON
    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metadata JSON")

    topic = meta.get("topic", "")
    page_title = meta.get("pageTitle", "")
    page_url = meta.get("pageUrl", "")

    frame_metadatas: list = meta.get("frames", [])

    assets_dir = repo_root / "workspace" / f"workspace_{safe_user}" / "assets" / "images"
    assets_dir.mkdir(parents=True, exist_ok=True)

    from utils.asset_tracker import save_asset_to_library

    # Save each individual frame as an image asset
    frame_assets: list = []
    for i, frame_file in enumerate(frames):
        frame_bytes = await frame_file.read()
        seq = i + 1
        frame_filename = f"session_{timestamp}_frame_{seq:02d}.png"
        file_path = assets_dir / frame_filename
        file_path.write_bytes(frame_bytes)
        file_url = f"/api/assets/{safe_user}/images/{frame_filename}"

        frame_meta = frame_metadatas[i] if i < len(frame_metadatas) else {}

        asset_id = save_asset_to_library(
            db=db,
            user_id=user_id,
            asset_type="image",
            source_module="gif_maker",
            filename=frame_filename,
            file_url=file_url,
            file_path=str(file_path),
            file_size=len(frame_bytes),
            mime_type="image/png",
            title=f"Frame {seq} - {topic or page_title or 'GIF session'}",
            tags=[session_tag, "gif-maker", "frame"],
            asset_metadata={
                "session_tag": session_tag,
                "sequence": seq,
                "page_title": frame_meta.get("pageTitle", page_title),
                "page_url": frame_meta.get("pageUrl", page_url),
                "page_heading": frame_meta.get("pageHeading", ""),
                "page_description": frame_meta.get("pageDescription", ""),
                "selected_text": frame_meta.get("selectedText", ""),
                "captured_at": frame_meta.get("capturedAt", ""),
            },
        )
        frame_assets.append({
            "asset_id": asset_id,
            "file_url": file_url,
            "sequence": seq,
        })

    # Save the GIF as a separate asset (if provided)
    gif_asset = None
    if gif and gif.filename:
        gif_bytes = await gif.read()
        gif_filename = f"session_{timestamp}_animation.gif"
        gif_path = assets_dir / gif_filename
        gif_path.write_bytes(gif_bytes)
        gif_url = f"/api/assets/{safe_user}/images/{gif_filename}"

        gif_asset_id = save_asset_to_library(
            db=db,
            user_id=user_id,
            asset_type="image",
            source_module="gif_maker",
            filename=gif_filename,
            file_url=gif_url,
            file_path=str(gif_path),
            file_size=len(gif_bytes),
            mime_type="image/gif",
            title=f"GIF Animation - {topic or page_title or 'GIF session'}",
            tags=[session_tag, "gif-maker", "animation"],
            asset_metadata={
                "session_tag": session_tag,
                "topic": topic,
                "page_title": page_title,
                "page_url": page_url,
                "num_frames": len(frames),
            },
        )
        gif_asset = {
            "asset_id": gif_asset_id,
            "file_url": gif_url,
            "file_size": len(gif_bytes),
        }

    logger.info(
        f"[GIF Maker Save] Session saved: tag={session_tag}, "
        f"frames={len(frame_assets)}, gif={'yes' if gif_asset else 'no'}, "
        f"user={user_id}"
    )

    return {
        "success": True,
        "session_tag": session_tag,
        "frames": frame_assets,
        "gif": gif_asset,
    }
