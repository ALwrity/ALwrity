"""
Tests for WordPressOAuthContentManager — the HTTP layer that talks to
WordPress over OAuth bearer tokens.

The manager mirrors the legacy WordPressContentManager but uses
`Authorization: Bearer <token>` instead of HTTP Basic auth. These tests
pin the request shape (URL, method, body, headers) so a refactor can't
silently break the integration.
"""

import sys
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, '.')

from services.integrations.wordpress_oauth_content import (
    WordPressOAuthContentManager,
)


def _mgr(site_url="https://blog.example.com", token="ATK"):
    return WordPressOAuthContentManager(site_url, token)


def _ok_response(payload=None, status=200):
    """Build a mock requests.Response with a JSON body."""
    resp = MagicMock()
    resp.status_code = status
    if status in (200, 201):
        resp.json.return_value = payload if payload is not None else {}
    else:
        resp.text = "error body"
    resp.content = b"{}" if status in (200, 201) else b"error body"
    return resp


class TestConstructor:
    def test_strips_trailing_slash_from_site_url(self):
        m = _mgr("https://blog.example.com/")
        assert m.site_url == "https://blog.example.com"

    def test_bearer_token_in_auth_header(self):
        m = _mgr(token="MY_SECRET_TOKEN")
        assert m._auth_headers == {"Authorization": "Bearer MY_SECRET_TOKEN"}

    def test_api_base_targets_wp_json_v2(self):
        m = _mgr("https://blog.example.com")
        assert m.api_base == "https://blog.example.com/wp-json/wp/v2"

    def test_empty_site_url_results_in_empty_api_base(self):
        m = _mgr("")
        # The _make_request method guards against this, but the constructor
        # itself doesn't fail.
        assert m.api_base == "/wp-json/wp/v2"


class TestCreatePost:
    def test_posts_to_wp_v2_posts_with_payload(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(
                {"id": 99, "link": "https://blog.example.com/?p=99"}
            )
            result = m.create_post(
                title="My Post",
                content="Hello world",
                status="publish",
            )

        assert result == {"id": 99, "link": "https://blog.example.com/?p=99"}
        # Verify the request shape.
        call = mock_req.call_args
        assert call.args[0] == "POST"
        assert call.args[1] == "https://blog.example.com/wp-json/wp/v2/posts"
        # The json body must contain the post fields.
        assert call.kwargs["json"]["title"] == "My Post"
        assert call.kwargs["json"]["content"] == "Hello world"
        assert call.kwargs["json"]["status"] == "publish"
        # Authorization header must use the bearer token.
        assert call.kwargs["headers"]["Authorization"] == "Bearer ATK"

    def test_create_post_omits_optional_fields_when_not_provided(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"id": 1, "link": "x"})
            m.create_post(title="T", content="C")

        body = mock_req.call_args.kwargs["json"]
        assert "featured_media" not in body
        assert "categories" not in body
        assert "tags" not in body
        assert "meta" not in body

    def test_create_post_includes_optional_fields_when_provided(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"id": 1, "link": "x"})
            m.create_post(
                title="T",
                content="C",
                featured_media_id=7,
                categories=[1, 2],
                tags=[3, 4],
                status="draft",
                meta={"description": "d"},
            )

        body = mock_req.call_args.kwargs["json"]
        assert body["featured_media"] == 7
        assert body["categories"] == [1, 2]
        assert body["tags"] == [3, 4]
        assert body["status"] == "draft"
        assert body["meta"] == {"description": "d"}

    def test_create_post_returns_none_on_4xx(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(status=401)
            assert m.create_post(title="T", content="C") is None

    def test_create_post_returns_none_on_500(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(status=500)
            assert m.create_post(title="T", content="C") is None


class TestUpdatePost:
    def test_posts_to_posts_id_with_kwargs_as_json(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"id": 5, "status": "publish"})
            m.update_post(5, status="publish", title="New title")

        call = mock_req.call_args
        assert call.args[0] == "POST"
        assert call.args[1] == "https://blog.example.com/wp-json/wp/v2/posts/5"
        assert call.kwargs["json"] == {"status": "publish", "title": "New title"}
        assert call.kwargs["headers"]["Authorization"] == "Bearer ATK"

    def test_update_post_returns_none_on_4xx(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(status=404)
            assert m.update_post(5, status="publish") is None


class TestDeletePost:
    def test_deletes_with_force_query_param_when_requested(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"deleted": True})
            result = m.delete_post(7, force=True)

        call = mock_req.call_args
        assert call.args[0] == "DELETE"
        assert call.args[1] == "https://blog.example.com/wp-json/wp/v2/posts/7"
        assert call.kwargs["params"] == {"force": True}
        assert result is True

    def test_delete_post_omits_force_param_when_false(self):
        """force=False is the default and means "don't force, move to trash".
        We don't send the param at all in that case so the WP API uses its
        default (trash)."""
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"deleted": True})
            m.delete_post(7, force=False)

        # No force param means WP will trash the post.
        assert mock_req.call_args.kwargs["params"] == {}

    def test_delete_post_omits_force_param_by_default(self):
        """By default (no force kwarg), the implementation should NOT
        send force=True, otherwise we'd permanently delete instead of
        moving to trash. The call may include an empty params dict, but
        it must never include force=True implicitly."""
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response({"deleted": True})
            m.delete_post(7)

        params = mock_req.call_args.kwargs.get("params", {})
        # force must not be True on a default delete
        assert params.get("force") is not True

    def test_delete_post_handles_empty_response_body(self):
        """WordPress can return an empty body for some DELETE responses;
        the implementation should still treat it as success."""
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            resp = MagicMock()
            resp.status_code = 200
            resp.content = b""
            mock_req.return_value = resp
            result = m.delete_post(7, force=True)

        assert result is True

    def test_delete_post_returns_false_on_404(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(status=404)
            assert m.delete_post(7) is False


class TestConnectionTest:
    def test_returns_true_on_200(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.get"
        ) as mock_get:
            mock_get.return_value = _ok_response(
                {"id": 1, "name": "admin"}, status=200
            )
            assert m._test_connection() is True

    def test_returns_false_on_401(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.get"
        ) as mock_get:
            mock_get.return_value = _ok_response(status=401)
            assert m._test_connection() is False

    def test_returns_false_on_network_error(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.get"
        ) as mock_get:
            mock_get.side_effect = ConnectionError("no network")
            assert m._test_connection() is False

    def test_uses_bearer_token_in_test_connection(self):
        m = _mgr(token="ZZZ")
        with patch(
            "services.integrations.wordpress_oauth_content.requests.get"
        ) as mock_get:
            mock_get.return_value = _ok_response(status=200)
            m._test_connection()
        assert mock_get.call_args.kwargs["headers"]["Authorization"] == "Bearer ZZZ"


class TestGetOrCreateCategory:
    def test_returns_existing_category_id(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            # First call: GET categories -> returns existing
            mock_req.return_value = _ok_response(
                [{"id": 7, "name": "News"}]
            )
            assert m.get_or_create_category("News") == 7
            # Only the GET was called; no POST.
            assert mock_req.call_count == 1
            assert mock_req.call_args.args[0] == "GET"

    def test_creates_when_not_found(self):
        m = _mgr()
        # Need two responses: GET (empty), POST (created)
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.side_effect = [
                _ok_response([]),  # GET: no existing categories
                _ok_response({"id": 12, "name": "Brand New"}),  # POST: created
            ]
            result = m.get_or_create_category("Brand New")
        assert result == 12
        assert mock_req.call_count == 2
        # Second call was a POST.
        assert mock_req.call_args_list[1].args[0] == "POST"

    def test_returns_none_on_creation_failure(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.side_effect = [
                _ok_response([]),  # GET: nothing
                _ok_response(status=500),  # POST: failed
            ]
            assert m.get_or_create_category("nope") is None

    def test_name_match_is_case_insensitive(self):
        m = _mgr()
        with patch(
            "services.integrations.wordpress_oauth_content.requests.request"
        ) as mock_req:
            mock_req.return_value = _ok_response(
                [{"id": 7, "name": "News"}]
            )
            # lowercase query matches uppercase stored
            assert m.get_or_create_category("news") == 7
