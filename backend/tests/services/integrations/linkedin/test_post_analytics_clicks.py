"""Unit tests for Unipile LinkedIn post analytics clicks/CTR helpers (#221)."""

from __future__ import annotations

import pytest

from services.integrations.linkedin.post_analytics_clicks import (
    clicks_analytics_complete,
    derive_clickthrough_rate,
    merge_analytics_prefer_detail,
    resolve_clicks,
    resolve_clickthrough_rate,
    resolve_impressions,
)
from services.integrations.linkedin.posts_service import _normalize_engagement

pytestmark = [pytest.mark.linkedin]


class TestResolveClicksAndCtr:
    def test_v1_analytics_clicks_and_ctr(self) -> None:
        item = {
            "impressions_counter": 100,
            "analytics": {
                "impressions": 100,
                "clicks": 5,
                "clickthrough_rate": 0.05,
            },
        }
        assert resolve_clicks(item) == 5
        assert resolve_clickthrough_rate(item) == 0.05
        assert resolve_impressions(item) == 100

    def test_counter_alias_clicks_counter(self) -> None:
        item = {
            "analytics": {
                "impressions_counter": 200,
                "clicks_counter": 8,
                "clickthrough_rate_counter": 4.0,  # percent form
            },
        }
        assert resolve_clicks(item) == 8
        assert resolve_clickthrough_rate(item) == 0.04

    def test_missing_clicks_defaults_to_zero(self) -> None:
        item = {"analytics": {"impressions": 50, "engagements": 3}}
        assert resolve_clicks(item) == 0
        assert resolve_clickthrough_rate(item) is None


class TestClicksAnalyticsComplete:
    def test_stub_zero_clicks_without_ctr_is_incomplete(self) -> None:
        item = {
            "impressions_counter": 500,
            "analytics": {
                "impressions": 500,
                "engagements": 10,
                "clicks": 0,
                "page_viewers_from_this_post": 2,
            },
        }
        assert clicks_analytics_complete(item) is False

    def test_positive_clicks_is_complete(self) -> None:
        item = {
            "analytics": {
                "impressions": 500,
                "clicks": 3,
            },
        }
        assert clicks_analytics_complete(item) is True

    def test_explicit_ctr_marks_complete(self) -> None:
        item = {
            "analytics": {
                "impressions": 500,
                "clicks": 0,
                "clickthrough_rate": 0.0,
            },
        }
        assert clicks_analytics_complete(item) is True

    def test_empty_analytics_incomplete(self) -> None:
        assert clicks_analytics_complete({}) is False
        assert clicks_analytics_complete({"analytics": {}}) is False


class TestMergeAnalyticsPreferDetail:
    def test_prefers_nonzero_detail_clicks_over_list_zero(self) -> None:
        base = {"clicks": 0, "impressions": 100, "engagements": 5}
        detail = {"clicks": 12, "clickthrough_rate": 0.12, "impressions": 100}
        merged = merge_analytics_prefer_detail(base, detail)
        assert merged["clicks"] == 12
        assert merged["clickthrough_rate"] == 0.12

    def test_detail_zero_overwrites_list_nonzero_via_spread(self) -> None:
        """Documents current merge: detail clicks:0 replaces list clicks:7."""
        base = {"clicks": 7, "clickthrough_rate": 0.07}
        detail = {"clicks": 0, "engagements": 9}
        merged = merge_analytics_prefer_detail(base, detail)
        assert merged["clicks"] == 0
        assert merged["engagements"] == 9

    def test_legacy_clicks_zero_shadows_detail_clicks_counter(self) -> None:
        """List clicks:0 + retrieve clicks_counter:N — resolve still reads legacy 0."""
        base = {"clicks": 0, "impressions": 80}
        detail = {"clicks_counter": 6, "clickthrough_rate": 0.075}
        merged = merge_analytics_prefer_detail(base, detail)
        assert merged.get("clicks_counter") == 6
        assert merged.get("clicks") == 0
        assert resolve_clicks({"analytics": merged}) == 0


class TestDeriveClickthroughRate:
    def test_provider_rate_wins(self) -> None:
        assert derive_clickthrough_rate(10, 100, 0.09) == 0.09

    def test_derives_from_clicks_when_provider_missing(self) -> None:
        assert derive_clickthrough_rate(5, 100, None) == 0.05

    def test_none_when_no_impressions_and_no_provider(self) -> None:
        assert derive_clickthrough_rate(5, 0, None) is None

    def test_none_when_zero_clicks_even_with_impressions(self) -> None:
        assert derive_clickthrough_rate(0, 100, None) is None


class TestNormalizeEngagementClicks:
    def test_normalize_maps_v1_clicks_and_ctr(self) -> None:
        eng = _normalize_engagement(
            {
                "reaction_counter": 2,
                "comment_counter": 1,
                "repost_counter": 0,
                "impressions_counter": 40,
                "analytics": {
                    "impressions": 40,
                    "engagements": 5,
                    "clicks": 4,
                    "clickthrough_rate": 0.1,
                    "page_viewers_from_this_post": 1,
                    "followers_gained_from_this_post": 2,
                    "members_reached": 30,
                },
            }
        )
        assert eng.clicks == 4
        assert eng.clickthrough_rate == 0.1
        assert eng.engagements == 5
        assert eng.page_viewers == 1
        assert eng.followers_gained == 2
        assert eng.reach == 30

    def test_normalize_derives_ctr_when_clicks_present_ctr_omitted(self) -> None:
        eng = _normalize_engagement(
            {
                "reaction_counter": 0,
                "comment_counter": 0,
                "repost_counter": 0,
                "impressions_counter": 50,
                "analytics": {"clicks": 5, "impressions": 50},
            }
        )
        assert eng.clicks == 5
        assert eng.clickthrough_rate == 0.1

    def test_normalize_zero_clicks_with_impressions(self) -> None:
        eng = _normalize_engagement(
            {
                "reaction_counter": 3,
                "comment_counter": 1,
                "repost_counter": 0,
                "impressions_counter": 100,
                "analytics": {
                    "engagements": 4,
                    "clicks": 0,
                    "page_viewers_from_this_post": 2,
                },
            }
        )
        assert eng.clicks == 0
        # Do not invent CTR=0% when LinkedIn omits CTR and clicks are 0
        assert eng.clickthrough_rate is None
        assert eng.page_viewers == 2
