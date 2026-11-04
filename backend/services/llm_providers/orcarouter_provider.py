"""
OrcaRouter LLM Provider Module for ALwrity

This module provides functions for interacting with OrcaRouter's LLM API
using the OpenAI-compatible interface for text generation.

Key Features:
- Text response generation with retry logic
- Structured JSON response generation with schema validation
- Comprehensive error handling and logging
- Automatic API key management
- Support for 200+ models through a single OpenAI-compatible endpoint

Best Practices:
1. Use appropriate temperature for your use case (0.7 for creative, 0.1-0.3 for factual)
2. Set max_tokens based on expected response length
3. Use system_prompt to guide model behavior
4. Handle errors gracefully in calling functions

Usage Examples:
    # Text response
    result = orcarouter_text_response(prompt, temperature=0.7, max_tokens=2048)

    # Structured JSON response
    schema = {"type": "object", "properties": {"title": {"type": "string"}}}
    result = orcarouter_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)

Dependencies:
- openai (for OrcaRouter OpenAI-compatible API)
- tenacity (for retry logic)
- logging (for debugging)
- json (for fallback parsing)

Author: ALwrity Team
Version: 1.0
Last Updated: August 2026
"""

import os
import sys
import time as _time
from pathlib import Path
import json
import re
from typing import Optional, Dict, Any, List

from dotenv import load_dotenv

# Fix the environment loading path - load from backend directory
_mod_start = _time.time()
current_dir = Path(__file__).parent.parent  # services directory
backend_dir = current_dir.parent  # backend directory
env_path = backend_dir / '.env'

if env_path.exists():
    load_dotenv(env_path)
    _dotenv_ms = (_time.time() - _mod_start) * 1000
    print(f"Loaded .env from: {env_path} (took {_dotenv_ms:.0f}ms)")
else:
    load_dotenv()
    print(f"No .env found at {env_path}, using current directory")

from loguru import logger
from utils.logger_utils import get_service_logger

# Use service-specific logger to avoid conflicts
logger = get_service_logger("orcarouter_provider")

_import_start = _time.time()
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

try:
    from openai import OpenAI
    from openai import NotFoundError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    NotFoundError = Exception
    logger.warn("OpenAI library not available. Install with: pip install openai")

logger.warning(f"[orcarouter_provider] Module import completed in {(_time.time()-_import_start)*1000:.0f}ms (openai_available={OPENAI_AVAILABLE})")

# OrcaRouter API base URL and default model
ORCAROUTER_BASE_URL = os.getenv("ORCAROUTER_BASE_URL", "https://api.orcarouter.ai/v1")
ORCAROUTER_DEFAULT_MODEL = os.getenv("ORCAROUTER_DEFAULT_MODEL", "orcarouter/auto")

# Default OrcaRouter models for fallback
ORCAROUTER_FALLBACK_MODELS = [
    "orcarouter/auto",
    "openai/gpt-4o-mini",
    "anthropic/claude-sonnet-4.5",
]


def get_orcarouter_api_key() -> str:
    """Get OrcaRouter API key with proper error handling."""
    api_key = os.getenv('ORCAROUTER_API_KEY')
    if not api_key:
        error_msg = "ORCAROUTER_API_KEY environment variable is not set. Please set it in your .env file."
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Validate API key format (basic check)
    if not api_key.startswith('sk-orca-'):
        error_msg = "ORCAROUTER_API_KEY appears to be invalid. It should start with 'sk-orca-'."
        logger.error(error_msg)
        raise ValueError(error_msg)

    return api_key


def _is_non_retryable_orcarouter_error(exc: Exception) -> bool:
    """Skip retries for deterministic OrcaRouter failures (e.g., unknown model ids, billing)."""
    msg = str(exc).lower()
    status = getattr(exc, "status_code", None)

    # Non-retryable errors
    if isinstance(exc, NotFoundError) or "not found" in msg or "404" in msg:
        return True
    if status == 402 or "402" in msg or "depleted" in msg or "credits" in msg:
        return True
    if status == 401 or "unauthorized" in msg or "401" in msg:
        return True
    if status == 403 or "forbidden" in msg or "403" in msg:
        return True

    return False


def _should_retry_orcarouter_error(exc: Exception) -> bool:
    return not _is_non_retryable_orcarouter_error(exc)


def _classify_orcarouter_error(exc: Exception) -> str:
    """Classify OrcaRouter failures for actionable logs."""
    msg = str(exc).lower()
    if any(token in msg for token in ["insufficient", "balance", "quota", "billing", "payment", "402"]):
        return "billing_or_quota"
    if "unauthorized" in msg or "forbidden" in msg or "401" in msg or "403" in msg:
        return "auth_or_permission"
    if "not found" in msg or "404" in msg:
        return "model_not_found"
    return "unknown"


def _orcarouter_error_details(exc: Exception) -> str:
    """Return compact, actionable exception details for logs."""
    status = getattr(exc, "status_code", None)
    err_type = type(exc).__name__
    message = str(exc)
    raw_body = getattr(exc, "body", None)
    details = f"type={err_type}"
    if status is not None:
        details += f", status={status}"
    if message:
        details += f", message={message}"
    if raw_body:
        details += f", body={raw_body}"
    details += f", repr={repr(exc)}"
    return details


@retry(
    retry=retry_if_exception(_should_retry_orcarouter_error),
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
)
def orcarouter_text_response(
    prompt: str,
    model: str = ORCAROUTER_DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    top_p: float = 0.9,
    system_prompt: Optional[str] = None
) -> str:
    """
    Generate text response using OrcaRouter LLM API.

    This function uses the OrcaRouter OpenAI-compatible API for text generation
    with built-in retry logic and error handling.

    Args:
        prompt (str): The input prompt for the AI model
        model (str): OrcaRouter model identifier (default: "orcarouter/auto")
        temperature (float): Controls randomness (0.0-1.0)
        max_tokens (int): Maximum tokens in response
        top_p (float): Nucleus sampling parameter (0.0-1.0)
        system_prompt (str, optional): System instruction for the model

    Returns:
        str: Generated text response

    Raises:
        Exception: If API key is missing or API call fails

    Example:
        result = orcarouter_text_response(
            prompt="Write a blog post about AI",
            model="orcarouter/auto",
            temperature=0.7,
            max_tokens=2048,
            system_prompt="You are a professional content writer."
        )
    """
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")

        # Get API key with proper error handling
        api_key = get_orcarouter_api_key()
        logger.info(f"🔑 OrcaRouter API key loaded: {bool(api_key)} (length: {len(api_key) if api_key else 0})")

        if not api_key:
            raise Exception("ORCAROUTER_API_KEY not found in environment variables")

        _t0 = _time.time()
        # Initialize OrcaRouter client
        client = OpenAI(
            base_url=ORCAROUTER_BASE_URL,
            api_key=api_key,
        )
        logger.warning(f"[orcarouter_text_response] OpenAI client init took {(_time.time()-_t0)*1000:.0f}ms")

        # Prepare input for the API
        messages = []

        # Add system prompt if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })

        # Add user prompt
        messages.append({
            "role": "user",
            "content": prompt
        })

        # Add debugging for API call
        logger.info(
            "OrcaRouter text call | model={} | prompt_len={} | temp={} | top_p={} | max_tokens={}",
            model,
            len(prompt) if isinstance(prompt, str) else '<non-str>',
            temperature,
            top_p,
            max_tokens,
        )

        logger.info("🚀 Making OrcaRouter API call (chat completion)...")

        _api_t0 = _time.time()
        # Call exactly the requested model
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens
        )
        logger.warning(f"[orcarouter_text_response] API call took {(_time.time()-_api_t0)*1000:.0f}ms")

        # Extract text from response
        generated_text = response.choices[0].message.content

        # Clean up the response
        if generated_text:
            # Remove any markdown formatting if present
            generated_text = re.sub(r'```[a-zA-Z]*\n?', '', generated_text)
            generated_text = re.sub(r'```\n?', '', generated_text)
            generated_text = generated_text.strip()

        logger.info(f"✅ OrcaRouter text response generated successfully (length: {len(generated_text)})")
        return generated_text

    except Exception as e:
        error_class = _classify_orcarouter_error(e)
        error_details = _orcarouter_error_details(e)
        logger.error(f"❌ OrcaRouter text generation failed: {error_details}")

        # Extra diagnostics: try to capture raw response if available
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"🔍 OrcaRouter Error Diagnostics:")
            logger.error(f"  - Status: {e.response.status_code}")
            logger.error(f"  - Headers: {dict(e.response.headers)}")
            try:
                body_json = e.response.json()
                logger.error(f"  - Body JSON: {json.dumps(body_json, indent=2)}")
            except Exception:
                logger.error(f"  - Body Raw: {e.response.text[:1000]}")
        else:
            logger.error(f"🔍 No HTTP response attached to exception object.")

        raise Exception(f"OrcaRouter text generation failed: {str(e)}")


@retry(
    retry=retry_if_exception(_should_retry_orcarouter_error),
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
)
def orcarouter_structured_json_response(
    prompt: str,
    schema: Dict[str, Any],
    model: str = ORCAROUTER_DEFAULT_MODEL,
    temperature: float = 0.7,
    max_tokens: int = 8192,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate structured JSON response using OrcaRouter LLM API.

    This function uses the OrcaRouter OpenAI-compatible API with structured output support
    to generate JSON responses that match a provided schema.

    Args:
        prompt (str): The input prompt for the AI model
        schema (dict): JSON schema defining the expected output structure
        model (str): OrcaRouter model identifier (default: "orcarouter/auto")
        temperature (float): Controls randomness (0.0-1.0). Use 0.1-0.3 for structured output
        max_tokens (int): Maximum tokens in response. Use 8192 for complex outputs
        system_prompt (str, optional): System instruction for the model

    Returns:
        dict: Parsed JSON response matching the provided schema

    Raises:
        Exception: If API key is missing or API call fails

    Example:
        schema = {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "summary": {"type": "string"}
            }
        }
        result = orcarouter_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)
    """
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")

        # Get API key with proper error handling
        api_key = get_orcarouter_api_key()
        logger.info(f"🔑 OrcaRouter API key loaded: {bool(api_key)} (length: {len(api_key) if api_key else 0})")

        if not api_key:
            raise Exception("ORCAROUTER_API_KEY not found in environment variables")

        _fn_start = _time.time()
        # Initialize OpenAI client with OrcaRouter base URL
        client = OpenAI(
            base_url=ORCAROUTER_BASE_URL,
            api_key=api_key,
        )
        _client_init_ms = (_time.time() - _fn_start) * 1000
        logger.warning(f"[orcarouter_structured_json_response] OpenAI client init took {_client_init_ms:.0f}ms")

        # Prepare input for the API
        messages = []

        # Add system prompt if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })

        # Add user prompt with JSON instruction
        json_instruction = "Please respond with valid JSON that matches the provided schema."
        messages.append({
            "role": "user",
            "content": f"{prompt}\n\n{json_instruction}"
        })

        # Add JSON schema to prompt for guidance
        json_schema_str = json.dumps(schema, indent=2)
        messages[-1]["content"] += f"\n\nJSON Schema:\n{json_schema_str}"

        # Add debugging for API call
        logger.info(
            "OrcaRouter structured call | model={} | prompt_len={} | schema_kind={} | temp={} | max_tokens={}",
            model,
            len(prompt) if isinstance(prompt, str) else '<non-str>',
            type(schema).__name__,
            temperature,
            max_tokens,
        )

        logger.info("🚀 Making OrcaRouter structured API call...")

        _api_start = _time.time()
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"}  # Try to enforce JSON mode if supported
            )
            _api_ms = (_time.time() - _api_start) * 1000
            logger.warning(f"[orcarouter_structured_json_response] First API call completed in {_api_ms:.0f}ms (model={model})")
        except Exception as e:
            logger.error(f"❌ OrcaRouter API call failed: {e}")
            # If 422 Unprocessable Entity (often due to response_format not supported), retry without it
            if "422" in str(e) or "not supported" in str(e).lower():
                logger.info("Retrying without response_format...")
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
            else:
                raise e

        response_text = response.choices[0].message.content
        response_text = response_text.strip() if response_text else ""

        # If response_format returned empty content, retry without it
        if not response_text:
            logger.warning("OrcaRouter structured call returned empty content with response_format, retrying without it...")
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            response_text = response.choices[0].message.content
            response_text = response_text.strip() if response_text else ""

        # Clean up response text if needed
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        try:
            parsed_json = json.loads(response_text) if response_text else None
            if parsed_json is not None:
                logger.info("✅ OrcaRouter structured JSON response parsed successfully")
                return parsed_json
        except json.JSONDecodeError as json_err:
            logger.error(f"❌ JSON parsing failed: {json_err}")

        # Try to extract JSON from the response using regex
        if response_text:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                try:
                    extracted_json = json.loads(json_match.group())
                    logger.info("✅ JSON extracted using regex fallback")
                    return extracted_json
                except json.JSONDecodeError:
                    pass

        return {"error": "Failed to parse JSON response", "raw_response": response_text}

    except Exception as e:
        error_msg = str(e) if str(e) else repr(e)
        error_type = type(e).__name__
        logger.error(f"❌ OrcaRouter structured JSON generation failed [{error_type}]: {error_msg}")

        # Surface balance/quota errors as HTTPException so upstream can show user-friendly messages
        from fastapi import HTTPException
        if "balance_not_enough" in error_msg or "403" in error_msg or "PermissionDenied" in error_type:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "insufficient_balance",
                    "message": "OrcaRouter API balance is insufficient. Please top up your account or switch to a different provider.",
                    "usage_info": {
                        "error_type": "insufficient_balance",
                        "provider": "orcarouter",
                        "suggestion": "Set GPT_PROVIDER=google in your environment to use Gemini instead."
                    }
                }
            )
        raise Exception(f"OrcaRouter structured JSON generation failed: {error_msg}")
