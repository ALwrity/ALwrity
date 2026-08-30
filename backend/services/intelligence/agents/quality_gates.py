"""Deterministic quality gates for content-bearing agent actions.

Quality gates validate that AI-generated content is grounded in real onboarding
data (persona, competitors, analytics, etc.) and meets quality thresholds.
DB-sourced fields always take precedence over AI-generated suggestions.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


_CONTENT_KEYS = ("content", "draft", "text", "copy", "body", "caption")
_UNSAFE_TERMS = {
    "hate",
    "kill",
    "murder",
    "attack",
    "scam",
    "fraud",
    "steal",
    "explicit",
}
_FORBIDDEN_TONE_MARKERS = {
    "sarcastic": {"sarcasm", "obviously", "yeah right"},
    "condescending": {"idiot", "stupid", "you should know"},
    "hype": {"guaranteed", "get rich quick", "overnight success"},
}
_STATISTIC_RE = re.compile(
    r"\b\d+(?:\.\d+)?%(?!\w)|\b\d+(?:\.\d+)?x\b",
    re.IGNORECASE,
)
_TOKEN_RE = re.compile(r"[a-z0-9]{3,}", re.IGNORECASE)


def _as_words(value: Any) -> List[str]:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if isinstance(value, (list, tuple, set)):
        return [str(part).strip() for part in value if str(part).strip()]
    return []


def extract_content(parameters: Optional[Dict[str, Any]]) -> str:
    """Extract content only from known fields; arbitrary metadata is ignored."""
    if not isinstance(parameters, dict):
        return ""
    for key in _CONTENT_KEYS:
        value = parameters.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def validate_content_quality(
    text: str,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate content against deterministic brand and safety rules.

    The validator intentionally does not infer tone from vague prose. It only
    blocks exact configured words and known high-confidence unsafe markers;
    uncertain claims are returned as warnings for human review.
    """
    content = str(text or "").strip()
    if not content:
        return {
            "is_compliant": True,
            "violations": [],
            "warnings": [],
            "corrections": [],
            "score": 1.0,
            "checked": False,
        }

    lowered = content.casefold()
    violations: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []
    corrections: List[str] = []
    rules = context or {}

    avoid_words = _as_words(rules.get("avoid_words"))
    for word in avoid_words:
        if re.search(rf"(?<!\w){re.escape(word.casefold())}(?!\w)", lowered):
            violations.append({"type": "avoid_word", "value": word})
            corrections.append(f"Remove or replace the avoid-word '{word}'.")

    unsafe_found = [
        term
        for term in sorted(_UNSAFE_TERMS)
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", lowered)
    ]
    for term in unsafe_found:
        violations.append({"type": "unsafe_term", "value": term})
        corrections.append(f"Remove unsafe language containing '{term}'.")

    for tone in _as_words(rules.get("forbidden_tones")):
        markers = _FORBIDDEN_TONE_MARKERS.get(tone.casefold(), set())
        for marker in sorted(markers):
            if marker in lowered:
                violations.append({"type": "forbidden_tone", "value": tone})
                corrections.append(f"Rewrite the copy without the forbidden '{tone}' tone.")
                break

    if _STATISTIC_RE.search(content) and not rules.get("evidence"):
        warnings.append({
            "type": "unsupported_statistic",
            "message": "Verify percentage or multiplier claims before publishing.",
        })

    violation_count = len(violations)
    return {
        "is_compliant": violation_count == 0,
        "violations": violations,
        "warnings": warnings,
        "corrections": list(dict.fromkeys(corrections)),
        "score": max(0.0, 1.0 - min(1.0, violation_count * 0.2)),
        "checked": True,
    }


def _meaningful_tokens(value: Any) -> set[str]:
    return {token.casefold() for token in _TOKEN_RE.findall(str(value or ""))}


def validate_pre_publish_quality(
    parameters: Optional[Dict[str, Any]],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run the complete deterministic gate required before publishing.

    Originality and cannibalization are supplied by their existing analysis
    services. Publishing is blocked when those checks were not run, rather
    than treating missing analysis as a pass.
    """
    params = parameters if isinstance(parameters, dict) else {}
    onboarding_context = params.get("onboarding_context") if isinstance(params.get("onboarding_context"), dict) else {}
    rules = {**onboarding_context, **(context or {}), **params}
    content = extract_content(params)
    base = validate_content_quality(content, rules)
    violations = list(base.get("violations", []))
    warnings = list(base.get("warnings", []))
    corrections = list(base.get("corrections", []))

    audience = str(rules.get("target_audience") or "").strip()
    content_tokens = _meaningful_tokens(content)
    audience_tokens = _meaningful_tokens(audience)
    audience_overlap = len(content_tokens & audience_tokens) / len(audience_tokens) if audience_tokens else None
    if audience and audience_overlap == 0:
        warnings.append({
            "type": "audience_alignment",
            "message": "Content has no obvious overlap with the configured target audience; review before publishing.",
        })

    brand_voice = str(rules.get("brand_voice") or "").strip()
    brand_voice_tokens = _meaningful_tokens(brand_voice)
    voice_overlap = len(content_tokens & brand_voice_tokens) / len(brand_voice_tokens) if brand_voice_tokens else None
    brand_voice_check = {
        "status": "checked" if brand_voice else "unavailable",
        "overlap": round(voice_overlap, 4) if voice_overlap is not None else None,
    }

    if _STATISTIC_RE.search(content) and not rules.get("evidence"):
        violations.append({
            "type": "unsupported_statistic",
            "value": "content contains percentage or multiplier claims without evidence",
        })
        corrections.append("Attach evidence or remove unsupported percentage/multiplier claims.")

    originality = rules.get("originality_score")
    if originality is None:
        violations.append({"type": "originality_check_required", "value": "missing"})
        corrections.append("Run the originality check before publishing.")
    else:
        try:
            if float(originality) < 0.75:
                violations.append({"type": "originality", "value": float(originality)})
                corrections.append("Revise the content to reduce overlap with existing or competitor content.")
        except (TypeError, ValueError):
            violations.append({"type": "originality_check_invalid", "value": str(originality)})

    cannibalization = rules.get("cannibalization_warning")
    if cannibalization is None:
        violations.append({"type": "cannibalization_check_required", "value": "missing"})
        corrections.append("Run the cannibalization check before publishing.")
    elif bool(cannibalization):
        violations.append({"type": "cannibalization", "value": True})
        corrections.append("Choose a distinct angle or consolidate overlapping content.")

    violations = list(dict.fromkeys(tuple(sorted(item.items())) for item in violations))
    normalized_violations = [dict(item) for item in violations]
    return {
        "allowed": not normalized_violations,
        "is_compliant": not normalized_violations,
        "violations": normalized_violations,
        "warnings": warnings,
        "corrections": list(dict.fromkeys(corrections)),
        "brand_voice": brand_voice_check,
        "audience_alignment": {
            "status": "checked" if audience else "unavailable",
            "overlap": round(audience_overlap, 4) if audience_overlap is not None else None,
        },
        "originality_score": originality,
        "cannibalization_warning": cannibalization,
        "checked": bool(content),
    }


def validate_action_content(
    parameters: Optional[Dict[str, Any]],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate an action's known content payload, if it has one."""
    return validate_content_quality(extract_content(parameters), context)


def validate_persona_grounding(
    content: str,
    persona_data: Optional[Dict[str, Any]] = None,
    db_sourced_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate content is grounded in the user's persona.

    Checks that content reflects the persona's role, goals, pain points,
    and expertise level. DB-sourced persona data takes precedence.

    Args:
        content: The content to validate
        persona_data: Raw persona data from onboarding (persona_data, core_persona)
        db_sourced_fields: Fields marked as DB-sourced (outrank AI suggestions)

    Returns:
        Validation result with grounding score and alignment details
    """
    content_lower = content.casefold() if content else ""
    violations = []
    warnings = []
    checks = []

    if not persona_data:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No persona data available for grounding check"],
            "checks": [],
        }

    core_persona = persona_data.get("core_persona") or persona_data.get("corePersona") or {}

    if not core_persona:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No core persona defined"],
            "checks": [],
        }

    if isinstance(core_persona, str):
        checks.append({"type": "persona_name", "present": bool(core_persona), "value": core_persona})
        return {"passed": True, "score": 1.0, "status": "checked", "violations": [], "warnings": [], "checks": checks}

    persona_role = str(core_persona.get("role", "")).casefold()
    persona_goals = _as_words(core_persona.get("goals"))
    persona_pain_points = _as_words(core_persona.get("pain_points"))
    persona_industry = str(core_persona.get("industry", "")).casefold()

    checks.append({"type": "role", "present": bool(persona_role), "value": core_persona.get("role")})

    if persona_role and persona_role not in content_lower and len(content_lower) > 50:
        if db_sourced_fields and db_sourced_fields.get("role"):
            warnings.append({"type": "role_mismatch", "message": f"Content may not reflect role: {core_persona.get('role')}"})
        else:
            warnings.append({"type": "role_not_reflected", "message": f"Consider reflecting target role: {core_persona.get('role')}"})

    goals_matched = 0
    for goal in persona_goals[:5]:
        if goal.casefold() in content_lower:
            goals_matched += 1

    if persona_goals:
        goal_match_ratio = goals_matched / len(persona_goals)
        checks.append({"type": "goals_alignment", "matched": goals_matched, "total": len(persona_goals), "ratio": round(goal_match_ratio, 2)})

        if goal_match_ratio < 0.2 and len(content_lower) > 100:
            warnings.append({"type": "goals_not_addressed", "message": "Content may not address persona's stated goals"})

    pain_points_matched = 0
    for pain in persona_pain_points[:5]:
        if pain.casefold() in content_lower:
            pain_points_matched += 1

    if persona_pain_points:
        pain_match_ratio = pain_points_matched / len(persona_pain_points)
        checks.append({"type": "pain_points_alignment", "matched": pain_points_matched, "total": len(persona_pain_points), "ratio": round(pain_match_ratio, 2)})

    score = 1.0 - (len(warnings) * 0.15)
    passed = score >= 0.7

    return {
        "passed": passed,
        "score": max(0.0, round(score, 2)),
        "status": "checked",
        "violations": violations,
        "warnings": warnings,
        "checks": checks,
        "db_sourced_persona": bool(db_sourced_fields and db_sourced_fields.get("persona")),
    }


def validate_competitor_grounding(
    content: str,
    competitor_data: Optional[List[Dict[str, Any]]] = None,
    db_sourced_fields: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate content references real competitors appropriately.

    Checks that competitive analysis is grounded in actual competitor data
    from onboarding, not generic guesses.

    Args:
        content: The content to validate
        competitor_data: List of competitor analysis from onboarding
        db_sourced_fields: Fields marked as DB-sourced

    Returns:
        Validation result with competitor grounding score
    """
    content_lower = content.casefold() if content else ""
    warnings = []
    checks = []

    if not competitor_data:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No competitor data available for grounding check"],
            "checks": [],
        }

    competitor_list = competitor_data if isinstance(competitor_data, list) else competitor_data.get("competitors", [])
    if not competitor_list:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No competitors defined"],
            "checks": [],
        }

    competitor_domains = []
    competitor_names = []

    for comp in competitor_list:
        if isinstance(comp, dict):
            domain = comp.get("domain") or comp.get("website") or comp.get("url", "")
            name = comp.get("name", "")
            if domain:
                competitor_domains.append(domain.casefold().replace("https://", "").replace("http://", "").replace("www.", ""))
            if name:
                competitor_names.append(name.casefold())

    mentioned_competitors = []
    for domain in competitor_domains:
        domain_clean = domain.split("/")[0]
        if domain_clean in content_lower:
            mentioned_competitors.append(domain_clean)

    for name in competitor_names:
        if name in content_lower:
            mentioned_competitors.append(name)

    checks.append({
        "type": "competitor_mentions",
        "total_known": len(competitor_list),
        "mentioned": len(mentioned_competitors),
        "ratio": round(len(mentioned_competitors) / len(competitor_list), 2) if competitor_list else 0,
    })

    if len(competitor_list) >= 3 and len(mentioned_competitors) == 0 and len(content_lower) > 200:
        if db_sourced_fields and db_sourced_fields.get("competitors"):
            warnings.append({"type": "competitors_not_referenced", "message": "DB-sourced competitors not referenced in content"})
        else:
            warnings.append({"type": "generic_competitive", "message": "Content lacks specific competitor references; may be generic"})

    competitor_gap_analysis = None
    if isinstance(competitor_data, dict):
        competitor_gap_analysis = competitor_data.get("market_gaps") or competitor_data.get("gaps")

    if competitor_gap_analysis:
        gap_keywords = _as_words(competitor_gap_analysis)[:5]
        gaps_addressed = sum(1 for kw in gap_keywords if kw.casefold() in content_lower)
        checks.append({"type": "gap_analysis_coverage", "gaps": len(gap_keywords), "addressed": gaps_addressed})

    score = 1.0 - (len(warnings) * 0.2)
    passed = score >= 0.6

    return {
        "passed": passed,
        "score": max(0.0, round(score, 2)),
        "status": "checked",
        "violations": [],
        "warnings": warnings,
        "checks": checks,
        "db_sourced_competitors": bool(db_sourced_fields and db_sourced_fields.get("competitors")),
    }


def validate_analytics_consistency(
    predictions: Optional[Dict[str, Any]] = None,
    gsc_analytics: Optional[Dict[str, Any]] = None,
    bing_analytics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate AI predictions are consistent with actual analytics data.

    Checks that performance predictions don't wildly contradict existing
    GSC/Bing analytics trends.

    Args:
        predictions: AI-generated performance predictions
        gsc_analytics: Google Search Console analytics data
        bing_analytics: Bing Webmaster Tools analytics data

    Returns:
        Validation result with consistency score
    """
    warnings = []
    checks = []

    has_analytics = bool(gsc_analytics or bing_analytics)

    if not has_analytics:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No analytics data available for consistency check"],
            "checks": [],
        }

    if not predictions:
        return {
            "passed": True,
            "score": 1.0,
            "status": "checked",
            "violations": [],
            "warnings": [],
            "checks": [],
        }

    gsc_queries = gsc_analytics.get("total_queries", 0) if gsc_analytics else 0
    gsc_clicks = gsc_analytics.get("total_clicks", 0) if gsc_analytics else 0
    bing_clicks = bing_analytics.get("total_clicks", 0) if bing_analytics else 0

    total_clicks = gsc_clicks + bing_clicks

    checks.append({
        "type": "analytics_baseline",
        "gsc_queries": gsc_queries,
        "gsc_clicks": gsc_clicks,
        "bing_clicks": bing_clicks,
        "total_clicks": total_clicks,
    })

    predicted_growth = predictions.get("predicted_growth") or predictions.get("growth_rate")
    predicted_traffic = predictions.get("predicted_traffic") or predictions.get("estimated_traffic")

    if predicted_growth:
        try:
            growth_str = str(predicted_growth).replace("%", "").replace("x", "")
            growth_val = float(growth_str)
            if "x" in str(predicted_growth).lower():
                if growth_val > 5:
                    warnings.append({"type": "unrealistic_growth", "message": f"Predicted {predicted_growth} growth seems unrealistic"})
            elif growth_val > 200:
                warnings.append({"type": "aggressive_growth", "message": f"Predicted {predicted_growth} growth is aggressive without historical basis"})
        except (ValueError, TypeError):
            pass

    if predicted_traffic and total_clicks > 0:
        try:
            pred_traffic = float(predicted_traffic)
            if pred_traffic > total_clicks * 10:
                warnings.append({"type": "traffic_disconnect", "message": "Predicted traffic far exceeds current analytics baseline"})
        except (ValueError, TypeError):
            pass

    score = 1.0 - (len(warnings) * 0.25)
    passed = score >= 0.5

    return {
        "passed": passed,
        "score": max(0.0, round(score, 2)),
        "status": "checked",
        "violations": [],
        "warnings": warnings,
        "checks": checks,
    }


def validate_data_quality_grounding(
    data_quality: Optional[Dict[str, Any]] = None,
    onboarding_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Validate that content is grounded in high-quality onboarding data.

    Uses the data quality scores (completeness, freshness, overall_score)
    to determine confidence in grounding.

    Args:
        data_quality: Data quality metrics from process_onboarding_data
        onboarding_context: Full onboarding context dict

    Returns:
        Validation result with quality grounding score
    """
    if not data_quality:
        return {
            "passed": True,
            "score": 1.0,
            "status": "unavailable",
            "violations": [],
            "warnings": ["No data quality metrics available"],
            "checks": [],
        }

    completeness = data_quality.get("completeness", data_quality.get("completeness_score", 0))
    freshness = data_quality.get("freshness", data_quality.get("freshness_score", 0))
    overall = data_quality.get("overall_score", data_quality.get("confidence", 0))

    checks = [
        {"type": "completeness", "value": completeness},
        {"type": "freshness", "value": freshness},
        {"type": "overall", "value": overall},
    ]

    violations = []
    warnings = []

    if completeness < 0.5:
        violations.append({"type": "low_completeness", "value": round(completeness, 2), "message": "Onboarding data is incomplete; AI may lack context"})
    elif completeness < 0.7:
        warnings.append({"type": "partial_data", "message": "Onboarding data is partially complete"})

    if freshness < 0.5:
        warnings.append({"type": "stale_data", "message": "Onboarding data may be stale; consider refreshing"})

    quality_threshold = 0.6
    score = overall if overall else (completeness + freshness) / 2
    passed = score >= quality_threshold and len(violations) == 0

    return {
        "passed": passed,
        "score": max(0.0, round(score, 2)),
        "status": "checked",
        "violations": violations,
        "warnings": warnings,
        "checks": checks,
        "quality_threshold": quality_threshold,
    }


def validate_strategy_grounding(
    strategy_data: Dict[str, Any],
    onboarding_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Run all strategy grounding validations.

    This is the main entry point for validating that AI-generated strategy
    components are grounded in real onboarding data.

    Args:
        strategy_data: The strategy content to validate (base_strategy,
                      strategic_insights, competitive_analysis, etc.)
        onboarding_context: Full onboarding context with persona_data,
                          competitor_analysis, gsc_analytics, etc.

    Returns:
        Comprehensive grounding validation result
    """
    context = onboarding_context or {}

    content = extract_content(strategy_data)

    persona_data = context.get("persona_data") or context.get("persona") or {}
    competitor_data = context.get("competitor_analysis") or context.get("competitors") or []
    gsc_analytics = context.get("gsc_analytics") or {}
    bing_analytics = context.get("bing_analytics") or {}
    data_quality = context.get("data_quality") or {}

    db_sourced = context.get("db_sourced_fields", {})

    persona_result = validate_persona_grounding(content, persona_data, db_sourced)
    competitor_result = validate_competitor_grounding(content, competitor_data, db_sourced)
    analytics_result = validate_analytics_consistency(
        strategy_data.get("performance_predictions"),
        gsc_analytics,
        bing_analytics,
    )
    quality_result = validate_data_quality_grounding(data_quality, context)

    results = {
        "persona_grounding": persona_result,
        "competitor_grounding": competitor_result,
        "analytics_consistency": analytics_result,
        "data_quality": quality_result,
    }

    overall_score = (
        (persona_result.get("score", 1.0) * 0.25) +
        (competitor_result.get("score", 1.0) * 0.25) +
        (analytics_result.get("score", 1.0) * 0.2) +
        (quality_result.get("score", 1.0) * 0.3)
    )

    all_violations = []
    all_warnings = []

    for result in results.values():
        all_violations.extend(result.get("violations", []))
        all_warnings.extend(result.get("warnings", []))

    passed = (
        persona_result.get("passed", True) and
        competitor_result.get("passed", True) and
        analytics_result.get("passed", True) and
        quality_result.get("passed", True) and
        overall_score >= 0.6
    )

    return {
        "passed": passed,
        "score": round(overall_score, 2),
        "status": "checked",
        "violations": all_violations,
        "warnings": all_warnings,
        "details": results,
        "checked": bool(content),
    }
