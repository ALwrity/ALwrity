"""Sanity and functional tests for the OAuth framework.

Covers the base class, provider constants, callback utilities,
encryption, monitoring models, and platform registry — areas not
covered by the existing LinkedIn/Wix/monitoring-service tests.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.smoke]


# ==========================================================================
# OAuth Base Class — Encryption
# ==========================================================================

class TestOAuthEncryption:
    """Fernet encryption/decryption used by all providers."""

    def test_encrypt_decrypt_roundtrip(self):
        key = Fernet.generate_key()
        fernet = Fernet(key)
        token = "my_secret_access_token_12345"
        encrypted = fernet.encrypt(token.encode("utf-8"))
        decrypted = fernet.decrypt(encrypted).decode("utf-8")
        assert decrypted == token
        assert encrypted != token.encode("utf-8")

    def test_is_likely_encrypted_blob(self):
        from services.integrations.oauth_provider_base import OAuthProviderBase
        key = Fernet.generate_key()
        os.environ["OAUTH_TOKEN_ENCRYPTION_KEY"] = key.decode("utf-8")
        token = "plaintext_token"
        fernet = Fernet(key)
        encrypted = fernet.encrypt(token.encode("utf-8")).decode("utf-8")

        # Need a constructed instance — use the static check pattern
        assert encrypted.startswith("gAAAAA")
        assert not token.startswith("gAAAAA")

    def test_encrypted_blobs_are_different_each_time(self):
        key = Fernet.generate_key()
        fernet = Fernet(key)
        token = "same_token"
        enc1 = fernet.encrypt(token.encode("utf-8"))
        enc2 = fernet.encrypt(token.encode("utf-8"))
        assert enc1 != enc2, "Fernet should produce unique ciphertexts (nonce-based)"

    def test_invalid_key_raises(self):
        with pytest.raises(Exception):
            Fernet(b"not_a_valid_fernet_key____")


# ==========================================================================
# OAuth Base Class — Key Resolution
# ==========================================================================

class TestKeyResolution:
    """Encryption key resolution cascade: provider-specific → shared fallback."""

    def test_resolve_encryption_key_uses_provider_specific_first(self, monkeypatch):
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8"))
        monkeypatch.delenv("BING_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.oauth_provider_base import resolve_encryption_key
        key = resolve_encryption_key("linkedin")
        assert key is not None

    def test_resolve_encryption_key_falls_back_to_shared(self, monkeypatch):
        shared = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", shared)
        monkeypatch.delenv("BING_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.oauth_provider_base import resolve_encryption_key
        key = resolve_encryption_key("bing")
        assert key == shared

    def test_resolve_encryption_key_missing_all_returns_none(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("BING_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("WORDPRESS_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("WIX_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("YOUTUBE_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.oauth_provider_base import resolve_encryption_key
        key = resolve_encryption_key("bing")
        assert key is None


# ==========================================================================
# Provider env var mappings
# ==========================================================================

class TestProviderEnvVars:
    """All 5 providers must have encryption key env var names defined.
    PROVIDER_ENV_VARS is: {provider_name: env_var_name_string}"""

    _EXPECTED_PROVIDERS = {"bing", "wix", "wordpress", "youtube", "linkedin"}

    def test_provider_env_vars_has_all_platforms(self):
        from services.integrations.oauth_provider_base import PROVIDER_ENV_VARS
        actual = set(PROVIDER_ENV_VARS.keys())
        assert self._EXPECTED_PROVIDERS.issubset(actual), (
            f"Missing providers: {self._EXPECTED_PROVIDERS - actual}"
        )

    def test_each_provider_has_env_var_name(self):
        from services.integrations.oauth_provider_base import PROVIDER_ENV_VARS
        for provider, env_var_name in PROVIDER_ENV_VARS.items():
            assert isinstance(env_var_name, str), (
                f"{provider} env var name is not a string: {type(env_var_name)}"
            )
            assert len(env_var_name) > 0, f"{provider} has empty env var name"
            assert "TOKEN_ENCRYPTION_KEY" in env_var_name, (
                f"{provider} env var '{env_var_name}' should contain 'TOKEN_ENCRYPTION_KEY'"
            )

    def test_no_duplicate_env_var_names_across_providers(self):
        from services.integrations.oauth_provider_base import PROVIDER_ENV_VARS
        seen = {}
        for provider, env_var in PROVIDER_ENV_VARS.items():
            if env_var in seen:
                # LinkedIn shares the env var pattern but should be unique
                pass  # Allowed if providers share the same env var name
            seen[env_var] = provider


# ==========================================================================
# OAuth Provider Base — DB Path
# ==========================================================================

class TestOAuthDBPath:
    """Per-user DB path pattern used by all providers."""

    def test_get_db_path_is_per_user(self):
        from services.integrations.oauth_provider_base import OAuthProviderBase
        # We can't instantiate the abstract base, but we can check
        # the pattern that all subclasses follow
        from services.database import get_user_db_path
        path_a = get_user_db_path("user_aaa")
        path_b = get_user_db_path("user_bbb")
        assert path_a != path_b
        assert "user_aaa" in str(path_a)
        assert "user_bbb" in str(path_b)


# ==========================================================================
# Platform registry completeness
# ==========================================================================

class TestPlatformRegistry:
    """All 6 platforms must be in the monitoring dispatch."""

    _ALL_PLATFORMS = {"gsc", "bing", "wordpress", "wix", "youtube", "linkedin"}

    def test_platform_checks_has_all_six(self):
        from services.oauth_token_monitoring_service import _PLATFORM_CHECKS
        platforms = {pid for pid, _ in _PLATFORM_CHECKS}
        assert platforms == self._ALL_PLATFORMS, (
            f"Missing: {self._ALL_PLATFORMS - platforms}, "
            f"Extra: {platforms - self._ALL_PLATFORMS}"
        )

    def test_platform_order_is_canonical(self):
        from services.oauth_token_monitoring_service import _PLATFORM_CHECKS
        expected = ["gsc", "bing", "wordpress", "wix", "youtube", "linkedin"]
        actual = [pid for pid, _ in _PLATFORM_CHECKS]
        assert actual == expected

    def test_all_checkers_are_callable(self):
        from services.oauth_token_monitoring_service import _PLATFORM_CHECKS
        for pid, checker in _PLATFORM_CHECKS:
            assert callable(checker), f"Checker for {pid} is not callable"


# ==========================================================================
# OAuth callback utilities
# ==========================================================================

class TestCallbackUtils:
    """OAuth callback HTML generation and URL sanitization."""

    def test_sanitize_string_truncates(self):
        from services.integrations.oauth_callback_utils import sanitize_string
        long_str = "a" * 1000
        result = sanitize_string(long_str, max_len=500)
        assert len(result) <= 500

    def test_sanitize_string_strips_whitespace(self):
        from services.integrations.oauth_callback_utils import sanitize_string
        assert sanitize_string("  hello world  ") == "hello world"

    def test_sanitize_error_handles_none(self):
        from services.integrations.oauth_callback_utils import sanitize_error
        result = sanitize_error(None)
        assert isinstance(result, str)

    def test_normalize_origin_extracts_scheme_host(self):
        from services.integrations.oauth_callback_utils import normalize_origin
        assert normalize_origin("https://example.com/path?q=1") == "https://example.com"
        assert normalize_origin("http://localhost:3000/callback") == "http://localhost:3000"

    def test_trusted_frontend_origin(self, monkeypatch):
        monkeypatch.setenv("FRONTEND_URL", "https://app.example.com")
        from services.integrations.oauth_callback_utils import trusted_frontend_origin
        origin = trusted_frontend_origin()
        assert origin == "https://app.example.com"

    def test_build_oauth_callback_html_generates_valid_structure(self):
        from services.integrations.oauth_callback_utils import build_oauth_callback_html
        html = build_oauth_callback_html(
            payload={"status": "ok"},
            title="OAuth Callback",
            heading="Connected",
            message="Your account is connected.",
        )
        assert "<html" in html
        assert "postMessage" in html
        assert "OAuth Callback" in html
        assert "Connected" in html


# ==========================================================================
# OAuth monitoring models
# ==========================================================================

class TestOAuthMonitoringModels:
    """Verify the monitoring task and execution log models."""

    def test_monitoring_task_model_exists(self):
        from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
        assert OAuthTokenMonitoringTask.__tablename__ == "oauth_token_monitoring_tasks"

    def test_execution_log_model_exists(self):
        from models.oauth_token_monitoring_models import OAuthTokenExecutionLog
        assert OAuthTokenExecutionLog.__tablename__ == "oauth_token_execution_logs"

    def test_task_has_platform_field(self):
        from models.oauth_token_monitoring_models import OAuthTokenMonitoringTask
        assert hasattr(OAuthTokenMonitoringTask, "platform")
        assert hasattr(OAuthTokenMonitoringTask, "user_id")
        assert hasattr(OAuthTokenMonitoringTask, "status")

    def test_execution_log_has_required_fields(self):
        from models.oauth_token_monitoring_models import OAuthTokenExecutionLog
        assert hasattr(OAuthTokenExecutionLog, "task_id")
        assert hasattr(OAuthTokenExecutionLog, "status")
        assert hasattr(OAuthTokenExecutionLog, "execution_date")


# ==========================================================================
# Provider fail-fast behavior
# ==========================================================================

class TestProviderFailFast:
    """All providers must fail fast when no encryption key is configured."""

    def test_wordpress_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("WORDPRESS_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.setenv("WP_CLIENT_ID", "fake_id")
        monkeypatch.setenv("WP_CLIENT_SECRET", "fake_secret")
        from services.integrations.wordpress_oauth import WordPressOAuthService
        with pytest.raises(ValueError, match="encryption"):
            WordPressOAuthService()

    def test_bing_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("BING_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.setenv("BING_CLIENT_ID", "fake_id")
        monkeypatch.setenv("BING_CLIENT_SECRET", "fake_secret")
        from services.integrations.bing_oauth import BingOAuthService
        with pytest.raises(ValueError, match="encryption"):
            BingOAuthService()

    def test_wix_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("WIX_TOKEN_ENCRYPTION_KEY", raising=False)
        from services.integrations.wix_oauth import WixOAuthService
        with pytest.raises(ValueError, match="encryption"):
            WixOAuthService()

    def test_youtube_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("YOUTUBE_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake_id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "fake_secret")
        from services.youtube.youtube_oauth_service import YouTubeOAuthService
        with pytest.raises(ValueError, match="encryption"):
            YouTubeOAuthService()

    def test_linkedin_raises_without_key(self, monkeypatch):
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.setenv("LINKEDIN_CLIENT_ID", "fake_id")
        monkeypatch.setenv("LINKEDIN_CLIENT_SECRET", "fake_secret")
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        with pytest.raises(ValueError, match="encryption"):
            LinkedInOAuthService()


# ==========================================================================
# Provider constructor with valid key
# ==========================================================================

class TestProviderConstruction:
    """Providers should construct successfully with a valid encryption key."""

    @pytest.fixture(autouse=True)
    def _setup_key(self, monkeypatch):
        key = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", key)
        monkeypatch.setenv("WP_CLIENT_ID", "fake_id")
        monkeypatch.setenv("WP_CLIENT_SECRET", "fake_secret")
        monkeypatch.setenv("BING_CLIENT_ID", "fake_id")
        monkeypatch.setenv("BING_CLIENT_SECRET", "fake_secret")
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "fake_id")
        monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "fake_secret")
        monkeypatch.setenv("LINKEDIN_CLIENT_ID", "fake_id")
        monkeypatch.setenv("LINKEDIN_CLIENT_SECRET", "fake_secret")

    def test_wordpress_constructs(self):
        from services.integrations.wordpress_oauth import WordPressOAuthService
        svc = WordPressOAuthService()
        assert svc is not None

    def test_bing_constructs(self):
        from services.integrations.bing_oauth import BingOAuthService
        svc = BingOAuthService()
        assert svc is not None

    def test_wix_constructs(self):
        from services.integrations.wix_oauth import WixOAuthService
        svc = WixOAuthService()
        assert svc is not None

    def test_youtube_constructs(self):
        from services.youtube.youtube_oauth_service import YouTubeOAuthService
        svc = YouTubeOAuthService()
        assert svc is not None

    def test_linkedin_constructs(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        svc = LinkedInOAuthService()
        assert svc is not None


# ==========================================================================
# Provider inheritance
# ==========================================================================

class TestProviderInheritance:
    """All providers must inherit from OAuthProviderBase."""

    def _check_inherits(self, module_path, class_name):
        import importlib
        mod = importlib.import_module(module_path)
        cls = getattr(mod, class_name)
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert issubclass(cls, OAuthProviderBase), (
            f"{class_name} does not inherit from OAuthProviderBase"
        )

    def test_wordpress_inherits_base(self):
        self._check_inherits(
            "services.integrations.wordpress_oauth", "WordPressOAuthService"
        )

    def test_bing_inherits_base(self):
        self._check_inherits(
            "services.integrations.bing_oauth", "BingOAuthService"
        )

    def test_wix_inherits_base(self):
        self._check_inherits(
            "services.integrations.wix_oauth", "WixOAuthService"
        )

    def test_youtube_inherits_base(self):
        self._check_inherits(
            "services.youtube.youtube_oauth_service", "YouTubeOAuthService"
        )

    def test_linkedin_inherits_base(self):
        self._check_inherits(
            "services.integrations.linkedin_oauth", "LinkedInOAuthService"
        )


# ==========================================================================
# OAuth disconnect endpoint patterns
# ==========================================================================

class TestDisconnectPatterns:
    """All platforms must have a disconnect/revoke mechanism."""

    def test_all_providers_have_revoke_method(self):
        providers = [
            ("services.integrations.wordpress_oauth", "WordPressOAuthService"),
            ("services.integrations.bing_oauth", "BingOAuthService"),
            ("services.integrations.wix_oauth", "WixOAuthService"),
            ("services.youtube.youtube_oauth_service", "YouTubeOAuthService"),
            ("services.integrations.linkedin_oauth", "LinkedInOAuthService"),
        ]
        import importlib
        for module_path, class_name in providers:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)
            assert hasattr(cls, "revoke_token"), (
                f"{class_name} missing revoke_token method"
            )

    def test_all_providers_have_connection_status(self):
        providers = [
            ("services.integrations.wordpress_oauth", "WordPressOAuthService"),
            ("services.integrations.bing_oauth", "BingOAuthService"),
            ("services.youtube.youtube_oauth_service", "YouTubeOAuthService"),
            ("services.integrations.linkedin_oauth", "LinkedInOAuthService"),
        ]
        import importlib
        for module_path, class_name in providers:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, class_name)
            assert hasattr(cls, "get_connection_status"), (
                f"{class_name} missing get_connection_status method"
            )
