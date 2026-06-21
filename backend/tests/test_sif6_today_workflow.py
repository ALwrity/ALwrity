"""Source-level + lightweight runtime tests for the sif/phase-6
Today's Workflow quick wins: fallback plan, embedding refactor,
LLM model for backfill, polled agent count, content-type -> pillar
mapping, and the AI-Assisted provenance label.
"""
import ast
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(r"C:/Users/diksha rawat/Desktop/ALwrity_github/windsurf/ALwrity/backend")
FRONTEND_ROOT = BACKEND_ROOT.parent / "frontend/src"


def _read_backend(rel: str) -> str:
    return (BACKEND_ROOT / rel).read_text(encoding="utf-8")


def _read_frontend(rel: str) -> str:
    return (FRONTEND_ROOT / rel).read_text(encoding="utf-8")


# ---------- Issue 1: Fallback plan when orchestrator fails ----------

def test_orchestrator_failure_returns_fallback_flag():
    """When the orchestration_service is None or get_or_create_orchestrator
    raises, the committee function must return a fallback marker so
    the caller can set ``fallback_used=True`` on the plan row.
    """
    src = _read_backend("services/today_workflow_service.py")
    # The two known fallback returns in the orchestrator-unavailable
    # path must include the new flag.
    assert '"fallback_used": True' in src, (
        "orchestrator-unavailable paths must return fallback_used=True"
    )
    # And the plan creation must propagate the flag.
    assert "plan_data.get(\"fallback_used\", False)" in src


def test_orchestrator_failure_does_not_return_silent_empty():
    """The previous behavior was to return ``{"date": date, "tasks": []}``
    with no flag. Ensure the orchestrator-failure branches no longer
    return an empty plan with no signal.
    """
    src = _read_backend("services/today_workflow_service.py")
    # The two orchestrator-failure returns (orchestration_service is None
    # AND get_or_create_orchestrator raises) must carry the flag.
    or_none = re.search(
        r"if orchestration_service is None:.*?return\s*\{[^}]+\}",
        src, re.DOTALL,
    )
    assert or_none is not None
    assert "fallback_used" in or_none.group(0)
    or_raise = re.search(
        r"except Exception as e:\s*\n\s*logger\.error.*?return\s*\{[^}]+\}",
        src, re.DOTALL,
    )
    assert or_raise is not None
    assert "fallback_used" in or_raise.group(0)


# ---------- Issue 2: Use index_content() not direct embeddings ----------

def test_record_task_outcome_uses_index_content():
    """record_task_outcome must route through the canonical
    TxtaiIntelligenceService.index_content() method.
    """
    src = _read_backend("services/task_memory_service.py")
    # The new path: index_content is the primary route.
    lines = src.splitlines()
    def_line = None
    for i, line in enumerate(lines):
        if line.lstrip().startswith("async def record_task_outcome("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.lstrip().startswith("async def ") or line.lstrip().startswith("def "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "await self.intelligence.index_content" in body, (
        "record_task_outcome must call index_content() for the canonical path"
    )
    # The direct embeddings.upsert() call must be inside a fallback
    # branch (after the index_content path has already failed), not
    # the primary call site. We skip any references that appear
    # inside a docstring/comment block by walking lines and looking
    # for the first occurrence on a non-comment, non-docstring line.
    body_lines = body.splitlines()
    direct_idx = -1
    cumulative = 0
    for line in body_lines:
        stripped = line.lstrip()
        if ".embeddings.upsert(" in line and not stripped.startswith("#"):
            # Also skip if the line is inside a docstring (starts
            # with triple-quote remnants). We treat lines that
            # contain the call expression outside of a comment
            # as the real call.
            direct_idx = cumulative + line.find(".embeddings.upsert(")
            break
        cumulative += len(line) + 1
    assert direct_idx > 0, (
        "direct embeddings.upsert() call must exist as a fallback path"
    )
    # The direct call should come after the index_content call.
    ic_idx = body.find("await self.intelligence.index_content")
    assert ic_idx > 0, "index_content must be awaited somewhere in the body"
    assert ic_idx < direct_idx, (
        "index_content path must come before direct upsert fallback"
    )


# ---------- Issue 4: Specify LLM model for backfill ----------

def test_pillar_backfill_resolves_tenant_provider():
    """The pillar backfill must read the tenant's provider config
    and pass it to llm_text_gen so the backfill model matches the
    rest of the workflow.
    """
    src = _read_backend("services/today_workflow_service.py")
    assert "_resolve_backfill_provider" in src
    lines = src.splitlines()
    # Find the function definition and walk forward until the next
    # top-level def. The line-walking approach avoids the regex
    # capture bug that bit the SIF-5 tests.
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _build_single_task_for_missing_pillar("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "_resolve_backfill_provider" in body
    assert "preferred_provider=preferred_provider" in body
    assert "model=preferred_model" in body


def test_resolve_backfill_provider_smoke():
    """Round-trip the resolver with a synthetic user_id; the function
    must not raise and must return a 2-tuple of (provider, model).
    """
    if "services.today_workflow_service" in sys.modules:
        del sys.modules["services.today_workflow_service"]
    from services.today_workflow_service import _resolve_backfill_provider
    provider, model = _resolve_backfill_provider("provider_smoke_user_xyz")
    assert provider is None or isinstance(provider, str)
    assert model is None or isinstance(model, str)


# ---------- Issue 5: Count agents from event log, not surviving tasks ----------

def test_generate_agent_enhanced_plan_returns_polled_count():
    """The committee function must include ``committee_agent_count``
    in its return dict so the plan row can store the actual number
    of agents that participated (not just the distinct sources on
    surviving tasks).
    """
    src = _read_backend("services/today_workflow_service.py")
    assert "agents_polled_count = len(active_agents)" in src
    assert '"committee_agent_count": agents_polled_count' in src
    # The plan creation must prefer the polled count over the walk.
    # The source may format the expression across two lines (one
    # identifier on the first line, ``or _count_committee_agents(tasks)``
    # on the second), so we check for the components individually
    # rather than a single literal string.
    assert "committee_polled_count" in src
    assert "or _count_committee_agents(tasks)" in src


def test_count_committee_agents_walks_with_fallback():
    """_count_committee_agents must support a polled count carried
    on a task's metadata for backward compatibility with plans
    generated before this fix.
    """
    src = _read_backend("services/today_workflow_service.py")
    lines = src.splitlines()
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _count_committee_agents("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "polled_count" in body
    assert 'metadata.get("committee_polled_count")' in body


def test_count_committee_agents_runtime_prefers_polled_count():
    """When a task carries committee_polled_count in its metadata,
    the helper must return at least that many agents."""
    from services.today_workflow_service import _count_committee_agents
    tasks = [
        {
            "metadata": {
                "source_agent": "content",
                "committee_polled_count": 6,
            }
        }
    ]
    # Polled count of 6 wins over the single distinct source_agent.
    assert _count_committee_agents(tasks) == 6
    # If polled count is missing, fall back to the distinct-source walk.
    tasks_no_count = [{"metadata": {"source_agent": "content"}}]
    assert _count_committee_agents(tasks_no_count) == 1


# ---------- Issue 7: Map content type to pillar ----------

def test_calendar_pillar_resolver_exists():
    """A _resolve_calendar_pillar() function must exist and dispatch
    on content_type, then platform, then default.
    """
    src = _read_backend("services/today_workflow_service.py")
    assert "def _resolve_calendar_pillar(" in src
    lines = src.splitlines()
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _resolve_calendar_pillar("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "_CALENDAR_CONTENT_PILLAR" in body
    assert "_CALENDAR_PLATFORM_PILLAR" in body
    assert "CALENDAR_DEFAULT_PILLAR" in body


def test_generate_calendar_event_plan_uses_resolver():
    """_generate_calendar_event_plan must call _resolve_calendar_pillar
    instead of the hardcoded constant.
    """
    src = _read_backend("services/today_workflow_service.py")
    lines = src.splitlines()
    def_line = None
    for i, line in enumerate(lines):
        if line.startswith("def _generate_calendar_event_plan("):
            def_line = i
            break
    assert def_line is not None
    body_lines = []
    for line in lines[def_line + 1:]:
        if line.startswith("def ") or line.startswith("class "):
            break
        body_lines.append(line)
    body = "\n".join(body_lines)
    assert "_resolve_calendar_pillar(" in body
    # The hardcoded constant must NOT be the source of pillarId in
    # the per-event dict any more.
    assert '"pillarId": CALENDAR_CONTENT_PILLAR' not in body


def test_calendar_pillar_resolver_runtime():
    """Round-trip the resolver with representative content types."""
    from services.today_workflow_service import _resolve_calendar_pillar
    cases = [
        ("blog_post", "", "generate"),
        ("video", "", "generate"),
        ("linkedin_post", "", "engage"),
        ("seo_page", "", "analyze"),
        ("youtube", "", "publish"),
        ("", "linkedin", "engage"),
        ("", "youtube", "publish"),
        ("", "unknown_platform", "generate"),
        ("", "", "generate"),
    ]
    for content_type, platform, expected in cases:
        got = _resolve_calendar_pillar(content_type, platform)
        assert got == expected, (
            f"_resolve_calendar_pillar({content_type!r}, {platform!r}) "
            f"-> {got!r}, expected {expected!r}"
        )


# ---------- Issue 11: AI-Assisted provenance label ----------

def test_workflow_progress_bar_handles_llm_pillar_backfill():
    """The frontend WorkflowProgressBar must have a label for the
    ``llm_pillar_backfill`` generation mode.
    """
    src = _read_frontend("components/MainDashboard/components/WorkflowProgressBar.tsx")
    assert "llm_pillar_backfill" in src
    # The new label is 'AI-Assisted Plan'
    assert "'AI-Assisted Plan'" in src
    # Find the getProvenanceLabel function body and check the order
    # of the branch checks. We look for the FINAL "return 'Daily Workflow'"
    # (the default fallback) so the test isn't fooled by an early
    # return for missing summary.
    func_start = src.find("const getProvenanceLabel = () => {")
    assert func_start > 0
    func_end = src.find("\n  };", func_start)
    assert func_end > 0
    body = src[func_start:func_end]
    label_idx = body.find("llm_pillar_backfill")
    # Use rfind to pick the LAST 'return Daily Workflow' (the
    # default fallback) rather than an early return for missing
    # summary state.
    fallback_idx = body.rfind("return 'Daily Workflow';")
    assert label_idx > 0, "getProvenanceLabel must reference llm_pillar_backfill"
    assert fallback_idx > 0, "getProvenanceLabel must have a default return"
    assert label_idx < fallback_idx, (
        f"llm_pillar_backfill branch must come before the default fallback "
        f"(label_idx={label_idx}, fallback_idx={fallback_idx})"
    )
