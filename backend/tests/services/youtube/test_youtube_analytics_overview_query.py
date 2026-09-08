"""Channel Overview query helpers — date windows and payload mapping."""

from datetime import date, timedelta

from services.youtube.youtube_analytics_overview_query import (
    parse_views_by_day,
    parse_window_totals,
    previous_window_bounds,
    watch_hours_from_minutes,
    window_payload,
)


def test_previous_window_is_the_n_days_before_current_start():
    current_start = date(2026, 9, 1)
    prev_start, prev_end = previous_window_bounds(current_start, 7)
    assert prev_end == date(2026, 8, 31)
    assert prev_start == prev_end - timedelta(days=7)


def test_watch_hours_are_computed_once_from_minutes():
    assert watch_hours_from_minutes(42) == 0.7
    assert watch_hours_from_minutes(None) is None


def test_empty_analytics_rows_are_a_zero_window_not_unavailable():
    totals = parse_window_totals({"rows": []})
    payload = window_payload(totals)
    assert payload["views"] == 0.0
    assert payload["watch_hours"] == 0.0


def test_day_series_skips_malformed_rows():
    points = parse_views_by_day(
        {"rows": [["2026-09-01", 5], ["", 9], ["2026-09-02"]]}
    )
    assert [item["date"] for item in points] == ["2026-09-01"]
    assert points[0]["views"] == 5
