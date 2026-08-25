"""Calendar event → workflow task mapping utilities.

Extracted from today_workflow_service.py (Phase 1 refactoring).
All public names are re-exported from the original module to preserve
import paths and monkeypatch compatibility.
"""
from typing import Any, Dict

from loguru import logger


# Calendar → Workflow mapping. Previously every calendar event was
# bucketed under the "generate" pillar regardless of content type,
# which made LinkedIn posts look like generic content generation
# and SEO audits look like content drafts. Each entry maps a
# content_type (or platform) to the lifecycle pillar the task
# actually belongs to.
#
# Resolution order in _resolve_calendar_pillar():
#   1. content_type (e.g. "blog_post", "linkedin_post")
#   2. platform fallback (e.g. "linkedin" → "engage")
#   3. default ("generate") so unmapped events still get a pillar
_CALENDAR_CONTENT_PILLAR = {
    # Content creation → generate
    "blog_post": "generate",
    "video": "generate",
    "podcast": "generate",
    # Distribution → engage / publish
    "linkedin_post": "engage",
    "facebook_post": "engage",
    "twitter_post": "engage",
    "instagram_post": "engage",
    "tiktok_post": "engage",
    # SEO → analyze
    "seo_page": "analyze",
    # Direct publishing → publish
    "youtube": "publish",
}

_CALENDAR_PLATFORM_PILLAR = {
    "linkedin": "engage",
    "facebook": "engage",
    "twitter": "engage",
    "instagram": "engage",
    "tiktok": "engage",
    "youtube": "publish",
}

CALENDAR_DEFAULT_PILLAR = "generate"

_PLATFORM_ACTION_URL = {
    "linkedin": "/linkedin-studio",
    "facebook": "/facebook-writer",
    "twitter": "/twitter-writer",
    "instagram": "/instagram-writer",
    "youtube": "/youtube-writer",
    "tiktok": "/tiktok-writer",
}

_CONTENT_ACTION_URL = {
    "blog_post": "/blog-writer",
    "linkedin_post": "/linkedin-studio",
    "facebook_post": "/facebook-writer",
    "seo_page": "/seo-dashboard",
    "video": "/video-writer",
}

_CONTENT_ESTIMATED_TIME = {
    "blog_post": 45, "linkedin_post": 20, "facebook_post": 15,
    "twitter_post": 10, "instagram_post": 15, "seo_page": 30, "video": 60,
}

# Generic fallback URL for any calendar event whose content_type / platform
# does not match a known writer. Prevents the event from being silently
# dropped from the daily plan.
_GENERIC_FALLBACK_ACTION_URL = "/content-planning"


def _resolve_calendar_pillar(content_type: str, platform: str) -> str:
    """Pick the right workflow pillar for a calendar event.

    Resolution order:
      1. ``_CALENDAR_CONTENT_PILLAR`` by content_type
      2. ``_CALENDAR_PLATFORM_PILLAR`` by platform
      3. ``CALENDAR_DEFAULT_PILLAR`` (generate) as a safe fallback
    """
    ct_lower = (content_type or "").strip().lower()
    if ct_lower in _CALENDAR_CONTENT_PILLAR:
        return _CALENDAR_CONTENT_PILLAR[ct_lower]
    p_lower = (platform or "").strip().lower()
    if p_lower in _CALENDAR_PLATFORM_PILLAR:
        return _CALENDAR_PLATFORM_PILLAR[p_lower]
    return CALENDAR_DEFAULT_PILLAR


def _resolve_calendar_action_url(content_type: str, platform: str) -> str:
    platform_lower = (platform or "").strip().lower()
    if platform_lower in _PLATFORM_ACTION_URL:
        return _PLATFORM_ACTION_URL[platform_lower]
    ct_lower = (content_type or "").strip().lower()
    if ct_lower in _CONTENT_ACTION_URL:
        return _CONTENT_ACTION_URL[ct_lower]
    logger.warning(
        "No action_url mapping for calendar event content_type={!r} platform={!r} — falling back to {}",
        content_type, platform, _GENERIC_FALLBACK_ACTION_URL,
    )
    return _GENERIC_FALLBACK_ACTION_URL


def _resolve_calendar_estimated_time(content_type: str) -> int:
    return _CONTENT_ESTIMATED_TIME.get((content_type or "").strip().lower(), 30)


def _generate_calendar_event_plan(date: str, grounding: Dict[str, Any]) -> Dict[str, Any]:
    calendar_events = grounding.get("calendar_events_today", [])
    if not calendar_events:
        return {"date": date, "tasks": []}

    tasks = []
    for event in calendar_events:
        content_type = event.get("content_type", "")
        platform = event.get("platform", "")
        action_url = _resolve_calendar_action_url(content_type, platform)
        pillar_id = _resolve_calendar_pillar(content_type, platform)

        task = {
            "pillarId": pillar_id,
            "title": (event.get("title") or "Untitled").strip()[:255],
            "description": (event.get("description") or "").strip(),
            "priority": "high",
            "estimatedTime": _resolve_calendar_estimated_time(content_type),
            # Existing calendar entries are opened, never inserted again.
            "actionType": "navigate",
            "actionUrl": action_url,
            "kpi": event.get("kpi"),
            "deadline": event.get("deadline"),
            "evidence": event.get("evidence") or [f"calendar_event:{event.get('id')}"],
            "expectedImpact": event.get("expected_outcome") or event.get("description"),
            "enabled": True,
            "dependencies": [],
            "metadata": {
                "source": "calendar_event",
                # Calendar tasks are derived deterministically from the
                # user's own scheduled events, not generated.
                "synthesis_mode": "data_derived",
                "source_event_id": event.get("id"),
                "calendar_event_id": event.get("id"),
                "calendar_title": event.get("title"),
                "content_type": event.get("content_type"),
                "platform": event.get("platform"),
                "owner_agent": event.get("owner_agent") or "calendar",
                "recommendation_id": event.get("recommendation_id") or f"calendar-event:{event.get('id')}",
                "task_id": event.get("task_id"),
                "meeting_id": event.get("meeting_id"),
                "kpi": event.get("kpi"),
                "deadline": event.get("deadline"),
                "action_type": event.get("action_type") or "navigate",
                "action_parameters": event.get("action_parameters") or {"calendar_event_id": event.get("id")},
                "evidence": event.get("evidence") or [f"calendar_event:{event.get('id')}"],
                "expected_outcome": event.get("expected_outcome") or event.get("description"),
                "user_approval_state": event.get("user_approval_state") or "pending",
                "user_timezone": event.get("user_timezone") or "UTC",
            },
        }
        tasks.append(task)

    return {"date": date, "tasks": tasks}
