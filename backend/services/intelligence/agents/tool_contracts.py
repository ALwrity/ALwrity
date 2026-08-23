"""Common result contract for registered agent tools."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


TOOL_STATUSES = {"success", "no_data", "unavailable", "error"}
TOOL_CLASSIFICATIONS = {
    "production_real",
    "provider_dependent",
    "deterministic_heuristic",
    "unavailable",
    "stub",
}


def tool_result(
    status: str,
    source: str,
    data: Any = None,
    evidence: List[Any] | None = None,
    confidence: float = 0.0,
    freshness: Dict[str, Any] | None = None,
    limitations: List[str] | None = None,
) -> Dict[str, Any]:
    """Return a provider-neutral, truthful tool result."""
    normalized_status = str(status or "error").strip().lower()
    if normalized_status not in TOOL_STATUSES:
        normalized_status = "error"
    if normalized_status == "success" and data is None:
        normalized_status = "no_data"
    return {
        "status": normalized_status,
        "source": str(source or "unknown"),
        "data": data if data is not None else {},
        "evidence": list(evidence or []),
        "confidence": max(0.0, min(1.0, float(confidence or 0.0))),
        "freshness": freshness or {},
        "limitations": list(limitations or []),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def unavailable_tool(source: str, reason: str) -> Dict[str, Any]:
    return tool_result("unavailable", source, limitations=[str(reason)])


def error_tool(source: str, error: Exception | str) -> Dict[str, Any]:
    return tool_result("error", source, limitations=[str(error)])
