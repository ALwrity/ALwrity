"""Onboarding Data Grounding Gate - Validates content is grounded in real onboarding data.

This gate checks that calendar content reflects the user's actual onboarding context:
- Persona (role, goals, pain points)
- Competitor analysis (real competitors, not generic)
- Analytics data (GSC, Bing) for realistic predictions
- Canonical profile (industry, company size)
- Data quality (completeness, freshness)

DB-sourced fields take precedence over AI suggestions.
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class OnboardingDataGroundingGate:
    """Validates that generated content is grounded in real onboarding data."""

    def __init__(self):
        self.name = "onboarding_data_grounding"
        self.description = "Validates content is grounded in real onboarding data (persona, competitors, analytics)"
        self.pass_threshold = 0.7
        self.validation_criteria = [
            "Persona grounding (role, goals, pain points)",
            "Competitor grounding (real competitors referenced)",
            "Analytics consistency (predictions match data)",
            "Data quality (completeness, freshness)",
        ]

    async def validate(self, calendar_data: Dict[str, Any], step_name: str = None) -> Dict[str, Any]:
        """Validate onboarding data grounding for calendar content."""
        try:
            validation_result = {
                "gate_name": self.name,
                "passed": False,
                "score": 0.0,
                "issues": [],
                "recommendations": [],
                "timestamp": datetime.utcnow().isoformat(),
            }

            onboarding_context = calendar_data.get("onboarding_context") or {}
            content_items = self._extract_content_items(calendar_data)

            if not content_items:
                validation_result["issues"].append("No content items to validate grounding")
                validation_result["recommendations"].append("Generate content items before validation")
            else:
                persona_data = onboarding_context.get("persona_data") or {}
                competitor_data = onboarding_context.get("competitor_analysis") or []
                gsc_analytics = onboarding_context.get("gsc_analytics") or {}
                bing_analytics = onboarding_context.get("bing_analytics") or {}
                data_quality = onboarding_context.get("data_quality") or {}
                canonical_profile = onboarding_context.get("canonical_profile") or {}

                persona_score = self._validate_persona_grounding(content_items, persona_data)
                competitor_score = self._validate_competitor_grounding(content_items, competitor_data)
                analytics_score = self._validate_analytics_grounding(content_items, gsc_analytics, bing_analytics)
                canonical_score = self._validate_canonical_grounding(content_items, canonical_profile)
                quality_score = self._validate_data_quality(data_quality)

                scores = [persona_score, competitor_score, analytics_score, canonical_score, quality_score]
                validation_result["component_scores"] = {
                    "persona": persona_score,
                    "competitor": competitor_score,
                    "analytics": analytics_score,
                    "canonical": canonical_score,
                    "data_quality": quality_score,
                }

                overall_score = sum(scores) / len(scores)
                validation_result["score"] = round(overall_score, 2)
                validation_result["passed"] = overall_score >= self.pass_threshold

                if persona_score < 0.5:
                    validation_result["issues"].append("Content not grounded in persona data")
                    validation_result["recommendations"].append("Include persona role, goals, and pain points in content")

                if competitor_score < 0.5 and len(competitor_data) > 0:
                    validation_result["issues"].append("Content does not reference known competitors")
                    validation_result["recommendations"].append("Reference specific competitors from onboarding data")

                if analytics_score < 0.5 and (gsc_analytics or bing_analytics):
                    validation_result["issues"].append("Content predictions inconsistent with analytics data")
                    validation_result["recommendations"].append("Align content predictions with actual GSC/Bing metrics")

                if canonical_score < 0.5 and canonical_profile:
                    validation_result["issues"].append("Content may not reflect user's industry/company profile")
                    validation_result["recommendations"].append("Tailor content to industry and company size")

                if quality_score < 0.5:
                    validation_result["issues"].append("Low onboarding data quality may affect grounding")
                    validation_result["recommendations"].append("Complete more onboarding steps for better grounding")

            if not validation_result["passed"]:
                validation_result["recommendations"].extend([
                    "Review onboarding data completeness",
                    "Ensure content generation uses real persona/competitor data",
                    "Validate predictions align with analytics trends"
                ])

            logger.info(f"Onboarding grounding validation: {'PASSED' if validation_result['passed'] else 'FAILED'} (score: {validation_result['score']:.2f})")
            return validation_result

        except Exception as e:
            logger.error(f"Error in onboarding grounding validation: {e}")
            return {"gate_name": self.name, "passed": False, "score": 0.0, "error": str(e)}

    def _extract_content_items(self, calendar_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract content items from calendar data."""
        items = []
        daily_schedule = calendar_data.get("daily_schedule", {})

        if isinstance(daily_schedule, dict):
            for day_data in daily_schedule.values():
                if isinstance(day_data, dict):
                    day_items = day_data.get("content") or day_data.get("content_items") or []
                    items.extend(day_items if isinstance(day_items, list) else [])
        elif isinstance(daily_schedule, list):
            for day_data in daily_schedule:
                if isinstance(day_data, dict):
                    day_items = day_data.get("content") or day_data.get("content_items") or []
                    items.extend(day_items if isinstance(day_items, list) else [])

        items.extend(calendar_data.get("content_recommendations", []))
        return items

    def _validate_persona_grounding(self, content_items: List[Dict[str, Any]], persona_data: Dict[str, Any]) -> float:
        """Check if content reflects persona data."""
        if not persona_data:
            return 1.0

        core_persona = persona_data.get("core_persona") or persona_data.get("corePersona") or {}
        if not core_persona:
            return 1.0

        if isinstance(core_persona, str):
            return 1.0

        all_content = " ".join(str(item.get("title", "")) + " " + str(item.get("description", "")) for item in content_items).lower()

        role = str(core_persona.get("role", "")).lower()
        goals = core_persona.get("goals", [])
        pain_points = core_persona.get("pain_points", [])

        checks = 0
        total = 0

        if role:
            total += 1
            if role in all_content:
                checks += 1

        if isinstance(goals, list):
            for goal in goals[:3]:
                if str(goal).lower() in all_content:
                    checks += 1
                    break
            total += 1

        if isinstance(pain_points, list):
            for pain in pain_points[:2]:
                if str(pain).lower() in all_content:
                    checks += 1
                    break
            total += 1

        return checks / max(total, 1)

    def _validate_competitor_grounding(self, content_items: List[Dict[str, Any]], competitor_data: Any) -> float:
        """Check if content references real competitors."""
        if not competitor_data:
            return 1.0

        competitors = competitor_data if isinstance(competitor_data, list) else competitor_data.get("competitors", [])
        if not competitors:
            return 1.0

        all_content = " ".join(str(item.get("title", "")) + " " + str(item.get("description", "")) for item in content_items).lower()

        mentioned = 0
        for comp in competitors:
            if isinstance(comp, dict):
                domain = comp.get("domain") or comp.get("website", "")
                name = comp.get("name", "")

                if domain:
                    domain_clean = domain.lower().replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]
                    if domain_clean in all_content:
                        mentioned += 1

                if name and name.lower() in all_content:
                    mentioned += 1

        return min(mentioned / max(len(competitors), 1), 1.0)

    def _validate_analytics_grounding(
        self,
        content_items: List[Dict[str, Any]],
        gsc_analytics: Dict[str, Any],
        bing_analytics: Dict[str, Any],
    ) -> float:
        """Check if content predictions are consistent with analytics."""
        if not gsc_analytics and not bing_analytics:
            return 1.0

        all_content = " ".join(str(item.get("title", "")) + " " + str(item.get("description", "")) for item in content_items).lower()

        total_clicks = (gsc_analytics.get("total_clicks", 0) or 0) + (bing_analytics.get("total_clicks", 0) or 0)

        if total_clicks == 0:
            return 1.0

        predictions_keywords = ["increase", "grow", "boost", "improve", "traffic", "visitors", "clicks", "views"]
        has_prediction = any(kw in all_content for kw in predictions_keywords)

        if has_prediction and total_clicks < 100:
            return 0.7

        return 1.0

    def _validate_canonical_grounding(self, content_items: List[Dict[str, Any]], canonical_profile: Dict[str, Any]) -> float:
        """Check if content reflects user's canonical profile."""
        if not canonical_profile:
            return 1.0

        all_content = " ".join(str(item.get("title", "")) + " " + str(item.get("description", "")) for item in content_items).lower()

        industry = str(canonical_profile.get("industry", "")).lower()
        company_size = str(canonical_profile.get("company_size", "")).lower()

        checks = 0
        total = 0

        if industry:
            total += 1
            if industry in all_content:
                checks += 1

        if company_size:
            total += 1
            size_keywords = {
                "startup": ["startup", "early-stage", "seed"],
                "small": ["small business", "smb", "niche"],
                "mid-market": ["mid-market", "scaling", "growth-stage"],
                "enterprise": ["enterprise", "large organization", "corporate"],
            }
            keywords = size_keywords.get(company_size, [company_size])
            if any(kw in all_content for kw in keywords):
                checks += 1

        return checks / max(total, 1)

    def _validate_data_quality(self, data_quality: Dict[str, Any]) -> float:
        """Check data quality metrics."""
        if not data_quality:
            return 0.5

        completeness = data_quality.get("completeness", data_quality.get("completeness_score", 0))
        freshness = data_quality.get("freshness", data_quality.get("freshness_score", 0))

        if completeness is None:
            completeness = 0.5
        if freshness is None:
            freshness = 0.5

        return (completeness + freshness) / 2

    def __str__(self) -> str:
        return f"OnboardingDataGroundingGate(threshold={self.pass_threshold})"
