"""Tests for strategy_service brand_voice block-level migration (E.3 batch 1)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

MOD = "api.content_planning.services.content_strategy.core.strategy_service"


def _make_svc():
    from api.content_planning.services.content_strategy.core.strategy_service import EnhancedStrategyService
    svc = object.__new__(EnhancedStrategyService)
    svc.onboarding_data_service = MagicMock()
    return svc


def _run(svc, integrated_data):
    strategy = MagicMock()
    strategy.id = 1
    svc.onboarding_data_service.process_onboarding_data = AsyncMock(return_value=integrated_data)
    db = MagicMock()
    with patch(f"{MOD}.OnboardingDataIntegration") as integ_cls, \
         patch(f"{MOD}.create_field_mappings", return_value={}), \
         patch(f"{MOD}.calculate_data_quality_scores", return_value={}):
        integ_cls.return_value = MagicMock(id=1)
        asyncio.run(svc._enhance_strategy_with_onboarding_data(strategy, "u1", db))
    return strategy


class TestBrandVoiceBlockLevelSwitch:
    def test_persona_brand_voice_block_wins(self):
        svc = _make_svc()
        integrated = {
            "canonical_profile": {
                "brand_voice": {"default_tone": "direct", "voice_description": "No jargon"},
                "target_audience": "SaaS founders",
                "industry": "SaaS",
                "content_types": ["blog"],
            },
            "website_analysis": {
                "writing_style": {"tone": "professional"},
                "style_guidelines": {"tone": "formal", "personality": "authoritative", "style": "formal", "voice_characteristics": []},
            },
            "research_preferences": {},
            "competitor_analysis": [],
            "api_keys_data": {},
        }
        strategy = _run(svc, integrated)
        # Whole block from persona, not the legacy extraction.
        assert strategy.brand_voice == {"default_tone": "direct", "voice_description": "No jargon"}

    def test_legacy_fallback_when_no_persona(self):
        svc = _make_svc()
        integrated = {
            "canonical_profile": {},
            "website_analysis": {
                "style_guidelines": {"tone": "formal", "personality": "authoritative", "style": "formal", "voice_characteristics": []},
            },
            "research_preferences": {},
            "competitor_analysis": [],
            "api_keys_data": {},
        }
        strategy = _run(svc, integrated)
        # Legacy extract_brand_voice_from_guidelines shape.
        assert strategy.brand_voice["tone"] == "formal"
        assert strategy.brand_voice["personality"] == "authoritative"
