"""Regression tests for UsageTrackingService.reset_current_billing_period (issue #320)."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

os.environ.setdefault("HUGGINGFACE_INPUT_TOKEN_COST", "1.00")
os.environ.setdefault("HUGGINGFACE_OUTPUT_TOKEN_COST", "3.00")

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.regression, pytest.mark.asyncio]


def _upsert_user_subscription(db, user_id: str, plan_name: str = "Free") -> str:
    """Create/update a subscription row with required billing period fields."""
    from models.subscription_models import SubscriptionPlan, UserSubscription

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == plan_name).first()
    assert plan is not None, f"Plan '{plan_name}' not found"

    now = datetime.utcnow()
    period_end = now + timedelta(days=30)
    billing_period = now.strftime("%Y-%m")

    existing = db.query(UserSubscription).filter(UserSubscription.user_id == user_id).first()
    if existing:
        existing.plan_id = plan.id
        existing.is_active = True
        existing.current_period_start = now
        existing.current_period_end = period_end
    else:
        db.add(
            UserSubscription(
                user_id=user_id,
                plan_id=plan.id,
                current_period_start=now,
                current_period_end=period_end,
                is_active=True,
            )
        )
    db.commit()
    return billing_period


def _seed_usage_summary(db, user_id: str, billing_period: str, **kwargs):
    from models.subscription_models import UsageSummary, UsageStatus

    summary = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id,
        UsageSummary.billing_period == billing_period,
    ).first()
    defaults = {
        "total_calls": 25,
        "total_tokens": 5000,
        "total_cost": 12.5,
        "gemini_calls": 10,
        "gemini_tokens": 2000,
        "openai_calls": 5,
        "usage_status": UsageStatus.ACTIVE,
    }
    defaults.update(kwargs)

    if summary:
        for key, value in defaults.items():
            setattr(summary, key, value)
    else:
        db.add(UsageSummary(user_id=user_id, billing_period=billing_period, **defaults))
    db.commit()


class TestUsageTrackingResetMethod:
    """Service-level coverage for the Start for Free usage reset path."""

    async def test_reset_method_exists_on_service(self):
        from services.subscription.usage_tracking_service import UsageTrackingService

        assert hasattr(UsageTrackingService, "reset_current_billing_period")
        assert callable(getattr(UsageTrackingService, "reset_current_billing_period"))

    async def test_reset_current_billing_period_resets_existing_summary(
        self, subscription_db_session, _seeded_subscription_db
    ):
        from models.subscription_models import UsageSummary, UsageStatus
        from services.subscription.usage_tracking_service import UsageTrackingService

        user_id = "user_reset_existing"
        billing_period = _upsert_user_subscription(subscription_db_session, user_id)
        _seed_usage_summary(subscription_db_session, user_id, billing_period)

        service = UsageTrackingService(subscription_db_session)
        result = await service.reset_current_billing_period(user_id)

        assert result["reset"] is True
        assert result["billing_period"] == billing_period
        assert result["created"] is False

        summary = subscription_db_session.query(UsageSummary).filter(
            UsageSummary.user_id == user_id,
            UsageSummary.billing_period == billing_period,
        ).one()
        assert summary.total_calls == 0
        assert summary.total_tokens == 0
        assert summary.total_cost == 0.0
        assert summary.gemini_calls == 0
        assert summary.gemini_tokens == 0
        assert summary.usage_status == UsageStatus.ACTIVE

    async def test_reset_current_billing_period_creates_summary_when_missing(
        self, subscription_db_session, _seeded_subscription_db
    ):
        from models.subscription_models import UsageSummary
        from services.subscription.usage_tracking_service import UsageTrackingService

        user_id = "user_reset_create"
        billing_period = _upsert_user_subscription(subscription_db_session, user_id)

        service = UsageTrackingService(subscription_db_session)
        result = await service.reset_current_billing_period(user_id)

        assert result["reset"] is True
        assert result["billing_period"] == billing_period
        assert result["created"] is True

        summary = subscription_db_session.query(UsageSummary).filter(
            UsageSummary.user_id == user_id,
            UsageSummary.billing_period == billing_period,
        ).one()
        assert summary.total_calls == 0
        assert summary.total_tokens == 0

    async def test_reset_current_billing_period_missing_user_id(
        self, subscription_db_session, _seeded_subscription_db
    ):
        from services.subscription.usage_tracking_service import UsageTrackingService

        service = UsageTrackingService(subscription_db_session)
        result = await service.reset_current_billing_period("")

        assert result["reset"] is False
        assert result["reason"] == "missing_user_id"


class TestSubscribeUsageResetIntegration:
    """Route-level regression: subscribe must invoke reset without attribute errors."""

    async def test_subscribe_resets_usage_counters(
        self,
        subscription_client_with_db,
        subscription_db_session,
        free_user,
        monkeypatch,
    ):
        from models.subscription_models import SubscriptionPlan, UsageSummary

        monkeypatch.setattr(
            "services.database.init_db.init_user_database",
            lambda _user_id: None,
        )

        billing_period = datetime.utcnow().strftime("%Y-%m")
        _seed_usage_summary(
            subscription_db_session,
            free_user["id"],
            billing_period,
            total_calls=42,
            total_tokens=9000,
            gemini_calls=20,
        )

        free_plan = (
            subscription_db_session.query(SubscriptionPlan)
            .filter(SubscriptionPlan.name == "Free")
            .first()
        )
        assert free_plan is not None

        response = subscription_client_with_db.post(
            f"/subscribe/{free_user['id']}",
            json={"plan_id": free_plan.id, "billing_cycle": "monthly"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["success"] is True

        summary = subscription_db_session.query(UsageSummary).filter(
            UsageSummary.user_id == free_user["id"],
            UsageSummary.billing_period == billing_period,
        ).first()
        assert summary is not None
        assert summary.total_calls == 0
        assert summary.total_tokens == 0
        assert summary.gemini_calls == 0
