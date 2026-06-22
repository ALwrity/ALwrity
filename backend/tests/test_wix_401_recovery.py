"""
Tests for the Wix 401 auto-refresh-and-retry helper in api/wix_routes.py.

The Wix API can reject a still-locally-valid access token with 401 for
reasons our local ``expires_at`` doesn't capture (server-side rotation,
user disconnect, account changes, account experiment routing issues).
Rather than forcing the user through a full OAuth re-connect, the
publish_to_wix route wraps the call in ``_execute_with_401_recovery``,
which catches a single 401, refreshes the stored token, and retries
once. This test pins down the recovery contract:

  - First attempt 401  +  refresh succeeds  +  retry succeeds  -> return retry result
  - First attempt 401  +  refresh fails                         -> re-raise the original 401
  - First attempt 401  +  refresh succeeds  +  retry 401s        -> re-raise the retry 401
  - First attempt succeeds                                    -> return result, no refresh
  - First attempt fails with non-401                           -> re-raise unchanged
  - First attempt 401  +  no refresh_token on file            -> re-raise the 401

The helper also enforces per-user rate limiting (cooldown + rolling
window cap) to prevent rapid retry loops when Wix keeps rejecting
freshly refreshed tokens.

The tests are unit-level: ``wix_service`` and ``wix_oauth_service``
modules imported by ``api.wix_routes`` are patched so we never hit
the real Wix API or database.
"""

import importlib
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from services.integrations.wix.retry import WixAPIError

# Fernet key used by the test fixture so the WixOAuthService constructor
# can initialise its encryption engine. Generated solely for tests.
_TEST_FERNET_KEY = "JYfuL4Z7Bm_3fDbZAaeJ7qIz43ERsj9ON1ZU5Wy-8LQ="


def _reload_wix_routes():
    """
    Reload ``api.wix_routes`` after test patches so the module picks up
    the mocked ``wix_service`` / ``wix_oauth_service``. Returns the
    freshly imported module.
    """
    if "api.wix_routes" in sys.modules:
        return importlib.reload(sys.modules["api.wix_routes"])
    return importlib.import_module("api.wix_routes")


@pytest.fixture
def wix_routes_module():
    """
    Reload api.wix_routes with mocked wix_service and wix_oauth_service
    so we can drive the recovery helper without hitting real services.

    ``WixService`` and ``WixOAuthService`` are instantiated at module
    load time in ``api.wix_routes`` and require env config (encryption
    keys, client id). We inject a test Fernet key into the environment
    so the module import succeeds, then override the module-level
    singletons with MagicMock instances.
    """
    old_key = os.environ.get("WIX_TOKEN_ENCRYPTION_KEY")
    os.environ["WIX_TOKEN_ENCRYPTION_KEY"] = _TEST_FERNET_KEY

    import api.wix_routes as wr  # noqa: F401

    if old_key is None:
        del os.environ["WIX_TOKEN_ENCRYPTION_KEY"]
    else:
        os.environ["WIX_TOKEN_ENCRYPTION_KEY"] = old_key

    fake_wix_service = MagicMock()
    fake_wix_service.refresh_access_token = MagicMock()
    fake_wix_oauth_service = MagicMock()
    fake_wix_oauth_service.update_tokens = MagicMock(return_value=True)

    wr.wix_service = fake_wix_service
    wr.wix_oauth_service = fake_wix_oauth_service
    wr._recovery_attempts.clear()  # Clean slate for rate limiting tests
    try:
        yield wr, fake_wix_service, fake_wix_oauth_service
    finally:
        # Best-effort restore — irrelevant outside the test process.
        pass


class TestExecuteWith401Recovery:
    """Contract tests for _execute_with_401_recovery."""

    def test_first_attempt_succeeds_no_refresh(self, wix_routes_module):
        mod, ws, wos = wix_routes_module
        token_holder = {"access_token": "old_token"}
        fn = MagicMock(return_value={"ok": True})

        result, was_refreshed = mod._execute_with_401_recovery(
            fn,
            user_id="user_1",
            operation="Wix publish",
            token_holder=token_holder,
            token_id=42,
            refresh_token="refresh_xyz",
        )

        assert was_refreshed is False
        assert result == {"ok": True}
        assert fn.call_count == 1
        assert token_holder["access_token"] == "old_token"  # unchanged
        ws.refresh_access_token.assert_not_called()
        wos.update_tokens.assert_not_called()

    def test_401_then_refresh_then_retry_succeeds(self, wix_routes_module):
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {
            "access_token": "new_token",
            "refresh_token": "new_refresh",
            "expires_in": 14400,
        }
        token_holder = {"access_token": "old_token"}
        # The route wraps the API call in a lambda that re-reads
        # ``token_holder["access_token"]`` each time. We mimic that here.
        api_call_mock = MagicMock(side_effect=[
            WixAPIError("unauthorized", status_code=401, response_body="{}"),
            {"ok": True, "post_id": "abc123"},
        ])
        def fn():
            return api_call_mock(access_token=token_holder["access_token"])

        result, was_refreshed = mod._execute_with_401_recovery(
            fn,
            user_id="user_1",
            operation="Wix publish",
            token_holder=token_holder,
            token_id=42,
            refresh_token="refresh_xyz",
        )

        assert was_refreshed is True
        assert result == {"ok": True, "post_id": "abc123"}
        assert api_call_mock.call_count == 2
        # Helper swapped the token in memory before the retry
        assert token_holder["access_token"] == "new_token"
        # The retry should have used the NEW token
        retry_kwargs = api_call_mock.call_args_list[1].kwargs
        assert retry_kwargs["access_token"] == "new_token"
        # The new token was persisted to the DB
        wos.update_tokens.assert_called_once_with(
            user_id="user_1",
            access_token="new_token",
            refresh_token="new_refresh",
            expires_in=14400,
            token_id=42,
        )

    def test_401_then_refresh_uses_existing_refresh_token_if_new_missing(self, wix_routes_module):
        """Wix sometimes omits the new refresh_token; fall back to the existing one."""
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {
            "access_token": "new_token",
            # no refresh_token in response
            "expires_in": 14400,
        }
        token_holder = {"access_token": "old_token"}
        fn = MagicMock(side_effect=[
            WixAPIError("unauthorized", status_code=401),
            {"ok": True},
        ])

        result, was_refreshed = mod._execute_with_401_recovery(
            fn,
            user_id="user_1",
            operation="Wix publish",
            token_holder=token_holder,
            token_id=42,
            refresh_token="old_refresh",
        )

        assert was_refreshed is True
        wos.update_tokens.assert_called_once()
        kwargs = wos.update_tokens.call_args.kwargs
        assert kwargs["refresh_token"] == "old_refresh"  # kept the existing one

    def test_401_then_refresh_fails_re_raises_original_401(self, wix_routes_module):
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.side_effect = Exception("network error during refresh")
        token_holder = {"access_token": "old_token"}
        original_401 = WixAPIError("unauthorized", status_code=401, response_body="{}")
        fn = MagicMock(side_effect=original_401)

        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token="refresh_xyz",
            )

        # The original 401 is re-raised (NOT the refresh network error)
        assert exc_info.value is original_401
        assert exc_info.value.status_code == 401
        # Token holder is unchanged
        assert token_holder["access_token"] == "old_token"
        # No DB write
        wos.update_tokens.assert_not_called()
        # No retry attempted
        assert fn.call_count == 1

    def test_401_then_refresh_succeeds_but_retry_still_401s(self, wix_routes_module):
        """The token is genuinely bad (revoked, site deleted). Surface the retry 401."""
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {
            "access_token": "new_token",
            "refresh_token": "new_refresh",
            "expires_in": 14400,
        }
        token_holder = {"access_token": "old_token"}
        retry_401 = WixAPIError("still unauthorized after refresh", status_code=401, response_body="{}")
        fn = MagicMock(side_effect=[
            WixAPIError("first 401", status_code=401, response_body="{}"),
            retry_401,
        ])

        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token="refresh_xyz",
            )

        assert exc_info.value is retry_401
        assert exc_info.value.status_code == 401
        assert fn.call_count == 2
        # Refresh happened, token was persisted, but retry failed
        wos.update_tokens.assert_called_once()

    def test_401_without_refresh_token_re_raises(self, wix_routes_module):
        """No refresh_token on file — user must reconnect; we don't loop."""
        mod, ws, wos = wix_routes_module
        token_holder = {"access_token": "old_token"}
        original_401 = WixAPIError("unauthorized", status_code=401, response_body="{}")
        fn = MagicMock(side_effect=original_401)

        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token=None,  # no refresh token available
            )

        assert exc_info.value is original_401
        ws.refresh_access_token.assert_not_called()
        wos.update_tokens.assert_not_called()
        assert fn.call_count == 1  # no retry attempted

    def test_non_401_error_re_raised_unchanged(self, wix_routes_module):
        """Network errors / 5xx / 429 must not be intercepted — only 401."""
        mod, ws, wos = wix_routes_module
        token_holder = {"access_token": "old_token"}

        # 500 should bubble up unchanged (handled by with_retry internally)
        err_500 = WixAPIError("server error", status_code=500, response_body="{}")
        fn_500 = MagicMock(side_effect=err_500)
        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn_500,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token="refresh_xyz",
            )
        assert exc_info.value is err_500
        ws.refresh_access_token.assert_not_called()

    def test_429_re_raised_unchanged(self, wix_routes_module):
        """429 is rate limit; should NOT trigger token refresh."""
        mod, ws, wos = wix_routes_module
        token_holder = {"access_token": "old_token"}
        err_429 = WixAPIError("rate limited", status_code=429, response_body="{}")
        fn = MagicMock(side_effect=err_429)

        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token="refresh_xyz",
            )
        assert exc_info.value is err_429
        assert exc_info.value.status_code == 429
        ws.refresh_access_token.assert_not_called()

    def test_refresh_response_missing_access_token_re_raises_401(self, wix_routes_module):
        """Edge case: Wix returns a 200 from /token but with no access_token. Surface 401."""
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {"expires_in": 14400}  # no access_token!
        token_holder = {"access_token": "old_token"}
        original_401 = WixAPIError("unauthorized", status_code=401, response_body="{}")
        fn = MagicMock(side_effect=original_401)

        with pytest.raises(WixAPIError) as exc_info:
            mod._execute_with_401_recovery(
                fn,
                user_id="user_1",
                operation="Wix publish",
                token_holder=token_holder,
                token_id=42,
                refresh_token="refresh_xyz",
            )
        assert exc_info.value is original_401
        wos.update_tokens.assert_not_called()
        assert fn.call_count == 1

    def test_db_persist_failure_still_retries_with_in_memory_token(self, wix_routes_module):
        """If we can't persist the new token to DB, we still try the retry."""
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {
            "access_token": "new_token",
            "refresh_token": "new_refresh",
            "expires_in": 14400,
        }
        wos.update_tokens.side_effect = Exception("DB write failed")
        token_holder = {"access_token": "old_token"}
        api_call_mock = MagicMock(side_effect=[
            WixAPIError("unauthorized", status_code=401),
            {"ok": True},
        ])
        def fn():
            return api_call_mock(access_token=token_holder["access_token"])

        result, was_refreshed = mod._execute_with_401_recovery(
            fn,
            user_id="user_1",
            operation="Wix publish",
            token_holder=token_holder,
            token_id=42,
            refresh_token="refresh_xyz",
        )

        # Retry still happened, in-memory token was used
        assert was_refreshed is True
        assert result == {"ok": True}
        assert api_call_mock.call_count == 2
        assert token_holder["access_token"] == "new_token"
        # Retry used the new token even though DB write failed
        retry_kwargs = api_call_mock.call_args_list[1].kwargs
        assert retry_kwargs["access_token"] == "new_token"


class TestRateLimiting:
    """Rate limiting guards on _execute_with_401_recovery."""

    def test_cooldown_blocks_rapid_consecutive_recoveries(self, wix_routes_module):
        """
        If two 401 errors happen within RECOVERY_COOLDOWN_SECONDS for
        the same user, the second one skips recovery and surfaces the
        401 immediately.
        """
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {"access_token": "new_token"}
        token_holder = {"access_token": "old_token"}
        fn = MagicMock(side_effect=WixAPIError("401", status_code=401))

        # First call: recovery attempted, still fails, 401 surfaced
        with pytest.raises(WixAPIError):
            mod._execute_with_401_recovery(
                fn, user_id="user_rl", operation="test",
                token_holder=token_holder, token_id=1, refresh_token="rt",
            )
        assert ws.refresh_access_token.call_count == 1  # refresh was tried

        # Second call (same user, immediate): blocked by cooldown
        with pytest.raises(WixAPIError):
            mod._execute_with_401_recovery(
                fn, user_id="user_rl", operation="test",
                token_holder=token_holder, token_id=1, refresh_token="rt",
            )
        # Refresh was NOT called a second time — rate limiter blocked it
        assert ws.refresh_access_token.call_count == 1

    def test_rolling_window_cap_prevents_excessive_recoveries(self, wix_routes_module):
        """
        After MAX_RECOVERIES_PER_WINDOW recoveries within the rolling
        window, further recoveries are blocked until the window slides.
        """
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {"access_token": "new_token"}
        token_holder = {"access_token": "old_token"}
        fn = MagicMock(side_effect=WixAPIError("401", status_code=401))

        # Bypass cooldown so we isolate the rolling window cap test.
        with patch.object(mod, '_RECOVERY_COOLDOWN_SECONDS', 0):
            for i in range(mod._MAX_RECOVERIES_PER_WINDOW):
                with pytest.raises(WixAPIError):
                    mod._execute_with_401_recovery(
                        fn, user_id="user_rw", operation="test",
                        token_holder=token_holder, token_id=1, refresh_token="rt",
                    )

            prev_refresh_count = ws.refresh_access_token.call_count
            assert prev_refresh_count == mod._MAX_RECOVERIES_PER_WINDOW

            # The next recovery should be blocked by the rolling window cap.
            with pytest.raises(WixAPIError):
                mod._execute_with_401_recovery(
                    fn, user_id="user_rw", operation="test",
                    token_holder=token_holder, token_id=1, refresh_token="rt",
                )
            assert ws.refresh_access_token.call_count == prev_refresh_count

    def test_successful_call_resets_rate_limiter(self, wix_routes_module):
        """
        A successful API call (no 401) clears the recovery state for
        that user, so prior failed recoveries don't count against them.
        """
        mod, ws, wos = wix_routes_module
        token_holder = {"access_token": "old_token"}
        ws.refresh_access_token.return_value = {"access_token": "new_token"}
        mod._recovery_attempts["user_ok"] = [100.0] * mod._MAX_RECOVERIES_PER_WINDOW

        # A non-401 call should clear the state
        fn_ok = MagicMock(return_value={"ok": True})
        with patch.object(mod, '_RECOVERY_COOLDOWN_SECONDS', 0):
            result, was_refreshed = mod._execute_with_401_recovery(
                fn_ok, user_id="user_ok", operation="test",
                token_holder=token_holder, token_id=1, refresh_token="rt",
            )
        assert was_refreshed is False
        assert result == {"ok": True}
        # Recovery state should be cleared for this user
        assert "user_ok" not in mod._recovery_attempts

        # Now a 401 should be allowed again (counter was reset)
        fn_401 = MagicMock(side_effect=WixAPIError("401", status_code=401))
        with pytest.raises(WixAPIError):
            mod._execute_with_401_recovery(
                fn_401, user_id="user_ok", operation="test",
                token_holder=token_holder, token_id=1, refresh_token="rt",
            )
        # Refresh was attempted (rate limiter was clean)
        assert ws.refresh_access_token.call_count >= 1

    def test_different_users_independent_rate_limits(self, wix_routes_module):
        """
        Two different users can each reach MAX_RECOVERIES_PER_WINDOW
        without affecting each other.
        """
        mod, ws, wos = wix_routes_module
        ws.refresh_access_token.return_value = {"access_token": "new_token"}

        user_a_tok = {"access_token": "a"}
        user_b_tok = {"access_token": "b"}

        fn_a = MagicMock(side_effect=WixAPIError("401", status_code=401))
        fn_b = MagicMock(side_effect=WixAPIError("401", status_code=401))

        with patch.object(mod, '_RECOVERY_COOLDOWN_SECONDS', 0):
            # User A hits the cap
            for i in range(mod._MAX_RECOVERIES_PER_WINDOW):
                with pytest.raises(WixAPIError):
                    mod._execute_with_401_recovery(
                        fn_a, user_id="user_a", operation="test",
                        token_holder=user_a_tok, token_id=1, refresh_token="rt",
                    )

            # User B still has fresh attempts
            with pytest.raises(WixAPIError):
                mod._execute_with_401_recovery(
                    fn_b, user_id="user_b", operation="test",
                    token_holder=user_b_tok, token_id=1, refresh_token="rt",
                )

            # User A is blocked
            prev_a = ws.refresh_access_token.call_count
            with pytest.raises(WixAPIError):
                mod._execute_with_401_recovery(
                    fn_a, user_id="user_a", operation="test",
                    token_holder=user_a_tok, token_id=1, refresh_token="rt",
                )
            # No new call to refresh (rate limited)
            assert ws.refresh_access_token.call_count == prev_a

            # User B still works (independent counter)
            prev_b = ws.refresh_access_token.call_count
            for i in range(mod._MAX_RECOVERIES_PER_WINDOW - 1):
                with pytest.raises(WixAPIError):
                    mod._execute_with_401_recovery(
                        fn_b, user_id="user_b", operation="test",
                        token_holder=user_b_tok, token_id=1, refresh_token="rt",
                    )

            assert ws.refresh_access_token.call_count > prev_b
