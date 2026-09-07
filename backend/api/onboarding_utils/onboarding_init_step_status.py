"""Init API: official step completion vs has_data (SSOT for all wizard steps)."""

from typing import Any, Dict, Optional

from services.onboarding.progress_utils import (
    is_connect_step_officially_complete,
    is_onboarding_step_officially_complete,
    is_personalization_step_officially_complete,
    is_research_step_officially_complete,
)


def build_step_status_entry(
    step_number: int,
    status: Dict[str, Any],
    *,
    step_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build one init step payload with separated has_data and official status."""
    has_data = step_data is not None
    if step_number == 1:
        step_completed = is_connect_step_officially_complete(status)
    elif step_number == 2:
        step_completed = is_research_step_officially_complete(status)
    elif step_number == 3:
        step_completed = is_personalization_step_officially_complete(status)
    elif step_number == 4:
        step_completed = is_onboarding_step_officially_complete(4, status)
    else:
        step_completed = False

    return {
        "step_number": step_number,
        "status": "completed" if step_completed else "pending",
        "has_data": has_data,
        "data": step_data,
    }


def has_website_analysis_data(website_analysis: Optional[Dict[str, Any]]) -> bool:
    website = website_analysis or {}
    return bool(website.get("website_url") or website.get("writing_style"))


def has_persona_data(persona_data: Optional[Dict[str, Any]]) -> bool:
    persona = persona_data or {}
    for key in ("corePersona", "core_persona", "platformPersonas", "platform_personas"):
        if key in persona and persona[key] is not None:
            return True
    return False
