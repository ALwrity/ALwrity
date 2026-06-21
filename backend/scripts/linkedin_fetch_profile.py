"""
LinkedIn profile acquire CLI — Phase 1 (fetch, normalize, persist, cache).

Modes:
  - Default: cache-first acquire via get_or_fetch_profile (persists to SQLite)
  - --refresh: force Unipile fetch and DB update
  - --dry-run: fetch + normalize only (Steps 1.1–1.2 gate; no persistence)
  - --from-fixture: offline normalizer test from saved JSON
  - --print-context: build Phase 2 profile context (persist when --user-id acquire)

Usage:
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --refresh
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --print-json
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --print-context
    python backend/scripts/linkedin_fetch_profile.py --user-id USER_ID --dry-run
    python backend/scripts/linkedin_fetch_profile.py --from-fixture PATH --print-context
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

from services.integrations.linkedin.profile_context_builder import build_profile_context
from services.integrations.linkedin.profile_context_service import get_or_build_profile_context
from services.integrations.linkedin.profile_context_types import (
    ProfileContextBuildError,
    validate_profile_context,
)
from services.integrations.linkedin.profile_repository import (
    ProfileRepository,
    compute_profile_content_hash,
)
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


def _section_counts_from_profile_context(context: dict[str, Any]) -> dict[str, int]:
    """Extract section counts from a Phase 2 profile context."""
    personal = context.get("personal_information") if isinstance(context, dict) else {}
    professional = context.get("professional_information") if isinstance(context, dict) else {}
    linkedin = context.get("linkedin_information") if isinstance(context, dict) else {}
    if not isinstance(personal, dict):
        personal = {}
    if not isinstance(professional, dict):
        professional = {}
    if not isinstance(linkedin, dict):
        linkedin = {}

    recommendations = professional.get("recommendations")
    rec_given = 0
    rec_received = 0
    if isinstance(recommendations, dict):
        given = recommendations.get("given")
        received = recommendations.get("received")
        rec_given = len(given) if isinstance(given, list) else 0
        rec_received = len(received) if isinstance(received, list) else 0

    return {
        "experience_count": len(professional.get("experience") or []),
        "experience_total_count": professional.get("experience_total_count", 0),
        "education_count": len(professional.get("education") or []),
        "education_total_count": professional.get("education_total_count", 0),
        "skills_count": len(professional.get("skills") or []),
        "skills_total_count": professional.get("skills_total_count", 0),
        "languages_total_count": professional.get("languages_total_count", 0),
        "certifications_total_count": professional.get("certifications_total_count", 0),
        "projects_total_count": professional.get("projects_total_count", 0),
        "volunteering_experience_total_count": professional.get(
            "volunteering_experience_total_count", 0
        ),
        "recommendations_given_count": professional.get(
            "recommendations_given_count", rec_given
        ),
        "recommendations_received_count": professional.get(
            "recommendations_received_count", rec_received
        ),
        "followers": linkedin.get("followers", 0),
        "connections": linkedin.get("connections", 0),
        "about_length": len(personal.get("about") or ""),
    }


def _print_profile_context_summary(
    context: dict[str, Any],
    context_meta: dict[str, Any],
    *,
    user_id: str,
) -> None:
    """Print Phase 2 profile context summary to stdout."""
    counts = _section_counts_from_profile_context(context)
    personal = context.get("personal_information") or {}
    professional = context.get("professional_information") or {}
    context_meta_section = context.get("meta") or {}

    print("\n" + "=" * 60)
    print("LinkedIn Profile Context — Phase 2 Summary")
    print("=" * 60)
    print(f"user_id:                      {user_id}")
    print(f"context_source:               {context_meta.get('source')}")
    print(
        "profile_context_updated_at:   "
        f"{context_meta.get('profile_context_updated_at') or '(not persisted)'}"
    )
    print(
        "built_from_profile_content_hash: "
        f"{context_meta_section.get('built_from_profile_content_hash') or '(not set)'}"
    )
    print(f"name:                         {personal.get('name') or '(empty)'}")
    print(f"headline:                     {personal.get('headline') or '(empty)'}")
    print(f"job_title:                    {professional.get('job_title') or '(empty)'}")
    print(f"company:                      {professional.get('company') or '(empty)'}")
    print(f"industry:                     {professional.get('industry') or '(empty)'}")
    print("\nSection counts:")
    for key, value in sorted(counts.items()):
        print(f"  {key}: {value}")
    print("=" * 60 + "\n")


def _resolve_profile_context(
    normalized: dict[str, Any],
    meta: dict[str, Any],
    *,
    user_id: str | None,
    persist: bool,
    oauth: LinkedInOAuthService | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Build or load profile context (mirrors GET /profile Phase 2 path when persisting).

    Args:
        normalized: Phase 1 normalized profile
        meta: Phase 1 acquire meta (may include profile_content_hash)
        user_id: ALwrity user ID when persisting to SQLite
        persist: When True, use cache-first ``get_or_build_profile_context``
        oauth: Optional OAuth service for repository

    Returns:
        Tuple of (profile context dict, context meta dict)
    """
    content_hash = meta.get("profile_content_hash") or compute_profile_content_hash(normalized)

    if persist:
        if not user_id:
            raise ValueError("user_id is required when persisting profile context")
        oauth_service = oauth or LinkedInOAuthService()
        repository = ProfileRepository(oauth=oauth_service)
        return get_or_build_profile_context(
            user_id,
            normalized,
            profile_content_hash=content_hash,
            repository=repository,
        )

    context = build_profile_context(normalized, content_hash=content_hash)
    return context, {
        "source": "built",
        "profile_context_updated_at": None,
    }


def _emit_profile_context(
    normalized: dict[str, Any],
    meta: dict[str, Any],
    *,
    user_id: str,
    persist: bool,
    print_context_json: bool,
    oauth: LinkedInOAuthService | None = None,
) -> int:
    """Build profile context, print summary, optionally print JSON; return exit code."""
    logger.info(
        "[LinkedInProfileContext] CLI build context user_id={} persist={}",
        user_id,
        persist,
    )
    try:
        context, context_meta = _resolve_profile_context(
            normalized,
            meta,
            user_id=user_id if persist else None,
            persist=persist,
            oauth=oauth,
        )
    except ProfileContextBuildError as exc:
        logger.error("[LinkedInProfileContext] Failed to build profile context: {}", exc)
        return 1
    except ValueError as exc:
        logger.error("[LinkedInProfileContext] Profile context error: {}", exc)
        return 1
    except Exception:
        logger.exception("[LinkedInProfileContext] Unexpected error building profile context")
        return 1

    context_errors = validate_profile_context(context)
    _print_profile_context_summary(context, context_meta, user_id=user_id)

    if print_context_json:
        print(json.dumps(context, indent=2, default=str))

    if context_errors:
        logger.error("[LinkedInProfileContext] Profile context validation FAILED:")
        for error in context_errors:
            logger.error("  - {}", error)
        return 1

    logger.info(
        "[LinkedInProfileContext] Context complete source={} user_id={}",
        context_meta.get("source"),
        user_id,
    )
    return 0


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

    if args.print_context:
        context_code = _emit_profile_context(
            normalized,
            meta,
            user_id=user_id,
            persist=True,
            print_context_json=True,
        )
        if context_code != 0:
            return context_code

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
    """Normalize from a saved raw JSON fixture (offline Step 1.2 / Phase 2 context)."""
    try:
        profile = _load_fixture(args.from_fixture)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to load fixture: {}", exc)
        return 1

    logger.info("[LinkedInProfile] Loaded fixture {}", args.from_fixture)

    if args.print_context:
        logger.info("[LinkedInProfile] Phase 1 Step 1.2 — normalize (fixture context)")
        normalized = normalize_unipile_profile(profile)
        norm_errors = validate_normalized_profile(normalized)
        if norm_errors:
            logger.error("[LinkedInProfile] Normalized profile validation FAILED:")
            for error in norm_errors:
                logger.error("  - {}", error)
            return 1
        meta = {"profile_content_hash": compute_profile_content_hash(normalized)}
        return _emit_profile_context(
            normalized,
            meta,
            user_id="(fixture)",
            persist=False,
            print_context_json=True,
        )

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
        description=(
            "Fetch, normalize, persist LinkedIn profile (Phase 1) "
            "and build profile context (Phase 2)."
        )
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
        "--print-context",
        action="store_true",
        help="Build Phase 2 profile context and print summary + JSON to stdout",
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

    if args.print_context and args.dry_run:
        parser.error("--print-context cannot be combined with --dry-run")

    exit_code = asyncio.run(_run_async_entry(args))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
