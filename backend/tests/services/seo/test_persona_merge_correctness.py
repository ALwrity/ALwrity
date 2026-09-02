"""Tests for Phase 4 of the advertools RCA plan: result correctness.

RCA context (tracker #520): two concurrent pipelines wrote persona
augmentation last-writer-wins — the thinner 1-URL fallback audit could
overwrite the richer 15-URL audit. Phase 2's mutex removed the concurrency,
but a DEGRADED run (e.g. 429 circuit tripped, root-only audit) can still
replace richer stored data.

Phase 4 contract:

- **Merge-don't-clobber**: when the incoming result is degraded, each
  ``brand_analysis`` / ``site_health`` key keeps the RICHER of (stored,
  incoming) by element count. Clean (non-degraded) results overwrite
  wholesale and clear the degraded flags.
- **Degradation transparency**: degraded/rate_limited flags + reasons are
  persisted into ``brand_analysis`` / ``seo_audit.site_health`` so the UI
  can show partial-data warnings, and the executor attaches them to results
  (sitemap failure, root-only audit fallback, robots failure).
"""

import importlib
import shutil
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user
from services.scheduler.executors.advertools_executor import AdvertoolsExecutor

WEBSITE_URL = "https://acme-corp.example.com"


@pytest.fixture
def workspace_redirect(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    root.mkdir()
    monkeypatch.setattr(workspace_paths, "get_workspace_root", lambda: root)
    monkeypatch.setattr(storage_paths, "get_workspace_root", lambda: root)
    return root


@pytest.fixture
def user_db(workspace_redirect):
    user_id = f"merge_{uuid4().hex[:10]}"
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
    from models.onboarding import OnboardingSession, WebsiteAnalysis

    session = OnboardingSession(user_id=user_id)
    db.add(session)
    db.commit()
    analysis = WebsiteAnalysis(session_id=session.id, website_url=WEBSITE_URL)
    db.add(analysis)
    db.commit()
    return analysis


def _rich_result():
    """A full 15-URL-style audit result (not degraded)."""
    return {
        "success": True,
        "themes": ["seo", "content marketing", "analytics", "automation", "ai"],
        "page_count": 15,
        "avg_word_count": 1250,
        "link_health": {"total_links_found": 240, "broken_links": 3},
        "redirect_audit": {"redirects_found": 4},
        "image_seo": {"images_without_alt": 2},
        "page_status": {"200": 14, "404": 1},
        "url_structure": {"avg_depth": 2.4},
        "freshness": {"freshness_score": 82.0},
        "robots_txt": {"compliance_score": 100},
        "crawl_budget": {"pages_crawled": 30, "budget_utilization": 0.75},
    }


def _thin_degraded_result():
    """The root-only fallback audit (1 URL, rate-limited sitemap)."""
    result = {
        "success": True,
        "themes": ["homepage"],
        "page_count": 1,
        "avg_word_count": 300,
        "link_health": {"total_links_found": 8, "broken_links": 0},
        "redirect_audit": {"redirects_found": 0},
        "image_seo": {"images_without_alt": 0},
        "page_status": {"200": 1},
        "url_structure": {"avg_depth": 0.0},
        "freshness": {"freshness_score": 0.0},
        "robots_txt": {"compliance_score": 100},
        "crawl_budget": {"pages_crawled": 1},
        "degraded": True,
        "degraded_reasons": ["sitemap analysis failed: HTTP 429", "sitemap produced no audit URLs; audited site root only"],
        "rate_limited": True,
    }
    return result


def _get_brand(analysis):
    return analysis.brand_analysis or {}


# ---------------------------------------------------------------------------
# 1. Richer-wins primitive
# ---------------------------------------------------------------------------


class TestRicher:
    def test_richer_list_wins(self):
        from services.scheduler.executors.advertools_executor import _richer

        existing = ["a", "b", "c"]
        incoming = ["x"]
        assert _richer(existing, incoming) == existing

    def test_richer_dict_wins(self):
        from services.scheduler.executors.advertools_executor import _richer

        existing = {"total_links_found": 240, "broken_links": 3}
        incoming = {"total_links_found": 8}
        assert _richer(existing, incoming) is existing

    def test_none_or_empty_incoming_keeps_existing(self):
        from services.scheduler.executors.advertools_executor import _richer

        assert _richer(["a"], []) == ["a"]
        assert _richer({"k": 1}, {}) == {"k": 1}
        assert _richer("value", None) == "value"

    def test_richer_incoming_wins_when_bigger(self):
        from services.scheduler.executors.advertools_executor import _richer

        assert _richer(["a"], ["a", "b", "c"]) == ["a", "b", "c"]

    def test_scalar_tie_keeps_existing(self):
        """Conservative tie-break: a degraded run's scalars (e.g. zeroed
        scores from a root-only audit) must never displace stored metrics."""
        from services.scheduler.executors.advertools_executor import _richer

        assert _richer(327, 15) == 327
        assert _richer(78.0, 0.0) == 78.0


# ---------------------------------------------------------------------------
# 2. Persona augmentation merge
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestPersonaAugmentationMerge:
    async def test_degraded_result_keeps_richer_existing_and_flags(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)

        # First: a full, clean run stores rich data.
        executor = AdvertoolsExecutor()
        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _rich_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        assert len(_get_brand(analysis)["augmented_themes"]) == 5

        # Then: a degraded run must not clobber the rich data per-key.
        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _thin_degraded_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        brand = _get_brand(analysis)

        assert len(brand["augmented_themes"]) == 5  # richer kept
        assert brand["link_health"]["total_links_found"] == 240
        assert brand["crawl_budget"]["pages_crawled"] == 30
        # Degradation is transparent:
        assert brand["degraded"] is True
        assert brand["rate_limited"] is True
        assert any("429" in r for r in brand["degraded_reasons"])
        # ... and the audit timestamp is still fresh.
        assert brand["last_advertools_audit"] is not None

    async def test_clean_result_overwrites_and_clears_flags(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)
        executor = AdvertoolsExecutor()

        # Degraded first (leaves flags + thin data).
        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _thin_degraded_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)

        # Then a clean, full run: wholesale overwrite + flags cleared.
        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _rich_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        brand = _get_brand(analysis)

        assert len(brand["augmented_themes"]) == 5
        assert brand["link_health"]["total_links_found"] == 240
        assert brand["degraded"] is False
        assert brand["degraded_reasons"] == []
        assert brand["rate_limited"] is False

    async def test_avg_word_count_guarded_when_degraded(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)
        executor = AdvertoolsExecutor()

        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _rich_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        assert analysis.content_strategy_insights["avg_content_length"] == 1250

        # Degraded run must not shrink the stored avg content length.
        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _thin_degraded_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        assert analysis.content_strategy_insights["avg_content_length"] == 1250

    async def test_last_advertools_audit_always_refreshed(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)
        executor = AdvertoolsExecutor()

        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _rich_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        first = _get_brand(analysis)["last_advertools_audit"]

        await executor._update_persona_augmentation(user_id, WEBSITE_URL, _thin_degraded_result(), db)
        db.commit()  # production commits after the pipeline; mirror it
        db.refresh(analysis)
        second = _get_brand(analysis)["last_advertools_audit"]

        assert second >= first and second != first


# ---------------------------------------------------------------------------
# 3. Site health merge
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestSiteHealthMerge:
    async def test_degraded_health_keeps_richer_metrics(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)
        executor = AdvertoolsExecutor()

        rich_health = {
            "success": True,
            "metrics": {
                "total_urls": 327,
                "publishing_velocity": 4.2,
                "freshness_score": 78.0,
                "stale_content_percentage": 22.0,
                "url_structure": {"avg_depth": 2.1},
            },
        }
        await executor._update_site_health_metrics(user_id, WEBSITE_URL, rich_health, db)
        db.commit()
        db.refresh(analysis)
        assert analysis.seo_audit["site_health"]["total_urls"] == 327

        degraded_health = {
            "success": True,
            "degraded": True,
            "degraded_reason": "Sitemap fan-out stopped early: origin rate-limiting (429 circuit open).",
            "metrics": {
                "total_urls": 15,
                "publishing_velocity": 0.0,
                "freshness_score": 0.0,
                "stale_content_percentage": 0.0,
                "url_structure": {"avg_depth": 0.0},
            },
        }
        await executor._update_site_health_metrics(user_id, WEBSITE_URL, degraded_health, db)
        db.commit()
        db.refresh(analysis)
        site_health = analysis.seo_audit["site_health"]

        assert site_health["total_urls"] == 327  # richer kept
        assert site_health["freshness_score"] == 78.0
        assert site_health["degraded"] is True
        assert "429" in site_health["degraded_reason"]

    async def test_clean_health_overwrites(self, user_db):
        user_id, db = user_db["user_id"], user_db["db"]
        analysis = _seed_analysis(db, user_id)
        executor = AdvertoolsExecutor()

        degraded_health = {
            "success": True,
            "degraded": True,
            "metrics": {"total_urls": 15, "freshness_score": 0.0},
        }
        await executor._update_site_health_metrics(user_id, WEBSITE_URL, degraded_health, db)
        db.commit()
        db.refresh(analysis)

        clean_health = {
            "success": True,
            "metrics": {
                "total_urls": 327,
                "publishing_velocity": 4.2,
                "freshness_score": 78.0,
                "stale_content_percentage": 22.0,
                "url_structure": {"avg_depth": 2.1},
            },
        }
        await executor._update_site_health_metrics(user_id, WEBSITE_URL, clean_health, db)
        db.commit()
        db.refresh(analysis)
        site_health = analysis.seo_audit["site_health"]

        assert site_health["total_urls"] == 327
        assert site_health["degraded"] is False
        assert site_health["degraded_reason"] is None


# ---------------------------------------------------------------------------
# 4. Degradation metadata attached by the executor
# ---------------------------------------------------------------------------


class TestDegradationMetadata:
    def test_sitemap_failure_degrades(self):
        executor = AdvertoolsExecutor()
        meta = executor._degradation_metadata(
            sitemap_result={"success": False, "error": "HTTP 429", "rate_limited": True, "degraded": True},
            had_audit_urls=False,
            website_url=WEBSITE_URL,
            robots_result={"success": True},
        )
        assert meta["degraded"] is True
        assert meta["rate_limited"] is True
        assert any("sitemap" in r.lower() for r in meta["degraded_reasons"])
        assert any("root" in r.lower() for r in meta["degraded_reasons"])

    def test_circuit_degraded_sitemap_degrades(self):
        executor = AdvertoolsExecutor()
        meta = executor._degradation_metadata(
            sitemap_result={"success": True, "degraded": True, "degraded_reason": "Sitemap fan-out stopped early: origin rate-limiting (429 circuit open)."},
            had_audit_urls=True,
            website_url=WEBSITE_URL,
            robots_result={"success": True},
        )
        assert meta["degraded"] is True
        assert any("429" in r for r in meta["degraded_reasons"])

    def test_robots_failure_adds_reason(self):
        executor = AdvertoolsExecutor()
        meta = executor._degradation_metadata(
            sitemap_result={"success": True},
            had_audit_urls=True,
            website_url=WEBSITE_URL,
            robots_result={"success": False, "degraded": True},
        )
        assert meta["degraded"] is True
        assert any("robots" in r.lower() for r in meta["degraded_reasons"])

    def test_clean_run_not_degraded(self):
        executor = AdvertoolsExecutor()
        meta = executor._degradation_metadata(
            sitemap_result={"success": True},
            had_audit_urls=True,
            website_url=WEBSITE_URL,
            robots_result={"success": True},
        )
        assert meta["degraded"] is False
        assert meta["degraded_reasons"] == []
        assert meta["rate_limited"] is False
