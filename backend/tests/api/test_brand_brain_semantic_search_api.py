"""Brand Brain — Phase 2: ``GET /api/brand-brain/semantic-search`` API tests.

Proves the unified scoped semantic search (the honest superset of the three
existing per-domain searches):

- buckets raw txtai hits by doc-id prefix into ``strategy`` / ``calendar`` /
  ``onboarding`` (strategy ``user:{uid}:strategy_active:current:*``, calendar
  ``user:{uid}:calendar_latest:*``, everything else = onboarding);
- honors ``scope`` in {all, onboarding, strategy, calendar} after the engine
  fetch;
- labels strategy + calendar kinds and onboarding ``metadata.type``;
- dedups identical doc ids across raw results (keeps the best score);
- never fabricates answers on engine failure (empty hits + explicit error);
- bounds ``limit`` to 1..20 (422 outside) and requires auth (401).

txtai is stubbed at module level; the endpoint lazily imports
``TxtaiIntelligenceService`` so ``services.intelligence.txtai_service`` is
the injection point (mirrors the strategy/calendar search tests).
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


def _user(uid: str, clerk: bool = False) -> dict:
    if clerk:
        return {"id": uid, "uid": None, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}
    return {"id": uid, "uid": uid, "clerk_user_id": uid, "email": "t@e.com", "is_active": True}


class FakeSIFService:
    """Stands in for TxtaiIntelligenceService with hits across all 3 domains.

    Mixes tuple and dict hit shapes (both are produced by txtai depending on
    path), and returns one duplicate doc id to exercise all-scope dedup.
    """

    def __init__(self, user_id):
        self.user_id = user_id

    def _sid(self, kind: str) -> str:
        return f"user:{self.user_id}:strategy_active:current:{kind}"

    def _cid(self, kind: str) -> str:
        return f"user:{self.user_id}:calendar_latest:{kind}"

    async def search(self, query: str, limit: int = 5):
        return [
            (self._sid("form_summary"), 0.921),
            {"id": self._cid("daily_schedule"), "score": 0.88},
            {"id": f"wa_{self.user_id}_1", "score": 0.95, "text": "Website analysis detail"},
            {"id": f"wa_{self.user_id}_1", "score": 0.6, "text": "stale lower-score duplicate"},
        ]

    def get_document_text(self, doc_id) -> str:
        return f"DETAIL-{doc_id}"

    def get_document_metadata(self, doc_id):
        if str(doc_id).startswith("wa_"):
            return {"type": "website_analysis"}
        return None


@pytest.fixture()
def make_client(monkeypatch):
    monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", FakeSIFService)

    def _build(clerk: bool = False):
        import api.brand_brain.router as _bb
        from middleware.auth_middleware import get_current_user

        app = FastAPI()
        app.include_router(_bb.router)
        app.dependency_overrides[get_current_user] = lambda: _user(
            CLERK_ID if clerk else str(NUMERIC_UID), clerk=clerk
        )
        return TestClient(app, raise_server_exceptions=True)

    return _build


class TestUnifiedSemanticSearch:
    def test_all_scope_buckets_and_dedups(self, make_client):
        client = make_client()
        user_id = str(NUMERIC_UID)

        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "our positioning and roadmap", "scope": "all", "limit": 4},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["query"] == "our positioning and roadmap"
        assert data["scope"] == "all"

        hits = data["hits"]
        # sort by score desc; duplicate wa_{uid}_1 collapsed to its best score
        assert [h["id"] for h in hits] == [
            f"wa_{user_id}_1",
            f"user:{user_id}:strategy_active:current:form_summary",
            f"user:{user_id}:calendar_latest:daily_schedule",
        ]
        assert [h["domain"] for h in hits] == ["onboarding", "strategy", "calendar"]

        wa = hits[0]
        assert wa["score"] == 0.95
        assert wa["text"] == "Website analysis detail"
        assert wa["kind"] == "website_analysis"
        assert wa["kind_label"] == "Website analysis"

        strat = hits[1]
        assert strat["kind"] == "form_summary"
        assert strat["kind_label"] == "Strategy summary"
        assert strat["score"] == 0.921
        assert strat["text"] == f"DETAIL-{strat['id']}"

        cal = hits[2]
        assert cal["kind"] == "daily_schedule"
        assert cal["kind_label"] == "Daily schedule"

    @pytest.mark.parametrize(
        ("scope", "expected_kind_label", "expected_domain"),
        [
            ("strategy", "Strategy summary", "strategy"),
            ("calendar", "Daily schedule", "calendar"),
            ("onboarding", "Website analysis", "onboarding"),
        ],
    )
    def test_scope_filters_to_single_domain(self, make_client, scope, expected_kind_label, expected_domain):
        client = make_client()
        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "scope": scope, "limit": 4},
        )
        assert resp.status_code == 200, resp.text
        hits = resp.json()["data"]["hits"]
        assert len(hits) == 1
        assert hits[0]["domain"] == expected_domain
        assert hits[0]["kind_label"] == expected_kind_label

    def test_invalid_scope_rejected(self, make_client):
        client = make_client()
        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "scope": "scheduler", "limit": 4},
        )
        assert resp.status_code == 400, resp.text
        assert "scheduler" in resp.json()["detail"]

    def test_limit_bounds(self, make_client):
        client = make_client()
        assert client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "limit": 25},
        ).status_code == 422
        assert client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "limit": 0},
        ).status_code == 422

    def test_limit_applied_after_bucketing(self, make_client):
        client = make_client()
        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "scope": "all", "limit": 2},
        )
        data = resp.json()["data"]
        assert len(data["hits"]) == 2
        assert data["hits"][0]["id"].startswith("wa_")
        assert data["hits"][1]["domain"] == "strategy"

    def test_clerk_string_id_prefix_used(self, make_client):
        client = make_client(clerk=True)
        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "q", "scope": "strategy", "limit": 4},
        )
        hits = resp.json()["data"]["hits"]
        assert resp.status_code == 200, resp.text
        assert all(h["id"].startswith(f"user:{CLERK_ID}:strategy_active:current:") for h in hits)

    def test_no_fabrication_when_search_fails(self, monkeypatch):
        class BrokenSIFService:
            async def search(self, query, limit=5):  # noqa: ARG002
                raise RuntimeError("txtai index unavailable")

        monkeypatch.setattr(f"{TXTAI_MOD}.TxtaiIntelligenceService", BrokenSIFService)

        import api.brand_brain.router as _bb
        from middleware.auth_middleware import get_current_user

        app = FastAPI()
        app.include_router(_bb.router)
        app.dependency_overrides[get_current_user] = lambda: _user(str(NUMERIC_UID))

        client = TestClient(app, raise_server_exceptions=True)
        resp = client.get(
            "/api/brand-brain/semantic-search",
            params={"query": "anything", "scope": "all", "limit": 4},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["hits"] == []
        assert data.get("error")  # explicit failure surfaced, never a fabricated answer

    def test_auth_required(self):
        import api.brand_brain.router as _bb
        from middleware.auth_middleware import get_current_user
        from fastapi import HTTPException

        app = FastAPI()
        app.include_router(_bb.router)

        def _deny():
            raise HTTPException(status_code=401, detail="Unauthorized")

        app.dependency_overrides[get_current_user] = _deny
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/brand-brain/semantic-search", params={"query": "q"})
        assert resp.status_code == 401


class TestBrandBrainRouterMounted:
    def test_registered_in_router_manager(self):
        from alwrity_utils.router_manager import OPTIONAL_ROUTER_REGISTRY

        entry = next((e for e in OPTIONAL_ROUTER_REGISTRY if e["name"] == "brand_brain"), None)
        assert entry is not None, "brand_brain router not registered in OPTIONAL_ROUTER_REGISTRY"
        assert entry["module"] == "api.brand_brain.router"
        assert entry["attr"] == "router"

    def test_search_path_prefixed(self):
        import api.brand_brain.router as _bb

        paths = [r.path for r in _bb.router.routes]
        assert "/api/brand-brain/semantic-search" in paths