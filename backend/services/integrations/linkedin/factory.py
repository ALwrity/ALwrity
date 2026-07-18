"""
Factory for LinkedIn Social providers.

Default (and only production) provider is Unipile.
"""

from __future__ import annotations

import os
from functools import lru_cache

from services.integrations.linkedin.native_provider import NativeLinkedInProvider
from services.integrations.linkedin.protocol import LinkedInSocialProvider
from services.integrations.linkedin.unipile_provider import UnipileProvider

DEFAULT_LINKEDIN_PROVIDER = "unipile"


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
    - 'unipile' (default) — Unipile hosted auth / LinkedIn ops
    - 'native' — Direct LinkedIn Marketing API (not yet implemented)
    """
    mode = os.getenv("LINKEDIN_PROVIDER", DEFAULT_LINKEDIN_PROVIDER).strip().lower()
    if mode == "native":
        return _native_singleton()
    if mode and mode not in ("unipile", "native"):
        # Unknown values (including legacy 'zernio') fall back to Unipile.
        pass
    return _unipile_singleton()


def reset_linkedin_provider_cache() -> None:
    """Clear cached provider instances (for tests)."""
    _native_singleton.cache_clear()
    _unipile_singleton.cache_clear()
