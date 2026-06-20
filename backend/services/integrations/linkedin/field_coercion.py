"""
Shared field coercion helpers for LinkedIn profile normalization and context building.

Used by Phase 1 (``profile_service``) and Phase 2 (``profile_context_builder``).
"""

from __future__ import annotations

from typing import Any


def clean_str(value: Any) -> str:
    """Coerce a value to a trimmed string; None and non-strings become ``""``."""
    if value is None:
        return ""
    if not isinstance(value, str):
        return str(value).strip()
    return value.strip()


def coerce_bool(value: Any, *, default: bool = False) -> bool:
    """Coerce boolean fields safely."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    return default


def coerce_int(value: Any, *, default: int = 0) -> int:
    """Coerce count fields to int."""
    if value is None:
        return default
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return default


def coerce_list(value: Any) -> list[Any]:
    """Return a list or empty list when null / wrong type."""
    if isinstance(value, list):
        return value
    return []
