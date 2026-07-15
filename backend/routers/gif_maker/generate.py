"""POST /api/gif-maker/generate — thin HTTP adapter.

Receives image frames and settings from the frontend, delegates to the
pure ``GifService.stitch()`` (off the event loop), and returns the
generated GIF as a streaming response.

No ALwrity auth, database, or middleware dependencies.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from services.gif_maker.gif_service import (
    GifService,
    GifServiceError,
    MAX_TOTAL_PAYLOAD_MB,
)
from services.gif_maker.utils import run_in_executor
from .auth_dependency import verify_api_key

router = APIRouter()

# ── Concurrency guard ─────────────────────────────────────────────────────
# Limit concurrent CPU-bound Pillow operations to prevent OOM when
# multiple large GIFs are requested simultaneously.
_GENERATE_SEMAPHORE = asyncio.Semaphore(2)


@router.post("/generate")
async def generate_gif(
    # ── Frames ──────────────────────────────────────────────────────────────
    files: list[UploadFile] = File(
        ...,
        min_length=2,
        max_length=50,
        description="Image frames in order (PNG, JPEG, WebP). At least 2, at most 50.",
    ),
    # ── Settings ────────────────────────────────────────────────────────────
    duration: int = Form(
        1500,
        description="Display duration per frame in milliseconds.",
        ge=50,
        le=30000,
    ),
    end_frame_delay: int = Form(
        3000,
        description="Extra milliseconds added to the last frame (final-frame freeze).",
        ge=0,
        le=30000,
    ),
    max_width: int = Form(
        800,
        description="Auto-downscale images wider than this (pixels).",
        ge=100,
        le=4096,
    ),
    loop: int = Form(
        0,
        description="0 = infinite loop, N = repeat N times.",
        ge=0,
        le=100,
    ),
    shared_palette: bool = Form(
        True,
        description="If true, use one palette for all frames (smaller file).",
    ),
    optimize_level: int = Form(
        0,
        description="Pillow-native optimization level. "
                    "0=off, 1=dedup frames (lossless), "
                    "2=64-color palette, 3=32-color palette. "
                    "Higher = smaller file, potentially lower quality.",
        ge=0,
        le=3,
    ),
    # ── Auth ────────────────────────────────────────────────────────────────
    _: None = Depends(verify_api_key),
):
    """Generate an animated GIF from uploaded image frames.

    Accepts 2–50 image files plus animation settings via multipart form data.
    Returns the GIF binary with ``Content-Disposition: attachment`` for
    direct download.

    ## Optimization levels

    - **0** — Default. Pillow's ``optimize=True`` only (256 colors).
    - **1** — Remove consecutive duplicate frames (merge durations).
              Visually lossless — safe for any content.
    - **2** — Level 1 + 64-color shared palette.
              Good for UI screenshots with limited color ranges.
    - **3** — Level 1 + 32-color shared palette.
              Maximum compression. Best for simple UI flows with
              mostly solid colors. Noticeable banding in gradients.

    ## Error codes

    - **400** — Non-image file, empty file
    - **403** — Invalid or missing ``X-Gif-Maker-Key`` header
    - **413** — Total upload exceeds ``MAX_TOTAL_PAYLOAD_MB``
    - **422** — Fewer than 2 frames, frame exceeds max dimensions,
                corrupt image, or Pillow encoding failure
    """
    # ── Read and validate file bytes ────────────────────────────────────
    frame_bytes: list[bytes] = []
    for f in files:
        # Content-type sanity check
        if f.content_type and not f.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' is not an image (content-type: {f.content_type})",
            )
        raw = await f.read()
        if len(raw) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' is empty (0 bytes)",
            )
        frame_bytes.append(raw)

    # ── Total payload guard ─────────────────────────────────────────────
    total_mb = sum(len(b) for b in frame_bytes) / (1024 * 1024)
    if total_mb > MAX_TOTAL_PAYLOAD_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Total upload {total_mb:.1f} MB exceeds "
                   f"{MAX_TOTAL_PAYLOAD_MB} MB limit",
        )

    # ── Stitch (CPU-bound → run_in_executor, concurrency-limited) ───────
    async with _GENERATE_SEMAPHORE:
        try:
            result = await run_in_executor(
                GifService.stitch,
                frame_bytes,
                duration,
                end_frame_delay,
                max_width,
                loop,
                shared_palette,
                optimize_level,
            )
        except GifServiceError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    # ── Return GIF binary with metadata headers ─────────────────────────
    from fastapi.responses import Response

    return Response(
        content=result.data,
        media_type="image/gif",
        headers={
            "Content-Disposition": 'attachment; filename="ui-flow.gif"',
            "X-Gif-Size-Bytes": str(result.size_bytes),
            "X-Gif-Frames": str(result.num_frames),
            "X-Gif-Width": str(result.width),
            "X-Gif-Height": str(result.height),
        },
    )
