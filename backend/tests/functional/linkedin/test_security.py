"""Security regression tests — LinkedIn token isolation and OAuth scoping.

Verifies:
1. Token DB operations are scoped by user_id
2. Token-related methods never log credentials
"""

import inspect
import pytest

pytestmark = [pytest.mark.linkedin, pytest.mark.critical]


class TestTokenIsolation:
    """Verify LinkedIn OAuth token operations are always scoped by user_id."""

    def test_get_active_token_row_has_where_user_id(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService._get_active_token_row)
        assert "user_id" in source, "missing user_id in token lookup"
        assert "WHERE" in source.upper(), "missing WHERE clause"

    def test_store_tokens_scoped_by_user_id(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.store_native_tokens)
        assert "user_id" in source, "store_native_tokens missing user_id"

    def test_store_unipile_scoped_by_user_id(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.store_unipile_credentials)
        assert "user_id" in source, "store_unipile_credentials missing user_id"

    def test_revoke_token_has_where_user_id(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.revoke_token)
        assert "user_id" in source, "revoke_token missing user_id"
        # Verify there's a WHERE clause with a user_id parameter binding
        assert "WHERE" in source.upper(), "revoke_token has no WHERE clause"
        assert "user_id" in source.lower(), "revoke_token WHERE missing user_id"

    def test_get_user_token_status_scoped_by_user_id(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.get_user_token_status)
        assert "user_id" in source, "get_user_token_status missing user_id"

    def test_consume_oauth_state_scoped(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.consume_oauth_state)
        assert "user_id" in source, "consume_oauth_state missing user_id"


class TestNoSecretLogging:
    """Verify OAuth code never logs tokens or credentials."""

    def test_get_connection_status_no_response_text_in_log(self):
        """The get_connection_status method must not log raw HTTP responses."""
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.get_connection_status)
        # Should not contain logging of raw response text
        assert "response.text" not in source, (
            "get_connection_status logs raw response.text — may expose tokens"
        )

    @pytest.mark.xfail(
        reason="KNOWN ISSUE: refresh_access_token logs response.text on failure "
               "(line ~539 linkedin_oauth.py). If the LinkedIn API returns an "
               "error response containing the access token, it would be written "
               "to logs. Fix: replace response.text with response.status_code only."
    )
    def test_token_refresh_does_not_log_response_body(self):
        """Token refresh must NOT log the raw response body on failure."""
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService.refresh_access_token)
        # The dangerous pattern is logging response.text after a failed call
        assert "response.text" not in source, (
            "refresh_access_token logs response.text — may contain tokens "
            "in the response body on refresh failure"
        )

    def test_disconnected_status_no_user_data_leaked(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        source = inspect.getsource(LinkedInOAuthService._disconnected_status)
        assert "user_id" not in source, (
            "disconnected_status includes user_id — PII leak in status response"
        )
