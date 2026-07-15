"""Minimal auth dependency for the GIF Maker router.

No Clerk, no database, no ALwrity middleware — just an optional shared secret
passed via header. When ``ALWRITY_GIF_MAKER_KEY`` is not set, all requests
are allowed (internal/dev mode).
"""

import os
from typing import Optional

from fastapi import Header, HTTPException

# Cache the expected key at module load time — avoids os.environ lookup
# on every single request.
_GIF_MAKER_KEY: Optional[str] = None


def _get_expected_key() -> Optional[str]:
    """Return the configured API key, or None if auth is disabled."""
    global _GIF_MAKER_KEY
    if _GIF_MAKER_KEY is None:
        _GIF_MAKER_KEY = os.environ.get("ALWRITY_GIF_MAKER_KEY", "") or None
    return _GIF_MAKER_KEY


async def verify_api_key(
    x_gif_maker_key: Optional[str] = Header(None),
) -> None:
    """FastAPI dependency that optionally validates ``X-Gif-Maker-Key``.

    If ``ALWRITY_GIF_MAKER_KEY`` is set in the environment, this dependency
    requires the incoming request to carry a matching header.

    If the env var is unset or empty, all requests pass through (no auth).
    """
    expected = _get_expected_key()
    if expected is not None and x_gif_maker_key != expected:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing GIF Maker API key. "
                   "Set the X-Gif-Maker-Key header.",
        )
