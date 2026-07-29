"""
LinkedIn Today's Workflow — Pillar Generators
==============================================

Pure async functions: take user_id + date, return task dicts.
No class dependency — imports data helpers from the _data module.
"""

import asyncio
import json
import re
from typing import Any, Dict, List, Optional

from loguru import logger

from services.linkedin_today_workflow_data import (
    MAX_TASKS_PER_PILLAR,
    GLOBAL_MAX_TASKS,
    PILLAR_PRIORITY_ORDER,
    LINKEDIN_PILLAR_ACTION_URLS,
    set_generation_progress,
    call_llm_for_tasks,
    fetch_bottom_posts,
    fetch_brainstorm_ideas,
    fetch_calendar_events,
    fetch_content_gaps,
    fetch_draft_type_counts,
    fetch_drafts,
    fetch_engagement_opportunities,
    fetch_engagement_trends,
    fetch_network_suggestions,
    fetch_persona,
    fetch_posting_cadence,
    fetch_recent_task_titles,
    fetch_top_posts,
    fetch_trending_topics,
    fetch_upcoming_events,
    fetch_user_linkedin_goals,
    fetch_watchdog_updates,
    fetch_brand_scorecard,
)
from services.llm_providers.main_text_generation import llm_text_gen


# ── Context builders ──────────────────────────────────────────────────────────

def build_plan_context(
    watchdog: List[Dict[str, Any]],
    ideas: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    trending: List[Dict[str, Any]],
    persona: Optional[Dict[str, Any]] = None,
    calendar_events: Optional[List[Dict[str, Any]]] = None,
    goals: Optional[Dict[str, Any]] = None,
) -> str:
    parts = []
    if watchdog:
        parts.append("Watchdog updates:\n" + json.dumps(watchdog, indent=2))
    if ideas:
        parts.append("Brainstorm ideas:\n" + json.dumps(ideas, indent=2))
    if gaps:
        parts.append("Content gaps:\n" + json.dumps(gaps, indent=2))
    if trending:
        parts.append("Trending topics:\n" + json.dumps(trending, indent=2))
    if not gaps and not trending:
        if persona:
            parts.append("Your style & topics:\n" + json.dumps(persona, indent=2))
        if goals:
            parts.append("Your goals:\n" + json.dumps(goals, indent=2))
        if calendar_events:
            parts.append("Calendar events:\n" + json.dumps(calendar_events, indent=2))
    return "\n\n".join(parts)


def _compute_scorecard_status(brand: Dict[str, Any]) -> Optional[str]:
    """Return a single status label for the brand scorecard.

    Avoids asking the LLM to parse dates and assess gap severity.
    """
    from datetime import datetime, timezone
    generated_at = brand.get("generated_at")
    if not generated_at:
        return None
    try:
        ts = datetime.fromisoformat(generated_at)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
    except (ValueError, TypeError):
        return None

    score = brand.get("overall_score", 0)
    has_gaps = bool(brand.get("dimensions")) and any(
        d.get("score", 100) < 60 for d in brand["dimensions"]
    )

    if age_hours > 48:
        return "stale"
    if score >= 80 and not has_gaps:
        return "good"
    return "fresh_with_gaps"


def build_analysis_context(
    brand: Optional[Dict[str, Any]],
    top_posts: List[Dict[str, Any]],
    bottom_posts: List[Dict[str, Any]],
    trends: Optional[Dict[str, Any]],
) -> str:
    parts = []
    if brand:
        parts.append("Brand scorecard:\n" + json.dumps(brand, indent=2))
        status = _compute_scorecard_status(brand)
        if status:
            parts.append(f"Scorecard status: {status}.")
    if top_posts:
        parts.append("Top performing posts:\n" + json.dumps(top_posts, indent=2))
    if bottom_posts:
        parts.append("Lowest performing posts:\n" + json.dumps(bottom_posts, indent=2))
    if trends:
        parts.append("Engagement trends:\n" + json.dumps(trends, indent=2))
    return "\n\n".join(parts)


def build_create_context(
    trending: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    persona: Dict[str, Any],
) -> str:
    parts = []
    if trending:
        parts.append("Trending topics:\n" + json.dumps(trending, indent=2))
    if gaps:
        parts.append("Content gaps:\n" + json.dumps(gaps, indent=2))
    if persona:
        parts.append("Your style & topics:\n" + json.dumps(persona, indent=2))
    return "\n\n".join(parts)


def _compute_recommended_draft(drafts: List[Dict[str, Any]]) -> Optional[str]:
    """Pick the oldest draft (most time-sensitive) — avoids LLM date-sorting."""
    if not drafts:
        return None
    with_created = [d for d in drafts if d.get("created_at")]
    if not with_created:
        return drafts[0]
    oldest = min(with_created, key=lambda d: d["created_at"])
    return json.dumps(oldest)


def build_publish_context(
    drafts: List[Dict[str, Any]],
    calendar_events: List[Dict[str, Any]],
) -> str:
    parts = [f"Saved LinkedIn drafts ({len(drafts)} total):\n" + json.dumps(drafts, indent=2)]
    recommended = _compute_recommended_draft(drafts)
    if recommended:
        parts.append(f"Recommended draft for publication (oldest):\n{recommended}")
    if calendar_events:
        parts.append("Calendar events due today:\n" + json.dumps(calendar_events, indent=2))
    return "\n\n".join(parts)


def build_engagement_context(
    opportunities: List[Dict[str, Any]],
    suggestions: List[Dict[str, Any]],
) -> str:
    parts = []
    if opportunities:
        parts.append("Engagement opportunities:\n" + json.dumps(opportunities, indent=2))
    if suggestions:
        parts.append("Network connection suggestions:\n" + json.dumps(suggestions, indent=2))
    return "\n\n".join(parts)


def _format_topic_exclusions(events: List[Dict[str, Any]]) -> Optional[str]:
    """Extract event titles as explicit topics to avoid duplicating."""
    titles = [e.get("title", "") for e in events if e.get("title")]
    if not titles:
        return None
    return "Topics already scheduled (avoid re-creating): " + "; ".join(titles) + "."


def _format_recent_tasks(titles: List[str]) -> Optional[str]:
    """Format recently completed task titles so the LLM doesn't re-recommend."""
    if not titles:
        return None
    return "Recently completed tasks: " + "; ".join(titles) + "."


def _format_hype_opportunities(events: List[Dict[str, Any]]) -> Optional[str]:
    """Identify events within 2 days that could use pre-event engagement."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    near = []
    for e in events:
        sched = e.get("scheduled_date")
        if not sched:
            continue
        try:
            ts = datetime.fromisoformat(sched)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            days_until = (ts - now).days
            if 0 <= days_until <= 2:
                near.append(f'"{e.get("title", "")}" on {sched[:10]}')
        except (ValueError, TypeError):
            continue
    if not near:
        return None
    return "Upcoming events needing hype: " + "; ".join(near) + "."


def _format_topic_overlaps(posts: List[Dict[str, Any]], events: List[Dict[str, Any]]) -> Optional[str]:
    """Check if any top-post keywords appear in upcoming event titles."""
    post_titles = [p.get("text", "") or "" for p in posts]
    event_titles = [e.get("title", "") or "" for e in events]
    if not post_titles or not event_titles:
        return None
    matches = []
    for pt in post_titles:
        words = set(w.lower() for w in pt.split() if len(w) > 3)
        for et in event_titles:
            if words & set(w.lower() for w in et.split() if len(w) > 3):
                matches.append(f'Post "{pt[:50]}" overlaps with event "{et}"')
    if not matches:
        return None
    return "Content-event topic matches (repurpose candidate):\n" + "\n".join(matches)


def _compute_repurpose_candidates(top_posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Filter posts to the ideal repurposing age window (7-90 days).

    Adds a computed ``age_days`` field so the LLM doesn't parse dates.
    """
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    candidates = []
    for p in top_posts:
        created = p.get("created_at")
        if not created:
            continue
        try:
            ts = datetime.fromisoformat(created)
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            age = (now - ts).days
        except (ValueError, TypeError):
            continue
        if 7 <= age <= 90:
            p = dict(p)
            p["age_days"] = age
            candidates.append(p)
    return candidates


def build_remarket_context(
    top_posts: List[Dict[str, Any]],
    trends: Optional[Dict[str, Any]],
) -> str:
    parts = []
    if top_posts:
        candidates = _compute_repurpose_candidates(top_posts)
        if candidates:
            parts.append("Your top-performing posts ripe for repurposing (7-90 days old):\n" + json.dumps(candidates, indent=2))
        else:
            parts.append("No top-performing posts are in the ideal repurposing window (7-90 days old).")
    if trends:
        parts.append("Engagement trends:\n" + json.dumps(trends, indent=2))
    return "\n\n".join(parts)


# ── Phase 4: Goal-to-focus mapping ─────────────────────────────────────────────

GOAL_FOCUS_MAP: Dict[str, Dict[str, str]] = {
    "Thought Leadership": {
        "analysis_focus": "authority signals (share of voice, topic authority)",
        "engagement_style": "industry peers and subject matter experts",
    },
    "Engagement": {
        "analysis_focus": "conversation starters (comment rate, discussion depth)",
        "engagement_style": "trending discussions and active comment threads",
    },
    "Lead Generation": {
        "analysis_focus": "conversion metrics (click-through, profile visits, DMs)",
        "engagement_style": "decision-makers and potential clients",
    },
    "Personal Branding": {
        "analysis_focus": "brand consistency (voice, topic alignment, reach)",
        "engagement_style": "cross-industry connections and diverse networks",
    },
    "Sales": {
        "analysis_focus": "pipeline influence (inbound leads, meeting requests)",
        "engagement_style": "prospects and referral partners",
    },
    "Community Building": {
        "analysis_focus": "retention metrics (return commenters, group growth)",
        "engagement_style": "existing followers and community members",
    },
    "Career Growth": {
        "analysis_focus": "visibility signals (profile views, recruiter reach)",
        "engagement_style": "recruiters, hiring managers, and mentors",
    },
}


def _format_goal_instructions(goals: List[str], pillar: str) -> Optional[str]:
    """Return a pillar-specific instruction from the goal-focus map.

    The LLM receives an explicit mapping rather than inferring what each
    goal means for analysis or engagement tasks.
    """
    if not goals:
        return None
    for goal in goals:
        entry = GOAL_FOCUS_MAP.get(goal)
        if not entry:
            continue
        if pillar == "analysis" and "analysis_focus" in entry:
            return f"Goal-specific instruction: Since your goal is \"{goal}\", focus analysis on {entry['analysis_focus']}."
        if pillar == "engagement" and "engagement_style" in entry:
            return f"Goal-specific instruction: Since your goal is \"{goal}\", prioritise engaging with {entry['engagement_style']}."
    return None


def _compute_urgency_bias(cadence: Dict[str, Any]) -> Optional[str]:
    """Determine whether the user should prioritise creation or analysis based on cadence."""
    posts_30d = cadence.get("posts_last_30d", 0)
    recommended = cadence.get("recommended_cadence", "")
    if not recommended:
        return None
    match = re.search(r"(\d+)", recommended)
    if not match:
        return None
    min_recommended_per_week = int(match.group(1))
    implied_per_week = posts_30d / 4.33  # approximate weeks in 30 days
    if implied_per_week < min_recommended_per_week - 0.5:
        return "creation"
    return None


def _compute_least_used_format(draft_types: Dict[str, int]) -> Optional[str]:
    """Return the format with the fewest drafts, or None if no data."""
    if not draft_types:
        return None
    return min(draft_types, key=draft_types.get)


def build_common_context(goals: List[str], cadence: Dict[str, Any], draft_types: Dict[str, int]) -> str:
    """Build shared context snippet prepended to every pillar's user prompt.

    Includes computed deterministic facts (urgency bias, least-used format)
    so the LLM doesn't need to infer them from raw data.
    """
    parts = []
    if goals:
        parts.append("Your LinkedIn goals: " + ", ".join(goals) + ".")
    if cadence:
        parts.append(
            f"Your recent posting cadence — last 7d: {cadence.get('posts_last_7d', 0)}, "
            f"last 14d: {cadence.get('posts_last_14d', 0)}, "
            f"last 30d: {cadence.get('posts_last_30d', 0)}. "
            f"Recommended: {cadence.get('recommended_cadence', '3-4 per week')}."
        )
        bias = _compute_urgency_bias(cadence)
        if bias:
            parts.append(
                f"Urgency bias: {bias} (posting {cadence.get('posts_last_30d', 0)} posts "
                f"in 30d vs recommended {cadence.get('recommended_cadence', '3-4 per week')})."
            )
    if draft_types:
        ordered = sorted(draft_types.items(), key=lambda x: -x[1])
        parts.append("Your draft distribution by format: " + ", ".join(f"{k}: {v}" for k, v in ordered) + ".")
        least = _compute_least_used_format(draft_types)
        if least:
            count = draft_types[least]
            parts.append(f"Recommended underused format: {least} ({count} draft{'s' if count != 1 else ''}).")
    return "\n".join(parts)


# ── Per-pillar system prompts ──────────────────────────────────────────────────

_PLAN_SYSTEM_PROMPT = """You are a LinkedIn strategist. Based on the user's current data, suggest up to {max_tasks} planning tasks for TODAY only. Prioritize tasks that directly serve the user's LinkedIn goals.

The user prompt includes:
- Their LinkedIn goals and posting cadence
- A computed urgency bias (explicitly tells you whether to prioritise creation or analysis)
- Recent task history (tasks recently worked on)
- Upcoming calendar events (scheduled LinkedIn content)
- Tasks already assigned today by other pillars

Rules:
- Titles must be under 60 characters, action-oriented, specific
- Descriptions under 200 characters — explain WHY this task matters today and how it ties to their goals
- "high" priority = a trending topic is hot RIGHT NOW or directly advances a stated goal
- "medium" priority = a content gap needs filling this week
- "low" priority = review saved ideas, general planning
- Follow the urgency bias if provided — it is computed from actual cadence vs recommendation; you don't need to re-derive it
- Avoid duplicating tasks from other pillars already assigned today
- Respect the "Topics already scheduled" exclusion list — it is computed from calendar events
- Respect the "Recently completed tasks" list — don't re-assign what was recently done
- estimated_time in minutes (5-60), be realistic
- "tool_action" field: choose one of "brainstorm" (use Brainstorm tool), "watchdog" (review trends/news), "weekly_plan" (plan the week), "calendar" (check calendar), or "none" (no specific tool)
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI"). Base the score on how directly the task advances the user's stated goals.
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if nothing is urgent enough for today
"""

_ANALYSIS_SYSTEM_PROMPT = """You are a LinkedIn content analyst. Based on the user's performance data, suggest up to {max_tasks} analysis tasks for TODAY only. The user needs to know how their LinkedIn content is performing.

The user prompt includes:
- Their LinkedIn goals and posting cadence
- A computed scorecard status (explicit: fresh_with_gaps, stale, or good)
- Topics already scheduled (computed from upcoming events, to avoid redundant analysis)
- Tasks already assigned today by other pillars

Rules:
- Titles must be under 60 characters, action-oriented, specific
- Descriptions under 200 characters — explain WHY this task matters today
- Task 1: if the scorecard status is "fresh_with_gaps", suggest reviewing it. Skip if stale or good — don't nag.
- Task 2 (medium priority, optional): suggest only if there are clear patterns in best/worst posts
- Include the actual score/metrics in the task title so the user sees value immediately
- Use the "Goal-specific instruction" field if provided — it maps each goal to its relevant analysis focus
- Avoid duplicating insights that upcoming calendar events already address
- estimated_time in minutes (5-60), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI").
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
"""

_CREATE_SYSTEM_PROMPT = """You are a LinkedIn content creator. Based on trending topics and content gaps, suggest exactly 1 content creation task for TODAY only.

The user prompt includes:
- Their LinkedIn goals and posting cadence
- Draft type distribution (format types in their drafts)
- A computed recommended underused format (explicitly which format to favour)
- Upcoming calendar events (content already scheduled)
- Tasks already assigned today by other pillars

Rules:
- MAX 1 task. Creation is high-effort; don't overwhelm.
- "high" priority if a trending topic directly matches the user's niche or goals
- "medium" priority if a content gap exists
- Suggest a specific format: post, article, carousel, or video script
- Include the exact topic/angle in the title
- Consider the user's posting cadence and goals when deciding urgency
- Favour the recommended underused format if one is provided — it is computed from actual draft counts
- Respect the "Topics already scheduled" exclusion list — don't create content for topics already on the calendar
- estimated_time in minutes (15-60), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI").
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if no topic is compelling enough
"""

_PUBLISH_SYSTEM_PROMPT = """You are a LinkedIn publishing coordinator. Check if the user has pending drafts or scheduled content for today.

The user prompt includes:
- Their LinkedIn goals and posting cadence
- Full draft list (title, created_at, post_type)
- A computed recommended draft for publication (the oldest pending draft)
- Calendar events due today
- Tasks already assigned today by other pillars

Rules:
- MAX 1 task
- "high" priority if content is due for publication today
- "medium" priority if drafts are waiting for review
- Use the recommended draft field if provided — it is the oldest (most time-sensitive) draft computed deterministically
- Mention the draft title and post type in the task so the user knows exactly what to publish
- Check if a publish task is already assigned by another pillar — skip if so
- Consider upcoming events — a draft that complements a scheduled event may be worth prioritizing
- estimated_time in minutes (5-30), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI").
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if nothing is pending
"""

_ENGAGEMENT_SYSTEM_PROMPT = """You are a LinkedIn engagement strategist. Based on identified opportunities, suggest 1-2 engagement tasks for TODAY only.

The user prompt includes:
- Their LinkedIn goals and posting cadence
- Upcoming events needing hype (computed: events within 2 days worth promoting)
- Tasks already assigned today by other pillars

Rules:
- MAX 2 tasks
- Task 1 (high priority): the best engagement opportunity found — include the person's name and why it matters
- Task 2 (medium priority): one strategic connection suggestion
- Priority: engaging with existing conversations > new connections
- Use the "Goal-specific instruction" field if provided — it maps each goal to the most relevant audience to engage with
- Consider the "Upcoming events needing hype" list if provided — these are events within 2 days that should be promoted via engagement
- Skip entirely if no opportunities found
- estimated_time in minutes (5-15), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI").
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if no opportunities exist
"""

_REMARKET_SYSTEM_PROMPT = """You are a LinkedIn content optimizer. Identify the best opportunity to repurpose or refresh existing content.

The user prompt includes:
- Top-performing posts pre-filtered to the ideal repurposing window (7-90 days old), with a computed age_days field
- Content-event topic matches (computed from keyword overlap with upcoming events)
- Tasks already assigned today by other pillars

Rules:
- MAX 1 task, and only if there's a clear winner to repurpose
- "medium" priority (never high — remarketing is not urgent)
- Suggest a specific format transformation (e.g., post→article, article→carousel, carousel→video script)
- Include why this particular post deserves a second life
- Use the age_days field to prioritise older posts — no need to parse dates
- Check the "Content-event topic matches" list if provided — these are deterministic keyword overlaps between top posts and upcoming events
- estimated_time in minutes (15-30), be realistic
- Assign each task an roi_score (0-100, where 100 = highest potential impact on LinkedIn growth) and an impact_label (one of: "High ROI", "Medium ROI", "Low ROI").
- Return ONLY a JSON object with a "tasks" key containing an array — no markdown, no explanation
- Return {{"tasks": []}} if no candidates are in the ideal repurposing window
"""


# ── Pillar generators ─────────────────────────────────────────────────────────

async def generate_plan_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Plan — direction/strategy from watchdog, ideas, gaps, trending."""
    watchdog = await fetch_watchdog_updates(user_id)
    ideas = await fetch_brainstorm_ideas(user_id)
    gaps = await fetch_content_gaps(user_id)
    trending = await fetch_trending_topics(user_id)

    recent_tasks, upcoming, goals, cadence, draft_types, persona, calendar_events = await asyncio.gather(
        fetch_recent_task_titles(user_id),
        fetch_upcoming_events(user_id),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
        fetch_persona(user_id),
        fetch_calendar_events(user_id, date),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_plan_context(watchdog, ideas, gaps, trending, persona, calendar_events, goals)
    exclusions = _format_topic_exclusions(upcoming)
    recent = _format_recent_tasks(recent_tasks)
    if exclusions:
        context += "\n\n" + exclusions
    if recent:
        context += "\n\n" + recent
    return await call_llm_for_tasks(
        user_id, context, MAX_TASKS_PER_PILLAR, "plan",
        system_prompt=_PLAN_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


async def generate_analysis_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Analysis — insight from brand score, posts, trends."""
    brand = await fetch_brand_scorecard(user_id)
    top_posts = await fetch_top_posts(user_id, 2)
    bottom_posts = await fetch_bottom_posts(user_id, 3)
    trends = await fetch_engagement_trends(user_id)

    upcoming, goals, cadence, draft_types = await asyncio.gather(
        fetch_upcoming_events(user_id),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_analysis_context(brand, top_posts, bottom_posts, trends)
    if not context.strip():
        return []
    exclusions = _format_topic_exclusions(upcoming)
    if exclusions:
        context += "\n\n" + exclusions
    goal_inst = _format_goal_instructions(goals, "analysis")
    if goal_inst:
        context += "\n\n" + goal_inst
    return await call_llm_for_tasks(
        user_id, context, MAX_TASKS_PER_PILLAR, "analysis",
        system_prompt=_ANALYSIS_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


async def generate_create_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Create — content production from trending + persona."""
    trending = await fetch_trending_topics(user_id, 3)
    gaps = await fetch_content_gaps(user_id, 3)
    persona = await fetch_persona(user_id)
    ideas = await fetch_brainstorm_ideas(user_id)

    if not trending and not gaps:
        if not ideas:
            return []
        trending = ideas[:3]

    upcoming, goals, cadence, draft_types = await asyncio.gather(
        fetch_upcoming_events(user_id),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_create_context(trending, gaps, persona)
    exclusions = _format_topic_exclusions(upcoming)
    if exclusions:
        context += "\n\n" + exclusions
    return await call_llm_for_tasks(
        user_id, context, 1, "create",
        system_prompt=_CREATE_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


async def generate_publish_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Publish — shipping from drafts + calendar."""
    drafts = await fetch_drafts(user_id)
    calendar_events = await fetch_calendar_events(user_id, date)

    if not drafts and not calendar_events:
        return []

    goals, cadence, draft_types = await asyncio.gather(
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_publish_context(drafts, calendar_events)
    return await call_llm_for_tasks(
        user_id, context, 1, "publish",
        system_prompt=_PUBLISH_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


async def generate_engagement_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Engagement — social interaction from opportunities + network.

    Data sources: engagement opportunities, network suggestions.
    MAX 2 tasks: 1 engage-with-post + 1 connect-with-person.
    """
    opportunities = await fetch_engagement_opportunities(user_id, 3)
    suggestions = await fetch_network_suggestions(user_id, 2)

    if not opportunities and not suggestions:
        return []

    upcoming, goals, cadence, draft_types = await asyncio.gather(
        fetch_upcoming_events(user_id),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_engagement_context(opportunities, suggestions)
    hype = _format_hype_opportunities(upcoming)
    if hype:
        context += "\n\n" + hype
    goal_inst = _format_goal_instructions(goals, "engagement")
    if goal_inst:
        context += "\n\n" + goal_inst
    return await call_llm_for_tasks(
        user_id, context, MAX_TASKS_PER_PILLAR, "engagement",
        system_prompt=_ENGAGEMENT_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


async def generate_remarket_tasks(
    user_id: str, date: str, cross_pillar_context: str = "",
) -> List[Dict[str, Any]]:
    """Remarket — repurpose/refresh from top posts + trends.

    Data sources: top-performing posts, engagement trends.
    MAX 1 task — repurposing is a nice-to-have, not urgent.
    """
    top_posts = await fetch_top_posts(user_id, 3)
    trends = await fetch_engagement_trends(user_id)

    if not top_posts:
        return []

    upcoming, goals, cadence, draft_types = await asyncio.gather(
        fetch_upcoming_events(user_id),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
    )
    common = build_common_context(goals, cadence, draft_types)
    context = build_remarket_context(top_posts, trends)
    overlaps = _format_topic_overlaps(top_posts, upcoming)
    if overlaps:
        context += "\n\n" + overlaps
    return await call_llm_for_tasks(
        user_id, context, 1, "remarket",
        system_prompt=_REMARKET_SYSTEM_PROMPT,
        common_context=common,
        cross_pillar_context=cross_pillar_context,
    )


# ── Batched all-pillar generator (single LLM call) ─────────────────────────────

# Reusable task item schema used inside each pillar array
_TASK_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "priority": {"type": "string"},
        "estimatedTime": {"type": "number"},
        "tool_action": {"type": "string", "enum": ["brainstorm", "watchdog", "weekly_plan", "calendar", "none"]},
        "roi_score": {"type": "number"},
        "impact_label": {"type": "string"},
    },
    "required": ["title"],
}

PILLAR_IDS = ["plan", "analysis", "create", "publish", "engagement", "remarket"]

BATCHED_TASK_SCHEMA = {
    "type": "object",
    "properties": {pid: {"type": "array", "items": _TASK_ITEM_SCHEMA} for pid in PILLAR_IDS},
    "required": PILLAR_IDS,
}

_BATCHED_SYSTEM_PROMPT = """You are a LinkedIn productivity strategist. You receive context data for 6 LinkedIn growth pillars. For each pillar that has relevant data, suggest up to {max_per_pillar} tasks. Return empty arrays for pillars with no actionable data or no relevant context.

## PILLAR 1 — PLAN (strategy & direction)
{plan_prompt}

## PILLAR 2 — ANALYSIS (performance review)
{analysis_prompt}

## PILLAR 3 — CREATE (content production)
{create_prompt}

## PILLAR 4 — PUBLISH (shipping content)
{publish_prompt}

## PILLAR 5 — ENGAGEMENT (social interaction)
{engagement_prompt}

## PILLAR 6 — REMARKET (repurpose content)
{remarket_prompt}

IMPORTANT: Return ONLY a JSON object with keys "plan", "analysis", "create", "publish", "engagement", "remarket". Each key maps to an array of task objects following the rules above. Return empty arrays ([]) for pillars with no relevant data. No markdown, no explanation."""


async def generate_all_tasks_batched(
    user_id: str, date: str,
) -> List[Dict[str, Any]]:
    """Fetch data for all 6 pillars and generate tasks in a single LLM call.

    Fetches all data sources in parallel, builds a combined prompt with
    per-pillar data sections and system instructions, then makes ONE
    LLM call instead of 6 sequential calls.
    """
    # ── Phase 1: fetch ALL data in parallel ──────────────────────────────
    set_generation_progress(user_id, date, "Fetching your profile and brainstorming ideas...")
    (
        watchdog, ideas, gaps, trending, brand, top_posts, bottom_posts,
        trends, persona, drafts, calendar_events, opportunities, suggestions,
        goals, cadence, draft_types, recent_tasks, upcoming,
    ) = await asyncio.gather(
        fetch_watchdog_updates(user_id),
        fetch_brainstorm_ideas(user_id),
        fetch_content_gaps(user_id),
        fetch_trending_topics(user_id),
        fetch_brand_scorecard(user_id),
        fetch_top_posts(user_id, 3),
        fetch_bottom_posts(user_id, 3),
        fetch_engagement_trends(user_id),
        fetch_persona(user_id),
        fetch_drafts(user_id),
        fetch_calendar_events(user_id, date),
        fetch_engagement_opportunities(user_id, 3),
        fetch_network_suggestions(user_id, 2),
        fetch_user_linkedin_goals(user_id),
        fetch_posting_cadence(user_id),
        fetch_draft_type_counts(user_id),
        fetch_recent_task_titles(user_id),
        fetch_upcoming_events(user_id),
    )

    common = build_common_context(goals, cadence, draft_types)
    set_generation_progress(user_id, date, "Analyzing content gaps and opportunities...")

    # ── Phase 2: build per-pillar context sections ───────────────────────

    # Plan pillar
    plan_ctx = build_plan_context(watchdog, ideas, gaps, trending, persona, calendar_events, goals)
    exclusions = _format_topic_exclusions(upcoming)
    recent = _format_recent_tasks(recent_tasks)
    if exclusions:
        plan_ctx += "\n\n" + exclusions
    if recent:
        plan_ctx += "\n\n" + recent

    # Analysis pillar
    analysis_ctx = build_analysis_context(brand, top_posts, bottom_posts, trends)
    if analysis_ctx.strip():
        a_exclusions = _format_topic_exclusions(upcoming)
        if a_exclusions:
            analysis_ctx += "\n\n" + a_exclusions
        goal_inst = _format_goal_instructions(goals, "analysis")
        if goal_inst:
            analysis_ctx += "\n\n" + goal_inst

    # Create pillar
    create_ctx = build_create_context(trending, gaps, persona)
    c_exclusions = _format_topic_exclusions(upcoming)
    if c_exclusions:
        create_ctx += "\n\n" + c_exclusions
    # Fallback for users without LinkedIn: use brainstorm ideas as topic source
    if not trending and not gaps and ideas:
        idea_titles = [i.get("title", "") for i in ideas[:3] if i.get("title")]
        if idea_titles:
            create_ctx += "\n\nBrainstorm topic ideas (use these as inspiration):\n" + json.dumps(idea_titles)

    # Publish pillar
    publish_ctx = build_publish_context(drafts, calendar_events)
    if not drafts and not calendar_events:
        publish_ctx = "No pending LinkedIn drafts or scheduled content for today."

    # Engagement pillar
    engagement_ctx = ""
    if opportunities or suggestions:
        engagement_ctx = build_engagement_context(opportunities, suggestions)
        hype = _format_hype_opportunities(upcoming)
        if hype:
            engagement_ctx += "\n\n" + hype
        e_goal = _format_goal_instructions(goals, "engagement")
        if e_goal:
            engagement_ctx += "\n\n" + e_goal

    # Remarket pillar
    remarket_ctx = ""
    if top_posts:
        remarket_ctx = build_remarket_context(top_posts, trends)
        overlaps = _format_topic_overlaps(top_posts, upcoming)
        if overlaps:
            remarket_ctx += "\n\n" + overlaps

    # ── Phase 3: build combined user prompt ─────────────────────────────
    user_prompt = common + "\n\n" if common else ""

    pillar_sections = [
        ("plan", "PLAN — Strategy & Direction", plan_ctx),
        ("analysis", "ANALYSIS — Performance Review", analysis_ctx),
        ("create", "CREATE — Content Production", create_ctx),
        ("publish", "PUBLISH — Shipping Content", publish_ctx),
        ("engagement", "ENGAGEMENT — Social Interaction", engagement_ctx),
        ("remarket", "REMARKET — Repurpose Content", remarket_ctx),
    ]

    for pid, label, ctx in pillar_sections:
        user_prompt += f"=== {label} ===\n"
        if ctx.strip():
            user_prompt += ctx.strip() + "\n\n"
        else:
            user_prompt += "(No data available for this pillar — skip it.)\n\n"

    # ── Phase 4: single LLM call ────────────────────────────────────────
    set_generation_progress(user_id, date, "Generating personalized tasks with AI...")
    system_prompt = _BATCHED_SYSTEM_PROMPT.format(
        max_per_pillar=MAX_TASKS_PER_PILLAR,
        plan_prompt=_PLAN_SYSTEM_PROMPT.format(max_tasks=MAX_TASKS_PER_PILLAR),
        analysis_prompt=_ANALYSIS_SYSTEM_PROMPT.format(max_tasks=MAX_TASKS_PER_PILLAR),
        create_prompt=_CREATE_SYSTEM_PROMPT.format(max_tasks=1),
        publish_prompt=_PUBLISH_SYSTEM_PROMPT.format(max_tasks=1),
        engagement_prompt=_ENGAGEMENT_SYSTEM_PROMPT.format(max_tasks=MAX_TASKS_PER_PILLAR),
        remarket_prompt=_REMARKET_SYSTEM_PROMPT.format(max_tasks=1),
    )

    try:
        raw = llm_text_gen(
            prompt=user_prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            temperature=0.3,
            max_tokens=4000,
            json_struct=BATCHED_TASK_SCHEMA,
            flow_type="linkedin_workflow_batched",
        )
        result = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        logger.exception("Batched workflow LLM call failed for user {}", user_id)
        return []

    if not isinstance(result, dict):
        return []

    set_generation_progress(user_id, date, "Finalizing your growth plan...")

    # ── Phase 5: flatten pillar-grouped results into task dicts ──────────
    all_tasks: List[Dict[str, Any]] = []
    for pid in PILLAR_PRIORITY_ORDER:
        tasks_list = result.get(pid, [])
        if not isinstance(tasks_list, list):
            continue
        for t in tasks_list:
            if not isinstance(t, dict) or not t.get("title"):
                continue
            t["pillarId"] = pid
            t["actionUrl"] = LINKEDIN_PILLAR_ACTION_URLS.get(pid)
            t["priority"] = (
                t.get("priority") if t.get("priority") in ("high", "medium", "low")
                else "medium"
            )
            t["estimatedTime"] = max(5, min(120, int(t.get("estimatedTime", 15))))
            t["status"] = "pending"
            tool_action = t.pop("tool_action", None)
            roi_score = t.pop("roi_score", None)
            impact_label = t.pop("impact_label", None)
            meta: Dict[str, Any] = {}
            if tool_action and tool_action in ("brainstorm", "watchdog", "weekly_plan", "calendar"):
                meta["tool_action"] = tool_action
            if roi_score is not None:
                try:
                    meta["roi_score"] = max(0, min(100, int(roi_score)))
                except (ValueError, TypeError):
                    pass
            if impact_label and impact_label.strip() in ("High ROI", "Medium ROI", "Low ROI"):
                meta["impact_label"] = impact_label.strip()
            if meta:
                t["metadata"] = meta
            all_tasks.append(t)

    # Cap at global max
    all_tasks = all_tasks[:GLOBAL_MAX_TASKS]
    return all_tasks
