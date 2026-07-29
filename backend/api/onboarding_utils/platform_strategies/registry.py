"""
Platform Strategy Registry
==========================

Single source of truth for mapping ``onboarding_type`` -> strategy instance.
New platforms register themselves here so callers can look them up via
:func:`get_strategy`.
"""

from __future__ import annotations

from typing import Dict, Optional

from .base import PlatformOnboardingStrategy, WEBSITE_TYPE


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

PLATFORM_STRATEGIES: Dict[str, PlatformOnboardingStrategy] = {}


def register_strategy(strategy: PlatformOnboardingStrategy) -> None:
    """Register a strategy instance under its ``onboarding_type`` key."""
    key = strategy.onboarding_type
    PLATFORM_STRATEGIES[key] = strategy


def get_strategy(onboarding_type: Optional[str]) -> PlatformOnboardingStrategy:
    """Return the strategy for a given type, defaulting to ``website``.

    This default guarantees that legacy sessions (which may have ``None``
    or the implicit ``"website"`` value) are never left without a handler.
    """
    if not onboarding_type or onboarding_type not in PLATFORM_STRATEGIES:
        return PLATFORM_STRATEGIES[WEBSITE_TYPE]
    return PLATFORM_STRATEGIES[onboarding_type]


# ---------------------------------------------------------------------------
# Eager import + registration of the website strategy
# ---------------------------------------------------------------------------

# Importing here (rather than at the module top) creates the canonical
# registration order: website first (default fallback), then any future
# platforms that will be added below.
from .website_strategy import WebsiteOnboardingStrategy  # noqa: E402
from .linkedin_strategy import LinkedInOnboardingStrategy  # noqa: E402

register_strategy(WebsiteOnboardingStrategy())
register_strategy(LinkedInOnboardingStrategy())