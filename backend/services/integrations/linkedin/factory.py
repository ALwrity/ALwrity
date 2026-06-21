"""
Factory for LinkedIn Social providers.
"""

from __future__ import annotations

import os
from functools import lru_cache

from services.integrations.linkedin.native_provider import NativeLinkedInProvider
from services.integrations.linkedin.protocol import LinkedInSocialProvider
from services.integrations.linkedin.unipile_provider import UnipileProvider
from services.integrations.linkedin.zernio_provider import ZernioProvider


@lru_cache(maxsize=1)
def _zernio_singleton() -> ZernioProvider:
    return ZernioProvider()


@lru_cache(maxsize=1)
def _native_singleton() -> NativeLinkedInProvider:
    return NativeLinkedInProvider()


@lru_cache(maxsize=1)
def _unipile_singleton() -> UnipileProvider:
    return UnipileProvider()


def get_linkedin_provider() -> LinkedInSocialProvider:
    """
    Return the configured LinkedIn platform provider.

    Controlled by LINKEDIN_PROVIDER env var:
    - 'zernio' (default) - Legacy Zernio provider
    - 'unipile' - Unipile hosted auth (Phase 1 - Connection Only)
    - 'native' - Direct LinkedIn Marketing API (not yet implemented)
    """
    mode = os.getenv("LINKEDIN_PROVIDER", "zernio").lower()
    if mode == "native":
        return _native_singleton()
    elif mode == "unipile":
        return _unipile_singleton()
    return _zernio_singleton()


def reset_linkedin_provider_cache() -> None:
    """Clear cached provider instances (for tests)."""
    _zernio_singleton.cache_clear()
    _native_singleton.cache_clear()
    _unipile_singleton.cache_clear()
