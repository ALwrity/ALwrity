"""Tests for YouTube pitch expansion schema, duration, and assemble_full_script."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _beat(scene_number: int, seconds: float, **overrides) -> dict:
    beat = {
        "scene_number": scene_number,
        "section_title": f"Beat {scene_number}",
        "context": "What it is",
        "application": "How to do it",
        "frame": "Why it matters",
        "mini_hook_out": "Wait until you hear the next part.",
        "spoken_script": f"Spoken beat {scene_number}.",
        "visual": "On-screen demo",
        "estimated_duration_seconds": seconds,
    }
    beat.update(overrides)
    return beat


def _valid_expansion(*, duration_type: str = "shorts") -> dict:
    # shorts target is 30s ±20% → 24–36
    return {
        "hook": {
            "context": "Packing for a weekend trip",
            "common_belief": "You need a big suitcase",
            "contrarian_turn": "Three items beat a packed bag",
            "proof": "I did this for 12 trips",
            "plan_statement": "I'll show the three-item rule",
            "spoken_script": "Hook spoken here.",
        },
        "main_content_outline": [
            _beat(1, 10),
            _beat(2, 10),
            _beat(3, 10),
        ],
        "outro": "Reality beat the packing list.",
        "call_to_action": "Try the three-item rule this weekend.",
        "key_message": "Pack less, enjoy more.",
        "seo_keywords": ["packing", "travel"],
    }


class TestExpansionJsonStruct:
    def test_schema_has_no_full_script_or_echoed_fields(self):
        from services.youtube.planner_pitch_prompts import build_expansion_json_struct

        schema = build_expansion_json_struct()
        props = schema["properties"]
        assert "full_script" not in props
        for echoed in ("target_audience", "tone", "visual_style", "video_goal"):
            assert echoed not in props
        assert "hook" in props
        assert "main_content_outline" in props
        assert "spoken_script" in props["hook"]["properties"]

    def test_system_prompt_has_no_json_template(self):
        from services.youtube.planner_pitch_prompts import EXPANSION_SYSTEM_PROMPT

        assert "EXPECTATION < REALITY" in EXPANSION_SYSTEM_PROMPT
        assert '"hook"' not in EXPANSION_SYSTEM_PROMPT
        assert "full_script" in EXPANSION_SYSTEM_PROMPT.lower()


class TestAssembleFullScript:
    def test_stitches_hook_beats_outro_cta(self):
        from services.youtube.planner_pitch_validate import assemble_full_script

        script = assemble_full_script(_valid_expansion())
        assert script.startswith("Hook spoken here.")
        assert "Spoken beat 1." in script
        assert "Spoken beat 3." in script
        assert "Reality beat the packing list." in script
        assert "Try the three-item rule this weekend." in script

    def test_rejects_empty_spoken_parts(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            assemble_full_script,
        )

        with pytest.raises(PitchValidationError, match="assemble"):
            assemble_full_script({"hook": {}, "main_content_outline": []})


class TestValidateExpansion:
    def test_accepts_duration_within_tolerance(self):
        from services.youtube.planner_pitch_validate import validate_expansion

        result = validate_expansion(_valid_expansion(), duration_type="shorts")
        assert len(result["main_content_outline"]) == 3
        assert result["key_message"] == "Pack less, enjoy more."

    def test_rejects_duration_outside_tolerance(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["main_content_outline"] = [_beat(1, 5), _beat(2, 5)]
        with pytest.raises(PitchValidationError, match="±20%"):
            validate_expansion(payload, duration_type="shorts")

    def test_rejects_missing_hook_spoken_script(self):
        from services.youtube.planner_pitch_validate import (
            PitchValidationError,
            validate_expansion,
        )

        payload = _valid_expansion()
        payload["hook"]["spoken_script"] = "  "
        with pytest.raises(PitchValidationError, match="spoken_script"):
            validate_expansion(payload, duration_type="shorts")


class TestExpandPitchToScript:
    def test_success_assembles_full_script(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import expand_pitch_to_script

        svc = YouTubePlannerService()
        approved = {
            "selected_title": "Stop Planning Trips Like This",
            "video_summary": "Pack less.",
            "hook_concept": "Three-item rule",
            "main_content_beats": ["One", "Two", "Three"],
            "angle_used": "Contrarian",
        }
        with patch(
            "services.youtube.planner_pitch.llm_text_gen",
            return_value=_valid_expansion(),
        ) as llm_mock:
            result = asyncio.run(
                expand_pitch_to_script(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    approved_pitch=approved,
                    user_id="user_expand",
                    enable_research=False,
                )
            )

        assert "Hook spoken here." in result["full_script"]
        assert result["generation"]["text_gateway"] == "llm_text_gen"
        llm_mock.assert_called_once()
        assert llm_mock.call_args.kwargs["flow_type"] == "youtube_script_expand"
        assert "max_tokens" not in llm_mock.call_args.kwargs

    def test_missing_approved_pitch_returns_clear_error(self):
        from services.youtube.planner import YouTubePlannerService
        from services.youtube.planner_pitch import expand_pitch_to_script

        svc = YouTubePlannerService()
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                expand_pitch_to_script(
                    svc,
                    user_idea="Budget travel",
                    duration_type="shorts",
                    approved_pitch={},
                    enable_research=False,
                )
            )
        assert exc.value.status_code == 400
        assert "pitch" in str(exc.value.detail).lower()
