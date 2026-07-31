"""Tests for public subscription plan listing (no auth required)."""

from __future__ import annotations

import pytest

from tests.framework.http import assert_status

pytestmark = [pytest.mark.subscription_sanity, pytest.mark.functional]


def test_plans_without_auth(subscription_app_with_db, subscription_db_session):
    """GET /plans must work without Authorization (LinkedIn pricing page)."""
    from services.subscription.plans_db import get_plans_db

    def _override_plans_db():
        yield subscription_db_session

    subscription_app_with_db.dependency_overrides[get_plans_db] = _override_plans_db

    from fastapi.testclient import TestClient

    client = TestClient(subscription_app_with_db)
    response = client.get("/plans")
    assert_status(response, 200)
    payload = response.json()
    assert payload["success"] is True
    plans = payload["data"]["plans"]
    assert len(plans) >= 2
    tiers = {p["tier"] for p in plans}
    assert "free" in tiers
    assert "basic" in tiers


def test_subscribe_resolves_plan_by_tier(
    subscription_client_with_db,
    subscription_db_session,
    free_user,
):
    """Subscribe accepts tier when catalog plan_id differs from user DB."""
    from models.subscription_models import SubscriptionPlan, UserSubscription, UsageStatus

    basic = (
        subscription_db_session.query(SubscriptionPlan)
        .filter(SubscriptionPlan.name == "Basic")
        .first()
    )
    assert basic is not None

    # Simulate stale catalog id: wrong plan_id but correct tier
    stale_plan_id = 99999
    response = subscription_client_with_db.post(
        f"/subscribe/{free_user['id']}",
        json={"plan_id": stale_plan_id, "tier": "basic"},
    )
    assert_status(response, 200)
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["plan_name"] == "Basic"

    row = (
        subscription_db_session.query(UserSubscription)
        .filter(UserSubscription.user_id == free_user["id"], UserSubscription.is_active == True)
        .first()
    )
    assert row is not None
    assert row.plan_id == basic.id
    assert enum_value_or_active(row.status) == "active"


def enum_value_or_active(status) -> str:
    if status is None:
        return "active"
    return status.value if hasattr(status, "value") else str(status)
