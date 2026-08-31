"""Guard against catalog prompt templates regressing to static/boilerplate.

These tests encode two invariants that must hold for every agent in the
team catalog:

1. **Personalization** — every template references ``{website_name}`` plus at
   least one role-relevant context field, and only uses placeholders that
   ``build_prompt_context`` can actually populate (no dangling ``{placeholder}``
   that would render as literal text).

2. **Structured output** — task templates must request ``Return JSON`` (never a
   free-form "markdown report"), and the shared task-proposing agents must keep
   the ``tasks array`` contract that ``_parse_task_proposals`` consumes.

A past regression swapped these for a static, non-personalized prompt that asked
for a markdown report instead of structured tasks — silently breaking both
personalization and the committee's proposal parser. These assertions make that
class of change fail loudly.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.intelligence.agents.core_agent_framework import TaskProposal
from services.intelligence.agents.output_contracts import task_output_schema
from services.intelligence.agents.prompt_context import (
    _AGENT_CONTEXT_FIELDS,
    _ALWAYS_FIELDS,
    _DEFAULT_FIELDS,
    build_prompt_context,
)
from services.intelligence.agents.team_catalog import (
    AGENT_TEAM_CATALOG,
    get_agent_catalog_entry,
)


# All placeholder keys are lowercase snake_case (see build_prompt_context).
_PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")

# Agents whose task output is the shared ``tasks`` array contract consumed by
# ``_parse_task_proposals``. Mirrors TestOutputContractDefinitions.
_TASK_PROPOSING_AGENTS = {
    "content_strategist",
    "competitor_analyst",
    "seo_specialist",
    "social_media_manager",
    "content_guardian",
    "strategy_architect",
}

_KNOWN_FIELDS = set(build_prompt_context({}).keys())


def _placeholders(template: str) -> set[str]:
    return set(_PLACEHOLDER_RE.findall(template or ""))


def _defaults(entry) -> dict:
    return entry.get("defaults") or {}


class TestCatalogTemplatesStayPersonalized:
    def test_every_template_references_website_name(self):
        for entry in AGENT_TEAM_CATALOG:
            key = entry["agent_key"]
            defaults = _defaults(entry)
            assert "{website_name}" in defaults.get("system_prompt_template", ""), (
                f"{key}: system_prompt_template must reference {{website_name}}"
            )
            assert "{website_name}" in defaults.get("display_name_template", ""), (
                f"{key}: display_name_template must reference {{website_name}}"
            )

    def test_templates_use_only_known_context_fields(self):
        for entry in AGENT_TEAM_CATALOG:
            key = entry["agent_key"]
            defaults = _defaults(entry)
            for field in ("system_prompt_template", "task_prompt_template", "display_name_template"):
                unknown = _placeholders(defaults.get(field, "")) - _KNOWN_FIELDS
                assert not unknown, (
                    f"{key}.{field}: references unknown placeholders {sorted(unknown)}"
                )

    def test_system_prompts_use_role_relevant_context(self):
        for entry in AGENT_TEAM_CATALOG:
            key = entry["agent_key"]
            sys_tpl = _defaults(entry).get("system_prompt_template", "")
            relevant = set(_ALWAYS_FIELDS + _AGENT_CONTEXT_FIELDS.get(key, _DEFAULT_FIELDS))
            used = _placeholders(sys_tpl) & relevant
            assert used, (
                f"{key}: system prompt must use at least one role-relevant field "
                f"from {sorted(relevant)}"
            )

    def test_system_prompts_are_not_static_boilerplate(self):
        # A static prompt (the regression) only carries "{website_name}".
        # Personalized prompts pull >=2 distinct context fields.
        for entry in AGENT_TEAM_CATALOG:
            key = entry["agent_key"]
            sys_tpl = _defaults(entry).get("system_prompt_template", "")
            assert len(_placeholders(sys_tpl)) >= 2, (
                f"{key}: system prompt appears static/boilerplate "
                f"(only {sorted(_placeholders(sys_tpl))})"
            )


class TestCatalogTemplatesKeepStructuredOutput:
    def test_task_prompts_request_json(self):
        for entry in AGENT_TEAM_CATALOG:
            key = entry["agent_key"]
            task_tpl = _defaults(entry).get("task_prompt_template", "")
            assert "Return JSON" in task_tpl, (
                f"{key}: task_prompt_template must request structured JSON"
            )
            assert "markdown" not in task_tpl.lower(), (
                f"{key}: task_prompt_template must not request a markdown report"
            )

    def test_task_agents_use_tasks_array_contract(self):
        for key in _TASK_PROPOSING_AGENTS:
            entry = get_agent_catalog_entry(key)
            assert entry is not None
            task_tpl = _defaults(entry).get("task_prompt_template", "")
            assert "tasks array" in task_tpl, (
                f"{key}: must keep the shared tasks-array contract"
            )


_NO_FABRICATION_MARKER = "never invent metrics or data"


class TestCatalogTemplatesDeclareNoFabrication:
    def test_all_task_agents_declare_no_fabrication_guard(self):
        """Every task-proposing agent must carry the same honesty guard so
        generated recommendations never fabricate metrics or data. Kept
        identical across agents for consistency and easy removal detection.
        """
        for key in _TASK_PROPOSING_AGENTS:
            entry = get_agent_catalog_entry(key)
            assert entry is not None
            sys_tpl = _defaults(entry).get("system_prompt_template", "")
            assert _NO_FABRICATION_MARKER in sys_tpl, (
                f"{key}: system prompt must declare the no-fabrication guard "
                f"('{_NO_FABRICATION_MARKER}')"
            )


_TASK_FIELD_LIST_RE = re.compile(r"must include\s+(.+?)\.")


def _extract_task_fields(template: str) -> set[str]:
    """Pull the field names from the natural-language contract in a task
    template (``"Every task must include title, description, …, and X."``)."""
    match = _TASK_FIELD_LIST_RE.search(template or "")
    if not match:
        return set()
    raw = match.group(1).replace(" and ", ", ")
    return {field.strip() for field in raw.split(",") if field.strip()}


class TestTaskContractConsistency:
    """The task contract is expressed in four places (natural-language prompt
    field list, the JSON schema passed to the LLM, the ``TaskProposal`` model,
    and ``_parse_task_proposals``). These tests keep the machine-readable
    representations in sync so a field edit in one place can't silently drift.
    """

    def test_schema_keys_exist_on_task_proposal(self):
        schema = task_output_schema("content_strategist")
        schema_keys = set(schema["properties"]["tasks"]["items"]["properties"].keys())
        proposal_fields = set(TaskProposal.__dataclass_fields__.keys())
        missing = schema_keys - proposal_fields
        assert not missing, (
            f"task_output_schema declares fields not present on TaskProposal: "
            f"{sorted(missing)}"
        )

    def test_task_prompt_field_list_matches_schema(self):
        for key in _TASK_PROPOSING_AGENTS:
            entry = get_agent_catalog_entry(key)
            assert entry is not None
            task_tpl = _defaults(entry).get("task_prompt_template", "")
            schema = task_output_schema(key)
            schema_keys = set(schema["properties"]["tasks"]["items"]["properties"].keys())
            prompt_fields = _extract_task_fields(task_tpl)
            assert prompt_fields, f"{key}: task template must list the task fields"
            unknown = prompt_fields - schema_keys
            assert not unknown, (
                f"{key}: task_prompt_template lists fields not in the JSON schema: "
                f"{sorted(unknown)}"
            )
