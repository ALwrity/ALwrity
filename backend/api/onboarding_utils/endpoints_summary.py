from typing import Dict, Any
from datetime import datetime
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
        if onboarding:
            persona_row = session.execute(
                select(PersonaData)
                .where(PersonaData.session_id == onboarding.id)
                .order_by(desc(PersonaData.updated_at))
                .limit(1)
            ).scalar_one_or_none()
            if persona_row:
                persona = {
                    "target_audience": (persona_row.core_persona or persona_row.corePersona or persona_row.target_audience or persona_row.targetAudience),
                    "writing_style": persona_row.writing_style,
                    "industry": persona_row.industry,
                    "business_size": persona_row.business_size,
                    "goals": persona_row.goals,
                }

        # Website analysis (brand analysis for business type / industry)
        website = {}
        if onboarding:
            website_row = session.execute(
                select(WebsiteAnalysis)
                .where(WebsiteAnalysis.session_id == onboarding.id)
                .order_by(desc(WebsiteAnalysis.updated_at))
                .limit(1)
            ).scalar_one_or_none()
            if website_row:
                brand = website_row.brand_analysis or {}
                if isinstance(brand, str):
                    try:
                        import json
                        brand = json.loads(brand)
                    except Exception:
                        brand = {}
                perf = website_row.performance_metrics_data  # legacy column name
                if isinstance(perf, str):
                    try:
                        import json
                        perf = json.loads(perf)
                    except Exception:
                        perf = {}
                else:
                    perf = perf or {}
                website = {
                    "brand_analysis": {
                        "business_type": brand.get("business_type") or brand.get("type") or brand.get("industry"),
                        "industry": brand.get("industry") or website_row.content_type,
                        "company_stage": brand.get("company_stage"),
                    },
                    "performance_metrics": {
                        "monthly_visitors": perf.get("monthly_visitors") or perf.get("traffic") or 0,
                        "conversion_rate": perf.get("conversion_rate") or perf.get("conversion") or 0,
                    },
                }

        # SEO audit (keywords, competition level, traffic potential)
        seo = {}
        if onboarding:
            # The SEO audit is part of the onboarding session payload or the website analysis
            # Try the session payload first, then fall back to the website analysis data
            payload = onboarding.payload or {}
            seo_audit = payload.get("seo_audit") or payload.get("seoAudit")
            if isinstance(seo_audit, dict):
                seo = {
                    "keywords": seo_audit.get("keywords") or seo_audit.get("target_keywords") or [],
                    "traffic_potential": seo_audit.get("traffic_potential") or seo_audit.get("potential_traffic") or 0,
                    "competition_level": seo_audit.get("competition_level") or seo_audit.get("competition") or "medium",
                }
            else:
                # Fallback to performance metrics as a rough proxy for traffic potential
                perf_data = payload.get("website_analysis") or {}
                seo = {
                    "keywords": perf_data.get("keywords") or [],
                    "traffic_potential": 0,
                    "competition_level": "medium",
                }

        # Competitor analysis (names + strengths/weaknesses)
        competitors = []
        if onboarding:
            competitor_rows = session.execute(
                select(CompetitorAnalysis)
                .where(CompetitorAnalysis.session_id == onboarding.id)
                .order_by(desc(CompetitorAnalysis.analysis_date))
                .limit(3)
            ).scalars().all()
            competitors = [
                {"name": row.competitor_domain or row.competitor_url, "strengths": row.strengths or [], "weaknesses": row.weaknesses or []}
                for row in competitor_rows
            ]

        return {
            "persona": persona,
            "website_analysis": website,
            "seo_audit": seo,
            "competitor_analysis": {"competitors": competitors},
        }
    finally:
        session.close()
