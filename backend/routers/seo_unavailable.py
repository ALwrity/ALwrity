"""Slim-mode stub for /api/seo/* (and any prefixed SEO surface) — fail fast
with 503 JSON, never silent 404.

Mounted by app.py when NOT in full mode (ALWRITY_ENABLED_FEATURES != all).
Deliberately dependency-free: importing the real seo_tools router would pull
heavy services (seo_analyzer, advertools) that slim modes skip for memory.

Fail-fast contract: every method + subpath under the prefix returns 503 with
reason "full-mode-only" so clients get an actionable error instead of 404.

Phase 2 (mount parity): the builder is parametrized so the same fail-fast
contract covers /api/seo-dashboard/* too — it was previously a silent 404 in
slim modes. Defaults keep the original /api/seo behavior byte-identical.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

_UNAVAILABLE_BODY = {
    "success": False,
    "message": "SEO tools require full mode (ALWRITY_ENABLED_FEATURES=all).",
    "reason": "full-mode-only",
}


def build_seo_unavailable_router(
    prefix: str = "/api/seo",
    tag: str = "AI SEO Tools",
    feature_label: str = "SEO tools",
) -> APIRouter:
    """Build a 503 catch-all stub covering all paths under `prefix`.

    Phase 2: parametrized (prefix / tag / feature_label) so app.py can mount
    the identical fail-fast contract for both the /api/seo and /api/seo-dashboard
    namespaces without duplicating the handler. Defaults are exact back-compat.
    """
    stub = APIRouter(prefix=prefix, tags=[tag])

    # Body mirrors _UNAVAILABLE_BODY but names the affected surface.
    unavailable_body = {
        "success": False,
        "message": f"{feature_label} require full mode (ALWRITY_ENABLED_FEATURES=all).",
        "reason": "full-mode-only",
    }

    @stub.api_route(
        "/{subpath:path}",
        methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    )
    async def _seo_unavailable() -> JSONResponse:
        return JSONResponse(status_code=503, content=dict(unavailable_body))

    return stub
