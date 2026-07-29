"""
Platform Onboarding Strategies
=============================

Framework for dispatching onboarding step logic based on the platform type
(``OnboardingSession.onboarding_type``).  Each platform (website, linkedin,
instagram, youtube, ...) registers a :class:`PlatformOnboardingStrategy`
implementation that owns the platform-specific concerns:

    - Data persistence for each step
    - Background task scheduling
    - SIF semantic index sync

The dispatcher (:func:`get_strategy`) returns the strategy for a given
``onboarding_type`` string, defaulting to ``"website"`` for unknown/legacy
values so the existing website flow is never broken.
"""

from .base import PlatformOnboardingStrategy
from .registry import get_strategy, register_strategy, PLATFORM_STRATEGIES

__all__ = [
    "PlatformOnboardingStrategy",
    "get_strategy",
    "register_strategy",
    "PLATFORM_STRATEGIES",
]