"""Calendar SIF — Phase A: ``GET /calendar-generation/calendar/sif-search`` API tests.

Proves the semantic search endpoint:
- filters txtai hits down to the user's calendar document ids
  (``user:{uid}:calendar_latest:*``) — anything else is dropped;
- enriches each hit with stored document text and a human kind label;
- respects ``limit`` (sorted by score, best first);
- works for both numeric and raw Clerk string user ids (the prefix
  follows the authenticated user id);
- on failure returns empty hits + explicit error (never fabricated).

txtai is stubbed at the module level; the endpoint lazily imports
``TxtaiIntelligenceService`` so ``services.intelligence.txtai_service``
is the injection point (mirrors the strategy SIF search pattern).
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.content_planning.utils.rate_limiter import register_rate_limit_hit

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

NUMERIC_UID = "user-42"
CLERK_ID = "user_str_abc123"

TXTAI_MOD = "services.intelligence.txtai_service"


class FakeSIFService:
    """Stands in for TxtaiIntelligenceService with calendar-scoped hits."""

    def __init__(self, user_id):
        self.user_id = user_id

    def _source_id(self, kind: str) -> str:
        return f"user:{self.user_id}:calendar_latest:{kind}"

    async def search(self, query: str, limit: int = 5):
        source = self._source_id
        return [
            (source("daily_schedule"), 0.921),
            (source("ai_insights"), 0.77),
            (f"user:{self.user_id}:other_calendar:weekly_themes", 0.99),
            "bare-string-result",
        ]

    def get_document_text(self, doc_id) -> str:
        return f"DETAIL-{doc_id}"


@pytest.fixture()
def make_client(monkeypatch):
    monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", FakeSIFService)

    def _build(clerk: bool = False):
        import middleware.auth_middleware as _auth
        import api.content_planning.api.routes.calendar_generation as _cal

        app = FastAPI()
        app.include_router(_cal.router)
        app.dependency_overrides[_auth.get_current_user] = lambda: (
            {
                "id": NUMERIC_UID, "uid": NUMERIC_UID,
                "clerk_user_id": NUMERIC_UID, "email": "t@e.com", "is_active": True,
            }
            if not clerk
            else {
                "id": CLERK_ID, "uid": None,
                "clerk_user_id": CLERK_ID, "email": "t@e.com", "is_active": True,
            }
        )
        return TestClient(app, raise_server_exceptions=True)

    return _build


class TestSearchEndpoint:
    def test_returns_calendar_hits_only_with_labels(self, make_client):
        client = make_client()
        user_id = NUMERIC_UID

        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "schedule", "limit": 4},
        )
        assert resp.status_code == 200, resp.text

        data = resp.json()["data"]
        assert data["query"] == "schedule"
        assert data["source_id"] == f"user:{user_id}:calendar_latest"

        hits = data["hits"]
        ids = [h["id"] for h in hits]
        assert ids == [
            f"user:{user_id}:calendar_latest:daily_schedule",
            f"user:{user_id}:calendar_latest:ai_insights",
        ]
        assert hits[0]["kind"] == "daily_schedule"
        assert hits[0]["kind_label"] == "Daily schedule"
        assert hits[0]["score"] == 0.921
        assert hits[0]["text"] == f"DETAIL-{ids[0]}"
        assert hits[1]["kind_label"] == "AI insights"

    def test_limit_applied_after_filter(self, make_client):
        client = make_client()

        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "q", "limit": 1},
        )
        data = resp.json()["data"]
        assert len(data["hits"]) == 1
        assert data["hits"][0]["id"].endswith(":daily_schedule")

    def test_clerk_string_id_prefix_used(self, make_client):
        client = make_client(clerk=True)

        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "insights", "limit": 4},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["source_id"] == f"user:{CLERK_ID}:calendar_latest"
        ids = [h["id"] for h in data["hits"]]
        assert all(
            h_id.startswith(f"user:{CLERK_ID}:calendar_latest:") for h_id in ids
        )

    def test_no_fabricated_answers_when_search_fails(self, monkeypatch):
        """SIF search failures surface a structured code — clients must never
        see raw exception text (R5.1), and never a fabricated answer."""

        class BrokenSIFService:
            async def search(self, query, limit=5):  # noqa: ARG002
                raise RuntimeError(
                    "internal txtai exception: c:/secret/path.py line 42"
                )

        monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", BrokenSIFService)

        import middleware.auth_middleware as _auth
        import api.content_planning.api.routes.calendar_generation as _cal

        app = FastAPI()
        app.include_router(_cal.router)
        app.dependency_overrides[_auth.get_current_user] = lambda: {
            "id": NUMERIC_UID, "uid": NUMERIC_UID,
            "clerk_user_id": NUMERIC_UID, "email": "t@e.com", "is_active": True,
        }

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "schedule", "limit": 4},
        )

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["hits"] == []
        # R5.1: structured error contract — no raw exception text to clients
        assert data["error"] == {"code": "search_unavailable"}
        import json as _json

        body = _json.dumps(resp.json())
        assert "secret" not in body
        assert "internal txtai exception" not in body

    def test_empty_query_rejected_422(self, make_client):
        """R6.1: empty/whitespace query must not load the index."""
        client = make_client()
        for query in ("", "   "):
            resp = client.get(
                "/calendar-generation/calendar/sif-search",
                params={"query": query, "limit": 4},
            )
            assert resp.status_code == 422, (query, resp.text)
            assert resp.json()["detail"]["code"] == "invalid_query"

    def test_overlong_query_rejected_422(self, make_client):
        """R6.1: >512 chars is abuse-shaped."""
        client = make_client()
        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "x" * 513, "limit": 4},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["detail"]["code"] == "invalid_query"

    def test_search_rate_limited_429(self, make_client):
        """R6.1: beyond the 20/min budget the endpoint stops loading txtai."""
        from api.content_planning.utils import rate_limiter as rl

        rl._clear()
        client = make_client()
        # Fill the budget BEFORE the request: the enforced call must 429
        # WITHOUT re-registering an extra hit.
        for _ in range(rl.CALENDAR_SIF_SEARCH_LIMITS[0]):
            register_rate_limit_hit("calendar_sif_search", NUMERIC_UID)

        resp = client.get(
            "/calendar-generation/calendar/sif-search",
            params={"query": "schedule", "limit": 4},
        )
        assert resp.status_code == 429, resp.text
        assert resp.json()["detail"]["code"] == "rate_limited"

    def test_search_valid_query_registers_one_hit_each(self, make_client):
        """R6.1: hits recorded exactly once per valid search."""
        from api.content_planning.utils import rate_limiter as rl

        rl._clear()
        client = make_client()
        client.get("/calendar-generation/calendar/sif-search", params={"query": "a", "limit": 4})
        client.get("/calendar-generation/calendar/sif-search", params={"query": "b", "limit": 4})
        scope_key = [k for k in rl._hits.keys() if "calendar_sif_search:user-42" in k]
        assert len(scope_key) == 1
        hits = rl._hits[scope_key[0]]
        assert len(hits) == 2
