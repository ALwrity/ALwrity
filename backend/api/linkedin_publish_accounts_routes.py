"""
LinkedIn publish & account management routes — post publishing, account/organization
listing. Kept separate from linkedin_social_routes.py to avoid further growth.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.orm import Session

from middleware.auth_middleware import get_current_user
from models.linkedin_social_models import (
    LinkedInAccountsListResponse,
    LinkedInAccountResponse,
    LinkedInOrganizationResponse,
    LinkedInOrganizationsListResponse,
    LinkedInPublishPostResponse,
)
from services.database import get_db
from services.integrations.linkedin.factory import get_linkedin_provider
from services.integrations.linkedin.linkedin_publish_service import (
    execute_linkedin_publish,
    parse_publish_request,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError

router = APIRouter(prefix="/api/linkedin-social", tags=["LinkedIn Social"])


def _user_id(current_user: dict) -> str:
    uid = current_user.get("id") if current_user else None
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return str(uid)


@router.post("/posts/publish", response_model=LinkedInPublishPostResponse)
async def publish_linkedin_post(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LinkedInPublishPostResponse:
    """Publish a LinkedIn post (text with optional single image) to the personal profile."""
    user_id = _user_id(current_user)
    content, account_id, image_ids, upload_bytes, upload_filename = await parse_publish_request(
        request
    )
    return await execute_linkedin_publish(
        user_id=user_id,
        content=content,
        account_id=account_id,
        image_ids=image_ids,
        upload_bytes=upload_bytes,
        upload_filename=upload_filename,
        db=db,
    )


@router.get("/accounts", response_model=LinkedInAccountsListResponse)
async def list_accounts(
    current_user: dict = Depends(get_current_user),
) -> LinkedInAccountsListResponse:
    """List LinkedIn accounts available to the user via the configured provider."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        accounts = await provider.list_accounts(user_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_accounts failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInAccountsListResponse(
        accounts=[
            LinkedInAccountResponse(
                account_id=a.account_id,
                account_type=a.account_type,
                username=a.username,
                avatar_url=a.avatar_url,
                platform=a.platform,
            )
            for a in accounts
        ],
        provider=provider.provider_name,
    )


@router.get("/organizations", response_model=LinkedInOrganizationsListResponse)
async def list_organizations(
    account_id: str = Query(..., description="LinkedIn account id"),
    current_user: dict = Depends(get_current_user),
) -> LinkedInOrganizationsListResponse:
    """List LinkedIn company pages for an account."""
    user_id = _user_id(current_user)
    provider = get_linkedin_provider()
    try:
        orgs = await provider.list_organizations(user_id, account_id)
    except LinkedInNotConnectedError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.error(f"list_organizations failed for user {user_id}: {e}")
        raise HTTPException(status_code=502, detail=str(e)) from e

    return LinkedInOrganizationsListResponse(
        account_id=account_id,
        organizations=[
            LinkedInOrganizationResponse(
                organization_id=o.organization_id,
                name=o.name,
                urn=o.urn,
            )
            for o in orgs
        ],
    )
