"""Phase 1C TDD — dead SERP-gap routes must be wired (no 404).

Leaves content-strategy / calendar untouched. Reuses smoke-test env pattern.
"""
import importlib
import os
import sys
import types
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("STRIPE_MODE", "test")
os.environ.setdefault(
    "STRIPE_PLAN_PRICE_MAPPING_TEST",
    '{"free":{"monthly":"price_test_free"},"basic":{"monthly":"price_test_basic"},"pro":{"monthly":"price_test_pro"}}',
)
os.environ.setdefault(
    "OAUTH_TOKEN_ENCRYPTION_KEY",
    "1KLwO81o21nJVGkxTIihuog680QmlyCx0FB4y-_76PA=",
)
if "spacy" not in sys.modules:
    _spacy = types.ModuleType("spacy")
    _spacy.load = lambda _m: object()
    sys.modules["spacy"] = _spacy

REQUIRED = {
    "/api/seo-dashboard/serp-gaps",
    "/api/seo-dashboard/competitor-content",
}


def test_serp_gap_routes_wired():
    mod = importlib.import_module("backend.app")
    registered = {r.path for r in mod.app.routes}
    missing = REQUIRED - registered
    assert not missing, f"dead routes still 404: {sorted(missing)}"
