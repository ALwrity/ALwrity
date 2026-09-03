"""
YouTube Publish Router
Handles video upload/publishing to YouTube via the Data API v3.
Uses stored OAuth credentials for authentication.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, model_validator
from loguru import logger

from middleware.auth_middleware import get_current_user
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_service import YouTubePublishService
from services.youtube.youtube_publish_log import (
    user_safe_publish_error,
    youtube_publish_error_log_fields,
    youtube_publish_source_meta,
)
from .oauth_router import get_oauth_service
from .task_manager import task_manager

# Mounted under /api/youtube — keep prefix relative so publish is /api/youtube/publish
router = APIRouter(prefix="/publish", tags=["youtube-publish"])


class PublishRequest(BaseModel):
    token_id: int = Field(..., description="YouTube OAuth token row ID (which channel to publish to)")
    video_source: str = Field(
        ...,
        description="Creator /api/youtube/videos/<file> path, http(s) URL, or local file path",
    )
    title: str = Field(..., min_length=1, max_length=100, description="Video title (max 100 chars)")
    description: str = Field("", description="Video description")
    tags: List[str] = Field(default_factory=list, description="Video tags")
    privacy_status: str = Field("unlisted", pattern="^(public|private|unlisted)$", description="Privacy status")
    category_id: str = Field("22", description="YouTube category ID (default: People & Blogs)")
    made_for_kids: bool = Field(False, description="Whether content is made for children")
    age_restricted: bool = Field(
        False,
        description="Restrict the video to viewers over 18 (incompatible with made_for_kids)",
    )
    publish_at: Optional[str] = Field(
        None,
        description="Optional ISO-8601 UTC schedule time (forces private until live)",
    )

    @model_validator(mode="after")
    def reject_made_for_kids_with_age_restriction(self):
        """YouTube does not allow kids content to also be 18+ restricted."""
        if self.made_for_kids and self.age_restricted:
            raise ValueError("This video cannot be both made for kids and age-restricted.")
        return self


class PublishResponse(BaseModel):
    success: bool
    task_id: Optional[str] = None
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    message: str = ""


def get_publish_service(
    oauth_service: YouTubeOAuthService = Depends(get_oauth_service),
) -> YouTubePublishService:
    return YouTubePublishService(oauth_service)


@router.post("", response_model=PublishResponse)
def start_publish(
    request: PublishRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    publish_service: YouTubePublishService = Depends(get_publish_service),
):
    """Start publishing a video to YouTube as a background task."""
    try:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        source_meta = youtube_publish_source_meta(request.video_source)
        logger.info(
            "[youtube_publish] Start request user_id={} token_id={} title_length={} "
            "tag_count={} privacy={} has_publish_at={} made_for_kids={} age_restricted={} "
            "source_kind={} source_length={}",
            user_id,
            request.token_id,
            len(request.title),
            len(request.tags),
            request.privacy_status,
            bool(request.publish_at),
            request.made_for_kids,
            request.age_restricted,
            source_meta["source_kind"],
            source_meta["source_length"],
        )

        # Verify token belongs to user
        oauth_service = publish_service.oauth_service
        status = oauth_service.get_connection_status(user_id)
        tokens = [c for c in status.get("channels", []) if c["token_id"] == request.token_id and c["is_active"]]
        if not tokens:
            logger.warning(
                "[youtube_publish] Invalid or inactive token_id user_id={} token_id={}",
                user_id,
                request.token_id,
            )
            raise HTTPException(status_code=400, detail="Invalid or inactive token_id")

        # Create background task
        task_id = task_manager.create_task("youtube_publish")
        logger.info(
            "[youtube_publish] Task created task_id={} user_id={} token_id={} source_kind={}",
            task_id,
            user_id,
            request.token_id,
            source_meta["source_kind"],
        )

        background_tasks.add_task(
            _execute_publish_task,
            task_id=task_id,
            user_id=user_id,
            token_id=request.token_id,
            video_source=request.video_source,
            title=request.title,
            description=request.description,
            tags=request.tags,
            privacy_status=request.privacy_status,
            category_id=request.category_id,
            made_for_kids=request.made_for_kids,
            age_restricted=request.age_restricted,
            publish_at=request.publish_at,
            publish_service=publish_service,
        )

        return PublishResponse(
            success=True,
            task_id=task_id,
            message="Publishing to YouTube started. Poll task_id for progress.",
        )

    except HTTPException:
        raise
    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        logger.error(
            "[youtube_publish] Start task failed error_type={} http_status={}",
            fields["error_type"],
            fields["http_status"],
        )
        raise HTTPException(status_code=500, detail="Failed to start publish. Please try again.")


@router.get("/{task_id}", response_model=PublishResponse)
def get_publish_status(
    task_id: str,
    user: dict = Depends(get_current_user),
):
    """Check the status of a YouTube publish task."""
    try:
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")

        task_status = task_manager.get_task_status(task_id)
        logger.debug(
            "[youtube_publish] Status poll user_id={} task_id={} found={}",
            user_id,
            task_id,
            bool(task_status),
        )
        if not task_status:
            logger.warning(
                "[youtube_publish] Task not found task_id={}",
                task_id,
            )
            return PublishResponse(
                success=False,
                error="Task not found",
                message="Publish task not found (may have expired).",
            )

        status = task_status.get("status", "unknown")
        result = task_status.get("result") or {}
        error = task_status.get("error")
        if status in ("completed", "failed"):
            logger.info(
                "[youtube_publish] Status poll result task_id={} status={} has_video_id={}",
                task_id,
                status,
                bool(result.get("video_id")),
            )
        else:
            logger.debug(
                "[youtube_publish] Status poll result task_id={} status={} has_video_id={}",
                task_id,
                status,
                bool(result.get("video_id")),
            )

        if status == "completed":
            return PublishResponse(
                success=True,
                task_id=task_id,
                video_id=result.get("video_id"),
                video_url=result.get("video_url"),
                message=task_status.get("message", "Published successfully"),
            )
        elif status == "failed":
            return PublishResponse(
                success=False,
                task_id=task_id,
                error=error or result.get("error", "Publish failed"),
                message=task_status.get("message", "Publish failed"),
            )
        else:
            return PublishResponse(
                success=False,
                task_id=task_id,
                message=task_status.get("message", "Publishing in progress..."),
            )

    except HTTPException:
        raise
    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        logger.error(
            "[youtube_publish] Status check failed task_id={} error_type={} http_status={}",
            task_id,
            fields["error_type"],
            fields["http_status"],
        )
        raise HTTPException(status_code=500, detail="Failed to check publish status. Please try again.")


def _execute_publish_task(
    task_id: str,
    user_id: str,
    token_id: int,
    video_source: str,
    title: str,
    description: str,
    tags: List[str],
    privacy_status: str,
    category_id: str,
    made_for_kids: bool,
    publish_service: YouTubePublishService,
    publish_at: Optional[str] = None,
    age_restricted: bool = False,
):
    """Background task to execute video publish."""
    logger.info(
        "[youtube_publish] Background task start task_id={} user_id={} token_id={} "
        "made_for_kids={} age_restricted={} source_kind={}",
        task_id,
        user_id,
        token_id,
        made_for_kids,
        age_restricted,
        youtube_publish_source_meta(video_source)["source_kind"],
    )

    try:
        task_manager.update_task_status(
            task_id, "processing", progress=10.0, message="Preparing video for upload..."
        )

        result = publish_service.publish_video(
            user_id=user_id,
            token_id=token_id,
            video_source=video_source,
            title=title,
            description=description,
            tags=tags,
            privacy_status=privacy_status,
            category_id=category_id,
            made_for_kids=made_for_kids,
            age_restricted=age_restricted,
            publish_at=publish_at,
        )

        if result.get("success"):
            task_manager.update_task_status(
                task_id,
                "completed",
                progress=100.0,
                message="Published successfully",
                result=result,
            )
            logger.info(
                "[youtube_publish] Background task complete task_id={} has_video_id={}",
                task_id,
                bool(result.get("video_id")),
            )
        else:
            error_msg = result.get("error", "Unknown publish error")
            logger.error(
                "[youtube_publish] Background task failed task_id={} has_error={}",
                task_id,
                bool(error_msg),
            )
            task_manager.update_task_status(
                task_id,
                "failed",
                error=error_msg,
                message="Publish failed",
                result=result,
            )

    except Exception as e:
        fields = youtube_publish_error_log_fields(e)
        logger.error(
            "[youtube_publish] Background task error task_id={} error_type={} http_status={}",
            task_id,
            fields["error_type"],
            fields["http_status"],
        )
        safe = user_safe_publish_error(e)
        task_manager.update_task_status(
            task_id,
            "failed",
            error=safe,
            message="Publish error",
            result={"error": safe},
        )
