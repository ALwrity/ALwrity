"""Unit tests for the scheduled-task status mapping.

Covers ``derive_ui_status``, the pure helper behind ``_task_status`` in
``endpoints_tasks.py``. The helper is intentionally free of heavy imports so
these tests run without the database/auth/model stack.
"""

from datetime import datetime

import pytest

from api.onboarding_utils.task_status import derive_ui_status

T = datetime(2026, 1, 1, 12, 0, 0)


@pytest.mark.parametrize(
    "raw_status, last_executed, last_success, expected_status, expected_pct",
    [
        # One-time task that completed normally.
        ("completed", None, None, "completed", 100),
        # Recurring task: 'active' but a prior run succeeded -> user-facing done.
        ("active", T, T, "completed", 100),
        # Recurring task with no explicit status but a successful run recorded.
        ("", T, T, "completed", 100),
        # Failure takes precedence over a stale last_success.
        ("failed", T, T, "failed", 0),
        ("needs_intervention", T, T, "failed", 0),
        # Literal 'running' (set mid-execution) -> running.
        ("running", None, None, "running", 50),
        # Recurring task in backoff: ran before but never succeeded -> running.
        ("active", T, None, "running", 50),
        # Never ran -> pending.
        ("active", None, None, "pending", 0),
        (None, None, None, "pending", 0),
        ("", None, None, "pending", 0),
    ],
)
def test_derive_ui_status(raw_status, last_executed, last_success, expected_status, expected_pct):
    status, pct = derive_ui_status(raw_status, last_executed, last_success)
    assert status == expected_status
    assert pct == expected_pct
