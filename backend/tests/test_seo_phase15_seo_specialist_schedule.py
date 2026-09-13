"""
Phase 15 (plan Phase D slice 4) — SEO specialist runs daily.

The seo_specialist catalog default was weekly-Friday, which meant the
now-informed SEO specialist only contributed to the daily committee once a
week. It is now daily (11:00), matching the daily-workflow cadence; the
task prompt is updated accordingly.

The schedule evaluator's own daily/time semantics are exercised too, so this
pins behavior (not just the config string).
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG
from services.agent_schedule_service import evaluate_agent_schedule


def _entry():
    return next(e for e in AGENT_TEAM_CATALOG if e.get("agent_key") == "seo_specialist")


def test_seo_specialist_default_schedule_is_daily():
    schedule = _entry()["defaults"]["schedule"]
    assert schedule["mode"] == "daily"
    assert schedule.get("days") in (None, []), "daily schedule must not restrict weekdays"


def test_monday_after_scheduled_time_is_eligible():
    # 2026-09-14 is a Monday — under the old weekly-Friday default this would
    # have been ineligible; daily must be eligible.
    result = evaluate_agent_schedule(
        "seo_specialist",
        profile=None,
        defaults=_entry()["defaults"],
        now=datetime(2026, 9, 14, 12, 0, tzinfo=timezone.utc),
    )
    assert result["eligible"] is True


def test_monday_before_scheduled_time_is_blocked_only_by_time():
    result = evaluate_agent_schedule(
        "seo_specialist",
        profile=None,
        defaults=_entry()["defaults"],
        now=datetime(2026, 9, 14, 9, 0, tzinfo=timezone.utc),
    )
    assert result["eligible"] is False
    assert "time" in result["reason"]


def test_task_prompt_is_daily_aligned():
    prompt = _entry()["defaults"]["task_prompt_template"].lower()
    assert "daily" in prompt
    assert "weekly" not in prompt
