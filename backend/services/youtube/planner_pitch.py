"""YouTube pitch generate / expand (Issue #434 Phase 2).

Does not change llm_providers. Existing generate_plan is unchanged.
"""

from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

from fastapi import HTTPException

from services.llm_providers.json_parsing import robust_json_loads
from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.planner_config import (
    VIDEO_TYPE_CONFIGS,
    ContentLanguageResolution,
    get_duration_context,
    resolve_content_language,
)
from services.youtube.planner_generation import attach_plan_generation_metadata
from services.youtube.planner_pitch_prompts import (
    EXPANSION_SYSTEM_PROMPT,
    PITCH_SYSTEM_PROMPT,
    build_expansion_json_struct,
    build_expansion_user_prompt,
    build_pitch_json_struct,
    build_pitch_user_prompt,
)
from services.youtube.planner_pitch_validate import (
    PitchValidationError,
    assemble_full_script,
    validate_expansion,
    validate_pitch,
)
from utils.logger_utils import get_service_logger

if TYPE_CHECKING:
    from services.youtube.planner import YouTubePlannerService

logger = get_service_logger("youtube.planner_pitch")


def _resolved_content_language(
    language: Optional[str],
    *,
    operation: str,
) -> ContentLanguageResolution:
    """Resolve once per pitch/expand call. Logs code/label only."""
    try:
        resolved = resolve_content_language(language)
    except Exception:
        logger.exception(
            "[YouTubePlanner] Content language resolve failed on {}; using English",
            operation,
        )
        resolved = ContentLanguageResolution(
            code="en",
            label="English",
            requested="",
            used_fallback=True,
        )
    logger.info(
        "[YouTubePlanner] {} language={} code={} fallback={}",
        operation,
        resolved.label,
        resolved.code,
        resolved.used_fallback,
    )
    return resolved


def _unwrap_provider_payload(response: Any) -> Any:
    """WaveSpeed returns {error, raw_response} when json_struct parse fails."""
    if not isinstance(response, dict):
        return response
    if (
        response.get("error")
        and "raw_response" in response
        and "selected_title" not in response
        and "hook" not in response
    ):
        logger.warning(
            "[YouTubePlanner] Provider JSON wrapper error={}; raw_len={}",
            response.get("error"),
            len(str(response.get("raw_response") or "")),
        )
        return response.get("raw_response")
    return response


def _parse_llm_json(response: Any, *, label: str) -> Dict[str, Any]:
    payload = _unwrap_provider_payload(response)
    if isinstance(payload, dict):
        if payload.get("error") and "selected_title" not in payload and "hook" not in payload:
            raise PitchValidationError(f"{label} LLM response was empty or invalid JSON.")
        return payload
    if not isinstance(payload, str) or not payload.strip():
        raise PitchValidationError(f"{label} LLM response was empty.")
    try:
        parsed = robust_json_loads(payload)
    except json.JSONDecodeError as exc:
        logger.error("[YouTubePlanner] Failed to parse {} JSON: {}", label, exc)
        raise PitchValidationError(f"Failed to parse {label} response as JSON.") from exc
    if not isinstance(parsed, dict):
        raise PitchValidationError(f"{label} JSON must be an object.")
    return parsed


def _estimate_tokens(text: str) -> int:
    """Rough char/4 estimate. Never log the source text."""
    return max(1, len(text or "") // 4)


def _call_llm_once(
    *,
    prompt: str,
    system_prompt: str,
    json_struct: Dict[str, Any],
    flow_type: str,
    user_id: Optional[str],
) -> Any:
    prompt_token_est = _estimate_tokens(prompt) + _estimate_tokens(system_prompt)
    started = time.perf_counter()
    logger.info(
        "[YouTubePlanner] LLM start flow_type={} prompt_token_est={}",
        flow_type,
        prompt_token_est,
    )
    try:
        response = llm_text_gen(
            prompt=prompt,
            system_prompt=system_prompt,
            user_id=user_id,
            json_struct=json_struct,
            flow_type=flow_type,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        if isinstance(response, dict):
            output_len = len(json.dumps(response, default=str))
        else:
            output_len = len(str(response or ""))
        logger.info(
            "[YouTubePlanner] LLM complete flow_type={} duration_ms={} "
            "prompt_token_est={} output_token_est={}",
            flow_type,
            elapsed_ms,
            prompt_token_est,
            max(1, output_len // 4),
        )
        return response
    except Exception:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.exception(
            "[YouTubePlanner] LLM failed flow_type={} duration_ms={}",
            flow_type,
            elapsed_ms,
        )
        raise


def _generate_with_one_retry(
    *,
    label: str,
    call_llm: Callable[[], Any],
    parse_and_validate: Callable[[Any], Dict[str, Any]],
) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in (1, 2):
        try:
            raw = call_llm()
            result = parse_and_validate(raw)
            logger.info("[YouTubePlanner] {} succeeded on attempt={}", label, attempt)
            return result
        except PitchValidationError as exc:
            last_error = exc
            logger.warning(
                "[YouTubePlanner] {} validation failed attempt={} err={}",
                label,
                attempt,
                exc,
            )
        except HTTPException:
            raise
        except Exception as exc:
            last_error = exc
            logger.exception(
                "[YouTubePlanner] {} LLM call failed attempt={}",
                label,
                attempt,
            )
    message = str(last_error) if last_error else f"Failed to generate {label}."
    raise PitchValidationError(message)


async def _optional_research(
    planner: "YouTubePlannerService",
    *,
    user_idea: str,
    video_type: Optional[str],
    target_audience: str,
    user_id: Optional[str],
    enable_research: bool,
    language: Optional[str] = None,
) -> tuple[str, List[Dict[str, Any]], bool]:
    if not enable_research:
        logger.info("[YouTubePlanner] Research disabled for pitch/expand")
        return "", [], False

    logger.info("[YouTubePlanner] Starting Exa research for pitch/expand")
    try:
        context, sources = await planner._perform_exa_research(
            user_idea=user_idea,
            video_type=video_type,
            target_audience=target_audience,
            user_id=user_id or "",
            language=language,
        )
        logger.info(
            "[YouTubePlanner] Research complete source_count={} context_len={}",
            len(sources or []),
            len(context or ""),
        )
        return context or "", sources or [], True
    except HTTPException as http_ex:
        logger.warning(
            "[YouTubePlanner] Research skipped (http={}); continuing without it",
            http_ex.status_code,
        )
        return "", [], True
    except Exception as exc:
        logger.warning("[YouTubePlanner] Research failed (non-critical): {}", exc)
        return "", [], True


async def generate_youtube_pitch(
    planner: "YouTubePlannerService",
    *,
    user_idea: str,
    duration_type: str,
    creative_angle: str,
    video_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    persona_data: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    enable_research: bool = True,
    source_article_title: Optional[str] = None,
    source_article_summary: Optional[str] = None,
    channel_bible_context: str = "",
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate one lightweight pitch. flow_type=youtube_pitch (same llm_text_gen path as generate_plan)."""
    idea = (user_idea or "").strip()
    angle = (creative_angle or "").strip()
    if not idea:
        raise HTTPException(status_code=400, detail="Please enter your video idea.")
    if not angle:
        raise HTTPException(
            status_code=400,
            detail="Please select or enter a creative strategy angle.",
        )

    resolved_language = _resolved_content_language(language, operation="generate_pitch")
    logger.info(
        "[YouTubePlanner] generate_pitch entry duration={} angle_len={} idea_len={} language={}",
        duration_type,
        len(angle),
        len(idea),
        resolved_language.label,
    )

    duration_context = planner._get_duration_context(duration_type)
    video_type_config = VIDEO_TYPE_CONFIGS.get(video_type or "", {})
    default_audience = target_audience or (
        f"Viewers interested in {video_type} content" if video_type else "General YouTube audience"
    )
    persona_context = planner._build_persona_context(persona_data)
    research_context, research_sources, research_enabled = await _optional_research(
        planner,
        user_idea=idea,
        video_type=video_type,
        target_audience=default_audience,
        user_id=user_id,
        enable_research=enable_research,
        language=resolved_language.code,
    )

    try:
        user_prompt = build_pitch_user_prompt(
            user_idea=idea,
            creative_angle=angle,
            duration_type=duration_type,
            video_type=video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            persona_context=persona_context,
            channel_bible_context=channel_bible_context or "",
            research_context=research_context,
            source_article_title=source_article_title,
            source_article_summary=source_article_summary,
            language=resolved_language.code,
        )
    except Exception:
        logger.exception(
            "[YouTubePlanner] Failed to build pitch user prompt language={}",
            resolved_language.code,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to prepare the pitch prompt. Please try again.",
        )
    json_struct = build_pitch_json_struct()

    def _parse_and_validate(raw: Any) -> Dict[str, Any]:
        parsed = _parse_llm_json(raw, label="pitch")
        return validate_pitch(parsed, creative_angle=angle, duration_type=duration_type)

    pitch = _generate_with_one_retry(
        label="pitch",
        call_llm=lambda: _call_llm_once(
            prompt=user_prompt,
            system_prompt=PITCH_SYSTEM_PROMPT,
            json_struct=json_struct,
            flow_type="youtube_pitch",
            user_id=user_id,
        ),
        parse_and_validate=_parse_and_validate,
    )

    pitch["duration_type"] = duration_type
    pitch["duration_metadata"] = duration_context
    pitch["research_enabled"] = research_enabled
    pitch["research_sources"] = research_sources
    pitch["research_sources_count"] = len(research_sources)
    pitch["research_prompt_block"] = research_context
    if video_type_config:
        pitch["video_type"] = video_type

    try:
        pitch = attach_plan_generation_metadata(
            pitch,
            system_prompt=PITCH_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            research_enabled=research_enabled,
            research_context=research_context,
        )
    except Exception as meta_err:
        logger.exception(
            "[YouTubePlanner] Pitch metadata attach failed; returning pitch without it. err={}",
            meta_err,
        )

    logger.info(
        "[YouTubePlanner] Pitch generated successfully language={} code={}",
        resolved_language.label,
        resolved_language.code,
    )
    return pitch


async def expand_pitch_to_script(
    planner: "YouTubePlannerService",
    *,
    user_idea: str,
    duration_type: str,
    approved_pitch: Dict[str, Any],
    video_type: Optional[str] = None,
    target_audience: Optional[str] = None,
    video_goal: Optional[str] = None,
    brand_style: Optional[str] = None,
    persona_data: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    enable_research: bool = True,
    channel_bible_context: str = "",
    language: Optional[str] = None,
) -> Dict[str, Any]:
    """Expand an approved pitch. flow_type=youtube_script_expand (same llm_text_gen path as generate_plan)."""
    idea = (user_idea or "").strip()
    if not idea:
        raise HTTPException(status_code=400, detail="Please enter your video idea.")
    if not isinstance(approved_pitch, dict) or not str(
        approved_pitch.get("selected_title") or ""
    ).strip():
        raise HTTPException(status_code=400, detail="An approved pitch is required to expand.")

    resolved_language = _resolved_content_language(
        language, operation="expand_pitch_to_script"
    )
    logger.info(
        "[YouTubePlanner] expand_pitch_to_script entry duration={} title_len={} language={}",
        duration_type,
        len(str(approved_pitch.get("selected_title") or "")),
        resolved_language.label,
    )

    persona_context = planner._build_persona_context(persona_data)
    default_audience = target_audience or "General YouTube audience"
    reused_block = str(approved_pitch.get("research_prompt_block") or "").strip()
    if reused_block:
        reused_sources = approved_pitch.get("research_sources")
        research_context = reused_block
        research_sources = reused_sources if isinstance(reused_sources, list) else []
        research_enabled = True
        logger.info(
            "[YouTubePlanner] Expand reusing pitch research_prompt_block len={} source_count={} skip_exa=True",
            len(research_context),
            len(research_sources),
        )
    else:
        if enable_research:
            logger.info(
                "[YouTubePlanner] Expand missing research_prompt_block; running one compact Exa pass"
            )
        research_context, research_sources, research_enabled = await _optional_research(
            planner,
            user_idea=idea,
            video_type=video_type,
            target_audience=default_audience,
            user_id=user_id,
            enable_research=enable_research,
            language=resolved_language.code,
        )

    try:
        user_prompt = build_expansion_user_prompt(
            user_idea=idea,
            approved_pitch=approved_pitch,
            duration_type=duration_type,
            video_type=video_type,
            target_audience=target_audience,
            video_goal=video_goal,
            brand_style=brand_style,
            persona_context=persona_context,
            channel_bible_context=channel_bible_context or "",
            research_context=research_context,
            language=resolved_language.code,
        )
    except Exception:
        logger.exception(
            "[YouTubePlanner] Failed to build expansion user prompt language={}",
            resolved_language.code,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to prepare the script prompt. Please try again.",
        )
    json_struct = build_expansion_json_struct()

    def _parse_and_validate(raw: Any) -> Dict[str, Any]:
        return validate_expansion(
            _parse_llm_json(raw, label="expansion"),
            duration_type=duration_type,
        )

    expansion = _generate_with_one_retry(
        label="expansion",
        call_llm=lambda: _call_llm_once(
            prompt=user_prompt,
            system_prompt=EXPANSION_SYSTEM_PROMPT,
            json_struct=json_struct,
            flow_type="youtube_script_expand",
            user_id=user_id,
        ),
        parse_and_validate=_parse_and_validate,
    )

    expansion["full_script"] = assemble_full_script(expansion)
    expansion["duration_type"] = duration_type
    expansion["duration_metadata"] = get_duration_context(duration_type)
    expansion["research_enabled"] = research_enabled
    expansion["research_sources"] = research_sources
    expansion["research_sources_count"] = len(research_sources)
    expansion["approved_title"] = approved_pitch.get("selected_title")

    try:
        expansion = attach_plan_generation_metadata(
            expansion,
            system_prompt=EXPANSION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            research_enabled=research_enabled,
            research_context=research_context,
        )
    except Exception as meta_err:
        logger.exception(
            "[YouTubePlanner] Expansion metadata attach failed; returning script without it. err={}",
            meta_err,
        )

    logger.info(
        "[YouTubePlanner] Pitch expanded ok language={} spoken_words={} beats={}",
        resolved_language.label,
        len(str(expansion.get("full_script") or "").split()),
        len(expansion.get("main_content_outline") or []),
    )
    return expansion
