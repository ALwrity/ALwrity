"""Tests for the disabled-by-default publishing capability gate."""

from __future__ import annotations

from types import SimpleNamespace

from services.publishing_capabilities import evaluate_publish_gate, get_publish_capability


def test_facebook_is_explicitly_coming_soon():
    capability = get_publish_capability("facebook")
    assert capability["supported"] is False
    assert capability["enabled"] is False
    assert "coming soon" in capability["reason"].lower()


def test_publish_requires_all_capability_checks():
    action = SimpleNamespace(
        action_type="publish",
        parameters={
            "platform": "wordpress",
            "provider_connected": True,
            "permission_verified": True,
            "rollback_verified": True,
            "approval_recorded": True,
            "quality_gate_passed": True,
            "idempotency_key": "publish-1",
        },
    )

    result = evaluate_publish_gate(action)

    assert result["allowed"] is False
    assert "publishing_enabled" in result["failed_checks"]
    assert "platform_not_enabled" in result["failed_checks"]


def test_unknown_platform_cannot_publish():
    action = SimpleNamespace(action_type="publish", parameters={"platform": "instagram"})
    result = evaluate_publish_gate(action)
    assert result["allowed"] is False
    assert "unsupported_platform" in result["failed_checks"]
