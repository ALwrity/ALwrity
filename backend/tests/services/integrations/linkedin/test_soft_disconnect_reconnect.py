"""Unit tests for LinkedIn soft disconnect + Unipile reconnect lifecycle (PR #245)."""

from __future__ import annotations

import sqlite3

import pytest

from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    USER_SOFT_DISCONNECTED_STATUS,
    enrich_connection_status,
    get_reconnect_unipile_account_id,
    is_disconnected_unipile_status,
    mark_user_soft_disconnected,
    normalize_unipile_status,
)
from services.integrations.linkedin_oauth import LinkedInOAuthService

pytestmark = [pytest.mark.linkedin]


class TestUnipileStatusHelpers:
    def test_normalize_unipile_status_uppercases(self):
        assert normalize_unipile_status("credentials") == "CREDENTIALS"
        assert normalize_unipile_status("  ok  ") == "OK"
        assert normalize_unipile_status("") is None
        assert normalize_unipile_status(None) is None

    def test_is_disconnected_unipile_status(self):
        assert is_disconnected_unipile_status("CREDENTIALS") is True
        assert is_disconnected_unipile_status(USER_SOFT_DISCONNECTED_STATUS) is True
        assert is_disconnected_unipile_status("OK") is False
        assert is_disconnected_unipile_status(None) is False


class TestEnrichConnectionStatus:
    def test_connected_user_does_not_need_reconnect(self, patch_user_db_path, monkeypatch):
        from cryptography.fernet import Fernet

        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)

        with patch_user_db_path("user_soft_dc") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, unipile_account_id,
                        unipile_sync_status, is_active
                    ) VALUES (?, 'unipile', ?, 'OK', 1)
                    """,
                    (ctx.user_id, "uni-acct-123"),
                )
                conn.commit()

            base = {"connected": True, "provider": "unipile", "accounts": []}
            enriched = enrich_connection_status(svc, ctx.user_id, base)

        assert enriched["needs_reconnect"] is False
        assert enriched["stored_unipile_account_id"] == "uni-acct-123"
        assert enriched["unipile_sync_status"] == "OK"

    def test_soft_disconnected_user_needs_reconnect(self, patch_user_db_path, monkeypatch):
        from cryptography.fernet import Fernet

        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)

        with patch_user_db_path("user_needs_reconnect") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, unipile_account_id,
                        unipile_sync_status, is_active
                    ) VALUES (?, 'unipile', ?, ?, 0)
                    """,
                    (ctx.user_id, "uni-preserved-456", USER_SOFT_DISCONNECTED_STATUS),
                )
                conn.commit()

            svc = LinkedInOAuthService()
            base = {"connected": False, "provider": "unipile", "accounts": []}
            enriched = enrich_connection_status(svc, ctx.user_id, base)

        assert enriched["needs_reconnect"] is True
        assert enriched["connected"] is False
        assert enriched["stored_unipile_account_id"] == "uni-preserved-456"
        assert enriched["unipile_sync_status"] == USER_SOFT_DISCONNECTED_STATUS


class TestSoftDisconnect:
    def test_mark_user_soft_disconnected_preserves_account_id(
        self, patch_user_db_path, monkeypatch
    ):
        from cryptography.fernet import Fernet

        valid = Fernet.generate_key().decode("utf-8")
        monkeypatch.setenv("LINKEDIN_TOKEN_ENCRYPTION_KEY", valid)

        with patch_user_db_path("user_mark_soft") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            with sqlite3.connect(ctx.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO linkedin_oauth_tokens (
                        user_id, provider_mode, unipile_account_id,
                        linkedin_access_token, is_active
                    ) VALUES (?, 'unipile', ?, 'token-plain', 1)
                    """,
                    (ctx.user_id, "uni-keep-me"),
                )
                conn.commit()

            svc = LinkedInOAuthService()
            revoked = mark_user_soft_disconnected(svc, ctx.user_id)

            assert revoked is True
            preserved = get_reconnect_unipile_account_id(svc, ctx.user_id)
            assert preserved == "uni-keep-me"

            with sqlite3.connect(ctx.db_path) as conn:
                row = conn.execute(
                    """
                    SELECT is_active, unipile_sync_status, unipile_account_id
                    FROM linkedin_oauth_tokens WHERE user_id = ?
                    """,
                    (ctx.user_id,),
                ).fetchone()

        is_active, sync_status, account_id = row
        assert is_active == 0
        assert sync_status == USER_SOFT_DISCONNECTED_STATUS
        assert account_id == "uni-keep-me"
