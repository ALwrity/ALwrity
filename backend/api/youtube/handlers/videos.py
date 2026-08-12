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
    Used to rescue/persist scene videos after reloads.
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
                videos.append({
                    "scene_number": asset.asset_metadata.get("scene_number") if asset.asset_metadata else None,
                    "video_url": asset.file_url,
                    "filename": asset.filename,
                    "created_at": asset.created_at.isoformat() if asset.created_at else None,
                    "resolution": asset.asset_metadata.get("resolution") if asset.asset_metadata else None,
                })
            except Exception as asset_error:
                logger.warning(f"[YouTubeAPI] Error processing asset {asset.id if hasattr(asset, 'id') else 'unknown'}: {asset_error}")
                continue  # Skip this asset and continue with others

        logger.info(f"[YouTubeAPI] Listed {len(videos)} videos for user {user_id}")
        return VideoListResponse(videos=videos)
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error listing videos: {e}", exc_info=True)
        # Return empty list on error rather than failing completely
        return VideoListResponse(videos=[], success=False, message=f"Failed to list videos: {str(e)}")


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

        logger.debug(f"[YouTubeAPI] Serving video: {video_filename} from {video_path}")

        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=video_filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[YouTubeAPI] Error serving video: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to serve video: {str(e)}"
        )
