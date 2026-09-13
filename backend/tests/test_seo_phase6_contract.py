"""Phase 6 TDD — cross-stack contract: every frontend SEO client path exists.

Guards both drift directions: frontend typos/prefixes (the /api/seo-tools/
404 class of bug) fail here without browsers or auth. Slow (imports app),
same as the existing smoke test.
Leaves content-strategy / calendar untouched.
"""
import importlib
import os
import re
import sys
import types
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
FRONTEND_SRC = REPO_ROOT / "frontend" / "src"
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

CLIENT_FILES = [
    "api/enterpriseSeoApi.ts",
    "api/llmInsightsGenerator.ts",
]

_CALL_RE = re.compile(r"\.(?:get|post|put|delete)\(\s*'([^']+)'")


def _frontend_paths() -> set:
    paths = set()
    for rel in CLIENT_FILES:
        src = (FRONTEND_SRC / rel).read_text(encoding="utf-8", errors="ignore")
        for m in _CALL_RE.finditer(src):
            p = m.group(1).split("?")[0].rstrip("/")
            if p.startswith("/api/seo"):
                paths.add(p)
    return paths


def test_no_stale_seo_tools_prefix_in_clients():
    for rel in CLIENT_FILES:
        src = (FRONTEND_SRC / rel).read_text(encoding="utf-8", errors="ignore")
        assert "/api/seo-tools/" not in src, f"{rel} still uses dead prefix"


def test_every_frontend_seo_path_is_registered():
    module = importlib.import_module("backend.app")
    registered = {
        re.sub(r":path\}", "}", route.path).rstrip("/")
        for route in module.app.routes
        if hasattr(route, "path")
    }
    used = _frontend_paths()
    assert used, "no frontend SEO paths found — extractor broken?"
    missing = {p for p in used if p not in registered}
    assert not missing, f"frontend calls unregistered backend routes: {sorted(missing)}"
