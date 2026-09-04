"""Phase 1: Verify calendar_generation_service.py has all required imports."""

import importlib
import sys


def test_calendar_generation_service_imports_asyncio():
    """calendar_generation_service must import asyncio (used for asyncio.sleep)."""
    mod = importlib.import_module(
        "api.content_planning.services.calendar_generation_service"
    )
    assert hasattr(mod, "asyncio"), (
        "calendar_generation_service.py is missing 'import asyncio'"
    )


def test_calendar_generation_service_imports_random():
    """calendar_generation_service must import random (used for random.randint)."""
    mod = importlib.import_module(
        "api.content_planning.services.calendar_generation_service"
    )
    assert hasattr(mod, "random"), (
        "calendar_generation_service.py is missing 'import random'"
    )


def test_calendar_generation_service_module_loads_without_error():
    """The module should import cleanly without NameError."""
    # If the module previously had missing imports, this would raise NameError
    # at class/function definition time when asyncio.sleep or random.randint
    # was referenced.  A clean import proves the fix.
    mod = importlib.import_module(
        "api.content_planning.services.calendar_generation_service"
    )
    assert mod is not None
