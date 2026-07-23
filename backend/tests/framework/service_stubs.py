"""Service-level stubs and mocks for tests.

These are reusable building blocks — they don't replace the higher-level
fixtures in suite-level conftest files, they just hold shared logic:

* :func:`install_llm_image_stubs` — installs the ``generate_image_*``
  no-ops used by LinkedIn publish / image generation modules in tests.
* :class:`InMemoryOAuthService` — a one-line ``LinkedInOAuthService``
  replacement if a test wants to skip Fernet/DB entirely.

The default filesystem and DB mocks (e.g. ``temp_user_db``) live in
``tests/conftest.py`` because they touch infrastructure shared with
other features (WordPress, Bing, Wix). LinkedIn-specific service mocks
belong here so they can be reused across the LinkedIn suite as it grows.
"""

from __future__ import annotations

import sys
import types
from typing import Any, Dict, Optional


def _ensure_module(name: str) -> types.ModuleType:
    """Return ``sys.modules[name]``, creating it (with __path__) if absent."""
    if name in sys.modules:
        return sys.modules[name]
    mod = types.ModuleType(name)
    # If ``name`` has dots we need to make sure the parent package exists.
    if "." in name:
        parent_name, _, child = name.rpartition(".")
        parent = _ensure_module(parent_name)
        if not hasattr(parent, "__path__"):
            # Parent wasn't a package — give it a minimal __path__ so
            # ``import name.child`` resolves.
            raise RuntimeError(
                f"Cannot install fake module {name!r}; parent {parent_name!r} is not a package"
            )
        setattr(parent, child, mod)
    sys.modules[name] = mod
    return mod


def install_llm_image_stubs() -> types.ModuleType:
    """Install the no-op LLM image module used by LinkedIn tests.

    Idempotent. If the module is already in ``sys.modules`` (typically
    because :mod:`tests.conftest` installed an earlier stub), augment
    it with the symbols we need rather than replacing it — the
    ``generate_image`` shim is required by the publish / growth /
    image / video routers even when the older stub is in place.

    Returns the module so tests can adjust behaviour if they need a
    different canned answer.
    """
    parent = _ensure_module("services")
    parent.__path__ = getattr(parent, "__path__", []) or []
    pkg = _ensure_module("services.llm_providers")
    pkg.__path__ = getattr(pkg, "__path__", []) or []

    name = "services.llm_providers.main_image_generation"
    existing = sys.modules.get(name)
    if existing is not None:
        mod = existing
    else:
        mod = types.ModuleType(name)
        sys.modules[name] = mod

    async def _enhance_image_prompt(prompt, user_id=None):
        return prompt

    async def generate_image_variation(*args, **kwargs):
        return {"url": "", "variations": []}

    async def generate_image(*args, **kwargs):
        # Default stub for tests that need *some* image. Tests that
        # want a specific image should patch this out.
        return {"url": "https://stub.invalid/image.png"}

    # Always overwrite the generated stubs so tests get a known baseline.
    mod._enhance_image_prompt = _enhance_image_prompt
    mod.generate_image_variation = generate_image_variation
    if not hasattr(mod, "generate_image"):
        mod.generate_image = generate_image
    return mod
