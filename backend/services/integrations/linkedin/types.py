"""
Normalized types for LinkedIn Growth Engine (provider-agnostic).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

DEFAULT_ZERNIO_API_URL = "https://zernio.com/api/v1"


ProviderMode = Literal["zernio", "native"]
ProfileAggregation = Literal["TOTAL", "DAILY"]
OrgMetricType = Literal["total_value", "time_series"]


class LinkedInNotConnectedError(Exception):
    """Raised when no LinkedIn credentials are available for a user."""


@dataclass(frozen=True)
class LinkedInCredentials:
    provider_mode: ProviderMode
    zernio_api_key: Optional[str] = None
    zernio_profile_id: Optional[str] = None
    zernio_account_id: Optional[str] = None
    zernio_org_account_id: Optional[str] = None
    zernio_api_url: str = DEFAULT_ZERNIO_API_URL
    linkedin_access_token: Optional[str] = None
    linkedin_refresh_token: Optional[str] = None
    account_name: Optional[str] = None
    profile_urn: Optional[str] = None
    source: Literal["database", "environment"] = "database"

    @classmethod
    def from_db_row(
        cls,
        row: dict[str, Any],
        *,
        decrypted: bool = True,
    ) -> LinkedInCredentials:
        return cls(
            provider_mode=row.get("provider_mode", "zernio"),
            zernio_api_key=row.get("zernio_api_key"),
            zernio_profile_id=row.get("zernio_profile_id"),
            zernio_account_id=row.get("zernio_account_id"),
            zernio_org_account_id=row.get("zernio_org_account_id"),
            zernio_api_url=row.get("zernio_api_url") or os.getenv(
                "ZERNIO_API_URL", DEFAULT_ZERNIO_API_URL
            ),
            linkedin_access_token=row.get("linkedin_access_token"),
            linkedin_refresh_token=row.get("linkedin_refresh_token"),
            account_name=row.get("account_name"),
            profile_urn=row.get("profile_urn"),
            source="database",
        )

    @property
    def primary_account_id(self) -> Optional[str]:
        return self.zernio_account_id

    @property
    def org_account_id(self) -> Optional[str]:
        return self.zernio_org_account_id or self.zernio_account_id


@dataclass(frozen=True)
class LinkedInAccount:
    account_id: str
    account_type: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    platform: str = "linkedin"


@dataclass(frozen=True)
class LinkedInOrganization:
    organization_id: str
    name: Optional[str] = None
    urn: Optional[str] = None
    logo_url: Optional[str] = None


@dataclass
class CreatePostRequest:
    account_id: str
    content: str
    organization_urn: Optional[str] = None
    first_comment: Optional[str] = None
    media_urls: list[str] = field(default_factory=list)
    scheduled_at: Optional[str] = None


@dataclass
class CreatePostResult:
    success: bool
    post_id: Optional[str] = None
    post_urn: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class MediaUploadResult:
    success: bool
    media_id: Optional[str] = None
    url: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class CommentInfo:
    comment_id: str
    text: Optional[str] = None
    author: Optional[str] = None
    created_at: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReplyResult:
    success: bool
    comment_id: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass(frozen=True)
class DuplicateCheckResult:
    is_duplicate: bool
    content_hash: str
    matched_asset_id: Optional[int] = None
    reason: Optional[str] = None


@dataclass(frozen=True)
class MediaValidationResult:
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
