from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.unipile_reconnect_guardrails import (
    extract_unipile_owner_name,
    preflight_reconnect_account_id,
    should_enforce_owner_match,
)

pytestmark = [pytest.mark.linkedin]


class TestExtractUnipileOwnerName:
    def test_prefers_primary_name_field(self):
        assert extract_unipile_owner_name({"name": "user_1"}) == "user_1"
        assert extract_unipile_owner_name({"client_name": "user_2"}) == "user_2"
        assert extract_unipile_owner_name({"external_id": "user_3"}) == "user_3"
        assert extract_unipile_owner_name({"reference": "user_4"}) == "user_4"
        assert extract_unipile_owner_name({}) is None


class TestShouldEnforceOwnerMatch:
    def test_enforces_only_internal_user_style_ids(self):
        assert should_enforce_owner_match("user_abc123") is True
        assert should_enforce_owner_match("Umesh Sharma") is False
        assert should_enforce_owner_match("acme corp") is False
        assert should_enforce_owner_match(None) is False


class TestPreflightReconnectAccountId:
    @pytest.mark.anyio
    async def test_clears_stale_and_returns_none_on_404(self, monkeypatch):
        clear_calls: list[tuple[str, str]] = []

        def _fake_clear(_oauth, user_id, *, account_id):
            clear_calls.append((user_id, account_id))
            return True

        monkeypatch.setattr(
            "services.integrations.linkedin.unipile_reconnect_guardrails.clear_stale_unipile_account_id",
            _fake_clear,
        )

        mock_client = MagicMock()
        mock_client.get_account = AsyncMock(
            side_effect=UnipileAPIError("not found", status_code=404)
        )

        result = await preflight_reconnect_account_id(
            oauth=MagicMock(),
            user_id="user_404",
            account_id="acc-404",
            client=mock_client,
            trace_id="trace-1",
        )

        assert result is None
        assert clear_calls == [("user_404", "acc-404")]

    @pytest.mark.anyio
    async def test_returns_none_on_internal_owner_mismatch(self, monkeypatch):
        clear_calls: list[tuple[str, str]] = []

        def _fake_clear(_oauth, user_id, *, account_id):
            clear_calls.append((user_id, account_id))
            return True

        monkeypatch.setattr(
            "services.integrations.linkedin.unipile_reconnect_guardrails.clear_stale_unipile_account_id",
            _fake_clear,
        )

        mock_client = MagicMock()
        mock_client.get_account = AsyncMock(
            return_value={"id": "acc-1", "name": "user_other"}
        )

        result = await preflight_reconnect_account_id(
            oauth=MagicMock(),
            user_id="user_1",
            account_id="acc-1",
            client=mock_client,
            trace_id="trace-2",
        )

        assert result is None
        assert clear_calls == [("user_1", "acc-1")]

    @pytest.mark.anyio
    async def test_allows_display_name_owner_without_clearing(self, monkeypatch):
        clear_calls: list[tuple[str, str]] = []

        def _fake_clear(_oauth, user_id, *, account_id):
            clear_calls.append((user_id, account_id))
            return True

        monkeypatch.setattr(
            "services.integrations.linkedin.unipile_reconnect_guardrails.clear_stale_unipile_account_id",
            _fake_clear,
        )

        mock_client = MagicMock()
        mock_client.get_account = AsyncMock(
            return_value={"id": "acc-2", "name": "Umesh Sharma", "status": "OK"}
        )

        result = await preflight_reconnect_account_id(
            oauth=MagicMock(),
            user_id="user_1",
            account_id="acc-2",
            client=mock_client,
            trace_id="trace-3",
        )

        assert result == "acc-2"
        assert clear_calls == []
