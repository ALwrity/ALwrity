"""Phase 2: Verify _global_orchestrator_sessions cleans up across ALL users."""

from datetime import datetime, timedelta


def _cleanup_old_sessions(orchestrator_sessions: dict, requesting_user_id: str) -> list:
    """Mirror of CalendarGenerationService._cleanup_old_sessions.

    Phase 2 fix: prune sessions from ALL users, not just the requesting user.
    Returns list of removed session IDs for assertion convenience.
    """
    current_time = datetime.now()
    sessions_to_remove = []

    for session_id, session_data in orchestrator_sessions.items():
        start_time = session_data.get("start_time")
        if not start_time:
            continue

        age_seconds = (current_time - start_time).total_seconds()

        # Remove sessions older than 1 hour regardless of user
        if age_seconds > 3600:
            sessions_to_remove.append(session_id)
            continue

        # Also remove completed/error/cancelled sessions older than 10 minutes
        if session_data.get("status") in ("completed", "error", "cancelled"):
            if age_seconds > 600:
                sessions_to_remove.append(session_id)

    for session_id in sessions_to_remove:
        del orchestrator_sessions[session_id]

    return sessions_to_remove


# ---------- tests ----------


def test_cleans_up_own_user_old_sessions():
    now = datetime.now()
    sessions = {
        "s1": {"user_id": "user_A", "status": "running", "start_time": now - timedelta(hours=2)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    assert "s1" in removed
    assert "s1" not in sessions


def test_cleans_up_other_user_old_sessions():
    """Phase 2 fix: sessions from OTHER users should also be cleaned up."""
    now = datetime.now()
    sessions = {
        "s1": {"user_id": "user_B", "status": "running", "start_time": now - timedelta(hours=3)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    assert "s1" in removed
    assert "s1" not in sessions


def test_keeps_recent_sessions_from_any_user():
    now = datetime.now()
    sessions = {
        "s1": {"user_id": "user_A", "status": "running", "start_time": now - timedelta(minutes=5)},
        "s2": {"user_id": "user_B", "status": "running", "start_time": now - timedelta(minutes=10)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    assert len(removed) == 0
    assert "s1" in sessions
    assert "s2" in sessions


def test_cleans_completed_sessions_older_than_10min():
    now = datetime.now()
    sessions = {
        "s1": {"user_id": "user_A", "status": "completed", "start_time": now - timedelta(minutes=15)},
        "s2": {"user_id": "user_B", "status": "error", "start_time": now - timedelta(minutes=20)},
        "s3": {"user_id": "user_C", "status": "cancelled", "start_time": now - timedelta(minutes=12)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    assert len(removed) == 3
    assert len(sessions) == 0


def test_keeps_recent_completed_sessions():
    now = datetime.now()
    sessions = {
        "s1": {"user_id": "user_A", "status": "completed", "start_time": now - timedelta(minutes=5)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    assert len(removed) == 0
    assert "s1" in sessions


def test_handles_empty_sessions():
    sessions = {}
    removed = _cleanup_old_sessions(sessions, "user_A")
    assert removed == []


def test_mixed_old_and_new_sessions():
    """Mix of old/new, different users, different statuses — only appropriate ones removed."""
    now = datetime.now()
    sessions = {
        "old_running_A": {"user_id": "A", "status": "running", "start_time": now - timedelta(hours=2)},
        "new_running_A": {"user_id": "A", "status": "running", "start_time": now - timedelta(minutes=5)},
        "old_running_B": {"user_id": "B", "status": "running", "start_time": now - timedelta(hours=5)},
        "old_completed_B": {"user_id": "B", "status": "completed", "start_time": now - timedelta(minutes=15)},
        "new_completed_C": {"user_id": "C", "status": "completed", "start_time": now - timedelta(minutes=3)},
    }

    removed = _cleanup_old_sessions(sessions, "user_A")

    # old_running_A (>1h), old_running_B (>1h), old_completed_B (>10min completed) removed
    assert set(removed) == {"old_running_A", "old_running_B", "old_completed_B"}
    assert "new_running_A" in sessions
    assert "new_completed_C" in sessions
