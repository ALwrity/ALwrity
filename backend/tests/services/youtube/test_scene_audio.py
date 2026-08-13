"""
Tests for YouTube scene audio helper extracted from renderer.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestResolveSceneAudioBase64:
    def test_returns_none_when_no_audio_and_generation_disabled(self):
        from services.youtube.scene_audio import resolve_scene_audio_base64

        result = resolve_scene_audio_base64(
            scene_number=1,
            scene_audio_url=None,
            narration="Hello",
            generate_audio_enabled=False,
            voice_id="Wise_Woman",
            user_id="user_audio",
        )
        assert result is None

    def test_generates_audio_when_enabled(self):
        from services.youtube.scene_audio import resolve_scene_audio_base64

        audio_bytes = b"fake-mp3-bytes"
        mock_generate = MagicMock(
            return_value=SimpleNamespace(audio_bytes=audio_bytes)
        )

        with patch(
            "services.llm_providers.main_audio_generation.generate_audio",
            new=mock_generate,
        ):
            result = resolve_scene_audio_base64(
                scene_number=2,
                scene_audio_url=None,
                narration="Narration text",
                generate_audio_enabled=True,
                voice_id="Wise_Woman",
                user_id="user_audio",
            )

        assert result == base64.b64encode(audio_bytes).decode("utf-8")
        mock_generate.assert_called_once()

    def test_loads_existing_local_audio_file(self, tmp_path):
        from services.youtube import audio_storage as storage
        from services.youtube import scene_audio as scene_audio_mod

        audio_file = tmp_path / "scene_1_title_abcd1234.mp3"
        audio_file.write_bytes(b"local-audio")

        with patch.object(storage, "_LEGACY_YOUTUBE_AUDIO_DIR", tmp_path):
            result = scene_audio_mod.resolve_scene_audio_base64(
                scene_number=1,
                scene_audio_url="/api/youtube/audio/scene_1_title_abcd1234.mp3",
                narration="",
                generate_audio_enabled=False,
                voice_id="Wise_Woman",
                user_id="user_audio",
            )

        assert result == base64.b64encode(b"local-audio").decode("utf-8")

    def test_loads_from_canonical_workspace_dir(self, tmp_path):
        from services.youtube import scene_audio as scene_audio_mod

        workspace_path = tmp_path / "ws"
        audio_dir = workspace_path / "media" / "youtube_audio"
        audio_dir.mkdir(parents=True)
        filename = "scene_3_title_workspace.mp3"
        (audio_dir / filename).write_bytes(b"workspace-audio")
        mock_db = MagicMock()

        with patch("services.user_workspace_manager.UserWorkspaceManager") as mock_mgr_cls:
            mock_mgr_cls.return_value.get_user_workspace.return_value = {
                "workspace_path": str(workspace_path),
            }
            result = scene_audio_mod.resolve_scene_audio_base64(
                scene_number=3,
                scene_audio_url=f"/api/youtube/audio/{filename}",
                narration="",
                generate_audio_enabled=False,
                voice_id="Wise_Woman",
                user_id="user_workspace",
                db=mock_db,
            )

        assert result == base64.b64encode(b"workspace-audio").decode("utf-8")
