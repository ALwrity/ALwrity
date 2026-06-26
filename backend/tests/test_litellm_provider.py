"""Tests for the LiteLLM provider module.

Covers:
- Text response generation (mocked)
- Structured JSON response generation (mocked)
- Invalid API key fails fast without retry
- Unknown model fails fast without retry
- drop_params=True is always set
- Empty/None response content handled gracefully
- Transient errors are retried, non-transient are not
"""
import json
import sys
import types
from pathlib import Path
from unittest import mock

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(content="test response", prompt_tokens=10, completion_tokens=5):
    """Build a fake litellm ModelResponse matching the real shape."""
    choice = mock.MagicMock()
    choice.message.content = content

    usage = mock.MagicMock()
    usage.prompt_tokens = prompt_tokens
    usage.completion_tokens = completion_tokens

    resp = mock.MagicMock()
    resp.choices = [choice]
    resp.usage = usage
    return resp


def _make_empty_content_response():
    """Response where content is None (edge case)."""
    return _make_mock_response(content=None)


# ---------------------------------------------------------------------------
# Text response tests
# ---------------------------------------------------------------------------

class TestLiteLLMTextResponse:
    def test_basic_call(self):
        """litellm_text_response returns the model's text content."""
        with mock.patch("litellm.completion", return_value=_make_mock_response("Hello world")):
            from services.llm_providers.litellm_provider import litellm_text_response

            result = litellm_text_response(
                prompt="Say hello",
                model="openai/gpt-4o",
                temperature=0.5,
                max_tokens=100,
            )
            assert result == "Hello world"

    def test_drop_params_always_set(self):
        """drop_params=True must be passed to litellm.completion."""
        with mock.patch("litellm.completion", return_value=_make_mock_response()) as mock_comp:
            from services.llm_providers.litellm_provider import litellm_text_response

            litellm_text_response(prompt="test", model="openai/gpt-4o")
            call_kwargs = mock_comp.call_args
            assert call_kwargs.kwargs.get("drop_params") is True or \
                   call_kwargs[1].get("drop_params") is True

    def test_system_prompt_included(self):
        """System prompt is prepended as a system message."""
        with mock.patch("litellm.completion", return_value=_make_mock_response()) as mock_comp:
            from services.llm_providers.litellm_provider import litellm_text_response

            litellm_text_response(
                prompt="user msg",
                model="openai/gpt-4o",
                system_prompt="Be concise",
            )
            messages = mock_comp.call_args.kwargs.get("messages") or mock_comp.call_args[1].get("messages")
            assert messages[0] == {"role": "system", "content": "Be concise"}
            assert messages[1] == {"role": "user", "content": "user msg"}

    def test_none_content_returns_empty_string(self):
        """If the API returns None content, return empty string not crash."""
        with mock.patch("litellm.completion", return_value=_make_empty_content_response()):
            from services.llm_providers.litellm_provider import litellm_text_response

            result = litellm_text_response(prompt="test", model="openai/gpt-4o")
            assert result == ""


# ---------------------------------------------------------------------------
# Structured JSON response tests
# ---------------------------------------------------------------------------

class TestLiteLLMStructuredResponse:
    def test_valid_json(self):
        """Structured response parses clean JSON correctly."""
        json_content = '{"answer": 42}'
        with mock.patch("litellm.completion", return_value=_make_mock_response(json_content)):
            from services.llm_providers.litellm_provider import litellm_structured_json_response

            schema = {"type": "object", "properties": {"answer": {"type": "integer"}}}
            result = litellm_structured_json_response(
                prompt="What is the answer?",
                schema=schema,
                model="openai/gpt-4o",
            )
            assert isinstance(result, dict)
            assert result["answer"] == 42

    def test_json_in_code_block(self):
        """Structured response extracts JSON from markdown code blocks."""
        content = '```json\n{"answer": 42}\n```'
        with mock.patch("litellm.completion", return_value=_make_mock_response(content)):
            from services.llm_providers.litellm_provider import litellm_structured_json_response

            schema = {"type": "object", "properties": {"answer": {"type": "integer"}}}
            result = litellm_structured_json_response(prompt="test", schema=schema, model="openai/gpt-4o")
            assert isinstance(result, dict)
            assert result["answer"] == 42

    def test_unparseable_returns_raw(self):
        """If JSON can't be parsed, return raw text instead of crashing."""
        with mock.patch("litellm.completion", return_value=_make_mock_response("not json at all")):
            from services.llm_providers.litellm_provider import litellm_structured_json_response

            schema = {"type": "object", "properties": {}}
            result = litellm_structured_json_response(prompt="test", schema=schema, model="openai/gpt-4o")
            assert result == "not json at all"


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------

def _make_litellm_exception(class_name, message="test error"):
    """Create a fake exception whose qualified name matches litellm.exceptions.*."""
    exc_type = type(class_name, (Exception,), {"__module__": "litellm.exceptions"})
    return exc_type(message)


class TestLiteLLMErrorHandling:
    def test_auth_error_not_retried(self):
        """AuthenticationError should fail fast, not be retried."""
        exc = _make_litellm_exception("AuthenticationError", "Missing API Key")

        from services.llm_providers.litellm_provider import _is_transient
        assert _is_transient(exc) is False

    def test_rate_limit_is_transient(self):
        """RateLimitError should be classified as transient."""
        exc = _make_litellm_exception("RateLimitError", "Rate limit exceeded")

        from services.llm_providers.litellm_provider import _is_transient
        assert _is_transient(exc) is True

    def test_timeout_is_transient(self):
        """Timeout should be classified as transient."""
        exc = _make_litellm_exception("Timeout", "Request timed out")

        from services.llm_providers.litellm_provider import _is_transient
        assert _is_transient(exc) is True

    def test_bad_request_not_transient(self):
        """BadRequestError (e.g. invalid model) should not be retried."""
        exc = _make_litellm_exception("BadRequestError", "Model not found")

        from services.llm_providers.litellm_provider import _is_transient
        assert _is_transient(exc) is False

    def test_string_429_is_transient(self):
        """Error messages containing '429' should be treated as transient."""
        from services.llm_providers.litellm_provider import _is_transient

        exc = Exception("HTTP 429 Too Many Requests")
        assert _is_transient(exc) is True

    def test_string_timeout_is_transient(self):
        """Error messages containing 'timeout' should be treated as transient."""
        from services.llm_providers.litellm_provider import _is_transient

        exc = Exception("Connection timeout after 30s")
        assert _is_transient(exc) is True
