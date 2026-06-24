"""Tests for LinkedIn posts fetch orchestrator with injected fakes."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import pytest

from services.integrations.linkedin.linkedin_posts_service import fetch_user_posts
from services.integrations.linkedin.types import LinkedInCredentials, LinkedInNotConnectedError

_REPO_ROOT = Path(__file__).resolve().parents[5]
_FIXTURE_PATH = _REPO_ROOT / "docs" / "linkedin" / "fixtures" / "sample_post_list_raw.json"


class FakeOAuth:
    def resolve_credentials(self, user_id: str) -> LinkedInCredentials:
        return LinkedInCredentials(
            provider_mode="unipile",
            unipile_account_id="acc_test_123",
        )


class FakePostsClient:
    def __init__(self, items: list[dict[str, Any]], *, cursor: Optional[str] = "c1"):
        self._items = items
        self._cursor = cursor
        self.get_own_profile_calls = 0
        self.get_post_calls = 0

    async def get_own_profile(self, account_id: str) -> dict[str, Any]:
        self.get_own_profile_calls += 1
        return {
            "object": "AccountOwnerProfile",
            "provider_id": "ACoAABCD1234",
            "public_identifier": "jane-doe",
        }

    async def list_user_posts(
        self,
        account_id: str,
        identifier: str,
        *,
        limit: int = 20,
        cursor: Optional[str] = None,
        is_company: Optional[bool] = None,
    ) -> tuple[list[dict[str, Any]], Optional[str]]:
        return self._items[:limit], self._cursor

    async def get_post(self, account_id: str, post_id: str) -> dict[str, Any]:
        self.get_post_calls += 1
        for item in self._items:
            if item.get("id") == post_id:
                enriched = dict(item)
                enriched["text"] = enriched.get("text", "") + "\n\nFull article body."
                return enriched
        raise RuntimeError(f"post not found: {post_id}")


@pytest.fixture
def fixture_items() -> list[dict[str, Any]]:
    data = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    return data["items"]


@pytest.mark.asyncio
async def test_fetch_user_posts_resolves_identifier_and_normalizes(fixture_items):
    client = FakePostsClient(fixture_items, cursor=None)
    result = await fetch_user_posts(
        "user-test-1",
        client=client,
        oauth=FakeOAuth(),
        limit=10,
    )

    assert result.account_id == "acc_test_123"
    assert result.identifier == "jane-doe"
    assert len(result.posts) == 3
    assert result.posts[1].content_kind == "article"
    assert client.get_own_profile_calls == 1


@pytest.mark.asyncio
async def test_fetch_user_posts_enriches_articles(fixture_items):
    client = FakePostsClient(fixture_items, cursor=None)
    result = await fetch_user_posts(
        "user-test-1",
        client=client,
        oauth=FakeOAuth(),
        include_article_body=True,
    )
    assert client.get_post_calls == 1
    assert "Full article body." in result.posts[1].text


@pytest.mark.asyncio
async def test_fetch_user_posts_skips_article_enrichment_when_disabled(fixture_items):
    client = FakePostsClient(fixture_items, cursor=None)
    await fetch_user_posts(
        "user-test-1",
        client=client,
        oauth=FakeOAuth(),
        include_article_body=False,
    )
    assert client.get_post_calls == 0


@pytest.mark.asyncio
async def test_fetch_user_posts_not_connected():
    class EmptyOAuth:
        def resolve_credentials(self, user_id: str) -> LinkedInCredentials:
            return LinkedInCredentials(provider_mode="unipile")

    with pytest.raises(LinkedInNotConnectedError):
        await fetch_user_posts(
            "user-test-1",
            client=FakePostsClient([]),
            oauth=EmptyOAuth(),
        )
