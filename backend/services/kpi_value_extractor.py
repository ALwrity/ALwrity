"""Phase 6a: KPI value extractor from real tool results (TDD).

Extracts a single numeric metric value from ``TaskExecutionLog.result_data``
``tool_result`` payloads using registered dotted-key paths. Only returns
REAL measured values — any missing/non-numeric/unmapped input yields
``None`` (never a fabricated number).
"""
from typing import Any, Dict, Optional

# metric -> dotted path inside the tool result dict (grounded in actual
# service output shapes: gsc_analyzer, sitemap_service, pagespeed_service).
_METRIC_PATHS: Dict[str, str] = {
    "gsc.visibility_score": "performance_overview.total_impressions",
    "gsc.ctr": "performance_overview.overall_ctr",
    "gsc.avg_position": "performance_overview.average_position",
    "sitemap.total_urls": "total_urls",
    "pagespeed.performance_score": "category_scores.performance.score",
}


def _all_metric_values() -> Optional[set]:
    """Return known metric values; try the canonical registry first."""
    try:
        from services.monitoring_metrics import ALLOWED_METRICS
        if isinstance(ALLOWED_METRICS, set) and ALLOWED_METRICS:
            return ALLOWED_METRICS
    except Exception:
        pass
    return None


def _fmt(metric: str) -> str:
    return str(metric or "").strip().lower()


def is_extractable(metric: str) -> bool:
    return _fmt(metric) in _METRIC_PATHS


def extract_metric_value(tool_result: Any, metric: str) -> Optional[float]:
    """Return the measured numeric value for ``metric`` or ``None``.

    Args:
        tool_result: The raw tool output (``result_data['tool_result']``).
        metric: MetricKey value (e.g. ``gsc.ctr``).

    Returns:
        float when a real value exists at the registered path; None otherwise
        (unknown metric, missing key, non-numeric value, non-dict payload).
    """
    path = _METRIC_PATHS.get(_fmt(metric))
    if not path:
        return None
    if not isinstance(tool_result, dict):
        return None
    cursor: Any = tool_result
    for part in path.split("."):
        if not isinstance(cursor, dict):
            return None
        cursor = cursor.get(part)
    if cursor is None:
        return None
    try:
        return float(cursor)
    except (TypeError, ValueError):
        return None


def normalize_kpi_metric(metric: str) -> Optional[str]:
    """Resolve a strategy KPI name to a monitoring MetricKey value.

    Strategy KPI names (``visibility_score``) may omit the domain prefix.
    Tries: exact known metric value -> legacy display name map -> suffix
    fallback (``ctr`` -> ``gsc.ctr``). Returns the canonical key, or None
    when unmappable (honest absence). Never guesses a domain.
    """
    raw = _fmt(metric)
    if not raw:
        return None

    known = _all_metric_values()
    if known and raw in known:
        return raw

    # 2. legacy display name -> MetricKey value (best effort)
    try:
        from services.monitoring_metrics import LEGACY_METRIC_MAP
        for legacy, canonical in LEGACY_METRIC_MAP.items():
            if str(legacy).strip().lower() == raw:
                return canonical
    except Exception:
        pass

    # 3. suffix fallback: a bare name matching the tail of a known value
    #    (e.g. 'ctr' -> 'gsc.ctr'). Prefer the registered path domain.
    values = known or set(_METRIC_PATHS)
    canonical = None
    for value in values:
        if isinstance(value, str) and value.lower().endswith(f".{raw}"):
            if value in _METRIC_PATHS:
                return value
            canonical = canonical or value
    return canonical


def extract_kpi_last_values(logs_by_task: Dict[Any, Any]) -> Dict[str, float]:
    """Aggregate per-metric last values from latest logs' tool results.

    Args:
        logs_by_task: mapping task_id -> TaskExecutionLog (latest per task),
            each with ``result_data`` / ``metric`` fields.

    Returns:
        Dict of metric -> measured value for success logs with an
        extractable tool_result. Empty when none (never fabricated).
    """
    out: Dict[str, float] = {}
    for _task_id, log in logs_by_task.items():
        if log is None:
            continue
        if getattr(log, "status", None) != "success":
            continue
        result_data = getattr(log, "result_data", None)
        if not isinstance(result_data, dict):
            continue
        tool_result = result_data.get("tool_result")
        metric = result_data.get("metric")
        if not is_extractable(metric):
            continue
        value = extract_metric_value(tool_result, metric)
        if value is not None:
            out[str(metric).lower()] = value
    return out