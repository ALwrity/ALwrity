"""Phase 5 / Issue #617 #4: harvester must not return fake data.

Pre-#4, when Exa was disabled, ``harvest_website`` returned a
single fabricated document ``{"title": "Sample Page 1", ...}``
that got indexed into the SIF index and surfaced in production
search results. The fix: return ``[]`` and log a clear warning.

This test exercises the disabled-Exa path without needing a
real Exa service. It patches ``exa_service`` to a minimal stub
with ``enabled = False`` and verifies the return value is an
empty list, not a fake document.
"""
from __future__ import annotations

import importlib.util
import logging
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


class _DisabledExaService:
    """Minimal stub: Exa is disabled and ``_try_initialize`` is a no-op."""
    enabled = False

    def _try_initialize(self):
        return False  # stays disabled


def _load_harvester():
    spec = importlib.util.spec_from_file_location(
        "_harvester_for_test",
        BACKEND_DIR / "services" / "intelligence" / "harvester.py",
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["_harvester_for_test"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture()
def harvester_module():
    return _load_harvester()


def test_harvest_website_returns_empty_when_exa_disabled(harvester_module, monkeypatch):
    """Issue #617 #4: when Exa is disabled, return [] and warn, not fake data.

    The harvester uses ``loguru``, not stdlib ``logging``, so we
    patch the module's ``logger.warning`` to capture the message
    instead of using ``caplog``.
    """
    import asyncio
    from loguru import logger as loguru_logger

    captured = []
    monkeypatch.setattr(
        loguru_logger, "warning",
        lambda msg: captured.append(msg),
    )

    svc = harvester_module.SemanticHarvesterService.__new__(
        harvester_module.SemanticHarvesterService
    )
    svc.exa_service = _DisabledExaService()

    result = asyncio.run(svc.harvest_website(
        website_url="https://example.com",
        limit=5,
        user_id=None,
    ))

    # Must be empty, NOT a fake document
    assert result == []
    # Must NOT contain "Sample Page 1"
    assert not any("Sample Page" in str(item) for item in result)
    # Must log a warning that explains the situation
    assert any("Exa service disabled" in m for m in captured), (
        f"expected an Exa-disabled warning, got: {captured}"
    )


def test_get_placeholder_data_method_removed(harvester_module):
    """The fake-data generator itself must be deleted, not just unused."""
    svc = harvester_module.SemanticHarvesterService.__new__(
        harvester_module.SemanticHarvesterService
    )
    assert not hasattr(svc, "_get_placeholder_data"), (
        "_get_placeholder_data should be deleted (Issue #617 #4); "
        "its return value polluted the SIF index in production."
    )
