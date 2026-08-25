import pytest

import api.agents_api as agents_api_module


@pytest.fixture(autouse=True)
def _reset_certification_cache(monkeypatch):
    agents_api_module._CERTIFICATION_CACHE["data"] = None
    agents_api_module._CERTIFICATION_CACHE["computed_at"] = 0.0
    yield
    agents_api_module._CERTIFICATION_CACHE["data"] = None
    agents_api_module._CERTIFICATION_CACHE["computed_at"] = 0.0


def test_certification_rollup_is_cached_within_ttl(monkeypatch):
    calls = {"count": 0}

    def fake_rollup():
        calls["count"] += 1
        return {"team_label": "not production-real", "agents": {}}

    monkeypatch.setattr(agents_api_module, "get_agent_certification_rollup", fake_rollup)

    first = agents_api_module._get_cached_certification_rollup()
    second = agents_api_module._get_cached_certification_rollup()

    assert first == second == {"team_label": "not production-real", "agents": {}}
    assert calls["count"] == 1


def test_certification_rollup_failure_returns_none_and_is_not_poisoned(monkeypatch):
    calls = {"count": 0}

    def flaky_rollup():
        calls["count"] += 1
        if calls["count"] == 1:
            raise RuntimeError("scan failed")
        return {"team_label": "production-real", "agents": {}}

    monkeypatch.setattr(agents_api_module, "get_agent_certification_rollup", flaky_rollup)

    assert agents_api_module._get_cached_certification_rollup() is None
    recovered = agents_api_module._get_cached_certification_rollup()
    assert recovered == {"team_label": "production-real", "agents": {}}
