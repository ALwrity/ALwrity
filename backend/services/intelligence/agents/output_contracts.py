"""Output contracts shared by marketing-agent task generation."""

from __future__ import annotations

from typing import Any, Dict, Optional


ACTION_TYPES = {
    "navigate",
    "create_content",
    "seo_analyze",
    "create_seo_task",
    "calendar_insert",
    "linkedin_draft",
    "facebook_draft",
    "publish",
}

_ACTION_REQUIREMENTS = {
    "create_content": (("topic", "pillar_topic", "title"),),
    "seo_analyze": (("content", "draft"),),
    "create_seo_task": (("strategy_id",), ("scheduled_date",)),
    "calendar_insert": (("strategy_id",), ("scheduled_date",)),
    "linkedin_draft": (("topic", "pillar_topic", "title"),),
    "facebook_draft": (("topic", "pillar_topic", "title"),),
    "publish": (("platform",), ("content", "draft"), ("approval_id",), ("rollback_verified",)),
}


def _action_parameters(proposal: Any) -> Dict[str, Any]:
    get = proposal.get if isinstance(proposal, dict) else lambda key, default=None: getattr(proposal, key, default)
    values = get("action_parameters") or get("actionParameters")
    if not isinstance(values, dict):
        values = {}
    context_data = get("context_data")
    if not isinstance(context_data, dict) and isinstance(get("metadata"), dict):
        context_data = get("metadata").get("context_data")
    if isinstance(context_data, dict):
        return {**context_data, **values}
    return dict(values)


def _has_parameter(parameters: Dict[str, Any], alternatives: tuple[str, ...]) -> bool:
    return any(parameters.get(key) not in (None, "", [], {}) for key in alternatives)


def resolve_recommendation_action(proposal: Any) -> Dict[str, Any]:
    """Resolve an action type and validate the parameters needed to execute it."""
    get = proposal.get if isinstance(proposal, dict) else lambda key, default=None: getattr(proposal, key, default)
    requested = str(get("action_type", get("actionType", "navigate")) or "navigate").strip().lower()
    parameters = _action_parameters(proposal)
    source = str(get("source_agent", get("ownerAgent", "")) or "").lower()
    pillar = str(get("pillar_id", get("pillarId", "")) or "").lower()

    if requested == "navigate":
        if pillar == "generate" and "content" in source and _has_parameter(parameters, ("pillar_topic", "topic", "title")):
            requested = "create_content"
        elif pillar == "engage" and "social" in source:
            platform = str(parameters.get("platform") or "").lower()
            if platform == "facebook" and _has_parameter(parameters, ("topic", "pillar_topic", "title")):
                requested = "facebook_draft"
            elif platform == "linkedin" and _has_parameter(parameters, ("topic", "pillar_topic", "title")):
                requested = "linkedin_draft"
        elif pillar == "analyze" and "seo" in source:
            if _has_parameter(parameters, ("content", "draft")):
                requested = "seo_analyze"

    if requested not in ACTION_TYPES:
        return {
            "action_type": "navigate",
            "parameters": parameters,
            "execution_ready": False,
            "reason": f"Unsupported action type '{requested}'",
            "missing_parameters": [],
        }

    if requested == "publish" and parameters.get("rollback_verified") is not True:
        return {
            "action_type": "navigate",
            "parameters": parameters,
            "execution_ready": False,
            "reason": "Publishing remains disabled until rollback verification and approval are complete",
            "missing_parameters": ["rollback_verified"],
        }

    missing = [
        "/".join(alternatives)
        for alternatives in _ACTION_REQUIREMENTS.get(requested, ())
        if not _has_parameter(parameters, alternatives)
    ]
    if missing:
        return {
            "action_type": "navigate",
            "parameters": parameters,
            "execution_ready": False,
            "reason": f"{requested} is missing required parameters",
            "missing_parameters": missing,
        }

    if requested in {"linkedin_draft", "facebook_draft"}:
        platform = str(parameters.get("platform") or "").lower()
        if platform and platform != requested.removesuffix("_draft"):
            return {
                "action_type": "navigate",
                "parameters": parameters,
                "execution_ready": False,
                "reason": f"Unsupported platform '{platform}' for {requested}",
                "missing_parameters": [],
            }

    return {
        "action_type": requested,
        "parameters": parameters,
        "execution_ready": requested != "publish" or parameters.get("approval_id") is not None,
        "reason": None,
        "missing_parameters": [],
    }


ROLE_CONTRACTS: Dict[str, Dict[str, str]] = {
    "content_strategist": {
        "evidence": "Tie the task to a content pillar, audience, performance signal, or competitor finding.",
        "expected_impact": "State the expected content or funnel outcome.",
        "measurement": "Name the metric or observable result to check.",
    },
    "seo_specialist": {
        "evidence": "Tie the task to a URL, SEO audit finding, query, or measurable search opportunity.",
        "expected_impact": "State the expected visibility, ranking, traffic, or technical outcome.",
        "measurement": "Name the search or site metric to check.",
    },
    "competitor_response": {
        "evidence": "Tie the task to an observed competitor, change, threat, or gap.",
        "expected_impact": "State the expected positioning or demand outcome.",
        "measurement": "Name the competitive or content metric to check.",
    },
    "competitor_analyst": {
        "evidence": "Tie the task to a tracked competitor or verified market signal.",
        "expected_impact": "State the expected positioning or opportunity outcome.",
        "measurement": "Name the metric or decision that will be reviewed.",
    },
    "social_media_manager": {
        "evidence": "Tie the task to a platform, content format, audience, or engagement goal.",
        "expected_impact": "State the expected reach, engagement, or conversion outcome.",
        "measurement": "Name the platform metric to check.",
    },
    "social_amplification": {
        "evidence": "Tie the task to a platform, format, audience, or engagement signal.",
        "expected_impact": "State the expected reach, engagement, or conversion outcome.",
        "measurement": "Name the platform metric to check.",
    },
    "content_guardian": {
        "evidence": "Tie the task to a quality, safety, originality, or brand-rule finding.",
        "expected_impact": "State the quality or risk-reduction outcome.",
        "measurement": "Name the compliance or quality check to repeat.",
    },
}

_DEFAULT_CONTRACT = {
    "evidence": "Tie the task to a concrete onboarding, performance, or market signal.",
    "expected_impact": "State the expected business or marketing outcome.",
    "measurement": "Name the metric or observable result to check.",
}


def get_role_contract(agent_key: str) -> Dict[str, str]:
    """Return role-specific guidance without requiring a caller to know aliases."""
    return {**_DEFAULT_CONTRACT, **ROLE_CONTRACTS.get(agent_key, {})}


def task_output_schema(agent_key: str) -> Dict[str, Any]:
    """Build the common task schema used by specialized-agent LLM synthesis."""
    return {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "pillar_id": {"type": "string"},
                        "priority": {"type": "string"},
                        "estimated_time": {"type": "integer"},
                        "action_type": {"type": "string"},
                        "action_url": {"type": "string"},
                        "reasoning": {"type": "string"},
                        "evidence": {"type": "string"},
                        "expected_impact": {"type": "string"},
                        "effort": {"type": "string"},
                        "risk_level": {"type": "string"},
                        "measurement": {"type": "string"},
                        "recommendation": {"type": "string"},
                        "next_action": {"type": "string"},
                        "owner_agent": {"type": "string"},
                        "kpi": {"type": "string"},
                        "deadline": {"type": "string"},
                        "action_parameters": {"type": "object"},
                    },
                    "required": ["title", "pillar_id", "priority"],
                },
            }
        },
        "required": ["tasks"],
    }


def normalize_contract_text(value: Any, max_length: int = 500) -> Optional[str]:
    """Normalize optional contract text while keeping absent values absent."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:max_length]
