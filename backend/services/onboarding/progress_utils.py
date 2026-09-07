"""Pure helpers for onboarding session progress (testable without DB)."""

TOTAL_ONBOARDING_STEPS = 4

# Matches frontend complete_step: round(step_number / totalSteps * 100).
CONNECT_STEP_OFFICIAL_PROGRESS = 25
RESEARCH_STEP_OFFICIAL_PROGRESS = 50
PERSONALIZATION_STEP_OFFICIAL_PROGRESS = 75
FINISH_STEP_OFFICIAL_PROGRESS = 100

_STEP_PROGRESS_THRESHOLD = {
    1: CONNECT_STEP_OFFICIAL_PROGRESS,
    2: RESEARCH_STEP_OFFICIAL_PROGRESS,
    3: PERSONALIZATION_STEP_OFFICIAL_PROGRESS,
    4: FINISH_STEP_OFFICIAL_PROGRESS,
}

# After completing step N via Continue, current_step becomes N + 1.
_MIN_CURRENT_STEP_AFTER_COMPLETE = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
}


def compute_effective_progress(current_step: int, stored_progress: float) -> float:
    """
    Derive completion percentage from session fields.

    ``current_step`` is the *next* step index (1-based): 1 = on Connect Platforms,
    2 = Connect officially done, etc. ``stored_progress`` is persisted ``session.progress``
    from explicit ``complete_step`` calls.
    """
    if stored_progress and stored_progress > 0:
        return min(100.0, float(stored_progress))

    if current_step <= 0:
        return 0.0

    completed_steps = max(0, current_step - 1)
    if completed_steps <= 0:
        return 0.0

    return min(
        100.0,
        round((completed_steps / TOTAL_ONBOARDING_STEPS) * 100),
    )


def is_onboarding_step_officially_complete(step_number: int, status: dict) -> bool:
    """True only after the user completed a wizard step via Continue."""
    if step_number not in _STEP_PROGRESS_THRESHOLD:
        return False

    progress = float(status.get("completion_percentage") or 0)
    current_step = int(status.get("current_step") or 0)
    min_step = _MIN_CURRENT_STEP_AFTER_COMPLETE[step_number]
    threshold = _STEP_PROGRESS_THRESHOLD[step_number]

    if step_number == 4:
        return bool(status.get("is_completed")) or progress >= threshold or current_step >= min_step

    return progress >= threshold or current_step >= min_step


def is_connect_step_officially_complete(status: dict) -> bool:
    return is_onboarding_step_officially_complete(1, status)


def is_research_step_officially_complete(status: dict) -> bool:
    return is_onboarding_step_officially_complete(2, status)


def is_personalization_step_officially_complete(status: dict) -> bool:
    return is_onboarding_step_officially_complete(3, status)
