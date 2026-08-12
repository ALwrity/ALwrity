"""
Tests: YouTube combine/serve use shared video_storage path resolution.
"""

from __future__ import annotations

import inspect
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


class TestYouTubeCombineServePathWiring:
    def test_combine_endpoint_uses_find_youtube_video_file(self):
        from api.youtube.router import combine_scene_videos

        source = inspect.getsource(combine_scene_videos)
        assert "find_youtube_video_file" in source
        assert "get_youtube_video_dir" in source
        assert 'content" / "videos' not in source

    def test_combine_background_task_uses_find_and_youtube_url(self):
        from api.youtube.router import _execute_combine_video_task

        source = inspect.getsource(_execute_combine_video_task)
        assert "find_youtube_video_file" in source
        assert "get_youtube_video_dir" in source
        assert "PodcastVideoCombinationService" in source
        assert "combine_videos" in source
        assert "/api/youtube/videos/" in source
        assert "generate_story_video" not in source
        assert 'content" / "videos' not in source

    def test_serve_youtube_video_uses_find_helper(self):
        from api.youtube.router import serve_youtube_video

        source = inspect.getsource(serve_youtube_video)
        assert "find_youtube_video_file" in source
        assert "YOUTUBE_VIDEO_DIR / video_filename" not in source

    def test_renderer_full_video_uses_podcast_combiner(self):
        from services.youtube.renderer import YouTubeVideoRendererService

        source = inspect.getsource(YouTubeVideoRendererService.render_full_video)
        assert "PodcastVideoCombinationService" in source
        assert "combine_videos" in source
        assert "generate_story_video" not in source
