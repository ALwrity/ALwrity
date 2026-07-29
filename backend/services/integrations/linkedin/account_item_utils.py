"""
Shared helpers for parsing LinkedIn account/profile dicts from providers.

Provider-agnostic helpers for LinkedIn account/profile payload parsing.
"""

from __future__ import annotations

from typing import Any, Optional


def avatar_url_from_item(item: dict[str, Any]) -> Optional[str]:
    """Best-effort avatar/logo URL from a provider account or profile payload."""
    for key in (
        "profilePicture",
        "profile_picture",
        "avatarUrl",
        "avatar_url",
        "logoUrl",
        "logo_url",
    ):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def account_id_from_item(item: dict[str, Any]) -> str:
    return str(item.get("_id") or item.get("id") or item.get("accountId") or "")


def account_type_from_item(item: dict[str, Any]) -> Optional[str]:
    return item.get("accountType") or item.get("type")


def account_name_from_item(item: dict[str, Any]) -> Optional[str]:
    return item.get("displayName") or item.get("username") or item.get("name")
