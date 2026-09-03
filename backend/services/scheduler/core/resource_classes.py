"""Resource classes for scheduler executors.

Each executor type belongs to a resource class that controls its
concurrency limit and timeout. This prevents heavy crawls from starving
light tasks and ensures stuck executors are cancelled.

Classes:
    HEAVY:  Website crawls, multi-site analysis, LLM-heavy pipelines.
            Low concurrency, long timeout.
    MEDIUM: DB-intensive writes, trend fetches, reanalysis.
            Moderate concurrency, moderate timeout.
    LIGHT:  Status checks, token validations, profile syncs.
            High concurrency, short timeout.
"""

from enum import Enum
from typing import Dict


class ResourceClass(Enum):
    HEAVY = "heavy"
    MEDIUM = "medium"
    LIGHT = "light"


# Per-class concurrency limits: how many tasks of this class may run
# simultaneously. HEAVY tasks are CPU/IO-intensive and should not exceed
# a small pool; LIGHT tasks are cheap and can run in parallel.
CLASS_LIMITS: Dict[ResourceClass, int] = {
    ResourceClass.HEAVY: 3,
    ResourceClass.MEDIUM: 4,
    ResourceClass.LIGHT: 5,
}

# Per-class timeout in seconds: how long a task of this class may run
# before being cancelled. HEAVY tasks (crawls) get the most time.
CLASS_TIMEOUTS: Dict[ResourceClass, float] = {
    ResourceClass.HEAVY: 600.0,   # 10 min
    ResourceClass.MEDIUM: 120.0,  # 2 min
    ResourceClass.LIGHT: 30.0,    # 30 s
}


def get_resource_class(task_type: str) -> ResourceClass:
    """Return the resource class for a task type based on its name.

    This is the fallback mapping used when an executor is registered
    without an explicit resource_class. New executors should pass an
    explicit class to register_executor().
    """
    heavy_types = {
        "deep_competitor_analysis", "sif_indexing", "deep_website_crawl",
        "onboarding_full_website_analysis",
    }
    light_types = {
        "monitoring_task", "oauth_token_monitoring", "gsc_insights",
        "bing_insights", "linkedin_profile_sync",
        "linkedin_post_analytics_sync",
    }
    if task_type in heavy_types:
        return ResourceClass.HEAVY
    if task_type in light_types:
        return ResourceClass.LIGHT
    return ResourceClass.MEDIUM
