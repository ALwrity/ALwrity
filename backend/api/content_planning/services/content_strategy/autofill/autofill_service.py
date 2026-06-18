"""
Unified AutoFill Service
Consolidated autofill for enhanced content strategies.
Merges database-mapped fields with AI-generated fields in a single flow.

Replaces: autofill_service.py, unified_autofill_service.py, ai_refresh.py
"""

from typing import Any, Dict
from sqlalchemy.orm import Session
from loguru import logger
import asyncio
from datetime import datetime

from ..onboarding.data_integration import OnboardingDataIntegrationService
from .normalizers.website_normalizer import normalize_website_analysis
from .normalizers.research_normalizer import normalize_research_preferences
from .normalizers.api_keys_normalizer import normalize_api_keys
from .normalizers.persona_normalizer import normalize_persona_data
from .normalizers.competitor_normalizer import normalize_competitor_analysis
from .normalizers.analytics_normalizer import normalize_gsc_analytics, normalize_bing_analytics, normalize_analytics_combined
from .transformer import transform_to_fields
from .quality import calculate_quality_scores_from_raw, calculate_confidence_from_raw, calculate_data_freshness
from .transparency import build_data_sources_map, build_input_data_points
from .schema import validate_output
from .ai_structured_autofill import AIStructuredAutofillService, CORE_FIELDS


ALL_FIELDS = set(CORE_FIELDS)


class AutoFillService:
    """Unified autofill: DB sources + AI generation in a single flow."""

    def __init__(self, db: Session):
        self.db = db
        self.integration = OnboardingDataIntegrationService()
        self.ai_service = AIStructuredAutofillService()

    async def generate(self, user_id: str) -> Dict[str, Any]:
        started = datetime.utcnow()

        raw = await self.integration.process_onboarding_data(user_id, self.db)

        db_task = asyncio.create_task(self._normalize_db_sources(raw))
        ai_task = asyncio.create_task(self._generate_ai_fields(user_id, raw))

        db_result = await db_task
        ai_result = await ai_task

        merged = self._merge_fields(db_result, ai_result)
        payload = self._assemble_payload(db_result, merged, raw, started)

        validate_output(payload)
        return payload

    async def regenerate_ai_fields(self, user_id: str) -> Dict[str, Any]:
        """Re-run AI generation, preserving DB-grounded onboarding fields."""
        return await self.generate(user_id)

    async def _normalize_db_sources(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        website_raw = raw.get("website_analysis", {})
        research_raw = raw.get("research_preferences", {})
        api_raw = raw.get("api_keys_data", {})
        session_raw = raw.get("onboarding_session", {})
        persona_raw = raw.get("persona_data", {}) or {}
        competitor_raw = raw.get("competitor_analysis", [])
        gsc_raw = raw.get("gsc_analytics", {})
        bing_raw = raw.get("bing_analytics", {})

        (website, research, api_keys, persona, competitor, gsc, bing) = await asyncio.gather(
            normalize_website_analysis(website_raw),
            normalize_research_preferences(research_raw, website_fallback=website_raw),
            normalize_api_keys(api_raw),
            normalize_persona_data(persona_raw),
            normalize_competitor_analysis(competitor_raw),
            normalize_gsc_analytics(gsc_raw) if gsc_raw else _empty(),
            normalize_bing_analytics(bing_raw) if bing_raw else _empty(),
        )

        analytics = await normalize_analytics_combined(gsc, bing) if (gsc or bing) else {}

        quality_scores = calculate_quality_scores_from_raw(website, research, api_keys)
        confidence_levels = calculate_confidence_from_raw(website, research, api_keys)
        data_freshness = calculate_data_freshness(session_raw)

        fields = transform_to_fields(
            website=website, research=research, api_keys=api_keys,
            session=session_raw, persona=persona, competitor=competitor, analytics=analytics,
        )
        sources = build_data_sources_map(website, research, api_keys, persona, competitor, analytics)
        input_data_points = build_input_data_points(
            website_raw=website_raw, research_raw=research_raw, api_raw=api_raw,
            persona_raw=persona_raw, competitor_raw=competitor_raw,
            gsc_raw=gsc_raw, bing_raw=bing_raw,
        )

        return {
            "fields": fields, "sources": sources, "input_data_points": input_data_points,
            "quality_scores": quality_scores, "confidence_levels": confidence_levels,
            "data_freshness": data_freshness,
        }

    async def _generate_ai_fields(self, user_id: str, raw: Dict[str, Any]) -> Dict[str, Any] | None:
        try:
            ai_context = {
                "website_analysis": raw.get("website_analysis", {}),
                "research_preferences": raw.get("research_preferences", {}),
                "api_keys_data": raw.get("api_keys_data", {}),
                "onboarding_session": raw.get("onboarding_session", {}),
            }
            result = await self.ai_service.generate_autofill_fields(user_id, ai_context)
            if result.get("meta", {}).get("ai_used"):
                return result
            logger.warning("AI generation returned ai_used=False")
            return None
        except Exception as exc:
            logger.error(f"AI generation failed: {exc}")
            return None

    def _merge_fields(self, db_result: Dict[str, Any], ai_result: Dict[str, Any] | None) -> Dict[str, Any]:
        db_fields = db_result.get("fields", {})
        ai_fields = (ai_result or {}).get("fields", {})

        merged_fields = {}

        for key in ALL_FIELDS:
            db_val = db_fields.get(key)
            ai_val = ai_fields.get(key)
            if db_val and db_val.get("value") is not None:
                merged_fields[key] = db_val
            elif ai_val and ai_val.get("value") is not None:
                merged_fields[key] = ai_val

        db_sourced = sum(1 for v in merged_fields.values() if v.get("source", "") != "ai_generated")
        ai_sourced = sum(1 for v in merged_fields.values() if v.get("source", "") == "ai_generated")

        return {"fields": merged_fields, "db_field_count": db_sourced, "ai_field_count": ai_sourced, "ai_used": ai_result is not None}

    def _assemble_payload(self, db_result: Dict[str, Any], merged: Dict[str, Any], raw: Dict[str, Any], started: datetime) -> Dict[str, Any]:
        total_ms = int((datetime.utcnow() - started).total_seconds() * 1000)

        return {
            "fields": merged["fields"],
            "sources": db_result.get("sources", {}),
            "quality_scores": db_result.get("quality_scores", {}),
            "confidence_levels": db_result.get("confidence_levels", {}),
            "data_freshness": db_result.get("data_freshness", {}),
            "input_data_points": db_result.get("input_data_points", {}),
            "meta": {
                "ai_used": merged["ai_used"],
                "data_source": "unified",
                "processing_time_ms": total_ms,
                "db_field_count": merged["db_field_count"],
                "ai_field_count": merged["ai_field_count"],
                "total_fields": len(merged["fields"]),
            },
        }


async def _empty() -> Dict[str, Any]:
    return {}
