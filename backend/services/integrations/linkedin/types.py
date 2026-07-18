"""
Normalized types for LinkedIn Growth Engine (provider-agnostic).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

DEFAULT_UNIPILE_DSN = "api30.unipile.com:16037"

ProviderMode = Literal["native", "unipile"]
ProfileAggregation = Literal["TOTAL", "DAILY"]
OrgMetricType = Literal["total_value", "time_series"]


class LinkedInNotConnectedError(Exception):
    """Raised when no LinkedIn credentials are available for a user."""


@dataclass(frozen=True)
class LinkedInCredentials:
    """
    LinkedIn credentials for Unipile and native OAuth modes.

    Fields are provider-specific:
    - Unipile: unipile_account_id, unipile_org_account_id (API key from env)
    - Native: linkedin_access_token, linkedin_refresh_token
    """

    provider_mode: ProviderMode
    unipile_account_id: Optional[str] = None
    unipile_org_account_id: Optional[str] = None
    unipile_dsn: str = DEFAULT_UNIPILE_DSN
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
        """Create LinkedInCredentials from a database row dictionary."""
        raw_mode = str(row.get("provider_mode") or "unipile").strip().lower()
        if raw_mode == "native":
            provider_mode: ProviderMode = "native"
        else:
            # Treat unknown / legacy modes as unipile for field mapping;
            # resolve_credentials rejects incomplete Unipile rows.
            provider_mode = "unipile"

        return cls(
            provider_mode=provider_mode,
            unipile_account_id=row.get("unipile_account_id"),
            unipile_org_account_id=row.get("unipile_org_account_id"),
            unipile_dsn=row.get("unipile_dsn")
            or os.getenv("UNIPILE_DSN", DEFAULT_UNIPILE_DSN),
            linkedin_access_token=row.get("linkedin_access_token"),
            linkedin_refresh_token=row.get("linkedin_refresh_token"),
            account_name=row.get("account_name"),
            profile_urn=row.get("profile_urn"),
            source="database",
        )

    @property
    def primary_account_id(self) -> Optional[str]:
        """Primary account ID for the current provider mode."""
        if self.provider_mode == "unipile":
            return self.unipile_account_id
        return None

    @property
    def org_account_id(self) -> Optional[str]:
        """Organization account ID, or primary account as fallback."""
        if self.provider_mode == "unipile":
            return self.unipile_org_account_id or self.unipile_account_id
        return None


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
