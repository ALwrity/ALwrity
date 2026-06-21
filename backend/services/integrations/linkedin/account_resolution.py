"""
Resolve personal vs organization LinkedIn accounts from Zernio list_accounts data.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.types import LinkedInAccount
from services.integrations.linkedin.zernio_client import (
    account_id_from_item,
    account_name_from_item,
    account_type_from_item,
    avatar_url_from_item,
    list_accounts_sync,
    _parse_account_items,
)

LOG_PREFIX = "[LinkedInAccounts]"

_PERSONAL_TYPES = frozenset({"personal", "member", "individual"})
_ORG_TYPES = frozenset({"organization", "org", "company", "page", "brand"})

_HINT_ACCOUNT_ID_RE = re.compile(
    r"accountId[=:\"'\s]+([a-f0-9]{24}|[a-zA-Z0-9][a-zA-Z0-9_-]{2,})",
    re.IGNORECASE,
)


def is_personal_account_type(account_type: Optional[str]) -> bool:
    t = (account_type or "").strip().lower()
    if not t:
        return False
    return t in _PERSONAL_TYPES


def is_org_account_type(account_type: Optional[str]) -> bool:
    t = (account_type or "").strip().lower()
    if not t:
        return False
    return t in _ORG_TYPES or t.startswith("org")


def summarize_zernio_account_items(items: list[dict[str, Any]]) -> list[dict[str, Optional[str]]]:
    return [
        {
            "id": account_id_from_item(item) or None,
            "accountType": account_type_from_item(item),
            "displayName": account_name_from_item(item),
        }
        for item in items
    ]


def fetch_linkedin_account_items(
    api_key: str,
    base_url: str,
    profile_id: Optional[str],
) -> tuple[list[dict[str, Any]], str]:
    """
    Load LinkedIn SocialAccounts from Zernio: profile-scoped first, then global if <2.

    Returns (items, source) where source is ``profile`` or ``global``.
    """
    raw = list_accounts_sync(
        api_key, base_url, profile_id, platform="linkedin", global_scope=False
    )
    items = _parse_account_items(raw)
    source = "profile"
    summary = summarize_zernio_account_items(items)
    logger.warning(
        f"{LOG_PREFIX} list_accounts scope=profile profile_id={profile_id} "
        f"count={len(items)} items={summary}"
    )

    if len(items) < 2:
        global_raw = list_accounts_sync(
            api_key, base_url, None, platform="linkedin", global_scope=True
        )
        global_items = _parse_account_items(global_raw)
        global_summary = summarize_zernio_account_items(global_items)
        if len(global_items) > len(items):
            logger.warning(
                f"{LOG_PREFIX} list_accounts global fallback profile_count={len(items)} "
                f"global_count={len(global_items)} items={global_summary}"
            )
            items = global_items
            source = "global"
        else:
            logger.warning(
                f"{LOG_PREFIX} list_accounts global unchanged profile_count={len(items)} "
                f"global_count={len(global_items)} items={summary}"
            )

    return items, source


def parse_zernio_error_code(message: str) -> Optional[str]:
    lower = message.lower()
    if "organization_not_supported" in lower:
        return "organization_not_supported"
    if "personal_account_not_supported" in lower:
        return "personal_account_not_supported"
    return None


def parse_account_id_from_zernio_error(message: str) -> Optional[str]:
    match = _HINT_ACCOUNT_ID_RE.search(message)
    if match:
        return match.group(1)
    return None


def partition_zernio_account_items(
    items: list[dict[str, Any]],
) -> tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
    """
    Split Zernio account dicts into (personal_item, org_item).

    Uses accountType when present; otherwise if exactly two accounts exist,
    treats the non-personal one as the organization account.
    """
    personal_item: Optional[dict[str, Any]] = None
    org_item: Optional[dict[str, Any]] = None

    for item in items:
        account_type = account_type_from_item(item)
        if is_personal_account_type(account_type) and personal_item is None:
            personal_item = item
        elif is_org_account_type(account_type) and org_item is None:
            org_item = item

    if personal_item is None:
        for item in items:
            account_type = account_type_from_item(item)
            if not is_org_account_type(account_type):
                personal_item = item
                break

    if org_item is None:
        for item in items:
            if item is personal_item:
                continue
            account_type = account_type_from_item(item)
            if is_org_account_type(account_type) or personal_item is not None:
                org_item = item
                break

    if org_item is None and len(items) == 2 and personal_item is not None:
        org_item = next((i for i in items if i is not personal_item), None)

    return personal_item, org_item


def find_personal_account(
    accounts: list[LinkedInAccount],
) -> Optional[LinkedInAccount]:
    for account in accounts:
        if is_personal_account_type(account.account_type):
            return account
    for account in accounts:
        if not is_org_account_type(account.account_type):
            return account
    return accounts[0] if accounts else None


def find_org_account(
    accounts: list[LinkedInAccount],
    *,
    org_account_id: Optional[str] = None,
    personal_account_id: Optional[str] = None,
) -> Optional[LinkedInAccount]:
    if org_account_id:
        for account in accounts:
            if account.account_id == org_account_id:
                return account
        return LinkedInAccount(
            account_id=org_account_id,
            account_type="organization",
            platform="linkedin",
        )

    for account in accounts:
        if is_org_account_type(account.account_type):
            return account

    if personal_account_id:
        for account in accounts:
            if account.account_id != personal_account_id:
                return account

    non_personal = [
        a
        for a in accounts
        if not is_personal_account_type(a.account_type)
        and (not personal_account_id or a.account_id != personal_account_id)
    ]
    if len(non_personal) == 1:
        return non_personal[0]

    return None


@dataclass(frozen=True)
class ResolvedAccountPair:
    personal: LinkedInAccount
    org: Optional[LinkedInAccount]
    method: str

    @property
    def personal_id(self) -> str:
        return self.personal.account_id

    @property
    def org_id(self) -> Optional[str]:
        return self.org.account_id if self.org else None


def _account_by_id(
    accounts: list[LinkedInAccount], account_id: Optional[str]
) -> Optional[LinkedInAccount]:
    if not account_id:
        return None
    for account in accounts:
        if account.account_id == account_id:
            return account
    return None


def resolve_account_pair(
    accounts: list[LinkedInAccount],
    *,
    stored_personal_id: Optional[str] = None,
    stored_org_id: Optional[str] = None,
) -> Optional[ResolvedAccountPair]:
    """
    Resolve personal + org Zernio SocialAccounts for analytics routing.
    """
    logger.info(
        f"{LOG_PREFIX} resolve start stored_personal={stored_personal_id} "
        f"stored_org={stored_org_id} account_count={len(accounts)}"
    )

    if not accounts:
        logger.warning(f"{LOG_PREFIX} resolve failed reason=no_accounts")
        return None

    method = "partition"
    personal: Optional[LinkedInAccount] = None
    org: Optional[LinkedInAccount] = None

    stored_personal = (stored_personal_id or "").strip() or None
    stored_org = (stored_org_id or "").strip() or None
    if stored_personal and stored_org and stored_personal == stored_org:
        stored_org = None

    if stored_personal and stored_org and stored_personal != stored_org:
        personal = _account_by_id(accounts, stored_personal) or LinkedInAccount(
            account_id=stored_personal,
            account_type="personal",
            platform="linkedin",
        )
        org = _account_by_id(accounts, stored_org) or LinkedInAccount(
            account_id=stored_org,
            account_type="organization",
            platform="linkedin",
        )
        method = "stored"
    else:
        if stored_personal:
            personal = _account_by_id(accounts, stored_personal) or find_personal_account(
                accounts
            )
            method = "stored_personal_id"
        else:
            personal = find_personal_account(accounts)
        if personal:
            org = find_org_account(
                accounts,
                org_account_id=stored_org,
                personal_account_id=personal.account_id,
            )
        if org is None and stored_org and personal and stored_org != personal.account_id:
            org = LinkedInAccount(
                account_id=stored_org,
                account_type="organization",
                platform="linkedin",
            )
            method = "stored_org_id"

    if not personal or not personal.account_id:
        logger.warning(f"{LOG_PREFIX} resolve failed reason=no_personal_account")
        return None

    if org is None:
        logger.warning(
            f"{LOG_PREFIX} resolve warning org_id=null personal_id={personal.account_id}"
        )
    else:
        logger.warning(
            f"{LOG_PREFIX} resolve result personal_id={personal.account_id} "
            f"org_id={org.account_id} method={method}"
        )

    return ResolvedAccountPair(personal=personal, org=org, method=method)


def apply_hint_swap_from_personal_error(
    message: str,
    accounts: list[LinkedInAccount],
    personal_id: str,
    org_id: Optional[str],
) -> tuple[str, Optional[str], Optional[str]]:
    """
    When personal analytics fails with organization_not_supported, use Zernio hint.

    Returns (new_personal_id, new_org_id, method) or unchanged ids with method=None.
    """
    if parse_zernio_error_code(message) != "organization_not_supported":
        return personal_id, org_id, None

    hint_id = parse_account_id_from_zernio_error(message)
    if not hint_id:
        return personal_id, org_id, None

    new_org_id = hint_id
    new_personal_id = personal_id

    if personal_id == hint_id:
        other = next((a for a in accounts if a.account_id != hint_id), None)
        if other:
            new_personal_id = other.account_id

    logger.info(
        f"{LOG_PREFIX} hint swap wrong_role=personal_as_org "
        f"old_personal={personal_id} new_org={new_org_id} new_personal={new_personal_id}"
    )
    return new_personal_id, new_org_id, "hint"


def zernio_items_to_accounts(items: list[dict[str, Any]]) -> list[LinkedInAccount]:
    """Build LinkedInAccount list from Zernio API items using partition IDs for typing."""
    personal_raw, org_raw = partition_zernio_account_items(items)
    personal_id = account_id_from_item(personal_raw) if personal_raw else None
    org_id = account_id_from_item(org_raw) if org_raw else None

    accounts: list[LinkedInAccount] = []
    for item in items:
        aid = account_id_from_item(item)
        if not aid:
            continue
        if personal_id and aid == personal_id:
            resolved_type = "personal"
        elif org_id and aid == org_id:
            resolved_type = "organization"
        else:
            raw_type = account_type_from_item(item)
            if is_org_account_type(raw_type):
                resolved_type = "organization"
            elif is_personal_account_type(raw_type):
                resolved_type = "personal"
            else:
                resolved_type = raw_type
        accounts.append(
            LinkedInAccount(
                account_id=aid,
                account_type=resolved_type,
                username=account_name_from_item(item),
                avatar_url=avatar_url_from_item(item),
                platform="linkedin",
            )
        )
    return accounts
