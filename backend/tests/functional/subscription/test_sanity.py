"""Sanity tests for subscription pricing configuration.

Validates the pricing.yaml SSOT independently — no database or
PricingConfigLoader dependency. Parses YAML directly and verifies
entry counts, provider distribution, plan structure, env var patterns,
and data integrity.
"""

from __future__ import annotations

import os
import re
import sys
from collections import Counter
from pathlib import Path

import pytest
import yaml

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

PRICING_YAML = _BACKEND_ROOT / "config" / "pricing.yaml"

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.smoke]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def raw_config():
    """Load the raw YAML dict once per module."""
    assert PRICING_YAML.exists(), f"pricing.yaml not found at {PRICING_YAML}"
    with open(PRICING_YAML, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _model_entries(raw):
    return raw.get("model_pricing", [])


def _plan_entries(raw):
    return raw.get("plans", [])


# ---------------------------------------------------------------------------
# Entry count
# ---------------------------------------------------------------------------

class TestPricingEntryCount:
    """Verify the expected number of pricing entries and plans."""

    def test_model_pricing_count(self, raw_config):
        assert len(_model_entries(raw_config)) == 49

    def test_plan_count(self, raw_config):
        assert len(_plan_entries(raw_config)) == 4


# ---------------------------------------------------------------------------
# Provider distribution
# ---------------------------------------------------------------------------

class TestProviderDistribution:
    _EXPECTED = {
        "gemini": 14, "openai": 2, "anthropic": 1, "mistral": 3,
        "tavily": 1, "serper": 1, "metaphor": 1, "firecrawl": 1,
        "exa": 1, "stability": 3, "image_edit": 3, "video": 8,
        "audio": 7, "wavespeed": 3,
    }

    def test_provider_counts_match(self, raw_config):
        actual = Counter(e["provider"] for e in _model_entries(raw_config))
        for p, expected in self._EXPECTED.items():
            assert actual.get(p, 0) == expected, f"Provider '{p}'"


# ---------------------------------------------------------------------------
# No duplicates
# ---------------------------------------------------------------------------

class TestNoDuplicates:
    def test_no_duplicate_models(self, raw_config):
        keys = [(e["provider"], e["model"]) for e in _model_entries(raw_config)]
        dupes = [(k, v) for k, v in Counter(keys).items() if v > 1]
        assert not dupes, f"Duplicates: {dupes}"

    def test_no_duplicate_plan_names(self, raw_config):
        names = [p["name"] for p in _plan_entries(raw_config)]
        dupes = [(k, v) for k, v in Counter(names).items() if v > 1]
        assert not dupes, f"Duplicate plan names: {dupes}"


# ---------------------------------------------------------------------------
# Non-zero cost
# ---------------------------------------------------------------------------

class TestNonZeroCost:
    _COST_FIELDS = ["per_request", "per_image", "per_page", "per_search",
                     "input_per_1m_tokens", "output_per_1m_tokens"]

    def test_every_entry_has_cost(self, raw_config):
        zero = []
        for e in _model_entries(raw_config):
            vals = [e.get(f, 0) or 0 for f in self._COST_FIELDS]
            if all(v == 0 for v in vals):
                zero.append(f"{e['provider']}:{e['model']}")
        assert not zero, f"Zero-cost entries: {zero}"


# ---------------------------------------------------------------------------
# Plan structure
# ---------------------------------------------------------------------------

class TestPlanLimits:
    _EXPECTED_LIMIT_COUNT = 19

    def test_limits_have_limit_suffix(self, raw_config):
        for plan in _plan_entries(raw_config):
            for key in (plan.get("limits") or {}):
                assert key.endswith("_limit"), (
                    f"Plan '{plan['name']}' key '{key}' missing '_limit'"
                )

    def test_all_plans_have_same_limit_keys(self, raw_config):
        plans = _plan_entries(raw_config)
        ref = set(plans[0].get("limits", {}).keys())
        for p in plans[1:]:
            assert set(p.get("limits", {}).keys()) == ref, (
                f"Plan '{p['name']}' keys differ from '{plans[0]['name']}'"
            )

    def test_limit_count_per_plan(self, raw_config):
        for plan in _plan_entries(raw_config):
            assert len(plan.get("limits", {})) == self._EXPECTED_LIMIT_COUNT, (
                f"Plan '{plan['name']}' has {len(plan.get('limits', {}))} limits"
            )


# ---------------------------------------------------------------------------
# Plan tiers and values
# ---------------------------------------------------------------------------

class TestPlanValues:
    def test_plan_tiers_in_order(self, raw_config):
        expected = ["free", "basic", "pro", "enterprise"]
        actual = [p["tier"] for p in _plan_entries(raw_config)]
        assert actual == expected

    def test_free_plan_values(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["name"] == "Free"
        assert f["price_monthly"] == 0
        assert f["price_yearly"] == 0
        assert f["monthly_cost_cap"] == 2.0

    def test_basic_plan_values(self, raw_config):
        b = _plan_entries(raw_config)[1]
        assert b["name"] == "Basic"
        assert b["price_monthly"] == 29
        assert b["price_yearly"] == 290
        assert b["monthly_cost_cap"] == 25.0

    def test_pro_plan_values(self, raw_config):
        p = _plan_entries(raw_config)[2]
        assert p["name"] == "Pro"
        assert p["price_monthly"] == 79
        assert p["price_yearly"] == 790
        assert p["monthly_cost_cap"] == 100.0

    def test_enterprise_plan_values(self, raw_config):
        e = _plan_entries(raw_config)[3]
        assert e["name"] == "Enterprise"
        assert e["price_monthly"] == 199
        assert e["price_yearly"] == 1990
        assert e["monthly_cost_cap"] == 500.0


# ---------------------------------------------------------------------------
# Free plan specific limits
# ---------------------------------------------------------------------------

class TestFreePlanLimits:
    def test_ai_text_generation_calls(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["limits"].get("ai_text_generation_calls_limit") == 50

    def test_openai_disabled(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["limits"].get("openai_calls_limit") == 0
        assert f["limits"].get("openai_tokens_limit") == 0

    def test_anthropic_disabled(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["limits"].get("anthropic_calls_limit") == 0
        assert f["limits"].get("anthropic_tokens_limit") == 0

    def test_exa_search_limit(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["limits"].get("exa_calls_limit") == 10

    def test_gemini_tokens(self, raw_config):
        f = _plan_entries(raw_config)[0]
        assert f["limits"].get("gemini_tokens_limit") == 50000


# ---------------------------------------------------------------------------
# Env var patterns
# ---------------------------------------------------------------------------

_ENV_PATTERN = re.compile(r"\$\{(\w+):-([^}]*)\}")

class TestEnvVarPatterns:
    def test_mistral_entries_have_env_vars(self, raw_config):
        mistral = [e for e in _model_entries(raw_config) if e["provider"] == "mistral"]
        assert len(mistral) == 3
        for e in mistral:
            inp = str(e.get("input_per_1m_tokens", ""))
            out = str(e.get("output_per_1m_tokens", ""))
            assert _ENV_PATTERN.match(inp), (
                f"{e['model']}: input '{inp}' not an env var pattern"
            )
            assert _ENV_PATTERN.match(out), (
                f"{e['model']}: output '{out}' not an env var pattern"
            )

    def test_env_var_defaults_present(self, raw_config):
        mistral = [e for e in _model_entries(raw_config) if e["provider"] == "mistral"]
        for e in mistral:
            inp = str(e["input_per_1m_tokens"])
            out = str(e["output_per_1m_tokens"])
            m_inp = _ENV_PATTERN.match(inp)
            m_out = _ENV_PATTERN.match(out)
            assert m_inp, f"{e['model']} input no default"
            assert m_out, f"{e['model']} output no default"
            assert m_inp.group(2), f"{e['model']} input has empty default"
            assert m_out.group(2), f"{e['model']} output has empty default"


# ---------------------------------------------------------------------------
# Valid provider names
# ---------------------------------------------------------------------------

class TestValidProviders:
    """All provider strings should map to known APIProvider enum values."""

    _VALID = {
        "gemini", "openai", "anthropic", "mistral", "tavily", "serper",
        "metaphor", "firecrawl", "exa", "stability", "image_edit",
        "video", "audio", "wavespeed",
    }

    def test_all_providers_recognized(self, raw_config):
        for e in _model_entries(raw_config):
            assert e["provider"] in self._VALID, (
                f"Unknown provider '{e['provider']}' for {e['model']}"
            )


# ---------------------------------------------------------------------------
# Valid plan tiers
# ---------------------------------------------------------------------------

class TestValidTiers:
    _VALID = {"free", "basic", "pro", "enterprise"}

    def test_all_tiers_recognized(self, raw_config):
        for p in _plan_entries(raw_config):
            assert p["tier"] in self._VALID, f"Unknown tier '{p['tier']}'"
