"""
Brainstorming endpoints: search Exa for topic context and generate persona-aware
LinkedIn content ideas using the common LLM infrastructure (llm_text_gen).
"""
import json
import uuid
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from middleware.auth_middleware import get_current_user, get_optional_user
from models.linkedin_brainstorm_saved_ideas_db_models import BrainstormSavedIdeaDB
from services.brainstorm.personalized_service import (
    PERSONALIZED_JSON_STRUCT,
    PERSONALIZED_SYSTEM_PROMPT,
    PersonalizedIdeaOutputItem,
    format_personalized_prompt,
    gather_personalization_data,
)
from services.brainstorm.search_service import search_exa
from services.database import get_session_for_user
from services.llm_providers.main_text_generation import llm_text_gen

router = APIRouter(prefix="/api/brainstorm", tags=["Brainstorming"])


# ── Models ────────────────────────────────────────────────────────────


class PersonaPayload(BaseModel):
    persona_name: Optional[str] = None
    archetype: Optional[str] = None
    core_belief: Optional[str] = None
    tonal_range: Optional[Dict[str, Any]] = None
    linguistic_fingerprint: Optional[Dict[str, Any]] = None


class PlatformPersonaPayload(BaseModel):
    content_format_rules: Optional[Dict[str, Any]] = None
    engagement_patterns: Optional[Dict[str, Any]] = None
    content_types: Optional[Dict[str, Any]] = None
    tonal_range: Optional[Dict[str, Any]] = None


class IdeasRequest(BaseModel):
    seed: str = Field(..., description="Idea seed provided by end user")
    persona: Optional[PersonaPayload] = None
    platformPersona: Optional[PlatformPersonaPayload] = None
    count: int = Field(5, ge=3, le=10, description="Number of ideas to generate")


class IdeaItem(BaseModel):
    prompt: str = Field(..., description="Short, specific post topic headline (5–15 words, no markdown, no emojis)")
    rationale: Optional[str] = Field(None, description="1–2 sentence why this angle works for the audience")
    evidence: Optional[str] = Field(None, description="Source-backed data point, formatted as 'Source [N]: ...'")


class SourceInfo(BaseModel):
    title: str
    url: str
    snippet: str


class IdeasResponse(BaseModel):
    ideas: List[IdeaItem]
    sources: List[SourceInfo] = []


class PersonalizedIdeasRequest(BaseModel):
    count: int = Field(5, ge=3, le=10)
    seed: str = Field("", description="Optional seed to combine with personalization")
    include_trending: bool = False
    remarket_content: bool = False
    use_persona: bool = False


class PersonalizedIdeasResponse(BaseModel):
    ideas: List[PersonalizedIdeaOutputItem]
    data_summary: str = ""
    sources: List[SourceInfo] = []


# ── Helpers ───────────────────────────────────────────────────────────


def _resolve_user_id(current_user: Optional[Dict[str, Any]]) -> str:
    if not current_user:
        return "brainstorm_anonymous"
    return (
        current_user.get("id")
        or current_user.get("clerk_user_id")
        or current_user.get("user_id")
        or "brainstorm_anonymous"
    )


def _parse_llm_ideas(raw_response: Any, cls: type) -> list:
    """Parse LLM response into validated idea items.

    Handles dict (Gemini structured output), str (HuggingFace with optional
    markdown fences), and None/error responses — matching the robust pattern
    used in content_generator.py.

    Returns a list of validated Pydantic model instances (empty on failure).
    """
    if raw_response is None:
        logger.error("[Brainstorm] LLM returned None")
        return []

    if isinstance(raw_response, dict):
        if "error" in raw_response:
            logger.error(f"[Brainstorm] LLM returned error: {raw_response['error']}")
            return []
        parsed = raw_response
    else:
        cleaned = str(raw_response).strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"[Brainstorm] Failed to parse LLM response as JSON: {e}")
            return []

    items = parsed.get("ideas", [])
    if not isinstance(items, list):
        logger.error("[Brainstorm] LLM response 'ideas' is not a list")
        return []

    validated = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            validated.append(cls(**item))
        except Exception as e:
            logger.warning(f"[Brainstorm] Skipping invalid idea item: {e}")
            continue

    return validated


# ── POST /ideas (Exa-based seed brainstorming) ────────────────────────


@router.post("/ideas", response_model=IdeasResponse)
async def generate_brainstorm_ideas(
    req: IdeasRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> IdeasResponse:
    """Search Exa for topic context and generate persona-aware brainstorm ideas."""
    try:
        user_id = _resolve_user_id(current_user)
        logger.info(f"[Brainstorm] /ideas request — seed={req.seed!r}, count={req.count}, persona={req.persona.persona_name if req.persona else None}")

        sources, content = await search_exa(req.seed)
        logger.info(f"[Brainstorm] Exa returned {len(sources)} source(s)")
        sources_block = content or "(no web sources found)"

        persona_block = ""
        if req.persona:
            parts = []
            if req.persona.persona_name:
                parts.append(req.persona.persona_name)
            if req.persona.archetype:
                parts.append(f"({req.persona.archetype})")
            persona_block = "Persona: " + " ".join(parts) + "\n"

        platform_block = ""
        if req.platformPersona and req.platformPersona.content_format_rules:
            limit = req.platformPersona.content_format_rules.get("character_limit")
            platform_block = f"LinkedIn character limit: {limit}" if limit else ""

        today_str = date.today().strftime("%B %d, %Y")
        sys_prompt = (
            "You are an enterprise-grade LinkedIn strategist who proposes specific, non-generic "
            "content angles that executives can immediately use as post topics. "
            "You ground every angle in real evidence from the provided web sources. "
            "You never use markdown, emojis, or bullet points in the topic headline. "
            "You prefer thought-leadership, contrarian takes backed by data, and practical playbooks. "
            f"Today's date is {today_str}. Every angle must feel current as of this date."
        )

        prompt = f"""TODAY'S DATE: {today_str}

SEED IDEA: {req.seed}
{persona_block}{platform_block}
RECENT WEB SOURCES (numbered list):
{sources_block}

Generate exactly {req.count} LinkedIn post angles in JSON.

Each angle must be a JSON object with these fields:
- prompt: short, specific headline (5-15 words, no markdown, no emojis, no bullets)
- rationale: 1-2 sentences explaining why this resonates now
- evidence: specific finding from a source above formatted as "Source [N]: <data point>", or null if none

Rules:
- Avoid: latest trends, the future of, why you should, mastering, unlocking.
- Prefer: contrarian with evidence, how-to with steps, or opinion with data.
- Every angle must feel specific to {req.seed}, not generic."""

        result = llm_text_gen(
            prompt=prompt,
            system_prompt=sys_prompt,
            json_struct={
                "type": "object",
                "properties": {
                    "ideas": {
                        "type": "array",
                        "items": IdeaItem.model_json_schema(),
                    }
                },
            },
            user_id=user_id,
            flow_type="brainstorm_ideas",
            temperature=0.7,
            max_tokens=3072,
        )

        ideas = _parse_llm_ideas(result, IdeaItem)
        logger.info(f"[Brainstorm] LLM returned type={type(result).__name__}, parsed {len(ideas)} idea(s)")

        if not ideas:
            logger.warning(f"[Brainstorm] No ideas parsed from LLM response (type={type(result).__name__})")
            raise HTTPException(
                status_code=502,
                detail="The AI model failed to generate brainstorm ideas. Please try again or rephrase your topic.",
            )

        return IdeasResponse(
            ideas=ideas[: req.count],
            sources=[SourceInfo(title=s["title"], url=s["url"], snippet=s["snippet"]) for s in sources[:5]],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Brainstorm] Error generating brainstorm ideas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /personalized-ideas (data-driven, with optional seed) ────────


@router.post("/personalized-ideas", response_model=PersonalizedIdeasResponse)
async def generate_personalized_ideas(
    req: PersonalizedIdeasRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> PersonalizedIdeasResponse:
    """Generate brainstorm ideas from the user's own data + optional seed.

    When `include_trending` is on and LinkedIn is connected: includes watchdog
    industry updates and consolidated growth insights (trending, viral patterns,
    content gaps).

    When `remarket_content` is on: includes asset library (previously generated
    LinkedIn content) and saved brainstorm ideas.

    When `use_persona` is on and LinkedIn is connected: includes profile context
    and profile intelligence (communication style, brand positioning).

    When `seed` is provided: combines Exa web search with personalization data.
    """
    try:
        user_id = _resolve_user_id(current_user)
        if user_id == "brainstorm_anonymous":
            return PersonalizedIdeasResponse(ideas=[], data_summary="Sign in to get personalized ideas from your data.")

        # Check if at least one option is enabled
        if not (req.include_trending or req.remarket_content or req.use_persona) and not req.seed:
            return PersonalizedIdeasResponse(
                ideas=[],
                data_summary="No options selected and no seed topic provided. Toggle at least one data source below or enter a topic to brainstorm.",
            )

        # Gather personalization data
        logger.info(f"[Brainstorm] /personalized-ideas request — seed={req.seed!r}, count={req.count}, "
                     f"trending={req.include_trending}, remarket={req.remarket_content}, persona={req.use_persona}")
        data = await gather_personalization_data(
            user_id,
            include_trending=req.include_trending,
            remarket_content=req.remarket_content,
            use_persona=req.use_persona,
        )
        logger.info(f"[Brainstorm] Personalization data has_data={data.get('has_data')}, "
                     f"keys={list(data.keys())}")

        # Combine with Exa search if seed provided
        exa_sources: list[dict] = []
        exa_content = ""
        if req.seed:
            exa_sources, exa_content = await search_exa(req.seed)
            logger.info(f"[Brainstorm] Exa returned {len(exa_sources)} source(s)")

        if not data.get("has_data") and not exa_sources:
            logger.warning(f"[Brainstorm] No data or sources — returning empty")
            return PersonalizedIdeasResponse(ideas=[], data_summary=data.get("message", "No data available."))

        # Build prompt
        prompt = format_personalized_prompt(data, req.count, seed=req.seed)
        if exa_content:
            prompt += f"\n\n## Web Sources (from seed topic)\n{exa_content}"

        result = llm_text_gen(
            prompt=prompt,
            system_prompt=PERSONALIZED_SYSTEM_PROMPT,
            json_struct=PERSONALIZED_JSON_STRUCT,
            user_id=user_id,
            flow_type="brainstorm_personalized",
            temperature=0.75,
            max_tokens=3072,
        )

        ideas = _parse_llm_ideas(result, PersonalizedIdeaOutputItem)
        logger.info(f"[Brainstorm] Personalize LLM returned type={type(result).__name__}, parsed {len(ideas)} idea(s)")

        if not ideas:
            summary = data.get("data_summary", "")
            msg = summary or "Could not generate ideas from available data."
            logger.warning(f"[Brainstorm] No personalized ideas — summary={summary!r}")
            return PersonalizedIdeasResponse(ideas=[], data_summary=msg)

        return PersonalizedIdeasResponse(
            ideas=ideas[: req.count],
            data_summary=data.get("data_summary", ""),
            sources=[SourceInfo(title=s["title"], url=s["url"], snippet=s["snippet"]) for s in exa_sources[:5]],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Brainstorm] Error generating personalized ideas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Saved ideas CRUD ──────────────────────────────────────────────────


class SavedIdeaCreate(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    rationale: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[str] = Field(default="", max_length=512)
    source_seed: Optional[str] = Field(default=None, max_length=2000)


class SavedIdeaUpdate(BaseModel):
    prompt: Optional[str] = Field(default=None, min_length=1, max_length=4000)
    rationale: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[str] = Field(default=None, max_length=512)


class SavedIdeaResponse(BaseModel):
    id: str
    prompt: str
    rationale: Optional[str] = None
    tags: Optional[str] = ""
    source_seed: Optional[str] = None
    created_at: str
    updated_at: str


class SavedIdeasListResponse(BaseModel):
    ideas: List[SavedIdeaResponse]
    total: int


def _resolve_user_id_strict(current_user: Dict[str, Any]) -> str:
    return (
        current_user.get("id")
        or current_user.get("clerk_user_id")
        or current_user.get("user_id")
        or "default"
    )


def _idea_to_response(row: BrainstormSavedIdeaDB) -> SavedIdeaResponse:
    return SavedIdeaResponse(
        id=row.id,
        prompt=row.prompt,
        rationale=row.rationale,
        tags=row.tags or "",
        source_seed=row.source_seed,
        created_at=row.created_at.isoformat() if row.created_at else "",
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )


@router.get("/saved-ideas", response_model=SavedIdeasListResponse)
async def list_saved_ideas(
    current_user: Dict[str, Any] = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    user_id = _resolve_user_id_strict(current_user)
    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        q = (
            db.query(BrainstormSavedIdeaDB)
            .filter(BrainstormSavedIdeaDB.user_id == user_id)
            .order_by(BrainstormSavedIdeaDB.created_at.desc())
        )
        total = q.count()
        rows = q.offset(max(0, offset)).limit(max(1, min(100, limit))).all()
        return SavedIdeasListResponse(
            ideas=[_idea_to_response(r) for r in rows],
            total=total,
        )
    except Exception as e:
        logger.error(f"Error listing saved ideas for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.post("/saved-ideas", response_model=SavedIdeaResponse, status_code=201)
async def create_saved_idea(
    req: SavedIdeaCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id_strict(current_user)
    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        row = BrainstormSavedIdeaDB(
            id=f"idea_{uuid.uuid4().hex[:24]}",
            user_id=user_id,
            prompt=req.prompt.strip(),
            rationale=(req.rationale or "").strip() or None,
            tags=(req.tags or "").strip(),
            source_seed=(req.source_seed or "").strip() or None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info(f"[Brainstorm] user {user_id} saved idea {row.id} (prompt_len={len(row.prompt)})")
        return _idea_to_response(row)
    except Exception as e:
        logger.error(f"Error creating saved idea for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.patch("/saved-ideas/{idea_id}", response_model=SavedIdeaResponse)
async def update_saved_idea(
    idea_id: str,
    req: SavedIdeaUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id_strict(current_user)
    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        row = (
            db.query(BrainstormSavedIdeaDB)
            .filter(BrainstormSavedIdeaDB.id == idea_id, BrainstormSavedIdeaDB.user_id == user_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Saved idea not found")
        if req.prompt is not None:
            row.prompt = req.prompt.strip()
        if req.rationale is not None:
            row.rationale = req.rationale.strip() or None
        if req.tags is not None:
            row.tags = req.tags.strip()
        db.commit()
        db.refresh(row)
        return _idea_to_response(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating saved idea {idea_id} for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.delete("/saved-ideas/{idea_id}", status_code=204)
async def delete_saved_idea(
    idea_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user_id = _resolve_user_id_strict(current_user)
    db = get_session_for_user(user_id)
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        row = (
            db.query(BrainstormSavedIdeaDB)
            .filter(BrainstormSavedIdeaDB.id == idea_id, BrainstormSavedIdeaDB.user_id == user_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="Saved idea not found")
        db.delete(row)
        db.commit()
        logger.info(f"[Brainstorm] user {user_id} deleted idea {idea_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting saved idea {idea_id} for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
