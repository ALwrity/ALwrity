"""AI-powered outreach email template generation."""

from __future__ import annotations

import json
import re
from typing import List, Optional, Dict, Any, Union
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen


EMAIL_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "subject": {"type": "string", "description": "Email subject line"},
        "body": {"type": "string", "description": "Email body content"},
    },
    "required": ["subject", "body"],
}

SUBJECTS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "subjects": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of subject line suggestions",
        }
    },
    "required": ["subjects"],
}


SYSTEM_PROMPT = """You are an expert outreach copywriter specializing in guest post and backlink pitch emails.
Write concise, personalized outreach emails that get high response rates.
Follow these rules:
- Be specific about why you're reaching out (mention their content)
- Keep it under 200 words
- Include a clear call to action
- Sound human, not templated
- Never use spammy phrases"""

SUBJECT_LINES_PROMPT = """You are an expert email subject line writer.
Given an outreach email body, generate subject lines that are:
- Intriguing but not clickbait
- Personalized when possible
- Under 60 characters
- Varied in style (question, curiosity, value-prop)"""

FOLLOW_UP_PROMPT = """You are an expert outreach copywriter.
Write a polite follow-up email for a guest post pitch that hasn't received a response.
Rules:
- Reference the original email without repeating it verbatim
- Keep it shorter than the original (under 100 words)
- Add a new angle or piece of value
- Include a clear call to action
- Sound human and respectful, never pushy"""

PERSONALIZATION_PROMPT = """You are an expert outreach personalization specialist.
Write a personalized guest post pitch email for a specific lead.
Rules:
- Address the lead by name
- Reference their specific content or website naturally
- Mention something relevant from their published work
- Keep it under 200 words
- Sound human and specific, not templated
- Include a clear call to action"""


def _parse_llm_response(
    raw: Union[str, Dict[str, Any], None],
    expected_keys: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Parse llm_text_gen response following blog writer pattern.

    llm_text_gen with json_struct may return:
      - dict (from Gemini structured output)
      - str  (from providers that return JSON text)

    Args:
        raw: Raw response from llm_text_gen.
        expected_keys: Keys that must be present (e.g. ["subject", "body"]).

    Returns:
        Parsed dict or None.
    """
    if not raw:
        return None

    result = raw
    if isinstance(result, str):
        text = result.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse LLM response as JSON: {text[:200]}")
            return None

    if not isinstance(result, dict):
        logger.warning(f"Unexpected response type: {type(result)}")
        return None

    if expected_keys:
        missing = [k for k in expected_keys if k not in result]
        if missing:
            logger.warning(f"Response missing expected keys: {missing}")
            return None
        cleaned = {}
        for k in expected_keys:
            v = result.get(k)
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v
        return cleaned

    return result


def generate_outreach_email(
    topic: str,
    target_site: Optional[str] = None,
    tone: str = "professional",
    user_id: str = "default",
    existing_body: Optional[str] = None,
) -> dict:
    """Generate an outreach email using the LLM.

    Args:
        topic: The topic/keyword to pitch.
        target_site: Optional target website name/URL.
        tone: professional, friendly, casual, or formal.
        user_id: Clerk user ID for subscription check.
        existing_body: If provided, rewrite/improve this existing template.

    Returns:
        dict with "subject" and "body" keys.
    """
    if existing_body:
        prompt = (
            f"Rewrite and improve the following outreach email for a {tone} tone. "
            f"Topic: {topic}. "
            f"{f'Target website: {target_site}. ' if target_site else ''}"
            f"Keep the core message but make it more effective. "
            f"Original email:\n\n{existing_body}\n\n"
        )
    else:
        prompt = (
            f"Write a {tone} outreach email for a guest post opportunity about: {topic}. "
            f"{f'We are pitching this to: {target_site}. ' if target_site else ''}"
            f"Mention specific value the guest post would bring to their audience. "
        )

    try:
        raw = llm_text_gen(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            json_struct=EMAIL_SCHEMA,
            user_id=user_id,
            temperature=0.7,
        )

        result = _parse_llm_response(raw, expected_keys=["subject", "body"])
        if result:
            return result

        return _fallback_extract(raw, topic) if isinstance(raw, str) else _fallback_extract("", topic)

    except Exception as e:
        logger.error(f"Failed to generate outreach email: {e}")
        return {
            "subject": f"Guest post opportunity: {topic}",
            "body": f"Hi there,\n\nI came across your site and I'd love to contribute a guest post about {topic}. "
                     f"Please let me know if you're open to submissions.\n\nBest regards",
        }


def generate_personalized_email(
    lead_name: str,
    lead_site: str,
    lead_content_topic: str,
    pitch_topic: str,
    existing_body: str = "",
    user_id: str = "default",
    tone: str = "professional",
    lead_summary: Optional[str] = None,
    lead_highlights: Optional[str] = None,
    lead_guidelines: Optional[str] = None,
    lead_pitch_angle: Optional[str] = None,
    lead_published_date: Optional[str] = None,
) -> dict:
    """Generate or personalize an outreach email for a specific lead.

    When existing_body is provided, personalizes the draft. Otherwise generates
    a fully personalized email from scratch using all available lead context.

    Args:
        lead_name: Contact name or site owner name.
        lead_site: The lead's website URL.
        lead_content_topic: Topic of relevant content on their site.
        pitch_topic: The topic we want to pitch.
        existing_body: Optional draft to personalize further.
        user_id: Clerk user ID for subscription check.
        tone: professional, friendly, casual, or formal.
        lead_summary: Exa AI summary of their article.
        lead_highlights: Key highlights from their article (joined string).
        lead_guidelines: Guest post guidelines summary.
        lead_pitch_angle: AI-suggested pitch angle.
        lead_published_date: Article publication date.

    Returns:
        dict with "subject" and "body" keys.
    """
    context_parts = []
    if lead_summary:
        context_parts.append(f"Article summary: {lead_summary}")
    if lead_highlights:
        context_parts.append(f"Key highlights from their article: {lead_highlights}")
    if lead_guidelines:
        context_parts.append(f"Their guest post guidelines: {lead_guidelines}")
    if lead_pitch_angle:
        context_parts.append(f"Suggested pitch angle: {lead_pitch_angle}")
    if lead_published_date:
        context_parts.append(f"Their relevant article was published: {lead_published_date}")

    context_str = "\n".join(context_parts)
    if context_str:
        context_str = f"\n\nAdditional context about this lead:\n{context_str}\n"

    if existing_body:
        prompt = (
            f"Personalize this outreach email for {lead_name} from {lead_site}. "
            f"They have content about '{lead_content_topic}'. "
            f"{context_str}"
            f"We want to pitch: {pitch_topic}. "
            f"Mention something specific about their content "
            f"to show we've done our research. "
            f"Draft email to personalize:\n\n{existing_body}\n\n"
        )
    else:
        prompt = (
            f"Write a {tone} personalized outreach email to {lead_name} at {lead_site}. "
            f"They have published content about '{lead_content_topic}'. "
            f"{context_str}"
            f"We want to pitch a guest post about: {pitch_topic}. "
            f"Reference their specific content and explain how our pitch "
            f"would provide value to their audience. "
        )

    try:
        raw = llm_text_gen(
            prompt=prompt,
            system_prompt=PERSONALIZATION_PROMPT,
            json_struct=EMAIL_SCHEMA,
            user_id=user_id,
            temperature=0.7,
        )

        result = _parse_llm_response(raw, expected_keys=["subject", "body"])
        if result:
            return result

        return _fallback_extract(raw, lead_content_topic) if isinstance(raw, str) else _fallback_extract("", lead_content_topic)

    except Exception as e:
        logger.error(f"Failed to personalize email: {e}")
        return {"subject": f"Question about your content on {lead_content_topic}", "body": existing_body or f"Hi {lead_name},\n\nI enjoyed your article about {lead_content_topic}..."}


def generate_subject_lines(
    body: str,
    count: int = 5,
    user_id: str = "default",
) -> List[str]:
    """Generate subject line suggestions for an email body.

    Args:
        body: The email body to generate subject lines for.
        count: Number of subject lines to generate.
        user_id: Clerk user ID for subscription check.

    Returns:
        List of subject line strings.
    """
    prompt = (
        f"Generate {count} subject lines for the following outreach email. "
        f"Make them varied in style and optimized for open rates.\n\n"
        f"Email body:\n{body}\n\n"
    )

    try:
        raw = llm_text_gen(
            prompt=prompt,
            system_prompt=SUBJECT_LINES_PROMPT,
            json_struct=SUBJECTS_SCHEMA,
            user_id=user_id,
            temperature=0.8,
        )

        result = _parse_llm_response(raw, expected_keys=["subjects"])
        if result and isinstance(result["subjects"], list):
            return [s.strip() for s in result["subjects"] if isinstance(s, str)][:count]

        if isinstance(raw, str):
            lines = [l.strip("- ").strip() for l in raw.strip().split("\n") if l.strip() and not l.strip().startswith("```")]
            return [l for l in lines if len(l) > 10][:count]

    except Exception as e:
        logger.error(f"Failed to generate subject lines: {e}")

    return [f"Guest post opportunity", f"Question about your content", f"Collaboration idea"]


def generate_follow_up(
    original_subject: str,
    original_body: str,
    days_elapsed: int = 7,
    reply_context: str = "",
    user_id: str = "default",
) -> dict:
    """Generate a follow-up email for an outreach that hasn't received a response.

    Args:
        original_subject: Subject line of the original email.
        original_body: Body of the original email.
        days_elapsed: Number of days since the original was sent.
        reply_context: If the recipient replied, context of their reply.
        user_id: Clerk user ID for subscription check.

    Returns:
        dict with "subject" and "body" keys.
    """
    if reply_context:
        prompt = (
            f"The recipient replied with: '{reply_context}'. "
            f"Write a follow-up email that addresses their response and keeps the conversation moving. "
            f"Original subject: {original_subject}.\n\n"
            f"Original email:\n{original_body}\n\n"
        )
    else:
        prompt = (
            f"Write a polite follow-up email. {days_elapsed} days have passed since the original email. "
            f"Do not apologize for following up. Add a new piece of value or angle. "
            f"Original subject: {original_subject}.\n\n"
            f"Original email:\n{original_body}\n\n"
        )

    try:
        raw = llm_text_gen(
            prompt=prompt,
            system_prompt=FOLLOW_UP_PROMPT,
            json_struct=EMAIL_SCHEMA,
            user_id=user_id,
            temperature=0.7,
        )

        result = _parse_llm_response(raw, expected_keys=["subject", "body"])
        if result:
            return result

        return _fallback_extract(raw, original_subject) if isinstance(raw, str) else _fallback_extract("", original_subject)

    except Exception as e:
        logger.error(f"Failed to generate follow-up: {e}")
        return {
            "subject": f"Re: {original_subject}",
            "body": f"Hi there,\n\nI wanted to follow up on my previous email. "
                    f"I'd love to hear your thoughts when you have a moment.\n\nBest regards",
        }


def _fallback_extract(raw: str, topic: str) -> dict:
    """Fallback: try to extract subject line and body from unstructured text."""
    if not raw:
        return {"subject": topic, "body": ""}
    lines = [l.strip() for l in raw.strip().split("\n") if l.strip()]
    subject = topic
    body_lines = []

    for i, line in enumerate(lines):
        lower = line.lower()
        if lower.startswith("subject") or lower.startswith("subject:"):
            subject = line.split(":", 1)[-1].strip()
        elif lower.startswith("body") or lower.startswith("body:"):
            body_lines.append(line.split(":", 1)[-1].strip())
        else:
            body_lines.append(line)

    body = "\n".join(body_lines) if body_lines else raw
    return {"subject": subject, "body": body}
