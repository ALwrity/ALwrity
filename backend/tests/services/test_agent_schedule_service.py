from datetime import datetime, timezone

from services.agent_schedule_service import evaluate_agent_schedule


def test_weekly_friday_agent_is_skipped_on_monday_in_tenant_timezone():
    friday_schedule = {"mode": "weekly", "days": ["fri"], "time": "09:00"}
    monday = datetime(2026, 8, 24, 15, 0, tzinfo=timezone.utc)

    result = evaluate_agent_schedule(
        "seo_specialist",
        defaults={"enabled": True, "schedule": friday_schedule},
        tenant_timezone="America/New_York",
        now=monday,
    )

    assert result["eligible"] is False
    assert result["reason"] == "today is not in the weekly schedule"
    assert result["schedule_considered"] is True


def test_disabled_agent_stays_disabled_even_with_manual_override():
    result = evaluate_agent_schedule(
        "seo_specialist",
        profile={"enabled": False, "schedule": {"mode": "daily"}},
        tenant_timezone="UTC",
        manual_override=True,
    )

    assert result["eligible"] is False
    assert result["reason"] == "agent profile is disabled"


def test_on_demand_agent_requires_explicit_run_now():
    schedule = {"mode": "on_demand"}
    normal = evaluate_agent_schedule("competitor_analyst", defaults={"schedule": schedule}, now=datetime.now(timezone.utc))
    manual = evaluate_agent_schedule("competitor_analyst", defaults={"schedule": schedule}, now=datetime.now(timezone.utc), manual_override=True)

    assert normal["eligible"] is False
    assert "explicit request" in normal["reason"]
    assert manual["eligible"] is True
    assert manual["reason"] == "manual Run now override"


def test_pause_and_holiday_are_skipped_without_override():
    current = datetime(2026, 8, 24, 15, 0, tzinfo=timezone.utc)
    paused = evaluate_agent_schedule(
        "content_strategist",
        defaults={"schedule": {"mode": "daily"}},
        tenant_timezone="UTC",
        now=current,
        tenant_pause={"paused": True},
    )
    holiday = evaluate_agent_schedule(
        "content_strategist",
        defaults={"schedule": {"mode": "daily", "holidays": ["2026-08-24"]}},
        tenant_timezone="UTC",
        now=current,
    )

    assert paused["reason"] == "agent or tenant schedule is paused"
    assert holiday["reason"] == "tenant holiday"


def test_daily_schedule_respects_tenant_local_time():
    before = datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
    after = datetime(2026, 8, 24, 14, 0, tzinfo=timezone.utc)
    schedule = {"mode": "daily", "time": "09:00"}

    before_result = evaluate_agent_schedule("content_strategist", defaults={"schedule": schedule}, tenant_timezone="America/New_York", now=before)
    after_result = evaluate_agent_schedule("content_strategist", defaults={"schedule": schedule}, tenant_timezone="America/New_York", now=after)

    assert before_result["eligible"] is False
    assert after_result["eligible"] is True
