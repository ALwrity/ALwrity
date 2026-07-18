"""Standalone GIF Maker router.

Mount anywhere with::

    from routers.gif_maker import router
    app.include_router(router)
"""

from fastapi import APIRouter

from .generate import router as generate_router
from .capture import router as capture_router
from .save import router as save_router

router = APIRouter(prefix="/api/gif-maker", tags=["GIF Maker"])

# ── POST /api/gif-maker/generate ───────────────────────────────────────────
router.include_router(generate_router)

# ── POST /api/gif-maker/capture-url (501 if Playwright absent) ─────────────
router.include_router(capture_router)

# ── POST /api/gif-maker/save-session ────────────────────────────────────────
router.include_router(save_router)

__all__ = ["router"]
