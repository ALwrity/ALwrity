"""
Topic discovery routes for YouTube Plan (and other features) without full Podcast API.

Reuses existing Podcast handlers:
- POST /api/podcast/trends
- POST /api/podcast/research/tavily-category
- POST /api/podcast/extract-url
"""

from __future__ import annotations

from typing import Iterable, Set

from fastapi import APIRouter, FastAPI
from loguru import logger

from api.podcast.handlers import tavily_category_research, trends
from api.podcast.handlers.analysis import extract_url_content
from api.podcast.models import ExtractUrlResponse

TOPIC_DISCOVERY_ROUTE_PATHS: tuple[str, ...] = (
    "/api/podcast/trends",
    "/api/podcast/research/tavily-category",
    "/api/podcast/extract-url",
)

router = APIRouter(prefix="/api/podcast", tags=["Topic Discovery"])
router.include_router(trends.router)
router.include_router(tavily_category_research.router)
router.add_api_route(
    "/extract-url",
    extract_url_content,
    methods=["POST"],
    response_model=ExtractUrlResponse,
)


def is_podcast_api_mounted(enabled_features: Set[str]) -> bool:
    """Return True when the full Podcast router already exposes topic discovery."""
    if "all" in enabled_features:
        return True
    return "podcast" in enabled_features


def should_mount_topic_discovery_for_youtube(enabled_features: Iterable[str]) -> bool:
    """
    Mount shared topic-discovery routes when YouTube is enabled without Podcast.

    Avoids duplicate routes when the full Podcast API is already mounted.
    """
    features = set(enabled_features)
    if "all" in features:
        return False
    if "youtube" not in features:
        return False
    if "podcast" in features:
        return False
    return True


def mount_topic_discovery_routes(app: FastAPI) -> None:
    """Mount trends, category research, and URL extract routes under /api/podcast."""
    logger.info(
        "[TopicDiscovery] Mounting shared routes for YouTube Plan: {}",
        ", ".join(TOPIC_DISCOVERY_ROUTE_PATHS),
    )
    try:
        app.include_router(router)
        logger.info("[TopicDiscovery] Shared routes mounted successfully")
    except Exception as exc:
        logger.error(
            "[TopicDiscovery] Failed to mount shared routes: {}",
            exc,
            exc_info=True,
        )
        raise
