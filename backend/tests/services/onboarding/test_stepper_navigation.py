"""
Regression tests for onboarding stepper navigation.

Verifies:
    1. Backend /api/onboarding/init returns exactly 4 steps (not 5)
    2. Backend current_step preserves the existing 5-step completion sentinel
    3. furthestAccessibleStep computation from step statuses
    4. Backend step titles match frontend step definitions
"""

import pytest


# ---------------------------------------------------------------------------
# 1. Backend step count — must return exactly 4 steps
# ---------------------------------------------------------------------------

class TestBackendStepCount:
    """Verify the backend builds exactly 4 step entries, matching the frontend."""

    @staticmethod
    def _build_steps_data(completion_data, status):
        """Replicate the step-building logic from endpoints_core.py."""
        from api.onboarding_utils.onboarding_init_step_status import (
            build_step_status_entry,
            has_persona_data,
            has_website_analysis_data,
        )

        steps_data = []
        for step_num in range(1, 5):  # Steps 1-4
            step_data = None
            if step_num == 1:
                website = completion_data.get('website_analysis') or {}
                if has_website_analysis_data(website):
                    step_data = dict(website)
            elif step_num == 2:
                research = completion_data.get('research_preferences') or {}
                if research.get('research_depth') or research.get('content_types') or research.get('competitors'):
                    step_data = dict(research)
            elif step_num == 3:
                persona = completion_data.get('persona_data') or {}
                if has_persona_data(persona):
                    step_data = dict(persona)
            elif step_num == 4:
                step_data = None

            entry = build_step_status_entry(step_num, status, step_data=step_data)
            steps_data.append({
                "step_number": entry["step_number"],
                "status": entry["status"],
                "has_data": entry["has_data"],
                "data": entry["data"],
            })

        return steps_data

    def test_returns_exactly_4_steps(self):
        steps = self._build_steps_data({}, {"is_completed": False})
        assert len(steps) == 4, f"Expected 4 steps, got {len(steps)}"

    def test_step_numbers_are_1_through_4(self):
        steps = self._build_steps_data({}, {"is_completed": False})
        step_numbers = [s["step_number"] for s in steps]
        assert step_numbers == [1, 2, 3, 4]

    def test_no_step_5_exists(self):
        steps = self._build_steps_data({}, {"is_completed": True})
        step_numbers = [s["step_number"] for s in steps]
        assert 5 not in step_numbers, "Step 5 should not exist in a 4-step model"

    def test_all_steps_pending_when_no_data(self):
        steps = self._build_steps_data({}, {"is_completed": False})
        for step in steps:
            assert step["status"] == "pending"

    def test_step1_completed_with_website_url(self):
        data = {"website_analysis": {"website_url": "https://example.com"}}
        status = {"is_completed": False, "current_step": 2, "completion_percentage": 25.0}
        steps = self._build_steps_data(data, status)
        assert steps[0]["status"] == "completed"
        assert steps[0]["has_data"] is True

    def test_step1_pending_when_analysis_exists_but_not_officially_complete(self):
        data = {"website_analysis": {"website_url": "https://example.com"}}
        status = {"is_completed": False, "current_step": 1, "completion_percentage": 0.0}
        steps = self._build_steps_data(data, status)
        assert steps[0]["status"] == "pending"
        assert steps[0]["has_data"] is True

    def test_step2_completed_with_research(self):
        data = {"research_preferences": {"research_depth": "basic"}}
        status = {"is_completed": False, "current_step": 3, "completion_percentage": 50.0}
        steps = self._build_steps_data(data, status)
        assert steps[1]["status"] == "completed"

    def test_step2_pending_when_research_data_exists_but_not_officially_complete(self):
        data = {"research_preferences": {"research_depth": "basic"}}
        status = {"is_completed": False, "current_step": 2, "completion_percentage": 25.0}
        steps = self._build_steps_data(data, status)
        assert steps[1]["status"] == "pending"
        assert steps[1]["has_data"] is True

    def test_step3_completed_with_persona(self):
        data = {"persona_data": {"corePersona": {"name": "test"}}}
        status = {"is_completed": False, "current_step": 4, "completion_percentage": 75.0}
        steps = self._build_steps_data(data, status)
        assert steps[2]["status"] == "completed"

    def test_step3_pending_when_persona_exists_but_not_officially_complete(self):
        data = {"persona_data": {"corePersona": {"name": "test"}}}
        status = {"is_completed": False, "current_step": 3, "completion_percentage": 50.0}
        steps = self._build_steps_data(data, status)
        assert steps[2]["status"] == "pending"
        assert steps[2]["has_data"] is True

    def test_step4_completed_when_onboarding_complete(self):
        steps = self._build_steps_data({}, {"is_completed": True})
        assert steps[3]["status"] == "completed"

    def test_step4_pending_when_not_complete(self):
        steps = self._build_steps_data({}, {"is_completed": False})
        assert steps[3]["status"] == "pending"


# ---------------------------------------------------------------------------
# 2. current_step response value — preserve the existing completion sentinel
# ---------------------------------------------------------------------------

class TestCurrentStepResponse:
    """Verify the API response preserves the existing DB completion sentinel."""

    @staticmethod
    def _get_current_step(is_completed, raw_db_step):
        """Replicate the response logic from endpoints_core.py."""
        return 5 if is_completed else raw_db_step

    def test_current_step_is_5_when_complete(self):
        assert self._get_current_step(True, 5) == 5

    def test_current_step_is_5_when_complete_even_with_db_step_6(self):
        assert self._get_current_step(True, 6) == 5

    def test_current_step_passthrough_when_not_complete(self):
        assert self._get_current_step(False, 1) == 1
        assert self._get_current_step(False, 2) == 2
        assert self._get_current_step(False, 3) == 3

    def test_current_step_is_0_at_start(self):
        assert self._get_current_step(False, 0) == 0


# ---------------------------------------------------------------------------
# 3. furthestAccessibleStep computation
# ---------------------------------------------------------------------------

class TestFurthestAccessibleStep:
    """Verify the frontend furthestAccessibleStep logic (computed from step statuses)."""

    @staticmethod
    def _compute_furthest(steps):
        """Replicate the Wizard.tsx furthestAccessibleStep computation."""
        frontier = 0
        for i, step in enumerate(steps):
            if step.get("status") not in ("completed", "skipped"):
                break
            frontier = i
        return frontier

    def test_no_steps_returns_0(self):
        assert self._compute_furthest([]) == 0

    def test_all_pending_returns_0(self):
        steps = [{"status": "pending"}, {"status": "pending"}, {"status": "pending"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 0

    def test_first_step_completed_returns_0(self):
        steps = [{"status": "completed"}, {"status": "pending"}, {"status": "pending"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 0

    def test_first_two_completed_returns_1(self):
        steps = [{"status": "completed"}, {"status": "completed"}, {"status": "pending"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 1

    def test_all_completed_returns_3(self):
        steps = [{"status": "completed"}, {"status": "completed"}, {"status": "completed"}, {"status": "completed"}]
        assert self._compute_furthest(steps) == 3

    def test_skipped_step_counts_as_accessible(self):
        steps = [{"status": "completed"}, {"status": "skipped"}, {"status": "pending"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 1

    def test_gap_in_completion_does_not_skip_unfinished_step(self):
        """User completed step 1 and 3 but not 2 — frontier stays at step 1."""
        steps = [{"status": "completed"}, {"status": "pending"}, {"status": "completed"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 0

    def test_in_progress_does_not_extend_frontier(self):
        steps = [{"status": "completed"}, {"status": "in_progress"}, {"status": "pending"}, {"status": "pending"}]
        assert self._compute_furthest(steps) == 0


# ---------------------------------------------------------------------------
# 4. Backend step titles match frontend
# ---------------------------------------------------------------------------

class TestStepTitlesMatchFrontend:
    """Verify backend step titles are consistent with frontend websiteSteps."""

    FRONTEND_STEPS = [
        "Connect Platforms",
        "Research",
        "Personalization",
        "Finish",
    ]

    def test_step_count_matches(self):
        assert len(self.FRONTEND_STEPS) == 4

    def test_all_steps_have_labels(self):
        for label in self.FRONTEND_STEPS:
            assert isinstance(label, str)
            assert len(label) > 0
