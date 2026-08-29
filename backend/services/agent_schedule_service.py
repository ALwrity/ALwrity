"""Deterministic tenant-local schedule evaluation for agent committee runs."""

from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Any, Dict, Iterable, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _parse_time(value: Any) -> Optional[time]:
    if not value:
        return None
    try:
        hour, minute = str(value).strip().split(":", 1)
        return time(hour=int(hour), minute=int(minute))
    except (TypeError, ValueError):
        return None


def _date_values(values: Iterable[Any]) -> set[str]:
    return {str(value).strip() for value in values if str(value).strip()}


def evaluate_agent_schedule(
    agent_key: str,
    profile: Optional[Dict[str, Any]] = None,
    defaults: Optional[Dict[str, Any]] = None,
    tenant_timezone: str = "UTC",
    now: Optional[datetime] = None,
    manual_override: bool = False,
    tenant_pause: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Return eligibility and an explainable reason for one committee run."""
    profile = profile or {}
    defaults = defaults or {}
    schedule = profile.get("schedule") or defaults.get("schedule") or {"mode": "on_demand"}
    if isinstance(schedule, str):
        schedule = {"mode": schedule}
    schedule = dict(schedule)
    configured_enabled = profile.get("enabled")
    if configured_enabled is None:
        configured_enabled = defaults.get("enabled", True)
    considered = {
        "agent_key": agent_key,
        "enabled": bool(configured_enabled),
        "schedule": schedule,
        "schedule_considered": True,
        "timezone": tenant_timezone or "UTC",
        "manual_override": bool(manual_override),
    }

    if configured_enabled is False:
        return {**considered, "eligible": False, "reason": "agent profile is disabled"}

    try:
        zone = ZoneInfo(tenant_timezone or "UTC")
    except ZoneInfoNotFoundError:
        zone = timezone.utc
        considered["timezone"] = "UTC"
        considered["timezone_warning"] = f"invalid tenant timezone: {tenant_timezone}"
    current = (now or datetime.now(timezone.utc))
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    local_now = current.astimezone(zone)
    considered["local_datetime"] = local_now.isoformat()

    pause = tenant_pause or {}
    holiday_values = _date_values(
        list(schedule.get("holidays") or []) + list(pause.get("holidays") or [])
    )
    pause_until = schedule.get("pause_until") or pause.get("pause_until")
    paused = bool(schedule.get("paused") or pause.get("paused"))
    if pause_until:
        try:
            paused = paused or local_now.date() <= datetime.fromisoformat(str(pause_until)).date()
        except ValueError:
            considered["pause_warning"] = f"invalid pause_until: {pause_until}"
    if manual_override:
        return {**considered, "eligible": True, "reason": "manual Run now override"}
    if paused:
        return {**considered, "eligible": False, "reason": "agent or tenant schedule is paused"}
    if local_now.date().isoformat() in holiday_values:
        return {**considered, "eligible": False, "reason": "tenant holiday"}

    mode = str(schedule.get("mode") or "on_demand").strip().lower().replace("-", "_")
    if mode in {"on_demand", "ondemand"}:
        return {**considered, "eligible": False, "reason": "on-demand agent requires an explicit request"}
    if mode not in {"daily", "weekly"}:
        return {**considered, "eligible": False, "reason": f"unsupported schedule mode: {mode}"}
    if mode == "weekly":
        configured_days = {day[:3].lower() for day in schedule.get("days") or []}
        if local_now.strftime("%a").lower()[:3] not in configured_days:
            return {**considered, "eligible": False, "reason": "today is not in the weekly schedule"}
    scheduled_time = _parse_time(schedule.get("time"))
    if scheduled_time and local_now.time().replace(second=0, microsecond=0) < scheduled_time:
        return {**considered, "eligible": False, "reason": "scheduled time has not arrived"}
    return {**considered, "eligible": True, "reason": f"{mode} schedule is active"}
