from __future__ import annotations

import io
import os
from typing import Optional, Dict, Any

from PIL import Image
from huggingface_hub import InferenceClient

from .base import ImageGenerationOptions, ImageGenerationResult, ImageGenerationProvider
from utils.logger_utils import get_service_logger


logger = get_service_logger("image_generation.huggingface")


DEFAULT_HF_MODEL = os.getenv(
    "HF_IMAGE_MODEL",
    "black-forest-labs/FLUX.1-Krea-dev",
)


class HuggingFaceImageProvider(ImageGenerationProvider):
    """Hugging Face Inference Providers (fal-ai) backed image generation.

    API doc: https://huggingface.co/docs/inference-providers/en/tasks/text-to-image
    """

    def __init__(self, api_key: Optional[str] = None, provider: str = "fal-ai") -> None:
        self.api_key = api_key or os.getenv("HF_TOKEN")
        if not self.api_key:
            raise RuntimeError("HF_TOKEN is required for Hugging Face image generation")
        self.provider = provider
        self.client = InferenceClient(provider=self.provider, api_key=self.api_key)
        logger.info("HuggingFaceImageProvider initialized (provider={})", self.provider)

    def generate(self, options: ImageGenerationOptions) -> ImageGenerationResult:
        model = options.model or DEFAULT_HF_MODEL
        params: Dict[str, Any] = {}
        if options.guidance_scale is not None:
            params["guidance_scale"] = options.guidance_scale
        if options.steps is not None:
            params["num_inference_steps"] = options.steps
        if options.negative_prompt:
            params["negative_prompt"] = options.negative_prompt
        if options.seed is not None:
            params["seed"] = options.seed

        # The HF InferenceClient returns a PIL Image
        logger.debug("HF generate: model=%s width=%s height=%s params=%s", model, options.width, options.height, params)
        img: Image.Image = self.client.text_to_image(
            options.prompt,
            model=model,
            width=options.width,
            height=options.height,
            **params,
        )

        with io.BytesIO() as buf:
            img.save(buf, format="PNG")
            image_bytes = buf.getvalue()

        return ImageGenerationResult(
            image_bytes=image_bytes,
            width=img.width,
            height=img.height,
            provider="huggingface",
            model=model,
            seed=options.seed,
            metadata={"provider": self.provider},
        )


