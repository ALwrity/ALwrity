"""
YouTube Creator Studio API Router

Handles video planning, scene building, and rendering endpoints.
Thin aggregator: mounts domain handlers and re-exports symbols for tests.
"""

from fastapi import APIRouter

from utils.logger_utils import get_service_logger

from .deps import require_authenticated_user
from .handlers import avatar as avatar_handlers
from .handlers import audio as audio_handlers
from .handlers import channel_bible as channel_bible_handlers
from .handlers import images as image_handlers
from .handlers import plan as plan_handlers
from .handlers import render as render_handlers
from .handlers import videos as video_handlers
from .oauth_router import router as youtube_oauth_router
from .publish_router import router as youtube_publish_router
from .analytics_router import router as youtube_analytics_router
from .comments_router import router as youtube_comments_router
from .studio_ops_router import router as youtube_studio_ops_router
from .task_manager import task_manager

# Re-export schemas for existing test imports
from .schemas import (  # noqa: F401
    CombineVideosRequest,
    CombineVideosResponse,
    CostEstimateRequest,
    CostEstimateResponse,
    SceneBuildRequest,
    SceneBuildResponse,
    SceneUpdateRequest,
    SceneUpdateResponse,
    SceneVideoRenderRequest,
    SceneVideoRenderResponse,
    VideoListResponse,
    VideoPlanRequest,
    VideoPlanResponse,
    VideoRenderRequest,
    VideoRenderResponse,
)

# Re-export endpoint callables for existing test imports
from .handlers.plan import (  # noqa: F401
    build_scenes,
    create_video_plan,
    update_scene,
)
from .handlers.render import (  # noqa: F401
    combine_scene_videos,
    estimate_render_cost,
    get_render_status,
    render_single_scene_video,
    start_video_render,
)
from .handlers.videos import (  # noqa: F401
    list_videos,
    serve_youtube_video,
)

# Re-export background tasks for existing test imports
from .render_tasks import (  # noqa: F401
    _execute_scene_video_render_task,
    _execute_video_render_task,
)
from .combine_tasks import (  # noqa: F401
    _execute_combine_video_task,
)

router = APIRouter(prefix="/youtube", tags=["youtube"])
logger = get_service_logger("api.youtube")

# Domain handlers (plan/scenes, render, videos)
router.include_router(plan_handlers.router)
router.include_router(channel_bible_handlers.router)
router.include_router(render_handlers.router)
router.include_router(video_handlers.router)

# Existing media / oauth / publish sub-routers
router.include_router(avatar_handlers.router)
router.include_router(image_handlers.router)
router.include_router(audio_handlers.router)
router.include_router(youtube_oauth_router)
router.include_router(youtube_publish_router)
router.include_router(youtube_analytics_router)
router.include_router(youtube_comments_router)
router.include_router(youtube_studio_ops_router)

__all__ = [
    "router",
    "require_authenticated_user",
    "task_manager",
    "create_video_plan",
    "build_scenes",
    "update_scene",
    "start_video_render",
    "render_single_scene_video",
    "get_render_status",
    "combine_scene_videos",
    "estimate_render_cost",
    "list_videos",
    "serve_youtube_video",
    "_execute_video_render_task",
    "_execute_scene_video_render_task",
    "_execute_combine_video_task",
]
