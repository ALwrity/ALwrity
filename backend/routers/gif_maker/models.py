"""Pydantic models for the GIF Maker API.

These are thin, ephemeral request/response models — no database ORM involved.
"""

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Standard error payload returned on 4xx/5xx."""
    detail: str = Field(..., description="Human-readable error message")


class GifGenerateResponse(BaseModel):
    """Metadata returned in response headers (not as JSON body)."""
    # The actual response is a binary GIF file — metadata goes in headers.
    # This model exists for documentation purposes.
    size_bytes: int = Field(..., description="Size of the GIF in bytes")
    num_frames: int = Field(..., description="Number of frames in the animation")
    width: int = Field(..., description="Width of the output GIF in pixels")
    height: int = Field(..., description="Height of the output GIF in pixels")
