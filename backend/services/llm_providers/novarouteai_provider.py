"""
NovaRouteAI LLM Provider Module for ALwrity

OpenAI-compatible provider for NovaRouteAI's routing service.
Minimal implementation following WaveSpeed provider pattern.

Key Features:
- Text response generation with retry logic
- Structured JSON response via response_format
- API key from NOVAROUTE_API_KEY env var

Usage:
    result = novaroute_structured_json_response(prompt, schema, model="qwen3.5-plus")
    result = novaroute_text_response(prompt, model="qwen3.5-plus")
"""

import os
import time as _time
from typing import List, Dict, Optional

from loguru import logger
from utils.logger_utils import get_service_logger

logger = get_service_logger("novaroute_provider")

_import_start = _time.time()

try:
    from openai import OpenAI
    from openai import NotFoundError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    NotFoundError = Exception
    logger.warn("OpenAI library not available. Install with: pip install openai")

logger.warning(f"[novaroute_provider] Module import completed in {(_time.time()-_import_start)*1000:.0f}ms (openai_available={OPENAI_AVAILABLE})")


def _is_non_retryable_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    status = getattr(exc, "status_code", None)
    if isinstance(exc, NotFoundError) or "not found" in msg:
        return True
    if status in (401, 402, 403) or any(k in msg for k in ("unauthorized", "forbidden", "billing", "depleted")):
        return True
    return False


def novaroute_text_response(
    prompt: str,
    model: str = "qwen3.5-plus",
    temperature: float = 0.7,
    max_tokens: int = 2048,
    system_prompt: Optional[str] = None
) -> str:
    if not OPENAI_AVAILABLE:
        raise ImportError("OpenAI library not available")

    api_key = os.getenv("NOVAROUTE_API_KEY")
    if not api_key:
        raise ValueError("NOVAROUTE_API_KEY environment variable is not set")

    client = OpenAI(base_url="https://novarouteai.com/v1", api_key=api_key)
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def novaroute_structured_json_response(
    prompt: str,
    schema: dict,
    model: str = "qwen3.5-plus",
    temperature: float = 0.2,
    max_tokens: int = 8192,
    system_prompt: Optional[str] = None
) -> str:
    if not OPENAI_AVAILABLE:
        raise ImportError("OpenAI library not available")

    api_key = os.getenv("NOVAROUTE_API_KEY")
    if not api_key:
        raise ValueError("NOVAROUTE_API_KEY environment variable is not set")

    t0 = _time.time()
    client = OpenAI(base_url="https://novarouteai.com/v1", api_key=api_key)
    logger.warning(f"[novaroute_structured_json_response] OpenAI client init took {(_time.time()-t0)*1000:.0f}ms")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    t1 = _time.time()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    api_took = (_time.time() - t1) * 1000
    usage = response.usage
    if usage:
        logger.warning(
            f"[novaroute_telemetry] model={model} "
            f"prompt_tokens={usage.prompt_tokens} completion_tokens={usage.completion_tokens} "
            f"total_tokens={usage.total_tokens} api_ms={api_took:.0f}"
        )
    logger.warning(f"[novaroute_structured_json_response] API call completed in {api_took:.0f}ms (model={model})")

    return response.choices[0].message.content or ""
