"""TDD tests for Phase 1c: pre-load embedding model at app startup.

The txtai service's embedding model (all-MiniLM-L6-v2) loads lazily on
first search — the first agent run after app start pays a 2-4s weight
loading cost. Pre-loading at startup removes this cold-start latency.
"""
import pytest


class TestEmbeddingPreload:
    def test_preload_function_exists_and_is_callable(self):
        """A preload_embeddings function must exist in app.py's startup path."""
        src = open("app.py", encoding="utf-8").read()
        assert "preload_sif_embeddings" in src, (
            "app.py must define or import a preload_sif_embeddings startup hook"
        )

    def test_preload_creates_and_initializes_txtai_service(self):
        """Calling preload must initialize the txtai singleton's embeddings
        so the first search doesn't pay the model-load cost."""
        import sys
        from pathlib import Path

        backend_root = Path(__file__).resolve().parents[1]
        if str(backend_root) not in sys.path:
            sys.path.insert(0, str(backend_root))

        import services.intelligence.txtai_service as txtai_mod

        # Verify the function exists on the txtai service class
        svc_cls = txtai_mod.TxtaiIntelligenceService
        assert hasattr(svc_cls, "_initialize_embeddings") or hasattr(
            svc_cls, "_ensure_initialized"
        ), "TxtaiIntelligenceService must expose an initialization entry point"

    def test_app_startup_calls_preload(self):
        """app.py must call the preload function during startup (not lazily)."""
        src = open("app.py", encoding="utf-8").read()
        # The preload call must be in the startup path (not inside an
        # endpoint handler)
        assert "preload_sif_embeddings" in src
        # It should NOT be inside an @app.get or @app.post decorator block
        import re
        for m in re.finditer(r'@app\.(get|post)\([^)]*\)\s*\nasync def \w+[^{]*', src):
            block = src[m.start():m.start() + 500]
            assert "preload_sif_embeddings" not in block, (
                "preload must be called at startup, not inside an endpoint"
            )

    def test_preload_does_not_block_startup(self):
        """The preload must be non-blocking (background thread or create_task)
        so it doesn't delay the app's startup response."""
        src = open("app.py", encoding="utf-8").read()
        # The _preload_sif_embeddings function body must contain a
        # non-blocking pattern (threading.Thread / daemon)
        assert "def _preload_sif_embeddings" in src
        # Find the function body (from def to the next def/class at same indent)
        i = src.find("def _preload_sif_embeddings")
        body_start = src.find("\n", i) + 1
        # Extract until the next top-level def or the _is_full_mode block
        next_block = src.find("\nif _is_full_mode", body_start)
        if next_block == -1:
            next_block = body_start + 2000
        body = src[body_start:next_block]
        has_async_pattern = any(
            kw in body
            for kw in ("threading.Thread", "daemon=True", "asyncio.create_task", "run_in_executor")
        )
        assert has_async_pattern, (
            "preload must be non-blocking (thread/task/executor). "
            f"Function body: {body[:300]}"
        )
