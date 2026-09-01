"""Pricing regression test suite for verified AI models (Issues #495, #496, #497).

Validates that services.subscription.pricing_lookup returns the correct, known
pricing values from pricing.yaml (Single Source of Truth) for:
- FLUX Kontext Pro: $0.04/image ($0.04/edit)
- Qwen Image: $0.03/generation, $0.02/edit
- Ideogram V3 Turbo: $0.03-$0.05/run ($0.05/image)
- MiniMax TTS: character-based cost at 500, 1000, 2500, 4000 chars ($0.00005/char)
- InfiniteTalk: duration-aware cost at 5s ($0.30), 15s ($0.90), and 20s ($1.20)

Functional / sanity tests only — mocks any external calls and verifies SSOT lookup.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.subscription.pricing_lookup import (
    PricingLookup,
    get_image_model_cost,
    get_image_edit_model_cost,
    get_audio_cost_per_token,
    get_audio_tts_cost,
    get_video_model_cost,
    get_video_cost,
)
from models.subscription_models import APIProvider

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.regression]


# ==========================================================================
# 1. FLUX Kontext Pro ($0.04 / image, $0.04 / edit)
# ==========================================================================

class TestFluxKontextProPricing:
    """FLUX Kontext Pro pricing validation (verified in #495)."""

    def test_flux_kontext_pro_image_generation_cost(self):
        """FLUX Kontext Pro must return $0.04 per image generation."""
        cost_short = PricingLookup.get_image_cost("flux-kontext-pro")
        cost_full = PricingLookup.get_image_cost("wavespeed-ai/flux-kontext-pro")
        cost_helper = get_image_model_cost("flux-kontext-pro")

        assert cost_short == 0.04, f"Expected $0.04, got {cost_short}"
        assert cost_full == 0.04, f"Expected $0.04, got {cost_full}"
        assert cost_helper == 0.04, f"Expected $0.04, got {cost_helper}"

    def test_flux_kontext_pro_image_edit_cost(self):
        """FLUX Kontext Pro must return $0.04 per image edit."""
        cost_short = PricingLookup.get_image_edit_cost("flux-kontext-pro")
        cost_full = PricingLookup.get_image_edit_cost("wavespeed-ai/flux-kontext-pro")
        cost_helper = get_image_edit_model_cost("flux-kontext-pro")

        assert cost_short == 0.04, f"Expected $0.04, got {cost_short}"
        assert cost_full == 0.04, f"Expected $0.04, got {cost_full}"
        assert cost_helper == 0.04, f"Expected $0.04, got {cost_helper}"

    def test_flux_kontext_pro_entry_details(self):
        """Direct entry lookup should confirm stability provider and $0.04 unit cost."""
        entry = PricingLookup.get_entry("flux-kontext-pro", provider="stability")
        assert entry is not None, "flux-kontext-pro entry not found"
        assert entry.cost_per_image == 0.04 or entry.cost_per_request == 0.04


# ==========================================================================
# 2. Qwen Image ($0.03 / generation, $0.02 / edit)
# ==========================================================================

class TestQwenImagePricing:
    """Qwen Image generation and editing pricing validation (verified in #495)."""

    def test_qwen_image_generation_cost(self):
        """Qwen Image generation must return $0.03 per image."""
        cost_short = PricingLookup.get_image_cost("qwen-image")
        cost_full = PricingLookup.get_image_cost("wavespeed-ai/qwen-image")
        cost_helper = get_image_model_cost("qwen-image")

        assert cost_short == 0.03, f"Expected $0.03, got {cost_short}"
        assert cost_full == 0.03, f"Expected $0.03, got {cost_full}"
        assert cost_helper == 0.03, f"Expected $0.03, got {cost_helper}"

    def test_qwen_image_edit_cost(self):
        """Qwen Image edit variants must return $0.02 per edit."""
        edit_models = [
            "qwen-edit",
            "wavespeed-ai/qwen-image/edit",
            "qwen-edit-plus",
            "wavespeed-ai/qwen-image/edit-plus",
        ]
        for model in edit_models:
            cost = PricingLookup.get_image_edit_cost(model)
            cost_helper = get_image_edit_model_cost(model)
            assert cost == 0.02, f"Model {model}: expected $0.02, got {cost}"
            assert cost_helper == 0.02, f"Model {model}: expected $0.02 via helper, got {cost_helper}"


# ==========================================================================
# 3. Ideogram V3 Turbo ($0.03-$0.05 / run)
# ==========================================================================

class TestIdeogramV3TurboPricing:
    """Ideogram V3 Turbo pricing validation (verified in #495)."""

    def test_ideogram_v3_turbo_cost(self):
        """Ideogram V3 Turbo must return a cost in the verified $0.03-$0.05 range ($0.05/image)."""
        cost = PricingLookup.get_image_cost("ideogram-v3-turbo")
        cost_helper = get_image_model_cost("ideogram-v3-turbo")

        assert 0.03 <= cost <= 0.05, f"Expected cost in [$0.03, $0.05], got {cost}"
        assert cost == 0.05, f"Expected exact price $0.05, got {cost}"
        assert cost_helper == 0.05, f"Expected $0.05 via helper, got {cost_helper}"

    def test_ideogram_v3_turbo_entry(self):
        """Verify Ideogram V3 Turbo pricing entry attributes."""
        entry = PricingLookup.get_entry("ideogram-v3-turbo")
        assert entry is not None, "ideogram-v3-turbo entry not found"
        unit_cost = entry.cost_per_image or entry.cost_per_request
        assert unit_cost == 0.05


# ==========================================================================
# 4. MiniMax TTS (Character-based cost matching get_audio_tts_cost)
# ==========================================================================

class TestMiniMaxTTSPricing:
    """MiniMax TTS character-based pricing at 500, 1000, 2500, 4000 chars (verified in #496)."""

    MODEL = "minimax/speech-02-hd"
    RATE_PER_CHAR = 0.00005  # $50.0 per 1M characters

    def test_minimax_rate_per_char(self):
        """MiniMax TTS unit rate per character/token must be $0.00005 (5e-05)."""
        rate = PricingLookup.get_audio_cost_per_token(self.MODEL)
        rate_helper = get_audio_cost_per_token(self.MODEL)

        assert rate == pytest.approx(self.RATE_PER_CHAR, rel=1e-6)
        assert rate_helper == pytest.approx(self.RATE_PER_CHAR, rel=1e-6)

    @pytest.mark.parametrize(
        "char_count, expected_cost",
        [
            (500, 0.025),     # 500 * 0.00005 = $0.025
            (1000, 0.050),    # 1000 * 0.00005 = $0.050
            (2500, 0.125),    # 2500 * 0.00005 = $0.125
            (4000, 0.200),    # 4000 * 0.00005 = $0.200
        ],
    )
    def test_minimax_tts_character_scaled_cost(self, char_count: int, expected_cost: float):
        """get_audio_tts_cost() must return exact character-scaled cost for MiniMax TTS."""
        cost = PricingLookup.get_audio_tts_cost(self.MODEL, text_length=char_count)
        cost_helper = get_audio_tts_cost(self.MODEL, text_length=char_count)

        assert cost == pytest.approx(expected_cost, abs=1e-5), (
            f"MiniMax TTS {char_count} chars: expected ${expected_cost}, got ${cost}"
        )
        assert cost_helper == pytest.approx(expected_cost, abs=1e-5)


# ==========================================================================
# 5. InfiniteTalk (Duration-aware video cost at 5s, 15s, 20s)
# ==========================================================================

class TestInfiniteTalkPricing:
    """InfiniteTalk duration-aware video cost validation (verified in #497)."""

    MODEL_SHORT = "infinitetalk"
    MODEL_FULL = "wavespeed-ai/infinitetalk"

    @pytest.mark.parametrize(
        "duration_sec, expected_cost_720p, expected_cost_480p",
        [
            (5.0, 0.30, 0.15),    # 5s base block: $0.30 (720p) / $0.15 (480p)
            (15.0, 0.90, 0.45),   # 15s (3x 5s): $0.90 (720p) / $0.45 (480p)
            (20.0, 1.20, 0.60),   # 20s (4x 5s): $1.20 (720p) / $0.60 (480p)
        ],
    )
    def test_infinitetalk_duration_aware_costs(
        self,
        duration_sec: float,
        expected_cost_720p: float,
        expected_cost_480p: float,
    ):
        """InfiniteTalk must compute linear duration-scaled video cost at 5s, 15s, and 20s."""
        # 720p resolution (default)
        cost_720p_short = PricingLookup.get_video_model_cost(
            self.MODEL_SHORT, duration_sec=duration_sec, resolution="720p"
        )
        cost_720p_full = get_video_cost(
            self.MODEL_FULL, duration_sec=duration_sec, resolution="720p"
        )
        assert cost_720p_short == pytest.approx(expected_cost_720p, abs=1e-4)
        assert cost_720p_full == pytest.approx(expected_cost_720p, abs=1e-4)

        # 480p resolution
        cost_480p_short = PricingLookup.get_video_model_cost(
            self.MODEL_SHORT, duration_sec=duration_sec, resolution="480p"
        )
        cost_480p_full = get_video_model_cost(
            self.MODEL_FULL, duration_sec=duration_sec, resolution="480p"
        )
        assert cost_480p_short == pytest.approx(expected_cost_480p, abs=1e-4)
        assert cost_480p_full == pytest.approx(expected_cost_480p, abs=1e-4)

    def test_infinitetalk_default_duration_fallback(self):
        """When duration is omitted, default 5s rate ($0.30) must be returned."""
        cost_default = PricingLookup.get_video_model_cost(self.MODEL_SHORT)
        assert cost_default == 0.30
