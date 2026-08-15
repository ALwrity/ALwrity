"""Per-provider structured-JSON parse tests.

Mocks each OpenAI-based provider's client to assert that ``\'`` / single-quote
responses (the Facebook failure mode) are parsed via the shared robust parser.

The test environment stubs the ``openai`` package (see conftest.py), so we
also patch each module's ``NotFoundError`` to a real exception type and force
``OPENAI_AVAILABLE`` to True.
"""

from types import SimpleNamespace
from unittest.mock import patch

import pytest


class _FakeNotFoundError(Exception):
    pass


def _mock_openai_class(content: str):
    def create(**kwargs):
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=10, total_tokens=20),
        )

    class _Client:
        def __init__(self, **kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    return _Client


@pytest.fixture
def api_keys(monkeypatch):
    monkeypatch.setenv("NOVAROUTE_API_KEY", "test-key")
    monkeypatch.setenv("HF_TOKEN", "hf_test")
    monkeypatch.setenv("WAVESPEED_API_KEY", "test-key-12345")


def _install_mock(monkeypatch, mod, content):
    monkeypatch.setattr(mod, "OpenAI", _mock_openai_class(content))
    monkeypatch.setattr(mod, "NotFoundError", _FakeNotFoundError)
    monkeypatch.setattr(mod, "OPENAI_AVAILABLE", True)


APOSTROPHE_JSON = '{"engagement": ["marketers\\\' biggest bottlenecks."]}'
EXPECTED = {"engagement": ["marketers' biggest bottlenecks."]}


def test_novaroute_parses_apostrophe(api_keys, monkeypatch):
    from services.llm_providers import novarouteai_provider as mod

    _install_mock(monkeypatch, mod, APOSTROPHE_JSON)
    result = mod.novaroute_structured_json_response("prompt", {"type": "object"})
    assert result == EXPECTED


def test_huggingface_parses_apostrophe(api_keys, monkeypatch):
    from services.llm_providers import huggingface_provider as mod

    _install_mock(monkeypatch, mod, APOSTROPHE_JSON)
    result = mod.huggingface_structured_json_response("prompt", {"type": "object"})
    assert result == EXPECTED


def test_wavespeed_parses_apostrophe(api_keys, monkeypatch):
    from services.llm_providers import wavespeed_provider as mod

    _install_mock(monkeypatch, mod, APOSTROPHE_JSON)
    result = mod.wavespeed_structured_json_response("prompt", {"type": "object"})
    assert result == EXPECTED


def test_novaroute_returns_error_dict_on_garbage(api_keys, monkeypatch):
    from services.llm_providers import novarouteai_provider as mod

    _install_mock(monkeypatch, mod, "not json at all")
    result = mod.novaroute_structured_json_response("prompt", {"type": "object"})
    assert "error" in result
    assert result["raw_response"] == "not json at all"
