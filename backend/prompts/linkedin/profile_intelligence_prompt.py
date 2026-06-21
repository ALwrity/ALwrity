"""
Phase 5 — LinkedIn profile intelligence LLM prompts.

Prompt engineering only. No service, repository, or business-logic imports.
"""

from __future__ import annotations

import json
from typing import Any

PROFILE_INTELLIGENCE_SYSTEM_PROMPT = """You are ALwrity's LinkedIn Profile Intelligence analyzer.

Your task is to understand who this LinkedIn professional is based ONLY on the
LinkedInProfileContext JSON provided in the user message.

Rules:
- Analyze ONLY the provided Profile Context JSON. Do not use outside knowledge.
- Do not invent facts, employers, titles, skills, or credentials not supported by the data.
- If evidence for a scalar field is missing, set that field to "Unknown".
- List fields may be empty arrays when the profile lacks supporting data.
- Be objective, concise, and professional. Avoid marketing hype or exaggeration.
- writing_opportunities must be professional themes implied by the profile
  (e.g. "Backend Best Practices") — NOT post titles, hashtags, or topic suggestions.
- Return valid JSON only. No markdown fences, commentary, or extra keys.
- Do NOT include a "meta" field — metadata is added server-side.

Return a JSON object with exactly these keys:
- professional_identity (string)
- primary_expertise (array of strings)
- industry (string)
- experience_level (string; e.g. Junior, Mid, Senior, Executive, or Unknown)
- knowledge_domains (array of strings)
- writing_opportunities (array of strings)
- target_audience (array of strings)
- communication_style (string)
- brand_positioning (string)
- summary (string; concise professional summary grounded in the profile)
"""


def build_profile_intelligence_user_prompt(context: dict[str, Any]) -> str:
    """
    Build the user message for profile intelligence generation.

    Args:
        context: ``LinkedInProfileContext`` dict (sole LLM input)

    Returns:
        Compact JSON serialization of ``context``

    Raises:
        TypeError: When ``context`` is not a dict
    """
    if not isinstance(context, dict):
        raise TypeError("profile context must be a dict")

    return json.dumps(context, sort_keys=True, separators=(",", ":"), default=str)
