"""
Tests for the third wave of onboarding fixes (PR #746).

The user's logs after PR #745 showed a wall of WARNING-level noise
for routine "service not connected" / "no data yet" / "no Wix
site" cases. logging_config.py only emits WARNING+ERROR to the
console, so the WARNINGs were flooding the log with messages that
weren't actually problems.

These tests pin down that the relevant log calls use ``logger.debug``
for normal "not connected" / "no data" cases and ``logger.warning``
only for genuine problems (token expired, real error).
"""

import logging
import sys
from io import StringIO


def _capture_log(level: int, fn) -> list:
    """Run ``fn`` and return a list of (levelname, message) tuples for
    every log record produced.

    The Wix / data_integration / step4 modules use ``loguru``, which
    doesn't propagate to the stdlib root logger by default. The
    simpler way to capture both stdlib and loguru output is to
    add a sink to loguru's logger that records messages.
    """
    from loguru import logger as loguru_logger

    records: list = []

    def _sink(message):
        record = message.record
        records.append((record["level"].name, str(record["message"])))

    handler_id = loguru_logger.add(_sink, level="DEBUG")
    try:
        fn()
    finally:
        loguru_logger.remove(handler_id)
    return records


class TestGscAnalyticsLogLevel:
    """``_get_gsc_analytics`` should log "no data" at debug, not warning.

    Source-grep regression test (we can't import the module in test
    isolation because the import chain triggers the pre-existing
    ``generate_image_variation`` error — see commit 1cd8ab6b).
    """

    def test_no_gsc_data_logs_at_debug(self):
        from pathlib import Path
        import re

        repo = Path(__file__).resolve().parents[1]  # backend/
        path = repo / "api" / "content_planning" / "services" / "content_strategy" / "onboarding" / "data_integration.py"
        assert path.exists()
        source = path.read_text(encoding="utf-8")

        # The pre-fix line was ``logger.warning(f"No GSC analytics found or not connected ...")``.
        # After the fix it should be ``logger.debug(...)``.
        warn_match = re.search(
            r'logger\.warning\(f?"No GSC analytics', source
        )
        debug_match = re.search(
            r'logger\.debug\(f?"No GSC analytics', source
        )
        assert warn_match is None, (
            "data_integration._get_gsc_analytics still has logger.warning for 'No GSC analytics' — "
            "should be demoted to logger.debug so it doesn't spam the console"
        )
        assert debug_match is not None, (
            "data_integration._get_gsc_analytics should have logger.debug for 'No GSC analytics'"
        )

    def test_gsc_error_still_logs_at_error(self):
        """A real exception should still log at error level."""
        from pathlib import Path
        import re

        repo = Path(__file__).resolve().parents[1]  # backend/
        path = repo / "api" / "content_planning" / "services" / "content_strategy" / "onboarding" / "data_integration.py"
        assert path.exists()
        source = path.read_text(encoding="utf-8")

        # The "Error getting GSC analytics" path is in the
        # ``except Exception`` block. It must stay at error level
        # because a real exception IS a problem the operator needs
        # to investigate.
        error_match = re.search(
            r'logger\.error\(f"Error getting GSC analytics', source
        )
        assert error_match is not None, (
            "data_integration._get_gsc_analytics must keep the exception path at logger.error"
        )


class TestBingAnalyticsLogLevel:
    """``_get_bing_analytics`` should log "no data" at debug, not warning.

    Source-grep regression test (same reason as TestGscAnalyticsLogLevel).
    """

    def test_no_bing_data_logs_at_debug(self):
        from pathlib import Path
        import re

        repo = Path(__file__).resolve().parents[1]  # backend/
        path = repo / "api" / "content_planning" / "services" / "content_strategy" / "onboarding" / "data_integration.py"
        assert path.exists()
        source = path.read_text(encoding="utf-8")

        warn_match = re.search(
            r'logger\.warning\(f?"No Bing analytics', source
        )
        debug_match = re.search(
            r'logger\.debug\(f?"No Bing analytics', source
        )
        assert warn_match is None, (
            "data_integration._get_bing_analytics still has logger.warning for 'No Bing analytics' — "
            "should be demoted to logger.debug"
        )
        assert debug_match is not None, (
            "data_integration._get_bing_analytics should have logger.debug for 'No Bing analytics'"
        )


class TestWixGetSiteInfoLogLevel:
    """Wix 404 = no site (normal). 401 = token expired (real)."""

    def test_wix_404_logs_at_debug(self, monkeypatch):
        # We need to import and exercise the actual wix auth module.
        from services.integrations.wix import auth as wix_auth

        class _FakeResponse:
            status_code = 404
            def raise_for_status(self):
                pass

        class _FakeRequests:
            @staticmethod
            def get(url, headers=None):
                return _FakeResponse()

        monkeypatch.setattr(wix_auth, "requests", _FakeRequests)
        client = wix_auth.WixAuthService(
            client_id="cid",
            redirect_uri="https://example.com/callback",
            base_url="https://api.wix.com",
        )
        msgs = _capture_log(logging.DEBUG, lambda: client.get_site_info("tok"))
        # msgs is a list of (levelname, message) tuples
        relevant = [m for m in msgs if "404" in m[1] and "Wix" in m[1]]
        assert relevant, f"No Wix 404 log emitted: {msgs}"
        for level, _ in relevant:
            assert level == "DEBUG", (
                f"Wix 404 (no site) should log at DEBUG, got {level}"
            )

    def test_wix_401_still_logs_at_warning(self, monkeypatch):
        """A 401 means the user's token is expired/invalid — that's a
        real problem the user needs to act on. Keep at WARNING so
        it shows in the console (logging_config.py emits WARNING+)."""
        from services.integrations.wix import auth as wix_auth

        class _FakeResponse:
            status_code = 401
            def raise_for_status(self):
                pass

        class _FakeRequests:
            @staticmethod
            def get(url, headers=None):
                return _FakeResponse()

        monkeypatch.setattr(wix_auth, "requests", _FakeRequests)
        client = wix_auth.WixAuthService(
            client_id="cid",
            redirect_uri="https://example.com/callback",
            base_url="https://api.wix.com",
        )
        msgs = _capture_log(logging.DEBUG, lambda: client.get_site_info("tok"))
        relevant = [m for m in msgs if "401" in m[1] and "Wix" in m[1]]
        assert relevant, f"No Wix 401 log emitted: {msgs}"
        for level, _ in relevant:
            assert level == "WARNING", (
                f"Wix 401 (token expired) should log at WARNING so it shows "
                f"in the console, got {level}"
            )


class TestPlatformAnalyticsLogLevel:
    """The analytics summary + per-platform snapshot should be debug."""

    def test_analytics_summary_logs_at_debug(self):
        """The two log calls in ``get_analytics_data`` (summary +
        per-platform snapshot) were at WARNING, which made every
        successful analytics call show up as a warning. Pin down
        the demotion to DEBUG.
        """
        # Read the source and assert the level is debug.
        from pathlib import Path

        repo = Path(__file__).resolve().parents[1]  # backend/
        router_path = repo / "routers" / "platform_analytics.py"
        assert router_path.exists()
        source = router_path.read_text(encoding="utf-8")

        # Find the lines that call logger.warning with the
        # analytics summary / snapshot messages and assert they
        # are now logger.debug.
        import re
        summary_warn = re.search(r"logger\.warning\([^)]*Analytics summary for user", source)
        snapshot_warn = re.search(
            r"logger\.warning\([^)]*Analytics platform snapshot", source
        )
        assert summary_warn is None, (
            "platform_analytics.py still has logger.warning(Analytics summary for user) — "
            "should be logger.debug"
        )
        assert snapshot_warn is None, (
            "platform_analytics.py still has logger.warning(Analytics platform snapshot) — "
            "should be logger.debug"
        )
        # And the debug versions must be present.
        summary_debug = re.search(r"logger\.debug\([^)]*Analytics summary for user", source)
        snapshot_debug = re.search(
            r"logger\.debug\([^)]*Analytics platform snapshot", source
        )
        assert summary_debug is not None
        assert snapshot_debug is not None


class TestStep4AssetRoutesLogLevel:
    """get_latest_avatar status messages should be debug, not warning."""

    def test_avatar_lookup_logs_at_debug(self):
        from pathlib import Path

        repo = Path(__file__).resolve().parents[1]  # backend/
        path = repo / "api" / "onboarding_utils" / "step4_asset_routes.py"
        assert path.exists()
        source = path.read_text(encoding="utf-8")

        import re
        # The two per-call status lines used to be warning.
        looking_warn = re.search(
            r'logger\.warning\(f"\[latest-avatar\] Looking for avatar', source
        )
        found_warn = re.search(
            r'logger\.warning\(f"\[latest-avatar\] Found', source
        )
        assert looking_warn is None, (
            "step4_asset_routes.py still has logger.warning for [latest-avatar] Looking for avatar"
        )
        assert found_warn is None, (
            "step4_asset_routes.py still has logger.warning for [latest-avatar] Found"
        )
        # And the debug versions are present.
        assert re.search(
            r'logger\.debug\(f"\[latest-avatar\] Looking for avatar', source
        )
        assert re.search(
            r'logger\.debug\(f"\[latest-avatar\] Found', source
        )
