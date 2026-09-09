"""Audience Analytics parsers — no invented demographics or country ranks."""

from unittest.mock import MagicMock

from services.youtube.youtube_analytics_audience_query import (
    COUNTRY_TOP_N,
    DEMOGRAPHICS_DIMENSIONS,
    DEMOGRAPHICS_METRICS,
    GEO_DIMENSIONS,
    GEO_METRICS,
    SUBSCRIBED_DIMENSIONS,
    SUBSCRIBED_METRICS,
    country_label,
    execute_countries,
    execute_demographics,
    execute_subscribed,
    parse_countries,
    parse_demographics,
    parse_subscribed,
)


def test_query_constants_are_separate_reports():
    assert DEMOGRAPHICS_DIMENSIONS == "ageGroup,gender"
    assert DEMOGRAPHICS_METRICS == "viewerPercentage"
    assert "views" not in DEMOGRAPHICS_METRICS
    assert "country" not in DEMOGRAPHICS_DIMENSIONS
    assert "subscribedStatus" not in DEMOGRAPHICS_DIMENSIONS
    assert GEO_DIMENSIONS == "country"
    assert GEO_METRICS == "views,estimatedMinutesWatched"
    assert SUBSCRIBED_DIMENSIONS == "subscribedStatus"
    assert SUBSCRIBED_METRICS == "views,estimatedMinutesWatched"
    assert "day" not in SUBSCRIBED_DIMENSIONS


def test_empty_demographics_are_empty_not_fifty_fifty():
    assert parse_demographics({"rows": []}) == []
    assert parse_demographics(None) == []


def test_demographics_skip_malformed_rows():
    rows = parse_demographics(
        {
            "rows": [
                ["age18-24", "female", 40],
                ["", "male", 10],
                ["age25-34"],
                ["age25-34", "male", 60],
            ]
        }
    )
    assert rows == [
        {
            "age_group": "age18-24",
            "gender": "female",
            "viewer_percentage": 40.0,
        },
        {
            "age_group": "age25-34",
            "gender": "male",
            "viewer_percentage": 60.0,
        },
    ]


def test_countries_keep_zz_and_cap_top_n_by_views():
    assert country_label("ZZ") == "Unknown country"
    assert country_label("US") == "US"
    rows = [{"country": f"C{index}", "views": float(index), "watch_hours": 0.1} for index in range(12)]
    parsed = parse_countries(
        {
            "rows": [
                [item["country"], item["views"], 6] for item in rows
            ]
            + [["ZZ", 99, 120], ["", 5, 1]]
        }
    )
    assert COUNTRY_TOP_N == 10
    assert len(parsed) == 10
    assert parsed[0]["country"] == "ZZ"
    assert parsed[0]["label"] == "Unknown country"
    assert parsed[0]["views"] == 99.0
    assert parsed[0]["watch_hours"] == 2.0
    assert all(item["country"] for item in parsed)


def test_subscribed_maps_watch_hours_without_invented_status():
    parsed = parse_subscribed(
        {
            "rows": [
                ["SUBSCRIBED", 80, 120],
                ["UNSUBSCRIBED", 20, 30],
                ["", 4, 1],
            ]
        }
    )
    assert parsed == [
        {"status": "SUBSCRIBED", "views": 80.0, "watch_hours": 2.0},
        {"status": "UNSUBSCRIBED", "views": 20.0, "watch_hours": 0.5},
    ]


def test_executors_use_independent_dimension_metric_pairs():
    from datetime import date

    analytics = MagicMock()
    start = date(2026, 8, 1)
    end = date(2026, 8, 28)
    execute_demographics(analytics, start, end)
    execute_countries(analytics, start, end)
    execute_subscribed(analytics, start, end)
    calls = analytics.reports.return_value.query.call_args_list
    assert len(calls) == 3
    demo = calls[0].kwargs
    geo = calls[1].kwargs
    sub = calls[2].kwargs
    assert demo["dimensions"] == DEMOGRAPHICS_DIMENSIONS
    assert demo["metrics"] == DEMOGRAPHICS_METRICS
    assert geo["dimensions"] == GEO_DIMENSIONS
    assert geo["metrics"] == GEO_METRICS
    assert sub["dimensions"] == SUBSCRIBED_DIMENSIONS
    assert sub["metrics"] == SUBSCRIBED_METRICS
    assert demo["ids"] == "channel==MINE"
    assert "day" not in sub["dimensions"]
