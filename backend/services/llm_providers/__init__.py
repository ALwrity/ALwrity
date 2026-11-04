"""LLM Providers Service for ALwrity Backend.

This service handles all LLM (Language Model) provider integrations,
migrated from the legacy lib/gpt_providers functionality.
"""

from services.llm_providers.main_text_generation import llm_text_gen
from services.llm_providers.gemini_provider import gemini_text_response, gemini_structured_json_response
from services.llm_providers.huggingface_provider import huggingface_text_response, huggingface_structured_json_response
from services.llm_providers.orcarouter_provider import (
    orcarouter_text_response,
    orcarouter_structured_json_response,
)


__all__ = [
    "llm_text_gen",
    "gemini_text_response",
    "gemini_structured_json_response",
    "huggingface_text_response",
    "huggingface_structured_json_response",
    "orcarouter_text_response",
    "orcarouter_structured_json_response",
]