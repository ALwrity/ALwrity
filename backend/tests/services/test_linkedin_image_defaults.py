"""Tests for LinkedIn image generation defaults."""

from services.linkedin.image_generation.linkedin_image_constants import (
    LINKEDIN_DEFAULT_IMAGE_MODEL,
)


def test_linkedin_default_image_model_is_gemini() -> None:
    assert LINKEDIN_DEFAULT_IMAGE_MODEL == "gemini-3-pro-image"
