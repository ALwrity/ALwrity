"""Tests for official vs has_data status on init steps 1–3."""

from api.onboarding_utils.onboarding_init_step_status import (
    build_step_status_entry,
    has_persona_data,
    has_website_analysis_data,
)
from services.onboarding.progress_utils import (
    is_personalization_step_officially_complete,
    is_research_step_officially_complete,
)


class TestInitStepOfficialStatus:
    def test_step1_analysis_without_continue_is_pending_with_data(self):
        step = build_step_status_entry(
            1,
            {"current_step": 1, "completion_percentage": 0.0},
            step_data={"website_url": "https://example.com"},
        )
        assert step["status"] == "pending"
        assert step["has_data"] is True

    def test_step1_after_continue_is_completed(self):
        step = build_step_status_entry(
            1,
            {"current_step": 2, "completion_percentage": 25.0},
            step_data={"website_url": "https://example.com"},
        )
        assert step["status"] == "completed"

    def test_step2_research_data_without_continue_is_pending_with_data(self):
        step = build_step_status_entry(
            2,
            {"current_step": 2, "completion_percentage": 25.0},
            step_data={"competitors": [{"url": "https://rival.com"}]},
        )
        assert step["status"] == "pending"
        assert step["has_data"] is True
        assert is_research_step_officially_complete(
            {"current_step": 2, "completion_percentage": 25.0}
        ) is False

    def test_step2_after_continue_is_completed(self):
        step = build_step_status_entry(
            2,
            {"current_step": 3, "completion_percentage": 50.0},
            step_data={"competitors": []},
        )
        assert step["status"] == "completed"

    def test_step3_persona_without_continue_is_pending_with_data(self):
        step = build_step_status_entry(
            3,
            {"current_step": 3, "completion_percentage": 50.0},
            step_data={"corePersona": {"name": "Test"}},
        )
        assert step["status"] == "pending"
        assert step["has_data"] is True
        assert is_personalization_step_officially_complete(
            {"current_step": 3, "completion_percentage": 50.0}
        ) is False

    def test_step3_after_continue_is_completed(self):
        step = build_step_status_entry(
            3,
            {"current_step": 4, "completion_percentage": 75.0},
            step_data={"corePersona": {"name": "Test"}},
        )
        assert step["status"] == "completed"


class TestInitStepDataHelpers:
    def test_has_website_analysis_data(self):
        assert has_website_analysis_data({"website_url": "https://a.com"}) is True
        assert has_website_analysis_data({}) is False

    def test_has_persona_data(self):
        assert has_persona_data({"corePersona": {}}) is True
        assert has_persona_data({}) is False
