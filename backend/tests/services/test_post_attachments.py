"""Unit tests for post_attachments module (PR #181).

Tests the Unipile attachment normalization logic that maps raw Unipile
post attachments[] to the PostAttachment API model.
"""

import pytest

from models.linkedin_posts_models import PostAttachment
from services.integrations.linkedin.post_attachments import (
    normalize_post_attachments,
    attachments_to_json,
    attachments_from_json,
)


# ---------------------------------------------------------------------------
# normalize_post_attachments
# ---------------------------------------------------------------------------

class TestNormalizeAttachments:
    def test_empty_when_no_attachments_key(self):
        result = normalize_post_attachments({"id": "post_1"})
        assert result == []

    def test_empty_when_attachments_is_none(self):
        result = normalize_post_attachments(
            {"id": "post_1", "attachments": None}
        )
        assert result == []

    def test_empty_when_attachments_is_empty_list(self):
        result = normalize_post_attachments(
            {"id": "post_1", "attachments": []}
        )
        assert result == []

    def test_normalizes_image_attachment(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "image",
                        "url": "https://example.com/img.png",
                    }
                ],
            }
        )
        assert len(result) == 1
        assert result[0].type == "image"
        assert result[0].url == "https://example.com/img.png"
        assert result[0].unavailable is False
        assert result[0].title is None

    def test_normalizes_video_attachment(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "video",
                        "url": "https://example.com/video.mp4",
                        "title": "Product Demo",
                    }
                ],
            }
        )
        assert len(result) == 1
        assert result[0].type == "video"
        assert result[0].title == "Product Demo"

    def test_normalizes_document_without_url(self):
        """Documents should be kept even without a URL (file types)."""
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "document",
                        "title": "Report.pdf",
                    }
                ],
            }
        )
        assert len(result) == 1
        assert result[0].type == "document"
        assert result[0].url is None
        assert result[0].title == "Report.pdf"

    def test_skips_image_without_url(self):
        """Non-file types without URL must be skipped."""
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "image",
                    }
                ],
            }
        )
        assert result == []

    def test_skips_unavailable_without_url(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "image",
                        "unavailable": True,
                    }
                ],
            }
        )
        assert result == []

    def test_keeps_unavailable_with_url(self):
        """Unavailable attachments with URL should still be kept."""
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "image",
                        "url": "https://example.com/old.png",
                        "unavailable": True,
                    }
                ],
            }
        )
        assert len(result) == 1
        assert result[0].unavailable is True

    def test_skips_non_dict_attachments(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": ["not_a_dict", 42, None],
            }
        )
        assert result == []

    def test_normalizes_type_case_and_whitespace(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "  IMAGE  ",
                        "url": "https://example.com/img.png",
                    }
                ],
            }
        )
        assert result[0].type == "image"

    def test_defaults_empty_type_to_img(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "url": "https://example.com/img.png",
                    }
                ],
            }
        )
        assert result[0].type == "img"

    def test_multiple_attachments(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "image",
                        "url": "https://example.com/1.png",
                    },
                    {
                        "type": "video",
                        "url": "https://example.com/2.mp4",
                    },
                    {
                        "type": "document",
                        "title": "Report.pdf",
                    },
                ],
            }
        )
        assert len(result) == 3
        types = [a.type for a in result]
        assert types == ["image", "video", "document"]

    def test_uses_name_field_as_title_fallback(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "document",
                        "name": "file.pdf",
                    }
                ],
            }
        )
        assert result[0].title == "file.pdf"

    def test_title_preferred_over_name(self):
        result = normalize_post_attachments(
            {
                "id": "post_1",
                "attachments": [
                    {
                        "type": "document",
                        "title": "Better Title",
                        "name": "file.pdf",
                    }
                ],
            }
        )
        assert result[0].title == "Better Title"


# ---------------------------------------------------------------------------
# attachments_to_json / attachments_from_json roundtrip
# ---------------------------------------------------------------------------

class TestAttachmentsSerialization:
    def test_roundtrip_preserves_data(self):
        original = [
            PostAttachment(
                type="image",
                url="https://example.com/img.png",
                unavailable=False,
                title="My Image",
            ),
            PostAttachment(
                type="video",
                url="https://example.com/vid.mp4",
                unavailable=False,
            ),
        ]
        json_data = attachments_to_json(original)
        restored = attachments_from_json(json_data)
        assert len(restored) == 2
        assert restored[0].type == "image"
        assert restored[0].url == "https://example.com/img.png"
        assert restored[0].title == "My Image"
        assert restored[1].type == "video"

    def test_from_json_returns_empty_for_non_list(self):
        assert attachments_from_json(None) == []
        assert attachments_from_json("not_a_list") == []
        assert attachments_from_json({}) == []
        assert attachments_from_json(42) == []

    def test_from_json_skips_invalid_items(self):
        raw = [
            {"type": "image", "url": "https://a.com"},
            "not_a_dict",
            {"invalid": "no type field but has defaults"},
        ]
        result = attachments_from_json(raw)
        assert len(result) == 2  # The dict with invalid fields still validates (defaults)

    def test_to_json_excludes_none(self):
        """attachments_to_json with exclude_none=True should strip null fields."""
        att = PostAttachment(type="image", url="https://a.com", title=None)
        data = attachments_to_json([att])
        assert "title" not in data[0]
