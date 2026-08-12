"""
Behavioral coverage for YouTube router.py endpoints.

Pre-refactor safety net: each public endpoint/helper is exercised with
mocked services so behavior is locked before modularizing router.py.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _user(uid: str = "user_router_test") -> dict:
    return {"id": uid, "email": "test@example.com"}


def _sample_scene(num: int = 1, **overrides) -> dict:
    scene = {
        "scene_number": num,
        "title": f"Scene {num}",
        "narration": "Hello world narration",
        "visual_prompt": "A clear visual description for rendering",
        "duration_estimate": 5,
        "enabled": True,
        "imageUrl": f"/api/youtube/images/scenes/scene_{num}.png",
        "audioUrl": f"/api/youtube/audio/scene_{num}.mp3",
    }
    scene.update(overrides)
    return scene


def _video_plan() -> dict:
    return {
        "video_summary": "Test plan",
        "target_audience": "Creators",
        "content_outline": [],
        "hook_strategy": "Hook",
        "visual_style": "Modern",
        "seo_keywords": [],
        "duration_type": "shorts",
    }


class TestRequireAuthenticatedUser:
    def test_returns_user_id(self):
        from api.youtube.router import require_authenticated_user

        assert require_authenticated_user(_user("abc")) == "abc"

    def test_raises_401_when_missing(self):
        from api.youtube.router import require_authenticated_user

        with pytest.raises(HTTPException) as exc:
            require_authenticated_user({})
        assert exc.value.status_code == 401


class TestCreateVideoPlan:
    def test_success_returns_plan(self):
        from api.youtube.router import VideoPlanRequest, create_video_plan

        request = VideoPlanRequest(user_idea="How to travel cheap", duration_type="shorts")
        plan = {"video_summary": "Travel tips"}

        with patch("api.youtube.router.YouTubePlannerService") as mock_cls:
            mock_cls.return_value.generate_plan = AsyncMock(return_value=plan)
            result = asyncio.run(create_video_plan(request=request, current_user=_user()))

        assert result.success is True
        assert result.plan == plan

    def test_failure_returns_error_response(self):
        from api.youtube.router import VideoPlanRequest, create_video_plan

        request = VideoPlanRequest(user_idea="Broken plan", duration_type="shorts")
        with patch("api.youtube.router.YouTubePlannerService") as mock_cls:
            mock_cls.return_value.generate_plan = AsyncMock(side_effect=RuntimeError("boom"))
            result = asyncio.run(create_video_plan(request=request, current_user=_user()))

        assert result.success is False
        assert "Failed to create video plan" in result.message


class TestBuildScenes:
    def test_success_returns_scenes(self):
        from api.youtube.router import SceneBuildRequest, build_scenes

        request = SceneBuildRequest(video_plan=_video_plan())
        scenes = [_sample_scene(1), _sample_scene(2)]

        with patch("api.youtube.router.YouTubeSceneBuilderService") as mock_cls:
            mock_cls.return_value.build_scenes_from_plan.return_value = scenes
            result = asyncio.run(build_scenes(request=request, current_user=_user()))

        assert result.success is True
        assert len(result.scenes) == 2

    def test_failure_returns_error_response(self):
        from api.youtube.router import SceneBuildRequest, build_scenes

        request = SceneBuildRequest(video_plan=_video_plan())
        with patch("api.youtube.router.YouTubeSceneBuilderService") as mock_cls:
            mock_cls.return_value.build_scenes_from_plan.side_effect = RuntimeError("fail")
            result = asyncio.run(build_scenes(request=request, current_user=_user()))

        assert result.success is False
        assert "Failed to build scenes" in result.message


class TestUpdateScene:
    def test_updates_scene_fields(self):
        from api.youtube.router import SceneUpdateRequest, update_scene

        request = SceneUpdateRequest(
            scene_id=2,
            narration="Updated narration",
            visual_description="Updated visuals",
            duration_estimate=6.0,
            enabled=False,
        )
        result = asyncio.run(update_scene(scene_id=2, request=request, current_user=_user()))

        assert result.success is True
        assert result.scene["scene_number"] == 2
        assert result.scene["narration"] == "Updated narration"
        assert result.scene["enabled"] is False


class TestStartVideoRender:
    def test_rejects_when_no_enabled_scenes(self):
        from api.youtube.router import VideoRenderRequest, start_video_render

        request = VideoRenderRequest(
            scenes=[_sample_scene(1, enabled=False)],
            video_plan=_video_plan(),
        )
        result = asyncio.run(
            start_video_render(
                request=request,
                background_tasks=BackgroundTasks(),
                current_user=_user(),
                db=MagicMock(),
            )
        )
        assert result.success is False
        assert "No enabled scenes" in result.message

    def test_rejects_missing_assets(self):
        from api.youtube.router import VideoRenderRequest, start_video_render

        request = VideoRenderRequest(
            scenes=[_sample_scene(1, imageUrl=None, audioUrl=None)],
            video_plan=_video_plan(),
        )
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"):
            result = asyncio.run(
                start_video_render(
                    request=request,
                    background_tasks=BackgroundTasks(),
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is False
        assert "Validation failed" in result.message

    def test_creates_task_and_queues_background_work(self):
        from api.youtube.router import VideoRenderRequest, start_video_render

        request = VideoRenderRequest(
            scenes=[_sample_scene(1), _sample_scene(2)],
            video_plan=_video_plan(),
            combine_scenes=True,
        )
        bg = BackgroundTasks()
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"):
            result = asyncio.run(
                start_video_render(
                    request=request,
                    background_tasks=bg,
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is True
        assert result.task_id
        assert len(bg.tasks) == 1


class TestRenderSingleSceneVideo:
    def test_rejects_invalid_scene(self):
        from api.youtube.router import SceneVideoRenderRequest, render_single_scene_video

        request = SceneVideoRenderRequest(
            scene=_sample_scene(1, visual_prompt="", imageUrl=None),
            video_plan=_video_plan(),
        )
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"):
            result = asyncio.run(
                render_single_scene_video(
                    request=request,
                    background_tasks=BackgroundTasks(),
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is False
        assert "Validation failed" in result.message

    def test_creates_task_for_valid_scene(self):
        from api.youtube.router import SceneVideoRenderRequest, render_single_scene_video

        request = SceneVideoRenderRequest(
            scene=_sample_scene(3),
            video_plan=_video_plan(),
        )
        bg = BackgroundTasks()
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"):
            result = asyncio.run(
                render_single_scene_video(
                    request=request,
                    background_tasks=bg,
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is True
        assert result.task_id
        assert result.scene_number == 3
        assert len(bg.tasks) == 1


class TestGetRenderStatus:
    def test_returns_status_when_found(self):
        from api.youtube.router import get_render_status
        from services.youtube.youtube_task_manager import task_manager

        task_id = task_manager.create_task("youtube_video_render")
        status = asyncio.run(get_render_status(task_id=task_id, current_user=_user()))
        assert status is not None
        assert status["status"] == "pending"

    def test_returns_none_when_missing(self):
        from api.youtube.router import get_render_status

        status = asyncio.run(
            get_render_status(task_id="missing-task-id", current_user=_user())
        )
        assert status is None


class TestEstimateRenderCost:
    def test_success(self):
        from api.youtube.router import CostEstimateRequest, estimate_render_cost

        request = CostEstimateRequest(scenes=[_sample_scene(1)], resolution="720p")
        estimate = {"total_cost": 1.25, "scene_count": 1}
        with patch("api.youtube.router.YouTubeVideoRendererService") as mock_cls:
            mock_cls.return_value.estimate_render_cost.return_value = estimate
            result = asyncio.run(estimate_render_cost(request=request, current_user=_user()))

        assert result.success is True
        assert result.estimate == estimate

    def test_failure(self):
        from api.youtube.router import CostEstimateRequest, estimate_render_cost

        request = CostEstimateRequest(scenes=[_sample_scene(1)], resolution="720p")
        with patch("api.youtube.router.YouTubeVideoRendererService") as mock_cls:
            mock_cls.return_value.estimate_render_cost.side_effect = RuntimeError("nope")
            result = asyncio.run(estimate_render_cost(request=request, current_user=_user()))

        assert result.success is False
        assert "Failed to estimate cost" in result.message


class TestListVideos:
    def test_lists_assets(self):
        from api.youtube.router import list_videos

        asset = SimpleNamespace(
            id=1,
            filename="scene_1.mp4",
            file_url="/api/youtube/videos/scene_1.mp4",
            created_at=None,
            asset_metadata={"scene_number": 1, "resolution": "720p"},
        )
        mock_db = MagicMock()
        with patch("api.youtube.router.ContentAssetService") as mock_cls:
            mock_cls.return_value.get_user_assets.return_value = ([asset], 1)
            result = asyncio.run(list_videos(current_user=_user(), db=mock_db))

        assert result.success is True
        assert len(result.videos) == 1
        assert result.videos[0]["scene_number"] == 1

    def test_returns_empty_on_error(self):
        from api.youtube.router import list_videos

        with patch("api.youtube.router.ContentAssetService") as mock_cls:
            mock_cls.return_value.get_user_assets.side_effect = RuntimeError("db down")
            result = asyncio.run(list_videos(current_user=_user(), db=MagicMock()))

        assert result.success is False
        assert result.videos == []


class TestCombineSceneVideos:
    def test_requires_at_least_two_urls(self):
        from api.youtube.router import CombineVideosRequest, combine_scene_videos

        request = CombineVideosRequest(scene_video_urls=["/api/youtube/videos/a.mp4"])
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"):
            result = asyncio.run(
                combine_scene_videos(
                    request=request,
                    background_tasks=BackgroundTasks(),
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is False
        assert "At least two scene videos" in result.message

    def test_rejects_missing_files(self):
        from api.youtube.router import CombineVideosRequest, combine_scene_videos

        request = CombineVideosRequest(
            scene_video_urls=[
                "/api/youtube/videos/missing_1.mp4",
                "/api/youtube/videos/missing_2.mp4",
            ]
        )
        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"), \
             patch("api.youtube.router.get_youtube_video_dir", return_value=Path("/tmp")), \
             patch("api.youtube.router.find_youtube_video_file", return_value=None):
            result = asyncio.run(
                combine_scene_videos(
                    request=request,
                    background_tasks=BackgroundTasks(),
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is False
        assert "Video files not found" in result.message

    def test_queues_combine_when_files_exist(self, tmp_path):
        from api.youtube.router import CombineVideosRequest, combine_scene_videos

        f1 = tmp_path / "a.mp4"
        f2 = tmp_path / "b.mp4"
        f1.write_bytes(b"a")
        f2.write_bytes(b"b")
        request = CombineVideosRequest(
            scene_video_urls=["/api/youtube/videos/a.mp4", "/api/youtube/videos/b.mp4"]
        )
        bg = BackgroundTasks()

        def _find(name, user_id=None, db=None):
            return {"a.mp4": f1, "b.mp4": f2}.get(name)

        with patch("api.youtube.router.PricingService"), \
             patch("api.youtube.router.validate_scene_animation_operation"), \
             patch("api.youtube.router.get_youtube_video_dir", return_value=tmp_path), \
             patch("api.youtube.router.find_youtube_video_file", side_effect=_find):
            result = asyncio.run(
                combine_scene_videos(
                    request=request,
                    background_tasks=bg,
                    current_user=_user(),
                    db=MagicMock(),
                )
            )
        assert result.success is True
        assert result.task_id
        assert len(bg.tasks) == 1


class TestServeYouTubeVideo:
    def test_rejects_path_traversal(self):
        from api.youtube.router import serve_youtube_video

        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                serve_youtube_video(video_filename="../secret.mp4", current_user=_user())
            )
        assert exc.value.status_code == 400

    def test_returns_file_when_found(self, tmp_path):
        from api.youtube.router import serve_youtube_video

        video = tmp_path / "final.mp4"
        video.write_bytes(b"mp4data")
        mock_db = MagicMock()

        with patch("services.database.get_session_for_user", return_value=mock_db), \
             patch("api.youtube.router.find_youtube_video_file", return_value=video):
            response = asyncio.run(
                serve_youtube_video(video_filename="final.mp4", current_user=_user())
            )

        assert response.path == str(video)
        mock_db.close.assert_called_once()

    def test_404_when_missing(self):
        from api.youtube.router import serve_youtube_video

        with patch("services.database.get_session_for_user", return_value=MagicMock()), \
             patch("api.youtube.router.find_youtube_video_file", return_value=None):
            with pytest.raises(HTTPException) as exc:
                asyncio.run(
                    serve_youtube_video(video_filename="gone.mp4", current_user=_user())
                )
        assert exc.value.status_code == 404
