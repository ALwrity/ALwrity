"""
Gemini Provider Module for ALwrity

This module provides functions for interacting with Google's Gemini API, specifically designed
for structured JSON output and text generation. It follows the official Gemini API documentation
and implements best practices for reliable AI interactions.

Key Features:
- Structured JSON response generation with schema validation
- Text response generation with retry logic
- Comprehensive error handling and logging
- Automatic API key management
- Support for both gemini-2.5-flash and gemini-2.5-pro models

Best Practices:
1. Use structured output for complex, multi-field responses
2. Keep schemas simple and flat to avoid truncation
3. Set appropriate token limits (8192 for complex outputs)
4. Use low temperature (0.1-0.3) for consistent structured output
5. Implement proper error handling in calling functions
6. Avoid fallback to text parsing for structured responses

Usage Examples:
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
    result = gemini_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)
    
    # Text response
    result = gemini_text_response(prompt, temperature=0.7, max_tokens=2048)

Troubleshooting:
- If response.parsed is None: Check schema complexity and token limits
- If JSON parsing fails: Verify schema matches expected output structure
- If truncation occurs: Reduce output size or increase max_tokens
- If rate limiting: Implement exponential backoff (already included)

Dependencies:
- google.generativeai (genai)
- tenacity (for retry logic)
- logging (for debugging)
- json (for fallback parsing)
- re (for text extraction)

Author: ALwrity Team
Version: 2.0
Last Updated: January 2025
"""

import os
import sys
from pathlib import Path

import google.genai as genai
from google.genai import types

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

from utils.logger_utils import get_service_logger

# Use service-specific logger to avoid conflicts
logger = get_service_logger("gemini_provider")
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

import asyncio
import json
import re

from typing import Optional, Dict, Any


def get_gemini_api_key() -> str:
    """Get Gemini API key with proper error handling."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        error_msg = "GEMINI_API_KEY environment variable is not set. Please set it in your .env file."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Validate API key format (basic check)
    if not api_key.startswith('AIza'):
        error_msg = "GEMINI_API_KEY appears to be invalid. It should start with 'AIza'."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    return api_key

def _is_non_retryable_gemini_error(exc: Exception) -> bool:
    """Skip retries for deterministic quota exhaustion and auth errors."""
    msg = str(exc).lower()
    return (
        "resource_exhausted" in msg
        or "quota exceeded" in msg
        or "free_tier" in msg
        or "requestsperday" in msg
        or "authentication" in msg
        or "permission denied" in msg
        or "invalid api key" in msg
    )

def _should_retry_gemini_error(exc: Exception) -> bool:
    return not _is_non_retryable_gemini_error(exc)

@retry(
    retry=retry_if_exception(_should_retry_gemini_error),
    wait=wait_random_exponential(min=1, max=60),
    stop=stop_after_attempt(6),
)
def gemini_text_response(prompt, temperature, top_p, n, max_tokens, system_prompt):
    """
    Generate text response using Google's Gemini Pro model.
    
    This function provides simple text generation with retry logic and error handling.
    For structured output, use gemini_structured_json_response instead.
    
    Args:
        prompt (str): The input prompt for the AI model
        temperature (float): Controls randomness (0.0-1.0). Higher = more creative
        top_p (float): Nucleus sampling parameter (0.0-1.0)
        n (int): Number of responses to generate
        max_tokens (int): Maximum tokens in response
        system_prompt (str, optional): System instruction for the model
    
    Returns:
        str: Generated text response
        
    Raises:
        Exception: If API key is missing or API call fails
        
    Best Practices:
        - Use temperature 0.7-0.9 for creative content
        - Use temperature 0.1-0.3 for factual/consistent content
        - Set appropriate max_tokens based on expected response length
        - Implement proper error handling in calling functions
        
    Example:
        result = gemini_text_response(
            "Write a blog post about AI", 
            temperature=0.8, 
            max_tokens=1024
        )
    """
    #FIXME: Include : https://github.com/google-gemini/cookbook/blob/main/quickstarts/rest/System_instructions_REST.ipynb
    try:
        api_key = get_gemini_api_key()
        client = genai.Client(api_key=api_key)
        logger.info("✅ Gemini client initialized successfully")
    except Exception as err:
        logger.error(f"Failed to configure Gemini: {err}")
        raise
    logger.info(f"Temp: {temperature}, MaxTokens: {max_tokens}, TopP: {top_p}, N: {n}")
    # Set up AI model config
    generation_config = {
        "temperature": temperature,
        "top_p": top_p,
        "top_k": n,
        "max_output_tokens": max_tokens,
    }
    # FIXME: Expose model_name in main_config
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash-lite',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                top_k=n,
            ),
        )
        
        #logger.info(f"Number of Token in Prompt Sent: {model.count_tokens(prompt)}")
        return response.text
    except Exception as err:
        logger.error(f"Failed to get response from Gemini: {err}")
        raise


async def test_gemini_api_key(api_key: str) -> tuple[bool, str]:
    """
    Test if the provided Gemini API key is valid.
    
    Args:
        api_key (str): The Gemini API key to test
        
    Returns:
        tuple[bool, str]: A tuple containing (is_valid, message)
    """
    try:
        # Validate API key format first
        if not api_key:
            return False, "API key is empty"
        
        if not api_key.startswith('AIza'):
            return False, "API key format appears invalid (should start with 'AIza')"
        
        # Configure Gemini with the provided key
        client = genai.Client(api_key=api_key)
        
        # Try to list models as a simple API test
        models = client.models.list()
        
        # Check if Gemini Pro is available
        model_names = [model.name for model in models]
        logger.info(f"Available models: {model_names}")
        
        if any("gemini" in model_name.lower() for model_name in model_names):
            return True, "Gemini API key is valid"
        else:
            return False, "No Gemini models available with this API key"
        
    except Exception as e:
        error_msg = f"Error testing Gemini API key: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def gemini_pro_text_gen(prompt, temperature=0.7, top_p=0.9, top_k=40, max_tokens=2048):
    """
    Generate text using Google's Gemini Pro model.
    
    Args:
        prompt (str): The input text to generate completion for
        temperature (float, optional): Controls randomness. Defaults to 0.7
        top_p (float, optional): Controls diversity. Defaults to 0.9
        top_k (int, optional): Controls vocabulary size. Defaults to 40
        max_tokens (int, optional): Maximum number of tokens to generate. Defaults to 2048
        
    Returns:
        str: The generated text completion
    """
    try:
        # Get API key with proper error handling
        api_key = get_gemini_api_key()
        client = genai.Client(api_key=api_key)
        
        # Generate content using the new client
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
            ),
        )
        
        # Return the generated text
        return response.text
        
    except Exception as e:
        logger.error(f"Error in Gemini Pro text generation: {e}")
        return str(e)

def _dict_to_types_schema(schema: Dict[str, Any]) -> types.Schema:
    """Convert a JSON schema dict to google.genai.types.Schema."""
    if not isinstance(schema, dict):
        raise ValueError("response_schema must be a dict compatible with types.Schema")

    defs: Dict[str, Any] = {}
    if isinstance(schema.get("$defs"), dict):
        defs.update(schema["$defs"])
    if isinstance(schema.get("definitions"), dict):
        defs.update(schema["definitions"])

    def _resolve_ref(node: Dict[str, Any]) -> Dict[str, Any]:
        ref = node.get("$ref")
        if not isinstance(ref, str) or not ref.startswith("#/"):
            return node

        parts = ref.lstrip("#/").split("/")
        if parts and parts[0] in ("$defs", "definitions"):
            parts = parts[1:]

        target: Any = defs
        for part in parts:
            if isinstance(target, dict) and part in target:
                target = target[part]
            else:
                logger.warning(
                    "Gemini schema $ref could not be resolved ref={} part={}",
                    ref,
                    part,
                )
                return node
        return target if isinstance(target, dict) else node

    def _convert(node: Dict[str, Any]) -> types.Schema:
        if not isinstance(node, dict):
            return types.Schema(type=types.Type.STRING)

        if "$ref" in node:
            node = _resolve_ref(node)

        node_type = (node.get("type") or "OBJECT").upper()

        if node_type == "OBJECT":
            props = node.get("properties") or {}
            props_types: Dict[str, types.Schema] = {}
            for key, prop in props.items():
                if isinstance(prop, dict):
                    props_types[key] = _convert(prop)
                else:
                    props_types[key] = types.Schema(type=types.Type.STRING)
            kwargs: Dict[str, Any] = {
                "type": types.Type.OBJECT,
                "properties": props_types if props_types else None,
            }
            required = node.get("required")
            if isinstance(required, list):
                kwargs["required"] = [str(item) for item in required]
            return types.Schema(**kwargs)

        if node_type == "ARRAY":
            items_node = node.get("items")
            item_schema = (
                _convert(items_node)
                if isinstance(items_node, dict)
                else types.Schema(type=types.Type.STRING)
            )
            kwargs: Dict[str, Any] = {"type": types.Type.ARRAY, "items": item_schema}
            if isinstance(node.get("minItems"), int):
                kwargs["minItems"] = node["minItems"]
            if isinstance(node.get("maxItems"), int):
                kwargs["maxItems"] = node["maxItems"]
            return types.Schema(**kwargs)

        if node_type == "STRING":
            kwargs: Dict[str, Any] = {"type": types.Type.STRING}
            enum_values = node.get("enum")
            if isinstance(enum_values, list):
                kwargs["enum"] = [str(value) for value in enum_values]
            return types.Schema(**kwargs)

        if node_type == "NUMBER":
            return types.Schema(type=types.Type.NUMBER)
        if node_type == "INTEGER":
            return types.Schema(type=types.Type.NUMBER)
        if node_type == "BOOLEAN":
            return types.Schema(type=types.Type.BOOLEAN)

        enum_values = node.get("enum")
        if isinstance(enum_values, list):
            return types.Schema(
                type=types.Type.STRING,
                enum=[str(value) for value in enum_values],
            )
        return types.Schema(type=types.Type.STRING)

    return _convert(schema)

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def gemini_structured_json_response(prompt, schema, temperature=0.7, top_p=0.9, top_k=40, max_tokens=8192, system_prompt=None, user_id: str = None):
    """
    Generate structured JSON response using Google's Gemini Pro model.
    
    This function follows the official Gemini API documentation for structured output:
    https://ai.google.dev/gemini-api/docs/structured-output#python
    
    Args:
        prompt (str): The input prompt for the AI model
        schema (dict): JSON schema defining the expected output structure
        temperature (float): Controls randomness (0.0-1.0). Use 0.1-0.3 for structured output
        top_p (float): Nucleus sampling parameter (0.0-1.0)
        top_k (int): Top-k sampling parameter
        max_tokens (int): Maximum tokens in response. Use 8192 for complex outputs
        system_prompt (str, optional): System instruction for the model
        user_id (str, optional): User ID for usage tracking.
    
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
        result = gemini_structured_json_response(prompt, schema, temperature=0.2, max_tokens=8192)
    """
    try:
        # Get API key with proper error handling
        api_key = get_gemini_api_key()
        logger.info(f"🔑 Gemini API key loaded: {bool(api_key)} (length: {len(api_key) if api_key else 0})")
        
        if not api_key:
            raise Exception("GEMINI_API_KEY not found in environment variables")
            
        client = genai.Client(api_key=api_key)
        logger.info("✅ Gemini client initialized for structured JSON response")

        # Prepare schema for SDK (dict -> types.Schema). If schema is already a types.Schema or Pydantic type, use as-is
        try:
            if isinstance(schema, dict):
                types_schema = _dict_to_types_schema(schema)
            else:
                types_schema = schema
        except Exception as conv_err:
            logger.info(f"Schema conversion warning, defaulting to OBJECT: {conv_err}")
            types_schema = types.Schema(type=types.Type.OBJECT)

        # Add debugging for API call
        logger.info(
            "Gemini structured call | prompt_len=%s | schema_kind=%s | temp=%s | top_p=%s | top_k=%s | max_tokens=%s",
            len(prompt) if isinstance(prompt, str) else '<non-str>',
            type(types_schema).__name__,
            temperature,
            top_p,
            top_k,
            max_tokens,
        )
        
        # Use the official SDK GenerateContentConfig with response_schema
        generation_config = types.GenerateContentConfig(
            response_mime_type='application/json',
            response_schema=types_schema,
            max_output_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            system_instruction=system_prompt,
        )

        logger.info("🚀 Making Gemini API call...")
        
        # Use enhanced retry logic for structured JSON calls
        from services.blog_writer.retry_utils import retry_with_backoff, CONTENT_RETRY_CONFIG
        
        async def make_api_call():
            return client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=generation_config,
            )
        
        try:
            # Convert sync call to async for retry logic
            import asyncio
            
            # Check if there's already an event loop running
            try:
                loop = asyncio.get_running_loop()
                # If we're already in an async context, we need to run this differently
                logger.warning("⚠️ Already in async context, using direct sync call")
                # For now, let's use a simpler approach without retry logic
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=generation_config,
                )
                logger.info("✅ Gemini API call completed successfully (sync mode)")
            except RuntimeError:
                # No event loop running, we can create one
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                response = loop.run_until_complete(
                    retry_with_backoff(
                        make_api_call,
                        config=CONTENT_RETRY_CONFIG,
                        operation_name="gemini_structured_json",
                        context={"schema_type": type(types_schema).__name__, "max_tokens": max_tokens}
                    )
                )
                logger.info("✅ Gemini API call completed successfully")
        except Exception as api_error:
            logger.error(f"❌ Gemini API call failed: {api_error}")
            logger.error(f"❌ API Error type: {type(api_error).__name__}")
            
            # Enhance error with specific exception types
            error_str = str(api_error)
            if "429" in error_str or "rate limit" in error_str.lower():
                from services.blog_writer.exceptions import APIRateLimitException
                raise APIRateLimitException(
                    f"Rate limit exceeded for structured JSON generation: {error_str}",
                    retry_after=60,
                    context={"operation": "structured_json", "max_tokens": max_tokens}
                )
            elif "timeout" in error_str.lower():
                from services.blog_writer.exceptions import APITimeoutException
                raise APITimeoutException(
                    f"Structured JSON generation timed out: {error_str}",
                    timeout_seconds=60,
                    context={"operation": "structured_json", "max_tokens": max_tokens}
                )
            elif "401" in error_str or "403" in error_str:
                from services.blog_writer.exceptions import ValidationException
                raise ValidationException(
                    "Authentication failed for structured JSON generation. Please check your API credentials.",
                    field="api_key",
                    context={"error": error_str, "operation": "structured_json"}
                )
            else:
                from services.blog_writer.exceptions import ContentGenerationException
                raise ContentGenerationException(
                    f"Structured JSON generation failed: {error_str}",
                    context={"error": error_str, "operation": "structured_json", "max_tokens": max_tokens}
                )

        # Check for parsed content first (primary method for structured output)
        if hasattr(response, 'parsed'):
            logger.info(f"Response has parsed attribute: {response.parsed is not None}")
            if response.parsed is not None:
                logger.info("Using response.parsed for structured output")
                
                # Track usage if user_id is provided
                if user_id:
                    try:
                        from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                        import json
                        
                        response_str = json.dumps(response.parsed)
                        
                        track_agent_usage_sync(
                            user_id=user_id,
                            model_name="gemini-2.5-flash",
                            prompt=prompt,
                            response_text=response_str,
                            duration=0.5
                        )
                    except Exception as e:
                        logger.error(f"Failed to track usage: {e}")
                        
                return response.parsed
            else:
                logger.warning("Response.parsed is None, falling back to text parsing")
                # Debug: Check if there's any text content
                if hasattr(response, 'text') and response.text:
                    logger.info(f"Text response length: {len(response.text)}")
                    logger.debug(f"Text response preview: {response.text[:200]}...")
        
        # Check for text content as fallback (only if no parsed content)
        if hasattr(response, 'text') and response.text:
            logger.info("No parsed content, trying to parse text response")
            try:
                import json
                import re
                
                # Clean the text response to fix common JSON issues
                cleaned_text = response.text.strip()
                
                # Remove any markdown code blocks if present
                if cleaned_text.startswith('```json'):
                    cleaned_text = cleaned_text[7:]
                if cleaned_text.endswith('```'):
                    cleaned_text = cleaned_text[:-3]
                cleaned_text = cleaned_text.strip()
                
                # Try to find JSON content between curly braces
                json_match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
                if json_match:
                    cleaned_text = json_match.group(0)
                
                parsed_text = json.loads(cleaned_text)
                logger.info("Successfully parsed text as JSON")
                
                # Track usage if user_id is provided
                if user_id:
                    try:
                        from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                        
                        track_agent_usage_sync(
                            user_id=user_id,
                            model_name="gemini-2.5-flash",
                            prompt=prompt,
                            response_text=cleaned_text,
                            duration=0.5
                        )
                    except Exception as e:
                        logger.error(f"Failed to track usage: {e}")
                        
                return parsed_text
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse text as JSON: {e}")
                logger.debug(f"Problematic text (first 500 chars): {response.text[:500]}")
                
                # Try to extract and fix JSON manually
                try:
                    import re
                    # Look for the main JSON object
                    json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
                    matches = re.findall(json_pattern, response.text, re.DOTALL)
                    if matches:
                        # Try the largest match (likely the main JSON)
                        largest_match = max(matches, key=len)
                        # Basic cleanup of common issues
                        fixed_json = largest_match.replace('\n', ' ').replace('\r', ' ')
                        # Remove any trailing commas before closing braces
                        fixed_json = re.sub(r',\s*}', '}', fixed_json)
                        fixed_json = re.sub(r',\s*]', ']', fixed_json)
                        
                        parsed_text = json.loads(fixed_json)
                        
                        # Track usage if user_id is provided
                        if user_id:
                            try:
                                from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                                import json
                                
                                response_str = json.dumps(parsed_text) if parsed_text else ""
                                
                                track_agent_usage_sync(
                                    user_id=user_id,
                                    model_name="gemini-2.5-flash",
                                    prompt=prompt,
                                    response_text=response_str,
                                    duration=0.5  # Approximation
                                )
                                logger.info(f"✅ Tracked structured JSON usage for user {user_id}")
                            except Exception as e:
                                logger.error(f"Failed to track usage: {e}")

                        logger.info("Successfully parsed cleaned JSON")
                        return parsed_text
                except Exception as fix_error:
                    logger.error(f"Failed to fix JSON manually: {fix_error}")
        
        # Check candidates for content (fallback for edge cases)
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and candidate.content:
                if hasattr(candidate.content, 'parts') and candidate.content.parts:
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            try:
                                import json
                                parsed_text = json.loads(part.text)
                                logger.info("Successfully parsed candidate text as JSON")
                                
                                # Track usage if user_id is provided
                                if user_id:
                                    try:
                                        from services.intelligence.agents.agent_usage_tracking import track_agent_usage_sync
                                        
                                        track_agent_usage_sync(
                                            user_id=user_id,
                                            model_name="gemini-2.5-flash",
                                            prompt=prompt,
                                            response_text=part.text,
                                            duration=0.5
                                        )
                                    except Exception as e:
                                        logger.error(f"Failed to track usage: {e}")
                                        
                                return parsed_text
                            except json.JSONDecodeError as e:
                                logger.error(f"Failed to parse candidate text as JSON: {e}")
        
        logger.error("No valid structured response content found")
        return {"error": "No valid structured response content found"}

    except ValueError as e:
        # API key related errors should not be retried
        logger.error(f"API key error in Gemini Pro structured JSON generation: {e}")
        return {"error": str(e)}
    except Exception as e:
        # Check if this is a quota/rate limit error
        msg = str(e)
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg or "quota" in msg.lower():
            logger.error(f"Rate limit/quota error in Gemini Pro structured JSON generation: {msg}")
            # Return error instead of retrying - quota exhausted means we need to wait or upgrade plan
            return {"error": msg}
        # For other errors, let tenacity handle retries
        logger.error(f"Error in Gemini Pro structured JSON generation: {e}")
        raise


# Removed JSON repair functions to avoid false positives
def _removed_repair_json_string(text: str) -> Optional[str]:
    """
    Attempt to repair common JSON issues in AI responses.
    """
    if not text:
        return None
    
    # Remove any non-JSON content before first {
    start = text.find('{')
    if start == -1:
        return None
    text = text[start:]
    
    # Remove any content after last }
    end = text.rfind('}')
    if end == -1:
        return None
    text = text[:end+1]
    
    # Fix common issues
    repaired = text
    
    # 1. Fix unterminated arrays (add missing closing brackets)
    # Count opening and closing brackets
    open_brackets = repaired.count('[')
    close_brackets = repaired.count(']')
    if open_brackets > close_brackets:
        # Add missing closing brackets
        missing_brackets = open_brackets - close_brackets
        repaired = repaired + ']' * missing_brackets
    
    # 2. Fix unterminated strings in arrays
    # Look for patterns like ["item1", "item2" and add missing quote and bracket
    lines = repaired.split('\n')
    fixed_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Check if line ends with an unquoted string in an array
        if stripped.endswith('"') and i < len(lines) - 1:
            next_line = lines[i + 1].strip()
            if next_line.startswith(']'):
                # This is fine
                pass
            elif not next_line.startswith('"') and not next_line.startswith(']'):
                # Add missing quote and comma
                line = line + '",'
        fixed_lines.append(line)
    repaired = '\n'.join(fixed_lines)
    
    # 3. Fix unterminated strings (common issue with AI responses)
    try:
        # Handle unterminated strings by finding the last incomplete string and closing it
        lines = repaired.split('\n')
        fixed_lines = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Check for unterminated strings (line ends with quote but no closing quote)
            if stripped.endswith('"') and i < len(lines) - 1:
                next_line = lines[i + 1].strip()
                # If next line doesn't start with quote or closing bracket, we might have an unterminated string
                if not next_line.startswith('"') and not next_line.startswith(']') and not next_line.startswith('}'):
                    # Check if this looks like an unterminated string value
                    if ':' in line and not line.strip().endswith('",'):
                        line = line + '",'
            # Count quotes in the line
            quote_count = line.count('"')
            if quote_count % 2 == 1:  # Odd number of quotes
                # Add a quote at the end if it looks like an incomplete string
                if ':' in line and line.strip().endswith('"'):
                    line = line + '"'
                elif ':' in line and not line.strip().endswith('"') and not line.strip().endswith(','):
                    line = line + '",'
            fixed_lines.append(line)
        repaired = '\n'.join(fixed_lines)
    except Exception:
        pass
    
    # 4. Remove trailing commas before closing braces/brackets
    repaired = re.sub(r',(\s*[}\]])', r'\1', repaired)
    
    # 5. Fix missing commas between object properties
    repaired = re.sub(r'"(\s*)"', r'",\1"', repaired)
    
    return repaired


# Removed partial JSON extraction to avoid false positives
def _removed_extract_partial_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract partial JSON from truncated responses.
    Attempts to salvage as much data as possible from incomplete JSON.
    """
    if not text:
        return None
    
    try:
        # Find the start of JSON
        start = text.find('{')
        if start == -1:
            return None
        
        # Extract from start to end, handling common truncation patterns
        json_text = text[start:]
        
        # Common truncation patterns and their fixes
        truncation_patterns = [
            (r'(["\w\s,{}\[\]\-\.:]+)\.\.\.$', r'\1'),  # Remove trailing ...
            (r'(["\w\s,{}\[\]\-\.:]+)"$', r'\1"'),      # Add missing closing quote
            (r'(["\w\s,{}\[\]\-\.:]+),$', r'\1'),       # Remove trailing comma
            (r'(["\w\s,{}\[\]\-\.:]+)\[(["\w\s,{}\[\]\-\.:]*)$', r'\1\2]'),  # Close unclosed arrays
            (r'(["\w\s,{}\[\]\-\.:]+)\{(["\w\s,{}\[\]\-\.:]*)$', r'\1\2}'),  # Close unclosed objects
        ]
        
        # Apply truncation fixes
        import re
        for pattern, replacement in truncation_patterns:
            json_text = re.sub(pattern, replacement, json_text)
        
        # Try to balance brackets and braces
        open_braces = json_text.count('{')
        close_braces = json_text.count('}')
        open_brackets = json_text.count('[')
        close_brackets = json_text.count(']')
        
        # Add missing closing braces/brackets
        if open_braces > close_braces:
            json_text += '}' * (open_braces - close_braces)
        if open_brackets > close_brackets:
            json_text += ']' * (open_brackets - close_brackets)
        
        # Try to parse the repaired JSON
        try:
            result = json.loads(json_text)
            logger.info(f"Successfully extracted partial JSON with {len(str(result))} characters")
            return result
        except json.JSONDecodeError as e:
            logger.debug(f"Partial JSON parsing failed: {e}")
            
            # Try to extract individual fields as a last resort
            fields = {}
            
            # Extract key-value pairs using regex (more comprehensive patterns)
            kv_patterns = [
                r'"([^"]+)"\s*:\s*"([^"]*)"',  # "key": "value"
                r'"([^"]+)"\s*:\s*(\d+)',      # "key": 123
                r'"([^"]+)"\s*:\s*(true|false)', # "key": true/false
                r'"([^"]+)"\s*:\s*null',       # "key": null
            ]
            
            for pattern in kv_patterns:
                matches = re.findall(pattern, json_text)
                for key, value in matches:
                    if value == 'true':
                        fields[key] = True
                    elif value == 'false':
                        fields[key] = False
                    elif value == 'null':
                        fields[key] = None
                    elif value.isdigit():
                        fields[key] = int(value)
                    else:
                        fields[key] = value
            
            # Extract array fields (more robust)
            array_pattern = r'"([^"]+)"\s*:\s*\[([^\]]*)\]'
            array_matches = re.findall(array_pattern, json_text)
            for key, array_content in array_matches:
                # Parse array items more comprehensively
                items = []
                # Look for quoted strings, numbers, booleans, null
                item_patterns = [
                    r'"([^"]*)"',  # quoted strings
                    r'(\d+)',      # numbers
                    r'(true|false)', # booleans
                    r'(null)',     # null
                ]
                for pattern in item_patterns:
                    item_matches = re.findall(pattern, array_content)
                    for match in item_matches:
                        if match == 'true':
                            items.append(True)
                        elif match == 'false':
                            items.append(False)
                        elif match == 'null':
                            items.append(None)
                        elif match.isdigit():
                            items.append(int(match))
                        else:
                            items.append(match)
                if items:
                    fields[key] = items
            
            # Extract nested object fields (basic)
            object_pattern = r'"([^"]+)"\s*:\s*\{([^}]*)\}'
            object_matches = re.findall(object_pattern, json_text)
            for key, object_content in object_matches:
                # Simple nested object extraction
                nested_fields = {}
                nested_kv_matches = re.findall(r'"([^"]+)"\s*:\s*"([^"]*)"', object_content)
                for nested_key, nested_value in nested_kv_matches:
                    nested_fields[nested_key] = nested_value
                if nested_fields:
                    fields[key] = nested_fields
            
            if fields:
                logger.info(f"Extracted {len(fields)} fields from truncated JSON: {list(fields.keys())}")
                # Only return if we have a valid outline structure
                if 'outline' in fields and isinstance(fields['outline'], list):
                    return {'outline': fields['outline']}
                else:
                    logger.error("No valid 'outline' field found in partial JSON")
                    return None
            
            return None
            
    except Exception as e:
        logger.debug(f"Error in partial JSON extraction: {e}")
        return None


# Removed key-value extraction to avoid false positives
def _removed_extract_key_value_pairs(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract key-value pairs from malformed JSON text as a last resort.
    """
    if not text:
        return None
    
    result = {}
    
    # Look for patterns like "key": "value" or "key": value
    # This regex looks for quoted keys followed by colons and values
    pattern = r'"([^"]+)"\s*:\s*(?:"([^"]*)"|([^,}\]]+))'
    matches = re.findall(pattern, text)
    
    for key, quoted_value, unquoted_value in matches:
        value = quoted_value if quoted_value else unquoted_value.strip()
        
        # Clean up the value - remove any trailing content that looks like the next key
        # This handles cases where the regex captured too much
        if value and '"' in value:
            # Split at the first quote that might be the start of the next key
            parts = value.split('"')
            if len(parts) > 1:
                value = parts[0].strip()
        
        # Try to parse the value appropriately
        if value.lower() in ['true', 'false']:
            result[key] = value.lower() == 'true'
        elif value.lower() == 'null':
            result[key] = None
        elif value.isdigit():
            result[key] = int(value)
        elif value.replace('.', '').replace('-', '').isdigit():
            try:
                result[key] = float(value)
            except ValueError:
                result[key] = value
        else:
            result[key] = value
    
    # Also try to extract array values
    array_pattern = r'"([^"]+)"\s*:\s*\[([^\]]*)\]'
    array_matches = re.findall(array_pattern, text)
    
    for key, array_content in array_matches:
        # Extract individual array items
        items = []
        # Look for quoted strings in the array
        item_pattern = r'"([^"]*)"'
        item_matches = re.findall(item_pattern, array_content)
        for item in item_matches:
            if item.strip():
                items.append(item.strip())
        
        if items:
            result[key] = items
    
    return result if result else None