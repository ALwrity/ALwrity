"""Controlled feedback aggregation for agent-team optimization."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable


MIN_FEEDBACK_SAMPLES = 3


def _metadata(task: Any) -> Dict[str, Any]:
    value = getattr(task, "metadata_json", None)
    return value if isinstance(value, dict) else {}


def build_optimization_signals(tasks: Iterable[Any]) -> Dict[str, Any]:
    """Build reviewable optimization signals without auto-changing agents."""
    scores_by_agent: Dict[str, list[int]] = defaultdict(list)
    scores_by_pillar: Dict[str, list[int]] = defaultdict(list)

    for task in tasks or []:
        feedback = _metadata(task).get("feedback")
        if not isinstance(feedback, dict):
            continue
        try:
            score = int(feedback.get("score"))
        except (TypeError, ValueError):
            continue
        if score not in {-1, 0, 1}:
            continue
        metadata = _metadata(task)
        agent = str(metadata.get("source_agent") or "unknown")
        pillar = str(getattr(task, "pillar_id", "unknown") or "unknown")
        scores_by_agent[agent].append(score)
        scores_by_pillar[pillar].append(score)

    def summarize(values: Dict[str, list[int]]) -> Dict[str, Any]:
        result = {}
        for key, scores in sorted(values.items()):
            total = len(scores)
            average = round(sum(scores) / total, 4)
            result[key] = {
                "samples": total,
                "positive": scores.count(1),
                "neutral": scores.count(0),
                "negative": scores.count(-1),
                "average_score": average,
                "eligible_for_optimization": total >= MIN_FEEDBACK_SAMPLES,
            }
        return result

    agent_summary = summarize(scores_by_agent)
    pillar_summary = summarize(scores_by_pillar)
    signals = []
    for agent, summary in agent_summary.items():
        if summary["eligible_for_optimization"] and summary["average_score"] < 0:
            signals.append({
                "type": "agent_quality_review",
                "agent": agent,
                "reason": "Feedback is negative across the minimum sample size.",
                "recommended_action": "Review evidence, prioritization, and output quality before changing prompts.",
            })
    for pillar, summary in pillar_summary.items():
        if summary["eligible_for_optimization"] and summary["average_score"] < 0:
            signals.append({
                "type": "pillar_quality_review",
                "pillar": pillar,
                "reason": "Feedback is negative for this workflow pillar across the minimum sample size.",
                "recommended_action": "Review task relevance and execution path for this pillar.",
            })

    return {
        "agent_feedback": agent_summary,
        "pillar_feedback": pillar_summary,
        "signals": signals,
        "control": {
            "minimum_feedback_samples": MIN_FEEDBACK_SAMPLES,
            "auto_changes_applied": False,
            "status": "review_required" if signals else "no_actionable_signal",
        },
    }
