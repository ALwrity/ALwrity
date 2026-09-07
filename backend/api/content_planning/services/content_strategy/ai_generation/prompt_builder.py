"""
Prompt Context Builder for AI Strategy Generation.

Centralises the rendering of the user's 30 strategy-builder fields (``form_data``)
plus key onboarding signals into a clean, natural-language "User & Business
Intelligence" briefing. Each AI component generator injects this briefing into
its LLM prompt so the model personalises against what the user actually typed,
instead of being fed an opaque ``json.dumps(context)`` blob.

Keeping this in one module (rather than six inline raw-JSON dumps) means the
personalisation signal is consistent across every generated component and the
producer cannot drift from the consumer.
"""

import json
from typing import Any, Dict, List

# Human-readable labels for the strategy-builder's 30 user-provided fields,
# grouped by the five canonical categories.
FORM_CATEGORY_LABELS = {
    "business_context": "Business Context",
    "audience_intelligence": "Audience Intelligence",
    "competitive_intelligence": "Competitive Intelligence",
    "content_strategy": "Content Strategy",
    "performance_analytics": "Performance & Analytics",
}

# Map the canonical strategy-builder field ids back to their category so the
# briefing groups them under the five canonical section headings. Mirrors the
# frontend STRATEGIC_INPUT_FIELDS categories.
FIELD_CATEGORY_INDEX = {
    "business_context": {
        "business_objectives", "target_metrics", "content_budget", "team_size",
        "implementation_timeline", "market_share", "competitive_position",
        "performance_metrics",
    },
    "audience_intelligence": {
        "content_preferences", "consumption_patterns", "audience_pain_points",
        "buying_journey", "seasonal_trends", "engagement_metrics",
    },
    "competitive_intelligence": {
        "top_competitors", "competitor_content_strategies", "market_gaps",
        "industry_trends", "emerging_trends",
    },
    "content_strategy": {
        "preferred_formats", "content_mix", "content_frequency",
        "optimal_timing", "quality_metrics", "editorial_guidelines",
        "brand_voice",
    },
    "performance_analytics": {
        "traffic_sources", "conversion_rates", "content_roi_targets",
        "ab_testing_capabilities",
    },
}

FORM_FIELD_LABELS = {
    "business_objectives": "Business Objectives",
    "target_metrics": "Target KPIs / Success Metrics",
    "content_budget": "Content Budget",
    "team_size": "Content Team Size",
    "implementation_timeline": "Implementation Timeline",
    "market_share": "Market Share",
    "competitive_position": "Competitive Position",
    "performance_metrics": "Current Performance Metrics",
    "content_preferences": "Audience Content Preferences",
    "consumption_patterns": "Audience Consumption Patterns",
    "audience_pain_points": "Audience Pain Points",
    "buying_journey": "Buying Journey",
    "seasonal_trends": "Seasonal Trends",
    "engagement_metrics": "Current Engagement Metrics",
    "top_competitors": "Top Competitors",
    "competitor_content_strategies": "Competitor Content Strategies",
    "market_gaps": "Market Gaps",
    "industry_trends": "Industry Trends",
    "emerging_trends": "Emerging Trends",
    "preferred_formats": "Preferred Content Formats",
    "content_mix": "Content Mix",
    "content_frequency": "Content Publishing Frequency",
    "optimal_timing": "Optimal Publishing Timing",
    "quality_metrics": "Content Quality Metrics",
    "editorial_guidelines": "Editorial Guidelines",
    "brand_voice": "Brand Voice / Tone",
    "traffic_sources": "Primary Traffic Sources",
    "conversion_rates": "Conversion Rates",
    "content_roi_targets": "Content ROI Targets",
    "ab_testing_capabilities": "A/B Testing Capability",
}

# Legacy/generic form keys seen from older clients that don't map 1:1 to the
# 30 canonical fields; rendered as-is with a readable label.
GENERIC_FORM_LABELS = {
    "name": "Strategy / Business Name",
    "industry": "Industry",
    "target_audience": "Target Audience",
    "content_pillars": "Content Pillars",
    "website_url": "Website URL",
}


class UserIntelligenceFormatter:
    """Renders user context + form_data into the briefing for LLM prompts."""

    @staticmethod
    def _format_value(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return str(value)

    @classmethod
    def _add_non_empty(cls, target: List[tuple], label: str, text: str) -> None:
        if text:
            target.append((label, text))

    @classmethod
    def format_form_data(cls, form_data: Dict[str, Any]) -> str:
        """Render the user's 30 strategy-builder fields as a briefing."""
        if not form_data:
            return ""

        grouped: Dict[str, List[tuple]] = {
            cat: [] for cat in FORM_CATEGORY_LABELS
        }
        misc: List[tuple] = []

        for key, value in form_data.items():
            text = cls._format_value(value)
            if not text:
                continue
            label = FORM_FIELD_LABELS.get(key) or GENERIC_FORM_LABELS.get(key)
            if label is None:
                label = key.replace("_", " ").title()
                cls._add_non_empty(misc, label, text)
                continue
            placed = False
            for cat, field_ids in FIELD_CATEGORY_INDEX.items():
                if key in field_ids:
                    cls._add_non_empty(grouped[cat], label, text)
                    placed = True
                    break
            if not placed:
                cls._add_non_empty(misc, label, text)

        lines: List[str] = []
        for cat, items in grouped.items():
            if not items:
                continue
            lines.append(f"  {FORM_CATEGORY_LABELS[cat]}:")
            for label, text in items:
                lines.append(f"    - {label}: {text}")

        if misc:
            lines.append("  Additional Details:")
            for label, text in misc:
                lines.append(f"    - {label}: {text}")

        return "\n".join(lines)

    @classmethod
    def build_briefing(cls, context: Dict[str, Any]) -> str:
        """Build the full USER & BUSINESS INTELLIGENCE briefing section."""
        form_data = context.get("form_data") or {}
        onboarding = context.get("onboarding_data") or {}

        sections: List[str] = []
        sections.append("Who this plan is for (what the user explicitly told us):")
        form_block = cls.format_form_data(form_data)
        sections.append(
            form_block
            if form_block
            else "  (No explicit user-provided strategy fields were supplied.)"
        )

        persona = (onboarding.get("persona_data") or {}).get("core_persona") or {}
        if persona:
            role = persona.get("role") or "a customer"
            goals = persona.get("goals") or []
            pains = persona.get("pain_points") or []
            sections.append("Their persona & job-to-be-done:")
            sections.append(f"  Role: {role}")
            if goals:
                sections.append(f"  Primary goals: {', '.join(str(g) for g in goals)}")
            if pains:
                sections.append(
                    f"  Pain points: {', '.join(str(p) for p in pains)}"
                )

        website = onboarding.get("website_analysis") or {}
        site_url = website.get("website_url")
        if site_url:
            sections.append(f"Website: {site_url}")

        analytics = {
            "clicks": (onboarding.get("gsc_analytics") or {}).get("total_clicks"),
            "impressions": (onboarding.get("gsc_analytics") or {}).get(
                "total_impressions"
            ),
        }
        if analytics.get("clicks") is not None or analytics.get("impressions") is not None:
            sections.append(
                "Existing organic footprint: "
                + f"{analytics['clicks']} clicks / {analytics['impressions']} "
                + "impressions (Google Search Console)"
            )

        return "\n".join(sections)
