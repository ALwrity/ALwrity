"""Tests for the generic platform persona scheduler."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "services.persona.platform_persona_scheduler"


class TestGeneratePlatformPersonaTask:
    @pytest.mark.asyncio
    async def test_skips_when_no_core_persona(self):
        from services.persona.platform_persona_scheduler import generate_platform_persona_task

        with patch(f"{MOD}.get_db_session") as gdb, patch(f"{MOD}.PersonaDataService") as pds:
            gdb.return_value = MagicMock()
            pds.return_value.get_user_persona_data.return_value = None

            await generate_platform_persona_task("u1", "twitter")

        pds.return_value.save_platform_persona.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_platform_already_exists(self):
        from services.persona.platform_persona_scheduler import generate_platform_persona_task

        with patch(f"{MOD}.get_db_session") as gdb, patch(f"{MOD}.PersonaDataService") as pds:
            gdb.return_value = MagicMock()
            pds.return_value.get_user_persona_data.return_value = {
                "core_persona": {"identity": {}},
                "platform_personas": {"twitter": {"platform_type": "twitter"}},
            }

            await generate_platform_persona_task("u1", "twitter")

        pds.return_value.save_platform_persona.assert_not_called()

    @pytest.mark.asyncio
    async def test_generates_and_saves(self):
        from services.persona.platform_persona_scheduler import generate_platform_persona_task

        fake_persona = {"platform_type": "twitter", "sentence_metrics": {}}

        with patch(f"{MOD}.get_db_session") as gdb, \
             patch(f"{MOD}.PersonaDataService") as pds, \
             patch(f"{MOD}.OnboardingDataIntegrationService") as integ, \
             patch(f"{MOD}.CorePersonaService") as core_cls:
            gdb.return_value = MagicMock()
            pds.return_value.get_user_persona_data.return_value = {
                "core_persona": {"identity": {}},
                "platform_personas": {},
            }
            pds.return_value.save_platform_persona.return_value = True
            integ.return_value.get_integrated_data_sync.return_value = {}
            core_cls.return_value._generate_single_platform_persona.return_value = fake_persona

            await generate_platform_persona_task("u1", "twitter")

        pds.return_value.save_platform_persona.assert_called_once_with("u1", "twitter", fake_persona)

    @pytest.mark.asyncio
    async def test_generation_error_not_saved(self):
        from services.persona.platform_persona_scheduler import generate_platform_persona_task

        with patch(f"{MOD}.get_db_session") as gdb, \
             patch(f"{MOD}.PersonaDataService") as pds, \
             patch(f"{MOD}.OnboardingDataIntegrationService") as integ, \
             patch(f"{MOD}.CorePersonaService") as core_cls:
            gdb.return_value = MagicMock()
            pds.return_value.get_user_persona_data.return_value = {
                "core_persona": {"identity": {}},
                "platform_personas": {},
            }
            integ.return_value.get_integrated_data_sync.return_value = {}
            core_cls.return_value._generate_single_platform_persona.return_value = {"error": "boom"}

            await generate_platform_persona_task("u1", "twitter")

        pds.return_value.save_platform_persona.assert_not_called()


class TestSchedulePlatformPersona:
    def test_schedules_with_correct_job_id_and_kwargs(self):
        from services.persona.platform_persona_scheduler import schedule_platform_persona_generation

        with patch("services.scheduler.get_scheduler") as gs:
            mock_scheduler = MagicMock()
            gs.return_value = mock_scheduler
            mock_scheduler.schedule_one_time_task.return_value = "job123"

            result = schedule_platform_persona_generation("u1", "twitter", delay_minutes=10)

        mock_scheduler.schedule_one_time_task.assert_called_once()
        call_kwargs = mock_scheduler.schedule_one_time_task.call_args.kwargs
        assert call_kwargs["job_id"] == "persona_twitter_u1"
        assert call_kwargs["kwargs"] == {"user_id": "u1", "platform": "twitter"}
        assert result == "job123"
