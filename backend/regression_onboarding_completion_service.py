from pathlib import Path
import importlib.util
import sys
import types

import pytest


class _FakeQuery:
    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def first(self):
        return None

    def all(self):
        return []


class _FakeDB:
    def __init__(self):
        self.added = []

    def query(self, model):
        return _FakeQuery()

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        return None

    def close(self):
        return None


class _TaskBase:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class _OnboardingFullWebsiteAnalysisTask(_TaskBase):
    user_id = "user_id"
    website_url = "website_url"


class _DeepCompetitorAnalysisTask(_TaskBase):
    user_id = "user_id"
    website_url = "website_url"


class _SIFIndexingTask(_TaskBase):
    user_id = "user_id"
    website_url = "website_url"


class _MarketTrendsTask(_TaskBase):
    user_id = "user_id"
    website_url = "website_url"


class _FakeIntegrationService:
    def __init__(self, integrated_data):
        self._integrated_data = integrated_data

    def get_integrated_data_sync(self, user_id, db):
        return self._integrated_data


def _install_stub_module(name, **attrs):
    mod = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(mod, key, value)
    sys.modules[name] = mod
    return mod


def _install_module_chain(name):
    parts = name.split('.')
    for idx in range(1, len(parts) + 1):
        sub = '.'.join(parts[:idx])
        if sub not in sys.modules:
            sys.modules[sub] = types.ModuleType(sub)


def _load_service_module(fake_db, integrated_data):
    _install_module_chain("api.content_planning.services.content_strategy.onboarding")
    _install_module_chain("services.database")
    _install_module_chain("services.persona_data_service")
    _install_module_chain("services.research.research_persona_scheduler")
    _install_module_chain("services.persona.facebook.facebook_persona_scheduler")
    _install_module_chain("services.onboarding.progress_service")
    _install_module_chain("services.progressive_setup_service")
    _install_module_chain("services.website_analysis_monitoring_service")
    _install_module_chain("models.website_analysis_monitoring_models")

    _install_stub_module(
        "api.content_planning.services.content_strategy.onboarding",
        OnboardingDataIntegrationService=lambda: _FakeIntegrationService(integrated_data),
    )

    _install_stub_module(
        "services.database",
        get_session_for_user=lambda user_id: fake_db,
        SessionLocal=lambda: fake_db,
    )

    _install_stub_module(
        "services.persona_data_service",
        PersonaDataService=type(
            "PersonaDataService",
            (),
            {"get_user_persona_data": lambda self, user_id: None},
        ),
    )

    _install_stub_module(
        "services.research.research_persona_scheduler",
        schedule_research_persona_generation=lambda *args, **kwargs: None,
    )

    _install_stub_module(
        "services.persona.facebook.facebook_persona_scheduler",
        schedule_facebook_persona_generation=lambda *args, **kwargs: None,
    )

    _install_stub_module(
        "services.onboarding.progress_service",
        OnboardingProgressService=type(
            "OnboardingProgressService",
            (),
            {
                "complete_onboarding": lambda self, user_id: True,
                "get_onboarding_status": lambda self, user_id: {"current_step": 5},
            },
        ),
    )

    _install_stub_module(
        "services.progressive_setup_service",
        ProgressiveSetupService=type(
            "ProgressiveSetupService",
            (),
            {
                "__init__": lambda self, db: None,
                "initialize_user_environment": lambda self, user_id: None,
            },
        ),
    )

    _install_stub_module(
        "services.website_analysis_monitoring_service",
        schedule_website_analysis_task_creation=lambda **kwargs: None,
        clerk_user_id_to_int=lambda user_id: 1,
    )

    _install_stub_module(
        "models.website_analysis_monitoring_models",
        OnboardingFullWebsiteAnalysisTask=_OnboardingFullWebsiteAnalysisTask,
        DeepCompetitorAnalysisTask=_DeepCompetitorAnalysisTask,
        SIFIndexingTask=_SIFIndexingTask,
        MarketTrendsTask=_MarketTrendsTask,
    )

    service_path = Path(__file__).resolve().parent / "api" / "onboarding_utils" / "onboarding_completion_service.py"
    spec = importlib.util.spec_from_file_location("onboarding_completion_service_under_test", service_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_complete_onboarding_schedules_deep_competitor_task_from_competitor_analysis_fallback(monkeypatch):
    fake_db = _FakeDB()
    integrated_data = {
        "website_analysis": {
            "website_url": "https://example.com",
            "updated_at": "2026-01-01T00:00:00",
        },
        "research_preferences": {"competitors": []},
        "competitor_analysis": [
            {
                "competitor_url": "acme-competitor.com/path/page",
                "competitor_domain": "acme-competitor.com",
                "analysis_data": {"description": "Strong content engine"},
            }
        ],
    }

    module = _load_service_module(fake_db, integrated_data)
    service = module.OnboardingCompletionService()

    async def _validate_steps(*args, **kwargs):
        return []

    async def _validate_api_keys(*args, **kwargs):
        return None

    monkeypatch.setattr(module.OnboardingCompletionService, "_validate_required_steps_database", _validate_steps)
    monkeypatch.setattr(module.OnboardingCompletionService, "_validate_api_keys", _validate_api_keys)

    result = await service.complete_onboarding({"id": "user-1"})

    assert result["message"] == "Onboarding completed successfully"

    deep_tasks = [obj for obj in fake_db.added if isinstance(obj, _DeepCompetitorAnalysisTask)]
    assert len(deep_tasks) == 1
    assert deep_tasks[0].payload["competitors"] == [
        {
            "url": "https://acme-competitor.com",
            "domain": "acme-competitor.com",
            "name": "acme-competitor.com",
            "summary": "Strong content engine",
        }
    ]
