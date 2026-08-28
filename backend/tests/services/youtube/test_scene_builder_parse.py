"""Unit tests for custom-script scene parse (durations, visuals, titles)."""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


SHORTS_META = {
    "target_seconds": 30,
    "hook_seconds": 3,
    "cta_seconds": 3,
    "max_scenes": 4,
    "scene_duration_range": (2, 8),
}


class TestDistinctVisual:
    def test_blank_when_visual_copies_narration(self):
        from services.youtube.scene_builder_parse import distinct_visual

        narration = "Book midweek flights to save."
        assert distinct_visual(narration, narration) == ""
        assert distinct_visual("  " + narration.upper() + "  ", narration) == ""

    def test_keeps_real_visual(self):
        from services.youtube.scene_builder_parse import distinct_visual

        assert distinct_visual("Airport departure board", "Book midweek") == (
            "Airport departure board"
        )


class TestRebalanceDurations:
    def test_shorts_sum_within_twenty_percent(self):
        from services.youtube.scene_builder_parse import rebalance_scene_durations

        balanced = rebalance_scene_durations([2, 2, 2, 2], target_seconds=30, lo=2, hi=8)
        total = sum(balanced)
        assert all(2 <= d <= 8 for d in balanced)
        assert abs(total - 30) <= 30 * 0.20
        assert not all(d == 2 for d in balanced)


class TestParseYoutubeCustomScript:
    def test_shorts_aligned_outline_durations_visuals_and_titles(self):
        from services.youtube.scene_builder_parse import parse_youtube_custom_script

        hook = "Stop booking weekend flights."
        beat_one = "Midweek fares drop because business travelers stay home."
        beat_two = "Set a Tuesday alert and buy when the graph dips."
        outro = "That is the whole system."
        cta = "Follow for the alert setup."
        script = "\n\n".join([hook, beat_one, beat_two, outro, cta])
        plan = {
            "hook_strategy": hook,
            "outro": outro,
            "call_to_action": cta,
            "content_outline": [
                {
                    "section": "Why midweek is cheaper",
                    "description": beat_one,
                    "duration_estimate": 8,
                    "visual": "Calendar highlighting Tuesday",
                },
                {
                    "section": "Set the fare alert",
                    "description": beat_two,
                    "duration_estimate": 8,
                    "visual": "Phone showing a price-drop graph",
                },
            ],
        }

        scenes = parse_youtube_custom_script(
            custom_script=script,
            duration_type="shorts",
            duration_metadata=SHORTS_META,
            video_plan=plan,
        )

        assert len(scenes) == 5
        durations = [s["duration_estimate"] for s in scenes]
        assert not all(d == 2 for d in durations)
        assert abs(sum(durations) - 30) <= 30 * 0.20
        assert all(2 <= d <= 8 for d in durations)

        titles = [s["title"] for s in scenes]
        assert titles == [
            "Hook",
            "Why midweek is cheaper",
            "Set the fare alert",
            "Outro",
            "Call to action",
        ]
        assert all(not t.startswith("Scene ") for t in titles)

        for scene in scenes:
            vis = (scene.get("visual_prompt") or "").strip()
            nar = (scene.get("narration") or "").strip()
            assert vis.lower() != nar.lower() or vis == ""

        assert scenes[1]["visual_prompt"] == "Calendar highlighting Tuesday"
        assert scenes[2]["visual_prompt"] == "Phone showing a price-drop graph"

    def test_visual_marker_fallback_does_not_copy_narration(self):
        from services.youtube.scene_builder_parse import parse_youtube_custom_script

        script = (
            "Speak the hook here.\nVisual: Wide shot of a packed airport\n---\n"
            "Speak the tip here.\nVisual: Close-up of a boarding pass"
        )
        scenes = parse_youtube_custom_script(
            custom_script=script,
            duration_type="shorts",
            duration_metadata=SHORTS_META,
            video_plan={},
        )
        assert len(scenes) == 2
        assert scenes[0]["visual_prompt"] == "Wide shot of a packed airport"
        assert scenes[0]["visual_prompt"] != scenes[0]["narration"]
        assert abs(sum(s["duration_estimate"] for s in scenes) - 30) <= 30 * 0.20
