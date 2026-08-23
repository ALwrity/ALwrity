"""Tests for recommendation adapters backed by real product services."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.recommendation_execution import execute_supported_recommendation


@pytest.mark.asyncio
async def test_content_recommendation_calls_blog_service(monkeypatch):
    captured = {}

    class FakeBlogService:
        async def generate_section(self, request, user_id):
            captured["request"] = request
            captured["user_id"] = user_id
            return SimpleNamespace(success=True, markdown="# Generated draft")

    monkeypatch.setattr(
        "services.blog_writer.blog_service.BlogWriterService", FakeBlogService
    )
    result = await execute_supported_recommendation(
        "create_content",
        {
            "topic": "AI operations",
            "keywords": ["AI operations"],
            "onboarding_context": {
                "target_audience": "engineering leaders",
                "default_tone": "educational",
            },
        },
        "user-1",
    )

    assert result["success"] is True
    assert result["artifact_type"] == "content_draft"
    assert result["content"] == "# Generated draft"
    assert captured["user_id"] == "user-1"
    assert captured["request"].section.heading == "AI operations"
    assert captured["request"].tone == "educational"
    assert captured["request"].persona.audience == "engineering leaders"


@pytest.mark.asyncio
async def test_seo_recommendation_requires_content(monkeypatch):
    result = await execute_supported_recommendation(
        "seo_analyze", {}, "user-1"
    )

    assert result["success"] is False
    assert "requires content" in result["error"]


@pytest.mark.asyncio
async def test_seo_recommendation_calls_analyzer(monkeypatch):
    captured = {}

    class FakeBlogService:
        async def seo_analyze(self, request, user_id):
            captured["request"] = request
            return SimpleNamespace(success=True, score=0.8)

    monkeypatch.setattr(
        "services.blog_writer.blog_service.BlogWriterService", FakeBlogService
    )
    result = await execute_supported_recommendation(
        "seo_analyze",
        {"content": "A useful article", "keywords": ["article"]},
        "user-1",
    )

    assert result["success"] is True
    assert result["artifact_type"] == "seo_analysis"
    assert captured["request"].content == "A useful article"


@pytest.mark.asyncio
async def test_unsupported_action_returns_none_for_legacy_dispatch():
    result = await execute_supported_recommendation(
        "navigate", {"route": "/blog-writer"}, "user-1"
    )
    assert result is None


@pytest.mark.asyncio
async def test_linkedin_recommendation_calls_linkedin_service(monkeypatch):
    captured = {}

    class FakeService:
        async def generate_linkedin_post(self, request, user_id=None):
            captured["request"] = request
            captured["user_id"] = user_id
            return SimpleNamespace(
                success=True,
                data=SimpleNamespace(content="LinkedIn draft"),
            )

    monkeypatch.setattr("services.linkedin_service.LinkedInService", FakeService)
    result = await execute_supported_recommendation(
        "linkedin_draft",
        {"topic": "AI operations", "industry": "B2B SaaS"},
        "user-1",
    )

    assert result["success"] is True
    assert result["artifact_type"] == "linkedin_draft"
    assert result["content"] == "LinkedIn draft"
    assert captured["request"].topic == "AI operations"
    assert captured["user_id"] == "user-1"


@pytest.mark.asyncio
async def test_calendar_recommendation_calls_calendar_service(monkeypatch):
    captured = {}

    class FakeService:
        async def schedule_event(self, event_data, db):
            captured["event"] = event_data
            captured["db"] = db
            return {"status": "success", "event": {"id": 9}}

    monkeypatch.setattr(
        "api.content_planning.services.calendar_service.CalendarService", FakeService
    )
    result = await execute_supported_recommendation(
        "create_seo_task",
        {
            "strategy_id": 4,
            "title": "Refresh metadata",
            "scheduled_date": "2026-08-23T10:00:00",
        },
        "user-1",
        db=object(),
    )

    assert result["success"] is True
    assert result["artifact_type"] == "calendar_event"
    assert captured["event"]["content_type"] == "seo_page"
    assert captured["event"]["strategy_id"] == 4


@pytest.mark.asyncio
async def test_content_repurposing_generates_supported_platform_drafts(monkeypatch):
    class FakeLinkedIn:
        async def generate_linkedin_post(self, request, user_id=None):
            return SimpleNamespace(success=True, data=SimpleNamespace(content="LinkedIn adaptation"))

    class FakeFacebook:
        def generate_post(self, request, user_id):
            return SimpleNamespace(success=True, content="Facebook adaptation")

    monkeypatch.setattr("services.linkedin_service.LinkedInService", FakeLinkedIn)
    monkeypatch.setattr("api.facebook_writer.services.post_service.FacebookPostService", FakeFacebook)
    result = await execute_supported_recommendation(
        "create_content",
        {
            "topic": "AI operations",
            "original_content": "A long source article about practical AI operations for teams.",
            "target_platforms": ["linkedin", "facebook"],
            "onboarding_context": {
                "industry": "B2B SaaS",
                "target_audience": "engineering leaders",
            },
        },
        "user-1",
    )

    assert result["success"] is True
    assert {item["platform"] for item in result["artifacts"]} == {"linkedin", "facebook"}
    assert all(item["success"] for item in result["artifacts"])
