"""
End-to-end verification harness for the Website Analysis Monitoring loop.

Covers the full pipeline against a throwaway user + temp-workspace SQLite DB:

    SSOT task creation -> due-task loading -> executor execution -> storage
    + execution logs -> scheduler-dashboard status / logs / retry endpoints.

The harness never touches a real user's workspace: the workspace root is
redirected to a per-test temp dir, a throwaway user id is used, and the
SQLAlchemy per-user engine cache is cleared in teardown.

Previously documented defects, now fixed and pinned as green-path tests:

    B1. ``WebsiteAnalysisExecutor`` referenced an unset ``self.user_id``
        inside style analysis; it now uses the ``user_id`` parameter threaded
        into ``_perform_website_analysis``, so runs succeed and store results.
    B2. ``create_website_analysis_tasks`` read competitors as ``url`` /
        ``website_url`` but onboarding emits ``competitor_url``; it now
        accepts both, so competitor monitoring tasks are created.
    B3. ``_perform_full_site_analysis`` referenced unimported
        ``SitemapService`` / ``SEOPageAudit``; both are now imported.

The ``stub_crawl`` fixture exposes ``stub_crawl["fail"] = True`` to force a
deterministic crawl failure, which the endpoint tests use to exercise the
failed-task path.
"""

import importlib
import shutil
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

# NOTE: `import services.database.engine as X` would bind the package
# attribute `services.database.engine`, which the legacy `engine` global
# (possibly None) shadows. Use importlib to grab the real submodule.
db_engine_mod = importlib.import_module("services.database.engine")
import services.workspace_paths as workspace_paths
import utils.storage_paths as storage_paths
from services.database import get_session_for_user

USER_URL = "https://acme-corp.example.com"
COMPETITOR_URLS = ["https://rival-a.example.com", "https://rival-b.example.com"]

CRAWL_CONTENT = {
    "title": "Acme Corp — Test Harness Page",
    "description": "A test page description used by the monitoring harness.",
    "main_content": (
        "Acme Corp builds software that helps teams ship faster. "
        "Our platform is secure, reliable, and easy to use. "
        "We believe in simple tools and clear communication. "
        "Every product decision starts with the customer. "
        "Acme Corp has helped thousands of teams reach their goals. "
    ) * 5,
    "headings": ["Welcome to Acme", "About Us", "Our Products", "Contact"],
    "links": [],
    "images": [],
    "meta_tags": {"description": "Acme Corp test page"},
    "domain_info": {
        "domain": "acme-corp.example.com",
        "domain_name": "acme-corp.example.com",
        "is_blog": False,
        "is_ecommerce": False,
        "is_corporate": True,
        "has_blog_section": False,
        "has_about_page": True,
        "has_contact_page": True,
    },
    "social_media": {},
    "brand_info": {"company_name": "Acme Corp", "contact_info": {}},
    "content_structure": {
        "headings": {"h1": 1, "h2": 3, "h3": 0, "h4": 0, "h5": 0, "h6": 0},
        "paragraphs": 5,
        "lists": 0,
        "images": 0,
        "links": 4,
        "content_sections": 1,
        "has_navigation": False,
        "has_footer": False,
        "has_sidebar": False,
        "has_call_to_action": False,
    },
}

SEO_AUDIT_STUB = {
    "overall_score": 80,
    "meta": {},
    "technical": {},
    "content_health": {},
    "performance": {},
    "url_structure": {},
    "accessibility": {},
    "ux": {},
    "summary": {"critical_issues": [], "warnings": [], "passed_checks": 1, "total_checks": 1},
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

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
    """Throwaway user + fresh per-user SQLite engine/session, cleaned up after."""
    user_id = f"e2e_wa_{uuid4().hex[:10]}"
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


@pytest.fixture
def seeded(user_db):
    """Seed the onboarding SSOT sources the task creator reads from."""
    from models.onboarding import CompetitorAnalysis, OnboardingSession, WebsiteAnalysis

    db = user_db["db"]
    session = OnboardingSession(user_id=user_db["user_id"], current_step=6, progress=100)
    db.add(session)
    db.flush()

    db.add(
        WebsiteAnalysis(
            session_id=session.id,
            website_url=USER_URL,
            status="completed",
            crawl_result={"url": USER_URL},
        )
    )
    for url in COMPETITOR_URLS:
        db.add(
            CompetitorAnalysis(
                session_id=session.id,
                competitor_url=url,
                competitor_domain=url.split("//")[1],
                status="completed",
                analysis_data={"crawl_result": {"url": url}},
            )
        )
    db.commit()
    user_db["session_id"] = session.id
    return user_db


@pytest.fixture
def stub_crawl(monkeypatch):
    """Replace the network crawler with a deterministic content source.

    Set ``stub_crawl["fail"] = True`` to force a simulated crawl failure
    (used by the endpoint tests to exercise the failed-task path).
    """
    state = {"fail": False}

    async def fake_crawl(self, url):
        if state["fail"]:
            return {"success": False, "error": "simulated crawl failure", "url": url}
        return {
            "success": True,
            "url": url,
            "timestamp": datetime.utcnow().isoformat(),
            "content": dict(CRAWL_CONTENT),
        }

    from services.component_logic.web_crawler_logic import WebCrawlerLogic

    monkeypatch.setattr(WebCrawlerLogic, "crawl_website", fake_crawl)
    return state


@pytest.fixture
def stub_style_analysis(monkeypatch):
    """Keep the LLM-backed style analyzers out of the network in the harness."""

    def fake_analyze_content_style(self, content, user_id=None):
        return {
            "success": True,
            "analysis": {
                "writing_style": "clean and concise",
                "content_characteristics": "short paragraphs, action verbs",
                "target_audience": "B2B teams",
                "content_type": "product marketing",
                "recommended_settings": {"writing_tone": "professional"},
                "meta": {"confidence": 0.9},
            },
        }

    def fake_analyze_style_patterns(self, content, user_id=None):
        return {"patterns": ["short paragraphs"], "meta": {}}

    def fake_generate_style_guidelines(self, analysis, user_id=None):
        return {"success": True, "guidelines": {"voice": "professional"}}

    from services.component_logic.style_detection_logic import StyleDetectionLogic

    monkeypatch.setattr(StyleDetectionLogic, "analyze_content_style", fake_analyze_content_style)
    monkeypatch.setattr(StyleDetectionLogic, "analyze_style_patterns", fake_analyze_style_patterns)
    monkeypatch.setattr(StyleDetectionLogic, "generate_style_guidelines", fake_generate_style_guidelines)
    return fake_analyze_content_style


@pytest.fixture
def stub_seo_audit(monkeypatch):
    """Keep the SEO-audit analyzer out of the network in the harness."""

    def fake_seo_audit(self, url, content):
        return dict(SEO_AUDIT_STUB)

    from services.component_logic.style_detection_logic import StyleDetectionLogic

    monkeypatch.setattr(StyleDetectionLogic, "perform_seo_audit", fake_seo_audit)
    return fake_seo_audit


def _create_tasks(seeded) -> None:
    from services.website_analysis_monitoring_service import create_website_analysis_tasks

    result = create_website_analysis_tasks(seeded["user_id"], seeded["db"])
    assert result["success"] is True, result.get("error")


async def _run_executor_once(seeded, task=None):
    from services.scheduler.executors.website_analysis_executor import WebsiteAnalysisExecutor

    db = seeded["db"]
    if task is None:
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask

        task = (
            db.query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .first()
        )
    return await WebsiteAnalysisExecutor().execute_task(task, db)


# ---------------------------------------------------------------------------
# 1. Task creation from onboarding SSOT
# ---------------------------------------------------------------------------

class TestTaskCreation:
    def test_creates_user_website_task_from_ssot(self, seeded):
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask

        _create_tasks(seeded)

        tasks = (
            seeded["db"]
            .query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .all()
        )
        assert len(tasks) == 1
        task = tasks[0]
        assert task.website_url == USER_URL
        assert task.status == "active"
        assert task.frequency_days == 30
        assert task.next_check is not None
        # User website task is scheduled 30 days out (no initial delay).
        assert task.next_check > datetime.utcnow() + timedelta(days=29)

    def test_competitor_tasks_created_from_ssot(self, seeded):
        """B2 fix: onboarding emits ``competitor_url``, which the creator now
        reads, so every seeded competitor gets a monitoring task."""
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask

        from services.website_analysis_monitoring_service import create_website_analysis_tasks

        result = create_website_analysis_tasks(seeded["user_id"], seeded["db"])
        assert result["success"] is True
        assert result["tasks_created"] == 3  # 1 user_website + 2 competitors

        competitor_tasks = (
            seeded["db"]
            .query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="competitor")
            .order_by(WebsiteAnalysisTask.website_url)
            .all()
        )
        assert [t.website_url for t in competitor_tasks] == COMPETITOR_URLS
        for t in competitor_tasks:
            assert t.status == "active"
            assert t.frequency_days == 10
            assert t.competitor_id == t.website_url.split("//")[1]
            assert t.next_check is not None


# ---------------------------------------------------------------------------
# 2. Due-task loading
# ---------------------------------------------------------------------------

class TestDueLoading:
    def test_past_next_check_is_due(self, seeded):
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask
        from services.scheduler.utils.website_analysis_task_loader import (
            load_due_website_analysis_tasks,
        )

        _create_tasks(seeded)

        task = (
            seeded["db"]
            .query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .first()
        )
        task.next_check = datetime.utcnow() - timedelta(minutes=1)
        seeded["db"].commit()

        due = load_due_website_analysis_tasks(seeded["db"], user_id=seeded["user_id"])
        assert any(t.id == task.id for t in due)

    def test_future_next_check_is_not_due(self, seeded):
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask
        from services.scheduler.utils.website_analysis_task_loader import (
            load_due_website_analysis_tasks,
        )

        _create_tasks(seeded)

        due = load_due_website_analysis_tasks(seeded["db"], user_id=seeded["user_id"])
        assert due == []


# ---------------------------------------------------------------------------
# 3. Executor execution (B1 reproduction)
# ---------------------------------------------------------------------------

class TestExecutor:
    @pytest.mark.asyncio
    async def test_user_task_succeeds_and_stores_analysis(
        self, seeded, stub_crawl, stub_seo_audit, stub_style_analysis
    ):
        """B1 fix: the run reaches style analysis (user_id threaded through)
        and stores the result in the existing WebsiteAnalysis row."""
        from models.onboarding import WebsiteAnalysis
        from models.website_analysis_monitoring_models import (
            WebsiteAnalysisExecutionLog,
            WebsiteAnalysisTask,
        )
        from services.scheduler.executors.website_analysis_executor import (
            WebsiteAnalysisExecutor,
        )

        _create_tasks(seeded)

        db = seeded["db"]
        task = (
            db.query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .first()
        )

        result = await WebsiteAnalysisExecutor().execute_task(task, db)

        assert result.success is True
        assert result.result_data.get("crawl_result", {}).get("success") is True

        db.refresh(task)
        assert task.status == "active"
        assert task.consecutive_failures == 0
        assert task.failure_reason is None
        assert task.last_success is not None
        # Next check rescheduled 30 days out from this run.
        assert task.next_check > datetime.utcnow() + timedelta(days=29)

        log = (
            db.query(WebsiteAnalysisExecutionLog)
            .filter_by(task_id=task.id)
            .order_by(WebsiteAnalysisExecutionLog.execution_date.desc())
            .first()
        )
        assert log is not None
        assert log.status == "success"
        assert log.execution_time_ms is not None

        # Storage was reached: the seeded analysis was updated.
        seeded_wa = (
            db.query(WebsiteAnalysis)
            .filter_by(session_id=seeded["session_id"])
            .first()
        )
        assert seeded_wa.status == "completed"
        assert seeded_wa.crawl_result.get("url") == USER_URL
        assert seeded_wa.seo_audit.get("overall_score") == 80

    @pytest.mark.asyncio
    async def test_competitor_task_succeeds_and_stores_analysis(
        self, seeded, stub_crawl, stub_seo_audit, stub_style_analysis
    ):
        from models.onboarding import CompetitorAnalysis
        from models.website_analysis_monitoring_models import (
            WebsiteAnalysisExecutionLog,
            WebsiteAnalysisTask,
        )
        from services.scheduler.executors.website_analysis_executor import (
            WebsiteAnalysisExecutor,
        )

        # Seed a competitor task directly (creation flow is covered above).
        db = seeded["db"]
        competitor_task = WebsiteAnalysisTask(
            user_id=seeded["user_id"],
            website_url=COMPETITOR_URLS[0],
            task_type="competitor",
            competitor_id="rival-a.example.com",
            status="active",
            frequency_days=10,
            next_check=datetime.utcnow() - timedelta(minutes=1),
        )
        db.add(competitor_task)
        db.commit()

        result = await WebsiteAnalysisExecutor().execute_task(competitor_task, db)

        assert result.success is True

        db.refresh(competitor_task)
        assert competitor_task.status == "active"
        assert competitor_task.consecutive_failures == 0

        log = (
            db.query(WebsiteAnalysisExecutionLog)
            .filter_by(task_id=competitor_task.id)
            .first()
        )
        assert log is not None
        assert log.status == "success"

        # Storage was reached: the seeded competitor analysis was updated.
        comp = (
            db.query(CompetitorAnalysis)
            .filter_by(session_id=seeded["session_id"], competitor_url=COMPETITOR_URLS[0])
            .first()
        )
        assert comp is not None
        assert comp.status == "completed"
        assert comp.analysis_data.get("crawl_result", {}).get("success") is True


# ---------------------------------------------------------------------------
# 4. Scheduler-dashboard API endpoints
# ---------------------------------------------------------------------------

class TestStatusEndpoint:
    @pytest.mark.asyncio
    async def test_status_reports_failed_user_task(self, seeded, stub_crawl):
        from api.scheduler_dashboard_website import get_website_analysis_status

        _create_tasks(seeded)
        stub_crawl["fail"] = True
        await _run_executor_once(seeded)

        status = await get_website_analysis_status(
            seeded["user_id"], seeded["db"], current_user={"id": seeded["user_id"]}
        )
        assert status["success"] is True
        data = status["data"]
        assert data["user_id"] == seeded["user_id"]
        assert len(data["user_website_tasks"]) == 1
        assert len(data["competitor_tasks"]) == 2
        assert data["total_tasks"] == 3
        assert data["failed_tasks"] == 1
        assert data["active_tasks"] == 2  # the two competitor tasks remain active

    @pytest.mark.asyncio
    async def test_status_forbids_other_users(self, seeded):
        from fastapi import HTTPException

        from api.scheduler_dashboard_website import get_website_analysis_status

        with pytest.raises(HTTPException) as excinfo:
            await get_website_analysis_status(
                seeded["user_id"], seeded["db"], current_user={"id": "someone_else"}
            )
        assert excinfo.value.status_code == 403


class TestLogsEndpoint:
    @pytest.mark.asyncio
    async def test_logs_return_failed_execution(self, seeded, stub_crawl):
        from api.scheduler_dashboard_website import get_website_analysis_logs

        _create_tasks(seeded)
        stub_crawl["fail"] = True
        await _run_executor_once(seeded)

        logs = await get_website_analysis_logs(
            seeded["user_id"],
            task_id=None,
            limit=10,
            offset=0,
            db=seeded["db"],
            current_user={"id": seeded["user_id"]},
        )
        assert logs["total_count"] == 1
        assert logs["has_more"] is False
        first = logs["logs"][0]
        assert first["status"] == "failed"
        assert first["website_url"] == USER_URL
        assert first["task_type"] == "user_website"
        assert "Crawling failed" in (first["error_message"] or "")

    @pytest.mark.asyncio
    async def test_logs_filter_by_task_id(self, seeded, stub_crawl):
        from api.scheduler_dashboard_website import get_website_analysis_logs
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask

        _create_tasks(seeded)
        stub_crawl["fail"] = True
        await _run_executor_once(seeded)

        task = (
            seeded["db"]
            .query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .first()
        )
        logs = await get_website_analysis_logs(
            seeded["user_id"],
            task_id=task.id,
            limit=10,
            offset=0,
            db=seeded["db"],
            current_user={"id": seeded["user_id"]},
        )
        assert logs["total_count"] == 1
        assert all(log["task_id"] == task.id for log in logs["logs"])


class TestRetryEndpoint:
    @pytest.mark.asyncio
    async def test_retry_reschedules_failed_task_for_immediate_execution(
        self, seeded, stub_crawl
    ):
        from api.scheduler_dashboard_website import retry_website_analysis
        from models.website_analysis_monitoring_models import WebsiteAnalysisTask
        from services.scheduler.utils.website_analysis_task_loader import (
            load_due_website_analysis_tasks,
        )

        _create_tasks(seeded)
        stub_crawl["fail"] = True
        await _run_executor_once(seeded)

        db = seeded["db"]
        task = (
            db.query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"], task_type="user_website")
            .first()
        )
        assert task.status == "failed"

        response = await retry_website_analysis(
            task.id, db, current_user={"id": seeded["user_id"]}
        )
        assert response["success"] is True
        assert response["task"]["id"] == task.id

        db.refresh(task)
        assert task.status == "active"
        assert task.failure_reason is None
        assert task.next_check is not None
        assert task.next_check <= datetime.utcnow() + timedelta(minutes=1)

        due = load_due_website_analysis_tasks(db, user_id=seeded["user_id"])
        assert any(t.id == task.id for t in due)

    @pytest.mark.asyncio
    async def test_retry_404_when_task_missing(self, seeded):
        from fastapi import HTTPException

        from api.scheduler_dashboard_website import retry_website_analysis

        with pytest.raises(HTTPException) as excinfo:
            await retry_website_analysis(
                999_999, seeded["db"], current_user={"id": seeded["user_id"]}
            )
        assert excinfo.value.status_code == 404

    @pytest.mark.asyncio
    async def test_retry_403_for_other_users(self, seeded, stub_crawl):
        from fastapi import HTTPException

        from api.scheduler_dashboard_website import retry_website_analysis

        _create_tasks(seeded)
        stub_crawl["fail"] = True
        await _run_executor_once(seeded)

        from models.website_analysis_monitoring_models import WebsiteAnalysisTask

        task = (
            seeded["db"]
            .query(WebsiteAnalysisTask)
            .filter_by(user_id=seeded["user_id"])
            .first()
        )

        with pytest.raises(HTTPException) as excinfo:
            await retry_website_analysis(
                task.id, seeded["db"], current_user={"id": "someone_else"}
            )
        assert excinfo.value.status_code == 403
