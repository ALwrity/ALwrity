"""Overview Analytics windows: rolling, calendar, custom, lifetime. No fake 2005 start."""

from datetime import date, timedelta

from services.youtube.youtube_analytics_overview_window import (
    OverviewWindowError,
    lifetime_bounds,
    month_bounds,
    previous_month_bounds,
    previous_rolling_bounds,
    previous_year_ytd_bounds,
    resolve_overview_query,
    rolling_bounds,
    year_bounds,
)

TODAY = date(2026, 9, 8)


def test_rolling_365_matches_previous_365_days():
    start, end = rolling_bounds(365, TODAY)
    assert end == TODAY
    assert start == TODAY - timedelta(days=365)
    prev_start, prev_end = previous_rolling_bounds(start, 365)
    assert prev_end == start - timedelta(days=1)
    assert prev_start == prev_end - timedelta(days=365)


def test_year_2026_ytd_and_previous_year_ytd():
    start, end = year_bounds(2026, TODAY)
    assert start == date(2026, 1, 1)
    assert end == TODAY
    prev_start, prev_end = previous_year_ytd_bounds(start, end)
    assert prev_start == date(2025, 1, 1)
    assert prev_end == date(2025, 9, 8)


def test_september_month_and_previous_august():
    start, end = month_bounds(2026, 9, TODAY)
    assert start == date(2026, 9, 1)
    assert end == TODAY
    prev_start, prev_end = previous_month_bounds(start)
    assert prev_start == date(2026, 8, 1)
    assert prev_end == date(2026, 8, 31)


def test_lifetime_uses_channel_published_at_not_2005():
    start, end = lifetime_bounds("2024-03-15T12:00:00Z", TODAY)
    assert start == date(2024, 3, 15)
    assert end == TODAY
    assert start.year != 2005


def test_lifetime_without_published_at_raises():
    try:
        lifetime_bounds(None, TODAY)
        assert False, "expected OverviewWindowError"
    except OverviewWindowError as exc:
        assert exc.error_code == "analytics_unavailable"


def test_custom_future_end_is_invalid():
    try:
        resolve_overview_query(
            window="calendar",
            days=None,
            start_date=date(2026, 9, 1),
            end_date=date(2026, 9, 9),
            today=TODAY,
        )
        assert False, "expected OverviewWindowError"
    except OverviewWindowError as exc:
        assert exc.error_code == "window_invalid"


def test_custom_span_over_365_is_invalid():
    try:
        resolve_overview_query(
            window="calendar",
            days=None,
            start_date=date(2025, 1, 1),
            end_date=date(2026, 1, 2),
            today=TODAY,
        )
        assert False, "expected OverviewWindowError"
    except OverviewWindowError as exc:
        assert exc.error_code == "window_invalid"


def test_mixing_days_and_custom_dates_is_invalid():
    try:
        resolve_overview_query(
            window=None,
            days=28,
            start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 31),
            today=TODAY,
        )
        assert False, "expected OverviewWindowError"
    except OverviewWindowError as exc:
        assert exc.error_code == "window_invalid"


def test_default_query_is_last_28_days():
    resolved = resolve_overview_query(
        window=None,
        days=None,
        start_date=None,
        end_date=None,
        today=TODAY,
    )
    assert resolved["kind"] == "last_28"
    assert resolved["window_days"] == 28
    assert resolved["compare"] is True


def test_last_365_window_matches_days():
    resolved = resolve_overview_query(
        window="last_365",
        days=365,
        start_date=None,
        end_date=None,
        today=TODAY,
    )
    assert resolved["kind"] == "last_365"
    assert resolved["window_days"] == 365
    assert resolved["end"] == TODAY
    assert resolved["start"] == TODAY - timedelta(days=365)


def test_calendar_custom_range_is_valid():
    resolved = resolve_overview_query(
        window="calendar",
        days=None,
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 31),
        today=TODAY,
    )
    assert resolved["kind"] == "calendar"
    assert resolved["start"] == date(2026, 8, 1)
    assert resolved["end"] == date(2026, 8, 31)
    assert resolved["compare"] is True


def test_lifetime_query_defers_until_channel_published_at():
    resolved = resolve_overview_query(
        window="lifetime",
        days=None,
        start_date=None,
        end_date=None,
        today=TODAY,
    )
    assert resolved["kind"] == "lifetime"
    assert resolved["needs_published_at"] is True
    assert resolved["compare"] is False
