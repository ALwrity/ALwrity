"""
Tests: YouTube render endpoints can access task_manager.

Regression coverage for NameError: name 'task_manager' is not defined
when starting full or single-scene video renders.
"""

from __future__ import annotations

import inspect
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYouTubeRouterTaskManagerImport:
    """Ensure router.py imports and exposes task_manager for render flows."""

    def test_router_module_exports_task_manager(self):
        """task_manager must be importable from api.youtube.router (not NameError)."""
        from api.youtube import router as yt_router_module
        from services.youtube.youtube_task_manager import task_manager as shared_task_manager

        assert hasattr(yt_router_module, "task_manager"), (
            "api.youtube.router must import task_manager so render endpoints can create tasks"
        )
        assert yt_router_module.task_manager is shared_task_manager

    def test_start_video_render_source_references_imported_task_manager(self):
        """start_video_render must use the module-level task_manager symbol."""
        from api.youtube.router import start_video_render, task_manager

        source = inspect.getsource(start_video_render)
        assert "task_manager.create_task" in source
        assert task_manager is not None
        assert hasattr(task_manager, "create_task")
        assert hasattr(task_manager, "get_task_status")

    def test_render_single_scene_video_source_references_imported_task_manager(self):
        """render_single_scene_video must use the module-level task_manager symbol."""
        from api.youtube.router import render_single_scene_video, task_manager

        source = inspect.getsource(render_single_scene_video)
        assert "task_manager.create_task" in source
        assert task_manager is not None
        assert hasattr(task_manager, "create_task")
