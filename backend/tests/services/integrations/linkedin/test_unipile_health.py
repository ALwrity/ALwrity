from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest

from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.unipile_health import (
    check_unipile_health,
    get_cached_unipile_health,
    log_unipile_startup_health,
)


@pytest.mark.anyio
async def test_check_unipile_health_skips_when_provider_not_unipile() -> None:
    with patch.dict(os.environ, {"LINKEDIN_PROVIDER": "native"}, clear=False):
        result = await check_unipile_health(probe_api=True)

    assert result["status"] == "skipped"
    assert result["healthy"] is True


@pytest.mark.anyio
async def test_check_unipile_health_misconfigured_when_env_missing() -> None:
    env = {
        "LINKEDIN_PROVIDER": "unipile",
        "UNIPILE_API_KEY": "",
        "UNIPILE_DSN": "",
    }
    with patch.dict(os.environ, env, clear=False):
        result = await check_unipile_health(probe_api=True)

    assert result["status"] == "misconfigured"
    assert result["healthy"] is False
    assert "UNIPILE_API_KEY is not configured" in result["errors"]


@pytest.mark.anyio
async def test_check_unipile_health_unhealthy_on_unipile_401() -> None:
    env = {
        "LINKEDIN_PROVIDER": "unipile",
        "UNIPILE_API_KEY": "test-key",
        "UNIPILE_DSN": "api48.unipile.com:17838",
    }
    mock_client = AsyncMock()
    mock_client.list_accounts = AsyncMock(
        side_effect=UnipileAPIError(
            'Unipile API returned HTTP 401: {"title":"Missing credentials"}',
            status_code=401,
        )
    )

    with patch.dict(os.environ, env, clear=False):
        with patch(
            "services.integrations.linkedin.unipile_health.UnipileClient",
            return_value=mock_client,
        ):
            result = await check_unipile_health(probe_api=True)

    assert result["status"] == "unhealthy"
    assert result["healthy"] is False
    assert result["configured"] is True
    assert any("regenerate the token" in err for err in result["errors"])


@pytest.mark.anyio
async def test_check_unipile_health_healthy_when_api_accepts_credentials() -> None:
    env = {
        "LINKEDIN_PROVIDER": "unipile",
        "UNIPILE_API_KEY": "test-key",
        "UNIPILE_DSN": "api48.unipile.com:17838",
    }
    mock_client = AsyncMock()
    mock_client.list_accounts = AsyncMock(return_value=[{"id": "acct-1"}])

    with patch.dict(os.environ, env, clear=False):
        with patch(
            "services.integrations.linkedin.unipile_health.UnipileClient",
            return_value=mock_client,
        ):
            result = await check_unipile_health(probe_api=True)

    assert result["status"] == "healthy"
    assert result["healthy"] is True
    assert result["account_count"] == 1


@pytest.mark.anyio
async def test_get_cached_unipile_health_returns_last_result() -> None:
    env = {
        "LINKEDIN_PROVIDER": "unipile",
        "UNIPILE_API_KEY": "test-key",
        "UNIPILE_DSN": "api48.unipile.com:17838",
    }
    mock_client = AsyncMock()
    mock_client.list_accounts = AsyncMock(return_value=[])

    with patch.dict(os.environ, env, clear=False):
        with patch(
            "services.integrations.linkedin.unipile_health.UnipileClient",
            return_value=mock_client,
        ):
            await check_unipile_health(probe_api=True)
            cached = get_cached_unipile_health()

    assert cached is not None
    assert cached["status"] == "healthy"


@pytest.mark.anyio
async def test_log_unipile_startup_health_does_not_raise_on_failure() -> None:
    env = {
        "LINKEDIN_PROVIDER": "unipile",
        "UNIPILE_API_KEY": "test-key",
        "UNIPILE_DSN": "api48.unipile.com:17838",
    }
    mock_client = AsyncMock()
    mock_client.list_accounts = AsyncMock(
        side_effect=UnipileAPIError("Unauthorized", status_code=401)
    )

    with patch.dict(os.environ, env, clear=False):
        with patch(
            "services.integrations.linkedin.unipile_health.UnipileClient",
            return_value=mock_client,
        ):
            result = await log_unipile_startup_health()

    assert result["healthy"] is False
