"""Tests for the sitemap SSOT (services/seo/sitemap_ssot.py).

The SSOT stores the discovered sitemap URL plus a fetched inventory (URL
list, lastmod bounds, total, fetched_at) into the user's own DB
(``WebsiteAnalysis.crawl_result['sitemap_analysis']``) so every consumer
reads once and only re-fetches when the inventory goes stale.

Multi-tenancy is pinned here as well: all reads/writes go through a
throwaway per-user SQLite session; nothing is shared across users.
"""

import shutil
from datetime import datetime, timedelta
from uuid import uuid4

import importlib

import pytest

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user
from services.seo.sitemap_ssot import (
    SITEMAP_SSOT_TTL_DAYS,
    get_fresh_inventory,
    get_stored_sitemap_url,
    is_inventory_fresh,
    save_sitemap_inventory,
)

WEBSITE_URL = "https://acme-corp.example.com"
SITEMAP_URL = "https://acme-corp.example.com/sitemap.xml"


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    """Redirect every workspace root lookup into a per-test temp dir."""
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    """Throwaway user + fresh per-user SQLite session, cleaned up after."""
    user_id = f"ssot_{uuid4().hex[:10]}"
    db = get_session_for_user(user_id)
    ctx = {"user_id": user_id, "db": db, "workspace": workspace_redirect}
    try:
        yield ctx
    finally:
        try:
            db.close()
        finally:
            engine = db_engine_mod._user_engines.pop(user_id, None)
            if engine is not None:
                engine.dispose()
            shutil.rmtree(str(workspace_redirect), ignore_errors=True)


def _seed_analysis(db, user_id):
    """Create the onboarding session + website analysis rows the SSOT writes into."""
    from models.onboarding import OnboardingSession, WebsiteAnalysis

    session = OnboardingSession(user_id=user_id)
    db.add(session)
    db.commit()
    analysis = WebsiteAnalysis(session_id=session.id, website_url=WEBSITE_URL, crawl_result={})
    db.add(analysis)
    db.commit()
    return analysis


def _inventory(total=3, url_count=3):
    return {
        "total_urls": total,
        "urls": [f"{WEBSITE_URL}/page-{i}" for i in range(url_count)],
        "lastmod_min": "2026-01-01T00:00:00+00:00",
        "lastmod_max": "2026-08-01T00:00:00+00:00",
        "fetched_at": datetime.utcnow().isoformat(),
    }


class TestSitemapSsotRoundtrip:
    def test_save_then_read_back(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_id)

        assert get_stored_sitemap_url(db, user_id) is None
        assert get_fresh_inventory(db, user_id) is None

        saved = save_sitemap_inventory(db, user_id, WEBSITE_URL, SITEMAP_URL, _inventory())
        assert saved is True

        assert get_stored_sitemap_url(db, user_id) == SITEMAP_URL
        inv = get_fresh_inventory(db, user_id)
        assert inv is not None
        assert inv["total_urls"] == 3
        assert inv["urls"] == [f"{WEBSITE_URL}/page-{i}" for i in range(3)]
        assert inv["lastmod_min"].startswith("2026-01-01")
        assert "fetched_at" in inv

    def test_no_analysis_rows_returns_none_and_save_fails(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        assert get_stored_sitemap_url(db, user_id) is None
        assert get_fresh_inventory(db, user_id) is None
        assert save_sitemap_inventory(db, user_id, WEBSITE_URL, SITEMAP_URL, _inventory()) is False

    def test_inventory_url_list_is_capped(self, user_db):
        """A huge sitemap must not bloat the JSON column unbounded."""
        user_id, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_id)

        huge = _inventory(total=5000, url_count=5000)
        assert save_sitemap_inventory(db, user_id, WEBSITE_URL, SITEMAP_URL, huge) is True

        inv = get_fresh_inventory(db, user_id)
        assert inv is not None
        assert len(inv["urls"]) <= 2000
        # total_urls keeps the real count even though the URL list is capped
        assert inv["total_urls"] == 5000


class TestInventoryFreshness:
    def test_fresh_inventory_passes_ttl(self):
        ssot = {"inventory": {"fetched_at": datetime.utcnow().isoformat()}}
        assert is_inventory_fresh(ssot) is True

    def test_stale_inventory_expires_after_ttl(self):
        stale_at = datetime.utcnow() - timedelta(days=SITEMAP_SSOT_TTL_DAYS + 1)
        ssot = {"inventory": {"fetched_at": stale_at.isoformat()}}
        assert is_inventory_fresh(ssot) is False

    def test_missing_or_malformed_inventory_is_not_fresh(self):
        assert is_inventory_fresh({}) is False
        assert is_inventory_fresh({"inventory": {}}) is False
        assert is_inventory_fresh({"inventory": {"fetched_at": "not-a-date"}}) is False

    def test_get_fresh_inventory_returns_none_when_stale(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_id)

        stale = _inventory()
        stale["fetched_at"] = (datetime.utcnow() - timedelta(days=SITEMAP_SSOT_TTL_DAYS + 2)).isoformat()
        assert save_sitemap_inventory(db, user_id, WEBSITE_URL, SITEMAP_URL, stale) is True

        # URL stays as SSOT, but the stale inventory must not be served.
        assert get_stored_sitemap_url(db, user_id) == SITEMAP_URL
        assert get_fresh_inventory(db, user_id) is None


class TestMultiTenancyIsolation:
    def test_inventories_are_isolated_per_user(self, user_db):
        """Two users sharing the same sitemap URL must each have their own SSOT."""
        user_a, db = user_db["user_id"], user_db["db"]
        _seed_analysis(db, user_a)
        assert save_sitemap_inventory(db, user_a, WEBSITE_URL, SITEMAP_URL, _inventory(total=111)) is True

        user_b = f"ssot_{uuid4().hex[:10]}"
        db_b = get_session_for_user(user_b)
        try:
            _seed_analysis(db_b, user_b)
            assert save_sitemap_inventory(db_b, user_b, WEBSITE_URL, SITEMAP_URL, _inventory(total=222)) is True

            inv_a = get_fresh_inventory(db, user_a)
            inv_b = get_fresh_inventory(db_b, user_b)
            assert inv_a["total_urls"] == 111
            assert inv_b["total_urls"] == 222
        finally:
            db_b.close()
            engine = db_engine_mod._user_engines.pop(user_b, None)
            if engine is not None:
                engine.dispose()
