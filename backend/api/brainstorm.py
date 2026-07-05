"""
Brainstorming endpoints: search Exa for topic context and generate persona-aware
LinkedIn content ideas using the common LLM infrastructure (llm_text_gen).
"""
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from middleware.auth_middleware import get_current_user, get_optional_user
from models.linkedin_brainstorm_saved_ideas_db_models import BrainstormSavedIdeaDB
from services.brainstorm.personalized_service import (
    PERSONALIZED_JSON_STRUCT,
    PERSONALIZED_SYSTEM_PROMPT,
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
    prompt: str
    rationale: Optional[str] = None


class IdeasResponse(BaseModel):
    ideas: List[IdeaItem]


class PersonalizedIdeasRequest(BaseModel):
    count: int = Field(5, ge=3, le=10)
    seed: str = Field("", description="Optional seed to combine with personalization")
    include_trending: bool = False
    remarket_content: bool = False
    use_persona: bool = False


class PersonalizedIdeaItem(BaseModel):
    title: str
    rationale: str
    suggested_hook: Optional[str] = None
    data_source: str


class PersonalizedIdeasResponse(BaseModel):
    ideas: List[PersonalizedIdeaItem]
    data_summary: str = ""


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


# ── POST /ideas (Exa-based seed brainstorming) ────────────────────────


@router.post("/ideas", response_model=IdeasResponse)
async def generate_brainstorm_ideas(
    req: IdeasRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> IdeasResponse:
    """Search Exa for topic context and generate persona-aware brainstorm ideas."""
    try:
        user_id = _resolve_user_id(current_user)

        sources = await search_exa(req.seed)
        sources_block = "\n".join(
            [f"- {s['title']} | {s['url']} | {s['snippet']}" for s in sources[:5]]
        ) or "(no sources found)"

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

        sys_prompt = (
            "You are an enterprise-grade LinkedIn strategist. Generate specific, non-generic "
            "brainstorm prompts suitable for LinkedIn posts or carousels. Use the provided web "
            "sources to ground ideas and the persona to align tone and style."
        )

        prompt = f"""SEED IDEA: {req.seed}
{persona_block}{platform_block}
RECENT WEB SOURCES (top {len(sources[:5])}):
{sources_block}

TASK:
- Propose {req.count} LinkedIn-ready brainstorm prompts tailored to the persona and grounded in the sources.
- Each prompt should be specific and actionable.
- Prefer thought-leadership angles, contrarian takes with evidence, or practical playbooks.
- Avoid generic phrases like "latest trends" unless qualified by entities.

Return JSON with an array named ideas where each item has:
- prompt: the exact text the user can use to generate a post
- rationale: 1–2 sentence why this works for the audience/persona"""

        json_struct = {
            "type": "object",
            "properties": {
                "ideas": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "prompt": {"type": "string"},
                            "rationale": {"type": "string"},
                        },
                    },
                }
            },
        }

        result = llm_text_gen(
            prompt=prompt,
            system_prompt=sys_prompt,
            json_struct=json_struct,
            user_id=user_id,
            flow_type="brainstorm_ideas",
            temperature=0.7,
        )

        ideas: List[IdeaItem] = []
        if isinstance(result, dict) and isinstance(result.get("ideas"), list):
            for item in result["ideas"]:
                if isinstance(item, dict) and item.get("prompt"):
                    ideas.append(
                        IdeaItem(prompt=item["prompt"], rationale=item.get("rationale"))
                    )

        if not ideas:
            ideas = [
                IdeaItem(prompt=f"Explain why {req.seed} matters now with 2 recent stats", rationale="Timely and data-backed."),
                IdeaItem(prompt=f"Common pitfalls in {req.seed} and how to avoid them", rationale="Actionable and experience-based."),
                IdeaItem(prompt=f"A step-by-step playbook to implement {req.seed}", rationale="Practical value."),
                IdeaItem(prompt=f"Case study: measurable impact of {req.seed}", rationale="Story + ROI."),
                IdeaItem(prompt=f"Contrarian take: what most get wrong about {req.seed}", rationale="Thought leadership."),
            ]

        return IdeasResponse(ideas=ideas[: req.count])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating brainstorm ideas: {e}")
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
        data = await gather_personalization_data(
            user_id,
            include_trending=req.include_trending,
            remarket_content=req.remarket_content,
            use_persona=req.use_persona,
        )

        # Combine with Exa search if seed provided
        exa_sources: list[dict] = []
        if req.seed:
            exa_sources = await search_exa(req.seed)

        if not data.get("has_data") and not exa_sources:
            return PersonalizedIdeasResponse(ideas=[], data_summary=data.get("message", "No data available."))

        # Build prompt
        prompt = format_personalized_prompt(data, req.count, seed=req.seed)
        if exa_sources:
            exa_block = "\n".join(
                [f"- {s['title']} | {s['url']} | {s['snippet']}" for s in exa_sources[:5]]
            )
            prompt += f"\n\n## Web Sources (from seed topic)\n{exa_block}"

        result = llm_text_gen(
            prompt=prompt,
            system_prompt=PERSONALIZED_SYSTEM_PROMPT,
            json_struct=PERSONALIZED_JSON_STRUCT,
            user_id=user_id,
            flow_type="brainstorm_personalized",
            temperature=0.75,
        )

        ideas: List[PersonalizedIdeaItem] = []
        if isinstance(result, dict) and isinstance(result.get("ideas"), list):
            for item in result["ideas"]:
                if isinstance(item, dict) and item.get("title"):
                    ideas.append(
                        PersonalizedIdeaItem(
                            title=item["title"],
                            rationale=item.get("rationale", ""),
                            suggested_hook=item.get("suggested_hook"),
                            data_source=item.get("data_source", "profile"),
                        )
                    )

        if not ideas:
            summary = data.get("data_summary", "")
            msg = summary or "Could not generate ideas from available data."
            return PersonalizedIdeasResponse(ideas=[], data_summary=msg)

        return PersonalizedIdeasResponse(ideas=ideas[: req.count], data_summary=data.get("data_summary", ""))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating personalized ideas: {e}")
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
