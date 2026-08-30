"""Phase 0 safety net: unit tests for the agent-team context backbone.

Pins the behavior of:
- ``BaseALwrityAgent._load_prompt_context`` (rich onboarding context, fallbacks,
  truncation, caching)
- ``_render_prompt_template`` (placeholder substitution, read-through cache)
- ``get_effective_system_prompt`` / ``get_effective_task_prompt_template``
  (override > arg default > catalog default precedence)
- ``build_task_prompt`` composition
- Catalog template placeholder integrity (every ``{placeholder}`` used by any
  catalog template resolves against the runtime context keys)

These are the methods every specialized agent's runtime prompt flows through;
regressions here silently de-personalize the whole agent team.
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[4]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from api.content_planning.services.content_strategy.onboarding.data_integration import (
    OnboardingDataIntegrationService,
)
from services.intelligence.agents.core_agent_framework import BaseALwrityAgent
from services.intelligence.agents.team_catalog import AGENT_TEAM_CATALOG


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _StubAgent(BaseALwrityAgent):
    """Concrete subclass so we can instantiate without txtai/DB side effects."""

    def _create_txtai_agent(self):  # pragma: no cover - never called
        return None


def make_agent(user_id: str = "user_test", agent_key: str = "content_strategist"):
    """Build a BaseALwrityAgent-shaped object without running its heavy __init__."""
    agent = object.__new__(_StubAgent)
    agent.user_id = user_id
    agent.agent_key = agent_key
    agent.agent_type = agent_key
    return agent


class FakeDB:
    """Minimal session stand-in: truthy, closable."""

    def close(self):
        pass


class ProfileRow:
    """Attribute-compatible stand-in for models AgentProfile."""

    def __init__(self, system_prompt=None, task_prompt_template=None, **extra):
        self.display_name = None
        self.enabled = True
        self.schedule = None
        self.notification_prefs = None
        self.tone = None
        self.system_prompt = system_prompt
        self.task_prompt_template = task_prompt_template
        self.reporting_prefs = None
        for k, v in extra.items():
            setattr(self, k, v)


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result

    def all(self):
        if isinstance(self._result, list):
            return self._result
        return [self._result] if self._result is not None else []


class FakeProfileDB(FakeDB):
    """Session whose query(...).filter(...).first() returns a fixed profile."""

    def __init__(self, profile):
        self.profile = profile

    def query(self, model):
        return _FakeQuery(self.profile)


def integrated_data(**overrides):
    """Realistic integrated_data payload covering persona SSOT + steps 1-5."""
    base = {
        "website_analysis": {
            "website_url": "https://www.acme.com",
            "domain": "acme.com",
        },
        "canonical_profile": {
            "website_name": "Acme",
            "website_url": "https://www.acme.com",
            "domain": "acme.com",
            "industry": "B2B SaaS",
            "target_audience": "SMB founders",
            "brand_voice": "canonical voice fallback",
            "content_pillars": ["AI tooling", "Developer productivity", "DevOps"],
            "competitors": [{"domain": "rival.io"}, {"domain": "competitor.dev"}],
            "business_goals": ["Grow organic traffic", "Launch academy"],
            "writing_style": {"tone": "professional", "voice": "confident"},
        },
        "persona_data": {
            "core_persona": {
                "identity": {
                    "persona_name": "Ace Analyst",
                    "archetype": "The Sage",
                    "core_belief": "Clarity beats cleverness.",
                    "brand_voice_description": "Sharp, evidence-first expert voice",
                },
                "tonal_range": {
                    "default_tone": "confident_professional",
                    "permissible_tones": ["witty", "direct"],
                    "forbidden_tones": ["sarcastic", "condescending"],
                },
                "linguistic_fingerprint": {
                    "lexical_features": {
                        "go_to_phrases": ["here is the thing", "the data shows"],
                        "go_to_words": ["signal", "leverage-free"],
                        "avoid_words": ["synergy", "revolutionary"],
                    }
                },
            }
        },
        "research_preferences": {
            "research_depth": "deep",
            "content_types": ["blog", "linkedin_post"],
            "posting_cadence": "3x_week",
            "target_audience": "research prefs audience",
        },
        "platform_integrations": {
            "connected_platforms": ["wordpress", "linkedin"],
        },
    }
    base.update(overrides)
    return base


def wire_integrated(monkeypatch, data, calls=None):
    """Route OnboardingDataIntegrationService.get_integrated_data_sync to `data`."""

    def _fake_get(self, user_id, db):
        if calls is not None:
            calls.append((user_id, db))
        if isinstance(data, Exception):
            raise data
        return data

    monkeypatch.setattr(
        OnboardingDataIntegrationService,
        "get_integrated_data_sync",
        _fake_get,
    )


def wire_session(monkeypatch, db):
    monkeypatch.setattr(
        "services.intelligence.agents.core_agent_framework.get_session_for_user",
        lambda uid: db,
    )


@pytest.fixture(autouse=True)
def _clear_class_caches():
    """Class-level caches leak between tests — reset before and after each."""
    BaseALwrityAgent._prompt_context_cache.clear()
    BaseALwrityAgent._profile_cache.clear()
    yield
    BaseALwrityAgent._prompt_context_cache.clear()
    BaseALwrityAgent._profile_cache.clear()


# ---------------------------------------------------------------------------
# _load_prompt_context — rich path
# ---------------------------------------------------------------------------


class TestLoadPromptContextRich:
    def test_all_persona_fields_populated(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert ctx["brand_voice"] == "Sharp, evidence-first expert voice"
        assert ctx["persona_name"] == "Ace Analyst"
        assert ctx["archetype"] == "The Sage"
        assert ctx["core_belief"] == "Clarity beats cleverness."
        assert ctx["default_tone"] == "confident_professional"
        assert ctx["permissible_tones"] == "witty, direct"
        assert ctx["forbidden_tones"] == "sarcastic, condescending"
        assert "here is the thing" in ctx["go_to_phrases"]
        assert ctx["avoid_words"] == "synergy, revolutionary"

    def test_business_and_research_fields_populated(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert ctx["industry"] == "B2B SaaS"
        assert ctx["target_audience"] == "SMB founders"  # canonical wins over research prefs
        assert ctx["content_pillars"] == "AI tooling, Developer productivity, DevOps"
        assert ctx["competitors"] == "rival.io, competitor.dev"
        assert ctx["research_depth"] == "deep"
        assert ctx["content_types"] == "blog, linkedin_post"
        assert ctx["connected_platforms"] == "wordpress, linkedin"
        assert ctx["posting_cadence"] == "3x_week"
        assert ctx["business_goals"] == "Grow organic traffic, Launch academy"
        assert ctx["user_id"] == "user_test"

    def test_brand_voice_prefers_persona_identity_over_canonical(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        ctx = agent._load_prompt_context()

        # PersonaData SSOT must win over canonical_profile.brand_voice.
        assert ctx["brand_voice"] != "canonical voice fallback"
        assert ctx["brand_voice"] == "Sharp, evidence-first expert voice"

    def test_website_identity_fields(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert ctx["website_url"] == "https://www.acme.com"
        assert ctx["domain"] == "acme.com"
        assert ctx["website_name"] == "acme"

    def test_writing_style_backcompat_shim(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert ctx["writing_tone"] == "professional"
        assert ctx["writing_voice"] == "confident"


# ---------------------------------------------------------------------------
# _load_prompt_context — fallbacks
# ---------------------------------------------------------------------------


class TestLoadPromptContextFallbacks:
    def test_no_db_session_returns_defaults(self, monkeypatch):
        wire_session(monkeypatch, None)
        agent = make_agent(user_id="user_nodb")

        ctx = agent._load_prompt_context()

        assert ctx == {"website_name": "Your", "website_url": "", "user_id": "user_nodb"}

    def test_integration_failure_returns_defaults(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, RuntimeError("integration exploded"))
        agent = make_agent(user_id="user_boom")

        ctx = agent._load_prompt_context()

        # Whole enrichment is one try/except — a service crash degrades to the
        # same minimal shape as a missing session.
        assert ctx == {"website_name": "Your", "website_url": "", "user_id": "user_boom"}

    def test_empty_integrated_data_yields_empty_strings_not_crash(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, {})
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert ctx["website_name"] == "Your"
        assert ctx["brand_voice"] == ""
        assert ctx["content_pillars"] == ""


# ---------------------------------------------------------------------------
# Truncation & list formatting
# ---------------------------------------------------------------------------


class TestTruncationAndListFormatting:
    def test_long_brand_voice_truncated_with_marker(self, monkeypatch):
        long_voice = "x" * 3000
        data = integrated_data(
            persona_data={
                "core_persona": {"identity": {"brand_voice_description": long_voice}}
            }
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert len(ctx["brand_voice"]) <= 1200
        assert ctx["brand_voice"].endswith("…(truncated)")

    def test_comma_list_of_plain_strings(self, monkeypatch):
        data = integrated_data(
            canonical_profile={
                "content_pillars": ["alpha", "beta"],
            }
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)
        ctx = make_agent()._load_prompt_context()

        assert ctx["content_pillars"] == "alpha, beta"

    def test_comma_list_caps_at_ten_items(self, monkeypatch):
        pillars = [f"pillar_{i}" for i in range(15)]
        data = integrated_data(canonical_profile={"content_pillars": pillars})
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)

        ctx = make_agent()._load_prompt_context()

        assert len(ctx["content_pillars"].split(", ")) == 10

    def test_go_to_phrases_capped_at_twenty(self, monkeypatch):
        phrases = [f"phrase {i}" for i in range(30)]
        data = integrated_data(
            persona_data={
                "core_persona": {
                    "linguistic_fingerprint": {"lexical_features": {"go_to_phrases": phrases}}
                }
            }
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)

        ctx = make_agent()._load_prompt_context()

        assert len(ctx["go_to_phrases"].split(", ")) == 20


class TestContentPillarsExtraction:
    """P1.1: the Exa content-pillar envelope must flatten into agent context."""

    def test_exa_envelope_flattens_into_context(self, monkeypatch):
        envelope = {
            "status": "complete",
            "timestamp": "2026-01-01T00:00:00",
            "target_company": {
                "domain": "acme.com",
                "content_pillars": ["AI tooling", "Developer productivity"],
            },
            "competitors": [
                {"website": "https://rival.io", "company_name": "Rival", "content_pillars": ["Automation", "API guides"]},
                {"website": "https://competitor.dev", "company_name": "Competitor", "content_pillars": ["Developer productivity", "Case studies"]},
            ],
        }
        data = integrated_data(
            canonical_profile={"domain": "acme.com"},
            research_preferences={"content_pillars": envelope},
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)

        ctx = make_agent()._load_prompt_context()

        # Own pillars first, competitor pillars after, deduped.
        assert ctx["content_pillars"] == (
            "AI tooling, Developer productivity, Automation, API guides, Case studies"
        )

    def test_envelope_without_target_uses_competitor_pillars(self, monkeypatch):
        envelope = {
            "competitors": [
                {"website": "https://rival.io", "company_name": "Rival", "content_pillars": ["Automation"]},
            ],
        }
        data = integrated_data(
            canonical_profile={"domain": "acme.com"},
            research_preferences={"content_pillars": envelope},
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)

        ctx = make_agent()._load_prompt_context()

        assert ctx["content_pillars"] == "Automation"

    def test_single_pillar_object_extracted(self, monkeypatch):
        data = integrated_data(
            canonical_profile={"domain": "acme.com"},
            research_preferences={"content_pillars": {"name": "AI"}},
        )
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)

        ctx = make_agent()._load_prompt_context()

        assert ctx["content_pillars"] == "AI"


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


class TestPromptContextCaching:
    def test_second_call_within_ttl_served_from_cache(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        calls = []
        wire_integrated(monkeypatch, integrated_data(), calls=calls)
        agent = make_agent()

        first = agent._load_prompt_context()
        second = agent._load_prompt_context()

        assert len(calls) == 1
        assert first is second  # same cached dict object

    def test_expired_ttl_refetches(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        calls = []
        wire_integrated(monkeypatch, integrated_data(), calls=calls)
        agent = make_agent()

        agent._load_prompt_context()
        assert len(calls) == 1

        # Force-expire the cached entry.
        cached = BaseALwrityAgent._prompt_context_cache["user_test"]
        BaseALwrityAgent._prompt_context_cache["user_test"] = (
            time.time() - 1,
            cached[1],
        )

        agent._load_prompt_context()
        assert len(calls) == 2

    def test_cache_is_per_user(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        seen = {}

        def _fake_get(self, user_id, db):
            seen[user_id] = seen.get(user_id, 0) + 1
            return integrated_data()

        monkeypatch.setattr(
            OnboardingDataIntegrationService, "get_integrated_data_sync", _fake_get
        )

        make_agent(user_id="user_a")._load_prompt_context()
        make_agent(user_id="user_b")._load_prompt_context()
        make_agent(user_id="user_a")._load_prompt_context()

        assert seen == {"user_a": 1, "user_b": 1}


# ---------------------------------------------------------------------------
# Template rendering
# ---------------------------------------------------------------------------


class TestRenderTemplate:
    def test_known_placeholders_replaced(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        out = agent._render_prompt_template(
            "Voice: {brand_voice}; Site: {website_name}; Rivals: {competitors}"
        )

        assert "{brand_voice}" not in out
        assert "Sharp, evidence-first expert voice" in out
        assert "Site: acme" in out
        assert "rival.io, competitor.dev" in out

    def test_unknown_placeholder_left_literal(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent()

        out = agent._render_prompt_template("Keep {not_a_real_field} intact")

        assert "{not_a_real_field}" in out

    def test_render_reads_through_fresh_cache_without_service_call(self, monkeypatch):
        # Prime the cache directly with fresh TTL; rendering must use it and
        # must NOT hit the integration service again.
        BaseALwrityAgent._prompt_context_cache["user_test"] = (
            time.time() + 600,
            {"brand_voice": "cached voice", "user_id": "user_test"},
        )

        def _explode(*args, **kwargs):
            raise AssertionError("service must not be called when cache is fresh")

        wire_session(monkeypatch, FakeDB())
        monkeypatch.setattr(
            OnboardingDataIntegrationService, "get_integrated_data_sync", _explode
        )
        agent = make_agent()

        assert agent._render_prompt_template("{brand_voice}") == "cached voice"


# ---------------------------------------------------------------------------
# Effective prompt precedence
# ---------------------------------------------------------------------------


class TestEffectivePromptPrecedence:
    def test_saved_override_wins_over_catalog_and_arg(self, monkeypatch):
        wire_session(
            monkeypatch,
            FakeProfileDB(ProfileRow(system_prompt="SAVED OVERRIDE {website_name}")),
        )
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent(agent_key="content_strategist")

        out = agent.get_effective_system_prompt(default_prompt="ARG DEFAULT")

        assert out.startswith("SAVED OVERRIDE")
        assert "acme" in out  # rendered
        assert "ARG DEFAULT" not in out

    def test_saved_task_template_override_wins(self, monkeypatch):
        wire_session(
            monkeypatch,
            FakeProfileDB(ProfileRow(task_prompt_template="SAVED TASK {brand_voice}")),
        )
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent(agent_key="content_strategist")

        out = agent.get_effective_task_prompt_template(default_template="ARG TASK")

        assert out.startswith("SAVED TASK")
        assert "Sharp, evidence-first expert voice" in out

    def test_catalog_default_used_when_no_override_no_arg(self, monkeypatch):
        wire_session(monkeypatch, FakeProfileDB(None))
        agent = make_agent(agent_key="content_strategist")

        out = agent.get_effective_system_prompt(default_prompt="")

        assert "Content Strategy Agent" in out
        assert "{brand_voice}" not in out  # catalog placeholders rendered

    def test_arg_default_used_when_no_catalog_entry(self, monkeypatch):
        wire_session(monkeypatch, FakeProfileDB(None))
        agent = make_agent(agent_key="no_such_agent_key")

        out = agent.get_effective_system_prompt(default_prompt="FALLBACK {website_name}")

        assert "FALLBACK" in out

    def test_blank_override_falls_through_to_catalog(self, monkeypatch):
        wire_session(monkeypatch, FakeProfileDB(ProfileRow(system_prompt="   \n  ")))
        agent = make_agent(agent_key="content_strategist")

        out = agent.get_effective_system_prompt(default_prompt="")

        assert "Content Strategy Agent" in out


# ---------------------------------------------------------------------------
# build_task_prompt composition
# ---------------------------------------------------------------------------


class TestBuildTaskPrompt:
    def test_composition_includes_system_template_instruction_context(self, monkeypatch):
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, integrated_data())
        agent = make_agent(agent_key="content_strategist")

        out = agent.build_task_prompt(
            instruction="Propose next actions",
            task_context={"k": "v"},
        )

        assert "Content Strategy Agent" in out  # system prompt
        assert "Instruction: Propose next actions" in out
        assert '"k": "v"' in out  # context JSON

    def test_generic_body_when_no_template_available(self, monkeypatch):
        wire_session(monkeypatch, FakeProfileDB(None))
        agent = make_agent(agent_key="no_such_agent_key")

        out = agent.build_task_prompt(
            instruction="Do thing", task_context={}, default_template=""
        )

        assert "Task: Do thing" in out
        assert "specialized tools" in out

    def test_default_template_used_when_provided(self, monkeypatch):
        wire_session(monkeypatch, FakeProfileDB(None))
        agent = make_agent(agent_key="no_such_agent_key")

        out = agent.build_task_prompt(
            instruction="Do thing",
            task_context={},
            default_template="TEMPLATE MARKER {website_name}",
        )

        assert "TEMPLATE MARKER Your" in out  # empty-context website default


# ---------------------------------------------------------------------------
# Catalog placeholder integrity
# ---------------------------------------------------------------------------

_KNOWN_CONTEXT_KEYS = {
    "user_id", "website_url", "website_name", "domain", "industry",
    "brand_voice", "target_audience", "content_pillars", "competitors",
    "research_depth", "content_types", "connected_platforms",
    "posting_cadence", "business_goals", "persona_name", "archetype",
    "core_belief", "default_tone", "permissible_tones", "forbidden_tones",
    "go_to_phrases", "go_to_words", "avoid_words", "writing_tone",
    "writing_voice",
    "style_guidelines", "seo_summary",
}

_PLACEHOLDER_RE = re.compile(r"\{([a-z_][a-z0-9_]*)\}")


def _all_templates():
    for entry in AGENT_TEAM_CATALOG:
        defaults = entry.get("defaults") or {}
        for field in ("system_prompt_template", "task_prompt_template"):
            template = defaults.get(field)
            if template:
                yield entry.get("agent_key"), field, template


class TestCatalogPlaceholderIntegrity:
    def test_every_template_placeholder_resolves_at_runtime(self):
        """A placeholder that never resolves renders literally into the LLM
        prompt at runtime — this catches typos like {compitators} forever."""
        unresolved = []
        for agent_key, field, template in _all_templates():
            for name in _PLACEHOLDER_RE.findall(template):
                if name not in _KNOWN_CONTEXT_KEYS:
                    unresolved.append(f"{agent_key}.{field}: {{{name}}}")
        assert unresolved == [], f"unresolvable placeholders: {unresolved}"

    def test_visible_agents_declare_brand_context_block(self):
        """Each visible agent's system prompt should carry a Brand context
        section — that is what makes the team view 'context-aware'."""
        for entry in AGENT_TEAM_CATALOG:
            if entry.get("hidden"):
                continue
            template = (entry.get("defaults") or {}).get("system_prompt_template") or ""
            assert "Brand context:" in template, f"{entry.get('agent_key')} missing Brand context block"


class TestResolvePostingCadence:
    """Unit tests for _resolve_posting_cadence fallback chain."""

    def test_research_posting_cadence_wins(self):
        from services.intelligence.agents.prompt_context import _resolve_posting_cadence

        research = {"posting_cadence": "3x_week"}
        persona = {}
        platforms = {}

        result = _resolve_posting_cadence(research, persona, platforms)

        assert result == "3x_week"

    def test_research_recommended_settings_fallback(self):
        from services.intelligence.agents.prompt_context import _resolve_posting_cadence

        research = {
            "research_depth": "deep",
            "recommended_settings": {"posting_frequency": "weekly"}
        }
        persona = {}
        platforms = {}

        result = _resolve_posting_cadence(research, persona, platforms)

        assert result == "weekly"

    def test_persona_platform_personas_fallback(self):
        from services.intelligence.agents.prompt_context import _resolve_posting_cadence

        research = {"research_depth": "deep"}
        persona = {
            "platform_personas": {
                "linkedin": {
                    "engagement_patterns": {"posting_frequency": "2-3 times per week"}
                }
            }
        }
        platforms = {}

        result = _resolve_posting_cadence(research, persona, platforms)

        assert result == "2-3 times per week"

    def test_platform_integrations_fallback(self):
        from services.intelligence.agents.prompt_context import _resolve_posting_cadence

        research = {"research_depth": "deep"}
        persona = {}
        platforms = {"postingCadence": "daily"}

        result = _resolve_posting_cadence(research, persona, platforms)

        assert result == "daily"

    def test_returns_empty_when_no_sources(self):
        from services.intelligence.agents.prompt_context import _resolve_posting_cadence

        research = {}
        persona = {}
        platforms = {}

        result = _resolve_posting_cadence(research, persona, platforms)

        assert result == ""


class TestP2xSMMFields:
    """P2.x: SMM agent rich fields from integrated data."""

    def test_growth_summary_from_research(self, monkeypatch):
        """growth_summary includes research depth and auto_research."""
        from services.intelligence.agents.prompt_context import _build_growth_summary

        research = {
            "research_depth": "deep",
            "auto_research": True,
        }
        competitor_analysis = []
        platforms = {}

        result = _build_growth_summary(research, competitor_analysis, platforms)

        assert "Research depth: deep" in result
        assert "Auto-research enabled" in result

    def test_growth_summary_from_competitors(self, monkeypatch):
        """growth_summary includes competitor count."""
        from services.intelligence.agents.prompt_context import _build_growth_summary

        research = {}
        competitor_analysis = [{"domain": "comp1.com"}, {"domain": "comp2.com"}]
        platforms = {}

        result = _build_growth_summary(research, competitor_analysis, platforms)

        assert "Tracking 2 competitors" in result

    def test_growth_summary_from_platforms(self, monkeypatch):
        """growth_summary includes connected platforms."""
        from services.intelligence.agents.prompt_context import _build_growth_summary

        research = {}
        competitor_analysis = []
        platforms = {"connected_platforms": ["wordpress", "linkedin"]}

        result = _build_growth_summary(research, competitor_analysis, platforms)

        assert "Connected platforms" in result
        assert "wordpress" in result
        assert "linkedin" in result

    def test_preferred_formats_from_research(self, monkeypatch):
        """preferred_formats sourced from research content_types."""
        data = integrated_data(overrides={
            "research_preferences": {
                "content_types": ["blog", "linkedin_post", "twitter_thread"],
                "posting_cadence": None,
            },
        })
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert "preferred_formats" in ctx
        assert len(ctx["preferred_formats"]) > 0

    def test_content_topics_from_content_pillars(self, monkeypatch):
        """content_topics sourced from content_pillars."""
        data = integrated_data(overrides={
            "research_preferences": {
                "content_pillars": ["AI tooling", "Developer productivity"],
            },
        })
        wire_session(monkeypatch, FakeDB())
        wire_integrated(monkeypatch, data)
        agent = make_agent()

        ctx = agent._load_prompt_context()

        assert "AI tooling" in ctx["content_topics"]
        assert "Developer productivity" in ctx["content_topics"]

    def test_engagement_goals_from_persona(self, monkeypatch):
        """engagement_goals sourced from persona primary_goal."""
        from services.intelligence.agents.prompt_context import _build_engagement_goals

        persona = {
            "core_persona": {
                "primary_goal": "Build thought leadership"
            }
        }
        research = {}

        result = _build_engagement_goals(persona, research)

        assert "Build thought leadership" in result

    def test_engagement_goals_from_platform_persona(self, monkeypatch):
        """engagement_goals sourced from platform persona engagement_patterns."""
        from services.intelligence.agents.prompt_context import _build_engagement_goals

        persona = {
            "platform_personas": {
                "linkedin": {
                    "engagement_patterns": {
                        "primary_goal": "Increase brand awareness"
                    }
                }
            }
        }
        research = {}

        result = _build_engagement_goals(persona, research)

        assert "Increase brand awareness" in result

    def test_engagement_goals_from_research(self, monkeypatch):
        """engagement_goals sourced from research engagement_goals."""
        from services.intelligence.agents.prompt_context import _build_engagement_goals

        persona = {}
        research = {
            "engagement_goals": ["Drive traffic", "Generate leads"]
        }

        result = _build_engagement_goals(persona, research)

        assert "Drive traffic" in result
        assert "Generate leads" in result


class TestP3xBusinessGoals:
    """P3.x: business_goals fallback chain for agent context."""

    def test_canonical_business_goals_wins(self):
        """business_goals from canonical profile takes precedence."""
        from services.intelligence.agents.prompt_context import _resolve_business_goals

        canonical = {"business_goals": ["Grow traffic", "Generate leads"]}
        research = {"business_goals": ["Other goal"]}
        persona = {"core_persona": {"primary_goal": "Persona goal"}}

        result = _resolve_business_goals(canonical, research, persona)

        assert "Grow traffic" in result
        assert "Generate leads" in result
        assert "Other goal" not in result

    def test_research_business_goals_fallback(self):
        """business_goals falls back to research preferences."""
        from services.intelligence.agents.prompt_context import _resolve_business_goals

        canonical = {}
        research = {"business_goals": ["Increase conversions"]}
        persona = {}

        result = _resolve_business_goals(canonical, research, persona)

        assert "Increase conversions" in result

    def test_persona_primary_goal_fallback(self):
        """business_goals falls back to persona primary_goal."""
        from services.intelligence.agents.prompt_context import _resolve_business_goals

        canonical = {}
        research = {}
        persona = {
            "core_persona": {
                "primary_goal": "Build thought leadership"
            }
        }

        result = _resolve_business_goals(canonical, research, persona)

        assert "Build thought leadership" in result

    def test_returns_empty_when_no_sources(self):
        """Returns empty list when no sources provide business_goals."""
        from services.intelligence.agents.prompt_context import _resolve_business_goals

        canonical = {}
        research = {}
        persona = {}

        result = _resolve_business_goals(canonical, research, persona)

        assert result == []
