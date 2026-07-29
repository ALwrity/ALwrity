from datetime import date
from typing import Any, Dict, List, Optional

from loguru import logger
from pydantic import BaseModel, Field

from models.content_asset_models import AssetSource
from models.linkedin_brainstorm_saved_ideas_db_models import BrainstormSavedIdeaDB
from services.content_asset_service import ContentAssetService
from services.database import get_session_for_user
from services.integrations.linkedin.profile_repository import ProfileRepository
from services.integrations.linkedin_oauth import LinkedInOAuthService
from services.linkedin.growth.consolidated_growth_service import ConsolidatedGrowthService
from services.linkedin.watchdog_service import watchdog_service


async def gather_personalization_data(
    user_id: str,
    *,
    include_trending: bool = False,
    remarket_content: bool = False,
    use_persona: bool = False,
) -> dict:
    """Collect available data respecting which data sources are enabled."""
    result: dict[str, Any] = {"has_data": False, "sources": [], "message": ""}

    # 1. Check LinkedIn connection (needed for trending + persona)
    connected = False
    if include_trending or use_persona:
        try:
            oauth = LinkedInOAuthService()
            status = oauth.get_connection_status(user_id)
            connected = status.get("connected", False)
            result["connected"] = connected
        except Exception as e:
            logger.warning(f"[Personalized] OAuth check failed: {e}")
            connected = False
            result["connected"] = False
    else:
        # Still check for remarket path — asset library doesn't need LinkedIn connection
        result["connected"] = False

    repo: Optional[ProfileRepository] = None

    if connected and (use_persona or include_trending):
        repo = ProfileRepository(oauth=LinkedInOAuthService())

    # 2. Profile intelligence (requires LinkedIn connection + use_persona flag)
    if connected and use_persona and repo:
        try:
            ctx = repo.get_profile_context(user_id)
            if ctx:
                professional = ctx.get("professional_information", {})
                personal = ctx.get("personal_information", {})
                result["profile"] = {
                    "name": personal.get("name", ""),
                    "headline": ctx.get("headline", ""),
                    "industry": professional.get("industry", ""),
                    "title": professional.get("title", ""),
                }
                result["sources"].append("profile_context")

            intel = repo.get_ai_profile_intelligence(user_id)
            if intel:
                result["profile_intelligence"] = {
                    "communication_style": intel.get("communication_style", ""),
                    "brand_positioning": intel.get("brand_positioning", ""),
                    "writing_opportunities": intel.get("writing_opportunities", []),
                    "summary": intel.get("summary", ""),
                }
                result["sources"].append("profile_intelligence")
        except Exception as e:
            logger.warning(f"[Personalized] profile/persona: {e}")

    # 3. Trending + watchdog (requires LinkedIn connection + include_trending)
    if connected and include_trending and repo:
        try:
            updates = watchdog_service.get_updates(user_id)
            if updates:
                result["watchdog"] = [
                    {"title": u.title, "category": u.category, "summary": getattr(u, "summary", "") or ""}
                    for u in updates[:5]
                ]
                result["sources"].append("watchdog")
        except Exception as e:
            logger.warning(f"[Personalized] watchdog: {e}")

        try:
            growth = ConsolidatedGrowthService()
            growth_data = await growth.analyze_all(user_id)
            if growth_data:
                gi: dict[str, Any] = {}
                topics = (growth_data.trending.trending_topics or [])[:3]
                if topics:
                    gi["trending"] = [{"topic": t.topic, "why_now": t.why_now} for t in topics]
                patterns = (growth_data.viral_analysis.patterns or [])[:2]
                if patterns:
                    gi["viral_patterns"] = [{"name": p.pattern_name, "description": p.description} for p in patterns]
                gaps = (growth_data.content_gaps.gaps or [])[:3]
                if gaps:
                    gi["content_gaps"] = [{"topic": g.gap_topic, "angle": g.suggested_angle} for g in gaps]
                if gi:
                    result["growth_insights"] = gi
                    result["sources"].append("growth_insights")
        except Exception as e:
            logger.warning(f"[Personalized] growth_insights: {e}")

    # 4. Remarket content (asset library — works with or without LinkedIn connection)
    if remarket_content:
        try:
            db = get_session_for_user(user_id)
            if db:
                try:
                    svc = ContentAssetService(db)
                    assets, total = svc.get_user_assets(
                        user_id, source_module=AssetSource.LINKEDIN_WRITER, limit=20,
                    )
                    if assets:
                        result["asset_library"] = []
                        for a in assets:
                            meta = a.asset_metadata or {}
                            result["asset_library"].append({
                                "title": a.title or "",
                                "type": a.asset_type.value if a.asset_type else "",
                                "content_type": meta.get("content_type", ""),
                                "word_count": meta.get("word_count", 0),
                            })
                        result["sources"].append("asset_library")
                finally:
                    db.close()
        except Exception as e:
            logger.warning(f"[Personalized] asset_library: {e}")

        try:
            db2 = get_session_for_user(user_id)
            if db2:
                try:
                    q = (
                        db2.query(BrainstormSavedIdeaDB)
                        .filter(BrainstormSavedIdeaDB.user_id == user_id)
                        .order_by(BrainstormSavedIdeaDB.created_at.desc())
                        .limit(10)
                    )
                    saved = q.all()
                    if saved:
                        result["saved_ideas"] = [
                            {"prompt": r.prompt, "rationale": r.rationale or ""}
                            for r in saved if r.prompt
                        ]
                        result["sources"].append("saved_ideas")
                finally:
                    db2.close()
        except Exception as e:
            logger.warning(f"[Personalized] saved_ideas: {e}")

    result["has_data"] = len(result.get("sources", [])) > 0
    if not result["has_data"]:
        checked = []
        if include_trending:
            checked.append("trending topics (needs LinkedIn)")
        if use_persona:
            checked.append("persona (needs LinkedIn)")
        if remarket_content:
            checked.append("remarket content")
        checked_str = ", ".join(checked) if checked else "no options enabled"
        if connected:
            result["message"] = (
                f"Checked: {checked_str}. LinkedIn connected but no profile data or growth "
                "insights found yet. Try again after engaging more on LinkedIn."
            )
        else:
            result["message"] = (
                f"Checked: {checked_str}. "
                "Connect LinkedIn for persona & trending, or toggle 'Remarket Content' "
                "after generating posts."
            )
    else:
        result["data_summary"] = "Sources used: " + ", ".join(result["sources"])

    return result


def format_personalized_prompt(data: dict, count: int, seed: str = "") -> str:
    """Build the LLM prompt from gathered data."""
    parts: list[str] = [f"TODAY'S DATE: {_PERSONALIZED_TODAY}"]

    if seed:
        parts.append(f"SEED TOPIC: {seed}")

    if data.get("connected") and data.get("profile"):
        p = data["profile"]
        parts.append(f"User profile: {p.get('name', 'N/A')} | {p.get('headline', 'N/A')} | {p.get('industry', 'N/A')}")

    if data.get("profile_intelligence"):
        pi = data["profile_intelligence"]
        parts.append(f"Style: {pi.get('communication_style', 'N/A')}")
        parts.append(f"Brand: {pi.get('brand_positioning', 'N/A')}")

    if data.get("growth_insights"):
        gi = data["growth_insights"]
        for t in gi.get("trending", []):
            parts.append(f"Trending: {t['topic']} — {t.get('why_now', '')}")
        for p in gi.get("viral_patterns", []):
            parts.append(f"Viral pattern: {p['name']} — {p.get('description', '')}")
        for g in gi.get("content_gaps", []):
            parts.append(f"Content gap: {g['topic']} — angle: {g.get('angle', '')}")

    if data.get("watchdog"):
        for w in data["watchdog"]:
            parts.append(f"[{w['category']}] {w['title']}: {w.get('summary', '')}")

    if data.get("asset_library"):
        for a in data["asset_library"]:
            parts.append(f"Past content: {a['title'] or '(untitled)'} ({a.get('content_type', a['type'])})")

    if data.get("saved_ideas"):
        for s in data["saved_ideas"]:
            parts.append(f"Saved idea: {s['prompt']}")

    source_hint = ", ".join(data.get("sources", [])) or "general knowledge"
    parts.append(f"""
Generate exactly {count} LinkedIn content angles in JSON.

Each angle must be a JSON object with these fields:
- title: short, specific headline (5-15 words, no markdown, no emojis)
- rationale: 1-2 sentences why this fits this specific user
- suggested_hook: sample opening sentence that grabs attention
- data_source: which source inspired this — one of: {source_hint}

Rules:
- Every title should sound like it could have been written by the user, not a generic template.
- Avoid: the importance of, how to master, why you should, unlocking.
- Use TODAY'S DATE to make angles timely.""")
    return "\n".join(parts)


_PERSONALIZED_TODAY = date.today().strftime("%B %d, %Y")

PERSONALIZED_SYSTEM_PROMPT = (
    "You are a LinkedIn content strategist who studies the user's existing writing style "
    "and generates new ideas that extend their voice — not generic viral templates. "
    "Every title should sound like it could have been written by the user. "
    "Avoid empty platitudes ('the importance of', 'how to master', 'why you should'). "
    "Instead use specific details, opinions, or frameworks the user would genuinely share. "
    f"Today's date is {_PERSONALIZED_TODAY}. Ensure all ideas feel current as of this date."
)

class PersonalizedIdeaOutputItem(BaseModel):
    title: str = Field(..., description="A concise headline for the content angle")
    rationale: str = Field(..., description="1-2 sentences explaining why this angle fits this specific user")
    suggested_hook: str = Field("", description="A sample opening sentence that could grab attention")
    data_source: str = Field(..., description="Which data source inspired this idea")


PERSONALIZED_JSON_STRUCT = {
    "type": "object",
    "properties": {
        "ideas": {
            "type": "array",
            "items": PersonalizedIdeaOutputItem.model_json_schema(),
        }
    },
}
