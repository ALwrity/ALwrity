"""Content-pillar discovery normalization + honest persistence tests.

Covers the onboarding Step 3 content-pillar fixes:

1. ``_discover_content_pillars_with_fallback`` returns a normalized
   ``{success, error, content_pillars, timestamp}`` envelope instead of a
   bare ``None`` (the silent-failure root cause of the eternal "pending"
   state).
2. ``_pillars_payload`` maps that envelope into the value that is
   persisted: success payloads carry ``status: "complete"`` + timestamp;
   failures persist a retryable ``{status: "failed", error, timestamp}``
   dict so a reload shows a retryable error instead of "pending" forever.
3. ``discover_competitors_for_onboarding`` persists and returns the
   normalized payload (no more swallowed failures).
"""

import sys
import types
from contextlib import contextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest

SRS = "api.onboarding_utils.step3_research_service"


class _FakeOnboardingSession:
    def __init__(self, sid: str = "session-abc"):
        self.id = sid


class _FakeDb:
    def __init__(self, session=None):
        self._session = session or _FakeOnboardingSession()
        self.closed = False

    def query(self, model):
        return _FakeQuery(self._session)

    def close(self):
        self.closed = True


class _FakeQuery:
    def __init__(self, session):
        self._session = session

    def filter(self, *a, **k):
        return self

    def order_by(self, *a, **k):
        return self

    def first(self):
        return self._session


def _install_task_scheduler_stub(monkeypatch):
    """Provide a lightweight onboarding task scheduler module so the lazy
    ``from ... import _run_sif_now`` inside
    ``discover_competitors_for_onboarding`` resolves without importing
    the real (heavy) scheduler."""
    stub = types.ModuleType("api.onboarding_utils.onboarding_task_scheduler")

    async def _sif_noop(user_id, user_url):
        return None

    stub._run_sif_now = _sif_noop
    monkeypatch.setitem(
        sys.modules, "api.onboarding_utils.onboarding_task_scheduler", stub
    )
    return stub


def _install_step_management_stub(monkeypatch):
    """Provide a lightweight step-management module whose
    ``StepManagementService`` resolves to a MagicMock, so the lazy import
    inside the service needs no real DB setup."""
    stub = types.ModuleType("api.onboarding_utils.step_management_service")
    fake_svc = MagicMock()
    stub.StepManagementService = MagicMock(return_value=fake_svc)
    monkeypatch.setitem(
        sys.modules, "api.onboarding_utils.step_management_service", stub
    )
    return stub, fake_svc


@pytest.fixture
def svc():
    from api.onboarding_utils.step3_research_service import Step3ResearchService

    service = Step3ResearchService.__new__(Step3ResearchService)
    service.exa_service = MagicMock()
    service.exa_service._discover_content_pillars_via_answer = AsyncMock()
    return service


class TestPillarDiscoveryEnvelope:
    @pytest.mark.asyncio
    async def test_success_returns_normalized_envelope(self, svc):
        raw = {"pillars": [{"name": "AI", "weight": 0.6}]}
        svc.exa_service._discover_content_pillars_via_answer.return_value = raw

        env = await svc._discover_content_pillars_with_fallback("https://example.com")

        assert env["success"] is True
        assert env["error"] is None
        assert env["content_pillars"] == raw
        assert isinstance(env["timestamp"], str) and env["timestamp"]

    @pytest.mark.asyncio
    async def test_failure_returns_envelope_not_none(self, svc):
        svc.exa_service._discover_content_pillars_via_answer.return_value = None

        env = await svc._discover_content_pillars_with_fallback("https://example.com")

        assert env is not None
        assert env["success"] is False
        assert env["content_pillars"] is None
        assert "Exa credits" in env["error"]
        assert isinstance(env["timestamp"], str) and env["timestamp"]

    @pytest.mark.asyncio
    async def test_non_dict_result_is_failure(self, svc):
        svc.exa_service._discover_content_pillars_via_answer.return_value = ["not a dict"]

        env = await svc._discover_content_pillars_with_fallback("https://example.com")

        assert env["success"] is False
        assert env["content_pillars"] is None


class TestPillarsPayload:
    def _svc(self):
        from api.onboarding_utils.step3_research_service import Step3ResearchService

        return Step3ResearchService

    def test_success_payload_gets_status_complete(self):
        env = {
            "success": True,
            "error": None,
            "content_pillars": {"pillars": ["A"], "topics": {"x": 1}},
            "timestamp": "2026-01-01T00:00:00",
        }
        payload = self._svc()._pillars_payload(env)
        assert payload["status"] == "complete"
        assert payload["pillars"] == ["A"]
        assert payload["topics"] == {"x": 1}
        assert payload["timestamp"] == "2026-01-01T00:00:00"

    def test_success_payload_does_not_mutate_raw(self):
        raw = {"pillars": ["A"]}
        env = {
            "success": True,
            "error": None,
            "content_pillars": raw,
            "timestamp": "t",
        }
        payload = self._svc()._pillars_payload(env)
        assert raw == {"pillars": ["A"]}
        assert "status" not in raw
        assert payload["status"] == "complete"

    def test_success_payload_gains_pillar_topics(self):
        env = {
            "success": True,
            "error": None,
            "content_pillars": {
                "target_company": {
                    "domain": "acme.com",
                    "content_pillars": ["AI tooling", "Developer productivity"],
                },
                "competitors": [
                    {
                        "website": "https://rival.io",
                        "company_name": "Rival",
                        "content_pillars": ["AI tooling", "API guides"],
                    }
                ],
            },
            "timestamp": "t",
        }
        payload = self._svc()._pillars_payload(env)

        # Additive normalization: flat, deduped topic list for agent consumers.
        assert payload["pillar_topics"] == ["AI tooling", "Developer productivity", "API guides"]
        # Frontend contract keys are preserved untouched.
        assert payload["target_company"]["content_pillars"] == [
            "AI tooling",
            "Developer productivity",
        ]
        assert payload["competitors"][0]["company_name"] == "Rival"
        assert payload["status"] == "complete"

    def test_flat_pillars_payload_gains_pillar_topics(self):
        env = {
            "success": True,
            "error": None,
            "content_pillars": {"pillars": ["A", "B", "A"]},
            "timestamp": "t",
        }
        payload = self._svc()._pillars_payload(env)
        assert payload["pillar_topics"] == ["A", "B"]

    def test_failure_payload_is_retryable(self):
        env = {
            "success": False,
            "error": "boom",
            "content_pillars": None,
            "timestamp": "2026-01-01T00:00:00",
        }
        payload = self._svc()._pillars_payload(env)
        assert payload["status"] == "failed"
        assert payload["error"] == "boom"
        assert payload["timestamp"] == "2026-01-01T00:00:00"

    def test_failure_defaults_error_message(self):
        env = {"success": False, "error": None, "content_pillars": None, "timestamp": "t"}
        payload = self._svc()._pillars_payload(env)
        assert payload["status"] == "failed"
        assert "failed" in payload["error"]

    def test_invalid_envelope_returns_none(self):
        svc_cls = self._svc()
        assert svc_cls._pillars_payload(None) is None
        assert svc_cls._pillars_payload({}) is None
        assert svc_cls._pillars_payload("not a dict") is None


class TestDiscoverCompetitorsPersistence:
    def _base_mocks(self, svc):
        svc.exa_service.discover_competitors = AsyncMock(
            return_value={
                "success": True,
                "competitors": [{"url": "https://competitor.com"}],
                "api_cost": 1.0,
            }
        )
        svc.exa_service.discover_social_media_accounts = AsyncMock(
            return_value={"success": True, "social_media_accounts": {}, "citations": []}
        )
        svc._enhance_competitor_data = AsyncMock(
            return_value=[{"url": "https://competitor.com", "title": "C"}]
        )
        svc._generate_research_summary = MagicMock(return_value={"summary": "s"})

    def _install_sessions(self, monkeypatch, persist_db=None):
        persist_db = persist_db or _FakeDb()

        def _fake_get_db_session(user_id):
            @contextmanager
            def _cm():
                yield _FakeDb()

            return _cm()

        monkeypatch.setattr(SRS + ".get_db_session", _fake_get_db_session)
        monkeypatch.setattr(
            "services.database.get_session_for_user", lambda uid: persist_db
        )
        return persist_db

    @pytest.mark.asyncio
    async def test_persists_and_returns_normalized_payload(self, svc, monkeypatch):
        _install_task_scheduler_stub(monkeypatch)
        _, fake_svc = _install_step_management_stub(monkeypatch)
        persist_db = self._install_sessions(monkeypatch)

        raw_pillars = {"pillars": [{"name": "AI"}], "topics": ["gpt"]}
        svc.exa_service._discover_content_pillars_via_answer = AsyncMock(
            return_value=raw_pillars
        )
        self._base_mocks(svc)

        result = await svc.discover_competitors_for_onboarding(
            user_url="https://example.com", user_id="user_1"
        )

        assert result["success"] is True
        payload = result["content_pillars"]
        assert payload["status"] == "complete"
        assert payload["pillars"] == [{"name": "AI"}]
        assert payload["topics"] == ["gpt"]
        assert payload["timestamp"]

        captured = fake_svc._save_competitor_analysis
        assert captured.called
        assert captured.call_args.kwargs["content_pillars"] == payload
        assert persist_db.closed is True

    @pytest.mark.asyncio
    async def test_pillar_failure_persists_failed_payload(self, svc, monkeypatch):
        _install_task_scheduler_stub(monkeypatch)
        _, fake_svc = _install_step_management_stub(monkeypatch)
        self._install_sessions(monkeypatch)

        svc.exa_service._discover_content_pillars_via_answer = AsyncMock(
            return_value=None
        )
        self._base_mocks(svc)

        result = await svc.discover_competitors_for_onboarding(
            user_url="https://example.com", user_id="user_1"
        )

        assert result["success"] is True
        payload = result["content_pillars"]
        assert payload["status"] == "failed"
        assert "Exa credits" in payload["error"]

        captured = fake_svc._save_competitor_analysis
        assert captured.called
        assert captured.call_args.kwargs["content_pillars"]["status"] == "failed"

    @pytest.mark.asyncio
    async def test_pillar_exception_is_captured_into_payload(self, svc, monkeypatch):
        _install_task_scheduler_stub(monkeypatch)
        _, fake_svc = _install_step_management_stub(monkeypatch)
        self._install_sessions(monkeypatch)

        svc.exa_service._discover_content_pillars_via_answer = AsyncMock(
            side_effect=RuntimeError("boom")
        )
        self._base_mocks(svc)

        result = await svc.discover_competitors_for_onboarding(
            user_url="https://example.com", user_id="user_1"
        )

        assert result["success"] is True
        payload = result["content_pillars"]
        assert payload["status"] == "failed"
        assert "boom" in payload["error"]
        assert fake_svc._save_competitor_analysis.call_args.kwargs["content_pillars"][
            "status"
        ] == "failed"


class TestDiscoverContentPillarsEndpoint:
    """The refresh endpoint must be honest about ``success`` — in
    particular it must not claim success when persistence failed."""

    @staticmethod
    def _patch_endpoint(monkeypatch, envelope, payload):
        from api.onboarding_utils import step3_routes

        svc_inst = step3_routes.step3_research_service
        monkeypatch.setattr(
            svc_inst,
            "_discover_content_pillars_with_fallback",
            AsyncMock(return_value=envelope),
        )
        monkeypatch.setattr(
            svc_inst, "_pillars_payload", MagicMock(return_value=payload)
        )
        return step3_routes

    def test_happy_path_reports_success_and_persists(self, monkeypatch):
        import asyncio

        from api.onboarding_utils.step3_routes import ContentPillarsRequest

        routes = self._patch_endpoint(
            monkeypatch,
            envelope={
                "success": True,
                "error": None,
                "content_pillars": {"a": 1},
                "timestamp": "t",
            },
            payload={"a": 1, "status": "complete", "timestamp": "t"},
        )
        _, fake_svc = _install_step_management_stub(monkeypatch)
        fake_svc.save_content_pillars.return_value = True
        db = _FakeDb()
        monkeypatch.setattr(
            "api.onboarding_utils.step3_routes.get_session_for_user", lambda uid: db
        )

        resp = asyncio.run(
            routes.discover_content_pillars(
                ContentPillarsRequest(user_url="https://example.com"),
                current_user={"id": "user_1"},
            )
        )

        assert resp.success is True
        assert resp.content_pillars["status"] == "complete"
        assert resp.error is None
        assert fake_svc.save_content_pillars.call_args.args[0] == "user_1"
        assert db.closed is True

    def test_persist_failure_is_honest(self, monkeypatch):
        import asyncio

        from api.onboarding_utils.step3_routes import ContentPillarsRequest

        routes = self._patch_endpoint(
            monkeypatch,
            envelope={
                "success": True,
                "error": None,
                "content_pillars": {"a": 1},
                "timestamp": "t",
            },
            payload={"a": 1, "status": "complete", "timestamp": "t"},
        )
        _, fake_svc = _install_step_management_stub(monkeypatch)
        fake_svc.save_content_pillars.return_value = False
        monkeypatch.setattr(
            "api.onboarding_utils.step3_routes.get_session_for_user", lambda uid: _FakeDb()
        )

        resp = asyncio.run(
            routes.discover_content_pillars(
                ContentPillarsRequest(user_url="https://example.com"),
                current_user={"id": "user_1"},
            )
        )

        # Regression: this used to claim success=True even when the DB
        # save failed, which is how a refresh could appear "done" yet
        # revert to pending on reload.
        assert resp.success is False
        assert resp.error is not None
        assert "persist" in resp.error.lower()
        assert resp.content_pillars["status"] == "complete"

    def test_discovery_failure_does_not_persist(self, monkeypatch):
        import asyncio

        from api.onboarding_utils.step3_routes import ContentPillarsRequest

        routes = self._patch_endpoint(
            monkeypatch,
            envelope={
                "success": False,
                "error": "Exa credits may be exhausted",
                "content_pillars": None,
                "timestamp": "t",
            },
            payload={
                "status": "failed",
                "error": "Exa credits may be exhausted",
                "timestamp": "t",
            },
        )
        _, fake_svc = _install_step_management_stub(monkeypatch)

        resp = asyncio.run(
            routes.discover_content_pillars(
                ContentPillarsRequest(user_url="https://example.com"),
                current_user={"id": "user_1"},
            )
        )

        assert resp.success is False
        assert "Exa" in resp.error
        assert resp.content_pillars is None
        fake_svc.save_content_pillars.assert_not_called()