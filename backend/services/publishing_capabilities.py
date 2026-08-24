"""Capability gate for human-approved platform publishing."""

from __future__ import annotations

import os
from typing import Any, Dict


PLATFORM_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "linkedin": {
        "supported": True,
        "rollback_supported": False,
        "enabled": False,
        "reason": "LinkedIn rollback/delete verification is not complete",
    },
    "wordpress": {
        "supported": True,
        "rollback_supported": True,
        "enabled": False,
        "reason": "WordPress publish adapter verification is not complete",
    },
    "wix": {
        "supported": True,
        "rollback_supported": False,
        "enabled": False,
        "reason": "Wix rollback verification is not complete",
    },
    "facebook": {
        "supported": False,
        "rollback_supported": False,
        "enabled": False,
        "reason": "Facebook publishing is coming soon",
    },
}


def get_publish_capability(platform: str) -> Dict[str, Any]:
    key = str(platform or "").strip().lower()
    capability = PLATFORM_CAPABILITIES.get(key)
    if capability is None:
        return {
            "platform": key or "unknown",
            "supported": False,
            "rollback_supported": False,
            "enabled": False,
            "reason": "Platform publishing is not supported",
        }
    return {"platform": key, **capability}


def evaluate_publish_gate(action: Any) -> Dict[str, Any]:
    """Evaluate publish prerequisites without trusting client-supplied approval."""
    parameters = getattr(action, "parameters", None)
    parameters = parameters if isinstance(parameters, dict) else {}
    platform = str(parameters.get("platform") or "").strip().lower()
    capability = get_publish_capability(platform)
    checks = {
        "provider_connected": parameters.get("provider_connected") is True,
        "permission_verified": parameters.get("permission_verified") is True,
        "rollback_supported": capability["rollback_supported"] is True,
        "rollback_verified": parameters.get("rollback_verified") is True,
        "approval_recorded": parameters.get("approval_recorded") is True,
        "quality_gate_passed": parameters.get("quality_gate_passed") is True,
        "idempotency_key": bool(parameters.get("idempotency_key")),
        "publishing_enabled": os.getenv("ALWRITY_ENABLE_PUBLISHING", "false").lower() == "true",
    }
    failures = [name for name, passed in checks.items() if not passed]
    if not capability["supported"]:
        failures.append("unsupported_platform")
    if not capability["enabled"]:
        failures.append("platform_not_enabled")
    return {
        "allowed": not failures,
        "platform": platform or "unknown",
        "capability": capability,
        "checks": checks,
        "failed_checks": list(dict.fromkeys(failures)),
    }
