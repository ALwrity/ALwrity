"""Tests for scene-build generation metadata attachment."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestSceneGenerationMetadata:
    def test_builds_metadata_with_flags(self):
        from services.youtube.scene_builder_generation_metadata import (
            build_scene_generation_metadata,
        )

        metadata = build_scene_generation_metadata(
            system_prompt="System",
            user_prompt="User prompt body",
            llm_called=True,
            scenes_reused_from_plan=False,
            custom_script_used=False,
        )

        assert metadata["text_gateway"] == "llm_text_gen"
        assert metadata["system_prompt"] == "System"
        assert metadata["user_prompt"] == "User prompt body"
        assert metadata["json_schema_applied"] is True
        assert metadata["llm_called"] is True

    def test_attach_to_result_dict(self):
        from services.youtube.scene_builder_generation_metadata import (
            attach_scene_generation_metadata,
        )

        result = attach_scene_generation_metadata(
            {"scenes": [{"scene_number": 1}]},
            system_prompt="Sys",
            user_prompt="User",
            llm_called=False,
            scenes_reused_from_plan=True,
        )

        assert len(result["scenes"]) == 1
        assert result["generation"]["scenes_reused_from_plan"] is True
        assert result["generation"]["llm_called"] is False
