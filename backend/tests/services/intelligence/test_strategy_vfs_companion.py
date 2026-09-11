"""SIF x Strategy integration — Phase SIF-C: VFS companion + dispatch (unit tests).

Proves the markdown mirror is deterministic and atomically written into
a user's workspace, and that ``dispatch_activation_indexing`` (the
activation-hook entry point) mirrors + schedules embedding without ever
raising. Workspace root is patched to a tmp dir — no real filesystem
state is touched.
"""
import asyncio
from unittest.mock import MagicMock, patch

from services.intelligence import strategy_vfs_companion as vfs
from services.intelligence.strategy_vfs_companion import (
    dispatch_activation_indexing,
    render_active_strategy_markdown,
    write_vfs_companion,
)

UID = "user-42"
ACTIVATION = "2026-09-09T10:00:00"


def make_strategy(**overrides):
    comprehensive = {
        "strategy_metadata": {
            "version": "2.0",
            "generated_at": "2026-09-09T09:00:00",
            "grounding_status": "grounded",
        },
        "base_strategy": {"pillars": ["ownership", "education"]},
        "strategic_insights": {"top": "differentiate on trust"},
        "competitive_analysis": {"competitors": ["A", "B"]},
        "performance_predictions": {"6m_views": 50000},
        "implementation_roadmap": {"q1": ["brand audit"]},
        "risk_assessment": {"risks": ["bandwidth"]},
    }
    data = dict(
        id=7,
        name="Growth Plan",
        industry="SaaS",
        business_objectives=["grow"],
        brand_voice="bold",
        comprehensive_ai_analysis=comprehensive,
    )
    data.update(overrides)
    return data


class TestRender:
    def test_header_contract(self):
        md = render_active_strategy_markdown(make_strategy(), ACTIVATION)
        assert md.startswith("# Active Content Strategy")
        assert "- strategy_id: 7" in md
        assert f"- activation_date: {ACTIVATION}" in md
        assert "- version: 2.0" in md
        assert "- grounding_status: grounded" in md
        assert "## Form Inputs" in md
        assert "- name: Growth Plan" in md
        assert "- business_objectives: grow" in md

    def test_persona_and_analysis_sections(self):
        md = render_active_strategy_markdown(make_strategy(), ACTIVATION)
        assert "## Base Strategy" in md
        assert "- pillars: ownership, education" in md
        assert "## Competitive Analysis" in md
        assert "## Strategic Insights" in md

    def test_deterministic(self):
        a = render_active_strategy_markdown(make_strategy(), ACTIVATION)
        b = render_active_strategy_markdown(make_strategy(), ACTIVATION)
        assert a == b

    def test_empty_components_skipped(self):
        s = make_strategy()
        s["comprehensive_ai_analysis"].pop("risk_assessment")
        md = render_active_strategy_markdown(s, ACTIVATION)
        assert "## Risk Assessment" not in md


class TestWriteCompanion:
    def test_writes_active_md_in_user_workspace(self, tmp_path):
        with patch("services.workspace_paths.get_workspace_root",
                   return_value=tmp_path):
            ok = write_vfs_companion(UID, make_strategy(), ACTIVATION)
        assert ok is True
        path = tmp_path / f"workspace_{UID}" / "strategy" / "active.md"
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "# Active Content Strategy" in content
        assert "- strategy_id: 7" in content

    def test_sanitizes_user_id(self, tmp_path):
        with patch("services.workspace_paths.get_workspace_root",
                   return_value=tmp_path):
            ok = write_vfs_companion("we!rd id", make_strategy(), ACTIVATION)
        assert ok is True
        assert (tmp_path / "workspace_werdid" / "strategy" / "active.md").exists()

    def test_overwrite_idempotent(self, tmp_path):
        with patch("services.workspace_paths.get_workspace_root",
                   return_value=tmp_path):
            assert write_vfs_companion(UID, make_strategy(), ACTIVATION) is True
            assert write_vfs_companion(UID, make_strategy(), ACTIVATION) is True
        content = (tmp_path / f"workspace_{UID}" / "strategy" / "active.md").read_text()
        assert content.count("# Active Content Strategy") == 1

    def test_never_raises_on_store_failure(self, tmp_path):
        with patch("services.workspace_paths.get_workspace_root",
                   return_value=tmp_path), \
             patch("services.intelligence.agent_flat_context.AgentFlatContextStore"
                   ".save_strategy_active_markdown",
                   side_effect=OSError("boom")):
            ok = write_vfs_companion(UID, make_strategy(), ACTIVATION)
        assert ok is False


class TestDispatch:
    def test_dispatches_index_task_after_mirror(self, tmp_path):
        db = MagicMock()
        created = []

        with patch("services.workspace_paths.get_workspace_root",
                   return_value=tmp_path), \
             patch("services.intelligence.strategy_vfs_companion.index_active_strategy_async",
                   side_effect=lambda *a, **k: (created.append(True), None)[1]):

            async def _do():
                return dispatch_activation_indexing(
                    db, UID, make_strategy(), ACTIVATION, sif_service=object())

            asyncio.run(_do())

        assert created, "index task was not dispatched"
        assert (tmp_path / f"workspace_{UID}" / "strategy" / "active.md").exists()

    def test_vfs_failure_does_not_block_dispatch(self, tmp_path):
        db = MagicMock()
        with patch("services.intelligence.strategy_vfs_companion.write_vfs_companion",
                   side_effect=RuntimeError("disk full")), \
             patch("services.intelligence.strategy_vfs_companion.index_active_strategy_async") as idxm:
            async def _do():
                return dispatch_activation_indexing(db, UID, make_strategy(), ACTIVATION)

            result = asyncio.run(_do())
        assert idxm.call_count == 1
        assert result is not None

    def test_disabled_flag_dispatches_nothing(self, tmp_path):
        with patch("services.intelligence.strategy_vfs_companion."
                   "strategy_sif_indexing_enabled", return_value=False), \
             patch("services.intelligence.strategy_vfs_companion.write_vfs_companion") as wm, \
             patch("services.intelligence.strategy_vfs_companion.index_active_strategy_async") as idxm:
            async def _do():
                return dispatch_activation_indexing(MagicMock(), UID, make_strategy(), ACTIVATION)

            result = asyncio.run(_do())
        assert result is None
        wm.assert_not_called()
        idxm.assert_not_called()