"""Tests for the on-demand platform persona generation endpoint."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.onboarding_utils.step4_persona_routes"


def _fake_user(uid: str = "user_test") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


class TestGeneratePlatformPersona:
    @pytest.mark.asyncio
    async def test_invalid_platform(self):
        from api.onboarding_utils.step4_persona_routes import generate_platform_persona, PlatformPersonaRequest

        result = await generate_platform_persona(PlatformPersonaRequest(platform="myspace"), _fake_user())
        assert result["success"] is False
        assert result["error"] == "invalid_platform"

    @pytest.mark.asyncio
    async def test_disabled_platform_rejected(self):
        from api.onboarding_utils.step4_persona_routes import generate_platform_persona, PlatformPersonaRequest

        result = await generate_platform_persona(PlatformPersonaRequest(platform="medium"), _fake_user())
        assert result["success"] is False
        assert result["error"] == "invalid_platform"

    @pytest.mark.asyncio
    async def test_missing_core_persona(self):
        from api.onboarding_utils.step4_persona_routes import generate_platform_persona, PlatformPersonaRequest

        with patch(f"{MOD}.PersonaDataService") as pds:
            pds.return_value.get_core_persona.return_value = None
            result = await generate_platform_persona(PlatformPersonaRequest(platform="twitter"), _fake_user())

        assert result["success"] is False
        assert result["error"] == "missing_core_persona"

    @pytest.mark.asyncio
    async def test_success_generates_and_persists(self):
        from api.onboarding_utils.step4_persona_routes import generate_platform_persona, PlatformPersonaRequest

        fake_persona = {"platform_type": "twitter", "sentence_metrics": {"max_sentence_length": 200}}
        db = MagicMock()

        with patch(f"{MOD}.PersonaDataService") as pds, \
             patch(f"{MOD}.get_session_for_user", return_value=db), \
             patch(f"{MOD}.generate_single_platform_persona_async", new=AsyncMock(return_value=fake_persona)), \
             patch("api.content_planning.services.content_strategy.onboarding.OnboardingDataIntegrationService") as integ:
            pds.return_value.get_core_persona.return_value = {"core_persona": {"identity": {"persona_name": "X"}}}
            pds.return_value.save_platform_persona.return_value = True
            integ.return_value.get_integrated_data_sync.return_value = {
                "website_analysis": {"website_url": "https://example.com"},
                "research_preferences": {},
            }

            result = await generate_platform_persona(PlatformPersonaRequest(platform="twitter"), _fake_user())

        assert result["success"] is True
        assert result["platform"] == "twitter"
        assert result["persona"] == fake_persona
        pds.return_value.save_platform_persona.assert_called_once_with("user_test", "twitter", fake_persona)

    @pytest.mark.asyncio
    async def test_generation_error_returned(self):
        from api.onboarding_utils.step4_persona_routes import generate_platform_persona, PlatformPersonaRequest

        with patch(f"{MOD}.PersonaDataService") as pds, \
             patch(f"{MOD}.get_session_for_user", return_value=MagicMock()), \
             patch(f"{MOD}.generate_single_platform_persona_async", new=AsyncMock(return_value={"error": "boom"})), \
             patch("api.content_planning.services.content_strategy.onboarding.OnboardingDataIntegrationService") as integ:
            pds.return_value.get_core_persona.return_value = {"core_persona": {"identity": {}}}
            integ.return_value.get_integrated_data_sync.return_value = {}

            result = await generate_platform_persona(PlatformPersonaRequest(platform="twitter"), _fake_user())

        assert result["success"] is False
        assert result["error"] == "generation_failed"
