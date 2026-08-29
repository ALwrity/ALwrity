"""
"Strategic Content Opportunities" insight generation helpers.

Pure, dependency-light functions used by ``SitemapService`` to power the
single enriched LLM call that produces the Strategic Content Opportunities
section during onboarding Step 2 (Industry Research):

- ``build_onboarding_analysis_prompt``  — grounded prompt (audience/brand/
  competitor digest + keyword clusters + strategic pillars)
- ``onboarding_insights_json_schema``   — JSON schema for structured output
- ``get_onboarding_system_prompt``      — system prompt
- ``parse_onboarding_insights``         — tolerant parser (string/object items,
  unknown keys preserved)
- ``validate_onboarding_insights``      — Pydantic sanity validation

Kept in its own module so ``sitemap_service.py`` stays focused on sitemap
mechanics and the prompt/schema/parsing contract is unit-testable in isolation.
"""

import json
import re
from typing import Any, Dict, List, Optional

from loguru import logger

# Canonical insight sections (original 5 + new grounded ones). The original 5
# remain required for backwards compatibility; the rest are optional additions.
ONBOARDING_INSIGHTS_DEFAULTS: Dict[str, Any] = {
    "competitive_positioning": "Analysis in progress...",
    "content_gaps": [],
    "growth_opportunities": [],
    "industry_benchmarks": [],
    "strategic_recommendations": [],
    "quick_wins": [],
    "keyword_topic_opportunities": [],
    "audience_fit_opportunities": [],
    "channel_playbook": [],
    "pillar_expansion": [],
}


def onboarding_insights_json_schema() -> Dict[str, Any]:
    """JSON schema for the Strategic Content Opportunities structured output."""
    opportunity_item = {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "topic": {"type": "string"},
            "rationale": {"type": "string"},
            "impact": {"type": "string"},
            "effort": {"type": "string"},
            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "action": {"type": "string"},
            "evidence": {"type": "string"},
        },
    }
    channel_item = {
        "type": "object",
        "properties": {
            "channel": {"type": "string"},
            "recommendations": {"type": "array", "items": {"type": "string"}},
        },
    }
    return {
        "type": "object",
        "properties": {
            "competitive_positioning": {"type": "string"},
            "content_gaps": {"type": "array", "items": opportunity_item},
            "growth_opportunities": {"type": "array", "items": opportunity_item},
            "industry_benchmarks": {"type": "array", "items": {"type": "string"}},
            "strategic_recommendations": {"type": "array", "items": opportunity_item},
            "quick_wins": {"type": "array", "items": opportunity_item},
            "keyword_topic_opportunities": {"type": "array", "items": opportunity_item},
            "audience_fit_opportunities": {"type": "array", "items": opportunity_item},
            "channel_playbook": {"type": "array", "items": channel_item},
            "pillar_expansion": {"type": "array", "items": opportunity_item},
        },
        "required": [
            "competitive_positioning",
            "content_gaps",
            "growth_opportunities",
            "industry_benchmarks",
            "strategic_recommendations",
        ],
    }


def build_onboarding_analysis_prompt(
    structure_analysis: Dict[str, Any],
    content_trends: Dict[str, Any],
    publishing_patterns: Dict[str, Any],
    user_url: str,
    competitors: Optional[List[str]] = None,
    industry_context: Optional[str] = None,
    context: Optional[Dict[str, str]] = None,
) -> str:
    """Build the AI prompt for onboarding-specific sitemap analysis.

    ``context`` is the compact Step-1/Step-2 digest produced by
    ``onboarding_context.build_onboarding_opportunity_context``. It grounds the
    generated insights in the real audience/brand/competitor data already
    collected during onboarding so the single LLM call produces higher-value
    output without overstuffing the prompt.
    """
    total_urls = structure_analysis.get("total_urls", 0)
    url_patterns = structure_analysis.get("url_patterns", {})
    avg_depth = structure_analysis.get("average_path_depth", 0)
    publishing_velocity = content_trends.get("publishing_velocity", 0)

    keyword_clusters = structure_analysis.get("keyword_clusters", {})
    if not isinstance(keyword_clusters, dict):
        keyword_clusters = {}
    strategic_pillars = structure_analysis.get("strategic_pillars", [])

    competitor_info = ""
    if competitors:
        competitor_info = f"\nCompetitors to consider: {', '.join(competitors[:10])}"

    industry_info = ""
    if industry_context:
        industry_info = f"\nIndustry Context: {industry_context}"

    context_info = ""
    if context:
        ctx_lines = "\n".join(
            f"{label}: {text}" for label, text in context.items() if text
        )
        if ctx_lines:
            context_info = f"""

GROUND-TRUTH CONTEXT (already collected during onboarding — use it, do not invent):
{ctx_lines}"""

    cluster_lines = ""
    if keyword_clusters:
        cluster_lines = "\nKeyword Clusters (from URL slugs):\n" + "\n".join(
            [f"- {kw}: {cnt} URLs" for kw, cnt in list(keyword_clusters.items())[:8]]
        )

    pillar_lines = ""
    if isinstance(strategic_pillars, list) and strategic_pillars:
        pillar_lines = "\nStrategic Pillars Detected:\n" + "\n".join(
            [f"- {p}" for p in strategic_pillars[:5]]
        )

    return f"""
Analyze this website's sitemap for competitive positioning and content strategy insights.

USER WEBSITE: {user_url}
Total URLs: {total_urls}
Average Path Depth: {avg_depth}
Publishing Velocity: {publishing_velocity:.2f} posts/day
{industry_info}{competitor_info}

URL Structure Analysis:
{chr(10).join([f"- {category}: {count} URLs" for category, count in list(url_patterns.items())[:8]])}
{cluster_lines}
{pillar_lines}

Content Publishing Patterns:
- Publishing Rate: {publishing_velocity:.2f} pages per day
- Content Categories: {len(url_patterns)} main categories identified
{context_info}

Provide competitive analysis insights. Ground EVERY item in the GROUND-TRUTH CONTEXT (target audience, brand positioning, competitor focus/threat/tier/frequency, previously learned research findings and content pillars). Do NOT invent competitor specifics that are not provided. If a context section is absent, keep the related insights appropriately general.

1. **COMPETITIVE POSITIONING**: Brief paragraph grounded in the competitor intel above (real focus, tiers, threat levels), not filler.
2. **CONTENT GAPS**: 4-6 gaps tied to the user's audience and competitor focus. Each item: title, rationale (why it matters), priority (high/medium/low), effort, impact, evidence used.
3. **GROWTH OPPORTUNITIES**: 4-6 concrete expansion plays that leverage the user's existing strengths and differentiation opportunities. Standard item fields.
4. **INDUSTRY BENCHMARKS**: 3 grounded comparisons (publishing frequency, content depth, category coverage) using competitor data where available.
5. **STRATEGIC RECOMMENDATIONS**: 4-6 prioritized, actionable steps mapped to the user's preferred content channels in GROUND-TRUTH CONTEXT. Standard item fields with priority + effort + impact.
6. **QUICK WINS**: 3-5 fast, low-effort content actions visible from keyword clusters, URL slugs or site structure — executable within days.
7. **KEYWORD TOPIC OPPORTUNITIES**: 3-5 topic + keyword pairs the site is not yet covering, matched to its existing keyword clusters and competitor focus.
8. **AUDIENCE FIT OPPORTUNITIES**: 3-5 content ideas explicitly matched to the target audience segments/interests in GROUND-TRUTH CONTEXT.
9. **CHANNEL PLAYBOOK**: For each channel listed in the user's preferred content channels, give 2-3 tailored recommendations (item: channel + recommendations array).
10. **PILLAR EXPANSION**: If content pillars are provided in GROUND-TRUTH CONTEXT, suggest 3-5 ways to deepen/expand the major pillars into new content.

Return a SINGLE valid minified JSON object following the provided schema. No markdown, no code fences, no prose outside JSON.
"""


def get_onboarding_system_prompt() -> str:
    """System prompt for the Strategic Content Opportunities generation."""
    return """You are a competitive intelligence and content strategy expert specializing in website structure analysis for content creators and digital marketers.

Your role is to analyze website sitemaps and provide strategic insights that help users understand their competitive position and identify content opportunities.

Key focus areas:
- Competitive positioning analysis
- Content gap identification
- Growth opportunity recommendations
- Industry benchmarking insights
- Audience-matched content recommendations
- Channel-specific content playbooks
- Actionable strategic recommendations

Ground every insight in the provided context. Never fabricate competitor facts that were not given. Practical, data-driven output that helps content creators make informed decisions.

IMPORTANT: Your response MUST be a single valid minified JSON object. No markdown, no code fences, no prose outside JSON."""


def parse_onboarding_insights(ai_response: Any) -> Dict[str, Any]:
    """Parse the AI response for onboarding-specific insights.

    Merges the model output over the canonical schema so that:
    - the original 5 keys always exist (backwards compatibility)
    - new structured sections are preserved (quick_wins, channel_playbook, ...)
    - unknown future keys pass through unchanged instead of being dropped
    """
    try:
        insights = {}

        if isinstance(ai_response, dict):
            insights = ai_response
        elif isinstance(ai_response, str):
            try:
                insights = json.loads(ai_response)
            except json.JSONDecodeError:
                json_match = re.search(r'```json\s*(.*?)\s*```', ai_response, re.DOTALL)
                if json_match:
                    try:
                        insights = json.loads(json_match.group(1))
                    except json.JSONDecodeError:
                        pass

        if not isinstance(insights, dict):
            insights = {}

        validated_insights: Dict[str, Any] = {}
        for key, default in ONBOARDING_INSIGHTS_DEFAULTS.items():
            value = insights.get(key, default)
            if isinstance(default, list):
                if value is None:
                    validated_insights[key] = []
                elif isinstance(value, list):
                    validated_insights[key] = value
                elif isinstance(value, (str, dict)):
                    validated_insights[key] = [value]
                else:
                    validated_insights[key] = []
            else:
                validated_insights[key] = value if isinstance(value, str) else default

        # Pass through any future keys unchanged so schema evolution never
        # silently drops data.
        for key, value in insights.items():
            if key not in validated_insights:
                validated_insights[key] = value

        return validated_insights

    except Exception as e:
        logger.error(f"Error parsing onboarding insights: {e}")
        return dict(ONBOARDING_INSIGHTS_DEFAULTS)


def validate_onboarding_insights(insights: Dict[str, Any]) -> Dict[str, Any]:
    """Validate onboarding insights against a Pydantic model.

    Returns dict with: valid, total_fields, fields_ok, errors
    (field paths only, no raw content).
    """
    field_names = [
        "competitive_positioning", "content_gaps", "growth_opportunities",
        "industry_benchmarks", "strategic_recommendations", "quick_wins",
        "keyword_topic_opportunities", "audience_fit_opportunities",
        "channel_playbook", "pillar_expansion",
    ]
    try:
        from pydantic import BaseModel

        class OnboardingInsights(BaseModel):
            competitive_positioning: str = ""
            content_gaps: list = []
            growth_opportunities: list = []
            industry_benchmarks: list = []
            strategic_recommendations: list = []
            quick_wins: Optional[list] = None
            keyword_topic_opportunities: Optional[list] = None
            audience_fit_opportunities: Optional[list] = None
            channel_playbook: Optional[list] = None
            pillar_expansion: Optional[list] = None

        model = OnboardingInsights(**insights)
        ok = 0
        for field in field_names:
            val = getattr(model, field)
            if isinstance(val, list) and val:
                ok += 1
            elif isinstance(val, str) and val:
                ok += 1
        return {
            "valid": True,
            "total_fields": len(field_names),
            "fields_ok": ok,
            "errors": "",
        }
    except Exception as e:
        error_fields = []
        if hasattr(e, "errors"):
            for err in e.errors():
                loc = ".".join(str(x) for x in err.get("loc", []))
                typ = err.get("type", "unknown")
                error_fields.append(f"{loc}({typ})")
        return {
            "valid": False,
            "total_fields": len(field_names),
            "fields_ok": len(field_names) - len(error_fields),
            "errors": "; ".join(error_fields) if error_fields else str(e)[:200],
        }