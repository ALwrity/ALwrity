from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.integrations.linkedin.exceptions import LinkedInMediaValidationError
from services.integrations.linkedin.linkedin_publish_media_service import (
    LinkedInPublishMediaService,
)


@pytest.mark.anyio
async def test_resolve_ai_image_path_uses_storage_path(tmp_path: Path) -> None:
    image_file = tmp_path / "abc123def4567890.png"
    image_file.write_bytes(b"fake-image")

    storage = MagicMock()
    storage.retrieve_image = AsyncMock(
        return_value={
            "success": True,
            "image_path": str(image_file),
            "image_data": b"fake-image",
        }
    )
    service = LinkedInPublishMediaService(storage=storage, upload_base=tmp_path / "uploads")

    resolution = await service.resolve_for_publish(
        "user_1",
        image_ids=["abc123def4567890"],
    )

    assert resolution.has_media is True
    assert resolution.media_paths == [str(image_file)]
    assert resolution.temp_paths_to_cleanup == []


@pytest.mark.anyio
async def test_resolve_rejects_multiple_image_ids() -> None:
    service = LinkedInPublishMediaService(storage=MagicMock())

    with pytest.raises(ValueError, match="Maximum 1 image"):
        await service.resolve_for_publish(
            "user_1",
            image_ids=["abc123def4567890", "fedcba0987654321"],
        )


@pytest.mark.anyio
async def test_resolve_rejects_image_ids_and_upload_together() -> None:
    service = LinkedInPublishMediaService(storage=MagicMock())

    with pytest.raises(ValueError, match="either image_ids or an uploaded file"):
        await service.resolve_for_publish(
            "user_1",
            image_ids=["abc123def4567890"],
            upload_bytes=b"abc",
        )


@pytest.mark.anyio
async def test_persist_uploaded_image_creates_temp_file(tmp_path: Path) -> None:
    service = LinkedInPublishMediaService(storage=MagicMock(), upload_base=tmp_path)

    path = service.persist_uploaded_image("user_1", b"hello", "photo.png")
    assert Path(path).exists()
    assert Path(path).read_bytes() == b"hello"


@pytest.mark.anyio
async def test_validate_media_path_raises_on_invalid_image(tmp_path: Path) -> None:
    bad_file = tmp_path / "bad.png"
    bad_file.write_bytes(b"not-an-image")
    service = LinkedInPublishMediaService(storage=MagicMock(), upload_base=tmp_path / "uploads")

    with pytest.raises(LinkedInMediaValidationError):
        service._validate_media_path(str(bad_file))
