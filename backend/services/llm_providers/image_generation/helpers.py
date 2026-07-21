"""Shared helpers for image generation operations — validation and usage tracking."""

import sys
from datetime import datetime
from typing import Optional, Dict, Any

from utils.logger_utils import get_service_logger

logger = get_service_logger("image_generation.helpers")


def _validate_image_operation(
    user_id: Optional[str],
    operation_type: str = "image-generation",
    num_operations: int = 1,
    log_prefix: str = "[Image Generation]",
    provider_name: Optional[str] = None,
) -> None:
    """Reusable pre-flight validation helper for all image operations."""
    if not user_id:
        logger.warning(f"{log_prefix} ⚠️ No user_id provided - skipping pre-flight validation (this should not happen in production)")
        return

    from services.database import get_session_for_user
    from services.subscription import PricingService
    from services.subscription.preflight_validator import validate_image_generation_operations
    from fastapi import HTTPException

    logger.info(f"{log_prefix} 🔍 Starting pre-flight validation for user_id={user_id}")
    db = get_session_for_user(user_id)
    try:
        pricing_service = PricingService(db)
        validate_image_generation_operations(
            pricing_service=pricing_service,
            user_id=user_id,
            num_images=num_operations,
            provider_name=provider_name,
        )
        logger.info(f"{log_prefix} ✅ Pre-flight validation passed for user_id={user_id}")
    except HTTPException:
        logger.error(f"{log_prefix} ❌ Pre-flight validation failed for user_id={user_id}")
        raise
    finally:
        db.close()


def _track_image_operation_usage(
    user_id: str,
    provider: str,
    model: str,
    operation_type: str,
    result_bytes: bytes,
    cost: float,
    prompt: Optional[str] = None,
    endpoint: str = "/image-generation",
    metadata: Optional[Dict[str, Any]] = None,
    log_prefix: str = "[Image Generation]",
    response_time: float = 0.0
) -> Dict[str, Any]:
    """Reusable usage tracking helper for all image operations."""
    try:
        from services.database import get_session_for_user
        db_track = get_session_for_user(user_id)
        try:
            from models.subscription_models import UsageSummary, APIUsageLog, APIProvider
            from services.subscription.provider_detection import detect_actual_provider
            from services.subscription import PricingService

            pricing = PricingService(db_track)
            current_period = pricing.get_current_billing_period(user_id) or datetime.now().strftime("%Y-%m")

            summary = db_track.query(UsageSummary).filter(
                UsageSummary.user_id == user_id,
                UsageSummary.billing_period == current_period
            ).first()

            if not summary:
                summary = UsageSummary(user_id=user_id, billing_period=current_period)
                db_track.add(summary)
                db_track.flush()

            # Map provider to DB column names
            provider_column_map = {
                "stability": ("stability_calls", "stability_cost"),
                "wavespeed": ("wavespeed_calls", "wavespeed_cost"),
                "gemini": ("gemini_calls", "gemini_cost"),
                "openai": ("openai_calls", "openai_cost"),
                "huggingface": ("stability_calls", "stability_cost"),  # route through stability (image-gen counter)
            }
            calls_col, cost_col = provider_column_map.get(provider, ("total_calls", "total_cost"))

            current_calls_before = getattr(summary, calls_col, 0) or 0
            current_cost_before = getattr(summary, cost_col, 0.0) or 0.0

            new_calls = current_calls_before + 1
            new_cost = current_cost_before + cost

            from sqlalchemy import text as sql_text
            update_query = sql_text(f"""
                UPDATE usage_summaries
                SET {calls_col} = :new_calls,
                    {cost_col} = :new_cost
                WHERE user_id = :user_id AND billing_period = :period
            """)
            db_track.execute(update_query, {
                'new_calls': new_calls,
                'new_cost': new_cost,
                'user_id': user_id,
                'period': current_period
            })

            summary.total_cost = (summary.total_cost or 0.0) + cost
            summary.total_calls = (summary.total_calls or 0) + 1
            summary.updated_at = datetime.utcnow()

            # Map provider to APIProvider enum
            provider_api_map = {
                "stability": APIProvider.STABILITY,
                "wavespeed": APIProvider.WAVESPEED,
                "gemini": APIProvider.GEMINI,
                "openai": APIProvider.OPENAI,
                "image_edit": APIProvider.IMAGE_EDIT,
                "video": APIProvider.VIDEO,
                "audio": APIProvider.AUDIO,
            }
            api_provider = provider_api_map.get(provider, APIProvider.STABILITY)
            actual_provider = detect_actual_provider(
                provider_enum=api_provider,
                model_name=model,
                endpoint=endpoint
            )

            request_size = len(prompt.encode("utf-8")) if prompt else 0
            usage_log = APIUsageLog(
                user_id=user_id,
                provider=api_provider,
                endpoint=endpoint,
                method="POST",
                model_used=model or "unknown",
                actual_provider_name=actual_provider,
                tokens_input=0,
                tokens_output=0,
                tokens_total=0,
                cost_input=0.0,
                cost_output=0.0,
                cost_total=cost,
                response_time=response_time,
                status_code=200,
                request_size=request_size,
                response_size=len(result_bytes),
                billing_period=current_period,
            )
            db_track.add(usage_log)

            limits = pricing.get_user_limits(user_id)
            plan_name = limits.get('plan_name', 'unknown') if limits else 'unknown'
            tier = limits.get('tier', 'unknown') if limits else 'unknown'
            provider_limit = limits['limits'].get(calls_col, 0) if limits else 0
            provider_limit_display = provider_limit if (provider_limit > 0 or tier != 'enterprise') else '∞'

            current_audio_calls = getattr(summary, "audio_calls", 0) or 0
            audio_limit = limits['limits'].get("audio_calls", 0) if limits else 0
            current_image_edit_calls = getattr(summary, "image_edit_calls", 0) or 0
            image_edit_limit = limits['limits'].get("image_edit_calls", 0) if limits else 0
            current_video_calls = getattr(summary, "video_calls", 0) or 0
            video_limit = limits['limits'].get("video_calls", 0) if limits else 0

            db_track.commit()
            from services.subscription.cache import clear_dashboard_cache
            clear_dashboard_cache(user_id)
            logger.info(f"{log_prefix} ✅ Tracked usage: user {user_id} -> {operation_type} -> {new_calls} calls, ${cost:.4f}")

            operation_name = operation_type.replace("-", " ").title()
            print(f"""
[SUBSCRIPTION] {operation_name}
├─ User: {user_id}
├─ Plan: {plan_name} ({tier})
├─ Provider: {provider}
├─ Actual Provider: {provider}
├─ Model: {model or 'unknown'}
├─ Calls: {current_calls_before} → {new_calls} / {provider_limit_display}
├─ Cost: ${current_cost_before:.4f} → ${new_cost:.4f}
├─ Audio: {current_audio_calls} / {audio_limit if audio_limit > 0 else '∞'}
├─ Image Editing: {current_image_edit_calls} / {image_edit_limit if image_edit_limit > 0 else '∞'}
├─ Videos: {current_video_calls} / {video_limit if video_limit > 0 else '∞'}
└─ Status: ✅ Allowed & Tracked
""", flush=True)
            sys.stdout.flush()

            return {"current_calls": new_calls, "cost": cost, "total_cost": new_cost}

        except Exception as track_error:
            logger.error(f"{log_prefix} ❌ Error tracking usage (non-blocking): {track_error}", exc_info=True)
            import traceback
            logger.error(f"{log_prefix} Full traceback: {traceback.format_exc()}")
            db_track.rollback()
            return {}
        finally:
            db_track.close()
    except Exception as usage_error:
        logger.error(f"{log_prefix} ❌ Failed to track usage: {usage_error}", exc_info=True)
        import traceback
        logger.error(f"{log_prefix} Full traceback: {traceback.format_exc()}")
        return {}
