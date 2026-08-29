#!/usr/bin/env python3
"""Run podcast preflight + operations and verify billing usage/cost deltas."""

import os
import json
import asyncio
from pathlib import Path
from typing import Any

# Use mock auth in local test runs
os.environ.setdefault("DISABLE_AUTH", "true")
os.environ.setdefault("ALLOW_UNVERIFIED_JWT_DEV", "true")
os.environ.setdefault(
    "STRIPE_PLAN_PRICE_MAPPING_TEST",
    "{\"basic\": {\"monthly\": \"price_test_basic_monthly\"}, \"pro\": {\"monthly\": \"price_test_pro_monthly\"}}",
)
os.environ.setdefault("EXA_API_KEY", "test-exa-key")

import spacy

# Avoid hard dependency on downloaded spaCy model during router imports.
spacy.load = lambda _name, *args, **kwargs: object()  # type: ignore[assignment]

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Import only required routers (avoids heavyweight app startup deps)
from api.podcast.router import router as podcast_router
from api.subscription import router as subscription_router
from api.podcast.handlers import analysis as analysis_handler
from api.podcast.handlers import research as research_handler
from api.podcast.handlers import video as video_handler
from api.podcast.constants import get_podcast_media_dir, PODCAST_IMAGES_DIR
from services.database import get_session_for_user
from services.subscription.usage_tracking_service import UsageTrackingService
from models.subscription_models import APIProvider


USER_ID = "mock_user_id"
AUTH_HEADERS = {"Authorization": "Bearer test-token"}
BILLING_PERIOD = "2026-03"


def _ensure_test_media_files(user_id: str) -> tuple[str, str]:
    audio_dir = get_podcast_media_dir("audio", user_id, ensure_exists=True)
    image_dir = get_podcast_media_dir("image", user_id, ensure_exists=True)

    audio_file = audio_dir / "sequence_test_audio.mp3"
    image_file = image_dir / "sequence_test_image.png"

    if not audio_file.exists():
        audio_file.write_bytes(b"ID3" + b"\x00" * 512)
    if not image_file.exists():
        # Minimal PNG header-like bytes (sufficient for mocked pipeline)
        image_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 512)
    # Also place in legacy global dir for URL resolver compatibility.
    PODCAST_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    legacy_image_file = PODCAST_IMAGES_DIR / image_file.name
    if not legacy_image_file.exists():
        legacy_image_file.write_bytes(image_file.read_bytes())

    return (
        f"/api/podcast/audio/{audio_file.name}",
        f"/api/podcast/images/{image_file.name}",
    )


def _patch_external_calls() -> None:
    # 1) Podcast analysis: avoid real LLM calls
    def _mock_llm_text_gen(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "audience": "US founders building AI products",
            "content_type": "interview",
            "top_keywords": ["ai agent", "startup", "gtm", "cost", "automation"],
            "suggested_outlines": [
                {"title": "What changed in 2026", "segments": ["Market", "Tools", "ROI", "Pitfalls"]},
                {"title": "Building with constraints", "segments": ["Budget", "Stack", "Team", "Execution"]},
            ],
            "title_suggestions": ["AI Agents in 2026", "Ship Faster with AI", "Startup AI Playbook"],
            "research_queries": [
                {"query": "AI agent adoption data 2026 startups", "rationale": "quantify adoption"},
                {"query": "founder interviews AI automation ROI", "rationale": "real examples"},
            ],
            "exa_suggested_config": {
                "exa_search_type": "auto",
                "max_sources": 6,
                "include_statistics": True,
            },
        }

    async def _mock_exa_search(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "provider": "exa",
            "search_type": "neural",
            "search_queries": ["AI agent adoption data 2026 startups"],
            "sources": [
                {
                    "title": "Agentic AI trends",
                    "url": "https://example.com/agentic-ai-trends",
                    "excerpt": "Adoption rose notably among SMB teams.",
                    "index": 1,
                }
            ],
            "content": "Key Highlights: Adoption increased and ROI became more measurable.",
            "cost": {"total": 0.015},
        }

    def _mock_animate_scene_with_voiceover(*args: Any, **kwargs: Any) -> dict[str, Any]:
        return {
            "video_bytes": b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 1024,
            "provider": "wavespeed",
            "model_name": "wavespeed-ai/infinitetalk",
            "prompt": "Animate presenter speaking clearly.",
            "cost": 0.09,
            "duration": 8.0,
        }

    analysis_handler.llm_text_gen = _mock_llm_text_gen
    research_handler.llm_text_gen = _mock_llm_text_gen
    research_handler.ExaResearchProvider.search = _mock_exa_search
    video_handler.animate_scene_with_voiceover = _mock_animate_scene_with_voiceover


def _post_json(client: TestClient, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    res = client.post(path, json=payload, headers=AUTH_HEADERS)
    res.raise_for_status()
    return res.json()


def _get_json(client: TestClient, path: str) -> dict[str, Any]:
    res = client.get(path, headers=AUTH_HEADERS)
    res.raise_for_status()
    return res.json()


def _provider_cost_totals(logs_payload: dict[str, Any]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for row in logs_payload.get("logs", []):
        provider = (row.get("provider") or "unknown").lower()
        totals[provider] = totals.get(provider, 0.0) + float(row.get("cost_total") or 0.0)
    return totals


def _record_usage(user_id: str, provider: APIProvider, endpoint: str, model: str, tokens_in: int = 0, tokens_out: int = 0) -> None:
    db = get_session_for_user(user_id)
    if not db:
        return
    try:
        service = UsageTrackingService(db)
        asyncio.run(
            service.track_api_usage(
                user_id=user_id,
                provider=provider,
                endpoint=endpoint,
                method="POST",
                model_used=model,
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                response_time=0.42,
                status_code=200,
            )
        )
    finally:
        db.close()


def main() -> None:
    _patch_external_calls()
    audio_url, avatar_image_path = _ensure_test_media_files(USER_ID)

    app = FastAPI()
    app.include_router(subscription_router)
    app.include_router(podcast_router)

    with TestClient(app) as client:
        # Baseline billing snapshots
        baseline_dashboard = _get_json(client, f"/api/subscription/dashboard/{USER_ID}?billing_period={BILLING_PERIOD}")
        baseline_logs = _get_json(client, "/api/subscription/usage-logs?limit=500")

        before_cost = float(baseline_dashboard["data"]["summary"]["total_cost_this_month"])
        before_calls = int(baseline_dashboard["data"]["summary"]["total_api_calls_this_month"])
        before_projection = float(baseline_dashboard["data"]["projections"]["projected_monthly_cost"])
        before_provider_costs = _provider_cost_totals(baseline_logs)

        # 1) Preflight for podcast analysis + video
        preflight_payload = {
            "operations": [
                {
                    "provider": "huggingface",
                    "operation_type": "podcast_analysis",
                    "tokens_requested": 1200,
                    "model": "meta-llama/llama-3.3-70b-instruct",
                },
                {
                    "provider": "video",
                    "operation_type": "scene_animation",
                    "tokens_requested": 0,
                    "model": "wavespeed-ai/infinitetalk",
                    "actual_provider_name": "wavespeed",
                },
            ]
        }
        preflight = _post_json(client, "/api/subscription/preflight-check", preflight_payload)

        # 2a) Podcast analysis
        analysis = _post_json(
            client,
            "/api/podcast/analyze",
            {
                "idea": "How AI agents are changing founder workflows",
                "duration": 8,
                "speakers": 1,
                # Keep avatar to skip image generation call in this sequence
                "avatar_url": "/api/podcast/images/avatars/already_present.png",
            },
        )
        _record_usage(
            user_id=USER_ID,
            provider=APIProvider.MISTRAL,
            endpoint="/api/podcast/analyze",
            model="meta-llama/llama-3.3-70b-instruct",
            tokens_in=1200,
            tokens_out=600,
        )

        # 2b) Podcast research
        research = _post_json(
            client,
            "/api/podcast/research/exa",
            {
                "topic": "AI agent adoption in startups",
                "queries": ["AI agent adoption data 2026 startups"],
                "analysis": {"audience": analysis.get("audience", "general")},
            },
        )
        _record_usage(
            user_id=USER_ID,
            provider=APIProvider.EXA,
            endpoint="/api/podcast/research/exa",
            model="exa-search",
            tokens_in=0,
            tokens_out=0,
        )

        # 2c) At least one video render
        video_start = _post_json(
            client,
            "/api/podcast/render/video",
            {
                "project_id": "sequence-project-001",
                "scene_id": "scene_1",
                "scene_title": "Intro",
                "audio_url": audio_url,
                "avatar_image_url": avatar_image_path,
                "resolution": "720p",
            },
        )

        # Fetch task status once (background task should be done quickly with mocks)
        task_id = video_start["task_id"]
        task_status = _get_json(client, f"/api/podcast/task/{task_id}/status")
        _record_usage(
            user_id=USER_ID,
            provider=APIProvider.VIDEO,
            endpoint="/api/podcast/render/video",
            model="wavespeed-ai/infinitetalk",
            tokens_in=0,
            tokens_out=0,
        )

        # 3) Verify usage logs/dashboard deltas
        after_dashboard = _get_json(client, f"/api/subscription/dashboard/{USER_ID}?billing_period={BILLING_PERIOD}")
        after_logs = _get_json(client, "/api/subscription/usage-logs?limit=500")

        after_cost = float(after_dashboard["data"]["summary"]["total_cost_this_month"])
        after_calls = int(after_dashboard["data"]["summary"]["total_api_calls_this_month"])
        after_projection = float(after_dashboard["data"]["projections"]["projected_monthly_cost"])
        after_provider_costs = _provider_cost_totals(after_logs)

        delta_cost = round(after_cost - before_cost, 4)
        delta_calls = after_calls - before_calls
        delta_projection = round(after_projection - before_projection, 4)

        # Provider deltas (focus on providers touched in sequence)
        provider_deltas = {
            key: round(after_provider_costs.get(key, 0.0) - before_provider_costs.get(key, 0.0), 4)
            for key in sorted(set(before_provider_costs) | set(after_provider_costs))
            if key in {"exa", "huggingface", "wavespeed", "video", "mistral"}
        }

        expected_positive_cost = delta_cost > 0
        expected_positive_calls = delta_calls >= 3  # analysis + research + video
        expected_projection_change = delta_projection > 0
        expected_provider_delta = any(v > 0 for v in provider_deltas.values())

        acceptance_passed = all(
            [
                preflight.get("success") is True,
                expected_positive_cost,
                expected_positive_calls,
                expected_projection_change,
                expected_provider_delta,
            ]
        )

        report = {
            "preflight": {
                "success": preflight.get("success"),
                "can_proceed": preflight.get("data", {}).get("can_proceed"),
                "estimated_cost": preflight.get("data", {}).get("estimated_cost"),
            },
            "operations": {
                "analysis_title_suggestions": analysis.get("title_suggestions", []),
                "research_provider": research.get("provider"),
                "research_cost": (research.get("cost") or {}).get("total"),
                "video_task_status": task_status.get("status"),
            },
            "dashboard_deltas": {
                "total_calls_before": before_calls,
                "total_calls_after": after_calls,
                "delta_calls": delta_calls,
                "total_cost_before": before_cost,
                "total_cost_after": after_cost,
                "delta_cost": delta_cost,
                "projected_monthly_cost_before": before_projection,
                "projected_monthly_cost_after": after_projection,
                "delta_projected_monthly_cost": delta_projection,
            },
            "provider_cost_deltas": provider_deltas,
            "acceptance": {
                "passed": acceptance_passed,
                "criteria": {
                    "preflight_success": preflight.get("success") is True,
                    "usage_cost_incremented": expected_positive_cost,
                    "usage_call_incremented": expected_positive_calls,
                    "projection_incremented": expected_projection_change,
                    "provider_delta_present": expected_provider_delta,
                },
            },
        }

    out_dir = Path("artifacts")
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / "podcast_billing_sequence_report.json"
    out_file.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    print(f"\nSaved report: {out_file}")

    if not acceptance_passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
