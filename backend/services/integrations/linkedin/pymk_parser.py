"""Parse LinkedIn PYMK raw SDUI responses from Unipile."""

from __future__ import annotations

import base64
import re
from typing import Any, Optional

from loguru import logger

from services.integrations.linkedin.pymk_types import COHORT_LABELS, PymkCohort

_PROFILE_URL_PATTERN = re.compile(
    r'"profileCanonicalUrl":"(https://www\.linkedin\.com/in/[^"]+)"'
)
_NAME_PATTERN = re.compile(
    r'"firstName":"([^"]*)".*?"lastName":"([^"]*)"',
    re.DOTALL,
)
_PROFILE_ID_PATTERN = re.compile(
    r'(?:nonIterableProfileId|profileId)":"(ACo[^"]+)"',
)
_CONNECTION_STATE_PATTERN = re.compile(
    r'"connectionState":\{"key":"([^"]+)"',
)
_AVATAR_PAYLOAD_PATTERN = re.compile(
    r'"profilePictureRenderPayload":"([^"]*)"',
)
_MUTUAL_PATTERN = re.compile(r"(\d+\s+mutual connections?)", re.IGNORECASE)
_LICDN_PHOTO_PATTERN = re.compile(
    r"https://media\.licdn\.com/dms/image/v2/[A-Za-z0-9_-]+/"
    r"profile-displayphoto-shrink_(\d+)_\d+/[A-Za-z0-9_-]+/\d+/\d+"
    r"\?e=\d+&v=beta&t=[A-Za-z0-9_-]+"
)
_BACKGROUND_PATTERN = re.compile(
    r"https://media\.licdn\.com/dms/image/v2/[A-Za-z0-9_-]+/"
    r"profile-displaybackgroundimage-shrink_[^\"\s]+"
)
_CHILDREN_TEXT_PATTERN = re.compile(r'"children":\["([^"\\]{6,300})"\]')
_TEXTPROPS_HEADLINE_PATTERN = re.compile(
    r'"textProps":\{[^}]{0,600}?"children":\["([^"\\]{6,300})"\]',
)
_MAX_HEADLINE_SCAN = 15000
_SKIP_CHILDREN_TEXT = frozenset(
    {
        "Connect",
        "Withdraw invitation",
        "Pending",
        "Message",
        "Follow",
        "Following",
    }
)


def _decode_avatar_payload(payload: str) -> Optional[str]:
    """Decode LinkedIn SDUI base64 avatar payload to a display photo URL."""
    if not payload:
        return None
    try:
        padded = payload + ("=" * (-len(payload) % 4))
        raw = base64.b64decode(padded)
        text = raw.decode("utf-8", errors="ignore")
        return _pick_best_photo_url(text)
    except Exception as exc:
        logger.debug("[PymkParser] avatar decode failed: {}", exc)
    return None


def _pick_best_photo_url(text: str) -> Optional[str]:
    """Pick the smallest display photo URL from a text blob."""
    matches = list(_LICDN_PHOTO_PATTERN.finditer(text))
    if not matches:
        return None
    best = min(matches, key=lambda m: int(m.group(1)))
    return best.group(0)


def _normalize_profile_url(url: str) -> str:
    cleaned = url.strip().rstrip("/")
    if not cleaned.startswith("http"):
        return f"https://www.{cleaned.lstrip('/')}"
    return cleaned


def _parse_connection_state(segment: str) -> Optional[str]:
    """Parse connection state from a single profile segment only."""
    match = _CONNECTION_STATE_PATTERN.search(segment)
    if not match:
        return None
    state_key = match.group(1)
    if "state:invitation:" in state_key:
        return "invitation_pending"
    if "connected" in state_key.lower():
        return "connected"
    return None


def _is_headline_candidate(text: str, first_name: str) -> bool:
    """Return True when SDUI children text looks like a professional headline."""
    if not text or text in _SKIP_CHILDREN_TEXT:
        return False
    lower = text.lower()
    if lower.startswith("based on") or "mutual connection" in lower:
        return False
    if first_name and text.startswith(first_name) and "connect" in lower:
        return False
    if text.isdigit():
        return False
    markers = (
        "|",
        " at ",
        "@",
        "engineer",
        "strategist",
        "manager",
        "director",
        "founder",
        "student",
        "developer",
        "consultant",
        "lead",
        "ceo",
        "cto",
        "writer",
        "marketing",
        "seo",
    )
    if any(marker in lower for marker in markers):
        return True
    return len(text) > 40


def _headline_score(line: str) -> tuple[int, int]:
    markers = (
        "|",
        " at ",
        "@",
        "Engineer",
        "Strategist",
        "Manager",
        "Director",
        "Founder",
        "Student",
        "Developer",
        "Consultant",
        "Lead",
        "CEO",
        "CTO",
    )
    marker_hits = sum(1 for marker in markers if marker.lower() in line.lower())
    return (marker_hits, len(line))


def _extract_headline(segment: str, full_name: str) -> Optional[str]:
    """Extract professional headline from SDUI children/textProps nodes."""
    first_name = (full_name.split() or [""])[0]
    candidates: list[str] = []

    for pattern in (_CHILDREN_TEXT_PATTERN, _TEXTPROPS_HEADLINE_PATTERN):
        for match in pattern.finditer(segment):
            text = match.group(1).strip()
            if _is_headline_candidate(text, first_name):
                candidates.append(text)

    if not candidates:
        return None
    return max(candidates, key=_headline_score)


def _extract_background_url(segment: str) -> Optional[str]:
    match = _BACKGROUND_PATTERN.search(segment)
    return match.group(0) if match else None


def _extract_mutual_hint(segment: str) -> Optional[str]:
    match = _MUTUAL_PATTERN.search(segment)
    return match.group(1) if match else None


def _extract_sdui_data(raw: dict[str, Any]) -> str:
    if not isinstance(raw, dict):
        return ""
    if raw.get("object") == "LinkedinRawData" and isinstance(raw.get("data"), str):
        return raw["data"]
    if isinstance(raw.get("data"), str):
        return raw["data"]
    return ""


def _extract_photo_url(segment: str) -> Optional[str]:
    """Extract display photo URL from an SDUI segment."""
    avatar_payload_match = _AVATAR_PAYLOAD_PATTERN.search(segment)
    avatar_payload = avatar_payload_match.group(1) if avatar_payload_match else ""
    return _decode_avatar_payload(avatar_payload) or _pick_best_photo_url(segment)


def _parse_profile_segment(
    core_segment: str,
    extended_segment: str,
    profile_url: str,
) -> Optional[dict[str, Any]]:
    """Parse one PYMK profile from localized SDUI segments around profileCanonicalUrl."""
    name_match = _NAME_PATTERN.search(core_segment)
    if not name_match:
        return None

    profile_id_match = _PROFILE_ID_PATTERN.search(core_segment)
    if not profile_id_match:
        return None

    first_name = (name_match.group(1) or "").strip()
    last_name = (name_match.group(2) or "").strip()
    profile_id = profile_id_match.group(1)

    avatar_payload_match = _AVATAR_PAYLOAD_PATTERN.search(core_segment) or _AVATAR_PAYLOAD_PATTERN.search(
        extended_segment[:3000]
    )
    avatar_payload = avatar_payload_match.group(1) if avatar_payload_match else ""
    photo_url = (
        _decode_avatar_payload(avatar_payload)
        or _pick_best_photo_url(core_segment)
        or _pick_best_photo_url(extended_segment[:3000])
    )

    full_name = f"{first_name} {last_name}".strip()
    headline = _extract_headline(extended_segment, full_name)
    background_url = _extract_background_url(core_segment) or _extract_background_url(
        extended_segment
    )

    mutual_hint = _extract_mutual_hint(extended_segment) or _extract_mutual_hint(core_segment)
    connection_state = _parse_connection_state(core_segment) or _parse_connection_state(
        extended_segment
    )

    return {
        "profile_id": profile_id,
        "name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "headline": headline,
        "profile_url": _normalize_profile_url(profile_url),
        "photo_url": photo_url,
        "background_url": background_url,
        "mutual_connections_text": mutual_hint,
        "connection_state": connection_state,
    }


def _next_different_profile_start(
    all_matches: list[re.Match[str]],
    current_index: int,
    data_len: int,
) -> int:
    """Return the blob index of the next profile card (different LinkedIn slug)."""
    current_slug = all_matches[current_index].group(1).split("/in/")[-1].rstrip("/")
    for index in range(current_index + 1, len(all_matches)):
        slug = all_matches[index].group(1).split("/in/")[-1].rstrip("/")
        if slug != current_slug:
            return all_matches[index].start()
    return min(data_len, all_matches[current_index].start() + _MAX_HEADLINE_SCAN)


def _merge_profile_fields(target: dict[str, Any], source: dict[str, Any]) -> None:
    """Fill missing media and text fields on an existing PYMK profile."""
    for field in (
        "photo_url",
        "headline",
        "background_url",
        "mutual_connections_text",
        "connection_state",
    ):
        if not target.get(field) and source.get(field):
            target[field] = source[field]


def _determine_has_more(
    suggestions: list[dict[str, Any]],
    page_size: int,
    page_start: int,
    raw_data: str,
) -> bool:
    """Determine if there are more pages based on response data.

    LinkedIn's SDUI response doesn't contain an explicit 'has_more' indicator.
    We infer it based on:
    1. If we got fewer profiles than requested page_size, likely no more pages
    2. If we got exactly page_size, there might be more (but could also be exact end)
    3. Empty response definitely means no more

    This is a heuristic - LinkedIn may return exactly page_size on the last page.
    """
    count = len(suggestions)

    # Definitely no more if empty
    if count == 0:
        logger.debug("[PymkParser] has_more=False: no profiles found")
        return False

    # LinkedIn sometimes returns fewer items than requested even when there are more pages
    # Only disable has_more if we got 0 results or very few results (less than half page_size)
    if count < page_size // 2:
        logger.debug("[PymkParser] has_more=False: only {} results (threshold: {})", count, page_size // 2)
        return False

    # Assume there might be more pages
    logger.debug(
        "[PymkParser] has_more=True: count={} >= threshold={}",
        count,
        page_size // 2,
    )
    return True


def parse_pymk_response(
    raw: dict[str, Any],
    *,
    cohort: PymkCohort,
    page_start: int,
    page_size: int,
) -> dict[str, Any]:
    """Parse Unipile LinkedinRawData into normalized PYMK suggestions.

    Returns a dict with suggestions list and pagination hints.
    LinkedIn SDUI doesn't provide explicit pagination tokens - pagination is
    handled via pageStart/pageSize parameters.
    """
    data = _extract_sdui_data(raw)
    cohort_label = COHORT_LABELS[cohort]

    if not data:
        logger.warning("[PymkParser] empty SDUI data in response")
        return {
            "suggestions": [],
            "page_start": page_start,
            "page_size": page_size,
            "has_more": False,
            "cohort": cohort.value,
            "cohort_label": cohort_label,
        }

    all_url_matches = list(_PROFILE_URL_PATTERN.finditer(data))

    suggestions: list[dict[str, Any]] = []
    index_by_profile_id: dict[str, int] = {}

    for global_index, url_match in enumerate(all_url_matches):
        profile_url = url_match.group(1)
        core_start = max(0, url_match.start() - 1200)
        core_end = min(len(data), url_match.end() + 2200)
        core_segment = data[core_start:core_end]

        extended_end = _next_different_profile_start(
            all_url_matches,
            global_index,
            len(data),
        )
        extended_segment = data[url_match.start():extended_end]

        parsed = _parse_profile_segment(core_segment, extended_segment, profile_url)
        if not parsed:
            continue

        profile_id = parsed["profile_id"]
        if profile_id in index_by_profile_id:
            _merge_profile_fields(suggestions[index_by_profile_id[profile_id]], parsed)
            continue

        index_by_profile_id[profile_id] = len(suggestions)
        suggestions.append(parsed)

    for parsed in suggestions:
        reason_parts = [cohort_label]
        if parsed.get("mutual_connections_text"):
            reason_parts.append(parsed["mutual_connections_text"])
        parsed["reason"] = " · ".join(reason_parts)

    for parsed in suggestions:
        if parsed.get("photo_url"):
            continue
        slug = parsed["profile_url"].rstrip("/").split("/in/")[-1]
        slug_index = data.find(f"/in/{slug}")
        if slug_index < 0:
            continue
        photo_url = _extract_photo_url(data[slug_index : slug_index + 6000])
        if photo_url:
            parsed["photo_url"] = photo_url

    has_more = _determine_has_more(suggestions, page_size, page_start, data)
    logger.info(
        "[PymkParser] parsed cohort={} page_start={} count={} has_more={}",
        cohort.value,
        page_start,
        len(suggestions),
        has_more,
    )

    return {
        "suggestions": suggestions,
        "page_start": page_start,
        "page_size": page_size,
        "has_more": has_more,
        "cohort": cohort.value,
        "cohort_label": cohort_label,
    }
