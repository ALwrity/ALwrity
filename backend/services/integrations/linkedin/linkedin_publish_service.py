"""
Orchestrate LinkedIn post publishing with optional image media (Phase 2).
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, Request
from loguru import logger
from sqlalchemy.orm import Session

from models.linkedin_social_models import (
    LinkedInPublishPostRequest,
    LinkedInPublishPostResponse,
)
from services.integrations.linkedin.exceptions import (
    LinkedInDuplicateContentError,
    LinkedInMediaValidationError,
)
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.linkedin_publish_media_service import (
    LinkedInPublishMediaService,
    PublishMediaResolution,
)
from services.integrations.linkedin.types import CreatePostRequest, LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin_oauth import LinkedInOAuthService

_oauth_service = LinkedInOAuthService()
_media_service = LinkedInPublishMediaService()


async def parse_publish_request(request: Request) -> tuple[str, Optional[str], Optional[list[str]], Optional[bytes], Optional[str]]:
    """
    Parse JSON or multipart publish request.

    Returns: content, account_id, image_ids, upload_bytes, upload_filename
    """
    content_type = (request.headers.get("content-type") or "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        content = str(form.get("content") or "").strip()
        account_id_raw = form.get("account_id")
        account_id = str(account_id_raw).strip() if account_id_raw else None

        upload = form.get("file")
        upload_bytes: Optional[bytes] = None
        upload_filename: Optional[str] = None
        if upload is not None and hasattr(upload, "read"):
            upload_bytes = await upload.read()
            upload_filename = getattr(upload, "filename", None) or "upload.png"

        if upload_bytes and len(upload_bytes) == 0:
            upload_bytes = None

        return content, account_id, None, upload_bytes, upload_filename

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON publish payload") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Publish payload must be a JSON object")

    body = LinkedInPublishPostRequest.model_validate(payload)
    image_ids = body.image_ids or None
    return body.content.strip(), body.account_id, image_ids, None, None


async def execute_linkedin_publish(
    *,
    user_id: str,
    content: str,
    account_id: Optional[str],
    image_ids: Optional[list[str]],
    upload_bytes: Optional[bytes],
    upload_filename: Optional[str],
    db: Session,
) -> LinkedInPublishPostResponse:
    """Publish LinkedIn post text with optional single image attachment."""
    debug_id = uuid.uuid4().hex[:12]
    provider = get_linkedin_provider()
    media_resolution: Optional[PublishMediaResolution] = None

    logger.info(
        "[LinkedInPublish] request user_id={} provider={} content_len={} "
        "account_id_present={} image_ids={} has_upload={} debug_id={}",
        user_id,
        provider.provider_name,
        len(content),
        bool(account_id),
        len(image_ids or []),
        bool(upload_bytes),
        debug_id,
    )

    if not content:
        logger.warning("[LinkedInPublish] empty content user_id={} debug_id={}", user_id, debug_id)
        raise HTTPException(status_code=400, detail="Post content cannot be empty")

    try:
        creds = _oauth_service.resolve_credentials(user_id)
        resolved_account_id = creds.unipile_account_id or creds.primary_account_id
        if not resolved_account_id:
            raise LinkedInNotConnectedError("No LinkedIn account connected")

        if account_id and account_id != resolved_account_id:
            raise ValueError(
                "Account ID does not match your connected LinkedIn personal profile"
            )

        media_resolution = await _media_service.resolve_for_publish(
            user_id,
            image_ids=image_ids,
            upload_bytes=upload_bytes,
            upload_filename=upload_filename,
        )

        publish_request = CreatePostRequest(
            account_id=resolved_account_id,
            content=content,
            media_urls=media_resolution.media_paths,
        )
        result = await provider.create_post(user_id, publish_request, db=db)

        share_url = None
        if isinstance(result.raw, dict):
            share_url = result.raw.get("share_url")

        has_media = media_resolution.has_media
        message = (
            "Published to LinkedIn with image."
            if has_media
            else "Published to LinkedIn."
        )

        logger.info(
            "[LinkedInPublish] success user_id={} post_id={} post_urn={} has_media={} debug_id={}",
            user_id,
            result.post_id,
            result.post_urn,
            has_media,
            debug_id,
        )

        return LinkedInPublishPostResponse(
            success=True,
            post_id=result.post_id,
            post_urn=result.post_urn,
            share_url=share_url,
            provider=provider.provider_name,
            message=message,
            debug_id=debug_id,
            has_media=has_media,
        )

    except LinkedInNotConnectedError as exc:
        logger.warning(
            "[LinkedInPublish] not connected user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except LinkedInDuplicateContentError as exc:
        logger.warning(
            "[LinkedInPublish] duplicate content user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except LinkedInMediaValidationError as exc:
        logger.warning(
            "[LinkedInPublish] media validation failed user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        detail = "; ".join(exc.errors) if exc.errors else str(exc)
        raise HTTPException(status_code=400, detail=detail) from exc
    except ValueError as exc:
        logger.warning(
            "[LinkedInPublish] validation failed user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except UnipileAPIError as exc:
        status = exc.status_code or 502
        if status == 403:
            http_status = 403
            message = "Insufficient permissions to publish to LinkedIn."
        elif status == 401:
            http_status = 401
            message = "LinkedIn account disconnected. Please reconnect and try again."
        elif status == 400:
            http_status = 400
            message = "Invalid publish request. Please check your post and try again."
        elif status >= 500:
            http_status = 502
            message = "LinkedIn publishing service is temporarily unavailable."
        else:
            http_status = 502
            message = "Could not publish to LinkedIn. Please try again."
        logger.error(
            "[LinkedInPublish] Unipile error user_id={} debug_id={} status={}: {}",
            user_id,
            debug_id,
            status,
            exc,
        )
        raise HTTPException(status_code=http_status, detail=message) from exc
    except NotImplementedError as exc:
        logger.error(
            "[LinkedInPublish] provider not implemented user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        raise HTTPException(
            status_code=501,
            detail="LinkedIn publishing is not available for this provider.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[LinkedInPublish] unexpected error user_id={} debug_id={}: {}",
            user_id,
            debug_id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Could not publish to LinkedIn. Please try again.",
        ) from exc
    finally:
        if media_resolution is not None:
            _media_service.cleanup(media_resolution)
