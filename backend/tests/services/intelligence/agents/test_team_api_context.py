"""Phase 0 safety net: tests for the agent-team API endpoints' context wiring.

Pins:
- ``GET /team``: visible-agent shape, hidden-agent exclusion, ``context_summary``
  derived from canonical onboarding data (and graceful ``{}`` on failure)
- ``POST /team/{agent_key}/preview``: draft > saved > "" precedence, real LLM
  invocation carrying the personalization context into the prompt, 429 mapping
- ``POST /team/{agent_key}``: profile-cache invalidation on save

Endpoints are invoked directly as async functions (FastAPI dependency
overrides are unnecessary since ``current_user``/``db`` are plain params).
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import api.agents_api as agents_api
from api.content_planning.services.content_strategy.onboarding.data_integration import (
    OnboardingDataIntegrationService,
)
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent
from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG


# ---------------------------------------------------------------------------
# Fakes & fixtures
# ---------------------------------------------------------------------------


class ApiProfileRow:
    """Stand-in for models AgentProfile shaped for the API layer."""

    def __init__(
        self,
        agent_key="content_strategist",
        system_prompt=None,
        task_prompt_template=None,
        display_name=None,
    ):
        self.id = 1
        self.user_id = "user_api"
        self.agent_key = agent_key
        self.agent_type = "content_strategist"
        self.display_name = display_name
        self.enabled = True
        self.schedule = None
        self.notification_prefs = None
        self.tone = None
        self.system_prompt = system_prompt
        self.task_prompt_template = task_prompt_template
        self.reporting_prefs = None
        self.created_at = datetime(2026, 1, 1)
        self.updated_at = datetime(2026, 1, 2)


class _ApiQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result if not isinstance(self._result, list) else None

    def all(self):
        if isinstance(self._result, list):
            return self._result
        return [self._result] if self._result is not None else []


class FakeApiDB:
    def __init__(self, result=None):
        self._result = result if result is not None else []

    def query(self, model):
        return _ApiQuery(self._result)

    def add(self, obj):
        pass

    def commit(self):
        pass

    def refresh(self, obj):
        pass

    def close(self):
        pass


def integrated_data():
    return {
        "canonical_profile": {
            "website_name": "Acme",
            "website_url": "https://www.acme.com",
            "industry": "B2B SaaS",
            "target_audience": "SMB founders",
            "brand_voice": "canonical voice",
            "content_pillars": ["AI tooling"],
            "competitors": [{"domain": "rival.io"}],
            "business_goals": ["Grow organic traffic"],
        },
        "persona_data": {
            "core_persona": {
                "identity": {"persona_name": "Ace Analyst", "brand_voice_description": "persona voice"}
            }
        },
        "research_preferences": {
            "research_depth": "deep",
            "content_types": ["blog"],
            "posting_cadence": "3x_week",
        },
        "platform_integrations": {"connected_platforms": ["wordpress"]},
        "linkedin_profile": {"name": "Jane Doe"},
    }


@pytest.fixture(autouse=True)
def _clear_profile_cache():
    BaseALwrityAgent._profile_cache.clear()
    yield
    BaseALwrityAgent._profile_cache.clear()


USER = {"id": "user_api"}


# ---------------------------------------------------------------------------
# GET /team
# ---------------------------------------------------------------------------


class TestGetTeamEndpoint:
    @pytest.mark.asyncio
    async def test_success_shape_with_agents(self, monkeypatch):
        db = FakeApiDB(result=[ApiProfileRow()])
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=db)

        assert resp["success"] is True
        assert resp["user_id"] == "user_api"
        agents = resp["data"]["agents"]
        assert len(agents) > 0
        for agent in agents:
            assert {"agent_key", "agent_type", "role", "responsibilities", "tools", "defaults", "profile"} <= set(agent.keys())
            assert {"display_name", "enabled", "system_prompt", "task_prompt_template"} <= set(agent["profile"].keys())

    @pytest.mark.asyncio
    async def test_hidden_agents_excluded(self, monkeypatch):
        db = FakeApiDB(result=[])
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=db)

        returned_keys = {a["agent_key"] for a in resp["data"]["agents"]}
        hidden_keys = {e["agent_key"] for e in AGENT_TEAM_CATALOG if e.get("hidden")}
        assert hidden_keys, "expected at least one hidden catalog entry"
        assert returned_keys & hidden_keys == set()

    @pytest.mark.asyncio
    async def test_saved_profile_fields_surface_in_response(self, monkeypatch):
        db = FakeApiDB(
            result=[
                ApiProfileRow(system_prompt="MY OVERRIDE", display_name="Strat")
            ]
        )
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=db)

        match = [a for a in resp["data"]["agents"] if a["agent_key"] == "content_strategist"][0]
        assert match["profile"]["system_prompt"] == "MY OVERRIDE"
        assert match["profile"]["display_name"] == "Strat"

    @pytest.mark.asyncio
    async def test_context_summary_from_canonical_data(self, monkeypatch):
        def _fake_get(self, user_id, db):
            return integrated_data()

        monkeypatch.setattr(
            OnboardingDataIntegrationService, "get_integrated_data_sync", _fake_get
        )
        db = FakeApiDB(result=[])
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=db)

        summary = resp["data"]["context_summary"]
        assert summary["website_name"] == "acme"
        assert summary["brand_voice"] == "persona voice"  # persona SSOT wins
        assert summary["profile_name"] == "Jane Doe"
        assert summary["research_depth"] == "deep"
        assert summary["connected_platforms"] == ["wordpress"]
        assert summary["competitors"] == ["rival.io"]  # dicts flattened to names

    @pytest.mark.asyncio
    async def test_context_summary_gracefully_empty_on_failure(self, monkeypatch):
        def _boom(self, user_id, db):
            raise RuntimeError("integration down")

        monkeypatch.setattr(
            OnboardingDataIntegrationService, "get_integrated_data_sync", _boom
        )
        db = FakeApiDB(result=[])
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=db)

        assert resp["success"] is True
        assert resp["data"]["context_summary"] == {}

    @pytest.mark.asyncio
    async def test_context_rendering_still_works_when_integration_fails(self, monkeypatch):
        monkeypatch.setattr(
            OnboardingDataIntegrationService,
            "get_integrated_data_sync",
            lambda self, user_id, db: (_ for _ in ()).throw(RuntimeError("integration down")),
        )
        resp = await agents_api.get_agent_team_endpoint(current_user=USER, db=FakeApiDB(result=[]))

        content = [a for a in resp["data"]["agents"] if a["agent_key"] == "content_strategist"][0]
        assert resp["success"] is True
        assert "rendered_system_prompt" in content["defaults"]
        assert "{brand_voice}" not in content["defaults"]["rendered_system_prompt"]


# ---------------------------------------------------------------------------
# POST /team/{agent_key}/preview
# ---------------------------------------------------------------------------


class TestPreviewEndpoint:
    @pytest.fixture
    def captured_llm(self, monkeypatch):
        import importlib

        captured = {}

        def _fake_llm(prompt="", json_struct=None, user_id=None, **kwargs):
            captured["prompt"] = prompt
            captured["json_struct"] = json_struct
            captured["user_id"] = user_id
            return {
                "sample_output": "PLAN TEXT",
                "next_actions": ["a"],
                "assumptions": [],
            }

        # Patch the module object, not by string path: conftest's sys.modules
        # stubs for "services" / "services.llm_providers" lack cross-attributes,
        # which breaks pytest's dotted-path resolution. The endpoint's local
        # `from ... import llm_text_gen` resolves through sys.modules, so this
        # reaches it.
        mtg = importlib.import_module("services.llm_providers.main_text_generation")
        monkeypatch.setattr(mtg, "llm_text_gen", _fake_llm)
        monkeypatch.setattr(
            OnboardingDataIntegrationService,
            "get_integrated_data_sync",
            lambda self, user_id, db: integrated_data(),
        )
        return captured

    @pytest.mark.asyncio
    async def test_draft_prompts_beat_saved_profile(self, monkeypatch, captured_llm):
        db = FakeApiDB(result=ApiProfileRow(system_prompt="SAVED SYSTEM"))
        body = {"system_prompt": "DRAFT SYSTEM"}

        resp = await agents_api.preview_agent_profile_endpoint(
            agent_key="content_strategist", body=body, current_user=USER, db=db
        )

        assert resp["success"] is True
        assert "DRAFT SYSTEM" in captured_llm["prompt"]
        assert "SAVED SYSTEM" not in captured_llm["prompt"]

    @pytest.mark.asyncio
    async def test_saved_profile_used_when_no_draft(self, monkeypatch, captured_llm):
        db = FakeApiDB(result=ApiProfileRow(system_prompt="SAVED SYSTEM"))
        body = {"context_card": {"website_name": "Acme"}}

        await agents_api.preview_agent_profile_endpoint(
            agent_key="content_strategist", body=body, current_user=USER, db=db
        )

        assert "SAVED SYSTEM" in captured_llm["prompt"]

    @pytest.mark.asyncio
    async def test_no_catalog_fallback_when_nothing_saved(self, monkeypatch, captured_llm):
        """Preview must render exactly what will be saved — an unsaved profile
        previews empty editable sections, never the untouched catalog default."""
        db = FakeApiDB(result=None)

        await agents_api.preview_agent_profile_endpoint(
            agent_key="content_strategist", body={}, current_user=USER, db=db
        )

        prompt = captured_llm["prompt"]
        # Catalog default's signature opening must be absent from the whole prompt.
        assert "You are the Content Strategy Agent for" not in prompt

    @pytest.mark.asyncio
    async def test_context_card_flows_into_prompt(self, monkeypatch, captured_llm):
        db = FakeApiDB(result=None)
        body = {
            "context_card": {
                "preferred_formats": ["carousel"],
                "website_name": "Acme",
            },
        }

        resp = await agents_api.preview_agent_profile_endpoint(
            agent_key="social_media_manager", body=body, current_user=USER, db=db
        )

        prompt = captured_llm["prompt"]
        assert "carousel" in prompt
        assert resp["data"]["display_name"].lower().startswith("acme")

    @pytest.mark.asyncio
    async def test_llm_receives_json_schema_and_user(self, monkeypatch, captured_llm):
        db = FakeApiDB(result=None)

        await agents_api.preview_agent_profile_endpoint(
            agent_key="content_strategist", body={}, current_user=USER, db=db
        )

        assert captured_llm["json_struct"] is not None
        assert "sample_output" in captured_llm["json_struct"]["properties"]
        assert captured_llm["user_id"] == "user_api"
        assert captured_llm["prompt"].count("SAFE PREVIEW") >= 1

    @pytest.mark.asyncio
    async def test_unknown_agent_404(self, monkeypatch, captured_llm):
        db = FakeApiDB(result=None)
        with pytest.raises(HTTPException) as exc:
            await agents_api.preview_agent_profile_endpoint(
                agent_key="nope", body={}, current_user=USER, db=db
            )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_llm_runtime_error_maps_to_429(self, monkeypatch, captured_llm):
        import importlib

        def _limited(*args, **kwargs):
            raise RuntimeError("quota exhausted")

        mtg = importlib.import_module("services.llm_providers.main_text_generation")
        monkeypatch.setattr(mtg, "llm_text_gen", _limited)
        db = FakeApiDB(result=None)
        with pytest.raises(HTTPException) as exc:
            await agents_api.preview_agent_profile_endpoint(
                agent_key="content_strategist", body={}, current_user=USER, db=db
            )
        assert exc.value.status_code == 429


# ---------------------------------------------------------------------------
# POST /team/{agent_key} — cache invalidation
# ---------------------------------------------------------------------------


class TestProfileSaveCacheInvalidation:
    @pytest.mark.asyncio
    async def test_upsert_pops_stale_profile_cache_entry(self, monkeypatch):
        stale = object()
        BaseALwrityAgent._profile_cache["user_api:content_strategist"] = stale

        db = FakeApiDB(result=ApiProfileRow())
        resp = await agents_api.upsert_agent_profile_endpoint(
            agent_key="content_strategist",
            body={"system_prompt": "NEW PROMPT"},
            current_user=USER,
            db=db,
        )

        assert resp["success"] is True
        assert "user_api:content_strategist" not in BaseALwrityAgent._profile_cache
        assert resp["data"]["profile"]["system_prompt"] == "NEW PROMPT"

    @pytest.mark.asyncio
    async def test_other_users_cache_entries_untouched(self, monkeypatch):
        keep = object()
        BaseALwrityAgent._profile_cache["user_other:content_strategist"] = keep

        db = FakeApiDB(result=ApiProfileRow())
        await agents_api.upsert_agent_profile_endpoint(
            agent_key="content_strategist",
            body={"system_prompt": "NEW PROMPT"},
            current_user=USER,
            db=db,
        )

        assert BaseALwrityAgent._profile_cache.get("user_other:content_strategist") is keep

    @pytest.mark.asyncio
    async def test_unknown_agent_key_404_before_any_writes(self, monkeypatch):
        db = FakeApiDB(result=None)
        with pytest.raises(HTTPException) as exc:
            await agents_api.upsert_agent_profile_endpoint(
                agent_key="nope",
                body={"system_prompt": "x"},
                current_user=USER,
                db=db,
            )
        assert exc.value.status_code == 404
