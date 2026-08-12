"""
Subscription API Module
Main router that includes all subscription-related endpoints.
"""

import os

from fastapi import APIRouter

from .routes import (
    usage,
    plans,
    subscriptions,
    alerts,
    dashboard,
    logs,
    preflight,
    disputes,
    fraud_warnings,
)

# Create main router
router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# Include all sub-routers
router.include_router(usage.router, tags=["subscription"])
router.include_router(plans.router, tags=["subscription"])
router.include_router(subscriptions.router, tags=["subscription"])
router.include_router(alerts.router, tags=["subscription"])
router.include_router(dashboard.router, tags=["subscription"])
router.include_router(logs.router, tags=["subscription"])
router.include_router(preflight.router, tags=["subscription"])

if os.getenv("SKIP_PAYMENT", "false").lower() != "true":
    from .routes import payment

    router.include_router(payment.router, tags=["subscription"])

router.include_router(disputes.router, tags=["subscription"])
router.include_router(fraud_warnings.router, tags=["subscription"])

__all__ = ["router"]