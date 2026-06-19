"""
LinkedIn profile acquire CLI — Phase 1 (fetch, normalize, persist, cache).

Modes:
  - Default: cache-first acquire via get_or_fetch_profile (persists to SQLite)
  - --refresh: force Unipile fetch and DB update
  - --dry-run: fetch + normalize only (Steps 1.1–1.2 gate; no persistence)
  - --from-fixture: offline normalizer test from saved JSON

Usage:
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --refresh
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --print-json
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --dry-run
    python backend/scripts/linkedin_fetch_profile.py --from-fixture docs/linkedin/fixtures/sample_user_profile_raw.json --print-normalized
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

from services.integrations.linkedin.profile_service import (
    get_or_fetch_profile,
    normalize_unipile_profile,
    validate_normalized_profile,
)
from services.integrations.linkedin.types import LinkedInNotConnectedError
from services.integrations.linkedin.unipile_client import UnipileAPIError
from services.integrations.linkedin.unipile_provider import UnipileProvider
from services.integrations.linkedin_oauth import LinkedInOAuthService

# Official response type for GET /api/v1/users/me (Retrieve own profile).
ACCOUNT_OWNER_PROFILE_OBJECT = "AccountOwnerProfile"

# Returned by GET /api/v1/users/{identifier} with linkedin_sections (full acquire path).
USER_PROFILE_OBJECT = "UserProfile"

FIXTURE_ACCEPTED_OBJECTS: frozenset[str] = frozenset(
    {ACCOUNT_OWNER_PROFILE_OBJECT, USER_PROFILE_OBJECT}
)

SECTION_COUNT_KEYS: tuple[str, ...] = (
    "work_experience_total_count",
    "education_total_count",
    "skills_total_count",
    "languages_total_count",
    "certifications_total_count",
    "volunteering_experience_total_count",
    "projects_total_count",
)

SECTION_ARRAY_KEYS: tuple[str, ...] = (
    "work_experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "volunteering_experience",
    "projects",
)


def _section_counts_from_raw(profile: dict[str, Any]) -> dict[str, int]:
    """Extract section counts from a raw Unipile profile payload."""
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


def _section_counts_from_normalized(profile: dict[str, Any]) -> dict[str, int]:
    """Extract section counts from a normalized ALwrity profile."""
    return {
        "work_experience_total_count": profile.get("work_experience_total_count", 0),
        "education_total_count": profile.get("education_total_count", 0),
        "skills_total_count": profile.get("skills_total_count", 0),
        "languages_total_count": profile.get("languages_total_count", 0),
        "certifications_total_count": profile.get("certifications_total_count", 0),
        "volunteering_experience_total_count": profile.get(
            "volunteering_experience_total_count", 0
        ),
        "projects_total_count": profile.get("projects_total_count", 0),
        "recommendations_given_count": profile.get("recommendations_given_count", 0),
        "recommendations_received_count": profile.get(
            "recommendations_received_count", 0
        ),
    }


def _validate_gate(
    profile: dict[str, Any],
    *,
    require_user_profile: bool = False,
) -> list[str]:
    """Validate Step 1.1 gate criteria for raw Unipile payloads."""
    errors: list[str] = []

    object_type = profile.get("object")
    if require_user_profile:
        if object_type != USER_PROFILE_OBJECT:
            errors.append(
                f"object must be {USER_PROFILE_OBJECT!r} on full acquire path, "
                f"got {object_type!r}"
            )
    elif object_type not in FIXTURE_ACCEPTED_OBJECTS:
        errors.append(
            f"object must be one of {sorted(FIXTURE_ACCEPTED_OBJECTS)!r}, "
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

    if require_user_profile and object_type == USER_PROFILE_OBJECT:
        is_self = profile.get("is_self")
        if is_self is False:
            logger.warning(
                "[LinkedInProfile] is_self=False on own-profile UserProfile fetch — unexpected"
            )

    return errors


def _print_acquire_summary(
    normalized: dict[str, Any],
    meta: dict[str, Any],
    *,
    user_id: str,
) -> None:
    """Print Step 1.3–1.5 acquire summary to stdout."""
    counts = _section_counts_from_normalized(normalized)

    print("\n" + "=" * 60)
    print("LinkedIn Own Profile — Phase 1 Acquire Summary")
    print("=" * 60)
    print(f"user_id:                 {user_id}")
    print(f"source:                  {meta.get('source')}")
    print(f"fetched_at:              {meta.get('fetched_at') or '(not set)'}")
    print(f"profile_content_hash:    {meta.get('profile_content_hash') or '(not set)'}")
    print(f"name:                    {normalized.get('name') or '(empty)'}")
    print(f"headline:                {normalized.get('headline') or '(empty)'}")
    print(f"job_title:               {normalized.get('job_title') or '(empty)'}")
    print(f"company:                 {normalized.get('company') or '(empty)'}")
    print(f"is_self:                 {normalized.get('is_self')}")
    print(f"followers:               {normalized.get('followers')}")
    print(f"connections:             {normalized.get('connections')}")
    print("\nSection counts:")
    for key, value in sorted(counts.items()):
        print(f"  {key}: {value}")
    print("=" * 60 + "\n")


def _print_dry_run_summary(profile: dict[str, Any], *, user_id: str, account_id: str) -> None:
    """Print Step 1.1 dry-run summary to stdout."""
    counts = _section_counts_from_raw(profile)
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


def _print_normalized_summary(normalized: dict[str, Any]) -> None:
    """Print Step 1.2 normalization summary."""
    print("\n" + "-" * 60)
    print("Phase 1 Step 1.2 — Normalized Profile Summary")
    print("-" * 60)
    print(f"name:              {normalized.get('name') or '(empty)'}")
    print(f"headline:          {normalized.get('headline') or '(empty)'}")
    print(f"job_title:         {normalized.get('job_title') or '(empty)'}")
    print(f"company:           {normalized.get('company') or '(empty)'}")
    print(f"about length:      {len(normalized.get('about') or '')}")
    print(f"experience count:  {len(normalized.get('experience') or [])}")
    print(f"education count:   {len(normalized.get('education') or [])}")
    print(f"skills count:      {len(normalized.get('skills') or [])}")
    print(f"profile_url:       {normalized.get('profile_url') or '(empty)'}")
    print(f"is_self:           {normalized.get('is_self')}")
    print("-" * 60 + "\n")


def _load_fixture(path: str) -> dict[str, Any]:
    """Load raw Unipile JSON fixture from disk."""
    fixture_path = Path(path)
    if not fixture_path.is_file():
        raise FileNotFoundError(f"Fixture not found: {fixture_path}")
    with fixture_path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Fixture must be a JSON object, got {type(data).__name__}")
    return data


async def _run_acquire(args: argparse.Namespace) -> int:
    """Cache-first acquire: fetch, normalize, persist (Steps 1.3–1.5)."""
    user_id = args.user_id.strip()
    if not user_id:
        logger.error("--user-id is required")
        return 2

    logger.info(
        "[LinkedInProfile] Phase 1 acquire user_id={} refresh={}",
        user_id,
        args.refresh,
    )

    try:
        normalized, meta = await get_or_fetch_profile(
            user_id,
            refresh=args.refresh,
            linkedin_sections=args.linkedin_sections,
        )
    except LinkedInNotConnectedError as exc:
        logger.error(f"LinkedIn not connected: {exc}")
        return 1
    except UnipileAPIError as exc:
        logger.error(f"Unipile API error: {exc}")
        return 1
    except Exception:
        logger.exception("[LinkedInProfile] Unexpected error during profile acquire")
        return 1

    norm_errors = validate_normalized_profile(normalized)
    _print_acquire_summary(normalized, meta, user_id=user_id)

    if args.print_json or args.print_normalized:
        print(json.dumps(normalized, indent=2, default=str))

    if norm_errors:
        logger.error("[LinkedInProfile] Normalized profile validation FAILED:")
        for error in norm_errors:
            logger.error("  - {}", error)
        return 1

    logger.info(
        "[LinkedInProfile] Acquire complete source={} user_id={}",
        meta.get("source"),
        user_id,
    )
    return 0


async def _run_dry_run(args: argparse.Namespace) -> int:
    """Fetch profile, normalize, validate gates — no persistence (Steps 1.1–1.2)."""
    if not args.user_id.strip():
        logger.error("--user-id is required unless --from-fixture is used")
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

    stored_account_name = creds.account_name

    logger.info("[LinkedInProfile] Phase 1 Step 1.1 — dry-run fetch (two-step v1)")
    logger.info("[LinkedInProfile] user_id={}", args.user_id)
    logger.info("[LinkedInProfile] unipile_account_id={}", account_id)
    logger.info(
        "[LinkedInProfile] linkedin_sections={} (applied on /users/{{identifier}} only)",
        args.linkedin_sections,
    )

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

    gate_errors = _validate_gate(profile, require_user_profile=True)
    _print_dry_run_summary(profile, user_id=args.user_id.strip(), account_id=account_id)

    if args.save_raw_fixture:
        save_path = Path(args.save_raw_fixture)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        save_path.write_text(json.dumps(profile, indent=2, default=str), encoding="utf-8")
        logger.info("[LinkedInProfile] Raw profile saved to {}", save_path)

    if args.print_raw_json:
        print(json.dumps(profile, indent=2, default=str))

    if gate_errors:
        logger.error("[LinkedInProfile] Step 1.1 gate FAILED:")
        for error in gate_errors:
            logger.error("  - {}", error)
        return 1

    logger.info("[LinkedInProfile] Step 1.1 gate PASSED")

    return _run_normalize_gate(
        profile,
        stored_account_name=stored_account_name,
        print_normalized=args.print_normalized,
    )


def _run_fixture_mode(args: argparse.Namespace) -> int:
    """Normalize from a saved raw JSON fixture (offline Step 1.2)."""
    try:
        profile = _load_fixture(args.from_fixture)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to load fixture: {}", exc)
        return 1

    logger.info("[LinkedInProfile] Loaded fixture {}", args.from_fixture)
    _print_dry_run_summary(profile, user_id="(fixture)", account_id="(fixture)")

    if args.print_raw_json:
        print(json.dumps(profile, indent=2, default=str))

    return _run_normalize_gate(profile, print_normalized=args.print_normalized)


def _run_normalize_gate(
    raw_profile: dict[str, Any],
    *,
    stored_account_name: str | None = None,
    print_normalized: bool,
) -> int:
    """Run Step 1.2 normalizer and validation gate."""
    logger.info("[LinkedInProfile] Phase 1 Step 1.2 — normalize")
    normalized = normalize_unipile_profile(
        raw_profile,
        stored_account_name=stored_account_name,
    )
    _print_normalized_summary(normalized)

    norm_errors = validate_normalized_profile(normalized)
    if print_normalized:
        print(json.dumps(normalized, indent=2, default=str))

    if norm_errors:
        logger.error("[LinkedInProfile] Step 1.2 gate FAILED:")
        for error in norm_errors:
            logger.error("  - {}", error)
        return 1

    logger.info("[LinkedInProfile] Step 1.2 gate PASSED")
    logger.info("[LinkedInProfile] Dry-run complete — profile not persisted")
    return 0


async def _run_async_entry(args: argparse.Namespace) -> int:
    """Route to acquire, dry-run, or fixture mode."""
    if args.from_fixture:
        return _run_fixture_mode(args)
    if args.dry_run:
        return await _run_dry_run(args)
    return await _run_acquire(args)


def main() -> None:
    """CLI entry point."""
    repo_root = backend_dir.parent
    default_fixture = (
        repo_root / "docs" / "linkedin" / "fixtures" / "sample_user_profile_raw.json"
    )

    parser = argparse.ArgumentParser(
        description="Fetch, normalize, and persist LinkedIn profile from Unipile (Phase 1)."
    )
    parser.add_argument(
        "--user-id",
        help="ALwrity user ID (Clerk), must have unipile_account_id in linkedin_oauth_tokens",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Force Unipile fetch and update DB (default: cache-first)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and validate gates only; do not persist (Steps 1.1–1.2)",
    )
    parser.add_argument(
        "--from-fixture",
        metavar="PATH",
        help=f"Skip API; normalize from raw JSON fixture (default sample: {default_fixture.name})",
    )
    parser.add_argument(
        "--linkedin-sections",
        default="*",
        help='Unipile linkedin_sections for step 2 (/users/{identifier}); default: "*"',
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="Print normalized ALwrity profile JSON to stdout (acquire mode)",
    )
    parser.add_argument(
        "--print-normalized",
        action="store_true",
        help="Print normalized ALwrity profile JSON to stdout",
    )
    parser.add_argument(
        "--print-raw-json",
        action="store_true",
        help="Print raw Unipile profile JSON to stdout (dry-run / fixture only)",
    )
    parser.add_argument(
        "--save-raw-fixture",
        metavar="PATH",
        help="Save fetched raw Unipile JSON to file for offline normalizer testing",
    )
    args = parser.parse_args()

    if args.from_fixture is None and not args.user_id:
        parser.error("--user-id is required unless --from-fixture is provided")

    exit_code = asyncio.run(_run_async_entry(args))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
