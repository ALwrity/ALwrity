"""Opt-in real-provider probes used by certification."""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, Optional


async def run_provider_sandbox_probe(
    tool_name: str,
    provider: str,
    probe: Callable[[], Awaitable[Any]],
    timeout_seconds: float = 30.0,
    enabled: Optional[bool] = None,
) -> Dict[str, Any]:
    """Run a real provider operation only when explicitly enabled."""
    if enabled is None:
        enabled = os.getenv("ALWRITY_RUN_PROVIDER_SANDBOX", "false").lower() == "true"
    result = {
        "tool_name": tool_name,
        "provider": provider,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "timeout_seconds": timeout_seconds,
    }
    if not enabled:
        return {**result, "status": "not_run", "reason": "provider sandbox is disabled"}
    started = time.perf_counter()
    try:
        value = await asyncio.wait_for(probe(), timeout=timeout_seconds)
        return {
            **result,
            "status": "passed" if value is not None else "empty",
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "evidence": value if value is not None else {},
        }
    except asyncio.TimeoutError:
        return {**result, "status": "timeout", "latency_ms": round((time.perf_counter() - started) * 1000, 2)}
    except Exception as exc:
        return {
            **result,
            "status": "error",
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "error": str(exc),
        }


async def run_gsc_sandbox_probe(
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timeout_seconds: float = 30.0,
    enabled: Optional[bool] = None,
) -> Dict[str, Any]:
    """Probe the real tenant GSC adapter without fabricating metric rows."""
    async def probe():
        from services.analytics import PlatformAnalyticsService

        data = await PlatformAnalyticsService().get_comprehensive_analytics(
            user_id,
            platforms=["gsc"],
            start_date=start_date,
            end_date=end_date,
        )
        gsc = (data or {}).get("gsc")
        status = getattr(getattr(gsc, "status", None), "value", getattr(gsc, "status", None))
        if status != "success":
            raise RuntimeError(getattr(gsc, "error_message", None) or "GSC provider returned no successful result")
        metrics = getattr(gsc, "metrics", None) or {}
        return {"date_range": getattr(gsc, "date_range", {}) or {}, "metric_keys": sorted(metrics.keys()), "has_rows": bool(metrics)}

    return await run_provider_sandbox_probe(
        "gsc_analytics", "google_search_console", probe, timeout_seconds=timeout_seconds, enabled=enabled
    )
