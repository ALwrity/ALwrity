"""Brand Brain dashboard feature-flag predicate (Phase 0).

Gates the new Brand Brain dashboard the same way ``strategy_indexer`` gates
SIF x Strategy: an env var read at call time, default ON in production. The env
name is contractual for the frontend flag parity check
(``frontend/src/config/brandBrainConfig.ts``).
"""

from __future__ import annotations

import os
from unittest.mock import patch

from services.intelligence.brand_brain_features import (
    BRAND_BRAIN_DASHBOARD_ENABLED,
    brand_brain_dashboard_enabled,
)


class TestBrandBrainDashboardFlag:
    def test_env_var_name_contract(self):
        assert BRAND_BRAIN_DASHBOARD_ENABLED == "BRAND_BRAIN_DASHBOARD_ENABLED"

    def test_defaults_to_enabled(self):
        with patch.dict(os.environ, {}, clear=True):
            assert brand_brain_dashboard_enabled() is True

    def test_explicit_enable_truthy(self):
        for value in ("1", "true", "TRUE", "yes", "on"):
            with patch.dict(os.environ, {BRAND_BRAIN_DASHBOARD_ENABLED: value}, clear=True):
                assert brand_brain_dashboard_enabled() is True

    def test_disable_values(self):
        for value in ("0", "false", "FALSE", "no", "off"):
            with patch.dict(os.environ, {BRAND_BRAIN_DASHBOARD_ENABLED: value}, clear=True):
                assert brand_brain_dashboard_enabled() is False