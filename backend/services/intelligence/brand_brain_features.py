"""Brand Brain dashboard feature flags (Phase 0).

Gates the full Brand Brain dashboard surface (backend + frontend) with the
same env-flag discipline as ``strategy_indexer.sif_strategy_feature_flag``:
the env var is read at call time and defaults to ON so the feature ships
without config. Frontend parity lives in ``brandBrainConfig.ts`` and is
asserted against this module's constant by the corresponding vitest.
"""
from __future__ import annotations

import os

BRAND_BRAIN_DASHBOARD_ENABLED = "BRAND_BRAIN_DASHBOARD_ENABLED"


def brand_brain_dashboard_enabled() -> bool:
    """Feature flag: gate the whole Brand Brain dashboard integration."""
    raw = os.getenv(BRAND_BRAIN_DASHBOARD_ENABLED, "1")
    return raw.strip().lower() not in {"0", "false", "no", "off"}