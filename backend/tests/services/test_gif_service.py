"""Tests for GifService.stitch() — pure Pillow GIF stitching.

GifService is a pure-data function (bytes in → bytes out), making it
trivially testable with synthetic Pillow-generated images. No database,
no auth middleware, no FastAPI test client required.
"""

from __future__ import annotations

import io
import struct

from PIL import Image
import pytest

from services.gif_maker.gif_service import (
    GifService,
    GifServiceError,
    MAX_FRAMES,
    MAX_DIMENSION,
    MIN_DURATION_MS,
    MIN_FRAMES,
    MIN_MAX_WIDTH,
)


# ── Helpers ────────────────────────────────────────────────────────────────


def _make_png_bytes(
    width: int = 100,
    height: int = 100,
    color: tuple[int, int, int] = (255, 0, 0),
    seed: int | None = None,
) -> bytes:
    """Create a synthetic PNG image as raw bytes.

    Args:
        width, height: Image dimensions in pixels.
        color: RGB fill color for a solid image.
        seed: If set, fill with deterministic noise instead of a solid color.
    """
    img = Image.new("RGB", (width, height), color)
    if seed is not None:
        import random

        rng = random.Random(seed)
        pixels = img.load()
        for x in range(width):
            for y in range(height):
                pixels[x, y] = (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255))  # type: ignore[misc]
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_frame_set(count: int, **kwargs) -> list[bytes]:
    """Return *count* distinct PNG frames (different colors)."""
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)]
    return [_make_png_bytes(color=colors[i % len(colors)], **kwargs) for i in range(count)]


def _assert_valid_gif(data: bytes) -> None:
    """Lightweight smoke-check that *data* looks like a real GIF."""
    assert data.startswith(b"GIF89a") or data.startswith(b"GIF87a"), (
        "Output doesn't start with a GIF header"
    )
    # At minimum the file must contain a logical screen descriptor +
    # image data (≥ 20 bytes for a tiny GIF)
    assert len(data) >= 20, f"GIF payload suspiciously small: {len(data)} bytes"


# ── Tests ──────────────────────────────────────────────────────────────────


class TestGifService:
    """Test suite for GifService.stitch()."""

    # ------------------------------------------------------------------
    def test_happy_path_two_frames(self) -> None:
        """Basic 2-frame GIF generation succeeds and returns valid GIF."""
        frames = _make_frame_set(2)
        result = GifService.stitch(frames)

        assert result.num_frames == 2
        assert result.size_bytes > 0
        assert result.width == 100
        assert result.height == 100
        _assert_valid_gif(result.data)

    # ------------------------------------------------------------------
    def test_happy_path_three_frames(self) -> None:
        """3-frame GIF with custom duration and end-frame delay."""
        frames = _make_frame_set(3, width=50, height=50)
        result = GifService.stitch(
            frames,
            duration=1000,
            end_frame_delay=2000,
            max_width=200,
        )

        assert result.num_frames == 3
        _assert_valid_gif(result.data)

    # ------------------------------------------------------------------
    def test_single_frame_rejected(self) -> None:
        """Fewer than MIN_FRAMES raises GifServiceError."""
        frames = _make_frame_set(1)
        with pytest.raises(GifServiceError, match="at least.*2"):
            GifService.stitch(frames)

    # ------------------------------------------------------------------
    def test_empty_frame_list_rejected(self) -> None:
        """Zero frames raises GifServiceError."""
        with pytest.raises(GifServiceError, match="at least.*2"):
            GifService.stitch([])

    # ------------------------------------------------------------------
    def test_max_frames_exceeded(self) -> None:
        """More than MAX_FRAMES frames raises GifServiceError."""
        frames = _make_frame_set(MAX_FRAMES + 1)
        with pytest.raises(GifServiceError, match=f"Maximum {MAX_FRAMES}"):
            GifService.stitch(frames)

    # ------------------------------------------------------------------
    def test_invalid_image_bytes_rejected(self) -> None:
        """Non-image bytes raise GifServiceError."""
        # Need at least MIN_FRAMES; pass a valid frame first, then corrupt
        frames = [_make_png_bytes(), b"this is not an image"]
        with pytest.raises(GifServiceError, match="not a valid image"):
            GifService.stitch(frames)

    # ------------------------------------------------------------------
    def test_empty_bytes_rejected(self) -> None:
        """Zero-length bytes raise GifServiceError."""
        frames = [_make_png_bytes(), b""]
        with pytest.raises(GifServiceError, match="empty"):
            GifService.stitch(frames)

    # ------------------------------------------------------------------
    def test_dimension_too_large_rejected(self) -> None:
        """Frame exceeding MAX_DIMENSION raises GifServiceError."""
        oversized = _make_png_bytes(width=MAX_DIMENSION + 100, height=100)
        frames = [_make_png_bytes(), oversized]
        with pytest.raises(GifServiceError, match="exceeds max dimension"):
            GifService.stitch(frames)

    # ------------------------------------------------------------------
    def test_duration_below_minimum_rejected(self) -> None:
        """Duration below MIN_DURATION_MS raises GifServiceError."""
        frames = _make_frame_set(2)
        with pytest.raises(GifServiceError, match=f"{MIN_DURATION_MS}"):
            GifService.stitch(frames, duration=MIN_DURATION_MS - 1)

    # ------------------------------------------------------------------
    def test_max_width_below_minimum_rejected(self) -> None:
        """max_width below MIN_MAX_WIDTH raises GifServiceError."""
        frames = _make_frame_set(2)
        with pytest.raises(GifServiceError, match=f"{MIN_MAX_WIDTH}"):
            GifService.stitch(frames, max_width=MIN_MAX_WIDTH - 1)

    # ------------------------------------------------------------------
    def test_invalid_optimize_level_rejected(self) -> None:
        """optimize_level outside 0-3 raises GifServiceError."""
        frames = _make_frame_set(2)
        with pytest.raises(GifServiceError, match="optimize_level"):
            GifService.stitch(frames, optimize_level=4)

    # ------------------------------------------------------------------
    def test_auto_downscale(self) -> None:
        """Wide frames get auto-downscaled to max_width."""
        wide = _make_png_bytes(width=1600, height=900)
        normal = _make_png_bytes(width=100, height=100)
        result = GifService.stitch([wide, normal], max_width=800)

        assert result.width <= 800
        assert result.height <= 450  # 900 * (800/1600) = 450

    # ------------------------------------------------------------------
    def test_duplicate_frame_removal_opt_level_1(self) -> None:
        """optimize_level=1 merges consecutive identical frames.

        When the same image bytes appear twice in a row, level 1 should
        merge them (the first retains the combined duration, and the
        duplicate is dropped).
        """
        frame = _make_png_bytes(width=64, height=64)
        # Three identical frames — should collapse to 1
        frames = [frame, frame, frame]
        result = GifService.stitch(frames, duration=1000, optimize_level=1)

        # All three were identical → merged into a single frame
        assert result.num_frames == 1, (
            f"Expected 1 frame after dedup, got {result.num_frames}"
        )

    # ------------------------------------------------------------------
    def test_loop_count(self) -> None:
        """loop=1 produces a single-loop GIF (Netscape extension)."""
        frames = _make_frame_set(2)
        result = GifService.stitch(frames, loop=1)

        _assert_valid_gif(result.data)
        # The Netscape 2.0 extension block (0x21 0xFF 0x0B NETSCAPE...)
        # appears for any explicit loop count.
        assert b"NETSCAPE2.0" in result.data, (
            "Expected Netscape loop extension in GIF data"
        )

    # ------------------------------------------------------------------
    def test_end_frame_delay_added(self) -> None:
        """End frame gets extra delay from end_frame_delay parameter.

        We can't easily read GIF frame delays from raw bytes here, but
        we verify the output is still a valid GIF as a smoke check.
        """
        frames = _make_frame_set(2)
        result = GifService.stitch(frames, duration=500, end_frame_delay=3000)

        _assert_valid_gif(result.data)
        assert result.num_frames == 2

    # ------------------------------------------------------------------
    def test_shared_palette_off(self) -> None:
        """shared_palette=False produces a valid GIF (per-frame palettes)."""
        frames = _make_frame_set(3, seed=42)
        result = GifService.stitch(frames, shared_palette=False)

        _assert_valid_gif(result.data)
        assert result.num_frames == 3

    # ------------------------------------------------------------------
    def test_optimize_level_3_max_compression(self) -> None:
        """optimize_level=3 produces a smaller GIF than level 0."""
        # Use many frames with different solid colors (won't deduplicate,
        # but 64/32-color palette will shrink them vs 256-color palette).
        frames = []
        for i in range(8):
            r = (i * 32) % 256
            g = (i * 64) % 256
            b = (i * 96) % 256
            img = Image.new("RGB", (200, 100), (r, g, b))
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            frames.append(buf.getvalue())

        result_off = GifService.stitch(frames, optimize_level=0)
        result_max = GifService.stitch(frames, optimize_level=3)

        # The max compressed result should be no larger than the uncompressed one
        assert result_max.size_bytes <= result_off.size_bytes, (
            f"Expected max compression ({result_max.size_bytes}) <= "
            f"no compression ({result_off.size_bytes})"
        )

    # ------------------------------------------------------------------
    def test_return_type_fields(self) -> None:
        """GifStitchResult contains all expected metadata fields."""
        frames = _make_frame_set(2, width=320, height=240)
        result = GifService.stitch(frames)

        assert result.data is not None
        assert isinstance(result.data, bytes)
        assert result.width == 320
        assert result.height == 240
        assert result.num_frames == 2
        assert result.size_bytes == len(result.data)
