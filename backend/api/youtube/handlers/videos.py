"""YouTube video list and serve API handlers."""

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user, get_current_user_with_query_token
from models.content_asset_models import AssetType, AssetSource
from services.content_asset_service import ContentAssetService
from services.database import get_db
from services.youtube.video_storage import find_youtube_video_file
from utils.logger_utils import get_service_logger
from ..deps import require_authenticated_user
from ..schemas import VideoListResponse

router = APIRouter(tags=["youtube"])
logger = get_service_logger("api.youtube.videos")


@router.get("/videos", response_model=VideoListResponse)
async def list_videos(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VideoListResponse:
    """
    List videos for the current user from the asset library (source: youtube_creator).
    Used to rescue/persist scene clips and combined videos after reloads.
    """
    try:
        user_id = require_authenticated_user(current_user)
        asset_service = ContentAssetService(db)

        assets, _ = asset_service.get_user_assets(
            user_id=user_id,
            asset_type=AssetType.VIDEO,
            source_module=AssetSource.YOUTUBE_CREATOR,
            limit=100,
        )

        videos = []
        for asset in assets:
            try:
                metadata = asset.asset_metadata or {}
                videos.append({
                    "scene_number": metadata.get("scene_number"),
                    "video_url": asset.file_url,
                    "filename": asset.filename,
                    "created_at": asset.created_at.isoformat() if asset.created_at else None,
                    "resolution": metadata.get("resolution"),
                    "scene_count": metadata.get("scene_count"),
                })
            except Exception as asset_error:
                asset_id = asset.id if hasattr(asset, "id") else "unknown"
                logger.warning(
                    f"[YouTubeAPI] Error processing asset id={asset_id} "
                    f"error_type={type(asset_error).__name__}"
                )
                continue  # Skip this asset and continue with others

        scene_listed = sum(1 for item in videos if item.get("scene_number") is not None)
        combined_listed = len(videos) - scene_listed
        logger.info(
            f"[YouTubeAPI] Listed {len(videos)} videos for user {user_id} "
            f"scenes={scene_listed} combined={combined_listed}"
        )
        return VideoListResponse(videos=videos)
    except Exception as e:
        logger.error(
            f"[YouTubeAPI] Error listing videos error_type={type(e).__name__}",
            exc_info=True,
        )
        return VideoListResponse(
            videos=[],
            success=False,
            message="Failed to list videos. Please try again.",
        )


@router.get("/videos/{video_filename}")
async def serve_youtube_video(
    video_filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user_with_query_token),
) -> FileResponse:
    """
    Serve YouTube video files.
    Supports authentication via Authorization header or ?token= query parameter.
    Query parameter is required for <video> tags which cannot send custom headers.
    """
    try:
        user_id = require_authenticated_user(current_user)

        # Security: prevent directory traversal
        if ".." in video_filename or "/" in video_filename or "\\" in video_filename:
            raise HTTPException(status_code=400, detail="Invalid filename")

        # Resolve across canonical + legacy dirs (needs DB for per-user workspace)
        from services.database import get_session_for_user

        db = get_session_for_user(user_id)
        try:
            video_path = find_youtube_video_file(
                video_filename,
                user_id=user_id,
                db=db,
            )
        finally:
            if db is not None:
                db.close()

        if not video_path:
            raise HTTPException(status_code=404, detail="Video not found")

        if not video_path.is_file():
            raise HTTPException(status_code=400, detail="Invalid video path")

        logger.debug(
            f"[YouTubeAPI] Serving video user_id={user_id} filename_length={len(video_filename)}"
        )

        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=video_filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[YouTubeAPI] Error serving video error_type={type(e).__name__}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to serve video. Please try again.",
        )
