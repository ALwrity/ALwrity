"""YouTube publish_at + privacy contract for Tab 1 / Hub schedule."""

from api.youtube.publish_router import PublishRequest


class TestYouTubePublishScheduleContract:
    def test_publish_at_is_optional(self):
        req = PublishRequest(
            token_id=1,
            video_source="/tmp/video.mp4",
            title="Test video title",
        )
        assert req.publish_at is None
        assert req.privacy_status == "unlisted"

    def test_publish_at_accepted_with_private_privacy(self):
        req = PublishRequest(
            token_id=1,
            video_source="/tmp/video.mp4",
            title="Scheduled upload",
            privacy_status="private",
            publish_at="2026-08-20T15:00:00Z",
        )
        assert req.publish_at == "2026-08-20T15:00:00Z"
        assert req.privacy_status == "private"
