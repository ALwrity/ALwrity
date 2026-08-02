"""Unit tests for Unipile retrieve-post analytics enrichment (#221)."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from services.integrations.linkedin.post_analytics_enrichment import (
    enrich_posts_with_retrieve_analytics,
    item_has_creator_analytics,
    item_needs_analytics_enrichment,
    merge_post_analytics,
    resolve_retrieve_post_id,
    resolve_retrieve_post_ids,
)
from services.integrations.linkedin.unipile_client import UnipileAPIError

pytestmark = [pytest.mark.linkedin]


def _list_item(**analytics: Any) -> dict[str, Any]:
    return {
        "id": "7332661864792854528",
        "social_id": "urn:li:activity:7332661864792854528",
        "impressions_counter": analytics.get("impressions", 100),
        "analytics": analytics,
    }


class TestEnrichmentGate:
    def test_needs_enrichment_when_analytics_missing(self) -> None:
        assert item_needs_analytics_enrichment({"id": "1"}) is True
        assert item_has_creator_analytics({"id": "1"}) is False

    def test_needs_enrichment_when_engagements_or_page_viewers_missing(self) -> None:
        item = _list_item(
            impressions=100,
            followers_gained_from_this_post=1,
            members_reached=80,
        )
        assert item_needs_analytics_enrichment(item) is True

    def test_needs_enrichment_for_stub_zero_clicks_without_ctr(self) -> None:
        item = _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=0,
        )
        assert item_needs_analytics_enrichment(item) is True

    def test_skip_enrichment_when_engagements_page_viewers_and_ctr_present(
        self,
    ) -> None:
        item = _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=0,
            clickthrough_rate=0.0,
        )
        assert item_needs_analytics_enrichment(item) is False
        assert item_has_creator_analytics(item) is True

    def test_skip_enrichment_when_positive_clicks_present(self) -> None:
        item = _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=4,
        )
        assert item_needs_analytics_enrichment(item) is False


class TestRetrievePostIds:
    def test_prefers_social_id_over_numeric_id(self) -> None:
        item = {
            "id": "7332661864792854528",
            "social_id": "urn:li:activity:7332661864792854528",
        }
        assert resolve_retrieve_post_ids(item) == [
            "urn:li:activity:7332661864792854528",
            "7332661864792854528",
        ]
        assert resolve_retrieve_post_id(item) == "urn:li:activity:7332661864792854528"

    def test_empty_when_no_ids(self) -> None:
        assert resolve_retrieve_post_ids({}) == []
        assert resolve_retrieve_post_id({}) is None


class TestMergePostAnalytics:
    def test_merges_detail_analytics_onto_list_item(self) -> None:
        list_item = _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=0,
        )
        detail = {
            "analytics": {
                "clicks": 9,
                "clickthrough_rate": 0.09,
                "engagements": 10,
                "page_viewers_from_this_post": 2,
            }
        }
        merged = merge_post_analytics(list_item, detail)
        assert merged["analytics"]["clicks"] == 9
        assert merged["analytics"]["clickthrough_rate"] == 0.09
        assert merged["analytics"]["page_viewers_from_this_post"] == 2

    def test_returns_list_item_when_detail_has_no_analytics(self) -> None:
        list_item = _list_item(engagements=1, page_viewers_from_this_post=1)
        assert merge_post_analytics(list_item, {"id": "x"}) is list_item


@pytest.mark.anyio
async def test_enrich_posts_merges_retrieve_post_clicks() -> None:
    items = [
        _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=0,
        )
    ]
    client = AsyncMock()
    client.get_post = AsyncMock(
        return_value={
            "id": "7332661864792854528",
            "analytics": {
                "clicks": 11,
                "clickthrough_rate": 0.11,
                "engagements": 10,
                "page_viewers_from_this_post": 2,
            },
        }
    )

    enriched = await enrich_posts_with_retrieve_analytics(
        client, "acct-1", items, max_posts=5, concurrency=2
    )

    assert enriched[0]["analytics"]["clicks"] == 11
    assert enriched[0]["analytics"]["clickthrough_rate"] == 0.11
    client.get_post.assert_awaited()
    first_post_id = client.get_post.await_args.args[1]
    assert first_post_id == "urn:li:activity:7332661864792854528"


@pytest.mark.anyio
async def test_enrich_posts_skips_when_complete() -> None:
    items = [
        _list_item(
            impressions=100,
            engagements=10,
            page_viewers_from_this_post=2,
            clicks=5,
            clickthrough_rate=0.05,
        )
    ]
    client = AsyncMock()
    client.get_post = AsyncMock()

    enriched = await enrich_posts_with_retrieve_analytics(
        client, "acct-1", items, max_posts=5, concurrency=2
    )

    assert enriched[0]["analytics"]["clicks"] == 5
    client.get_post.assert_not_awaited()


@pytest.mark.anyio
async def test_enrich_posts_falls_back_to_numeric_id_on_404() -> None:
    items = [
        {
            "id": "7332661864792854528",
            "social_id": "urn:li:activity:7332661864792854528",
            "analytics": {
                "engagements": 3,
                "page_viewers_from_this_post": 1,
                "clicks": 0,
            },
        }
    ]

    async def _get_post(_account_id: str, post_id: str) -> dict[str, Any]:
        if post_id.startswith("urn:"):
            raise UnipileAPIError("not found", status_code=404)
        return {
            "analytics": {
                "clicks": 3,
                "clickthrough_rate": 0.03,
                "engagements": 3,
                "page_viewers_from_this_post": 1,
            }
        }

    client = AsyncMock()
    client.get_post = AsyncMock(side_effect=_get_post)

    enriched = await enrich_posts_with_retrieve_analytics(
        client, "acct-1", items, max_posts=5, concurrency=1
    )

    assert enriched[0]["analytics"]["clicks"] == 3
    assert client.get_post.await_count == 2


@pytest.mark.anyio
async def test_enrich_posts_continues_when_retrieve_fails() -> None:
    items = [
        _list_item(
            engagements=2,
            page_viewers_from_this_post=1,
            clicks=0,
        )
    ]
    client = AsyncMock()
    client.get_post = AsyncMock(
        side_effect=UnipileAPIError("boom", status_code=500)
    )

    enriched = await enrich_posts_with_retrieve_analytics(
        client, "acct-1", items, max_posts=5, concurrency=1
    )

    # List data preserved on failure
    assert enriched[0]["analytics"]["engagements"] == 2
    assert enriched[0]["analytics"]["clicks"] == 0
