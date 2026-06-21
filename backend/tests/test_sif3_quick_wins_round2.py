"""Source-level tests for the second round of SIF-3 quick wins:
env-configurable PILLAR_IDS / PLAN_CONTEXT_THRESHOLD, and the explicit
txtai guard in the agent orchestrator.
"""
import importlib
import os
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/backend")


def _read(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8")


# ---------------- PILLAR_IDS env override ----------------

def test_pillar_ids_default_when_env_unset(monkeypatch):
    """When ALWRITY_PILLAR_IDS is unset, the module exposes the
    built-in 6-pillar list.
    """
    monkeypatch.delenv("ALWRITY_PILLAR_IDS", raising=False)
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PILLAR_IDS == ["plan", "generate", "publish", "analyze", "engage", "remarket"]


def test_pillar_ids_override_from_env(monkeypatch):
    """When ALWRITY_PILLAR_IDS is set, it is parsed and lowercased."""
    monkeypatch.setenv("ALWRITY_PILLAR_IDS", "Plan,Generate , Publish,analyze")
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PILLAR_IDS == ["plan", "generate", "publish", "analyze"]


def test_pillar_ids_empty_env_falls_back(monkeypatch):
    """Empty / whitespace-only env var falls back to defaults."""
    monkeypatch.setenv("ALWRITY_PILLAR_IDS", "   ,  ,")
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert len(mod.PILLAR_IDS) == 6
    assert mod.PILLAR_IDS[0] == "plan"


# ---------------- PLAN_CONTEXT_THRESHOLD env override ----------------

def test_plan_context_threshold_default_when_env_unset(monkeypatch):
    monkeypatch.delenv("ALWRITY_PLAN_CONTEXT_THRESHOLD", raising=False)
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PLAN_CONTEXT_THRESHOLD == 0.65


def test_plan_context_threshold_override_from_env(monkeypatch):
    monkeypatch.setenv("ALWRITY_PLAN_CONTEXT_THRESHOLD", "0.8")
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PLAN_CONTEXT_THRESHOLD == 0.8


def test_plan_context_threshold_out_of_range_falls_back(monkeypatch):
    monkeypatch.setenv("ALWRITY_PLAN_CONTEXT_THRESHOLD", "1.5")
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PLAN_CONTEXT_THRESHOLD == 0.65


def test_plan_context_threshold_invalid_float_falls_back(monkeypatch):
    monkeypatch.setenv("ALWRITY_PLAN_CONTEXT_THRESHOLD", "not-a-number")
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    mod = importlib.import_module("services.today_workflow_service")
    assert mod.PLAN_CONTEXT_THRESHOLD == 0.65


# ---------------- Txtai guard ----------------

def test_orchestrator_raises_runtime_error_when_txtai_unavailable(monkeypatch):
    """When TXTAI_AVAILABLE is False, _create_orchestrator_agent
    must raise RuntimeError rather than crashing inside Agent(...).
    """
    # Patch the module-level TXTAI_AVAILABLE constant to False
    src_path = BACKEND_ROOT / "services/intelligence/agents/agent_orchestrator.py"
    src = src_path.read_text(encoding="utf-8")
    assert 'if not TXTAI_AVAILABLE:' in src
    assert 'raise RuntimeError(' in src
    # The guard must be at the start of _create_orchestrator_agent
    m = re.search(
        r"def _create_orchestrator_agent\(self\):(.*?)def \w+\(",
        src, re.DOTALL,
    )
    assert m is not None
    body = m.group(1)
    # The guard must come before the Agent() call
    guard_pos = body.find("if not TXTAI_AVAILABLE")
    agent_pos = body.find("Agent(llm=self.llm)")
    assert 0 <= guard_pos < agent_pos, "guard must come before the Agent() call"


# ---------------- Legacy dedup audit doc ----------------

def test_legacy_audit_doc_exists():
    doc = BACKEND_ROOT.parent / "docs/sif3-legacy-framework-audit.md"
    assert doc.exists()
    text = doc.read_text(encoding="utf-8")
    assert "Zero importers" in text
    assert "Do not delete in this iteration" in text
