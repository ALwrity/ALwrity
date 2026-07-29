"""
Story Writer API Router

Main router for story generation operations. This file serves as the entry point
and includes modular sub-routers for different functionality areas.
"""

from typing import Any, Dict

from fastapi import APIRouter

from .routes import (
    cache_routes,
    export,
    media_generation,
    scene_animation,
    story_content,
    story_projects,
    story_setup,
    story_tasks,
    video_generation,
)

router = APIRouter(prefix="/api/story", tags=["Story Writer"])

# Include modular routers (order preserved roughly by workflow)
router.include_router(story_setup.router)
router.include_router(story_content.router)
router.include_router(story_projects.router)
router.include_router(story_tasks.router)
router.include_router(media_generation.router)
router.include_router(scene_animation.router)
router.include_router(video_generation.router)
router.include_router(export.router)
router.include_router(cache_routes.router)


@router.get("/health")
async def health() -> Dict[str, Any]:
    """Health check endpoint."""
    return {"status": "ok", "service": "story_writer"}
