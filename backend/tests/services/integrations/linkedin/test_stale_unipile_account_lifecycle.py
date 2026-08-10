"""Tests for stale/deleted Unipile account_id reconnect handling.

Covers: Unipile dashboard delete → soft disconnect preserves ghost id →
reconnect 404 → clear stale → create new → adopt incoming id (do not delete it).
"""

from __future__ import annotations

import sqlite3
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.integrations.linkedin.linkedin_oauth_unipile_status import (
    USER_SOFT_DISCONNECTED_STATUS,
    clear_stale_unipile_account_id,
    get_reconnect_unipile_account_id,
)
from services.integrations.linkedin.unipile_account_lifecycle import (
    UnipileAccountLifecycleService,
)
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService

pytestmark = [pytest.mark.linkedin]


def _insert_soft_disconnected_row(db_path: str, user_id: str, account_id: str) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO linkedin_oauth_tokens (
                user_id, provider_mode, unipile_account_id,
                unipile_sync_status, is_active
            ) VALUES (?, 'unipile', ?, ?, 0)
            """,
            (user_id, account_id, USER_SOFT_DISCONNECTED_STATUS),
        )
        conn.commit()


class TestClearStaleUnipileAccountId:
    def test_clears_preserved_account_id(self, patch_user_db_path, monkeypatch):
        from cryptography.fernet import Fernet

        monkeypatch.setenv(
            "LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8")
        )

        with patch_user_db_path("user_clear_stale") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            _insert_soft_disconnected_row(ctx.db_path, ctx.user_id, "uni-ghost-1")

            assert get_reconnect_unipile_account_id(svc, ctx.user_id) == "uni-ghost-1"
            cleared = clear_stale_unipile_account_id(
                svc, ctx.user_id, account_id="uni-ghost-1"
            )
            assert cleared is True
            assert get_reconnect_unipile_account_id(svc, ctx.user_id) is None

            with sqlite3.connect(ctx.db_path) as conn:
                row = conn.execute(
                    """
                    SELECT unipile_account_id, unipile_sync_status
                    FROM linkedin_oauth_tokens WHERE user_id = ?
                    """,
                    (ctx.user_id,),
                ).fetchone()

        assert row[0] is None
        assert row[1] == "DELETED"


class TestResolveDuplicateAdoptsIncomingWhenStoredGone:
    @pytest.mark.anyio
    async def test_adopts_incoming_when_stored_404(
        self, patch_user_db_path, monkeypatch
    ):
        from cryptography.fernet import Fernet

        monkeypatch.setenv(
            "LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8")
        )

        with patch_user_db_path("user_adopt_new") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            _insert_soft_disconnected_row(ctx.db_path, ctx.user_id, "uni-old-deleted")

            lifecycle = UnipileAccountLifecycleService(svc)
            mock_client = MagicMock()
            mock_client.get_account = AsyncMock(
                side_effect=UnipileAPIError("gone", status_code=404)
            )
            mock_client.delete_account = AsyncMock(return_value=True)

            with patch(
                "services.integrations.linkedin.unipile_account_lifecycle.UnipileClient",
                return_value=mock_client,
            ):
                resolved = await lifecycle.resolve_duplicate_account_id(
                    ctx.user_id, "uni-new-live"
                )

            assert resolved == "uni-new-live"
            mock_client.delete_account.assert_not_called()
            assert get_reconnect_unipile_account_id(svc, ctx.user_id) is None

    @pytest.mark.anyio
    async def test_keeps_stored_and_deletes_incoming_when_stored_exists(
        self, patch_user_db_path, monkeypatch
    ):
        """True duplicate case — stored Unipile account still exists."""
        from cryptography.fernet import Fernet

        monkeypatch.setenv(
            "LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8")
        )

        with patch_user_db_path("user_true_dup") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            _insert_soft_disconnected_row(ctx.db_path, ctx.user_id, "uni-original")

            lifecycle = UnipileAccountLifecycleService(svc)
            mock_client = MagicMock()
            mock_client.get_account = AsyncMock(return_value={"id": "uni-original"})
            mock_client.delete_account = AsyncMock(return_value=True)

            with patch(
                "services.integrations.linkedin.unipile_account_lifecycle.UnipileClient",
                return_value=mock_client,
            ):
                resolved = await lifecycle.resolve_duplicate_account_id(
                    ctx.user_id, "uni-duplicate"
                )

            assert resolved == "uni-original"
            mock_client.delete_account.assert_awaited_once_with("uni-duplicate")
            assert get_reconnect_unipile_account_id(svc, ctx.user_id) == "uni-original"


class TestReconnectUrlClearsStaleOn404:
    @pytest.mark.anyio
    async def test_reconnect_404_clears_stale_and_returns_create_purpose(
        self, patch_user_db_path, monkeypatch
    ):
        from cryptography.fernet import Fernet

        monkeypatch.setenv(
            "LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8")
        )
        monkeypatch.setenv("UNIPILE_API_KEY", "test-key")
        monkeypatch.setenv("UNIPILE_DSN", "https://api.unipile.test")

        with patch_user_db_path("user_reconnect_404") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            _insert_soft_disconnected_row(ctx.db_path, ctx.user_id, "uni-missing")

            lifecycle = UnipileAccountLifecycleService(svc)
            mock_client = MagicMock()
            mock_client.reconnect_account = AsyncMock(
                side_effect=UnipileAPIError("not found", status_code=404)
            )
            mock_client.create_hosted_auth_link = AsyncMock(
                return_value=SimpleNamespace(
                    auth_url="https://unipile.example/hosted/new"
                )
            )

            with patch.object(
                svc,
                "_get_unipile_redirect_urls",
                return_value={
                    "success": "http://localhost/ok",
                    "failure": "http://localhost/fail",
                    "notify": "http://localhost/notify",
                },
            ), patch(
                "services.integrations.linkedin.unipile_account_lifecycle.UnipileClient",
                return_value=mock_client,
            ):
                payload = await lifecycle.generate_connect_or_reconnect_url(ctx.user_id)

            assert payload["purpose"] == "connect"
            assert payload["auth_url"].startswith("https://unipile.example/")
            assert get_reconnect_unipile_account_id(svc, ctx.user_id) is None
            mock_client.create_hosted_auth_link.assert_awaited_once()

    @pytest.mark.anyio
    async def test_reconnect_preflight_clears_internal_owner_mismatch_and_falls_back_create(
        self, patch_user_db_path, monkeypatch
    ):
        from cryptography.fernet import Fernet

        monkeypatch.setenv(
            "LINKEDIN_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode("utf-8")
        )
        monkeypatch.setenv("UNIPILE_API_KEY", "test-key")
        monkeypatch.setenv("UNIPILE_DSN", "https://api.unipile.test")

        with patch_user_db_path("user_owner_mismatch") as ctx:
            svc = LinkedInOAuthService()
            svc._init_db(ctx.user_id)
            _insert_soft_disconnected_row(ctx.db_path, ctx.user_id, "uni-mismatch-id")

            lifecycle = UnipileAccountLifecycleService(svc)
            mock_client = MagicMock()
            mock_client.get_account = AsyncMock(
                return_value={"id": "uni-mismatch-id", "name": "user_other"}
            )
            mock_client.reconnect_account = AsyncMock()
            mock_client.create_hosted_auth_link = AsyncMock(
                return_value=SimpleNamespace(
                    auth_url="https://unipile.example/hosted/new"
                )
            )

            with patch.object(
                svc,
                "_get_unipile_redirect_urls",
                return_value={
                    "success": "http://localhost/ok",
                    "failure": "http://localhost/fail",
                    "notify": "http://localhost/notify",
                },
            ), patch(
                "services.integrations.linkedin.unipile_account_lifecycle.UnipileClient",
                return_value=mock_client,
            ):
                payload = await lifecycle.generate_connect_or_reconnect_url(ctx.user_id)

            assert payload["purpose"] == "connect"
            assert get_reconnect_unipile_account_id(svc, ctx.user_id) is None
            mock_client.reconnect_account.assert_not_called()
            mock_client.create_hosted_auth_link.assert_awaited_once()
