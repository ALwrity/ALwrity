"""Feature registry for profile-based capability toggles.

This module stores normalized feature-group definitions used by the
feature profile runtime.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Tuple


@dataclass(frozen=True)
class FeatureGroup:
    """Single feature group and the capabilities it enables."""
    
    routers: Tuple[str, ...] = ()
    startup_hooks: Tuple[str, ...] = ()
    optional_services: Tuple[str, ...] = ()
    features: Tuple[str, ...] = field(default_factory=tuple)


FEATURE_GROUPS: Dict[str, FeatureGroup] = {
    "core": FeatureGroup(
        features=("core", "health", "onboarding", "research"),
        routers=(
            "api.component_logic:router",
            "api.subscription:router",
            "api.onboarding_utils.step3_routes:router",
            "api.research.router:router",
        ),
        startup_hooks=(
            "services.database:init_database",
        ),
        optional_services=(
            "services.scheduler:get_scheduler",
        ),
    ),
    "podcast": FeatureGroup(
        features=("podcast",),
        routers=("api.podcast.router:router",),
    ),
    "youtube": FeatureGroup(
        features=("youtube",),
        routers=("api.youtube.router:router",),
    ),
    "content_planning": FeatureGroup(
        features=("content_planning", "strategy_copilot"),
        routers=(
            "api.content_planning.api.router:router",
            "api.content_planning.strategy_copilot:router",
        ),
    ),
    "blog_writer": FeatureGroup(
        features=("blog_writer",),
        routers=(
            "api.blog_writer.router:router",
            "api.blog_writer.seo_analysis:router",
        ),
    ),
    "backlinking": FeatureGroup(
        features=("backlinking",),
        routers=("routers.backlink_outreach:router",),
    ),
    "linkedin": FeatureGroup(
        features=("linkedin",),
        routers=(
            "routers.linkedin:router",
            "api.linkedin_image_generation:router",
            "api.linkedin_video_generation:router",
        ),
    ),
    "facebook": FeatureGroup(
        features=("facebook",),
        routers=("api.facebook_writer.routers:facebook_router",),
    ),
}


PROFILE_GROUP_MAP: Dict[str, Tuple[str, ...]] = {
    "all": tuple(FEATURE_GROUPS.keys()),
    "core": ("core",),
    "podcast": ("core", "podcast"),
    "youtube": ("core", "youtube"),
    "blog_writer": ("core", "blog_writer"),
    "backlinking": ("core", "backlinking"),
    "linkedin": ("core", "linkedin"),
    "facebook": ("core", "facebook"),
    "planning": ("core", "content_planning"),
}
