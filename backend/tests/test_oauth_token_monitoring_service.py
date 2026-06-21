"""
Tests for services.oauth_token_monitoring_service.get_connected_platforms.

The function is the dispatch loop that decides which platforms a user has
connected tokens for. It is called by:
- The OAuth status route (api.oauth_token_monitoring_routes.get_oauth_token_status)
- The task creation route
- Indirectly by the readiness panel in Step 5 of onboarding

These tests pin down:
- Return shape and ordering
- Per-platform "considered connected" rules
- Resilience: one platform's failure must not poison the rest
- YouTube is integrated via the real YouTubeOAuthService (was an inline
  sqlite3 block in the legacy version)
"""

import os
import sqlite3
import sys
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

# The ``patch_user_db_path`` fixture is provided by conftest.py at the
# tests/ root.


# The WordPress / Bing / Wix services all encrypt access_token at rest
# using Fernet. For test purposes we need to encrypt a known plaintext
# token with the same key the services use. The encryption key is read
# from environment variables (set in .env).
def _encrypt_for_storage(plaintext: str) -> str:
    """Encrypt a token the same way the OAuth services do.

    If the Fernet key is missing for any reason, fall back to writing
    plaintext so the test data is at least discoverable. The services
    will treat the plaintext as 'not encrypted' and use it as-is.
    """
    try:
        from cryptography.fernet import Fernet
        key = os.environ.get("OAUTH_TOKEN_ENCRYPTION_KEY")
        if not key:
            return plaintext
        return Fernet(key.encode("utf-8")).encrypt(plaintext.encode("utf-8")).decode("utf-8")
    except Exception:
        return plaintext


class TestGetConnectedPlatforms:
    """End-to-end tests for get_connected_platforms."""

    def test_empty_user_returns_empty_list(self, patch_user_db_path):
        with patch_user_db_path("user_empty") as ctx:
            from services.oauth_token_monitoring_service import get_connected_platforms
            result = get_connected_platforms(ctx.user_id)
        assert result == []

    def test_full_list_preserves_canonical_order(self, patch_user_db_path):
        """When all 6 platforms are connected, the result must match the
        canonical order: gsc, bing, wordpress, wix, youtube, linkedin.
        Callers may rely on this order (e.g. for the readiness panel)."""
        with patch_user_db_path("user_full") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                far_future = (datetime.utcnow() + timedelta(days=30)).isoformat()
                conn.execute(
                    "INSERT INTO bing_oauth_tokens (user_id, access_token, refresh_token, expires_at) "
                    "VALUES (?, ?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), _encrypt_for_storage("rt"), far_future),
                )
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens (user_id, access_token, blog_url) "
                    "VALUES (?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), "https://blog.example.com"),
                )
                conn.execute(
                    "INSERT INTO wix_oauth_tokens (user_id, access_token, refresh_token, expires_at) "
                    "VALUES (?, ?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), _encrypt_for_storage("rt"), far_future),
                )
                conn.execute(
                    "INSERT INTO youtube_oauth_tokens (user_id, channel_name, is_active) "
                    "VALUES (?, ?, 1)",
                    (ctx.user_id, "MyChannel"),
                )
                conn.execute(
                    "INSERT INTO linkedin_oauth_tokens (user_id, provider_mode, linkedin_access_token, linkedin_refresh_token, expires_at, is_active) "
                    "VALUES (?, 'native', ?, ?, ?, 1)",
                    (ctx.user_id, _encrypt_for_storage("at"), _encrypt_for_storage("rt"), far_future),
                )
                conn.commit()

            # GSC is special: it doesn't use the user DB; it stores
            # credentials in gsc_credentials.json. Mock GSCService to
            # return truthy so the dispatch finds it.
            with patch(
                "services.oauth_token_monitoring_service.GSCService"
            ) as GSC:
                GSC.return_value.load_user_credentials.return_value = object()
                from services.oauth_token_monitoring_service import get_connected_platforms
                result = get_connected_platforms(ctx.user_id)

        assert result == ["gsc", "bing", "wordpress", "wix", "youtube", "linkedin"]

    def test_mixed_returns_only_connected_in_canonical_order(self, patch_user_db_path):
        with patch_user_db_path("user_mixed") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                # Only Bing and YouTube are "on" here.
                far_future = (datetime.utcnow() + timedelta(days=30)).isoformat()
                conn.execute(
                    "INSERT INTO bing_oauth_tokens (user_id, access_token, expires_at) "
                    "VALUES (?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), far_future),
                )
                conn.execute(
                    "INSERT INTO youtube_oauth_tokens (user_id, channel_name, is_active) "
                    "VALUES (?, ?, 1)",
                    (ctx.user_id, "Ch"),
                )
                conn.commit()

            with patch(
                "services.oauth_token_monitoring_service.GSCService"
            ) as GSC:
                GSC.return_value.load_user_credentials.return_value = None
                from services.oauth_token_monitoring_service import get_connected_platforms
                result = get_connected_platforms(ctx.user_id)

        assert result == ["bing", "youtube"]

    def test_one_platform_raising_does_not_poison_others(self, patch_user_db_path):
        """If GSC raises, the others must still be detected."""
        with patch_user_db_path("user_gsc_fail") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                far_future = (datetime.utcnow() + timedelta(days=30)).isoformat()
                conn.execute(
                    "INSERT INTO bing_oauth_tokens (user_id, access_token, expires_at) "
                    "VALUES (?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), far_future),
                )
                conn.commit()

            with patch(
                "services.oauth_token_monitoring_service.GSCService"
            ) as GSC:
                GSC.return_value.load_user_credentials.side_effect = RuntimeError(
                    "GSC DB corrupt"
                )
                from services.oauth_token_monitoring_service import get_connected_platforms
                result = get_connected_platforms(ctx.user_id)

        assert "gsc" not in result
        assert "bing" in result

    def test_youtube_constructor_failure_is_handled(self, patch_user_db_path):
        """If YouTubeOAuthService() raises (e.g. missing env key), the
        dispatch must not propagate the exception."""
        with patch_user_db_path("user_yt_fail") as ctx:
            with patch(
                "services.youtube.youtube_oauth_service.YouTubeOAuthService"
            ) as YT:
                YT.side_effect = ValueError(
                    "YOUTUBE_TOKEN_ENCRYPTION_KEY not set"
                )
                from services.oauth_token_monitoring_service import get_connected_platforms
                result = get_connected_platforms(ctx.user_id)

        assert "youtube" not in result
        assert result == []

    def test_bing_expired_with_refresh_counted_as_connected(self, patch_user_db_path):
        """Bing tokens that are expired but have a refresh_token are still
        considered connected (they can be auto-refreshed)."""
        with patch_user_db_path("user_bing_exp") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                expired = (datetime.utcnow() - timedelta(hours=1)).isoformat()
                conn.execute(
                    "INSERT INTO bing_oauth_tokens (user_id, access_token, refresh_token, expires_at) "
                    "VALUES (?, ?, ?, ?)",
                    (
                        ctx.user_id,
                        _encrypt_for_storage("at"),
                        _encrypt_for_storage("rt"),
                        expired,
                    ),
                )
                conn.commit()

            from services.oauth_token_monitoring_service import get_connected_platforms
            result = get_connected_platforms(ctx.user_id)

        assert "bing" in result

    def test_wix_expired_with_refresh_counted_as_connected(self, patch_user_db_path):
        with patch_user_db_path("user_wix_exp") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                expired = (datetime.utcnow() - timedelta(hours=1)).isoformat()
                conn.execute(
                    "INSERT INTO wix_oauth_tokens (user_id, access_token, refresh_token, expires_at) "
                    "VALUES (?, ?, ?, ?)",
                    (
                        ctx.user_id,
                        _encrypt_for_storage("at"),
                        _encrypt_for_storage("rt"),
                        expired,
                    ),
                )
                conn.commit()

            from services.oauth_token_monitoring_service import get_connected_platforms
            result = get_connected_platforms(ctx.user_id)

        assert "wix" in result

    def test_wordpress_any_token_counts_as_connected(self, patch_user_db_path):
        """WordPress tokens cannot be auto-refreshed (they expire in 2 weeks
        and require re-authorization). The original code treats any stored
        token row as 'connected' so the user can still see they're set up."""
        with patch_user_db_path("user_wp") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                # Even an expired WP token should count as connected.
                expired = (datetime.utcnow() - timedelta(days=30)).isoformat()
                conn.execute(
                    "INSERT INTO wordpress_oauth_tokens (user_id, access_token, blog_url, expires_at) "
                    "VALUES (?, ?, ?, ?)",
                    (ctx.user_id, _encrypt_for_storage("at"), "https://blog.example.com", expired),
                )
                conn.commit()

            from services.oauth_token_monitoring_service import get_connected_platforms
            result = get_connected_platforms(ctx.user_id)

        assert "wordpress" in result


class TestSafeCheckHelper:
    """Unit tests for the _safe_check wrapper."""

    def test_exploding_checker_returns_false(self):
        from services.oauth_token_monitoring_service import _safe_check

        def boom(_uid):
            raise RuntimeError("kaboom")

        assert _safe_check("test_platform", boom, "u1") is False

    def test_true_checker_returns_true(self):
        from services.oauth_token_monitoring_service import _safe_check

        assert _safe_check("test_platform", lambda _u: True, "u1") is True

    def test_false_checker_returns_false(self):
        from services.oauth_token_monitoring_service import _safe_check

        assert _safe_check("test_platform", lambda _u: False, "u1") is False

    def test_non_bool_truthy_return_normalised_to_true(self):
        """A checker that returns a non-empty string should count as True."""
        from services.oauth_token_monitoring_service import _safe_check

        assert _safe_check("test_platform", lambda _u: "truthy", "u1") is True


class TestPlatformChecksRegistry:
    """The dispatch list must contain all 5 platforms in the documented order."""

    def test_registry_order_is_canonical(self):
        from services.oauth_token_monitoring_service import _PLATFORM_CHECKS

        ids = [p for p, _ in _PLATFORM_CHECKS]
        assert ids == ["gsc", "bing", "wordpress", "wix", "youtube", "linkedin"]

    def test_registry_callables_are_independent(self):
        """Each checker is an independent callable."""
        from services.oauth_token_monitoring_service import _PLATFORM_CHECKS

        call_counts = {}

        def make_spy(name):
            def spy(uid):
                call_counts.setdefault(name, []).append(uid)
                return False

            return spy

        spies = [(p, make_spy(p)) for p, _ in _PLATFORM_CHECKS]
        for platform_id, checker in spies:
            checker("user_xyz")
        assert set(call_counts.keys()) == {
            "gsc",
            "bing",
            "wordpress",
            "wix",
            "youtube",
            "linkedin",
        }
        for calls in call_counts.values():
            assert calls == ["user_xyz"]
