"""Outcome aggregation for user-facing marketing workflow reporting."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable


def _metadata(task: Any) -> Dict[str, Any]:
    value = getattr(task, "metadata_json", None)
    return value if isinstance(value, dict) else {}


def _metric_summary(values: Dict[str, list[float]]) -> Dict[str, Dict[str, Any]]:
    result: Dict[str, Dict[str, Any]] = {}
    for name, observations in sorted(values.items()):
        if not observations:
            continue
        result[name] = {
            "observations": len(observations),
            "latest": observations[-1],
            "average": round(sum(observations) / len(observations), 4),
        }
    return result


def summarize_workflow_outcomes(tasks: Iterable[Any]) -> Dict[str, Any]:
    """Aggregate persisted task decisions, executions, and outcome metrics."""
    task_list = list(tasks or [])
    status_counts = defaultdict(int)
    accepted = rejected = undecided = 0
    execution_attempts = execution_successes = execution_failures = approvals = 0
    publishing_planned = publishing_completed = 0
    seo_values: Dict[str, list[float]] = defaultdict(list)
    social_values: Dict[str, list[float]] = defaultdict(list)
    lineage = []

    for task in task_list:
        status = str(getattr(task, "status", "pending") or "pending").lower()
        pillar = str(getattr(task, "pillar_id", "") or "").lower()
        status_counts[status] += 1
        if status in {"completed", "in_progress", "awaiting_approval"}:
            accepted += 1
        elif status in {"skipped", "dismissed", "rejected"}:
            rejected += 1
        else:
            undecided += 1

        if pillar == "publish":
            publishing_planned += 1
            if status == "completed":
                publishing_completed += 1

        metadata = _metadata(task)
        artifact = metadata.get("artifact") if isinstance(metadata.get("artifact"), dict) else {}
        if metadata.get("recommendation_id") or artifact.get("asset_id"):
            lineage.append({
                "task_id": getattr(task, "id", None),
                "title": getattr(task, "title", None),
                "status": status,
                "recommendation_id": metadata.get("recommendation_id"),
                "artifact_id": artifact.get("asset_id"),
                "published_asset_id": metadata.get("published_asset_id") or artifact.get("published_asset_id"),
                "source_agent": metadata.get("source_agent"),
                "action_url": getattr(task, "action_url", None),
            })
        execution = metadata.get("execution")
        if isinstance(execution, dict):
            execution_attempts += int(execution.get("attempts") or 1)
            if execution.get("success"):
                execution_successes += 1
            elif execution.get("requires_approval"):
                approvals += 1
            else:
                execution_failures += 1

        outcome_metrics = metadata.get("outcome_metrics")
        if not isinstance(outcome_metrics, dict):
            continue
        if pillar == "analyze" or outcome_metrics.get("channel") == "seo":
            target = seo_values
        elif pillar == "engage" or outcome_metrics.get("channel") == "social":
            target = social_values
        else:
            continue
        for name, value in outcome_metrics.items():
            if name == "channel":
                continue
            try:
                target[str(name)].append(float(value))
            except (TypeError, ValueError):
                continue

    decided = accepted + rejected
    return {
        "tasks": {
            "planned": len(task_list),
            "accepted": accepted,
            "rejected": rejected,
            "undecided": undecided,
            "status_counts": dict(sorted(status_counts.items())),
            "acceptance_rate": round(accepted / decided, 4) if decided else None,
        },
        "execution": {
            "attempts": execution_attempts,
            "successful": execution_successes,
            "failed": execution_failures,
            "awaiting_approval": approvals,
            "success_rate": round(execution_successes / execution_attempts, 4) if execution_attempts else None,
        },
        "publishing": {
            "planned": publishing_planned,
            "completed": publishing_completed,
            "consistency_rate": round(publishing_completed / publishing_planned, 4) if publishing_planned else None,
        },
        "seo_performance": _metric_summary(seo_values),
        "social_performance": _metric_summary(social_values),
        "measurement": {
            "status": "measured" if seo_values or social_values else "awaiting_measurements",
            "source": "user_recorded_task_outcome_metrics",
        },
        "lineage": lineage[-100:],
    }
