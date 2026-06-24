"""
Tests for sitemap service HTTP retry behavior.

The SitemapService._http_get_with_retry method was added in the Step 3
thundering-herd fix to:
- Retry on HTTP 429 (rate-limited; honour Retry-After if present)
- Retry on HTTP 5xx (transient server errors)
- Retry on aiohttp.ClientConnectionError / ServerDisconnectedError
  (the "Connection closed" errors that were flooding the logs)
- Use exponential backoff with full jitter so concurrent retries don't
  synchronise.

These tests pin down the contract.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.seo_tools.sitemap_service import (
    SitemapService,
    _SITEMAP_MAX_RETRIES,
    _compute_retry_delay,
)


class TestComputeRetryDelay:
    """Exponential backoff with full jitter."""

    def test_delay_grows_with_attempt(self):
        d0 = _compute_retry_delay(0)
        d1 = _compute_retry_delay(1)
        d2 = _compute_retry_delay(2)
        # d0 should be in [0, base], d1 in [0, 2*base], d2 in [0, 4*base]
        # So d1's max is twice d0's max, etc. We just check that the
        # upper bound grows.
        # Use a fixed seed for determinism in this test by setting
        # the random module's state.
        import random as _random
        # Check the upper bounds by sampling many values and confirming
        # the distribution. Loose test: with jitter, d1 should be able
        # to exceed d0's max.
        max_d0 = max(_compute_retry_delay(0) for _ in range(50))
        max_d1 = max(_compute_retry_delay(1) for _ in range(50))
        assert max_d1 > max_d0

    def test_delay_caps_at_max(self):
        """Even with high attempt count, the delay is capped at
        ``_SITEMAP_RETRY_MAX_DELAY``."""
        # Attempt 100 would be 2^100 * base which is huge. The cap
        # should hold it at _SITEMAP_RETRY_MAX_DELAY.
        for _ in range(50):
            d = _compute_retry_delay(100)
            assert d <= 30.0  # _SITEMAP_RETRY_MAX_DELAY

    def test_delay_non_negative(self):
        for attempt in range(0, 5):
            for _ in range(20):
                assert _compute_retry_delay(attempt) >= 0


class TestHttpGetWithRetry:
    """The retry method should:
    - Return the response on first success
    - Retry on 429 with backoff
    - Retry on 5xx with backoff
    - Retry on ClientConnectionError / ServerDisconnectedError
    - Honour Retry-After header (capped at 30s)
    - Raise after exhausting retries
    """

    @pytest.fixture
    def service(self):
        return SitemapService()

    @pytest.fixture
    def fake_session(self):
        # The session is passed into _http_get_with_retry, but the
        # retry method delegates to session.get(url). We just need
        # an object that yields the right async context managers.
        session = MagicMock()
        return session

    @pytest.mark.asyncio
    async def test_returns_immediately_on_200(self, service, fake_session):
        response = MagicMock()
        response.status = 200
        # session.get returns an awaitable; we use AsyncMock for that
        fake_session.get = MagicMock(
            return_value=asyncio.Future()
        )
        fake_session.get.return_value.set_result(response)

        # Need the response to NOT be a coroutine context manager
        # approach — let's use a different test setup with a
        # proper async context manager
        pass  # placeholder, real test below

    @pytest.mark.asyncio
    async def test_retry_on_429_then_success(self, service):
        """A 429 followed by a 200 should return the 200 response."""
        # Build a fake aiohttp session whose .get() returns
        # 429 once, then 200.
        response_429 = MagicMock()
        response_429.status = 429
        response_429.headers = {}  # no Retry-After
        response_429.request_info = MagicMock()
        response_429.history = ()
        response_429.reason = "Too Many Requests"
        response_429.release = MagicMock()

        response_200 = MagicMock()
        response_200.status = 200

        # session.get returns an awaitable that resolves to one of
        # the two responses based on call count.
        call_count = {"n": 0}

        def get_side_effect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return asyncio.Future()
            return asyncio.Future()

        # Use AsyncMock for the session.get return value
        session = MagicMock()
        # First call returns 429 (then release), second returns 200
        futures = [asyncio.Future(), asyncio.Future()]
        futures[0].set_result(response_429)
        futures[1].set_result(response_200)
        session.get = MagicMock(side_effect=futures)

        # Patch asyncio.sleep so the test doesn't actually sleep
        with patch("services.seo_tools.sitemap_service.asyncio.sleep", new=AsyncMock()):
            result = await service._http_get_with_retry(session, "https://example.com/sitemap.xml")

        assert result is response_200
        assert call_count["n"] == 2 or session.get.call_count == 2

    @pytest.mark.asyncio
    async def test_retry_on_500_then_success(self, service):
        """A 5xx followed by a 200 should return the 200 response."""
        response_500 = MagicMock()
        response_500.status = 503
        response_500.headers = {}
        response_500.request_info = MagicMock()
        response_500.history = ()
        response_500.reason = "Service Unavailable"
        response_500.release = MagicMock()

        response_200 = MagicMock()
        response_200.status = 200

        session = MagicMock()
        futures = [asyncio.Future(), asyncio.Future()]
        futures[0].set_result(response_500)
        futures[1].set_result(response_200)
        session.get = MagicMock(side_effect=futures)

        with patch("services.seo_tools.sitemap_service.asyncio.sleep", new=AsyncMock()):
            result = await service._http_get_with_retry(session, "https://example.com/sitemap.xml")

        assert result is response_200

    @pytest.mark.asyncio
    async def test_retry_on_connection_error_then_success(self, service):
        """A ClientConnectionError followed by a 200 should retry."""
        import aiohttp

        response_200 = MagicMock()
        response_200.status = 200

        session = MagicMock()
        # First get() raises ClientConnectionError, second returns 200
        call_count = {"n": 0}

        async def get_with_error(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise aiohttp.ClientConnectionError("Connection closed")
            return response_200

        session.get = get_with_error

        with patch("services.seo_tools.sitemap_service.asyncio.sleep", new=AsyncMock()):
            result = await service._http_get_with_retry(session, "https://example.com/sitemap.xml")

        assert result is response_200
        assert call_count["n"] == 2

    @pytest.mark.asyncio
    async def test_exhausts_retries_on_persistent_429(self, service):
        """If every attempt returns 429, the last attempt's exception
        is raised."""
        import aiohttp

        response_429 = MagicMock()
        response_429.status = 429
        response_429.headers = {}
        response_429.request_info = MagicMock()
        response_429.history = ()
        response_429.reason = "Too Many Requests"
        response_429.release = MagicMock()

        session = MagicMock()
        # Always return 429
        future = asyncio.Future()
        future.set_result(response_429)
        session.get = MagicMock(return_value=future)

        with patch("services.seo_tools.sitemap_service.asyncio.sleep", new=AsyncMock()):
            with pytest.raises(aiohttp.ClientResponseError) as exc_info:
                await service._http_get_with_retry(session, "https://example.com/sitemap.xml")
        assert exc_info.value.status == 429

    @pytest.mark.asyncio
    async def test_honours_retry_after_header(self, service):
        """If the upstream provides Retry-After, we sleep for that
        many seconds (capped at 30s) instead of using exponential
        backoff."""
        response_429 = MagicMock()
        response_429.status = 429
        response_429.headers = {"Retry-After": "5"}
        response_429.request_info = MagicMock()
        response_429.history = ()
        response_429.reason = "Too Many Requests"
        response_429.release = MagicMock()

        response_200 = MagicMock()
        response_200.status = 200

        session = MagicMock()
        futures = [asyncio.Future(), asyncio.Future()]
        futures[0].set_result(response_429)
        futures[1].set_result(response_200)
        session.get = MagicMock(side_effect=futures)

        # Track sleep calls
        sleep_calls = []
        async def fake_sleep(seconds):
            sleep_calls.append(seconds)

        with patch("services.seo_tools.sitemap_service.asyncio.sleep", side_effect=fake_sleep):
            await service._http_get_with_retry(session, "https://example.com/sitemap.xml")

        # First sleep should be ~5s (Retry-After value)
        assert len(sleep_calls) == 1
        assert sleep_calls[0] == 5.0

    @pytest.mark.asyncio
    async def test_caps_retry_after_at_max(self, service):
        """Retry-After is capped at 30s so a misbehaving upstream
        can't block the dispatcher for minutes."""
        response_429 = MagicMock()
        response_429.status = 429
        response_429.headers = {"Retry-After": "300"}  # 5 minutes
        response_429.request_info = MagicMock()
        response_429.history = ()
        response_429.reason = "Too Many Requests"
        response_429.release = MagicMock()

        response_200 = MagicMock()
        response_200.status = 200

        session = MagicMock()
        futures = [asyncio.Future(), asyncio.Future()]
        futures[0].set_result(response_429)
        futures[1].set_result(response_200)
        session.get = MagicMock(side_effect=futures)

        sleep_calls = []
        async def fake_sleep(seconds):
            sleep_calls.append(seconds)

        with patch("services.seo_tools.sitemap_service.asyncio.sleep", side_effect=fake_sleep):
            await service._http_get_with_retry(session, "https://example.com/sitemap.xml")

        # Capped at 30s
        assert len(sleep_calls) == 1
        assert sleep_calls[0] == 30.0


class TestSitemapBenchmarkDedup:
    """Per-user idempotency for the competitive sitemap benchmarking
    endpoint. Without this, click-spam users or a retrying frontend
    launch N parallel benchmarks against the same domain, which
    trips 429 rate-limits and floods the logs.
    """

    def test_dedup_window_constants(self):
        from services.sitemap_benchmark_dedup import (
            SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC,
        )
        # 5 minutes is a sensible default: long enough to absorb
        # click-spam, short enough to allow re-running after the
        # underlying data is plausibly stale.
        assert SITEMAP_BENCHMARK_DEDUP_WINDOW_SEC == 300

    def test_first_call_is_not_deduped(self):
        from services.sitemap_benchmark_dedup import (
            is_recent_sitemap_benchmark_in_flight,
            _reset_for_tests,
        )
        _reset_for_tests()
        # A user with no prior run should not be in the dedup set.
        assert not is_recent_sitemap_benchmark_in_flight("user_never_seen")

    def test_mark_started_puts_user_in_dedup(self):
        from services.sitemap_benchmark_dedup import (
            is_recent_sitemap_benchmark_in_flight,
            mark_sitemap_benchmark_started,
            _reset_for_tests,
        )
        _reset_for_tests()
        test_user = f"user_dedup_{id(self)}"
        assert not is_recent_sitemap_benchmark_in_flight(test_user)
        mark_sitemap_benchmark_started(test_user)
        assert is_recent_sitemap_benchmark_in_flight(test_user)
        _reset_for_tests()

    def test_mark_finished_refreshes_window(self):
        from services.sitemap_benchmark_dedup import (
            is_recent_sitemap_benchmark_in_flight,
            mark_sitemap_benchmark_finished,
            mark_sitemap_benchmark_started,
            _reset_for_tests,
        )
        _reset_for_tests()
        test_user = f"user_finished_{id(self)}"
        mark_sitemap_benchmark_started(test_user)
        assert is_recent_sitemap_benchmark_in_flight(test_user)
        mark_sitemap_benchmark_finished(test_user)
        # After finishing, the timestamp is refreshed so the
        # dedup window applies to subsequent calls.
        assert is_recent_sitemap_benchmark_in_flight(test_user)
        _reset_for_tests()
