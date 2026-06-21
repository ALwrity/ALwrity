"""Source-level tests for the SIF-3 quick-win fixes (Issues #623 #3, #16, #15)."""
import ast
import re
from pathlib import Path

BACKEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/backend")
FRONTEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/frontend/src")


def _read(rel: str) -> str:
    p = BACKEND_ROOT / rel if not rel.startswith("frontend") else FRONTEND_ROOT.parent.parent / rel
    return p.read_text(encoding="utf-8")


def test_coerce_priority_logs_invalid_values():
    """Issue #623 #16: _coerce_priority must log the invalid value
    before coercing to 'medium' (was: silent coercion).
    """
    src = _read("services/today_workflow_service.py")
    match = re.search(
        r"def _coerce_priority\(value: Any\) -> str:(.*?)(?=\n\ndef |\nclass )",
        src, re.DOTALL,
    )
    assert match is not None
    body = match.group(1)
    assert "logger.warning" in body
    assert "Coercing invalid priority value" in body
    assert "Issue #623 #16" in body


def _get_catalog(src: str):
    """Find the AGENT_TEAM_CATALOG list-literal node in the AST."""
    tree = ast.parse(src)
    # The catalog is an AnnAssign: AGENT_TEAM_CATALOG: List[...] = [...]
    for node in ast.walk(tree):
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id == "AGENT_TEAM_CATALOG" and isinstance(node.value, ast.List):
                return node.value
    # Fallback: plain Assign
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "AGENT_TEAM_CATALOG":
                    return node.value
    return None


def test_catalog_has_content_guardian_entry():
    """Issue #623 #3: AGENT_TEAM_CATALOG must include a content_guardian
    entry with role='Quality Watchdog' (was: missing entirely).
    """
    src = _read("services/intelligence/agents/team_catalog.py")
    catalog = _get_catalog(src)
    assert catalog is not None, "AGENT_TEAM_CATALOG not found"
    assert isinstance(catalog, ast.List)
    keys = []
    for entry in catalog.elts:
        if isinstance(entry, ast.Dict):
            for k, v in zip(entry.keys, entry.values):
                if isinstance(k, ast.Constant) and k.value == "agent_key":
                    if isinstance(v, ast.Constant):
                        keys.append(v.value)
    assert "content_guardian" in keys, f"content_guardian missing from catalog: {keys}"
    # Check the guardian role is 'Quality Watchdog'
    for entry in catalog.elts:
        if not isinstance(entry, ast.Dict):
            continue
        entry_dict = {k.value: v.value for k, v in zip(entry.keys, entry.values) if isinstance(k, ast.Constant) and isinstance(v, ast.Constant)}
        if entry_dict.get("agent_key") == "content_guardian":
            assert entry_dict.get("role") == "Quality Watchdog"
            return
    raise AssertionError("content_guardian entry found by key but role check missed")


def test_catalog_has_six_entries():
    """Catalog should have 5 strategy agents + 1 guardian = 6."""
    src = _read("services/intelligence/agents/team_catalog.py")
    catalog = _get_catalog(src)
    assert catalog is not None, "AGENT_TEAM_CATALOG not found"
    assert isinstance(catalog, ast.List)
    assert len(catalog.elts) == 6, f"expected 6 catalog entries, got {len(catalog.elts)}"


def test_agent_help_modal_describes_six_member_committee():
    """Issue #623 #15: frontend SIF_DESCRIPTION must mention 6 members
    and name ContentGuardian as one of them.
    """
    src = (FRONTEND_ROOT / "components/TeamActivity/AgentHelpModal.tsx").read_text(encoding="utf-8")
    assert "6-member committee" in src
    assert "ContentGuardian" in src
    # Hardcoded chips are gone; replaced with a dynamic count chip
    assert '"6 Committee Agents"' not in src
    assert '"1 Trend Agent"' not in src
    assert '"1 Watchdog Agent"' not in src
    # Dynamic chip must be present
    assert "Committee Members" in src


def test_agent_help_modal_dynamic_count_chip():
    """The chip must use agents.length (not a hardcoded number)
    so adding/removing catalog entries updates the UI automatically.
    """
    src = (FRONTEND_ROOT / "components/TeamActivity/AgentHelpModal.tsx").read_text(encoding="utf-8")
    # Find the label assignment
    m = re.search(r'label=\{`\$\{agents\.length\}', src)
    assert m is not None, "chip label must be dynamic via agents.length"
