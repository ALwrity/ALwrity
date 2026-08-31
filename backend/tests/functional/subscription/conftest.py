"""Shared fixtures for the Subscription functional suite.

Active fixtures:

* ``subscription_db_engine``   — session-scoped SQLite engine with all
                                 subscription tables created.
* ``subscription_db_session``  — fresh SQLAlchemy session per test, rolled
                                 back after each test.
* ``subscription_app``         — FastAPI app with subscription routers mounted
                                 and auth wired to the test user.
* ``subscription_client``      — TestClient over ``subscription_app``.
* ``free_user``                — fake user dict with a free-tier subscription
                                 and a zeroed usage summary.
* ``seed_pricing_and_plans``   — helper that upserts all model pricing
                                 entries and 4 plans from pricing.yaml.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

os.environ.setdefault("HUGGINGFACE_INPUT_TOKEN_COST", "1.00")
os.environ.setdefault("HUGGINGFACE_OUTPUT_TOKEN_COST", "3.00")


# ---------------------------------------------------------------------------
# DB engine / session (session-scoped SQLite file)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def subscription_db_engine():
    """Session-scoped SQLite engine with all subscription tables created.

    Uses a temp file (not :memory:) so that the route handler sessions
    (created in different threads by FastAPI) share the same database.
    """
    fd, db_path = tempfile.mkstemp(suffix=".db", prefix="sub_test_")
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
        echo=False,
    )

    from models.base import Base
    # Ensure subscription models are registered on Base BEFORE create_all so
    # api_provider_pricing etc. exist regardless of test import order.
    import models.subscription_models  # noqa: F401

    Base.metadata.create_all(engine)
    yield engine

    engine.dispose()
    os.close(fd)
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def subscription_db_session(subscription_db_engine) -> Iterator[Session]:
    """Yield a fresh SQLAlchemy session per test, rolled back afterwards."""
    SessionLocal = sessionmaker(bind=subscription_db_engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed_pricing_and_plans(db: Session):
    """Insert all model pricing entries and subscription plans from pricing.yaml."""
    import re
    import yaml
    from models.subscription_models import (
        APIProviderPricing, SubscriptionPlan, APIProvider, SubscriptionTier,
    )

    pricing_path = _BACKEND_ROOT / "config" / "pricing.yaml"
    with open(pricing_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    _ENV_PATTERN = re.compile(r"\$\{(\w+):-([^}]*)\}")

    def _resolve(value):
        if not isinstance(value, str):
            return value
        def _repl(m):
            return os.environ.get(m.group(1), m.group(2))
        return _ENV_PATTERN.sub(_repl, value)

    for entry in raw.get("model_pricing", []):
        provider_str = entry["provider"]
        provider = APIProvider(provider_str)
        model_name = entry["model"]
        cost_per_input = float(_resolve(entry.get("input_per_1m_tokens", 0)) or 0) / 1_000_000
        cost_per_output = float(_resolve(entry.get("output_per_1m_tokens", 0)) or 0) / 1_000_000

        existing = db.query(APIProviderPricing).filter(
            APIProviderPricing.provider == provider,
            APIProviderPricing.model_name == model_name,
        ).first()
        if not existing:
            db.add(APIProviderPricing(
                provider=provider,
                model_name=model_name,
                cost_per_input_token=cost_per_input,
                cost_per_output_token=cost_per_output,
                cost_per_request=float(_resolve(entry.get("per_request", 0)) or 0),
                cost_per_image=float(_resolve(entry.get("per_image", 0)) or 0),
                cost_per_page=float(_resolve(entry.get("per_page", 0)) or 0),
                cost_per_search=float(_resolve(entry.get("per_search", 0)) or 0),
                description=str(_resolve(entry.get("notes", ""))),
            ))

    for plan in raw.get("plans", []):
        tier = SubscriptionTier(plan["tier"])
        existing = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.name == plan["name"],
        ).first()
        if not existing:
            plan_data = {
                "name": plan["name"],
                "tier": tier,
                "price_monthly": float(plan.get("price_monthly", 0)),
                "price_yearly": float(plan.get("price_yearly", 0)),
                "monthly_cost_limit": float(plan.get("monthly_cost_cap", 0)),
                "features": plan.get("features", []),
                "description": str(plan.get("description", "")),
            }
            for limit_key, limit_val in (plan.get("limits", {}) or {}).items():
                plan_data[limit_key] = int(limit_val) if limit_val is not None else 0
            db.add(SubscriptionPlan(**plan_data))

    db.commit()


def _create_user_subscription(
    db: Session,
    user_id: str,
    plan_name: str = "Free",
    active: bool = True,
):
    """Create (or upsert) a UserSubscription row for the given user."""
    from datetime import datetime, timedelta
    from models.subscription_models import UserSubscription, SubscriptionPlan

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.name == plan_name).first()
    if not plan:
        raise ValueError(f"Plan '{plan_name}' not found in DB — seed plans first")

    now = datetime.utcnow()
    period_end = now + timedelta(days=30)

    existing = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id
    ).first()
    if existing:
        existing.plan_id = plan.id
        existing.is_active = active
        existing.current_period_start = now
        existing.current_period_end = period_end
    else:
        db.add(UserSubscription(
            user_id=user_id,
            plan_id=plan.id,
            current_period_start=now,
            current_period_end=period_end,
            is_active=active,
        ))
    db.commit()


def _create_usage_summary(
    db: Session,
    user_id: str,
    billing_period: str = "2099-01",
    **kwargs,
):
    """Create (or upsert) a UsageSummary row for the given user."""
    from models.subscription_models import UsageSummary

    existing = db.query(UsageSummary).filter(
        UsageSummary.user_id == user_id,
        UsageSummary.billing_period == billing_period,
    ).first()
    if existing:
        for key, val in kwargs.items():
            if hasattr(existing, key):
                setattr(existing, key, val)
    else:
        defaults = {
            "user_id": user_id,
            "billing_period": billing_period,
            "total_calls": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "gemini_calls": 0,
            "openai_calls": 0,
            "anthropic_calls": 0,
            "mistral_calls": 0,
            "gemini_tokens": 0,
            "openai_tokens": 0,
            "anthropic_tokens": 0,
            "mistral_tokens": 0,
        }
        defaults.update(kwargs)
        db.add(UsageSummary(**defaults))
    db.commit()


# ---------------------------------------------------------------------------
# Seeded DB fixture (session-scoped — seed once, reuse per test)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def _seeded_subscription_db(subscription_db_engine):
    """Seed the session-scoped DB once with pricing + plans."""
    SessionLocal = sessionmaker(bind=subscription_db_engine)
    db = SessionLocal()
    _seed_pricing_and_plans(db)
    db.close()


# ---------------------------------------------------------------------------
# Fake users
# ---------------------------------------------------------------------------

@pytest.fixture
def free_user(_seeded_subscription_db, subscription_db_session) -> Dict[str, Any]:
    """Fake user dict with a free-tier subscription and zeroed usage summary."""
    from tests.framework.auth import fake_user_factory
    uid = "user_free_test"
    user = fake_user_factory(uid=uid, email="free@test.com")
    _create_user_subscription(subscription_db_session, uid, plan_name="Free", active=True)
    _create_usage_summary(subscription_db_session, uid)
    return user


@pytest.fixture
def free_user_factory(_seeded_subscription_db, subscription_db_session):
    """Callable producing fresh free-tier fake-user dicts."""

    def _make(
        uid: str = "user_free_test",
        calls: dict | None = None,
        tokens: dict | None = None,
    ) -> Dict[str, Any]:
        from tests.framework.auth import fake_user_factory

        user = fake_user_factory(uid=uid, email=f"{uid}@test.com")
        _create_user_subscription(subscription_db_session, uid, plan_name="Free", active=True)
        usage_kwargs = {}
        if calls:
            usage_kwargs.update(calls)
        if tokens:
            usage_kwargs.update(tokens)
        _create_usage_summary(subscription_db_session, uid, **usage_kwargs)
        return user

    return _make


@pytest.fixture
def basic_user(_seeded_subscription_db, subscription_db_session) -> Dict[str, Any]:
    """Fake user dict with a basic-tier subscription."""
    from tests.framework.auth import fake_user_factory
    uid = "user_basic_test"
    user = fake_user_factory(uid=uid, email="basic@test.com")
    _create_user_subscription(subscription_db_session, uid, plan_name="Basic", active=True)
    _create_usage_summary(subscription_db_session, uid)
    return user


@pytest.fixture
def pro_user(_seeded_subscription_db, subscription_db_session) -> Dict[str, Any]:
    """Fake user dict with a pro-tier subscription."""
    from tests.framework.auth import fake_user_factory
    uid = "user_pro_test"
    user = fake_user_factory(uid=uid, email="pro@test.com")
    _create_user_subscription(subscription_db_session, uid, plan_name="Pro", active=True)
    _create_usage_summary(subscription_db_session, uid)
    return user


# ---------------------------------------------------------------------------
# App + client
# ---------------------------------------------------------------------------

@pytest.fixture
def subscription_app(free_user_factory):
    """Fresh FastAPI app with subscription routers and auth overrides."""
    from tests.framework.app_factory import build_app
    from api.subscription.routes.subscriptions import router as subs_router
    from api.subscription.routes.plans import router as plans_router
    from api.subscription.routes.usage import router as usage_router
    from api.subscription.routes.dashboard import router as dashboard_router
    from api.subscription.routes.preflight import router as preflight_router

    return build_app(
        routers=[subs_router, plans_router, usage_router, dashboard_router, preflight_router],
        auth_user_factory=free_user_factory,
        title="ALwrity Subscription Test App",
    )


@pytest.fixture
def subscription_client(subscription_app, free_user_factory):
    """TestClient over the subscription test app."""
    from tests.framework.http import build_client
    return build_client(subscription_app, base_user_factory=free_user_factory)


@pytest.fixture
def subscription_app_with_db(subscription_app, subscription_db_session):
    """Override get_db on the subscription test app to use our in-memory DB."""
    from services.database import get_db

    def _override_get_db():
        yield subscription_db_session

    subscription_app.dependency_overrides[get_db] = _override_get_db
    return subscription_app


@pytest.fixture
def subscription_client_with_db(subscription_app_with_db, free_user):
    """TestClient over subscription app wired to the test DB."""
    from tests.framework.http import build_client
    return build_client(
        subscription_app_with_db,
        base_user_factory=lambda: free_user,
    )
