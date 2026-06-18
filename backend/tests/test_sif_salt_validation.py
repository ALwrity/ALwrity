"""Phase 3.6: FILE_ENCRYPTION_SALT validation tests.

Covers the new ``validate_file_encryption_salt`` helper from
``services.intelligence.agent_flat_context``:
- Returns True for a sufficiently long salt (>=16 chars).
- Returns False (with logged warning) for a missing or short salt
  when called with strict=False.
- Raises RuntimeError when called with strict=True and the salt is
  missing or short.
- The legacy default behavior (``_master_salt()`` returning empty
  string) is preserved when FILE_ENCRYPTION_SALT is unset.
"""
import importlib
import importlib.util
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def afc_module(monkeypatch):
    """Load agent_flat_context with controlled env.

    We import the module (not stub) so we test the real
    ``validate_file_encryption_salt`` function. We then mutate
    ``os.environ`` per-test to simulate different salt states.
    """
    spec = importlib.util.spec_from_file_location(
        "_phase36_afc",
        BACKEND_DIR / "services" / "intelligence" / "agent_flat_context.py",
    )
    mod = importlib.util.module_from_spec(spec)
    # Stub the SIFBaseAgent dependency to avoid loading the full
    # agents package. agent_flat_context doesn't actually inherit
    # from SIFBaseAgent at module top, but be defensive.
    sys.modules["_phase36_afc"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_validator_returns_true_for_long_salt(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "x" * 32)
    assert afc_module.validate_file_encryption_salt(strict=False) is True


def test_validator_returns_true_for_min_length_salt(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "x" * 16)
    assert afc_module.validate_file_encryption_salt(strict=False) is True


def test_validator_returns_false_for_short_salt(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "short")
    assert afc_module.validate_file_encryption_salt(strict=False) is False


def test_validator_returns_false_for_missing_salt(afc_module, monkeypatch):
    monkeypatch.delenv("FILE_ENCRYPTION_SALT", raising=False)
    assert afc_module.validate_file_encryption_salt(strict=False) is False


def test_validator_strict_raises_for_missing_salt(afc_module, monkeypatch):
    monkeypatch.delenv("FILE_ENCRYPTION_SALT", raising=False)
    with pytest.raises(RuntimeError) as exc_info:
        afc_module.validate_file_encryption_salt(strict=True)
    assert "FILE_ENCRYPTION_SALT" in str(exc_info.value)


def test_validator_strict_raises_for_short_salt(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "abc")
    with pytest.raises(RuntimeError):
        afc_module.validate_file_encryption_salt(strict=True)


def test_validator_strict_passes_for_valid_salt(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "x" * 32)
    # No exception
    assert afc_module.validate_file_encryption_salt(strict=True) is True


def test_legacy_master_salt_returns_empty_when_unset(afc_module, monkeypatch):
    """The historical _master_salt() default behavior is preserved."""
    monkeypatch.delenv("FILE_ENCRYPTION_SALT", raising=False)
    # Construct a minimal instance (avoid the heavy __init__):
    inst = afc_module.AgentFlatContextStore.__new__(
        afc_module.AgentFlatContextStore
    )
    assert inst._master_salt() == ""


def test_legacy_master_salt_returns_env_value(afc_module, monkeypatch):
    monkeypatch.setenv("FILE_ENCRYPTION_SALT", "the_actual_salt_value")
    inst = afc_module.AgentFlatContextStore.__new__(
        afc_module.AgentFlatContextStore
    )
    assert inst._master_salt() == "the_actual_salt_value"
