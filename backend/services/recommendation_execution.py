"""Adapters from Today recommendations to existing marketing services."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional


def _dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return value


def _persist_text_artifact(
    db: Any,
    user_id: str,
    content: Optional[str],
    source_module: str,
    title: str,
    tags: list[str],
    asset_metadata: Optional[Dict[str, Any]] = None,
) -> Optional[int]:
    if not db or not isinstance(content, str) or not content.strip():
        return None
    try:
        from utils.text_asset_tracker import save_and_track_text_content

        return save_and_track_text_content(
            db=db,
            user_id=user_id,
            content=content,
            source_module=source_module,
            title=title[:255],
            description="Generated from an approved Today workflow recommendation.",
            tags=tags,
            asset_metadata={
                "source": "today_workflow_recommendation",
                "quality_decision": "pending",
                **(asset_metadata or {}),
            },
            subdirectory="recommendations",
            file_extension=".md",
        )
    except Exception:
        return None


def _lineage_metadata(params: Dict[str, Any], content_type: str, platform: str) -> Dict[str, Any]:
    return {
        "task_id": params.get("task_id"),
        "recommendation_id": params.get("recommendation_id"),
        "source_agent": params.get("source_agent"),
        "content_type": content_type,
        "platform": platform,
        "prompt_version": params.get("prompt_version") or "recommendation-adapter-v1",
    }


def _generation_success(response_success: bool, content: Optional[str], db: Any, asset_id: Optional[int]) -> bool:
    if not response_success or not content:
        return False
    return not db or asset_id is not None


async def _repurpose_content(
    params: Dict[str, Any],
    context: Dict[str, Any],
    user_id: str,
    db: Any,
    topic: str,
) -> Dict[str, Any]:
    """Generate real drafts for supported platforms without publishing them."""
    original = params.get("original_content")
    if isinstance(original, dict):
        original_text = str(original.get("content") or original.get("text") or "").strip()
        topic = str(original.get("title") or original.get("topic") or topic).strip()
    else:
        original_text = str(original or params.get("content") or "").strip()
    if not original_text:
        return {
            "success": False,
            "artifact_type": "content_repurposing",
            "error": "Content repurposing requires original_content or content",
            "artifacts": [],
        }

    audience = str(params.get("target_audience") or context.get("target_audience") or "").strip() or None
    industry = str(params.get("industry") or context.get("industry") or "General business").strip()
    platforms = [str(platform).strip().lower() for platform in params.get("target_platforms", []) if str(platform).strip()]
    artifacts = []
    for platform in platforms:
        if platform == "linkedin":
            from models.linkedin_models import LinkedInPostRequest
            from services.linkedin_service import LinkedInService

            response = await LinkedInService().generate_linkedin_post(
                LinkedInPostRequest(
                    topic=topic[:200] or "Repurposed content",
                    industry=industry[:100] or "General business",
                    target_audience=audience,
                    reference_context=original_text[:8000],
                ),
                user_id=user_id,
            )
            response_data = getattr(response, "data", None)
            content = getattr(response_data, "content", None) if response_data else None
            asset_id = _persist_text_artifact(
                db,
                user_id,
                content,
                "today_workflow_linkedin",
                topic,
                ["linkedin", "repurposed", "recommendation"],
                _lineage_metadata(params, "linkedin_post", platform),
            )
            artifacts.append({
                "platform": platform,
                "success": _generation_success(getattr(response, "success", True), content, db, asset_id),
                "content": content,
                "asset_id": asset_id,
                "result": _dump(response),
            })
        elif platform == "facebook":
            from api.facebook_writer.models.post_models import FacebookPostRequest, PostGoal, PostTone
            from api.facebook_writer.services.post_service import FacebookPostService

            response = await asyncio.to_thread(
                FacebookPostService().generate_post,
                FacebookPostRequest(
                    business_type=industry[:200] or "business",
                    target_audience=audience or "the target audience",
                    post_goal=PostGoal.SHARE_CONTENT,
                    post_tone=PostTone.PROFESSIONAL,
                    include=original_text[:4000],
                ),
                user_id,
            )
            content = getattr(response, "content", None)
            asset_id = _persist_text_artifact(
                db,
                user_id,
                content,
                "today_workflow_social",
                topic,
                ["facebook", "repurposed", "recommendation"],
                _lineage_metadata(params, "facebook_post", platform),
            )
            artifacts.append({
                "platform": platform,
                "success": _generation_success(getattr(response, "success", True), content, db, asset_id),
                "content": content,
                "asset_id": asset_id,
                "result": _dump(response),
            })
        else:
            artifacts.append({
                "platform": platform,
                "success": False,
                "error": f"Content repurposing is not supported for platform '{platform}'",
            })

    return {
        "success": bool(artifacts) and all(item.get("success") for item in artifacts),
        "artifact_type": "content_repurposing",
        "artifacts": artifacts,
        "content": next((item.get("content") for item in artifacts if item.get("content")), None),
    }


async def execute_supported_recommendation(
    action_type: str,
    parameters: Dict[str, Any],
    user_id: str,
    db: Any = None,
) -> Optional[Dict[str, Any]]:
    """Execute supported non-publishing actions through real product services.

    ``None`` means the action is not handled here and should use the existing
    agent dispatcher. Publishing and external posting intentionally remain
    outside this adapter so approval and platform-specific checks cannot be
    bypassed.
    """
    action = str(action_type or "").strip().lower()
    params = parameters if isinstance(parameters, dict) else {}
    context = params.get("onboarding_context") if isinstance(params.get("onboarding_context"), dict) else {}

    if action == "create_content":
        from models.blog_models import BlogOutlineSection, BlogSectionRequest, PersonaInfo
        from services.blog_writer.blog_service import BlogWriterService

        context_pillars = context.get("content_pillars")
        context_topic = context_pillars[0] if isinstance(context_pillars, list) and context_pillars else context_pillars
        topic = str(
            params.get("topic")
            or params.get("pillar_topic")
            or params.get("title")
            or context_topic
            or "Untitled content"
        ).strip()
        target_platforms = params.get("target_platforms")
        if isinstance(target_platforms, list) and target_platforms:
            return await _repurpose_content(
                params,
                context,
                user_id,
                db,
                topic,
            )
        section = BlogOutlineSection(
            id=str(params.get("section_id") or "recommendation-section"),
            heading=topic,
            subheadings=params.get("subheadings") or [],
            key_points=params.get("key_points") or [],
            keywords=params.get("keywords") or [],
            target_words=int(params.get("target_words") or 600),
        )
        request = BlogSectionRequest(
            section=section,
            keywords=params.get("keywords") or [],
            tone=params.get("tone") or context.get("default_tone"),
            persona=PersonaInfo(
                tone=params.get("tone") or context.get("default_tone"),
                audience=params.get("target_audience") or context.get("target_audience"),
                industry=params.get("industry") or context.get("industry"),
            ),
            mode=str(params.get("mode") or "draft"),
            competitive_advantage=params.get("competitive_advantage"),
        )
        response = await BlogWriterService().generate_section(request, user_id=user_id)
        result = _dump(response)
        content = getattr(response, "markdown", None)
        asset_id = _persist_text_artifact(
            db,
            user_id,
            content,
            "today_workflow_content",
            topic,
            ["content", "recommendation"],
            _lineage_metadata(params, "blog_section", "website"),
        )
        return {
            "success": _generation_success(getattr(response, "success", True), content, db, asset_id),
            "artifact_type": "content_draft",
            "content": content,
            "asset_id": asset_id,
            "result": result,
            "error": None if (not db or asset_id is not None) else "Generated content could not be saved as an asset",
        }

    if action == "seo_analyze":
        from models.blog_models import BlogSEOAnalyzeRequest
        from services.blog_writer.blog_service import BlogWriterService

        content = str(params.get("content") or params.get("draft") or "").strip()
        if not content:
            return {
                "success": False,
                "artifact_type": "seo_analysis",
                "error": "seo_analyze requires content or draft",
            }
        response = await BlogWriterService().seo_analyze(
            BlogSEOAnalyzeRequest(
                content=content,
                blog_title=params.get("blog_title") or params.get("title"),
                keywords=params.get("keywords") or [],
                research_data=params.get("research_data") or context,
            ),
            user_id=user_id,
        )
        return {
            "success": bool(getattr(response, "success", True)),
            "artifact_type": "seo_analysis",
            "result": _dump(response),
        }

    if action in {"calendar_insert", "create_seo_task"}:
        from datetime import datetime

        from api.content_planning.services.calendar_service import CalendarService

        try:
            strategy_id = int(params.get("strategy_id"))
        except (TypeError, ValueError):
            return {
                "success": False,
                "artifact_type": "calendar_event",
                "error": "calendar insertion requires strategy_id",
            }
        raw_date = params.get("scheduled_date")
        if not raw_date:
            return {
                "success": False,
                "artifact_type": "calendar_event",
                "error": "calendar insertion requires scheduled_date",
            }
        try:
            scheduled_date = (
                raw_date
                if isinstance(raw_date, datetime)
                else datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
            )
        except ValueError:
            return {
                "success": False,
                "artifact_type": "calendar_event",
                "error": "scheduled_date must be an ISO datetime",
            }
        event_data = {
            "strategy_id": strategy_id,
            "title": str(params.get("title") or params.get("topic") or "SEO task"),
            "description": str(params.get("description") or "Recommendation-generated calendar task"),
            "content_type": "seo_page" if action == "create_seo_task" else str(params.get("content_type") or "blog_post"),
            "platform": str(params.get("platform") or "website"),
            "scheduled_date": scheduled_date,
            "ai_recommendations": params.get("ai_recommendations") or {},
            "user_id": user_id,
            "owner_agent": params.get("owner_agent") or params.get("agent") or context.get("owner_agent"),
            "recommendation_id": params.get("recommendation_id") or context.get("recommendation_id"),
            "task_id": params.get("task_id") or params.get("workflow_task_id") or context.get("task_id"),
            "meeting_id": params.get("meeting_id") or context.get("meeting_id"),
            "kpi": params.get("kpi") or context.get("kpi"),
            "deadline": params.get("deadline") or context.get("deadline"),
            "action_type": action,
            "action_parameters": params.get("action_parameters") if isinstance(params.get("action_parameters"), dict) else params,
            "evidence": params.get("evidence") or context.get("evidence"),
            "expected_outcome": params.get("expected_outcome") or params.get("expected_impact") or context.get("expected_outcome"),
            "user_approval_state": params.get("user_approval_state") or context.get("user_approval_state") or "approved",
            "user_timezone": params.get("user_timezone") or context.get("user_timezone") or "UTC",
        }
        result = await CalendarService().schedule_event(event_data, db)
        return {
            "success": result.get("status") == "success",
            "artifact_type": "calendar_event",
            "result": result,
        }

    if action in {"social_draft", "facebook_draft"}:
        from api.facebook_writer.models.post_models import FacebookPostRequest
        from api.facebook_writer.models.post_models import PostGoal, PostTone
        from api.facebook_writer.services.post_service import FacebookPostService

        requested_tone = str(
            params.get("post_tone") or context.get("default_tone") or PostTone.PROFESSIONAL.value
        )
        facebook_tones = {tone.value for tone in PostTone}
        if requested_tone not in facebook_tones:
            requested_tone = PostTone.PROFESSIONAL.value
        request = FacebookPostRequest(
            business_type=str(params.get("business_type") or params.get("industry") or context.get("industry") or "business"),
            target_audience=str(params.get("target_audience") or context.get("target_audience") or "the target audience"),
            post_goal=PostGoal(str(params.get("post_goal") or PostGoal.SHARE_CONTENT.value)),
            post_tone=PostTone(requested_tone),
            custom_goal=params.get("custom_goal"),
            custom_tone=params.get("custom_tone"),
            include=params.get("include"),
            avoid=params.get("avoid"),
        )
        response = await asyncio.to_thread(
            FacebookPostService().generate_post,
            request,
            user_id,
        )
        content = getattr(response, "content", None)
        asset_id = _persist_text_artifact(
            db,
            user_id,
            content,
            "today_workflow_social",
            str(params.get("topic") or params.get("business_type") or "Social draft"),
            ["social", "facebook", "recommendation"],
        )
        return {
            "success": _generation_success(getattr(response, "success", True), content, db, asset_id),
            "artifact_type": "social_draft",
            "content": content,
            "asset_id": asset_id,
            "result": _dump(response),
            "error": None if (not db or asset_id is not None) else "Generated social draft could not be saved as an asset",
        }

    if action == "linkedin_draft":
        from models.linkedin_models import LinkedInPostRequest
        from services.linkedin_service import LinkedInService

        topic = str(params.get("topic") or params.get("title") or "Untitled LinkedIn post").strip()
        request = LinkedInPostRequest(
            topic=topic,
            industry=str(params.get("industry") or context.get("industry") or "General business"),
            tone=str(params.get("tone") or context.get("default_tone") or "professional"),
            target_audience=params.get("target_audience") or context.get("target_audience"),
            key_points=params.get("key_points") or [],
            reference_context=params.get("reference_context"),
            include_hashtags=bool(params.get("include_hashtags", True)),
            include_call_to_action=bool(params.get("include_call_to_action", True)),
            research_enabled=bool(params.get("research_enabled", True)),
            max_length=int(params.get("max_length") or 3000),
        )
        response = await LinkedInService().generate_linkedin_post(request, user_id=user_id)
        response_data = getattr(response, "data", None)
        content = getattr(response_data, "content", None) if response_data else None
        asset_id = _persist_text_artifact(
            db,
            user_id,
            content,
            "today_workflow_linkedin",
            topic,
            ["social", "linkedin", "recommendation"],
        )
        return {
            "success": _generation_success(getattr(response, "success", True), content, db, asset_id),
            "artifact_type": "linkedin_draft",
            "content": content,
            "asset_id": asset_id,
            "result": _dump(response),
            "error": None if (not db or asset_id is not None) else "Generated LinkedIn draft could not be saved as an asset",
        }

    return None
