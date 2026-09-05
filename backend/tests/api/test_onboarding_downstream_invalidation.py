"""Tests for downstream onboarding invalidation when website analysis changes."""

from unittest.mock import MagicMock, patch

import pytest

from api.onboarding_utils.onboarding_downstream_invalidation import (
    invalidate_downstream_onboarding_steps,
)


@pytest.fixture
def mock_db_session():
    session = MagicMock()
    onboarding_session = MagicMock()
    onboarding_session.id = 42
    onboarding_session.current_step = 3
    onboarding_session.progress = 75.0

    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.first.return_value = onboarding_session
    query.delete.return_value = 2

    session.query.return_value = query
    return session, onboarding_session


def test_invalidate_downstream_clears_records_and_resets_progress(mock_db_session):
    db, onboarding_session = mock_db_session

    with patch(
        "api.onboarding_utils.onboarding_downstream_invalidation.get_session_for_user",
        return_value=db,
    ), patch(
        "api.onboarding_utils.onboarding_downstream_invalidation.OnboardingProgressService"
    ) as progress_cls:
        progress_cls.return_value._cancel_scheduled_tasks.return_value = None

        result = invalidate_downstream_onboarding_steps(
            "user-123",
            website_url="https://example.com",
            reason="reanalyze",
        )

    assert result["success"] is True
    assert result["progress_reset"] is True
    assert result["deleted"]["competitors"] == 2
    assert onboarding_session.current_step == 1
    assert onboarding_session.progress == 0.0
    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_invalidate_downstream_no_session_is_noop():
    db = MagicMock()
    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    query.first.return_value = None
    db.query.return_value = query

    with patch(
        "api.onboarding_utils.onboarding_downstream_invalidation.get_session_for_user",
        return_value=db,
    ):
        result = invalidate_downstream_onboarding_steps("user-456")

    assert result["success"] is True
    assert result["progress_reset"] is False
    db.commit.assert_not_called()
