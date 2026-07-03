"""
Hugging Face Provider Module for ALwrity

This module provides functions for interacting with Hugging Face's Inference Providers API
using the Responses API (beta) which provides a unified interface for model interactions.

Key Features:
- Text response generation with retry logic
- Structured JSON response generation with schema validation
- Comprehensive error handling and logging
- Automatic API key management
- Support for various Hugging Face models via Inference Providers

Best Practices:
1. Use structured output for complex, multi-field responses
2. Keep schemas simple and flat to avoid truncation
3. Set appropriate token limits (8192 for complex outputs)
4. Use low temperature (0.1-0.3) for consistent structured output
5. Implement proper error handling in calling functions
6. Use the Responses API for better compatibility

Usage Examples:
    # Text response
    result = huggingface_text_response(prompt, temperature=0.7, max_tokens=2048)
    
    # Structured JSON response
    schema = {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {"type": "object", "properties": {...}}
            }
        }
    }
    result = huggingface_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)

Dependencies:
- openai (for Hugging Face Responses API)
- tenacity (for retry logic)
- logging (for debugging)
- json (for fallback parsing)

Author: ALwrity Team
Version: 1.0
Last Updated: January 2025
"""

import os
import sys
from pathlib import Path
import json
import re
from typing import Optional, Dict, Any

from dotenv import load_dotenv

# Fix the environment loading path - load from backend directory
current_dir = Path(__file__).parent.parent  # services directory
backend_dir = current_dir.parent  # backend directory
env_path = backend_dir / '.env'

if env_path.exists():
    load_dotenv(env_path)
    print(f"Loaded .env from: {env_path}")
else:
    # Fallback to current directory
    load_dotenv()
    print(f"No .env found at {env_path}, using current directory")

from loguru import logger
from utils.logger_utils import get_service_logger

# Use service-specific logger to avoid conflicts
logger = get_service_logger("huggingface_provider")

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
    logger.warning("OpenAI library not available. Install with: pip install openai")

HF_FALLBACK_MODELS = [
    "openai/gpt-oss-120b:cerebras",
    "moonshotai/Kimi-K2-Instruct-0905:cerebras",
    "meta-llama/Llama-3.1-8B-Instruct:cerebras",
    "mistralai/Mistral-7B-Instruct-v0.3:cerebras",
]


def _candidate_model_variants(model: str):
    """Yield model ids to try for a single logical model preference."""
    if not model:
        return

    yield model

    if ":" in model:
        base_model = model.split(":", 1)[0]
        if base_model:
            yield base_model


def _fallback_model_sequence(model: str, fallback_models: list = None):
    if fallback_models:
        sequence = [model] + fallback_models
    else:
        sequence = [model]
    seen = set()
    for preferred_model in sequence:
        for candidate in _candidate_model_variants(preferred_model):
            if candidate and candidate not in seen:
                seen.add(candidate)
                yield candidate


def _is_non_retryable_hf_error(exc: Exception) -> bool:
    """Skip retries for deterministic HF failures (e.g., unknown model ids, billing)."""
    msg = str(exc).lower()
    status = getattr(exc, "status_code", None)
    
    if isinstance(exc, NotFoundError) or "not found" in msg or "404" in msg:
        return True
    if status == 402 or "402" in msg or "depleted" in msg or "credits" in msg:
        return True
    if status == 401 or "unauthorized" in msg or "401" in msg:
        return True
    if status == 403 or "forbidden" in msg or "403" in msg:
        return True
    
    return False


def _should_retry_hf_error(exc: Exception) -> bool:
    return not _is_non_retryable_hf_error(exc)

def get_huggingface_api_key() -> str:
    """Get Hugging Face API key with proper error handling."""
    api_key = os.getenv('HF_TOKEN')
    if not api_key:
        error_msg = "HF_TOKEN environment variable is not set. Please set it in your .env file."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Validate API key format (basic check)
    if not api_key.startswith('hf_'):
        error_msg = "HF_TOKEN appears to be invalid. It should start with 'hf_'."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    return api_key

@retry(
    retry=retry_if_exception(_should_retry_hf_error),
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
)
def huggingface_text_response(
    prompt: str,
    model: str = "openai/gpt-oss-120b:cerebras",
    fallback_models: list = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    top_p: float = 0.9,
    system_prompt: Optional[str] = None
) -> str:
    """
    Generate text response using Hugging Face Inference Providers API.
    
    This function uses the Hugging Face Responses API which provides a unified interface
    for model interactions with built-in retry logic and error handling.
    
    Args:
        prompt (str): The input prompt for the AI model
        model (str): Hugging Face model identifier (default: "openai/gpt-oss-120b:cerebras")
        fallback_models (list, optional): Explicit fallback models to try
        temperature (float): Controls randomness (0.0-1.0)
        max_tokens (int): Maximum tokens in response
        top_p (float): Nucleus sampling parameter (0.0-1.0)
        system_prompt (str, optional): System instruction for the model
    
    Returns:
        str: Generated text response
        
    Raises:
        Exception: If API key is missing or API call fails
        
    Example:
        result = huggingface_text_response(
            prompt="Write a blog post about AI",
            model="openai/gpt-oss-120b:cerebras",
            temperature=0.7,
            max_tokens=2048,
            system_prompt="You are a professional content writer."
        )
    """
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")
        
        # Get API key with proper error handling
        api_key = get_huggingface_api_key()
        logger.info(f"🔑 Hugging Face API key loaded: {bool(api_key)} (length: {len(api_key) if api_key else 0})")
        
        if not api_key:
            raise Exception("HF_TOKEN not found in environment variables")
            
        # Initialize Hugging Face client
        client = OpenAI(
            base_url=f"https://router.huggingface.co/hf/v1",
            api_key=api_key,
        )
        logger.info("✅ Hugging Face client initialized for text response")

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
            "Hugging Face text call | model={} | prompt_len={} | temp={} | top_p={} | max_tokens={}",
            model,
            len(prompt) if isinstance(prompt, str) else '<non-str>',
            temperature,
            top_p,
            max_tokens,
        )
        
        logger.info("🚀 Making Hugging Face API call (chat completion)...")
        
        response = None
        last_error = None
        for candidate_model in _fallback_model_sequence(model):
            try:
                response = client.chat.completions.create(
                    model=candidate_model,
                    messages=messages,
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=max_tokens
                )
                if candidate_model != model:
                    logger.warning("HF text generation switched to fallback model: {}", candidate_model)
                break
            except NotFoundError as nf_err:
                last_error = nf_err
                logger.warning("HF model not found: {}. Trying fallback model.", candidate_model)
                continue

        if response is None:
            raise last_error or Exception("Hugging Face text generation failed: all fallback models failed")
        
        # Extract text from response
        generated_text = response.choices[0].message.content
        
        # Clean up the response
        if generated_text:
            # Remove any markdown formatting if present
            generated_text = re.sub(r'```[a-zA-Z]*\n?', '', generated_text)
            generated_text = re.sub(r'```\n?', '', generated_text)
            generated_text = generated_text.strip()
        
        logger.info(f"✅ Hugging Face text response generated successfully (length: {len(generated_text)})")
        return generated_text
        
    except Exception as e:
        logger.error(f"❌ Hugging Face text generation failed: {str(e)}")
        raise Exception(f"Hugging Face text generation failed: {str(e)}")

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def huggingface_structured_json_response(
    prompt: str,
    schema: Dict[str, Any],
    model: str = "openai/gpt-oss-120b:groq",
    temperature: float = 0.7,
    max_tokens: int = 8192,
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate structured JSON response using Hugging Face Inference Providers API.
    
    This function uses the Hugging Face Responses API with structured output support
    to generate JSON responses that match a provided schema.
    
    Args:
        prompt (str): The input prompt for the AI model
        schema (dict): JSON schema defining the expected output structure
        model (str): Hugging Face model identifier (default: "openai/gpt-oss-120b:groq")
        temperature (float): Controls randomness (0.0-1.0). Use 0.1-0.3 for structured output
        max_tokens (int): Maximum tokens in response. Use 8192 for complex outputs
        system_prompt (str, optional): System instruction for the model
    
    Returns:
        dict: Parsed JSON response matching the provided schema
        
    Raises:
        Exception: If API key is missing or API call fails
        
    Best Practices:
        - Keep schemas simple and flat to avoid truncation
        - Use low temperature (0.1-0.3) for consistent structured output
        - Set max_tokens to 8192 for complex multi-field responses
        - Avoid deeply nested schemas with many required fields
        - Test with smaller outputs first, then scale up
        
    Example:
        schema = {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"}
                        }
                    }
                }
            }
        }
        result = huggingface_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)
    """
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")
        
        # Get API key with proper error handling
        api_key = get_huggingface_api_key()
        logger.info(f"🔑 Hugging Face API key loaded: {bool(api_key)} (length: {len(api_key) if api_key else 0})")
        
        if not api_key:
            raise Exception("HF_TOKEN not found in environment variables")
            
        # Initialize OpenAI client with Hugging Face base URL
        # Use standard Inference API endpoint
        client = OpenAI(
            base_url=f"https://router.huggingface.co/hf/v1",
            api_key=api_key,
        )
        logger.info("✅ Hugging Face client initialized for structured JSON response")

        # Prepare input for the API
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        # Add user prompt with JSON instruction
        # For HF models, explicit JSON instruction in prompt is often better than response_format
        json_instruction = "Please respond with valid JSON that matches the provided schema."
        messages.append({
            "role": "user", 
            "content": f"{prompt}\n\n{json_instruction}"
        })

        # Add debugging for API call
        logger.info(
            "Hugging Face structured call | model={} | prompt_len={} | schema_kind={} | temp={} | max_tokens={}",
            model,
            len(prompt) if isinstance(prompt, str) else '<non-str>',
            type(schema).__name__,
            temperature,
            max_tokens,
        )
        
        logger.info("🚀 Making Hugging Face structured API call...")
        
        # Make the API call using standard Chat Completions
        logger.info("🚀 Making Hugging Face API call (chat completion)...")
        
        # Add JSON schema to prompt for guidance
        json_schema_str = json.dumps(schema, indent=2)
        messages[-1]["content"] += f"\n\nJSON Schema:\n{json_schema_str}"
        
        try:
            response = None
            last_error = None
            for candidate_model in _fallback_model_sequence(model):
                try:
                    response = client.chat.completions.create(
                        model=candidate_model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        response_format={"type": "json_object"} # Try to enforce JSON mode if supported
                    )
                    if candidate_model != model:
                        logger.warning("HF structured generation switched to fallback model: {}", candidate_model)
                    break
                except NotFoundError as nf_err:
                    last_error = nf_err
                    logger.warning("HF structured model not found: {}. Trying fallback model.", candidate_model)
                    continue

            if response is None:
                raise last_error or Exception("Hugging Face structured generation failed: all fallback models failed")
            
            response_text = response.choices[0].message.content
            
            # Clean up response text if needed
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            try:
                parsed_json = json.loads(response_text)
                logger.info("✅ Hugging Face structured JSON response parsed successfully")
                return parsed_json
            except json.JSONDecodeError as json_err:
                logger.error(f"❌ JSON parsing failed: {json_err}")
                logger.error(f"Raw response: {response_text}")
                
                # Try to extract JSON from the response using regex
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
            logger.error(f"❌ Hugging Face API call failed: {e}")
            if "422" in str(e) or "not supported" in str(e).lower() or isinstance(e, NotFoundError):
                logger.info("Retrying without response_format...")
                response = None
                last_error = None
                for candidate_model in _fallback_model_sequence(model, fallback_models):
                    try:
                        response = client.chat.completions.create(
                            model=candidate_model,
                            messages=messages,
                            temperature=temperature,
                            max_tokens=max_tokens
                        )
                        if candidate_model != model:
                            logger.warning("HF structured no-response_format fallback model: {}", candidate_model)
                        break
                    except NotFoundError as nf_err:
                        last_error = nf_err
                        logger.warning("HF structured model not found (no response_format path): {}", candidate_model)
                        continue

                if response is None:
                    raise last_error or e
                response_text = response.choices[0].message.content
                try:
                    return json.loads(response_text)
                except:
                    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group())
                    return {"error": "Failed to parse JSON response", "raw_response": response_text}
            raise e
        
    except Exception as e:
        error_msg = str(e) if str(e) else repr(e)
        error_type = type(e).__name__
        logger.error(f"❌ Hugging Face structured JSON generation failed: {error_type}: {error_msg}")
        logger.error(f"❌ Full exception details: {repr(e)}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")
        raise Exception(f"Hugging Face structured JSON generation failed: {error_type}: {error_msg}")

def get_available_models() -> list:
    """
    Get list of available Hugging Face models for text generation.
    
    Returns:
        list: List of available model identifiers
    """
    return [
        "openai/gpt-oss-120b:cerebras",
        "moonshotai/Kimi-K2-Instruct-0905:cerebras",
        "Qwen/Qwen2.5-VL-7B-Instruct",
        "meta-llama/Llama-3.1-8B-Instruct:cerebras",
        "microsoft/Phi-3-medium-4k-instruct:cerebras",
        "mistralai/Mistral-7B-Instruct-v0.3:cerebras"
    ]

def validate_model(model: str) -> bool:
    """
    Validate if a model identifier is supported.
    
    Args:
        model (str): Model identifier to validate
        
    Returns:
        bool: True if model is supported, False otherwise
    """
    available_models = get_available_models()
    return model in available_models
