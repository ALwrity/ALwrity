from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.integrations.linkedin.types import CreatePostRequest
from services.integrations.linkedin.unipile_client import (
    UnipileAPIError,
    UnipileClient,
)
from services.integrations.linkedin.unipile_provider import UnipileProvider


def _mock_async_http_client(response: Mock) -> AsyncMock:
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    client.post = AsyncMock(return_value=response)
    return client


@pytest.mark.anyio
async def test_unipile_client_create_post_uses_posts_endpoint() -> None:
    response = Mock(status_code=201, text="created")
    response.json.return_value = {
        "id": "123",
        "social_id": "urn:li:activity:123",
        "share_url": "https://www.linkedin.com/posts/example",
    }
    mock_client = _mock_async_http_client(response)

    with patch(
        "services.integrations.linkedin.unipile_client.httpx.AsyncClient",
        return_value=mock_client,
    ):
        client = UnipileClient(api_key="test-key", dsn="api.example.com")
        data = await client.create_post("acct-1", "Hello LinkedIn")

    assert data["social_id"] == "urn:li:activity:123"
    mock_client.post.assert_awaited_once()
    url = mock_client.post.await_args.args[0]
    assert url.endswith("/api/v1/posts")
    assert mock_client.post.await_args.kwargs["files"] == {
        "account_id": (None, "acct-1"),
        "text": (None, "Hello LinkedIn"),
    }
    assert "json" not in mock_client.post.await_args.kwargs


@pytest.mark.anyio
async def test_unipile_client_create_post_raises_on_error() -> None:
    response = Mock(status_code=403, text="Forbidden")
    mock_client = _mock_async_http_client(response)

    with patch(
        "services.integrations.linkedin.unipile_client.httpx.AsyncClient",
        return_value=mock_client,
    ):
        client = UnipileClient(api_key="test-key", dsn="api.example.com")
        with pytest.raises(UnipileAPIError) as exc_info:
            await client.create_post("acct-1", "Hello LinkedIn")

    assert exc_info.value.status_code == 403


@pytest.mark.anyio
async def test_unipile_provider_create_post_publishes_text_only() -> None:
    creds = SimpleNamespace(provider_mode="unipile", unipile_account_id="acct-1")
    provider = UnipileProvider(
        oauth_service=SimpleNamespace(resolve_credentials=lambda user_id: creds)
    )
    provider._client.create_post = AsyncMock(
        return_value={
            "id": "123",
            "social_id": "urn:li:activity:123",
            "share_url": "https://www.linkedin.com/posts/example",
        }
    )

    with patch(
        "services.integrations.linkedin.unipile_provider.run_publish_preflight",
        new_callable=AsyncMock,
    ):
        result = await provider.create_post(
            "user_1",
            CreatePostRequest(
                account_id="acct-1",
                content="Hello LinkedIn",
            ),
        )

    assert result.success is True
    assert result.post_urn == "urn:li:activity:123"
    provider._client.create_post.assert_awaited_once_with("acct-1", "Hello LinkedIn")


@pytest.mark.anyio
async def test_unipile_provider_create_post_rejects_empty_content() -> None:
    creds = SimpleNamespace(provider_mode="unipile", unipile_account_id="acct-1")
    provider = UnipileProvider(
        oauth_service=SimpleNamespace(resolve_credentials=lambda user_id: creds)
    )
    provider._client.create_post = AsyncMock()

    with pytest.raises(ValueError, match="empty"):
        await provider.create_post(
            "user_1",
            CreatePostRequest(account_id="acct-1", content="   "),
        )

    provider._client.create_post.assert_not_called()


@pytest.mark.anyio
async def test_unipile_provider_create_post_rejects_account_mismatch() -> None:
    creds = SimpleNamespace(provider_mode="unipile", unipile_account_id="acct-1")
    provider = UnipileProvider(
        oauth_service=SimpleNamespace(resolve_credentials=lambda user_id: creds)
    )
    provider._client.create_post = AsyncMock()

    with pytest.raises(ValueError, match="does not match"):
        await provider.create_post(
            "user_1",
            CreatePostRequest(account_id="other-acct", content="Hello"),
        )

    provider._client.create_post.assert_not_called()
