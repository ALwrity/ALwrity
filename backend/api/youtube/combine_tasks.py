"""Background task for combining YouTube scene videos."""

from typing import List, Optional
from pathlib import Path

from fastapi import HTTPException

from services.podcast.video_combination_service import PodcastVideoCombinationService
from services.youtube.video_storage import (
    find_youtube_video_file,
    get_youtube_video_dir,
)
from utils.asset_tracker import save_asset_to_library
from utils.logger_utils import get_service_logger
from .task_manager import task_manager

logger = get_service_logger("api.youtube.combine_tasks")


def _execute_combine_video_task(
    task_id: str,
    scene_video_urls: List[str],
    user_id: str,
    resolution: str,
    title: Optional[str],
):
    """Background task to combine multiple scene videos into one final video."""
    logger.info(
        f"[YouTubeRenderer] Background combine task started for task {task_id}, videos={len(scene_video_urls)}, user={user_id}"
    )

    task_status = task_manager.get_task_status(task_id)
    if not task_status:
        logger.error(f"[YouTubeRenderer] Task {task_id} not found when combine task started.")
        return

    # Create DB session for workspace resolution
    from services.database import get_session_for_user

    db = get_session_for_user(user_id)
    if not db:
        logger.error(f"[YouTubeRenderer] Could not create database session for user {user_id}")
        task_manager.update_task_status(
            task_id, "failed", error="Database session unavailable", message="Failed to initialize video combine"
        )
        return

    try:
        task_manager.update_task_status(
            task_id, "processing", progress=5.0, message="Preparing to combine videos..."
        )

        user_video_dir = get_youtube_video_dir(user_id=user_id, db=db)
        logger.info(
            f"[YouTubeRenderer] Combine using canonical video dir: {user_video_dir}"
        )

        # Resolve video paths from URLs (canonical + legacy locations)
        video_paths: List[Path] = []
        for url in scene_video_urls:
            filename = Path(url).name
            video_path = find_youtube_video_file(filename, user_id=user_id, db=db)
            if not video_path:
                logger.error(
                    f"[YouTubeRenderer] Video file not found for combine: {filename}"
                )
                raise HTTPException(
                    status_code=404,
                    detail=f"Video file not found: {filename}",
                )
            video_paths.append(video_path)

        if len(video_paths) < 2:
            raise HTTPException(status_code=400, detail="Need at least two videos to combine.")

        task_manager.update_task_status(
            task_id, "processing", progress=25.0, message="Combining scene videos..."
        )

        # Reuse podcast video-only combiner (scene MP4s already include embedded audio).
        # Story combine path expects separate narration tracks and is not used here.
        video_service = PodcastVideoCombinationService(output_dir=str(user_video_dir))

        def progress_callback(progress: float, message: str) -> None:
            # Keep combine progress in the mid/high range reserved for encoding
            mapped = min(95.0, max(25.0, progress))
            task_manager.update_task_status(
                task_id, "processing", progress=mapped, message=message
            )

        combined_result = video_service.combine_videos(
            video_paths=[str(p) for p in video_paths],
            podcast_title=title or "YouTube Video",
            fps=24,
            progress_callback=progress_callback,
        )

        task_manager.update_task_status(
            task_id, "processing", progress=90.0, message="Finalizing combined video..."
        )

        final_path = combined_result["video_path"]
        final_filename = Path(
            combined_result.get("video_filename") or final_path
        ).name
        # Podcast service returns /api/podcast/... — rewrite to YouTube serve path
        final_url = f"/api/youtube/videos/{final_filename}"
        file_size = combined_result.get("file_size", 0)

        # Save to asset library using existing db session
        try:
            save_asset_to_library(
                db=db,
                user_id=user_id,
                asset_type="video",
                source_module="youtube_creator",
                filename=Path(final_path).name,
                file_url=final_url,
                file_path=str(final_path),
                file_size=file_size,
                mime_type="video/mp4",
                title=title or "YouTube Video",
                description="Combined YouTube creator video",
                tags=["youtube_creator", "video", "combined", resolution],
                provider="wavespeed",
                model="alibaba/wan-2.5/text-to-video",
                cost=0.0,
                asset_metadata={
                    "resolution": resolution,
                    "status": "completed",
                    "scene_count": len(video_paths),
                },
            )
        except Exception as e:
            logger.warning(f"[YouTubeRenderer] Failed to save combined video to asset library: {e}")

        result = {
            "video_url": final_url,
            "video_path": final_path,
            "resolution": resolution,
            "scene_count": len(video_paths),
        }

        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message="Combined video generated successfully",
            result=result,
        )

        logger.info(
            f"[YouTubeRenderer] ✅ Combine task {task_id} completed, scenes={len(video_paths)}"
        )

    except HTTPException as exc:
        error_msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        logger.error(f"[YouTubeRenderer] Combine task {task_id} failed: {error_msg}")
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Combine failed: {error_msg}",
        )
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"[YouTubeRenderer] Combine task {task_id} error: {error_msg}", exc_info=True)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_msg,
            message=f"Combine error: {error_msg}",
        )
    finally:
        if 'db' in locals():
            db.close()
