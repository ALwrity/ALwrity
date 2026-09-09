"""Regression tests for onboarding progress SSOT after reset / fresh session."""

import pytest

from services.onboarding.progress_utils import (
    CONNECT_STEP_OFFICIAL_PROGRESS,
    compute_effective_progress,
    is_connect_step_officially_complete,
)


class TestComputeEffectiveProgress:
    def test_fresh_session_on_step_1_returns_zero(self):
        assert compute_effective_progress(current_step=1, stored_progress=0.0) == 0.0

    def test_soft_reset_at_step_zero_returns_zero(self):
        assert compute_effective_progress(current_step=0, stored_progress=0.0) == 0.0

    def test_after_connect_continue_current_step_2_returns_25(self):
        assert compute_effective_progress(current_step=2, stored_progress=0.0) == 25

    def test_trusts_persisted_progress_when_set(self):
        assert compute_effective_progress(current_step=1, stored_progress=25.0) == 25.0

    def test_migrated_user_on_step_3_without_progress_returns_50(self):
        assert compute_effective_progress(current_step=3, stored_progress=0.0) == 50


class TestStepOfficialCompletionThresholds:
    def test_research_requires_50_percent(self):
        from services.onboarding.progress_utils import is_research_step_officially_complete

        assert is_research_step_officially_complete(
            {"current_step": 2, "completion_percentage": 25.0}
        ) is False
        assert is_research_step_officially_complete(
            {"current_step": 3, "completion_percentage": 50.0}
        ) is True

    def test_personalization_requires_75_percent(self):
        from services.onboarding.progress_utils import is_personalization_step_officially_complete

        assert is_personalization_step_officially_complete(
            {"current_step": 3, "completion_percentage": 50.0}
        ) is False
        assert is_personalization_step_officially_complete(
            {"current_step": 4, "completion_percentage": 75.0}
        ) is True


class TestConnectStepOfficialCompletion:
    def test_analysis_only_session_is_not_officially_complete(self):
        status = {
            "current_step": 1,
            "completion_percentage": 0.0,
        }
        assert is_connect_step_officially_complete(status) is False

    def test_after_continue_is_officially_complete(self):
        status = {
            "current_step": 2,
            "completion_percentage": CONNECT_STEP_OFFICIAL_PROGRESS,
        }
        assert is_connect_step_officially_complete(status) is True
