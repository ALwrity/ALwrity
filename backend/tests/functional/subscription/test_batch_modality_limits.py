"""Tests for batch modality limit validation (Video, Audio, Research, WaveSpeed).

Validates that preflight check_comprehensive_limits correctly accumulates
running counts across operations in a batch request, preventing quota bypasses.
"""

from __future__ import annotations

import sys
from pathlib import Path
import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from models.subscription_models import (
    APIProvider,
    UsageSummary,
    UserSubscription,
)
from services.database import get_session_for_user
from services.subscription import PricingService

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.regression]


@pytest.fixture
def test_db_and_user():
    user_id = "test_user_batch_modality_pytest"
    db = get_session_for_user(user_id)
    # Ensure user is on Free tier
    db.query(UserSubscription).filter(UserSubscription.user_id == user_id).delete()
    db.commit()

    pricing_service = PricingService(db)
    period = pricing_service.get_current_billing_period(user_id)

    usage = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id,
        UsageSummary.billing_period == period,
    ).first()

    if not usage:
        usage = UsageSummary(
            user_id=user_id,
            billing_period=period,
            video_calls=0,
            audio_calls=0,
            exa_calls=0,
            wavespeed_calls=0,
        )
        db.add(usage)
    else:
        usage.video_calls = 0
        usage.audio_calls = 0
        usage.exa_calls = 0
        usage.wavespeed_calls = 0
    db.commit()
    db.refresh(usage)

    yield user_id, db, pricing_service, usage

    db.close()


class TestBatchModalityLimits:
    def test_audio_batch_blocks_when_exceeding_limit(self, test_db_and_user):
        user_id, db, pricing_service, usage = test_db_and_user
        limits = pricing_service.get_user_limits(user_id)["limits"]
        audio_limit = limits.get("audio_calls", 10)

        # 11 calls when limit is 10
        ops = [
            {"provider": APIProvider.AUDIO, "tokens_requested": 100, "operation_type": "tts"}
            for _ in range(audio_limit + 1)
        ]
        can_proceed, msg, details = pricing_service.check_comprehensive_limits(user_id, ops)
        assert can_proceed is False
        assert details.get("error_type") == "audio_limit"
        assert details.get("usage_info", {}).get("operation_index") == audio_limit

    def test_audio_batch_allows_at_exact_limit(self, test_db_and_user):
        user_id, db, pricing_service, usage = test_db_and_user
        limits = pricing_service.get_user_limits(user_id)["limits"]
        audio_limit = limits.get("audio_calls", 10)

        ops = [
            {"provider": APIProvider.AUDIO, "tokens_requested": 100, "operation_type": "tts"}
            for _ in range(audio_limit)
        ]
        can_proceed, msg, details = pricing_service.check_comprehensive_limits(user_id, ops)
        assert can_proceed is True
        assert msg is None

    def test_research_batch_blocks_when_exceeding_limit(self, test_db_and_user):
        user_id, db, pricing_service, usage = test_db_and_user
        limits = pricing_service.get_user_limits(user_id)["limits"]
        exa_limit = limits.get("exa_calls", 10)

        ops = [
            {"provider": APIProvider.EXA, "tokens_requested": 0, "operation_type": "search"}
            for _ in range(exa_limit + 1)
        ]
        can_proceed, msg, details = pricing_service.check_comprehensive_limits(user_id, ops)
        assert can_proceed is False
        assert details.get("error_type") == "call_limit"
        assert details.get("usage_info", {}).get("operation_index") == exa_limit

    def test_wavespeed_umbrella_blocks_when_exceeding_limit(self, test_db_and_user):
        user_id, db, pricing_service, usage = test_db_and_user
        limits = pricing_service.get_user_limits(user_id)["limits"]
        wavespeed_limit = limits.get("wavespeed_calls", 25)

        ops = [
            {
                "provider": APIProvider.MISTRAL,
                "actual_provider_name": "wavespeed",
                "tokens_requested": 50,
                "operation_type": "text",
            }
            for _ in range(wavespeed_limit + 1)
        ]
        can_proceed, msg, details = pricing_service.check_comprehensive_limits(user_id, ops)
        assert can_proceed is False
        assert details.get("error_type") == "wavespeed_limit"
        assert details.get("usage_info", {}).get("operation_index") == wavespeed_limit
