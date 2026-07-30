"""
ALwrity Utilities Package
Modular utilities for ALwrity backend startup and configuration.
"""

import os

# Check feature mode early to skip heavy imports
_is_full_mode = os.getenv("ALWRITY_ENABLED_FEATURES", "").strip().lower() in ("", "all")

from .dependency_manager import DependencyManager
from .environment_setup import EnvironmentSetup
from .database_setup import DatabaseSetup
from .production_optimizer import ProductionOptimizer
from .health_checker import HealthChecker
from .rate_limiter import RateLimiter
from .frontend_serving import FrontendServing
from .router_manager import RouterManager
from .feature_runtime import (
    get_active_profiles,
    get_enabled_groups,
    get_enabled_optional_services,
    get_enabled_routers,
    get_enabled_startup_hooks,
    is_enabled,
)

# OnboardingManager triggers heavy imports (aiohttp, scheduler, all endpoint modules).
# Only load in full mode — feature-only deployments skip it for lean startup.
if _is_full_mode:
    from .onboarding_manager import OnboardingManager
else:
    OnboardingManager = None  # type: ignore[assignment]

__all__ = [
    'DependencyManager',
    'EnvironmentSetup', 
    'DatabaseSetup',
    'ProductionOptimizer',
    'HealthChecker',
    'RateLimiter',
    'FrontendServing',
    'RouterManager',
    'OnboardingManager',
    'get_active_profiles',
    'get_enabled_groups',
    'get_enabled_optional_services',
    'get_enabled_routers',
    'get_enabled_startup_hooks',
    'is_enabled'
]
