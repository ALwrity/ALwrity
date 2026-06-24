"""
Isolate LinkedIn integration unit tests from heavy ``services.integrations`` imports.

``services.integrations.__init__`` eagerly imports WordPress (PIL, etc.).
Stub the package so ``services.integrations.linkedin.*`` submodules load directly.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path


def pytest_configure(config) -> None:
    backend_root = Path(__file__).resolve().parents[3]
    integrations_dir = backend_root / "services" / "integrations"

    stub = types.ModuleType("services.integrations")
    stub.__path__ = [str(integrations_dir)]
    stub.__package__ = "services.integrations"
    sys.modules["services.integrations"] = stub
