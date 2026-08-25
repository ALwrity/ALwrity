"""Proposal normalization and explicit daily-meeting review decisions."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, Iterable, List, Optional


REVIEW_STATUSES = {"accepted", "rejected", "quarantined", "merged", "deferred"}
PRIORITY_RANK = {"high": 3, "medium": 2, "low": 1}
DEFAULT_DAILY_CAPACITY_MINUTES = 240
VALID_PILLARS = {"plan", "generate", "publish", "analyze", "engage", "remarket"}
VALID_PRIORITIES = set(PRIORITY_RANK)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _get(proposal: Any, key: str, default: Any = None) -> Any:
    if isinstance(proposal, dict):
        return proposal.get(key, default)
    return getattr(proposal, key, default)


def _evidence(value: Any) -> List[Any]:
    if value is None or value == "":
        return []
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _confidence(proposal: Any) -> float:
    context = _get(proposal, "context_data", None) or {}
    try:
        return max(0.0, min(1.0, float(context.get("confidence", context.get("confidence_score", 0.0)))))
    except (TypeError, ValueError):
        return 0.0


def normalize_proposal(proposal: Any, agent_key: Optional[str] = None) -> Dict[str, Any]:
    """Normalize TaskProposal-like objects without inventing missing values."""
    agent = _text(agent_key or _get(proposal, "source_agent", "unknown")) or "unknown"
    action_parameters = _get(proposal, "action_parameters", None)
    action_parameters = dict(action_parameters) if isinstance(action_parameters, dict) else {}
    identity = {
        "agent": agent,
        "title": _text(_get(proposal, "title", "")),
        "description": _text(_get(proposal, "description", "")),
        "pillar": _text(_get(proposal, "pillar_id", "")),
        "action_parameters": action_parameters,
    }
    recommendation_id = "rec-" + hashlib.sha256(
        json.dumps(identity, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()[:20]
    return {
        "recommendation_id": recommendation_id,
        "agent": agent,
        "title": identity["title"],
        "description": identity["description"],
        "pillar": identity["pillar"],
        "evidence": _evidence(_get(proposal, "evidence", None)),
        "reasoning": _text(_get(proposal, "reasoning", "")),
        "priority": _text(_get(proposal, "priority", "medium")).lower() or "medium",
        "expected_impact": _text(_get(proposal, "expected_impact", "")),
        "effort": _text(_get(proposal, "effort", "")),
        "kpi": _text(_get(proposal, "kpi", "")),
        "deadline": _text(_get(proposal, "deadline", "")),
        "action_type": _text(_get(proposal, "action_type", "navigate")) or "navigate",
        "action_parameters": action_parameters,
        "confidence": _confidence(proposal),
        # How the proposal text was produced ("llm", "data_derived",
        # "template_fallback"); None when the source object predates or
        # omits the field, so downstream consumers never guess.
        "synthesis_mode": _text(_get(proposal, "synthesis_mode", "")) or None,
    }


def _tokens(proposal: Dict[str, Any]) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", f"{proposal['title']} {proposal['description']}".lower()))


def _resource(proposal: Dict[str, Any]) -> str:
    params = proposal.get("action_parameters") or {}
    return _text(params.get("target_resource") or params.get("target_url") or params.get("resource") or "").lower()


async def review_proposals(
    proposals: Iterable[Any],
    memory_service: Any = None,
    capacity_minutes: Optional[int] = DEFAULT_DAILY_CAPACITY_MINUTES,
    agent_keys: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Review proposals while retaining a decision record for every input."""
    proposals = list(proposals or [])
    keys = list(agent_keys or [])
    normalized = [normalize_proposal(proposal, keys[index] if index < len(keys) else None) for index, proposal in enumerate(proposals)]
    decisions = [{**item, "status": "accepted", "review_reasons": []} for item in normalized]

    for decision in decisions:
        if not decision["title"]:
            decision["status"] = "rejected"
            decision["review_reasons"].append("proposal title is required")
        elif decision["pillar"] not in VALID_PILLARS:
            decision["status"] = "rejected"
            decision["review_reasons"].append(f"unsupported pillar: {decision['pillar']}")
        if decision["priority"] not in VALID_PRIORITIES:
            decision["priority"] = "medium"
            decision["review_reasons"].append("invalid priority normalized to medium")
    # Exact duplicates are merged into the highest-priority deterministic winner.
    groups: Dict[str, List[int]] = {}
    for index, item in enumerate(decisions):
        if item["status"] != "accepted":
            continue
        fingerprint = json.dumps({key: item[key] for key in ("title", "description", "pillar", "action_type", "action_parameters")}, sort_keys=True)
        groups.setdefault(fingerprint, []).append(index)
    for indexes in groups.values():
        if len(indexes) < 2:
            continue
        winner = sorted(
            indexes,
            key=lambda index: (-PRIORITY_RANK.get(decisions[index]["priority"], 0), -decisions[index]["confidence"], decisions[index]["recommendation_id"]),
        )[0]
        for index in indexes:
            if index == winner:
                continue
            decisions[index]["status"] = "merged"
            decisions[index]["merged_into"] = decisions[winner]["recommendation_id"]
            decisions[index]["review_reasons"].append("exact duplicate merged into deterministic winner")

    # Recent outcome checks remain explicit instead of being silently filtered.
    if memory_service is not None and getattr(memory_service, "db", None) is not None:
        for index, proposal in enumerate(proposals):
            reason = memory_service.get_proposal_suppression_reason(proposal)
            if reason and decisions[index]["status"] == "accepted":
                decisions[index]["status"] = "deferred"
                decisions[index]["review_reasons"].append(reason)

        # Reuse the tenant's semantic index for historical rejected work. A
        # search failure degrades this check only; exact and outcome review
        # remain deterministic and visible in the decision record.
        intelligence = getattr(memory_service, "intelligence", None)
        if intelligence is not None:
            for index, proposal in enumerate(proposals):
                if decisions[index]["status"] != "accepted":
                    continue
                try:
                    matches = await intelligence.search(
                        f"{proposal.title} {proposal.description}", limit=1
                    )
                    top = matches[0] if matches else {}
                    score = float(top.get("score", 0.0))
                    indexed_status = str(top.get("status") or "").lower()
                    if not indexed_status and isinstance(top.get("object"), dict):
                        indexed_status = str(top["object"].get("status") or "").lower()
                    if score >= 0.85 and indexed_status in {"dismissed", "rejected", "skipped"}:
                        decisions[index]["status"] = "deferred"
                        decisions[index]["review_reasons"].append(
                            f"semantic match to rejected task (similarity={score:.2f})"
                        )
                except Exception:
                    continue

    # Deterministic semantic overlap among this meeting's proposals.
    for left in range(len(decisions)):
        if decisions[left]["status"] != "accepted":
            continue
        left_tokens = _tokens(decisions[left])
        for right in range(left + 1, len(decisions)):
            if decisions[right]["status"] != "accepted":
                continue
            right_tokens = _tokens(decisions[right])
            union = left_tokens | right_tokens
            similarity = len(left_tokens & right_tokens) / len(union) if union else 0.0
            if similarity < 0.85:
                continue
            winner, loser = sorted(
                (left, right),
                key=lambda index: (-PRIORITY_RANK.get(decisions[index]["priority"], 0), -decisions[index]["confidence"], decisions[index]["recommendation_id"]),
            )
            decisions[loser]["status"] = "merged"
            decisions[loser]["merged_into"] = decisions[winner]["recommendation_id"]
            decisions[loser]["review_reasons"].append(f"semantic duplicate of {decisions[winner]['recommendation_id']} (similarity={similarity:.2f})")

    # Same resource with incompatible action types is quarantined for review.
    resources: Dict[str, List[int]] = {}
    for index, item in enumerate(decisions):
        resource = _resource(item)
        if resource and item["status"] == "accepted":
            resources.setdefault(resource, []).append(index)
    for resource, indexes in resources.items():
        action_types = {decisions[index]["action_type"] for index in indexes}
        if len(indexes) > 1 and len(action_types) > 1:
            for index in indexes:
                decisions[index]["status"] = "quarantined"
                decisions[index]["review_reasons"].append(f"conflicting actions target the same resource: {resource}")

    # Capacity defers lower-priority accepted work rather than dropping it.
    if capacity_minutes is not None:
        try:
            remaining = max(0, int(capacity_minutes))
        except (TypeError, ValueError):
            remaining = DEFAULT_DAILY_CAPACITY_MINUTES
        ordered = sorted(
            (index for index, item in enumerate(decisions) if item["status"] == "accepted"),
            key=lambda index: (-PRIORITY_RANK.get(decisions[index]["priority"], 0), -decisions[index]["confidence"], decisions[index]["recommendation_id"]),
        )
        for index in ordered:
            effort = _get(proposals[index], "estimated_time", 0) or 0
            if effort > remaining:
                decisions[index]["status"] = "deferred"
                decisions[index]["review_reasons"].append(f"daily capacity exceeded ({capacity_minutes} minutes)")
            else:
                remaining -= max(0, int(effort))

    summary = {status: sum(1 for item in decisions if item["status"] == status) for status in REVIEW_STATUSES}
    return {
        "normalized_proposals": decisions,
        "accepted_proposals": [proposals[index] for index, item in enumerate(decisions) if item["status"] == "accepted"],
        "summary": summary,
    }


def prioritize_proposals(
    proposals: Iterable[Dict[str, Any]],
    grounding: Optional[Dict[str, Any]] = None,
    preflight: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Rank approved proposals using explicit, inspectable selection factors."""
    grounding = grounding or {}
    onboarding = grounding.get("onboarding_data") if isinstance(grounding.get("onboarding_data"), dict) else {}
    goals = onboarding.get("business_goals") or onboarding.get("goals") or []
    if isinstance(goals, str):
        goals = [goals]
    goal_tokens = set(re.findall(r"[a-z0-9]+", " ".join(map(str, goals)).lower()))
    preferences = onboarding.get("user_preferences") or onboarding.get("preferences") or {}
    if not isinstance(preferences, dict):
        preferences = {}
    preferred_pillars = {str(value).lower() for value in preferences.get("priority_pillars", [])}
    provider_status = ((preflight or {}).get("checks") or {}).get("providers", {}).get("status")
    items = [dict(proposal) for proposal in proposals or []]
    pillar_counts: Dict[str, int] = {}
    for proposal in items:
        pillar = proposal.get("pillar") or "unknown"
        pillar_counts[pillar] = pillar_counts.get(pillar, 0) + 1

    for proposal in items:
        tokens = _tokens(proposal)
        factors = {
            "business_goal_alignment": (
                len(tokens & goal_tokens) / len(goal_tokens) if goal_tokens else 0.5
            ),
            "evidence_quality": min(1.0, len(proposal.get("evidence") or []) / 2.0),
            "expected_impact": 1.0 if proposal.get("expected_impact") else 0.3,
            "effort": {"low": 1.0, "medium": 0.7, "high": 0.4}.get(str(proposal.get("effort") or "").lower(), 0.5),
            "urgency": 1.0 if any(word in str(proposal.get("deadline") or "").lower() for word in ("today", "urgent", "now")) else (0.75 if proposal.get("deadline") else 0.4),
            "existing_task_history": 1.0 if proposal.get("status") == "accepted" else 0.4,
            "provider_availability": 1.0 if provider_status == "available" else 0.5,
            "user_preferences": 1.0 if proposal.get("pillar", "").lower() in preferred_pillars else (0.5 if preferred_pillars else 0.5),
            "pillar_coverage": 1.0 / max(1, pillar_counts.get(proposal.get("pillar") or "unknown", 1)),
            "priority": PRIORITY_RANK.get(str(proposal.get("priority") or "medium").lower(), 2) / 3.0,
        }
        weights = {
            "business_goal_alignment": 0.18,
            "evidence_quality": 0.18,
            "expected_impact": 0.16,
            "effort": 0.10,
            "urgency": 0.10,
            "existing_task_history": 0.08,
            "provider_availability": 0.05,
            "user_preferences": 0.05,
            "pillar_coverage": 0.05,
            "priority": 0.05,
        }
        proposal["selection_factors"] = factors
        proposal["selection_score"] = round(sum(factors[key] * weights[key] for key in weights), 4)
        reasons = []
        if factors["business_goal_alignment"] > 0.5:
            reasons.append("aligns with a stated business goal")
        if factors["evidence_quality"] > 0:
            reasons.append("has supporting evidence")
        if factors["expected_impact"] >= 1.0:
            reasons.append("has an expected impact")
        if factors["urgency"] >= 0.75:
            reasons.append("has a current deadline")
        if factors["pillar_coverage"] < 1.0:
            reasons.append("helps balance pillar coverage")
        proposal["selection_reason"] = reasons or ["passed the meeting review"]
    return sorted(
        items,
        key=lambda proposal: (-proposal["selection_score"], -PRIORITY_RANK.get(str(proposal.get("priority") or "medium").lower(), 2), proposal.get("recommendation_id", "")),
    )
