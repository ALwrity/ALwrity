"""Tests for the OrcaRouter LLM provider integration.

These tests cover the provider registration surface without making network calls:
- tenant_provider_config_resolver: OrcaRouter alias normalization and env var lookup
- orcarouter_provider module: base URL, default model, and API key format validation
"""

import os
from unittest.mock import patch

import pytest


class TestTenantProviderConfigOrcaRouter:
    """Provider resolver recognizes orcarouter as a first-class text provider."""

    def test_normalize_orcarouter_alias(self):
        from services.llm_providers.tenant_provider_config import tenant_provider_config_resolver

        assert tenant_provider_config_resolver._normalize_provider("orcarouter") == "orcarouter"
        assert tenant_provider_config_resolver._normalize_provider("orca") == "orcarouter"
        assert tenant_provider_config_resolver._normalize_provider("ORCAROUTER") == "orcarouter"

    def test_orcarouter_env_var_resolution(self):
        from services.llm_providers.tenant_provider_config import tenant_provider_config_resolver

        with patch.dict(os.environ, {"ORCAROUTER_API_KEY": "sk-orca-test-1234567890"}):
            key, source = tenant_provider_config_resolver.resolve_provider_key("orcarouter", user_id=None)
            assert key == "sk-orca-test-1234567890"
            assert source == "env_default"

    def test_orcarouter_text_default_model(self):
        from services.llm_providers.tenant_provider_config import tenant_provider_config_resolver

        cfg = tenant_provider_config_resolver.resolve(modality="text", user_id=None, explicit_provider="orcarouter")
        assert cfg.selected_providers == ["orcarouter"]
        assert cfg.model_policy["default_model"] == "orcarouter/auto"


class TestOrcaRouterProviderModule:
    """orcarouter_provider module constants and key validation."""

    def test_base_url_and_default_model(self):
        import services.llm_providers.orcarouter_provider as mod

        assert mod.ORCAROUTER_BASE_URL == "https://api.orcarouter.ai/v1"
        assert mod.ORCAROUTER_DEFAULT_MODEL == "orcarouter/auto"

    def test_api_key_format_validation(self):
        from services.llm_providers.orcarouter_provider import get_orcarouter_api_key

        with patch.dict(os.environ, {"ORCAROUTER_API_KEY": "sk-orca-1234567890abcdef"}):
            assert get_orcarouter_api_key() == "sk-orca-1234567890abcdef"

    def test_api_key_format_rejects_bad_prefix(self):
        from services.llm_providers.orcarouter_provider import get_orcarouter_api_key

        with patch.dict(os.environ, {"ORCAROUTER_API_KEY": "sk-bad-1234567890"}):
            with pytest.raises(ValueError, match="sk-orca-"):
                get_orcarouter_api_key()
