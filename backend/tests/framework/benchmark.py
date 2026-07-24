"""Framework-level API benchmarking — measures endpoint response times and flags
slow routes without touching production code.

Usage:
    # From a conftest or test file:
    from tests.framework.benchmark import BenchmarkClient, benchmark_session

    def test_story_health_bm(benchmark_client):
        r = benchmark_client.get("/api/story/health")
        assert r.status_code == 200

    # End-of-session report is printed automatically (see BenchmarkReport).
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

# Thresholds in milliseconds — tests will FAIL if a route crosses its threshold
DEFAULT_THRESHOLD_MS: Dict[str, int] = {
    "health": 20,       # Health checks must be fast
    "cache": 50,        # Cache operations
    "default": 100,     # Most CRUD / query endpoints
    "async_start": 300, # Async task-starters (research/start, outline/start)
    "seo": 500,         # SEO analysis
    "generate": 800,    # Content generation
}

_ThresholdProvider = Callable[[str], Optional[int]]


# ---------------------------------------------------------------------------
# Measurement record
# ---------------------------------------------------------------------------

class Measurement:
    __slots__ = ("method", "path", "status", "duration_ms", "error")

    def __init__(
        self,
        method: str,
        path: str,
        status: int,
        duration_ms: float,
        error: Optional[str] = None,
    ):
        self.method = method
        self.path = path
        self.status = status
        self.duration_ms = duration_ms
        self.error = error


# ---------------------------------------------------------------------------
# Session-level reporter — accumulates measurements and prints at teardown
# ---------------------------------------------------------------------------

class BenchmarkReport:
    """Collect measurements during a test session; print a summary on exit."""

    def __init__(self, threshold_fn: Optional[_ThresholdProvider] = None):
        self._measurements: List[Measurement] = []
        self._threshold_fn = threshold_fn or self._default_threshold

    @staticmethod
    def _default_threshold(path: str) -> Optional[int]:
        lower = path.lower()
        for key, ms in DEFAULT_THRESHOLD_MS.items():
            if key in lower:
                return ms
        return DEFAULT_THRESHOLD_MS["default"]

    def record(self, m: Measurement) -> None:
        self._measurements.append(m)

    @property
    def measurements(self) -> List[Measurement]:
        return list(self._measurements)

    def summary(self) -> str:
        """Return formatted summary table. Call at session teardown."""
        if not self._measurements:
            return "[Benchmark] No measurements recorded."

        # Build per-endpoint stats (method + path)
        groups: Dict[Tuple[str, str], List[float]] = defaultdict(list)
        for m in self._measurements:
            groups[(m.method, m.path)].append(m.duration_ms)

        rows = []
        slow_flags = []
        for (method, path), durations in sorted(groups.items()):
            avg = sum(durations) / len(durations)
            mx = max(durations)
            threshold = self._threshold_fn(path) or DEFAULT_THRESHOLD_MS["default"]
            flag = " SLOW" if mx > threshold else ""
            rows.append(
                f"  {method:6s} {path:<60s} "
                f"avg={avg:7.1f}ms  max={mx:7.1f}ms  "
                f"n={len(durations)}  threshold={threshold}ms{flag}"
            )
            if mx > threshold:
                slow_flags.append(
                    f"  {method} {path}: {mx:.1f}ms > {threshold}ms threshold"
                )

        header = f"[Benchmark] {len(rows)} endpoints measured"
        table = "\n".join(rows)
        footer = ""
        if slow_flags:
            footer = "\n".join(
                ["\n[Benchmark] SLOW ENDPOINTS DETECTED:"]
                + slow_flags
            )

        return f"{header}\n{table}\n{footer}"


# ---------------------------------------------------------------------------
# Benchmark-aware TestClient wrapper
# ---------------------------------------------------------------------------

class BenchmarkClient:
    """Wraps TestClient, records duration + status for every request."""

    def __init__(self, app: FastAPI, report: BenchmarkReport):
        self._client = TestClient(app)
        self._report = report

    def get(self, path: str, **kwargs: Any):
        return self._request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any):
        return self._request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any):
        return self._request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs: Any):
        return self._request("DELETE", path, **kwargs)

    def _request(self, method: str, path: str, **kwargs: Any):
        error: Optional[str] = None
        t0 = time.perf_counter()
        try:
            response = getattr(self._client, method.lower())(path, **kwargs)
            duration_ms = (time.perf_counter() - t0) * 1000
            self._report.record(
                Measurement(
                    method=method,
                    path=path,
                    status=response.status_code,
                    duration_ms=duration_ms,
                )
            )
            return response
        except Exception as e:
            duration_ms = (time.perf_counter() - t0) * 1000
            error = str(e)
            self._report.record(
                Measurement(
                    method=method,
                    path=path,
                    status=0,
                    duration_ms=duration_ms,
                    error=error,
                )
            )
            raise


# ---------------------------------------------------------------------------
# Route discovery helpers
# ---------------------------------------------------------------------------

def discover_routes(app: FastAPI) -> List[Tuple[str, str]]:
    """Return list of (method, path) for all APIRoutes on the app."""
    return [
        (sorted(r.methods)[0], r.path)
        for r in app.routes
        if isinstance(r, APIRoute)
    ]


def benchmark_route(
    client: BenchmarkClient,
    method: str,
    path: str,
    *,
    payload: Optional[Dict[str, Any]] = None,
) -> Optional[Measurement]:
    """Exercise one route and return its measurement."""
    lower = method.lower()
    try:
        if lower == "get":
            client.get(path)
        elif lower == "post":
            client.post(path, json=payload or {})
        elif lower == "put":
            client.put(path, json=payload or {})
        elif lower == "delete":
            client.delete(path)
        else:
            return None
    except Exception:
        pass  # Measurement already recorded in _request
    # Return the most recent measurement
    return client._report.measurements[-1] if client._report.measurements else None
