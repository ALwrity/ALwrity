"""POST /api/gif-maker/capture-url — headless URL screenshot via Playwright.

Returns a PNG image of the page suitable for use as a GIF frame.

Optional feature: returns **501 Not Implemented** when Playwright is not
installed. Guard is a module-level boolean, not a runtime import — never
throws ``ModuleNotFoundError`` at startup.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Form, HTTPException, Response

from .auth_dependency import verify_api_key

router = APIRouter()

# ── Playwright availability guard (checked at import time) ────────────────────

PLAYWRIGHT_AVAILABLE: bool = False
try:
    from playwright.async_api import async_playwright  # noqa: F401

    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    pass

# ── Constants ─────────────────────────────────────────────────────────────────

NAVIGATION_TIMEOUT_MS = 30_000
"""Maximum time to wait for the page to load before giving up."""

MAX_DIMENSION = 4096
"""Reject viewport dimensions larger than 4K (same ceiling as GifService)."""


@router.post("/capture-url")
async def capture_url(
    url: str = Form(..., description="Full URL to capture (must include scheme)."),
    viewport_width: int = Form(
        1280,
        description="Viewport width in pixels.",
        ge=320,
        le=MAX_DIMENSION,
    ),
    viewport_height: int = Form(
        800,
        description="Viewport height in pixels.",
        ge=240,
        le=MAX_DIMENSION,
    ),
    full_page: bool = Form(
        False,
        description="If true, capture the full scrollable page height.",
    ),
    _: None = Depends(verify_api_key),
):
    """Capture a screenshot of the given URL using a headless browser.

    Returns a **PNG image** with ``Content-Disposition: inline`` so it can
    be displayed directly in the browser or used as a GIF frame.

    ## Error codes

    - **400** — Invalid URL (missing scheme), or viewport exceeds limits
    - **403** — Invalid or missing ``X-Gif-Maker-Key`` header
    - **422** — Navigation failed (timeout, DNS error, HTTP error)
    - **501** — Playwright is not installed on this server
    """
    # ── Guard: Playwright not installed ────────────────────────────────
    if not PLAYWRIGHT_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="Playwright is not installed. "
            "To enable URL capture, run:\n"
            "  pip install playwright && playwright install chromium",
        )

    # ── URL validation ──────────────────────────────────────────────────
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="URL must start with http:// or https:// (e.g. https://example.com)",
        )

    # ── Capture via Playwright ──────────────────────────────────────────
    try:
        png_bytes = await _screenshot(
            url=url,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
            full_page=full_page,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to capture '{url}': {exc}",
        ) from exc

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="capture-{_sanitize_host(url)}.png"',
            "X-Capture-Width": str(viewport_width),
            "X-Capture-Height": str(viewport_height),
        },
    )


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _screenshot(
    url: str,
    viewport_width: int,
    viewport_height: int,
    full_page: bool,
) -> bytes:
    """Launch headless Chromium, navigate to *url*, return PNG bytes.

    All resources (browser, context, page) are cleaned up via context
    managers regardless of success or failure.
    """
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                device_scale_factor=1,
            )
            page = await context.new_page()

            # Navigate with timeout
            await page.goto(url, timeout=NAVIGATION_TIMEOUT_MS, wait_until="networkidle")

            # Wait an extra beat for any deferred rendering / fonts
            await page.wait_for_timeout(500)

            png_bytes = await page.screenshot(full_page=full_page, type="png")
            return png_bytes
        finally:
            await browser.close()


def _sanitize_host(url: str) -> str:
    """Extract a filesystem-safe hostname from a URL."""
    host = url.split("://")[-1].split("/")[0].split("?")[0].split("@")[-1]
    return host.replace(".", "-").replace(":", "-")
