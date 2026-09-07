"""
Unmaskable import-chain smoke test.

Why this exists: tests/conftest.py installs a defensive typing shim (injects
``Dict``/``Union``/... into BUILTINS for legacy test files). That shim masked
a real production bug (a module forgetting ``from typing import Dict``) —
pytest passed while ``import app`` exploded with NameError at startup,
because app startup runs in a FRESH interpreter with no such shim.

The test performs the same import app.py performs — in a fresh subprocess
(no conftest pollution, no builtins shim) — so any module-level import error
anywhere in the router chain surfaces as a test failure.
"""

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _import_in_fresh_process(module: str):
    return subprocess.run(
        [sys.executable, "-c", f"import {module}"],
        capture_output=True,
        text=True,
        cwd=str(BACKEND_ROOT),
        timeout=180,
    )


class TestFreshProcessImportChain:
    def test_content_planning_router_imports_clean(self):
        """The router chain app.py imports on startup must import cleanly in a
        fresh interpreter — this is the surface where a missing
        ``typing.Dict`` failed only outside pytest."""
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from api.content_planning.api.router import router as content_planning_router",
            ],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_ROOT),
            timeout=180,
        )
        assert result.returncode == 0, (
            "Router import chain failed in a fresh process:\n"
            f"{result.stderr[-2500:]}"
        )

    def test_autofill_chain_imports_clean(self):
        """The autofill endpoints + services import (the user's traceback)."""
        result = _import_in_fresh_process(
            "api.content_planning.api.content_strategy.endpoints.autofill_endpoints"
        )
        assert result.returncode == 0, result.stderr[-2500:]
