import asyncio

import pytest

from services.provider_sandbox import run_provider_sandbox_probe


@pytest.mark.asyncio
async def test_disabled_sandbox_never_calls_probe():
    called = False

    async def probe():
        nonlocal called
        called = True
        return {"rows": 1}

    result = await run_provider_sandbox_probe("gsc", "google_search_console", probe, enabled=False)

    assert result["status"] == "not_run"
    assert called is False


@pytest.mark.asyncio
async def test_sandbox_records_provider_result():
    async def probe():
        return {"rows": 2}

    result = await run_provider_sandbox_probe("gsc", "google_search_console", probe, enabled=True)

    assert result["status"] == "passed"
    assert result["evidence"] == {"rows": 2}


@pytest.mark.asyncio
async def test_sandbox_records_empty_error_and_timeout():
    async def empty():
        return None

    async def error():
        raise RuntimeError("provider error")

    async def slow():
        await asyncio.sleep(0.05)

    assert (await run_provider_sandbox_probe("tool", "provider", empty, enabled=True))["status"] == "empty"
    assert (await run_provider_sandbox_probe("tool", "provider", error, enabled=True))["status"] == "error"
    assert (await run_provider_sandbox_probe("tool", "provider", slow, timeout_seconds=0.001, enabled=True))["status"] == "timeout"
