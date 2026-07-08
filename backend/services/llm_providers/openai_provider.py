import os
import re
import json
from typing import Optional, Dict, Any, List
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_random_exponential, retry_if_exception

try:
    from openai import OpenAI
    from openai import NotFoundError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from ..onboarding.api_key_manager import APIKeyManager

def get_openai_api_key(explicit_api_key: Optional[str] = None) -> str:
    """Get OpenAI API key with proper error handling."""
    api_key = explicit_api_key or os.getenv('OPENAI_API_KEY')
    if not api_key:
        try:
            api_key_manager = APIKeyManager()
            api_key = api_key_manager.get_api_key("openai")
        except Exception:
            pass
    if not api_key:
        error_msg = "OPENAI_API_KEY environment variable is not set. Please set it in your .env file or onboarding."
        logger.error(error_msg)
        raise ValueError(error_msg)
    return api_key

def _should_retry_openai_error(exception: Exception) -> bool:
    """Determine if we should retry based on OpenAI exception types."""
    err_str = str(exception).lower()
    if "rate limit" in err_str or "rate_limit" in err_str or "timeout" in err_str or "connection" in err_str:
        return True
    return False

@retry(
    retry=retry_if_exception(_should_retry_openai_error),
    wait=wait_random_exponential(min=1, max=10),
    stop=stop_after_attempt(3),
)
def openai_text_response(
    prompt: str,
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 2048,
    top_p: float = 0.9,
    system_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
) -> str:
    """Generate text response using OpenAI API."""
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")
        
        openai_api_key = get_openai_api_key(api_key)
        client = OpenAI(api_key=openai_api_key)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        logger.info(
            "OpenAI text call | model={} | prompt_len={} | temp={} | top_p={} | max_tokens={}",
            model, len(prompt), temperature, top_p, max_tokens
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens
        )
        
        generated_text = response.choices[0].message.content or ""
        generated_text = re.sub(r'```[a-zA-Z]*\n?', '', generated_text)
        generated_text = re.sub(r'```\n?', '', generated_text)
        return generated_text.strip()
    except Exception as exc:
        logger.error(f"❌ OpenAI text generation failed: {exc}")
        raise Exception(f"OpenAI text generation failed: {exc}") from exc

@retry(
    retry=retry_if_exception(_should_retry_openai_error),
    wait=wait_random_exponential(min=1, max=10),
    stop=stop_after_attempt(3),
)
def openai_structured_json_response(
    prompt: str,
    schema: Dict[str, Any],
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 4096,
    system_prompt: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate structured JSON response using OpenAI API."""
    try:
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI library not available. Install with: pip install openai")
        
        openai_api_key = get_openai_api_key(api_key)
        client = OpenAI(api_key=openai_api_key)
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        json_instruction = "Please respond with valid JSON that matches the provided schema."
        messages.append({
            "role": "user", 
            "content": f"{prompt}\n\n{json_instruction}\n\nJSON Schema:\n{json.dumps(schema)}"
        })

        logger.info(
            "OpenAI structured call | model={} | prompt_len={} | temp={} | max_tokens={}",
            model, len(prompt), temperature, max_tokens
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
    except Exception as exc:
        logger.error(f"❌ OpenAI structured JSON generation failed: {exc}")
        raise Exception(f"OpenAI structured JSON generation failed: {exc}") from exc
