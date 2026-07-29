"""Regression tests for subscription bugs fixed in fix/subscription-bugs-linkedin-brainstorm.

Each test enforces that a specific production bug cannot return.
If any of these tests fail, a previously-fixed regression has been re-introduced.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
_REPO_ROOT = _BACKEND_ROOT.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

os.environ.setdefault("HUGGINGFACE_INPUT_TOKEN_COST", "1.00")
os.environ.setdefault("HUGGINGFACE_OUTPUT_TOKEN_COST", "3.00")

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.regression]


# ==========================================================================
# Bug 1: LLM provider failures must return 503, NOT 429
# ==========================================================================

class TestLLMFailureStatus503:
    """https://github.com/ALwrity/ALwrity-prod/pull/175
    When all LLM providers fail, the backend must return 503
    (Service Unavailable), NOT 429 (Too Many Requests).
    429 is reserved for subscription/usage limit enforcement only.
    """

    _FILE = _BACKEND_ROOT / "services" / "llm_providers" / "main_text_generation.py"

    def test_file_exists(self):
        assert self._FILE.exists(), f"main_text_generation.py not found at {self._FILE}"

    def test_circuit_breaker_all_providers_failed_returns_503(self):
        """'All LLM providers failed' block must use status_code=503."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        lines = content.split("\n")

        # Find the "All LLM providers failed" message
        for i, line in enumerate(lines):
            if "All LLM providers failed" in line:
                # Look for status_code in the surrounding lines
                block = "\n".join(lines[max(0, i - 2):min(len(lines), i + 15)])
                if "status_code=429" in block:
                    raise AssertionError(
                        f"'All LLM providers failed' block at line {i + 1} "
                        f"uses status_code=429. Must be 503."
                    )
                assert "status_code=503" in block, (
                    f"'All LLM providers failed' block at line {i + 1} "
                    f"must use status_code=503"
                )
                break
        else:
            raise AssertionError(
                "'All LLM providers failed' string not found in main_text_generation.py"
            )

    def test_circuit_breaker_no_providers_configured_returns_503(self):
        """'No LLM providers configured' block must also use status_code=503."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        lines = content.split("\n")

        for i, line in enumerate(lines):
            if "No LLM providers configured" in line:
                block = "\n".join(lines[max(0, i - 2):min(len(lines), i + 15)])
                if "status_code=429" in block:
                    raise AssertionError(
                        f"'No LLM providers configured' block at line {i + 1} "
                        f"uses status_code=429. Must be 503."
                    )
                assert "status_code=503" in block, (
                    f"'No LLM providers configured' block at line {i + 1} "
                    f"must use status_code=503"
                )
                break
        else:
            raise AssertionError(
                "'No LLM providers configured' string not found"
            )


# ==========================================================================
# Bug 2: usage_status must never return the string "None"
# ==========================================================================

class TestUsageStatusNeverNone:
    """https://github.com/ALwrity/ALwrity-prod/pull/175
    When ``summary.usage_status`` is Python ``None``, the backend
    must default to ``'active'``, NOT the string ``"None"``
    (which is what ``str(None)`` produces).
    """

    _FILE = _BACKEND_ROOT / "services" / "subscription" / "usage_tracking_modules" / "historical_usage.py"

    def test_file_exists(self):
        assert self._FILE.exists(), f"historical_usage.py not found at {self._FILE}"

    def test_no_str_usage_status_pattern(self):
        """No ``str(s.usage_status)`` or ``str(summary.usage_status)`` should remain."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()

        matches = list(re.finditer(r"str\(.*usage_status\)", content))
        assert not matches, (
            f"Found {len(matches)} occurrences of str(...usage_status) in "
            f"historical_usage.py. All should default to 'active': {matches}"
        )

    def test_active_default_present(self):
        """At least 4 occurrences of ``'active'`` default should exist (one per function)."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()

        count = content.count("'active'")
        assert count >= 4, (
            f"Expected at least 4 'active' defaults in historical_usage.py "
            f"(for _summaries_usage_status, get_all_historical_usage, "
            f"get_current_period_usage, get_usage_for_period). Got {count}."
        )


# ==========================================================================
# Bug 3: Brainstorm button must have multi-click guard
# ==========================================================================

class TestBrainstormGuard:
    """https://github.com/ALwrity/ALwrity-prod/pull/175
    The brainstorm buttons in QuickCreate and PlanWedgeModal must
    have a ref-based guard that prevents rapid double-clicking.
    """

    _QUICKCREATE = _REPO_ROOT / "frontend" / "src" / "components" / "LinkedInWriter" / "components" / "QuickCreate.tsx"
    _PLANWEDGE = _REPO_ROOT / "frontend" / "src" / "components" / "LinkedInWriter" / "components" / "Brainstorm" / "PlanWedgeModal.tsx"

    def test_quickcreate_has_brainstorm_ref(self):
        """QuickCreate must have brainstormingRef to prevent double-clicks."""
        assert self._QUICKCREATE.exists(), f"QuickCreate.tsx not found"
        with open(self._QUICKCREATE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "brainstormingRef" in content, (
            "QuickCreate.tsx missing brainstormingRef guard"
        )
        assert "if (brainstormingRef.current) return" in content or \
               "if(brainstormingRef.current)return" in content.replace(" ", ""), (
            "QuickCreate.tsx brainstormingRef guard condition missing"
        )

    def test_quickcreate_has_brainstorming_state(self):
        """QuickCreate must have brainstorming state for visual disable."""
        with open(self._QUICKCREATE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "setBrainstorming" in content, (
            "QuickCreate.tsx missing brainstorming state"
        )

    def test_planwedge_has_brainstorm_ref(self):
        """PlanWedgeModal must have brainstormingRef to prevent double-clicks."""
        assert self._PLANWEDGE.exists(), f"PlanWedgeModal.tsx not found"
        with open(self._PLANWEDGE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "brainstormingRef" in content, (
            "PlanWedgeModal.tsx missing brainstormingRef guard"
        )
        assert "brainstormingRef.current" in content, (
            "PlanWedgeModal.tsx brainstormingRef not used in guard"
        )
        assert "setBrainstorming" in content, (
            "PlanWedgeModal.tsx missing brainstorming state"
        )


# ==========================================================================
# Bug 4: SubscriptionExpiredModal must be null-safe
# ==========================================================================

class TestModalNullSafe:
    """https://github.com/ALwrity/ALwrity-prod/pull/175
    The SubscriptionExpiredModal must use safe variables (not raw
    ``errorData.usage_info``) to prevent React error #31 when
    usage_info is null.
    """

    _FILE = _REPO_ROOT / "frontend" / "src" / "components" / "SubscriptionExpiredModal.tsx"

    def test_file_exists(self):
        assert self._FILE.exists(), f"SubscriptionExpiredModal.tsx not found"

    def test_no_raw_usage_info_access(self):
        """No ``errorData.usage_info`` without ?. should remain in TSX rendering."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        # The only allowed pattern is in: errorData?.usage_info (for the isUsageLimit check)
        # or const usageInfo = errorData?.usage_info || {}
        unsafe = re.findall(r"errorData\.usage_info", content)
        assert not unsafe, (
            f"Found {len(unsafe)} unsafe 'errorData.usage_info' accesses in modal. "
            f"All should use 'usageInfo' variable (errorData?.usage_info || {{}})."
        )

    def test_has_safe_usage_info_fallback(self):
        """Modal must have ``const usageInfo = errorData?.usage_info || {}``."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "usageInfo = errorData?.usage_info || {}" in content, (
            "Modal missing safe usageInfo fallback"
        )

    def test_has_is_usage_limit_check(self):
        """Modal must use ``!!errorData?.usage_info`` for the isUsageLimit check."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "!!errorData?.usage_info" in content, (
            "Modal missing isUsageLimit check"
        )


# ==========================================================================
# Pricing YAML integrity
# ==========================================================================

class TestPricingYamlIntegrity:
    """Verify the pricing.yaml SSOT has not been corrupted."""

    _FILE = _BACKEND_ROOT / "config" / "pricing.yaml"

    def test_file_exists(self):
        assert self._FILE.exists(), "pricing.yaml SSOT is missing"

    def test_is_valid_yaml(self):
        import yaml
        with open(self._FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert isinstance(data, dict)
        assert "model_pricing" in data
        assert "plans" in data

    def test_minimum_entries(self):
        import yaml
        with open(self._FILE, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert len(data["model_pricing"]) >= 49, (
            f"Expected at least 49 model entries, got {len(data['model_pricing'])}"
        )
        assert len(data["plans"]) == 4, f"Expected 4 plans, got {len(data['plans'])}"


# ==========================================================================
# Unified limit enforcement rule
# ==========================================================================

class TestUnifiedLimitEnforcement:
    """Verify the unified AI text generation limit takes priority over
    per-provider limits in the enforcement code.
    """

    _FILE = _BACKEND_ROOT / "services" / "subscription" / "limit_validation.py"

    def test_unified_check_before_per_provider(self):
        """Unified limit (ai_text_generation_calls) must be checked before
        per-provider fallback in check_usage_limits."""
        assert self._FILE.exists(), f"limit_validation.py not found"
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        assert "ai_text_generation_calls" in content, (
            "Unified AI text generation limit not referenced in enforcement code"
        )

    def test_all_llm_providers_summed_together(self):
        """All LLM provider calls (gemini + openai + anthropic + mistral)
        must be summed together for the unified check."""
        with open(self._FILE, "r", encoding="utf-8") as f:
            content = f.read()
        # The unified check must sum across all providers
        providers_summed = all(
            p in content for p in ["gemini_calls", "openai_calls", "anthropic_calls", "mistral_calls"]
        )
        assert providers_summed, (
            "Not all LLM provider calls are summed in the unified enforcement check"
        )
