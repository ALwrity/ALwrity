"""
Phase 7 — LinkedIn profile optimization LLM prompts.

Prompt engineering only. No service, repository, or business-logic imports.
"""

from __future__ import annotations

import json
from typing import Any, Optional

PROFILE_OPTIMIZATION_LLM_BATCH_SIZE = 5
PROFILE_OPTIMIZATION_BACKLOG_MIN = 10
PROFILE_OPTIMIZATION_BACKLOG_MAX = 15

PROFILE_SECTIONS: tuple[str, ...] = (
    "headline",
    "summary",
    "profile_photo",
    "custom_url",
    "experience",
    "skills",
    "recommendations",
    "education",
    "certifications",
    "featured",
)

PROFILE_OPTIMIZATION_SYSTEM_PROMPT = f"""You are ALwrity's LinkedIn Profile Advisor.

Your task is to recommend profile improvements based ONLY on the JSON provided in the user
message: profile field snippets, detected_gaps, profile_validation, and ai_profile_intelligence.

You are NOT a content or posting advisor. Do NOT recommend posting frequency, commenting
tactics, hashtags, connection strategies, Creator Mode, or newsletters.

Rules:
- Return valid JSON only. No markdown fences, commentary, or extra keys.
- Return exactly {PROFILE_OPTIMIZATION_LLM_BATCH_SIZE} recommendations for this batch,
  ranked by impact (highest first). The server assembles a full backlog of
  {PROFILE_OPTIMIZATION_BACKLOG_MIN}–{PROFILE_OPTIMIZATION_BACKLOG_MAX} items across multiple batches.
- Address ONLY gaps listed in detected_gaps and validation missing fields. Do NOT invent new gaps.
- Each recommendation must map to one profile_section from the allowed list.
- current_state_summary MUST quote or closely paraphrase actual profile data from profile_field_snippets.
- suggested_copy is required for headline and summary sections; use empty string for other sections
  when copy is not applicable.
- impact must be exactly "High", "Medium", or "Low".
- effort must be exactly "Low", "Medium", or "High".
- Do NOT include "id" or "meta" fields — those are added server-side.
- Use second person ("your headline…") in issue and recommended_action.

Allowed profile_section values:
{", ".join(PROFILE_SECTIONS)}

Return a JSON object with exactly one key:
- recommendations (array of exactly {PROFILE_OPTIMIZATION_LLM_BATCH_SIZE} objects)

Each recommendation object must have exactly these keys:
- profile_section (string; one of the allowed sections)
- issue (string; concise problem statement)
- why_it_matters (string; 1–2 sentences citing LinkedIn best practices)
- current_state_summary (string; what the profile shows today)
- recommended_action (string; concrete steps the user should take)
- suggested_copy (string; example text for headline/summary when relevant, else "")
- impact (string; "High", "Medium", or "Low")
- effort (string; "Low", "Medium", or "High")
- best_practice_ref (string; e.g. "Enhancement Report §1.2")
- completion_criteria (string; how the user knows this item is done)

Best-practice appendix (profile sections only):
§1.1 Photo: professional headshot, high quality, face visible.
§1.2 Headline: go beyond job title; use keywords and value proposition (up to 220 chars).
§1.3 Custom URL: claim linkedin.com/in/yourname for credibility and search.
§1.4 Summary: first lines matter; first person; story + keywords + call-to-action (200–300 words).
§1.5 Experience: quantify achievements; describe impact, not duties only.
§1.6 Skills: list relevant skills (target 30–50); prioritize top 3 for goals.
§1.7 Recommendations: social proof from managers, clients, colleagues.
§1.8 Education & certifications: complete fields; show continuous learning.
§1.9 Featured: showcase best work and recent achievements.
§2.3 Search: include industry keywords naturally in headline, summary, and experience.
"""


def build_profile_optimization_user_prompt(
    profile_context: dict[str, Any],
    profile_validation: dict[str, Any],
    detected_gaps: list[Any],
    ai_profile_intelligence: dict[str, Any],
    completed_recommendation_ids: Optional[list[str]] = None,
) -> str:
    """
    Build the user message for profile optimization LLM generation.

    Args:
        profile_context: Phase 2 ``LinkedInProfileContext`` dict
        profile_validation: Phase 3 validation result dict
        detected_gaps: Rubric gaps (``DetectedGap`` models or dicts)
        ai_profile_intelligence: Phase 5 intelligence dict (``meta`` stripped)
        completed_recommendation_ids: Optional IDs to deprioritize on regeneration

    Returns:
        Compact JSON payload for the LLM user message

    Raises:
        TypeError: When required inputs are not dicts/lists
    """
    if not isinstance(profile_context, dict):
        raise TypeError("profile_context must be a dict")
    if not isinstance(profile_validation, dict):
        raise TypeError("profile_validation must be a dict")
    if not isinstance(detected_gaps, list):
        raise TypeError("detected_gaps must be a list")
    if not isinstance(ai_profile_intelligence, dict):
        raise TypeError("ai_profile_intelligence must be a dict")

    gap_payload = [_gap_to_dict(gap) for gap in detected_gaps]
    intelligence_payload = {
        key: value for key, value in ai_profile_intelligence.items() if key != "meta"
    }

    payload: dict[str, Any] = {
        "profile_field_snippets": _build_profile_field_snippets(profile_context),
        "profile_validation": {
            "is_profile_complete": profile_validation.get("is_profile_complete"),
            "completeness_score": profile_validation.get("completeness_score"),
            "missing_fields": list(profile_validation.get("missing_fields") or []),
            "optional_missing_fields": list(
                profile_validation.get("optional_missing_fields") or []
            ),
        },
        "detected_gaps": gap_payload,
        "ai_profile_intelligence": intelligence_payload,
    }
    if completed_recommendation_ids:
        payload["completed_recommendation_ids"] = list(completed_recommendation_ids)

    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _gap_to_dict(gap: Any) -> dict[str, Any]:
    if hasattr(gap, "model_dump"):
        return gap.model_dump()
    if isinstance(gap, dict):
        return {
            "section": gap.get("section"),
            "severity": gap.get("severity"),
            "rule_id": gap.get("rule_id"),
            "current_snippet": gap.get("current_snippet"),
        }
    raise TypeError("detected_gaps items must be DetectedGap or dict")


def _build_profile_field_snippets(profile_context: dict[str, Any]) -> dict[str, Any]:
    """Extract key profile field values for grounded LLM recommendations."""
    personal = profile_context.get("personal_information")
    professional = profile_context.get("professional_information")
    linkedin_info = profile_context.get("linkedin_information")

    personal_dict = personal if isinstance(personal, dict) else {}
    professional_dict = professional if isinstance(professional, dict) else {}
    linkedin_dict = linkedin_info if isinstance(linkedin_info, dict) else {}

    skills = professional_dict.get("skills")
    skills_list = skills if isinstance(skills, list) else []
    skills_total = professional_dict.get("skills_total_count")
    skills_count = (
        int(skills_total)
        if isinstance(skills_total, int) and skills_total > 0
        else len(skills_list)
    )

    experience = professional_dict.get("experience")
    top_experience: dict[str, Any] = {}
    if isinstance(experience, list) and experience and isinstance(experience[0], dict):
        top_experience = experience[0]

    about = str(personal_dict.get("about") or "")
    headline = str(personal_dict.get("headline") or "")

    return {
        "name": personal_dict.get("name") or "",
        "headline": headline,
        "headline_length": len(headline),
        "about_preview": about[:400],
        "about_length": len(about),
        "location": personal_dict.get("location") or "",
        "job_title": professional_dict.get("job_title") or "",
        "company": professional_dict.get("company") or "",
        "industry": professional_dict.get("industry") or "",
        "skills_count": skills_count,
        "top_skill_names": [
            str(item.get("name"))
            for item in skills_list[:5]
            if isinstance(item, dict) and item.get("name")
        ],
        "top_experience_title": top_experience.get("title") or "",
        "top_experience_company": top_experience.get("company") or "",
        "top_experience_description_preview": str(top_experience.get("description") or "")[
            :300
        ],
        "recommendations_received_count": professional_dict.get(
            "recommendations_received_count", 0
        ),
        "profile_picture_present": bool(linkedin_dict.get("profile_picture")),
        "public_identifier": linkedin_dict.get("public_identifier") or "",
        "profile_url": linkedin_dict.get("profile_url") or "",
    }
