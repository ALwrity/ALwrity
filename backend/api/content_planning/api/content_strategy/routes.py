"""
Content Strategy Routes
Main router that includes all content strategy endpoint modules.
"""

from fastapi import APIRouter

# Import endpoint modules
from .endpoints.strategy_wizard_endpoints import router as wizard_router
from .endpoints.strategy_crud import router as crud_router
from .endpoints.analytics_endpoints import router as analytics_router
from .endpoints.utility_endpoints import router as utility_router
from .endpoints.streaming_endpoints import router as streaming_router
from .endpoints.autofill_endpoints import router as autofill_router
from .endpoints.ai_generation_endpoints import router as ai_generation_router

# Create main router
# Using /enhanced-strategies prefix for backward compatibility with frontend
router = APIRouter(prefix="/enhanced-strategies", tags=["Content Strategy"])

# Include all endpoint routers
# IMPORTANT: Specific routes (like /onboarding-data) must come BEFORE parameterized routes (like /{strategy_id})
# to avoid route conflicts where FastAPI tries to parse "onboarding-data" as strategy_id

# Wizard routes (mount FIRST — /strategy/* and /wizard/* must win over the
# parameterized crud /{strategy_id} route)
router.include_router(wizard_router, prefix="")
# Utility endpoints directly under /enhanced-strategies (must come first - has /onboarding-data)
router.include_router(utility_router, prefix="")
# Streaming endpoints directly under /enhanced-strategies
router.include_router(streaming_router, prefix="")
# AI generation endpoints under /enhanced-strategies/ai-generation
router.include_router(ai_generation_router, prefix="/ai-generation")
# CRUD endpoints directly under /enhanced-strategies (backward compatibility)
# This includes /{strategy_id} route, so it must come AFTER specific routes
router.include_router(crud_router, prefix="")
# Analytics endpoints under /enhanced-strategies/strategies/{id}/...
router.include_router(analytics_router, prefix="/strategies")
# Autofill endpoints under /enhanced-strategies/strategies/{id}/...
router.include_router(autofill_router, prefix="/strategies") 