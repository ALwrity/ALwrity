"""Tests for YouTube plan persona consumption (Phase 3).

Verifies the plan handler loads the user's YouTube platform persona and passes
it into the planner, and that failures to load degrade gracefully.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.youtube.handlers.plan"


def _fake_user(uid: str = "user_test") -> dict:
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


class TestPlanPersonaConsumption:
    @pytest.mark.asyncio
    async def test_persona_passed_when_present(self):
        from api.youtube.handlers.plan import create_video_plan
        from api.youtube.schemas import VideoPlanRequest

        persona = {"persona_name": "The Explainer", "tone_and_pacing": {"default_tone": "energetic"}}
        mock_planner = MagicMock()
        mock_planner.generate_plan = AsyncMock(return_value={})

        with patch(f"{MOD}.require_authenticated_user", return_value="user_test"), \
             patch(f"{MOD}.YouTubePlannerService", return_value=mock_planner), \
             patch(f"{MOD}.PersonaDataService") as pds:
            pds.return_value.get_platform_persona.return_value = {"platform_persona": persona}
            await create_video_plan(VideoPlanRequest(user_idea="idea", duration_type="shorts"), _fake_user())

        assert mock_planner.generate_plan.await_args.kwargs["persona_data"] == persona

    @pytest.mark.asyncio
    async def test_persona_none_when_absent(self):
        from api.youtube.handlers.plan import create_video_plan
        from api.youtube.schemas import VideoPlanRequest

        mock_planner = MagicMock()
        mock_planner.generate_plan = AsyncMock(return_value={})

        with patch(f"{MOD}.require_authenticated_user", return_value="user_test"), \
             patch(f"{MOD}.YouTubePlannerService", return_value=mock_planner), \
             patch(f"{MOD}.PersonaDataService") as pds:
            pds.return_value.get_platform_persona.return_value = None
            await create_video_plan(VideoPlanRequest(user_idea="idea", duration_type="shorts"), _fake_user())

        assert mock_planner.generate_plan.await_args.kwargs["persona_data"] is None

    @pytest.mark.asyncio
    async def test_persona_load_error_swallowed(self):
        from api.youtube.handlers.plan import create_video_plan
        from api.youtube.schemas import VideoPlanRequest

        mock_planner = MagicMock()
        mock_planner.generate_plan = AsyncMock(return_value={})

        with patch(f"{MOD}.require_authenticated_user", return_value="user_test"), \
             patch(f"{MOD}.YouTubePlannerService", return_value=mock_planner), \
             patch(f"{MOD}.PersonaDataService") as pds:
            pds.return_value.get_platform_persona.side_effect = RuntimeError("db down")
            await create_video_plan(VideoPlanRequest(user_idea="idea", duration_type="shorts"), _fake_user())

        assert mock_planner.generate_plan.await_args.kwargs["persona_data"] is None
