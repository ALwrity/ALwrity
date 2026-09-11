"""SIF x Strategy — Phase SIF-Search: ``GET /strategy/sif-search`` API tests.

Proves the Semantic Dashboard's preset-query endpoint:
- filters txtai hits down to the active strategy's document ids
  (``user:{uid}:strategy_active:current:*``) — anything else is dropped;
- enriches each hit with the stored document text and a human kind label;
- respects ``limit`` (sorted by score, best first);
- works for both numeric and raw Clerk string user ids (the prefix follows
  the authenticated user id, so no activation row is required).

txtai is stubbed at the module level; the endpoint lazily imports
``TxtaiIntelligenceService`` so ``services.intelligence.txtai_service`` is
the injection point (mirrors the onboarding ``search_sif_index`` pattern).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

NUMERIC_UID = 42
CLERK_ID = "user_str_abc123"

TXTAI_MOD = "services.intelligence.txtai_service"


class FakeSIFService:
    """Stands in for TxtaiIntelligenceService with strategy-scoped hits.

    ``search`` returns two on-strategy hits, one off-strategy hit and one
    bare string result (kept / dropped edge cases), using the passed user
    id so the prefix matches the authenticated caller.
    """

    def __init__(self, user_id):
        self.user_id = user_id

    def _strategy_id(self, kind: str) -> str:
        return f"user:{self.user_id}:strategy_active:current:{kind}"

    async def search(self, query: str, limit: int = 5):
        strategy = self._strategy_id
        return [
            (strategy("form_summary"), 0.921),
            (strategy("competitive_analysis"), 0.77),
            (f"user:{self.user_id}:website_page_1", 0.99),
            "bare-string-result",
        ]

    def get_document_text(self, doc_id) -> str:
        return f"DETAIL-{doc_id}"


@pytest.fixture()
def make_client(monkeypatch):
    monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", FakeSIFService)

    def _build(clerk: bool = False):
        from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
        from middleware.auth_middleware import get_current_user

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: (
            {
                "id": str(NUMERIC_UID), "uid": str(NUMERIC_UID),
                "clerk_user_id": str(NUMERIC_UID), "email": "t@e.com", "is_active": True,
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
    def test_returns_strategy_hits_only_with_labels(self, make_client):
        client = make_client()
        user_id = str(NUMERIC_UID)

        resp = client.get("/strategy/sif-search", params={"query": "objectives", "limit": 4})
        assert resp.status_code == 200, resp.text

        data = resp.json()["data"]
        assert data["query"] == "objectives"
        assert data["source_id"] == f"user:{user_id}:strategy_active:current"

        hits = data["hits"]
        ids = [h["id"] for h in hits]
        # Off-strategy hit + bare string dropped; on-strategy kept, best first.
        assert ids == [
            f"user:{user_id}:strategy_active:current:form_summary",
            f"user:{user_id}:strategy_active:current:competitive_analysis",
        ]
        assert hits[0]["kind"] == "form_summary"
        assert hits[0]["kind_label"] == "Strategy summary"
        assert hits[0]["score"] == 0.921
        assert hits[0]["text"] == f"DETAIL-{ids[0]}"
        assert hits[1]["kind_label"] == "Competitive analysis"

    def test_limit_is_applied_after_filter(self, make_client):
        client = make_client()

        resp = client.get("/strategy/sif-search", params={"query": "q", "limit": 1})
        data = resp.json()["data"]
        assert len(data["hits"]) == 1
        assert data["hits"][0]["id"].endswith(":form_summary")

    def test_clerk_string_id_prefix_used(self, make_client):
        client = make_client(clerk=True)

        resp = client.get("/strategy/sif-search", params={"query": "persona", "limit": 4})
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["source_id"] == f"user:{CLERK_ID}:strategy_active:current"
        ids = [h["id"] for h in data["hits"]]
        assert all(h_id.startswith(f"user:{CLERK_ID}:strategy_active:current:") for h_id in ids)

    def test_no_fallback_answers_when_search_fails(self, monkeypatch):
        """SIF search failures must not produce canned/default answers."""

        class BrokenSIFService:
            async def search(self, query, limit=5):  # noqa: ARG002
                raise RuntimeError("txtai index unavailable")

        monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", BrokenSIFService)

        from api.content_planning.api.content_strategy.endpoints.strategy_wizard_endpoints import router
        from middleware.auth_middleware import get_current_user

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: {
            "id": str(NUMERIC_UID), "uid": str(NUMERIC_UID),
            "clerk_user_id": str(NUMERIC_UID), "email": "t@e.com", "is_active": True,
        }

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.get("/strategy/sif-search", params={"query": "objectives", "limit": 4})

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["hits"] == []
        assert data.get("error")  # explicit failure surfaced, never a fabricated answer