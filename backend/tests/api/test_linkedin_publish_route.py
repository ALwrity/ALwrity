from __future__ import annotations

import importlib.util
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from loguru import logger

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


@contextmanager
def _linkedin_env():
    key = Fernet.generate_key().decode("utf-8")
    with patch.dict(
        os.environ,
        {"LINKEDIN_TOKEN_ENCRYPTION_KEY": key},
        clear=False,
    ):
        yield


def _load_linkedin_social_routes():
    module_name = "_linkedin_social_routes_publish_under_test"
    if module_name in sys.modules:
        return sys.modules[module_name]

    routes_path = _BACKEND_ROOT / "api" / "linkedin_social_routes.py"
    spec = importlib.util.spec_from_file_location(module_name, routes_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load route module from {routes_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    if not hasattr(logger, "warn"):
        setattr(logger, "warn", logger.warning)
    stub_main_text_generation = ModuleType("services.llm_providers.main_text_generation")
    stub_main_text_generation.llm_text_gen = SimpleNamespace()
    stub_huggingface_provider = ModuleType("services.llm_providers.huggingface_provider")
    stub_huggingface_provider.huggingface_text_response = lambda *args, **kwargs: None
    stub_huggingface_provider.huggingface_structured_json_response = (
        lambda *args, **kwargs: None
    )
    with patch.dict(
        sys.modules,
        {
            "services.llm_providers.main_text_generation": stub_main_text_generation,
            "services.llm_providers.huggingface_provider": stub_huggingface_provider,
        },
        clear=False,
    ):
        with _linkedin_env():
            spec.loader.exec_module(module)
    return module


_routes = _load_linkedin_social_routes()


@pytest.mark.anyio
async def test_publish_linkedin_post_returns_success() -> None:
    expected = _routes.LinkedInPublishPostResponse(
        success=True,
        post_id="123",
        post_urn="urn:li:activity:123",
        provider="unipile",
        message="Published to LinkedIn.",
        debug_id="debug123",
        has_media=False,
    )

    with (
        patch.object(
            _routes,
            "parse_publish_request",
            AsyncMock(return_value=("Hello LinkedIn", "acct-1", None, None, None)),
        ),
        patch.object(
            _routes,
            "execute_linkedin_publish",
            AsyncMock(return_value=expected),
        ),
    ):
        response = await _routes.publish_linkedin_post(
            request=AsyncMock(),
            current_user={"id": "user_1"},
            db=MagicMock(),
        )

    assert response.success is True
    assert response.post_urn == "urn:li:activity:123"
    assert response.debug_id == "debug123"


@pytest.mark.anyio
async def test_publish_linkedin_post_returns_401_when_not_connected() -> None:
    with (
        patch.object(
            _routes,
            "parse_publish_request",
            AsyncMock(return_value=("Hello LinkedIn", "acct-1", None, None, None)),
        ),
        patch.object(
            _routes,
            "execute_linkedin_publish",
            AsyncMock(side_effect=HTTPException(status_code=401, detail="No LinkedIn credentials available")),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await _routes.publish_linkedin_post(
                request=AsyncMock(),
                current_user={"id": "user_1"},
                db=MagicMock(),
            )

    assert exc_info.value.status_code == 401
    assert "No LinkedIn credentials" in str(exc_info.value.detail)


@pytest.mark.anyio
async def test_publish_linkedin_post_returns_400_for_empty_content() -> None:
    with (
        patch.object(
            _routes,
            "parse_publish_request",
            AsyncMock(return_value=("   ", None, None, None, None)),
        ),
        patch.object(
            _routes,
            "execute_linkedin_publish",
            AsyncMock(side_effect=HTTPException(status_code=400, detail="Post content cannot be empty")),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await _routes.publish_linkedin_post(
                request=AsyncMock(),
                current_user={"id": "user_1"},
                db=MagicMock(),
            )

    assert exc_info.value.status_code == 400


@pytest.mark.anyio
async def test_publish_linkedin_post_with_image_ids() -> None:
    expected = _routes.LinkedInPublishPostResponse(
        success=True,
        post_id="123",
        post_urn="urn:li:activity:123",
        provider="unipile",
        message="Published to LinkedIn with image.",
        debug_id="debug456",
        has_media=True,
    )

    with (
        patch.object(
            _routes,
            "parse_publish_request",
            AsyncMock(
                return_value=(
                    "Hello with image",
                    "acct-1",
                    ["abc123def4567890"],
                    None,
                    None,
                )
            ),
        ),
        patch.object(
            _routes,
            "execute_linkedin_publish",
            AsyncMock(return_value=expected),
        ) as mock_execute,
    ):
        response = await _routes.publish_linkedin_post(
            request=AsyncMock(),
            current_user={"id": "user_1"},
            db=MagicMock(),
        )

    assert response.success is True
    assert response.has_media is True
    mock_execute.assert_awaited_once()
    call_kwargs = mock_execute.await_args.kwargs
    assert call_kwargs["image_ids"] == ["abc123def4567890"]
    assert call_kwargs["user_id"] == "user_1"


@pytest.mark.anyio
async def test_publish_linkedin_post_with_image_ids() -> None:
    expected = _routes.LinkedInPublishPostResponse(
        success=True,
        post_id="123",
        post_urn="urn:li:activity:123",
        provider="unipile",
        message="Published to LinkedIn with image.",
        debug_id="debug456",
        has_media=True,
    )

    with (
        patch.object(
            _routes,
            "parse_publish_request",
            AsyncMock(
                return_value=(
                    "Hello with image",
                    "acct-1",
                    ["abc123def4567890"],
                    None,
                    None,
                )
            ),
        ),
        patch.object(
            _routes,
            "execute_linkedin_publish",
            AsyncMock(return_value=expected),
        ) as mock_execute,
    ):
        response = await _routes.publish_linkedin_post(
            request=AsyncMock(),
            current_user={"id": "user_1"},
            db=MagicMock(),
        )

    assert response.success is True
    assert response.has_media is True
    mock_execute.assert_awaited_once()
    call_kwargs = mock_execute.await_args.kwargs
    assert call_kwargs["image_ids"] == ["abc123def4567890"]
    assert call_kwargs["user_id"] == "user_1"
