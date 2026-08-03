"""
Unit tests for Gemini 3 Pro Image WaveSpeed support.

Covers only features added for gemini-3-pro-image:
- Aspect ratio mapping from LinkedIn dimensions
- Model path + Gemini payload (aspect_ratio/resolution, no width/height)
- Provider registration and Gemini validation rules
- Facade remapping includes gemini-3-pro-image
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.llm_providers.image_generation.base import ImageGenerationOptions
from services.llm_providers.image_generation.wavespeed_provider import (
    WaveSpeedImageProvider,
)
from services.wavespeed.generators.image import ImageGenerator


class TestGeminiAspectRatioMapping:
    def test_exact_linkedin_dimensions(self):
        assert ImageGenerator._aspect_ratio_from_dimensions(1024, 1024) == "1:1"
        assert ImageGenerator._aspect_ratio_from_dimensions(1920, 1080) == "16:9"
        assert ImageGenerator._aspect_ratio_from_dimensions(1080, 1920) == "9:16"
        assert ImageGenerator._aspect_ratio_from_dimensions(1366, 1024) == "4:3"
        assert ImageGenerator._aspect_ratio_from_dimensions(1200, 627) == "16:9"
        assert ImageGenerator._aspect_ratio_from_dimensions(1080, 1350) == "3:4"

    def test_nearest_ratio_fallback(self):
        assert ImageGenerator._aspect_ratio_from_dimensions(1000, 1000) == "1:1"
        assert ImageGenerator._aspect_ratio_from_dimensions(1600, 900) == "16:9"


class TestGeminiWaveSpeedPayload:
    def _make_generator(self) -> ImageGenerator:
        return ImageGenerator(
            api_key="test-key",
            base_url="https://api.wavespeed.ai/api/v3",
            polling=MagicMock(),
        )

    def test_gemini_model_path_and_payload_shape(self):
        gen = self._make_generator()
        fake_bytes = b"fake-png-bytes"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {"id": "pred-123", "status": "created", "outputs": []}
        }
        mock_response.text = "{}"

        gen.polling.poll_until_complete.return_value = {
            "outputs": ["https://cdn.example.com/out.png"],
            "status": "completed",
        }

        with patch(
            "services.wavespeed.generators.image.requests.post",
            return_value=mock_response,
        ) as post:
            with patch.object(gen, "_download_image", return_value=fake_bytes):
                result = gen.generate_image(
                    model="gemini-3-pro-image",
                    prompt="Create LinkedIn post cover image",
                    width=1024,
                    height=1024,
                    enable_sync_mode=True,
                )

        assert result == fake_bytes
        assert post.call_count == 1
        url = post.call_args.args[0]
        payload = post.call_args.kwargs["json"]

        assert url.endswith("/google/gemini-3-pro-image/text-to-image")
        assert payload["prompt"] == "Create LinkedIn post cover image"
        assert payload["aspect_ratio"] == "1:1"
        assert payload["resolution"] == "1k"
        assert payload["output_format"] == "png"
        assert payload["enable_sync_mode"] is False
        assert payload["enable_base64_output"] is False
        assert "width" not in payload
        assert "height" not in payload
        assert "num_inference_steps" not in payload

        gen.polling.poll_until_complete.assert_called_once()

    def test_flux_payload_still_uses_width_height(self):
        gen = self._make_generator()
        fake_bytes = b"flux-bytes"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "id": "pred-flux",
                "status": "completed",
                "outputs": ["https://cdn.example.com/flux.png"],
            }
        }
        mock_response.text = "{}"

        with patch(
            "services.wavespeed.generators.image.requests.post",
            return_value=mock_response,
        ) as post:
            with patch.object(gen, "_download_image", return_value=fake_bytes):
                with patch.object(
                    gen,
                    "_extract_image_url",
                    return_value="https://cdn.example.com/flux.png",
                ):
                    result = gen.generate_image(
                        model="flux-kontext-pro",
                        prompt="Professional photo",
                        width=1024,
                        height=1024,
                        enable_sync_mode=True,
                    )

        assert result == fake_bytes
        payload = post.call_args.kwargs["json"]
        assert payload["width"] == 1024
        assert payload["height"] == 1024
        assert payload["enable_sync_mode"] is True
        assert "aspect_ratio" not in payload
        assert "resolution" not in payload


class TestWaveSpeedProviderGeminiRegistration:
    def test_supported_models_includes_gemini(self):
        assert "gemini-3-pro-image" in WaveSpeedImageProvider.SUPPORTED_MODELS
        info = WaveSpeedImageProvider.SUPPORTED_MODELS["gemini-3-pro-image"]
        assert info["cost_per_image"] == 0.14
        assert info["name"] == "Gemini 3 Pro Image"

    def test_validate_options_skips_pixel_max_for_gemini(self, monkeypatch):
        monkeypatch.setenv("WAVESPEED_API_KEY", "test-key")
        with patch(
            "services.llm_providers.image_generation.wavespeed_provider.WaveSpeedClient"
        ):
            provider = WaveSpeedImageProvider(api_key="test-key")

        # LinkedIn landscape dims exceed 1024 max used by other models
        options = ImageGenerationOptions(
            prompt="Cover prompt",
            width=1920,
            height=1080,
            model="gemini-3-pro-image",
        )
        provider._validate_options(options)

    def test_validate_options_rejects_empty_prompt_for_gemini(self, monkeypatch):
        monkeypatch.setenv("WAVESPEED_API_KEY", "test-key")
        with patch(
            "services.llm_providers.image_generation.wavespeed_provider.WaveSpeedClient"
        ):
            provider = WaveSpeedImageProvider(api_key="test-key")

        with pytest.raises(ValueError, match="Prompt cannot be empty"):
            provider._validate_options(
                ImageGenerationOptions(
                    prompt="   ",
                    width=1024,
                    height=1024,
                    model="gemini-3-pro-image",
                )
            )


class TestMainImageGenerationGeminiRemap:
    def test_wavespeed_models_include_gemini_in_facade_source(self):
        """Assert Gemini is registered in the facade remapping list (read file source)."""
        from pathlib import Path

        facade_path = (
            Path(__file__).resolve().parents[2]
            / "services"
            / "llm_providers"
            / "main_image_generation.py"
        )
        source = facade_path.read_text(encoding="utf-8")
        assert "gemini-3-pro-image" in source
        assert "wavespeed_models" in source
