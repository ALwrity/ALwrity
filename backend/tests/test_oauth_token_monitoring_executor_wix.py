"""
Tests for OAuthTokenMonitoringExecutor._check_wix_token.

This is the function I added in Problem 2 — it was previously a stub
that returned 'not_supported'. Now it should:
- Use WixOAuthService.get_user_token_status to find tokens
- Use WixService.refresh_access_token to refresh expiring tokens
- Use WixOAuthService.update_tokens to persist refreshed tokens
- Use a tighter 1-day warning window (Wix access tokens live ~4h)
- Return the same shape as the other _check_*_token methods
"""

import asyncio
import sys
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

# All external dependencies are mocked; the only thing we need to import
# is the executor itself.
from services.scheduler.executors.oauth_token_monitoring_executor import (
    OAuthTokenMonitoringExecutor,
)
from services.scheduler.core.executor_interface import TaskExecutionResult


def _run(coro):
    """Helper to run an async coroutine synchronously in tests."""
    return asyncio.run(coro)


class TestCheckWixTokenNoTokens:
    """The user has never connected Wix (or tokens were purged)."""

    def test_returns_not_found_when_no_tokens(self):
        executor = OAuthTokenMonitoringExecutor()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": False,
                "has_active_tokens": False,
                "has_expired_tokens": False,
                "active_tokens": [],
                "expired_tokens": [],
            }
            result = _run(executor._check_wix_token("user_no_tokens"))

        assert result.success is False
        assert result.result_data["platform"] == "wix"
        assert result.result_data["status"] == "not_found"
        assert "Wix tokens" in result.error_message


class TestCheckWixTokenValid:
    """Active token with no refresh needed."""

    def test_returns_valid_when_token_far_from_expiry(self):
        executor = OAuthTokenMonitoringExecutor()
        far_future = (datetime.utcnow() + timedelta(days=30)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": True,
                "active_tokens": [
                    {"id": 7, "access_token": "at", "refresh_token": "rt",
                     "expires_at": far_future}
                ],
                "expired_tokens": [],
            }
            result = _run(executor._check_wix_token("user_valid"))

        assert result.success is True
        assert result.result_data["status"] == "valid"
        # We must NOT have called refresh on a token with > 1 day left
        WS.return_value.refresh_access_token.assert_not_called()
        WOS.return_value.update_tokens.assert_not_called()


class TestCheckWixTokenExpiringSoon:
    """Active token with < 1 day remaining triggers an auto-refresh."""

    def test_refreshes_active_token_within_one_day(self):
        executor = OAuthTokenMonitoringExecutor()
        soon = (datetime.utcnow() + timedelta(hours=2)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": True,
                "active_tokens": [
                    {"id": 11, "access_token": "old_at",
                     "refresh_token": "old_rt", "expires_at": soon}
                ],
                "expired_tokens": [],
            }
            WS.return_value.refresh_access_token.return_value = {
                "access_token": "new_at",
                "refresh_token": "new_rt",
                "expires_in": 14400,
            }
            result = _run(executor._check_wix_token("user_expiring"))

        assert result.success is True
        assert result.result_data["status"] == "refreshed"
        WS.return_value.refresh_access_token.assert_called_once_with("old_rt")
        # The refreshed tokens must be persisted via update_tokens.
        WOS.return_value.update_tokens.assert_called_once()
        kwargs = WOS.return_value.update_tokens.call_args.kwargs
        assert kwargs["user_id"] == "user_expiring"
        assert kwargs["access_token"] == "new_at"
        assert kwargs["refresh_token"] == "new_rt"
        assert kwargs["expires_in"] == 14400
        assert kwargs["token_id"] == 11

    def test_keeps_old_refresh_token_if_response_lacks_one(self):
        """If the OAuth response doesn't include a new refresh_token, the
        implementation should keep the existing one rather than wipe it."""
        executor = OAuthTokenMonitoringExecutor()
        soon = (datetime.utcnow() + timedelta(hours=2)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": True,
                "active_tokens": [
                    {"id": 22, "access_token": "old_at",
                     "refresh_token": "old_rt", "expires_at": soon}
                ],
                "expired_tokens": [],
            }
            # Note: NO refresh_token in the response
            WS.return_value.refresh_access_token.return_value = {
                "access_token": "new_at",
                "expires_in": 14400,
            }
            result = _run(executor._check_wix_token("user_expiring"))

        assert result.success is True
        kwargs = WOS.return_value.update_tokens.call_args.kwargs
        # Falls back to the old refresh_token, not None
        assert kwargs["refresh_token"] == "old_rt"

    def test_returns_refresh_failed_when_api_raises(self):
        executor = OAuthTokenMonitoringExecutor()
        soon = (datetime.utcnow() + timedelta(hours=2)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": True,
                "active_tokens": [
                    {"id": 33, "access_token": "old_at",
                     "refresh_token": "old_rt", "expires_at": soon}
                ],
                "expired_tokens": [],
            }
            WS.return_value.refresh_access_token.side_effect = RuntimeError(
                "network down"
            )
            result = _run(executor._check_wix_token("user_net_fail"))

        assert result.success is False
        assert result.result_data["status"] == "refresh_failed"
        # No update_tokens call when refresh fails
        WOS.return_value.update_tokens.assert_not_called()


class TestCheckWixTokenExpired:
    """Expired tokens within / outside the 24h grace window."""

    def test_refreshes_expired_token_within_grace_window(self):
        """Token expired 2h ago and has a refresh_token: refresh should
        succeed and the result should be 'refreshed'."""
        executor = OAuthTokenMonitoringExecutor()
        expired_2h_ago = (datetime.utcnow() - timedelta(hours=2)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": False,
                "active_tokens": [],
                "expired_tokens": [
                    {"id": 44, "access_token": "old_at",
                     "refresh_token": "old_rt", "expires_at": expired_2h_ago}
                ],
            }
            WS.return_value.refresh_access_token.return_value = {
                "access_token": "new_at", "expires_in": 14400
            }
            result = _run(executor._check_wix_token("user_expired_recent"))

        assert result.success is True
        assert result.result_data["status"] == "refreshed"
        WOS.return_value.update_tokens.assert_called_once()
        kwargs = WOS.return_value.update_tokens.call_args.kwargs
        assert kwargs["token_id"] == 44

    def test_returns_expired_when_outside_grace_window(self):
        """Token expired 10 days ago: user must reconnect, not silently
        fail. Result is failure with status='expired'."""
        executor = OAuthTokenMonitoringExecutor()
        long_ago = (datetime.utcnow() - timedelta(days=10)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": False,
                "active_tokens": [],
                "expired_tokens": [
                    {"id": 55, "access_token": "old_at",
                     "refresh_token": "old_rt", "expires_at": long_ago}
                ],
            }
            result = _run(executor._check_wix_token("user_long_expired"))

        assert result.success is False
        assert result.result_data["status"] == "expired"
        # The refresh service should NOT have been called (we don't try
        # to refresh tokens that are way past their grace window).
        WS.return_value.refresh_access_token.assert_not_called()
        WOS.return_value.update_tokens.assert_not_called()


class TestCheckWixTokenWarningWindow:
    """Wix uses a 1-day warning window (vs 7 days for Bing/WP)."""

    def test_token_with_two_days_remaining_is_not_refreshed(self):
        """A token with 2 days left is NOT within the 1-day window, so
        it should be reported as valid without a refresh attempt."""
        executor = OAuthTokenMonitoringExecutor()
        two_days = (datetime.utcnow() + timedelta(days=2)).isoformat()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS, \
             patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixService"
        ) as WS:
            WOS.return_value.get_user_token_status.return_value = {
                "has_tokens": True,
                "has_active_tokens": True,
                "active_tokens": [
                    {"id": 66, "access_token": "at", "refresh_token": "rt",
                     "expires_at": two_days}
                ],
                "expired_tokens": [],
            }
            result = _run(executor._check_wix_token("user_two_days"))

        assert result.success is True
        assert result.result_data["status"] == "valid"
        WS.return_value.refresh_access_token.assert_not_called()


class TestCheckWixTokenErrorHandling:
    """The wrapper catches all exceptions and returns a structured failure."""

    def test_swallows_unexpected_exceptions(self):
        executor = OAuthTokenMonitoringExecutor()
        with patch(
            "services.scheduler.executors.oauth_token_monitoring_executor.WixOAuthService"
        ) as WOS:
            WOS.return_value.get_user_token_status.side_effect = RuntimeError(
                "Wix DB corrupt"
            )
            result = _run(executor._check_wix_token("user_boom"))

        assert result.success is False
        assert result.result_data["platform"] == "wix"
        assert "Wix token check failed" in result.error_message
        assert "Wix DB corrupt" in result.error_message
        # retryable=False mirrors the documented executor policy
        assert result.retryable is False
