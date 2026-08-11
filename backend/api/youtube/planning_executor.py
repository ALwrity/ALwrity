"""
YouTube planning execution helpers.

Keeps async planning business logic modular so the API router can delegate
both synchronous and task-based planning flows consistently.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.content_asset_models import AssetSource, AssetType
from services.content_asset_service import ContentAssetService
from services.database import get_session_for_user
from services.persona_data_service import PersonaDataService
from services.youtube.planner import YouTubePlannerService
from utils.logger_utils import get_service_logger

from .handlers.avatar import _generate_avatar_from_context
from .paths import ensure_youtube_media_dirs
from .task_manager import task_manager

logger = get_service_logger("api.youtube.planning")


def _read_request_value(request_data: Dict[str, Any], key: str, default: Any = None) -> Any:
    value = request_data.get(key, default)
    return value


async def generate_video_plan_payload(
    request_data: Dict[str, Any],
    user_id: str,
    db: Session,
) -> Dict[str, Any]:
    """
    Generate a YouTube video plan and enrich it with optional avatar metadata.
    """
    idea = str(_read_request_value(request_data, "user_idea", "") or "")
    duration_type = str(_read_request_value(request_data, "duration_type", "medium") or "medium")

    logger.info(
        f"[YouTubePlanning] Generating plan payload: user={user_id}, "
        f"duration={duration_type}, idea_preview={idea[:50]}"
    )

    persona_data: Optional[Dict[str, Any]] = None
    try:
        persona_service = PersonaDataService()
        persona_data = persona_service.get_user_persona_data(user_id)
    except Exception as persona_error:
        logger.warning(
            f"[YouTubePlanning] Persona data load failed for user {user_id}: {persona_error}"
        )

    planner = YouTubePlannerService()
    plan = await planner.generate_video_plan(
        user_idea=idea,
        duration_type=duration_type,
        video_type=_read_request_value(request_data, "video_type"),
        target_audience=_read_request_value(request_data, "target_audience"),
        video_goal=_read_request_value(request_data, "video_goal"),
        brand_style=_read_request_value(request_data, "brand_style"),
        persona_data=persona_data,
        reference_image_description=_read_request_value(request_data, "reference_image_description"),
        source_content_id=_read_request_value(request_data, "source_content_id"),
        source_content_type=_read_request_value(request_data, "source_content_type"),
        user_id=user_id,
        include_scenes=(duration_type == "shorts"),
        enable_research=bool(_read_request_value(request_data, "enable_research", True)),
    )

    avatar_url = _read_request_value(request_data, "avatar_url")
    if avatar_url:
        return plan

    try:
        asset_service = ContentAssetService(db)
        existing_avatars, _ = asset_service.get_user_assets(
            user_id=user_id,
            asset_type=AssetType.IMAGE,
            source_module=AssetSource.YOUTUBE_CREATOR,
            limit=1,
        )

        if existing_avatars:
            existing_avatar = existing_avatars[0]
            plan["auto_generated_avatar_url"] = existing_avatar.file_url
            plan["avatar_reused"] = True
            logger.info(
                f"[YouTubePlanning] Reused existing avatar for user {user_id}: "
                f"asset_id={getattr(existing_avatar, 'id', 'unknown')}"
            )
            return plan

        ensure_youtube_media_dirs(user_id, capabilities={"media", "content"})
        project_id = f"plan_{user_id}_{uuid.uuid4().hex[:8]}"
        logger.info(f"[YouTubePlanning] Generating new avatar for user {user_id}, project={project_id}")

        avatar_response = await _generate_avatar_from_context(
            user_id=user_id,
            project_id=project_id,
            audience=_read_request_value(request_data, "target_audience") or plan.get("target_audience"),
            content_type=_read_request_value(request_data, "video_type"),
            video_plan_json=json.dumps(plan),
            brand_style=_read_request_value(request_data, "brand_style"),
            db=db,
        )

        plan["auto_generated_avatar_url"] = avatar_response.get("avatar_url")
        plan["avatar_prompt"] = avatar_response.get("avatar_prompt")
        plan["avatar_reused"] = False
    except Exception as avatar_error:
        logger.warning(
            f"[YouTubePlanning] Avatar generation/reuse failed for user {user_id} (non-critical): {avatar_error}"
        )

    return plan


async def execute_video_plan_task(
    task_id: str,
    request_data: Dict[str, Any],
    user_id: str,
) -> None:
    """
    Background worker for asynchronous YouTube planning tasks.
    """
    started_at = time.perf_counter()
    logger.info(f"[YouTubePlanning] Task started: task_id={task_id}, user={user_id}")

    task = task_manager.get_task_status(task_id, requester_user_id=user_id)
    if not task:
        logger.error(f"[YouTubePlanning] Task {task_id} missing before execution")
        return

    db = get_session_for_user(user_id)
    if not db:
        task_manager.update_task_status(
            task_id,
            "failed",
            error="Database session unavailable for plan generation",
            message="Failed to initialize planning context. Please try again.",
            error_status=503,
        )
        return

    try:
        task_manager.update_task_status(
            task_id,
            "processing",
            progress=5.0,
            message="Starting YouTube plan generation...",
        )

        plan = await generate_video_plan_payload(request_data=request_data, user_id=user_id, db=db)

        task_manager.update_task_status(
            task_id,
            "completed",
            progress=100.0,
            message="Video plan generated successfully",
            result={"plan": plan},
        )

        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info(
            f"[YouTubePlanning] Task completed: task_id={task_id}, user={user_id}, duration_ms={elapsed_ms}"
        )
    except HTTPException as http_error:
        error_detail = http_error.detail
        if isinstance(error_detail, dict):
            error_message = (
                str(error_detail.get("message"))
                if error_detail.get("message")
                else str(error_detail.get("error", "Planning failed"))
            )
            error_data = error_detail
        else:
            error_message = str(error_detail)
            error_data = {"detail": error_detail}

        task_manager.update_task_status(
            task_id,
            "failed",
            error=error_message,
            message="Video plan generation failed",
            error_status=http_error.status_code,
            error_data=error_data,
        )
        logger.warning(
            f"[YouTubePlanning] Task failed with HTTPException: task_id={task_id}, "
            f"status={http_error.status_code}, error={error_message}"
        )
    except Exception as unexpected_error:
        task_manager.update_task_status(
            task_id,
            "failed",
            error=str(unexpected_error),
            message="Unexpected error during video plan generation",
        )
        logger.error(
            f"[YouTubePlanning] Task failed unexpectedly: task_id={task_id}, error={unexpected_error}",
            exc_info=True,
        )
    finally:
        try:
            db.close()
        except Exception:
            pass

