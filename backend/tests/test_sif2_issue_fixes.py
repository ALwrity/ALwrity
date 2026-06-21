"""Source-level tests for the SIF-2 fix items (Issues #620 #4-#11)."""
import re
from pathlib import Path

BACKEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/backend")


def _read(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8")


def _block_after(src: str, marker: str, length: int = 2000) -> str:
    idx = src.find(marker)
    assert idx >= 0, f"marker not found: {marker!r}"
    return src[idx:idx + length]


# Issue #620 #4
def test_executor_no_session_schedules_24h_retry():
    src = _read("services/scheduler/executors/sif_indexing_executor.py")
    block = _block_after(src, "no onboarding session found", length=2000)
    assert 'status = "paused"' not in block
    assert "timedelta(hours=24)" in block
    assert 'status = "active"' in block


# Issue #620 #5
def test_executor_content_guardian_imported_at_module_top():
    src = _read("services/scheduler/executors/sif_indexing_executor.py")
    assert "_CONTENT_GUARDIAN_AVAILABLE" in src
    assert "_CONTENT_GUARDIAN_IMPORT_ERROR" in src
    top_block = src[:3000]
    assert "from services.intelligence.agents.specialized import ContentGuardianAgent" in top_block
    assert "if not _CONTENT_GUARDIAN_AVAILABLE" in src


# Issue #620 #6
def test_onboarding_progress_logs_critical_on_db_failure():
    src = _read("services/onboarding/api_key_manager.py")
    # The fix is in the constructor's except block (surrounded by
    # the OnboardingDataIntegrationService import). The except block
    # must contain "logger.critical" and "Issue #620 #6".
    # Use the FIRST except block in the file (which is the one for
    # the integration service import).
    match = re.search(r"except Exception as e:(.*?)(?=\n    def |\Z)", src, re.DOTALL)
    assert match is not None
    assert "logger.critical" in match.group(1)
    assert "Issue #620 #6" in match.group(1)


# Issue #620 #9
def test_workspace_dir_uses_get_workspace_root():
    src = _read("services/intelligence/agent_flat_context.py")
    m = re.search(r"def _workspace_dir\(self\) -> Path:(.*?)(?=\n    def |\Z)", src, re.DOTALL)
    assert m is not None
    body = m.group(1)
    assert "Path(__file__).parents[3]" not in body
    assert "get_workspace_root" in body


# Issue #620 #11
def test_sif_onboarding_lazy_agent_init():
    src = _read("services/sif_onboarding_service.py")
    m = re.search(
        r"def __init__\(self.*?\):(.*?)(?=\n    (?:async )?def |\nclass )",
        src, re.DOTALL,
    )
    assert m is not None
    init_body = m.group(1)
    for pattern in ["= StrategyArchitectAgent(", "= ContentGuardianAgent(", "= LinkGraphAgent("]:
        assert pattern not in init_body
    for helper in ("_get_strategy_agent", "_get_guardian_agent", "_get_link_agent"):
        assert f"def {helper}" in src
    assert "self.strategy_agent." not in src
    assert "self._get_strategy_agent()." in src
