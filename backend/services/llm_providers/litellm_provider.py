"""
LiteLLM Provider Module for ALwrity

Access 100+ LLM providers (OpenAI, Anthropic, Google, Azure, Bedrock,
Cohere, Mistral, and more) through a single unified interface.

Users specify models with provider-prefixed names:
    anthropic/claude-sonnet-4-6
    openai/gpt-4o
    gemini/gemini-2.5-pro
    bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0

Install: pip install litellm>=1.80,<1.87

Usage:
    result = litellm_text_response(
        prompt="Write a blog post about AI",
        model="anthropic/claude-sonnet-4-6",
        temperature=0.7,
        max_tokens=2048,
        system_prompt="You are a professional content writer."
    )
"""

import json
import re
import time as _time
from typing import Any, Dict, List, Optional

from loguru import logger as _fallback_logger

try:
    from utils.logger_utils import get_service_logger
    logger = get_service_logger("litellm_provider")
except Exception:
    logger = _fallback_logger

from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)


def _check_litellm():
    try:
        import litellm  # noqa: F401
        return True
    except ImportError:
        return False


LITELLM_AVAILABLE = _check_litellm()


def _is_transient(exc: BaseException) -> bool:
    qualname = f"{type(exc).__module__}.{type(exc).__name__}"
    if qualname in {
        "litellm.exceptions.RateLimitError",
        "litellm.exceptions.APIConnectionError",
        "litellm.exceptions.Timeout",
        "litellm.exceptions.InternalServerError",
        "litellm.exceptions.ServiceUnavailableError",
    }:
        return True
    msg = str(exc).lower()
    return "rate limit" in msg or "429" in msg or "timeout" in msg


@retry(
    retry=retry_if_exception(_is_transient),
    wait=wait_random_exponential(min=1, max=30),
    stop=stop_after_attempt(3),
    reraise=True,
)
def _completion_with_backoff(**kwargs):
    import litellm
    return litellm.completion(**kwargs)


def litellm_text_response(
    prompt: str,
    model: str = "openai/gpt-4o",
    temperature: float = 0.7,
    max_tokens: int = 2048,
    system_prompt: Optional[str] = None,
) -> str:
    """
    Generate text response using LiteLLM (100+ providers).

    Args:
        prompt: The input prompt for the AI model.
        model: Provider-prefixed model name (e.g. "anthropic/claude-sonnet-4-6").
        temperature: Controls randomness (0.0-1.0).
        max_tokens: Maximum tokens in response.
        system_prompt: System instruction for the model.

    Returns:
        Generated text response.
    """
    if not LITELLM_AVAILABLE:
        raise ImportError("litellm not installed. Install with: pip install litellm>=1.80,<1.87")

    logger.info(f"LiteLLM text request: model={model}, temp={temperature}, max_tokens={max_tokens}")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    t0 = _time.time()
    response = _completion_with_backoff(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        drop_params=True,
    )
    elapsed_ms = (_time.time() - t0) * 1000

    content = response.choices[0].message.content or ""
    usage = getattr(response, "usage", None)
    prompt_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
    completion_tokens = getattr(usage, "completion_tokens", 0) if usage else 0

    logger.info(
        f"LiteLLM response: model={model}, "
        f"tokens={prompt_tokens}+{completion_tokens}, "
        f"elapsed={elapsed_ms:.0f}ms, "
        f"response_len={len(content)}"
    )
    return content


def litellm_structured_json_response(
    prompt: str,
    schema: Dict[str, Any],
    model: str = "openai/gpt-4o",
    temperature: float = 0.2,
    max_tokens: int = 8192,
    system_prompt: Optional[str] = None,
) -> Any:
    """
    Generate structured JSON response using LiteLLM (100+ providers).

    Args:
        prompt: The input prompt for the AI model.
        schema: JSON schema structure for the expected response.
        model: Provider-prefixed model name.
        temperature: Controls randomness (lower is more consistent).
        max_tokens: Maximum tokens in response.
        system_prompt: System instruction for the model.

    Returns:
        Parsed JSON object matching the provided schema.
    """
    if not LITELLM_AVAILABLE:
        raise ImportError("litellm not installed. Install with: pip install litellm>=1.80,<1.87")

    schema_instruction = (
        f"\n\nIMPORTANT: Respond ONLY with valid JSON matching this schema:\n"
        f"```json\n{json.dumps(schema, indent=2)}\n```\n"
        f"Do not include any text outside the JSON object."
    )

    full_system = (system_prompt or "") + schema_instruction

    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": prompt},
    ]

    logger.info(f"LiteLLM structured request: model={model}, schema_keys={list(schema.get('properties', {}).keys())}")

    t0 = _time.time()
    response = _completion_with_backoff(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        drop_params=True,
    )
    elapsed_ms = (_time.time() - t0) * 1000

    content = response.choices[0].message.content or ""

    logger.info(f"LiteLLM structured response: model={model}, elapsed={elapsed_ms:.0f}ms, len={len(content)}")

    # Parse JSON from response
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try extracting JSON from markdown code blocks
        json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except json.JSONDecodeError:
                pass
        logger.warning(f"LiteLLM: Failed to parse structured response as JSON, returning raw text")
        return content
