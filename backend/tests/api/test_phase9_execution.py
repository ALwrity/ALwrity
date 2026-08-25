"""Phase 9 tests for recommendation execution and approval resumption."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import api.agents_api as agents_api
import api.today_workflow as today_workflow
from services.intelligence.agents.agent_orchestrator import execute_agent_action
from services.today_workflow_service import _resolve_recommendation_action_type


class _Query:
    def __init__(self, value):
        self.value = value

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.value


class _DB:
    def __init__(self, value):
        self.value = value
        self.commits = 0

    def query(self, model):
        return _Query(self.value)

    def add(self, value):
        self.value = value

    def commit(self):
        self.commits += 1

    def refresh(self, value):
        pass


class _Proposal:
    def __init__(self, pillar_id, source_agent, action_type="navigate", context_data=None):
        self.pillar_id = pillar_id
        self.source_agent = source_agent
        self.action_type = action_type
        self.context_data = context_data or {}


def test_recommendation_action_mapping_is_explicit_and_safe():
    assert _resolve_recommendation_action_type(
        _Proposal("generate", "ContentStrategyAgent", context_data={"pillar_topic": "SEO"})
    ) == "create_content"
    assert _resolve_recommendation_action_type(
        _Proposal("engage", "SocialAmplificationAgent", context_data={"platform": "facebook", "topic": "A topic"})
    ) == "facebook_draft"
    assert _resolve_recommendation_action_type(
        _Proposal("engage", "SocialAmplificationAgent", context_data={"platform": "linkedin", "topic": "A topic"})
    ) == "linkedin_draft"
    assert _resolve_recommendation_action_type(
        _Proposal("generate", "ContentStrategyAgent")
    ) == "navigate"


class _Task:
    id = 42
    user_id = "user_phase9"
    plan_id = 7
    title = "Create SEO brief"
    description = "Create a brief for the highest-value organic opportunity."
    action_type = "create_content"
    action_url = "/blog-writer"
    status = "pending"
    metadata_json = {
        "source_agent": "seo_specialist",
        "context_data": {"keyword": "workflow automation"},
    }
    updated_at = None
    completion_notes = None


class _Approval:
    id = 8
    status = "pending"
    decision = None
    action_id = "action-8"
    action_type = "create_content"
    agent_type = "content_strategist"
    target_resource = "content brief"
    risk_level = 0.4
    payload = {
        "action_id": "action-8",
        "agent_type": "content_strategist",
        "action_type": "create_content",
        "target_resource": "content brief",
        "parameters": {"topic": "workflow automation"},
        "expected_outcome": "A usable brief",
        "risk_level": 0.4,
    }
    decided_at = None


class _ApprovalService:
    def __init__(self, db, user_id):
        self.db = db

    def decide_approval_request(self, approval_id, decision, user_comments=""):
        req = self.db.value
        req.status = "approved" if decision == "approved" else "rejected"
        req.decision = decision
        req.decided_at = datetime.utcnow()
        return req

    def create_alert(self, **kwargs):
        pass


class _Agent:
    def __init__(self):
        self.actions = []

    async def execute_action(self, action):
        self.actions.append(action)
        return {"success": True, "result": "executed", "action_id": action.action_id}


class _Orchestrator:
    def __init__(self, agent):
        self.agents = {"content": agent}


@pytest.mark.asyncio
async def test_navigation_task_is_honest_and_has_no_side_effect(monkeypatch):
    task = _Task()
    task.action_type = "navigate"
    dispatched = []
    monkeypatch.setattr(today_workflow, "execute_agent_action", lambda *args: dispatched.append(args))

    result = await today_workflow.execute_workflow_task(
        task_id=42,
        body=today_workflow.TaskExecutionRequest(),
        current_user={"id": "user_phase9"},
        db=_DB(task),
    )

    assert result["success"] is True
    assert result["data"]["requires_navigation"] is True
    assert dispatched == []
    assert task.status == "pending"


@pytest.mark.asyncio
async def test_executable_task_dispatches_and_completes(monkeypatch):
    task = _Task()
    captured = {}

    async def no_adapter(*args):
        return None

    monkeypatch.setattr(today_workflow, "execute_supported_recommendation", no_adapter)

    async def dispatch(user_id, agent_type, action):
        captured.update({"user_id": user_id, "agent_type": agent_type, "action": action})
        return {"success": True, "result": "brief created"}

    monkeypatch.setattr(today_workflow, "execute_agent_action", dispatch)
    result = await today_workflow.execute_workflow_task(
        task_id=42,
        body=today_workflow.TaskExecutionRequest(),
        current_user={"id": "user_phase9"},
        db=_DB(task),
    )

    assert result["success"] is True
    assert result["data"]["status"] == "completed"
    assert task.status == "completed"
    assert captured["agent_type"] == "seo_specialist"
    assert captured["action"].parameters["keyword"] == "workflow automation"
    assert captured["action"].parameters["task_id"] == 42


@pytest.mark.asyncio
async def test_publish_action_requires_approval_even_when_flag_is_false(monkeypatch):
    task = _Task()
    task.action_type = "publish"
    captured = {}

    async def dispatch(user_id, agent_type, action):
        captured["action"] = action
        return {"success": False, "requires_approval": True, "approval_request_id": 9}

    monkeypatch.setattr(today_workflow, "execute_agent_action", dispatch)
    result = await today_workflow.execute_workflow_task(
        task_id=42,
        body=today_workflow.TaskExecutionRequest(requires_approval=False),
        current_user={"id": "user_phase9"},
        db=_DB(task),
    )

    assert result["success"] is True
    assert result["data"]["status"] == "awaiting_approval"
    assert captured["action"].requires_approval is True


@pytest.mark.asyncio
async def test_agent_action_dispatch_maps_catalog_type(monkeypatch):
    agent = _Agent()

    async def get_or_create(user_id):
        return _Orchestrator(agent)

    import services.intelligence.agents.agent_orchestrator as orchestrator_module

    monkeypatch.setattr(
        orchestrator_module.orchestration_service,
        "get_or_create_orchestrator",
        get_or_create,
    )
    from services.intelligence.agents.core_agent_framework import AgentAction

    action = AgentAction(
        action_id="a1",
        agent_type="content_strategist",
        action_type="create_content",
        target_resource="brief",
        parameters={},
        expected_outcome="brief",
        risk_level=0.2,
    )
    result = await execute_agent_action("user_phase9", "content_strategist", action)

    assert result["success"] is True
    assert agent.actions[0] is action


@pytest.mark.asyncio
async def test_platform_publish_is_blocked_until_rollback_is_verified(monkeypatch):
    monkeypatch.delenv("ALWRITY_ENABLE_PUBLISHING", raising=False)
    from services.intelligence.agents.core_agent_framework import AgentAction

    action = AgentAction(
        action_id="publish-1",
        agent_type="social_media_manager",
        action_type="publish",
        target_resource="LinkedIn",
        parameters={"content": "draft"},
        expected_outcome="publish post",
        risk_level=0.9,
    )

    result = await execute_agent_action("user_phase9", "social_media_manager", action)

    assert result["success"] is False
    assert result["error_code"] == "PUBLISHING_QUALITY_GATE_FAILED"


@pytest.mark.asyncio
async def test_approved_action_is_resumed_without_second_approval(monkeypatch):
    approval = _Approval()
    db = _DB(approval)
    monkeypatch.setattr(agents_api, "AgentActivityService", _ApprovalService)
    captured = {}

    async def dispatch(user_id, agent_type, action):
        captured["action"] = action
        return {"success": True, "result": "done"}

    monkeypatch.setattr(agents_api, "execute_agent_action", dispatch)

    result = await agents_api.decide_agent_approval_endpoint(
        approval_id=8,
        body={"decision": "approved"},
        current_user={"id": "user_phase9"},
        db=db,
    )

    assert result["success"] is True
    assert result["data"]["execution"]["success"] is True
    assert captured["action"].action_id == "action-8"
    assert captured["action"].requires_approval is False
