"""
Video serving endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import Dict, Any
from pathlib import Path

from ...utils.auth import get_current_user, require_authenticated_user
from ...utils.logger_utils import get_service_logger

logger = get_service_logger("video_studio.endpoints.serve")

router = APIRouter()


@router.get("/videos/{user_id}/{video_filename:path}", summary="Serve Video Studio Video")
async def serve_video_studio_video(
    user_id: str,
    video_filename: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> FileResponse:
    """
    Serve a generated Video Studio video file.
    
    Security: Only the video owner can access their videos.
    """
    try:
        # Verify the requesting user matches the video owner
        authenticated_user_id = require_authenticated_user(current_user)
        if authenticated_user_id != user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your own videos"
            )
        
        # Get base directory
        base_dir = Path(__file__).parent.parent.parent.parent
        video_studio_videos_dir = base_dir / "video_studio_videos"
        video_path = video_studio_videos_dir / user_id / video_filename
        
        # Security: Resolve and ensure path is within video_studio_videos directory
        try:
            resolved_base = video_studio_videos_dir.resolve()
            resolved_path = video_path.resolve()
            resolved_path.relative_to(resolved_base)
        except (OSError, ValueError) as e:
            logger.error(f"[VideoStudio] Path resolution error: {e}")
            raise HTTPException(status_code=403, detail="Invalid video path")
        
        # Check if file exists
        if not resolved_path.exists() or not resolved_path.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"Video not found: {video_filename}"
            )
        
        logger.info(f"[VideoStudio] Serving video: {resolved_path}")
        return FileResponse(
            path=str(resolved_path),
            media_type="video/mp4",
            filename=video_filename,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VideoStudio] Failed to serve video: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to serve video: {str(e)}")
