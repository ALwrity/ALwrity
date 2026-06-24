"""
Tests for services.integrations.linkedin_oauth.LinkedInOAuthService.

The LinkedIn service is special:
- It inherits from OAuthProviderBase (cs4 P1 refactor).
- It must fail-fast at construction if LINKEDIN_TOKEN_ENCRYPTION_KEY is
  missing (cs4 P2 normalization).
- It stores three encrypted columns (Zernio API key, LinkedIn access
  token, LinkedIn refresh token) — not the standard 2-column pattern,
  so the migration method is overridden to handle the extra column.

These tests pin down:
1. Inherit from OAuthProviderBase
2. Use resolve_encryption_key("linkedin") for env lookup
3. Fail-fast (raise ValueError) at construction if the key is missing
4. Fail-fast (raise ValueError) at construction if the key is invalid
5. Succeed at construction if LINKEDIN_TOKEN_ENCRYPTION_KEY is set
6. Succeed at construction if OAUTH_TOKEN_ENCRYPTION_KEY fallback is set
7. Migration handles the 3-column case (Zernio + access + refresh)
"""

import os
import sqlite3
from unittest.mock import patch

import pytest


def _make_linkedin_service(monkeypatch, key="test-key-from-env"):
    """Construct a LinkedInOAuthService with the env var set, returning
    the service and a temp DB context.

    Uses patch_user_db_path fixture's underlying temp DB mechanism by
    patching get_user_db_path in the linkedin_oauth module.
    """
    monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", key)
    monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
    from services.integrations.linkedin_oauth import LinkedInOAuthService
    from cryptography.fernet import Fernet
    # Round-trip the key through Fernet.generate_key + encode so the
    # constructor accepts it. The key must be a valid Fernet key.
    valid_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid_key)
    return LinkedInOAuthService()


class TestLinkedInOAuthServiceInheritance:
    """LinkedInOAuthService must inherit from OAuthProviderBase so the
    shared Fernet logic is reused, not re-implemented.
    """

    def test_inherits_from_oauth_provider_base(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert issubclass(LinkedInOAuthService, OAuthProviderBase)

    def test_does_not_re_implement_initialize_fernet(self):
        """The base class provides _initialize_fernet. If LinkedIn
        overrides it, that breaks the fail-fast normalization."""
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._initialize_fernet
            is OAuthProviderBase._initialize_fernet
        )

    def test_does_not_re_implement_encrypt_token(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._encrypt_token
            is OAuthProviderBase._encrypt_token
        )

    def test_does_not_re_implement_decrypt_token(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._decrypt_token
            is OAuthProviderBase._decrypt_token
        )

    def test_does_not_re_implement_is_likely_encrypted_blob(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._is_likely_encrypted_blob
            is OAuthProviderBase._is_likely_encrypted_blob
        )

    def test_does_not_re_implement_get_db_path(self):
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._get_db_path
            is OAuthProviderBase._get_db_path
        )

    def test_does_override_migrate_plaintext_tokens(self):
        """LinkedIn's 3-column migration (Zernio + access + refresh) is
        a deliberate override of the base's 2-column migration."""
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        from services.integrations.oauth_provider_base import OAuthProviderBase
        assert (
            LinkedInOAuthService._migrate_plaintext_tokens_if_needed
            is not OAuthProviderBase._migrate_plaintext_tokens_if_needed
        )


class TestLinkedInOAuthServiceFailFast:
    """The user's mandate: no fallbacks, no mocks, fail-fast.

    LinkedInOAuthService must raise ValueError at construction if
    LINKEDIN_TOKEN_ENCRYPTION_KEY is missing AND
    OAUTH_TOKEN_ENCRYPTION_KEY fallback is also missing. Same for an
    invalid key. Matches the cs4 P2 normalization applied to
    Bing/Wix/WordPress/YouTube in commit 386f7813.
    """

    def test_raises_when_no_key_configured(self, monkeypatch):
        monkeypatch.delenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        with pytest.raises(ValueError) as exc:
            LinkedInOAuthService()
        # Error message must name the provider-specific env var so the
        # operator knows what to set.
        assert "LINKEDIN_TOKEN_ENCRYPTION_KEY" in str(exc.value)

    def test_raises_when_key_is_invalid(self, monkeypatch):
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", "not-a-valid-fernet-key")
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        with pytest.raises(ValueError) as exc:
            LinkedInOAuthService()
        assert "invalid" in str(exc.value).lower()

    def test_succeeds_with_provider_specific_key(self, monkeypatch):
        from cryptography.fernet import Fernet
        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        svc = LinkedInOAuthService()
        assert svc._fernet is not None

    def test_succeeds_with_shared_oauth_key_fallback(self, monkeypatch):
        from cryptography.fernet import Fernet
        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.delenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", raising=False)
        monkeypatch.setenv("OAUTH_TOKEN_ENCRYPTION_KEY", valid)
        from services.integrations.linkedin_oauth import LinkedInOAuthService
        svc = LinkedInOAuthService()
        assert svc._fernet is not None


class TestLinkedInOAuthServiceMigration:
    """The 3-column migration must encrypt Zernio API key + LinkedIn
    access/refresh tokens in a single pass.
    """

    def test_migration_handles_three_columns(self, patch_user_db_path, monkeypatch):
        """Plaintext rows for all 3 columns get re-encrypted in one pass."""
        from cryptography.fernet import Fernet
        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.linkedin_oauth import LinkedInOAuthService

        with patch_user_db_path("user_linkedin_migration") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode,
                        zernio_api_key, linkedin_access_token, linkedin_refresh_token
                    ) VALUES (?, 'zernio', ?, ?, ?)
                    """,
                    (ctx.user_id, "zernio-plaintext", "access-plaintext", "refresh-plaintext"),
                )
                conn.commit()

            svc = LinkedInOAuthService()
            # Initialise the DB (idempotent for the per-user migration)
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                svc._migrate_plaintext_tokens_if_needed(conn, ctx.user_id)
                conn.commit()
                row = conn.execute(
                    """
                    SELECT zernio_api_key, linkedin_access_token, linkedin_refresh_token
                    FROM linkedin_oauth_tokens WHERE user_id = ?
                    """,
                    (ctx.user_id,),
                ).fetchone()

        zernio, access, refresh = row
        # All three should now be Fernet-encrypted blobs (start with gAAAAA).
        assert zernio.startswith("gAAAAA"), f"zernio not encrypted: {zernio[:20]}"
        assert access.startswith("gAAAAA"), f"access not encrypted: {access[:20]}"
        assert refresh.startswith("gAAAAA"), f"refresh not encrypted: {refresh[:20]}"

    def test_migration_skips_already_encrypted_rows(self, patch_user_db_path, monkeypatch):
        """Rows that are already encrypted are not re-encrypted (idempotent)."""
        from cryptography.fernet import Fernet
        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.linkedin_oauth import LinkedInOAuthService

        # Pre-encrypt the tokens with the same key the service will use.
        fernet = Fernet(valid.encode("utf-8"))
        encrypted_zernio = fernet.encrypt(b"already-encrypted").decode("utf-8")
        encrypted_access = fernet.encrypt(b"already-encrypted").decode("utf-8")
        encrypted_refresh = fernet.encrypt(b"already-encrypted").decode("utf-8")

        with patch_user_db_path("user_linkedin_idempotent") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode,
                        zernio_api_key, linkedin_access_token, linkedin_refresh_token
                    ) VALUES (?, 'zernio', ?, ?, ?)
                    """,
                    (ctx.user_id, encrypted_zernio, encrypted_access, encrypted_refresh),
                )
                conn.commit()

            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                svc._migrate_plaintext_tokens_if_needed(conn, ctx.user_id)
                row = conn.execute(
                    """
                    SELECT zernio_api_key, linkedin_access_token, linkedin_refresh_token
                    FROM linkedin_oauth_tokens WHERE user_id = ?
                    """,
                    (ctx.user_id,),
                ).fetchone()

        # Values must be unchanged (still decryptable to the same plaintext).
        zernio, access, refresh = row
        assert fernet.decrypt(zernio.encode("utf-8")) == b"already-encrypted"
        assert fernet.decrypt(access.encode("utf-8")) == b"already-encrypted"
        assert fernet.decrypt(refresh.encode("utf-8")) == b"already-encrypted"

    def test_migration_runs_only_once_per_user(self, patch_user_db_path, monkeypatch):
        """The per-user-per-process gate prevents repeated migration work."""
        from cryptography.fernet import Fernet
        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)
        monkeypatch.delenv("OAUTH_TOKEN_ENCRYPTION_KEY", raising=False)

        from services.integrations.linkedin_oauth import LinkedInOAuthService

        with patch_user_db_path("user_linkedin_once") as ctx:
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, linkedin_access_token
                    ) VALUES (?, 'native', ?)
                    """,
                    (ctx.user_id, "plaintext-token"),
                )
                conn.commit()

            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                # First pass: encrypts the token
                svc._migrate_plaintext_tokens_if_needed(conn, ctx.user_id)
                first_row = conn.execute(
                    "SELECT linkedin_access_token FROM linkedin_oauth_tokens WHERE user_id = ?",
                    (ctx.user_id,),
                ).fetchone()
                # Second pass: should be a no-op (the gate is set)
                svc._migrate_plaintext_tokens_if_needed(conn, ctx.user_id)
                second_row = conn.execute(
                    "SELECT linkedin_access_token FROM linkedin_oauth_tokens WHERE user_id = ?",
                    (ctx.user_id,),
                ).fetchone()

        # Both reads should be the same encrypted value (no double-encryption).
        assert first_row[0] == second_row[0]
        assert first_row[0].startswith("gAAAAA")


class TestLinkedInOAuthServiceKeyResolution:
    """The service must use resolve_encryption_key("linkedin"), not a
    hand-rolled os.getenv chain. This makes it consistent with the
    other 4 providers.
    """

    def test_resolve_encryption_key_linkedin_added(self):
        """The PROVIDER_ENV_VARS registry must include 'linkedin' so
        resolve_encryption_key works for it."""
        from services.integrations.oauth_provider_base import (
            PROVIDER_ENV_VARS,
            resolve_encryption_key,
        )
        assert "linkedin" in PROVIDER_ENV_VARS
        assert PROVIDER_ENV_VARS["linkedin"] == "LINKEDIN_TOKEN_ENCRYPTION_KEY"
        # And resolve_encryption_key returns the expected value.
        with patch.dict(
            os.environ,
            {"LINKEDIN_TOKEN_ENCRYPTION_KEY": "test-key"},
            clear=False,
        ):
            assert resolve_encryption_key("linkedin") == "test-key"
        # Falls back to the shared key.
        with patch.dict(
            os.environ,
            {"OAUTH_TOKEN_ENCRYPTION_KEY": "shared-key"},
            clear=False,
        ):
            os.environ.pop("LINKEDIN_TOKEN_ENCRYPTION_KEY", None)
            assert resolve_encryption_key("linkedin") == "shared-key"
