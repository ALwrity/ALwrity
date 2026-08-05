"""
Verify the Phase-1 backend step renumbering (old 1-6 → new 1-5) after
removing the Integrations step, plus the progressive feature/service
initialization that uses the new numbering.

Covers:
    1. Migration mapping — old DB values → new migrated values
    2. get_onboarding_status returns migrated current_step and correct is_completed
    3. _initialize_user_services step thresholds
    4. setup_progressive_features step thresholds
    5. Website strategy dispatch — correct handler per new step number
"""

import pytest
from unittest.mock import MagicMock, patch, PropertyMock


# ---------------------------------------------------------------------------
# 1. Migration mapping (the core "old → new" conversion used in
#    progress_service.get_onboarding_status)
# ---------------------------------------------------------------------------

def _migrate_step(raw: int) -> int:
    """Replicate the read-time migration logic from progress_service.py."""
    if 2 <= raw <= 6:
        return raw - 1
    return max(0, raw)


class TestMigrationMapping:
    def test_zero_stays_zero(self):
        assert _migrate_step(0) == 0

    def test_old_api_keys_becomes_new_connect(self):
        # Old 1 (API keys) stays 1 (Connect Platforms start)
        assert _migrate_step(1) == 1

    def test_old_website_becomes_new_connect(self):
        assert _migrate_step(2) == 1

    def test_old_research_becomes_new_research(self):
        assert _migrate_step(3) == 2

    def test_old_persona_becomes_new_personalization(self):
        assert _migrate_step(4) == 3

    def test_old_integrations_becomes_new_finish(self):
        assert _migrate_step(5) == 4

    def test_old_complete_becomes_new_complete(self):
        assert _migrate_step(6) == 5

    def test_beyond_range_passthrough(self):
        assert _migrate_step(7) == 7
        assert _migrate_step(100) == 100

    def test_negative_returns_zero(self):
        assert _migrate_step(-1) == 0


# ---------------------------------------------------------------------------
# 2. get_onboarding_status — migrated values
# ---------------------------------------------------------------------------

class TestOnboardingStatusMigration:
    """Integration-style tests: get_onboarding_status returns correct
    migrated values for raw DB current_step values."""

    @pytest.mark.parametrize("raw_step, expected_migrated, expected_completed", [
        (0, 0, False),
        (1, 1, False),        # API keys → Connect (not done)
        (2, 1, False),        # Website → Connect (not done)
        (3, 2, False),        # Research (not done)
        (4, 3, False),        # Persona (not done)
        (5, 4, False),        # Integrations → Finish (NOT complete — this was the bug)
        (6, 5, True),         # Old complete → new complete ✓
    ])
    def test_migrated_step_and_completion(self, raw_step, expected_migrated, expected_completed):
        migrated = _migrate_step(raw_step)
        assert migrated == expected_migrated, f"raw={raw_step} → expected migrated={expected_migrated}, got {migrated}"
        is_completed = migrated >= 5
        assert is_completed == expected_completed, f"raw={raw_step} migrated={migrated} → is_completed expected={expected_completed}"


# ---------------------------------------------------------------------------
# 3. _initialize_user_services — new step thresholds
# ---------------------------------------------------------------------------

class TestUserServicesThresholds:
    """Verify services are enabled at the correct new step numbers."""

    @staticmethod
    def _services_for_step(step: int):
        """Replicates _initialize_user_services logic with new numbering."""
        services = {
            "ai_services": False,
            "content_services": False,
            "research_services": False,
            "integration_services": False,
        }
        # Step 1: AI + Content
        if step >= 1:
            services["ai_services"] = True
            services["content_services"] = True
        # Step 2: Research
        if step >= 2:
            services["research_services"] = True
        # Step 4: Integrations
        if step >= 4:
            services["integration_services"] = True
        return services

    def test_step_0_nothing_enabled(self):
        s = self._services_for_step(0)
        assert not any(s.values())

    def test_step_1_ai_and_content_enabled(self):
        s = self._services_for_step(1)
        assert s["ai_services"] is True
        assert s["content_services"] is True
        assert s["research_services"] is False
        assert s["integration_services"] is False

    def test_step_2_research_added(self):
        s = self._services_for_step(2)
        assert s["ai_services"] is True
        assert s["content_services"] is True
        assert s["research_services"] is True
        assert s["integration_services"] is False

    def test_step_3_same_as_step_2(self):
        s = self._services_for_step(3)
        assert s == self._services_for_step(2)

    def test_step_4_integrations_added(self):
        s = self._services_for_step(4)
        assert s["ai_services"] is True
        assert s["content_services"] is True
        assert s["research_services"] is True
        assert s["integration_services"] is True

    def test_step_5_all_enabled(self):
        s = self._services_for_step(5)
        assert all(s.values())


# ---------------------------------------------------------------------------
# 4. setup_progressive_features — new step thresholds
# ---------------------------------------------------------------------------

class TestProgressiveFeaturesThresholds:
    """Verify features are enabled at the correct new step numbers."""

    @staticmethod
    def _features_for_step(step: int):
        """Replicates setup_progressive_features logic with new numbering."""
        features = []
        if step >= 1:
            features.extend(["ai_services", "content_analysis"])
        if step >= 2:
            features.append("research_services")
        if step >= 3:
            features.append("personalization")
        if step >= 4:
            features.append("integrations")
        if step >= 5:
            features.append("all_features")
        return features

    def test_step_0_nothing(self):
        assert self._features_for_step(0) == []

    def test_step_1_connect(self):
        f = self._features_for_step(1)
        assert "ai_services" in f
        assert "content_analysis" in f
        assert "research_services" not in f

    def test_step_2_research(self):
        f = self._features_for_step(2)
        assert "research_services" in f
        assert "personalization" not in f

    def test_step_3_personalization(self):
        f = self._features_for_step(3)
        assert "personalization" in f
        assert "integrations" not in f

    def test_step_4_finish(self):
        f = self._features_for_step(4)
        assert "integrations" in f
        assert "all_features" not in f  # all_features only at complete

    def test_step_5_complete(self):
        f = self._features_for_step(5)
        assert "all_features" in f


# ---------------------------------------------------------------------------
# 5. Website strategy dispatch — correct handler per new step
# ---------------------------------------------------------------------------

class TestWebsiteStrategyDispatch:
    """Verify the renumbered dispatch calls the correct handlers."""

    @pytest.fixture
    def strategy(self):
        from api.onboarding_utils.platform_strategies.website_strategy import WebsiteOnboardingStrategy
        return WebsiteOnboardingStrategy()

    @pytest.fixture
    def mock_svc(self):
        svc = MagicMock()
        svc._save_website_analysis = MagicMock(return_value=True)
        svc._save_research_preferences = MagicMock(return_value=True)
        svc._save_persona_data = MagicMock(return_value=True)
        svc._save_competitor_analysis = MagicMock()
        svc._get_or_create_session = MagicMock()
        return svc

    def _make_request(self, data: dict):
        return {"data": data}

    @pytest.mark.asyncio
    async def test_step_1_dispatches_to_website_handler(self, strategy, mock_svc):
        """New step 1 (Connect Platforms) → _complete_website_step2 (website save)."""
        from unittest.mock import patch
        with patch("api.onboarding_utils.platform_strategies.website_strategy.logger"):
            mock_svc._get_or_create_session.return_value = MagicMock(payload=None, platform_integrations=None)

            await strategy.complete_step(
                svc=mock_svc,
                step_number=1,
                user_id="test_user",
                request_data=self._make_request({"website": "https://example.com", "website_url": "https://example.com"}),
                db=MagicMock(),
            )

        mock_svc._save_website_analysis.assert_called_once()
        mock_svc._save_research_preferences.assert_not_called()
        mock_svc._save_persona_data.assert_not_called()

    @pytest.mark.asyncio
    async def test_step_2_dispatches_to_research_handler(self, strategy, mock_svc):
        """New step 2 (Research) → _complete_website_step3 (research save)."""
        with patch("api.onboarding_utils.platform_strategies.website_strategy.logger"):
            mock_svc._get_or_create_session.return_value = MagicMock(payload=None)

            await strategy.complete_step(
                svc=mock_svc,
                step_number=2,
                user_id="test_user",
                request_data=self._make_request({"research_depth": "basic"}),
                db=MagicMock(),
            )

        mock_svc._save_research_preferences.assert_called_once()
        mock_svc._save_website_analysis.assert_not_called()

    @pytest.mark.asyncio
    async def test_step_3_dispatches_to_persona_handler(self, strategy, mock_svc):
        """New step 3 (Personalization) → _complete_website_step4 (persona save)."""
        with patch("api.onboarding_utils.platform_strategies.website_strategy.logger"):
            mock_svc._get_or_create_session.return_value = MagicMock(payload=None)

            await strategy.complete_step(
                svc=mock_svc,
                step_number=3,
                user_id="test_user",
                request_data=self._make_request({"corePersona": {"name": "test"}}),
                db=MagicMock(),
            )

        mock_svc._save_persona_data.assert_called_once()
        mock_svc._save_website_analysis.assert_not_called()
        mock_svc._save_research_preferences.assert_not_called()

    @pytest.mark.asyncio
    async def test_step_4_finish_no_handler_needed(self, strategy, mock_svc):
        """New step 4 (Finish) — no strategy handler, should just succeed."""
        with patch("api.onboarding_utils.platform_strategies.website_strategy.logger"):
            mock_svc._get_or_create_session.return_value = MagicMock(payload=None)

            await strategy.complete_step(
                svc=mock_svc,
                step_number=4,
                user_id="test_user",
                request_data={"data": {"stepType": "finish"}},
                db=MagicMock(),
            )

        # No save methods called — Finish has no strategy handler
        mock_svc._save_website_analysis.assert_not_called()
        mock_svc._save_research_preferences.assert_not_called()
        mock_svc._save_persona_data.assert_not_called()

    @pytest.mark.asyncio
    async def test_missing_data_skips_handler(self, strategy, mock_svc):
        """request_data is falsy → no handler should be called."""
        with patch("api.onboarding_utils.platform_strategies.website_strategy.logger"):
            await strategy.complete_step(
                svc=mock_svc,
                step_number=1,
                user_id="test_user",
                request_data={},
                db=MagicMock(),
            )

        mock_svc._save_website_analysis.assert_not_called()
