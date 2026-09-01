"""Unit tests for YouTube publish log helpers."""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

_BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from services.youtube.youtube_publish_log import (
    user_safe_publish_error,
    youtube_publish_error_log_fields,
    youtube_publish_source_meta,
)


class TestYouTubePublishSourceMeta:
    def test_classifies_creator_api_path_without_filename(self):
        meta = youtube_publish_source_meta("/api/youtube/videos/final.mp4")
        assert meta == {
            "source_kind": "youtube_api_path",
            "source_length": len("/api/youtube/videos/final.mp4"),
        }
        assert "final.mp4" not in str(meta.values())

    def test_classifies_http_empty_and_local(self):
        assert youtube_publish_source_meta("https://cdn.example/v.mp4")["source_kind"] == "http"
        assert youtube_publish_source_meta("")["source_kind"] == "empty"
        assert youtube_publish_source_meta("/tmp/video.mp4")["source_kind"] == "local_or_other"


class TestUserSafePublishError:
    def test_maps_google_http_status(self):
        forbidden = SimpleNamespace(resp=SimpleNamespace(status=403))
        assert "rejected" in user_safe_publish_error(forbidden).lower()
        unauthorized = SimpleNamespace(resp=SimpleNamespace(status=401))
        assert "reconnect" in user_safe_publish_error(unauthorized).lower()
        bad_request = SimpleNamespace(resp=SimpleNamespace(status=400))
        assert "could not accept" in user_safe_publish_error(bad_request).lower()
        busy = SimpleNamespace(resp=SimpleNamespace(status=429))
        assert "busy" in user_safe_publish_error(busy).lower()

    def test_generic_exception_does_not_leak_raw_message(self):
        raw = RuntimeError("https://secret.example/token=abc upload failed")
        message = user_safe_publish_error(raw)
        assert "secret.example" not in message
        assert "token=" not in message
        assert message == "Upload failed after retries."

    def test_log_fields_omit_exception_message(self):
        fields = youtube_publish_error_log_fields(RuntimeError("https://leak.example"))
        assert fields["error_type"] == "RuntimeError"
        assert "leak.example" not in str(fields)
