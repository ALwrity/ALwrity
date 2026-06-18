"""
LinkedIn profile acquire CLI — Phase 1 Step 1.1 (fetch + dry-run gate test).

Fetches the connected user's profile from Unipile via GET /api/v1/users/me
(AccountOwnerProfile) with linkedin_sections. Does not persist (Step 1.3+).

Usage:
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv

load_dotenv(backend_dir / ".env")

from loguru import logger

from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.unipile_provider import UnipileProvider
from services.integrations.linkedin_oauth import LinkedInOAuthService

# Official response type for GET /api/v1/users/me (Retrieve own profile).
# See: https://developer.unipile.com/reference/userscontroller_getaccountownerprofile
ACCOUNT_OWNER_PROFILE_OBJECT = "AccountOwnerProfile"

# Returned by GET /api/v1/users/{identifier} for third-party profiles (not /users/me).
USER_PROFILE_OBJECT = "UserProfile"

# Accept both: /users/me should return AccountOwnerProfile; UserProfile kept for
# backward compatibility if Unipile ever aliases the own-profile route.
ACCEPTED_OWN_PROFILE_OBJECTS: frozenset[str] = frozenset(
    {ACCOUNT_OWNER_PROFILE_OBJECT, USER_PROFILE_OBJECT}
)

# Section total_count fields on enriched LinkedIn profile payloads (Phase 1 gate info).
SECTION_COUNT_KEYS: tuple[str, ...] = (
    "work_experience_total_count",
    "education_total_count",
    "skills_total_count",
    "languages_total_count",
    "certifications_total_count",
    "volunteering_experience_total_count",
    "projects_total_count",
)

# Parallel array keys for list lengths when *_total_count is absent.
SECTION_ARRAY_KEYS: tuple[str, ...] = (
    "work_experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "volunteering_experience",
    "projects",
)


def _section_counts(profile: dict[str, Any]) -> dict[str, int]:
    """Extract section counts from an own-profile or UserProfile payload."""
    counts: dict[str, int] = {}
    for key in SECTION_COUNT_KEYS:
        value = profile.get(key)
        if isinstance(value, int):
            counts[key] = value
    for array_key in SECTION_ARRAY_KEYS:
        items = profile.get(array_key)
        if isinstance(items, list) and array_key not in counts:
            counts[f"{array_key}_length"] = len(items)
    recommendations = profile.get("recommendations")
    if isinstance(recommendations, dict):
        for rec_key in ("given_total_count", "received_total_count"):
            value = recommendations.get(rec_key)
            if isinstance(value, int):
                counts[f"recommendations_{rec_key}"] = value
    return counts


def _validate_gate(profile: dict[str, Any]) -> list[str]:
    """
    Validate Step 1.1 gate criteria for GET /api/v1/users/me.

    Unipile v1 own-profile contract (OpenAPI ``UsersController_getAccountOwnerProfile``):
    - ``object`` is ``AccountOwnerProfile`` (not ``UserProfile``).
    - ``is_self`` is not part of the AccountOwnerProfile schema; it appears only on
      ``UserProfile`` responses from GET /users/{identifier} (third-party profiles).

    Returns:
        List of error messages (empty when gate passes).
    """
    errors: list[str] = []

    object_type = profile.get("object")
    if object_type not in ACCEPTED_OWN_PROFILE_OBJECTS:
        errors.append(
            f"object must be one of {sorted(ACCEPTED_OWN_PROFILE_OBJECTS)!r}, "
            f"got {object_type!r}"
        )

    provider = profile.get("provider")
    if provider is not None and provider != "LINKEDIN":
        errors.append(f"provider must be 'LINKEDIN', got {provider!r}")

    identity_fields = (
        profile.get("first_name"),
        profile.get("last_name"),
        profile.get("headline"),
        profile.get("provider_id"),
        profile.get("public_identifier"),
    )
    if not any(isinstance(value, str) and value.strip() for value in identity_fields):
        errors.append(
            "at least one identity field required "
            "(first_name, last_name, headline, provider_id, or public_identifier)"
        )

    # is_self is informational only for /users/me — not a gate criterion.
    if object_type == USER_PROFILE_OBJECT and profile.get("is_self") is False:
        logger.warning(
            "[LinkedInProfile] is_self=False on own-profile fetch — unexpected for /users/me"
        )

    return errors


def _print_summary(profile: dict[str, Any], *, user_id: str, account_id: str) -> None:
    """Print Step 1.1 gate summary to stdout."""
    counts = _section_counts(profile)
    name_parts = [
        profile.get("first_name") or "",
        profile.get("last_name") or "",
    ]
    display_name = " ".join(part for part in name_parts if part).strip()

    print("\n" + "=" * 60)
    print("LinkedIn Own Profile — Phase 1 Step 1.1 Gate Summary")
    print("=" * 60)
    print(f"user_id:        {user_id}")
    print(f"account_id:     {account_id}")
    print(f"object:         {profile.get('object')}")
    is_self = profile.get("is_self")
    if is_self is None:
        print("is_self:        (not returned — expected for AccountOwnerProfile)")
    else:
        print(f"is_self:        {is_self}")
    print(f"provider:       {profile.get('provider')}")
    print(f"public_id:      {profile.get('public_identifier')}")
    print(f"name:           {display_name or '(empty)'}")
    print(f"headline:       {profile.get('headline') or '(empty)'}")
    print(f"follower_count: {profile.get('follower_count')}")
    print(f"connections:    {profile.get('connections_count')}")
    print("\nSection counts:")
    if counts:
        for key, value in sorted(counts.items()):
            print(f"  {key}: {value}")
    else:
        print("  (no section count fields returned — check linkedin_sections param)")
    print("=" * 60 + "\n")


async def _run(args: argparse.Namespace) -> int:
    """Fetch profile and validate Step 1.1 gate."""
    if not args.dry_run:
        logger.error(
            "Step 1.1 supports --dry-run only. Persistence is added in Step 1.3."
        )
        return 2

    if not args.user_id.strip():
        logger.error("--user-id is required")
        return 2

    provider = UnipileProvider()
    oauth = LinkedInOAuthService()

    try:
        creds = oauth.resolve_credentials(args.user_id.strip())
    except LinkedInNotConnectedError as exc:
        logger.error(f"LinkedIn not connected: {exc}")
        return 1

    account_id = creds.unipile_account_id
    if not account_id:
        logger.error(
            "No unipile_account_id in credentials. Connect LinkedIn via Unipile first."
        )
        return 1

    logger.info("=" * 52)
    logger.info("[LinkedInProfile] Phase 1 Step 1.1 — dry-run fetch")
    logger.info("[LinkedInProfile] user_id={}", args.user_id)
    logger.info("[LinkedInProfile] unipile_account_id={}", account_id)
    logger.info("=" * 52)

    try:
        profile = await provider.fetch_own_linkedin_profile(
            args.user_id.strip(),
            linkedin_sections=args.linkedin_sections,
        )
    except LinkedInNotConnectedError as exc:
        logger.error(f"LinkedIn not connected: {exc}")
        return 1
    except UnipileAPIError as exc:
        logger.error(f"Unipile API error: {exc}")
        return 1
    except Exception:
        logger.exception("[LinkedInProfile] Unexpected error during profile fetch")
        return 1

    if not isinstance(profile, dict):
        logger.error(f"Expected dict profile payload, got {type(profile).__name__}")
        return 1

    gate_errors = _validate_gate(profile)
    _print_summary(profile, user_id=args.user_id.strip(), account_id=account_id)

    if args.print_json:
        print(json.dumps(profile, indent=2, default=str))

    if gate_errors:
        logger.error("[LinkedInProfile] Step 1.1 gate FAILED:")
        for error in gate_errors:
            logger.error("  - {}", error)
        return 1

    logger.info("[LinkedInProfile] Step 1.1 gate PASSED")
    logger.info("[LinkedInProfile] Dry-run complete — profile not persisted")
    return 0


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Fetch LinkedIn UserProfile from Unipile (Phase 1 Step 1.1 dry-run)."
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="ALwrity user ID (Clerk), must have unipile_account_id in linkedin_oauth_tokens",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and validate gate only; do not persist (required for Step 1.1)",
    )
    parser.add_argument(
        "--linkedin-sections",
        default="*",
        help='Unipile linkedin_sections query param (default: "*")',
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print full raw UserProfile JSON to stdout after summary",
    )
    args = parser.parse_args()
    exit_code = asyncio.run(_run(args))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
