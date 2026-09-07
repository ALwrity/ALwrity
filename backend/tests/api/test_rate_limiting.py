"""
Phase G #33 — server-side rate limiting for strategy create + AI poll.

The aiGenerating guard is client-side only (#33): nothing stopped an
authenticated user from hammering create_enhanced_strategy or
generate-comprehensive-strategy-polling, each of which spins expensive
LLM work. These tests pin an in-memory per-user sliding-window limiter:
  - create (enhanced-strategies/create)   -> 10 per 10 minutes
  - generate (…-polling start POST)       ->  3 per 10 minutes
Over the limit within the window -> HTTP 429.
"""
import time
from unittest.mock import patch, AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from api.content_planning.services.enhanced_strategy_service import EnhancedStrategyService
from api.content_planning.api.content_strategy.endpoints import strategy_crud
from api.content_planning.api.content_strategy.endpoints.ai_generation_endpoints import (
    generate_comprehensive_strategy_polling,
)

# Shared minimal-onboarding shape (mimics test_polling_form_data fixture;
# imported via patched_poll only for its generator patching contextmanager).
from tests.api.test_polling_form_data import patched_poll

MINIMAL_ONBOARDING = {
    "onboarding_session": {"id": 1, "user_id": "u-rl", "current_step": 5,
                           "progress": 100.0, "timezone": "UTC",
                           "contact_email": "rl@example.com"},
    "website_analysis": {"website_url": "https://example.com",
                         "writing_style": "professional",
                         "brand_analysis": {"industry": "saas"}},
    "persona_data": {"core_persona": {"role": "CTO", "goals": ["scale"],
                                      "pain_points": ["visibility"]}},
    "competitor_analysis": {"competitors": [{"domain": "c.com", "name": "C"}]},
    "gsc_analytics": {"total_clicks": 1, "total_impressions": 2},
    "bing_analytics": {"total_clicks": 1, "total_impressions": 2},
    "research_preferences": {"research_depth": "standard"},
    "api_keys_data": {"openai": "sk-***"},
}


@pytest.fixture(autouse=True)
def clean_rate_store():
    """Isolate tests from each other's sliding-window state."""
    import api.content_planning.utils.rate_limiter as rl

    rl._clear()
    yield
    rl._clear()


def _mock_service_success():
    return patch.object(
        EnhancedStrategyService,
        "create_enhanced_strategy",
        new=AsyncMock(return_value={"strategy_id": 1, "name": "Test"}),
    )


class TestCreateRateLimited:
    @pytest.mark.asyncio
    async def test_create_allows_limit_then_429(self):
        from api.content_planning.utils.rate_limiter import CREATE_STRATEGY_LIMITS

        max_requests, _ = CREATE_STRATEGY_LIMITS
        with _mock_service_success():
            for i in range(max_requests):
                response = await strategy_crud.create_enhanced_strategy(
                    strategy_data={"name": f"Rate {i}"},
                    current_user={"id": "u-rate"},
                    db=MagicMock(),
                )
                assert response["status"] == "success"

            with pytest.raises(HTTPException) as exc_info:
                await strategy_crud.create_enhanced_strategy(
                    strategy_data={"name": "One Too Many"},
                    current_user={"id": "u-rate"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_rate_limit_is_per_user(self):
        """One user's burst must not block another user."""
        from api.content_planning.utils.rate_limiter import CREATE_STRATEGY_LIMITS

        max_requests, _ = CREATE_STRATEGY_LIMITS
        with _mock_service_success():
            for i in range(max_requests):
                await strategy_crud.create_enhanced_strategy(
                    strategy_data={"name": f"A {i}"},
                    current_user={"id": "user-a"},
                    db=MagicMock(),
                )

            response = await strategy_crud.create_enhanced_strategy(
                strategy_data={"name": "B still allowed"},
                current_user={"id": "user-b"},
                db=MagicMock(),
            )

        assert response["status"] == "success"

    @pytest.mark.asyncio
    async def test_window_expiry_frees_capacity(self):
        """Entries older than the window must not count — sliding window."""
        import api.content_planning.utils.rate_limiter as rl
        from api.content_planning.utils.rate_limiter import CREATE_STRATEGY_LIMITS

        max_requests, window_seconds = CREATE_STRATEGY_LIMITS

        fake_now = [1_000_000.0]

        with patch.object(rl, "_now", new=lambda: fake_now[0]), _mock_service_success():
            for i in range(max_requests):
                await strategy_crud.create_enhanced_strategy(
                    strategy_data={"name": f"T {i}"},
                    current_user={"id": "u-window"},
                    db=MagicMock(),
                )

            # advance beyond the window
            fake_now[0] += window_seconds + 1

            response = await strategy_crud.create_enhanced_strategy(
                strategy_data={"name": "Fresh capacity"},
                current_user={"id": "u-window"},
                db=MagicMock(),
            )

        assert response["status"] == "success"


class TestPollingRateLimited:
    """generate-comprehensive-strategy-polling starts expensive LLM work
    (5 AI component generations + DB writes) — it needs the tightest cap."""

    @pytest.mark.asyncio
    async def test_generate_polling_429_after_cap(self):
        from api.content_planning.utils.rate_limiter import GENERATE_STRATEGY_LIMITS

        max_requests, _ = GENERATE_STRATEGY_LIMITS

        with patched_poll(MINIMAL_ONBOARDING):
            for i in range(max_requests):
                response = await generate_comprehensive_strategy_polling(
                    request={"strategy_name": f"Poll {i}", "config": {}},
                    current_user={"id": "u-poll"},
                    db=MagicMock(),
                )
                assert "task_id" in response["data"]

            with pytest.raises(HTTPException) as exc_info:
                await generate_comprehensive_strategy_polling(
                    request={"strategy_name": "One Too Many", "config": {}},
                    current_user={"id": "u-poll"},
                    db=MagicMock(),
                )

        assert exc_info.value.status_code == 429
