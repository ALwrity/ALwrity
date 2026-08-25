"""Validation and metadata helpers for workflow-backed calendar insertion."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


SUPPORTED_CONTENT_TYPES = {"blog_post", "article", "video", "social_post", "newsletter", "seo_page"}


def normalize_scheduled_date(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """Interpret legacy naive dates in the declared user timezone."""
    scheduled_date = event_data.get("scheduled_date")
    if not isinstance(scheduled_date, datetime) or scheduled_date.tzinfo is not None:
        return event_data
    try:
        zone = ZoneInfo(str(event_data.get("user_timezone") or "UTC"))
    except ZoneInfoNotFoundError:
        zone = timezone.utc
    return {**event_data, "scheduled_date": scheduled_date.replace(tzinfo=zone)}


def validate_calendar_insertion(event_data: Dict[str, Any], db: Any, require_contract: bool = False) -> List[str]:
    errors: List[str] = []
    user_id = str(event_data.get("user_id") or "").strip()
    if not user_id:
        errors.append("user_id is required")
    try:
        strategy_id = int(event_data.get("strategy_id"))
    except (TypeError, ValueError):
        strategy_id = None
        errors.append("strategy_id is required")
    if strategy_id is not None and db is not None:
        from models.content_planning import ContentStrategy
        strategy = (db.query(ContentStrategy)
                    .filter(ContentStrategy.id == strategy_id, ContentStrategy.user_id == user_id)
                    .first())
        if strategy is None:
            errors.append("strategy does not belong to this user")
    if event_data.get("task_id") is not None and db is not None:
        try:
            from models.daily_workflow_models import DailyWorkflowTask
            task = (db.query(DailyWorkflowTask)
                    .filter(DailyWorkflowTask.id == event_data.get("task_id"), DailyWorkflowTask.user_id == user_id)
                    .first())
            if task is None:
                errors.append("task does not belong to this user")
        except Exception:
            errors.append("workflow task ownership could not be verified")
    content_type = str(event_data.get("content_type") or "").strip().lower()
    platform = str(event_data.get("platform") or "").strip().lower()
    if content_type not in SUPPORTED_CONTENT_TYPES:
        errors.append(f"unsupported content_type: {content_type or 'missing'}")
    if not platform:
        errors.append("platform is required")
    if not str(event_data.get("title") or "").strip() or not str(event_data.get("description") or "").strip():
        errors.append("title and description are required content inputs")
    if not event_data.get("scheduled_date"):
        errors.append("scheduled_date is required")
    if require_contract:
        for field in ("owner_agent", "recommendation_id", "task_id", "kpi", "deadline", "action_type", "evidence", "expected_outcome"):
            if event_data.get(field) in (None, "", []):
                errors.append(f"{field} is required for workflow-backed insertion")
        if not isinstance(event_data.get("action_parameters"), dict):
            errors.append("action_parameters must be an object for workflow-backed insertion")
        available_platforms = event_data.get("available_platforms")
        if isinstance(available_platforms, (list, tuple, set)) and platform not in {str(item).lower() for item in available_platforms}:
            errors.append(f"platform is not available: {platform}")
        elif db is not None:
            try:
                from models.onboarding import OnboardingSession, PlatformIntegration
                integration = (db.query(PlatformIntegration)
                               .join(OnboardingSession, PlatformIntegration.session_id == OnboardingSession.id)
                               .filter(OnboardingSession.user_id == user_id)
                               .first())
                if integration is None:
                    errors.append("platform availability could not be verified")
                else:
                    connected = {str(item).lower() for item in (integration.connected_platforms or [])}
                    configured = set(connected)
                    for field in ("website_platforms", "analytics_platforms", "social_platforms"):
                        values = getattr(integration, field, {}) or {}
                        if isinstance(values, dict):
                            configured.update(str(key).lower() for key, value in values.items() if value)
                    if platform == "website" and integration.primary_website:
                        configured.add("website")
                    if platform not in configured:
                        errors.append(f"platform is not available: {platform}")
            except Exception:
                errors.append("platform availability could not be verified")
    user_timezone = str(event_data.get("user_timezone") or "UTC")
    try:
        ZoneInfo(user_timezone)
    except ZoneInfoNotFoundError:
        errors.append(f"invalid user timezone: {user_timezone}")
    if str(event_data.get("action_type") or "").lower() in {"publish", "auto_publish"}:
        errors.append("calendar insertion cannot publish automatically")
    if str(event_data.get("status") or "draft").lower() == "published":
        errors.append("calendar insertion cannot create a published event")
    return errors


def calendar_contract_metadata(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """Return persisted lineage fields without adding a publish side effect."""
    return {
        "owner_agent": event_data.get("owner_agent"),
        "recommendation_id": event_data.get("recommendation_id"),
        "task_id": event_data.get("task_id"),
        "meeting_id": event_data.get("meeting_id"),
        "kpi": event_data.get("kpi"),
        "deadline": event_data.get("deadline"),
        "action_type": event_data.get("action_type") or "calendar_insert",
        "action_parameters": event_data.get("action_parameters") or {},
        "evidence": event_data.get("evidence") or [],
        "expected_outcome": event_data.get("expected_outcome"),
        "user_approval_state": event_data.get("user_approval_state") or "pending",
        "user_timezone": event_data.get("user_timezone") or "UTC",
    }
