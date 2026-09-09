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
    def _analytics_pair(cls, analytics: Dict[str, Any]):
        """Return (clicks, impressions) supporting top-level or ``metrics.`` nesting."""
        if not analytics:
            return None, None
        metrics = analytics.get("metrics") or {}
        clicks = analytics.get("total_clicks")
        if clicks is None:
            clicks = metrics.get("total_clicks")
        impressions = analytics.get("total_impressions")
        if impressions is None:
            impressions = metrics.get("total_impressions")
        return clicks, impressions

    @classmethod
    def _competitor_entries(cls, onboarding: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Flatten ``competitor_analysis`` (list or ``{competitors: [...]}``) into
        deduplicated {name, domain} entries."""
        comp = onboarding.get("competitor_analysis") or {}
        if isinstance(comp, list):
            primary = comp
        elif isinstance(comp, dict):
            primary = comp.get("competitors") or comp.get("results") or []
        else:
            primary = []
        entries: List[Dict[str, Any]] = []
        seen = set()
        for item in primary:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            domain = item.get("domain") or item.get("url") or item.get("website")
            key = name or domain or str(item)
            if not key or key in seen:
                continue
            seen.add(key)
            entries.append({"name": name, "domain": domain})
        return entries

    @classmethod
    def _competitor_signals(cls, onboarding: Dict[str, Any]) -> Dict[str, str]:
        """One-line deep-analysis signal per competitor (name/domain → summary)."""
        deep = onboarding.get("deep_competitor_analysis") or {}
        if isinstance(deep, list):
            items = deep
        elif isinstance(deep, dict):
            items = deep.get("competitors") or deep.get("results") or []
        else:
            items = []
        signals: Dict[str, str] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            signal = (
                item.get("strategy_summary")
                or item.get("content_strategy")
                or item.get("overview")
                or item.get("market_gaps")
                or item.get("gaps")
            )
            key = item.get("name") or item.get("domain") or item.get("url")
            if signal and key:
                signals[str(key)] = str(signal).strip()
        return signals

    @classmethod
    def _field_lines(cls, mapping: Dict[str, Any], labels: Dict[str, str]) -> List[str]:
        """Render non-empty ``{field: label}`` pairs as readable briefing lines."""
        lines: List[str] = []
        for key, label in labels.items():
            value = mapping.get(key)
            if not value:
                continue
            if isinstance(value, (list, tuple)):
                value = ", ".join(str(v) for v in value)
            lines.append(f"  - {label}: {value}")
        return lines

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

        # Competitor watchlist — the model is scored on referencing the user's
        # ACTUAL stored competitors (grounding gate), so it must see them.
        watchlist = cls._format_competitor_watchlist(onboarding)
        if watchlist:
            sections.append(watchlist)

        # Voice & style — stored brand voice the model should match.
        style_lines: List[str] = []
        writing_style = website.get("writing_style")
        if isinstance(writing_style, dict):
            style_lines.extend(
                cls._field_lines(
                    writing_style,
                    {
                        "tone": "Tone",
                        "voice": "Voice",
                        "complexity": "Complexity",
                        "engagement_level": "Engagement level",
                    },
                )
            )
        elif writing_style:
            style_lines.append(f"  - Tone / voice: {writing_style}")
        content_type = website.get("content_type")
        if isinstance(content_type, dict):
            style_lines.extend(
                cls._field_lines(
                    content_type,
                    {
                        "primary_type": "Preferred primary format",
                        "purpose": "Primary purpose",
                        "secondary_types": "Secondary formats",
                    },
                )
            )
        elif isinstance(content_type, (list, tuple)):
            style_lines.append(
                f"  - Preferred content types: {', '.join(str(v) for v in content_type)}"
            )
        elif content_type:
            style_lines.append(f"  - Preferred content types: {content_type}")
        if style_lines:
            sections.append("Their voice & style:")
            sections.extend(style_lines)

        # Search footprint — Google + Bing (both are stored onboarding signals).
        footprint_lines: List[str] = []
        gsc_clicks, gsc_impressions = cls._analytics_pair(
            onboarding.get("gsc_analytics") or {}
        )
        if gsc_clicks is not None or gsc_impressions is not None:
            footprint_lines.append(
                f"{gsc_clicks} clicks / {gsc_impressions} impressions "
                "(Google Search Console)"
            )
        bing_clicks, bing_impressions = cls._analytics_pair(
            onboarding.get("bing_analytics") or {}
        )
        if bing_clicks is not None or bing_impressions is not None:
            footprint_lines.append(
                f"{bing_clicks} clicks / {bing_impressions} impressions (Bing)"
            )
        if footprint_lines:
            sections.append("Existing organic footprint: " + "; ".join(footprint_lines))

        # Data-quality note — one honesty line so the model can discount its
        # confidence when the stored onboarding data is thin or stale.
        data_quality = onboarding.get("data_quality") or {}
        quality_score = data_quality.get(
            "overall_score", data_quality.get("completeness")
        )
        if quality_score is not None:
            try:
                score = float(quality_score)
            except (TypeError, ValueError):
                score = None
            if score is not None:
                label = "strong" if score >= 0.7 else "moderate" if score >= 0.4 else "limited"
                sections.append(
                    f"Stored onboarding data quality: {label} (score {score:.2f})"
                )

        return "\n".join(sections)

    @classmethod
    def _format_competitor_watchlist(cls, onboarding: Dict[str, Any]) -> str:
        entries = cls._competitor_entries(onboarding)
        if not entries:
            return ""
        signals = cls._competitor_signals(onboarding)
        lines = [
            "Competitor watchlist (reference these BY NAME in competitive positioning):"
        ]
        for entry in entries:
            label = entry["name"] or entry["domain"] or "listed competitor"
            line = f"  - {label}"
            if entry["domain"] and entry["domain"] != label:
                line += f" ({entry['domain']})"
            signal = signals.get(entry["name"] or entry["domain"])
            if signal:
                line += f" — {signal[:160]}"
            lines.append(line)
        return "\n".join(lines)
