"""Unit tests for PYMK SDUI response parser."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from services.integrations.linkedin.pymk_parser import parse_pymk_response
from services.integrations.linkedin.pymk_types import PymkCohort, build_pymk_unipile_request


ROOT = Path(__file__).resolve().parents[5]
FIXTURE_PATH = ROOT / "pymk-response.json"


def test_build_recent_activity_request_shape() -> None:
    body = build_pymk_unipile_request(
        "acct-123",
        PymkCohort.RECENT_ACTIVITY,
        page_start=0,
        page_size=10,
    )
    payload = body["body"]["clientArguments"]["payload"]
    assert body["account_id"] == "acct-123"
    assert payload["cohortReasonSource"] == "IN_SESSION_RELEVANCE"
    assert payload["pageStart"] == 0
    assert payload["isFirstPage"] is True


def test_build_same_school_requires_id() -> None:
    with pytest.raises(ValueError, match="school_id"):
        build_pymk_unipile_request("acct", PymkCohort.SAME_SCHOOL)


@pytest.mark.skipif(not FIXTURE_PATH.exists(), reason="pymk-response.json fixture missing")
def test_parse_real_pymk_fixture() -> None:
    raw = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    parsed = parse_pymk_response(
        raw,
        cohort=PymkCohort.RECENT_ACTIVITY,
        page_start=0,
        page_size=10,
    )
    assert parsed["cohort"] == "recent_activity"
    assert len(parsed["suggestions"]) >= 5
    first = parsed["suggestions"][0]
    assert first["profile_id"].startswith("ACo")
    assert first["name"]
    assert first["profile_url"].startswith("https://www.linkedin.com/in/")
    assert "recent activity" in first["reason"].lower()
    with_headline = [s for s in parsed["suggestions"] if s.get("headline")]
    assert len(with_headline) >= 3, "expected headlines for most PYMK profiles"
    with_photo = [s for s in parsed["suggestions"] if s.get("photo_url")]
    if with_photo:
        first_with_photo = with_photo[0]
        assert first_with_photo["photo_url"].startswith("https://media.licdn.com/")
        assert "profile-displayphoto-shrink_" in first_with_photo["photo_url"]
