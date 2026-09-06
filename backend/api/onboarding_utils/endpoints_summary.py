from typing import Any, Dict
from datetime import datetime
import json
from loguru import logger
from fastapi import HTTPException, Depends
from sqlalchemy import select, desc

from middleware.auth_middleware import get_current_user
from services.database.sessions import get_session_for_user
from models.onboarding import (
    OnboardingSession,
    WebsiteAnalysis,
    ResearchPreferences,
    PersonaData,
    CompetitorAnalysis,
)


async def get_onboarding_summary(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Aggregated onboarding data for strategy prefill initialization.

    Returns persona, brand analysis (website), SEO audit, competitor
    analysis, and quick input defaults — exactly the shape the frontend
    prefill utility (strategyPrefill) expects.
    """
    user_id = str(current_user.get("clerk_user_id") or current_user.get("id"))
    session = get_session_for_user(user_id)
    if not session:
        return {"persona": {}, "website_analysis": {}, "seo_audit": {}, "competitor_analysis": {}}

    try:
        # Onboarding session (source of truth for completion + quick inputs)
        onboarding = session.execute(
            select(OnboardingSession)
            .where(OnboardingSession.user_id == user_id)
            .order_by(desc(OnboardingSession.updated_at))
            .limit(1)
        ).scalar_one_or_none()

        persona = {}
        website = {}
        seo = {}

        # --- JSON blobs: parse defensively (columns may hold str or dict) ---
        def _as_dict(value: Any) -> Dict[str, Any]:
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except Exception:
                    return {}
            return value if isinstance(value, dict) else {}

        if onboarding:
            persona_row = session.execute(
                select(PersonaData)
                .where(PersonaData.session_id == onboarding.id)
                .order_by(desc(PersonaData.updated_at))
                .limit(1)
            ).scalar_one_or_none()

            website_row = session.execute(
                select(WebsiteAnalysis)
                .where(WebsiteAnalysis.session_id == onboarding.id)
                .order_by(desc(WebsiteAnalysis.updated_at))
                .limit(1)
            ).scalar_one_or_none()

            core_persona = _as_dict(persona_row.core_persona) if persona_row else {}
            research_persona = _as_dict(persona_row.research_persona) if persona_row else {}
            brand = _as_dict(website_row.brand_analysis) if website_row else {}
            site_writing_style = _as_dict(website_row.writing_style) if website_row else {}
            site_audience = _as_dict(website_row.target_audience) if website_row else {}
            site_content_type = _as_dict(website_row.content_type) if website_row else {}

            # --- Persona (PersonaData real columns: core_persona, research_persona, ...) ---
            # research_persona.default_target_audience is a clean string; fall back to
            # the website-crawl demographics joined into one line.
            demographics = site_audience.get("demographics")
            persona = {
                "target_audience": (
                    research_persona.get("default_target_audience")
                    or (", ".join(demographics) if isinstance(demographics, list) and demographics else None)
                ),
                "writing_style": site_writing_style.get("voice") or site_writing_style.get("tone"),
                "industry": site_audience.get("industry_focus") or research_persona.get("default_industry"),
            }

            # --- Website / brand analysis ---
            # brand_analysis JSON has no business_type/industry keys — derive from
            # brand_positioning / content_type / audience industry_focus. There is
            # no performance-metrics column on WebsiteAnalysis, and the prefill
            # mapping does not consume it — report zeros.
            website = {
                "brand_analysis": {
                    "business_type": brand.get("brand_positioning") or site_content_type.get("primary_type"),
                    "industry": site_audience.get("industry_focus") or research_persona.get("default_industry"),
                    "company_stage": brand.get("company_stage"),
                },
                "performance_metrics": {
                    "monthly_visitors": 0,
                    "conversion_rate": 0,
                },
            }

            # --- SEO / keywords ---
            # The session payload has no seo_audit block; the research persona's
            # suggested_keywords are the best keyword source for content pillars.
            keywords = research_persona.get("suggested_keywords") or []
            seo = {
                "keywords": [str(k) for k in keywords[:8]] if isinstance(keywords, list) else [],
                "traffic_potential": 0,
                "competition_level": "medium",
            }

        # Competitor analysis (names + highlights). The model stores a single
        # analysis_data JSON blob — there are no strengths/weaknesses columns,
        # so derive them defensively from highlights/summary.
        competitors = []
        if onboarding:
            competitor_rows = session.execute(
                select(CompetitorAnalysis)
                .where(CompetitorAnalysis.session_id == onboarding.id)
                .order_by(desc(CompetitorAnalysis.analysis_date))
                .limit(3)
            ).scalars().all()
            for row in competitor_rows:
                analysis = _as_dict(row.analysis_data)
                highlights = analysis.get("highlights")
                competitors.append({
                    "name": row.competitor_domain or row.competitor_url,
                    "strengths": [str(h) for h in highlights][:5] if isinstance(highlights, list) else [],
                    "weaknesses": [],
                })

        return {
            "persona": persona,
            "website_analysis": website,
            "seo_audit": seo,
            "competitor_analysis": {"competitors": competitors},
        }
    finally:
        session.close()
