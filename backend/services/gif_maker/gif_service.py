"""Pure Pillow GIF stitching. No FastAPI, no auth, no DB imports.

This module is intentionally decoupled from the rest of the ALwrity codebase.
It can be copied to any Python project and used independently.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import List, Sequence

from PIL import Image

from .exceptions import GifServiceError


# ── Constants ──────────────────────────────────────────────────────────────
MAX_FRAMES = 50
"""Hard limit on the number of frames to prevent resource exhaustion."""

MAX_DIMENSION = 4096
"""Maximum width or height in pixels. 4K screenshots are the practical ceiling."""

MAX_TOTAL_PAYLOAD_MB = 50
"""Maximum total size of all uploaded frames combined."""

MIN_DURATION_MS = 50
"""Below this, the GIF would flash by too fast to be useful."""

MIN_FRAMES = 2
"""An animation needs at least two frames."""

MIN_MAX_WIDTH = 100
"""Practical lower bound for the auto-downscale target."""

# Pillow-native optimization levels (no gifsicle or other system deps)
OPTIMIZE_OFF = 0
"""No extra optimization beyond Pillow's built-in ``optimize=True``."""

OPTIMIZE_DEDUP = 1
"""Remove consecutive duplicate frames and merge their durations."""

OPTIMIZE_AGGRESSIVE = 2
"""Level 1 + use 128 colors instead of 256 (smaller palette ≈ smaller file)."""

OPTIMIZE_MAX = 3
"""Level 2 + use 64 colors with Floyd-Steinberg dithering (maximum compression)."""


# ── Result type ────────────────────────────────────────────────────────────
@dataclass
class GifStitchResult:
    """Result of a successful GIF stitching operation."""
    data: bytes
    """The raw GIF file bytes."""

    width: int
    """Width of the output GIF in pixels."""

    height: int
    """Height of the output GIF in pixels."""

    num_frames: int
    """Number of frames in the animation."""

    size_bytes: int
    """Size of the GIF data in bytes."""


# ── Service ────────────────────────────────────────────────────────────────
class GifService:
    """Self-contained GIF stitching engine.

    Zero dependencies on FastAPI, ASGI, or any web framework.
    Takes raw image bytes, returns raw GIF bytes.
    """

    # ------------------------------------------------------------------
    @staticmethod
    def _build_shared_palette(
        frames: Sequence[Image.Image],
        num_colors: int = 256,
    ) -> Image.Image:
        """Build a single optimized palette from the brightest frame
        and apply it uniformly.

        This produces a **smaller file** than per-frame palettes because
        unchanged UI elements (nav bar, sidebar, background) reuse the same
        color indices across all frames, improving GIF LZW compression.

        The frame with the highest total pixel luminosity is chosen as the
        palette source since it's most likely to cover the full color range.

        Args:
            frames: List of RGB images.
            num_colors: Number of palette colors (256, 64, 32, etc.).
                        Lower values reduce file size but may show banding.

        Returns:
            A ``P`` mode image whose palette will be used for quantization.
        """
        source = max(frames, key=lambda f: sum(sum(pixel) for pixel in f.getdata()))  # type: ignore[arg-type]
        return source.quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT)

    # ------------------------------------------------------------------
    @staticmethod
    def _validate_raw_bytes(data: bytes, index: int) -> None:
        """Basic validation of raw frame bytes before opening with Pillow."""
        if len(data) == 0:
            raise GifServiceError(f"Frame {index} is empty (0 bytes)")

    @staticmethod
    def _validate_frame(img: Image.Image, index: int) -> None:
        """Validate a decoded PIL Image against size constraints."""
        if max(img.width, img.height) > MAX_DIMENSION:
            raise GifServiceError(
                f"Frame {index} is {img.width}x{img.height} — "
                f"exceeds max dimension {MAX_DIMENSION}px"
            )

    # ------------------------------------------------------------------
    @staticmethod
    def _remove_duplicate_frames(
        frames: List[Image.Image],
        durations: List[int],
    ) -> tuple[List[Image.Image], List[int]]:
        """Merge consecutive identical frames to reduce file size.

        When two adjacent frames are pixel-identical (after quantization),
        the later one is removed and its duration is added to the earlier
        one. This is common in UI flows where nothing changes between
        captures (e.g., waiting for an animation to play out).

        Returns the deduplicated (frames, durations) pair with at least
        one frame remaining.
        """
        if len(frames) < 2:
            return frames, durations

        deduped_frames: List[Image.Image] = [frames[0]]
        deduped_durations: List[int] = [durations[0]]

        for i in range(1, len(frames)):
            prev = deduped_frames[-1]
            curr = frames[i]

            # Compare raw pixel data
            if prev.tobytes() == curr.tobytes():
                # Merge duration
                deduped_durations[-1] += durations[i]
            else:
                deduped_frames.append(curr)
                deduped_durations.append(durations[i])

        return deduped_frames, deduped_durations

    # ------------------------------------------------------------------
    @staticmethod
    def _quantize_frames(
        frames: List[Image.Image],
        shared_palette: bool,
        num_colors: int = 256,
    ) -> List[Image.Image]:
        """Quantize frames to a shared or per-frame palette.

        Args:
            frames: List of RGB images to quantize.
            shared_palette: If True, one palette for all frames.
            num_colors: Number of colors in the output palette
                        (256, 128, 64, etc.).  Lower = smaller files.

        Returns:
            List of quantized (``P`` mode) images.
        """
        if shared_palette and len(frames) > 1:
            palette_img = GifService._build_shared_palette(frames, num_colors)
            quantized: List[Image.Image] = []
            for img in frames:
                q = img.quantize(
                    colors=num_colors,
                    palette=palette_img,
                    dither=Image.Dither.NONE,
                )
                quantized.append(q)
            return quantized
        else:
            return [
                img.quantize(
                    colors=num_colors,
                    dither=Image.Dither.FLOYDSTEINBERG,
                )
                for img in frames
            ]

    # ------------------------------------------------------------------
    @staticmethod
    def stitch(
        frames: List[bytes],
        duration: int = 1500,
        end_frame_delay: int = 3000,
        max_width: int = 800,
        loop: int = 0,
        shared_palette: bool = True,
        optimize_level: int = OPTIMIZE_OFF,
    ) -> GifStitchResult:
        """Stitch raw image bytes into an animated GIF.

        Args:
            frames:
                List of raw image file bytes (PNG, JPEG, WebP, etc.).
                At least 2 frames required, at most ``MAX_FRAMES``.
            duration:
                Display duration per frame in milliseconds.
                Default 1500 (1.5 s).
            end_frame_delay:
                Extra milliseconds added to the **last** frame, so viewers
                have time to read the final state before the loop restarts.
                Default 3000 (3 s).
            max_width:
                Images wider than this are downscaled proportionally.
                Default 800 px — legible in Slack/Teams/docs.
            loop:
                0 = infinite loop. Any positive integer = that many repetitions.
            shared_palette:
                If True (default), compute a single palette across all frames
                for better compression. If False, each frame gets its own
                palette (may be necessary for very different-looking frames).
            optimize_level:
                0 = no extra optimization (default).
                1 = remove consecutive duplicate frames (merge durations).
                    Visually lossless — safe for any content.
                2 = level 1 + 64-color shared palette.
                    Reduces file size for UI screenshots with limited
                    color ranges. May show minor banding in gradients.
                3 = level 1 + 32-color shared palette.
                    Maximum compression. Best for simple UI flows with
                    solid colors. Visible banding in gradients.

        Returns:
            :class:`GifStitchResult` containing the GIF bytes and metadata.

        Raises:
            GifServiceError:
                On validation failure, corrupt images, or Pillow encoding errors.
        """
        # ── Input validation ──────────────────────────────────────────
        if len(frames) < MIN_FRAMES:
            raise GifServiceError(
                f"Need at least {MIN_FRAMES} frames to create an animation, "
                f"got {len(frames)}"
            )
        if len(frames) > MAX_FRAMES:
            raise GifServiceError(
                f"Maximum {MAX_FRAMES} frames allowed, got {len(frames)}"
            )
        if duration < MIN_DURATION_MS:
            raise GifServiceError(
                f"Duration must be at least {MIN_DURATION_MS}ms, got {duration}"
            )
        if max_width < MIN_MAX_WIDTH:
            raise GifServiceError(
                f"max_width must be at least {MIN_MAX_WIDTH}px, got {max_width}"
            )
        if optimize_level not in (OPTIMIZE_OFF, OPTIMIZE_DEDUP, OPTIMIZE_AGGRESSIVE, OPTIMIZE_MAX):
            raise GifServiceError(
                f"optimize_level must be 0-3, got {optimize_level}"
            )

        # ── Parse and validate frames ─────────────────────────────────
        pil_frames: List[Image.Image] = []
        for i, raw_bytes in enumerate(frames):
            GifService._validate_raw_bytes(raw_bytes, i)
            try:
                img = Image.open(io.BytesIO(raw_bytes))
                img = img.convert("RGB")
            except Exception as exc:
                raise GifServiceError(
                    f"Frame {i} is not a valid image: {exc}"
                ) from exc
            GifService._validate_frame(img, i)
            pil_frames.append(img)

        # ── Downscale ─────────────────────────────────────────────────
        processed: List[Image.Image] = []
        for img in pil_frames:
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.LANCZOS)
            processed.append(img)

        # ── Apply optimize_level ──────────────────────────────────────
        # Level 0: no dedup, 256 colors (default Pillow behavior)
        # Level 1: dedup only (visually lossless)
        # Level 2: dedup + 64-color shared palette (good for UI screenshots)
        # Level 3: dedup + 32-color shared palette (maximum compression)

        if optimize_level >= OPTIMIZE_MAX:
            num_colors = 32
        elif optimize_level >= OPTIMIZE_AGGRESSIVE:
            num_colors = 64
        else:
            num_colors = 256

        # Shared palette works well for all levels when frames share
        # a common UI theme. Per-frame palette can be forced via arg.
        effective_shared = shared_palette

        # ── Palette quantization ──────────────────────────────────────
        processed = GifService._quantize_frames(processed, effective_shared, num_colors)

        # ── Frame delays ──────────────────────────────────────────────
        frame_durations = [duration] * len(processed)
        frame_durations[-1] += end_frame_delay

        # ── Duplicate frame removal (opt level 1+) ────────────────────
        if optimize_level >= OPTIMIZE_DEDUP:
            processed, frame_durations = GifService._remove_duplicate_frames(
                processed, frame_durations
            )

        # ── Stitch ────────────────────────────────────────────────────
        buf = io.BytesIO()
        save_kwargs = dict(
            format="GIF",
            save_all=True,
            append_images=processed[1:],
            duration=frame_durations,
            loop=loop,
            optimize=True,
        )
        try:
            processed[0].save(buf, **save_kwargs)
        except Exception as exc:
            raise GifServiceError(f"GIF encoding failed: {exc}") from exc

        data = buf.getvalue()

        return GifStitchResult(
            data=data,
            width=processed[0].width,
            height=processed[0].height,
            num_frames=len(processed),
            size_bytes=len(data),
        )
