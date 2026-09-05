"""
YouTube comment inbox + HITL reply helpers (Data API v3).
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.youtube_comment_thread_replies import (
    map_youtube_comment_reply_items,
    map_youtube_thread_replies,
)
from services.youtube.youtube_comment_delete import execute_youtube_comment_delete
from services.youtube.youtube_comment_update import execute_youtube_comment_update
from services.youtube.youtube_comment_video_titles import (
    attach_youtube_comment_video_titles,
)
from services.youtube.youtube_comments_insert_errors import (
    YOUTUBE_COMMENTS_INSERT_QUOTA_COST,
    user_safe_youtube_comment_insert_error,
    youtube_comment_http_error_reason,
    youtube_comment_insert_error_code,
)
from services.youtube.youtube_comments_list_errors import (
    YOUTUBE_COMMENT_THREADS_DEFAULT_RESULTS,
    YOUTUBE_COMMENT_THREADS_LIST_QUOTA_COST,
    YOUTUBE_COMMENT_THREADS_MAX_RESULTS,
    user_safe_youtube_comment_threads_list_error,
    youtube_comment_threads_list_error_code,
)
from services.youtube.youtube_comments_replies_list_errors import (
    YOUTUBE_COMMENTS_LIST_DEFAULT_RESULTS,
    YOUTUBE_COMMENTS_LIST_MAX_RESULTS,
    YOUTUBE_COMMENTS_LIST_QUOTA_COST,
    user_safe_youtube_comments_list_error,
    youtube_comments_list_error_code,
)
from services.youtube.youtube_oauth_service import YouTubeOAuthService
from services.youtube.youtube_publish_log import (
    youtube_publish_error_log_fields,
    youtube_publish_error_status,
)

YouTubeCommentAction = Literal["inbox", "draft", "reply", "replies"]


def user_safe_comment_error(
    exc: BaseException,
    *,
    action: YouTubeCommentAction,
) -> str:
    """User-facing copy for unexpected failures. Never leak Google/LLM text."""
    if action == "reply":
        documented = user_safe_youtube_comment_insert_error(exc)
        if documented:
            return documented
    if action == "inbox":
        documented = user_safe_youtube_comment_threads_list_error(exc)
        if documented:
            return documented
    if action == "replies":
        documented = user_safe_youtube_comments_list_error(exc)
        if documented:
            return documented
        status = youtube_publish_error_status(exc)
        if status in (401,):
            return "YouTube auth failed. Please reconnect your YouTube channel."
        return "Could not load replies. Please try again."
    status = youtube_publish_error_status(exc)
    if status in (401,):
        return "YouTube auth failed. Please reconnect your YouTube channel."
    if status == 403:
        if action == "inbox":
            return (
                "YouTube would not load comments. Check comment permissions and try again."
            )
        if action == "reply":
            return (
                "YouTube would not post that reply. Check comment permissions and try again."
            )
        return "YouTube rejected this request. Check channel permissions and try again."
    if status in (429, 500, 503):
        return "YouTube is busy. Please try again in a few minutes."
    if action == "inbox":
        return "Could not load comments. Please try again."
    if action == "draft":
        return "Could not draft a reply. Please try again."
    return "Could not send that reply. Please try again."


class YouTubeCommentsService:
    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def list_inbox(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        max_results: int = YOUTUBE_COMMENT_THREADS_DEFAULT_RESULTS,
    ) -> Dict[str, Any]:
        page_size = min(
            max(int(max_results), 1),
            YOUTUBE_COMMENT_THREADS_MAX_RESULTS,
        )
        logger.info(
            "[youtube_comments] Inbox start user_id={} has_token_id={} max_results={} "
            "quota_cost={}",
            user_id,
            bool(token_id),
            page_size,
            YOUTUBE_COMMENT_THREADS_LIST_QUOTA_COST,
        )
        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning(
                    "[youtube_comments] Inbox skipped not_connected user_id={}",
                    user_id,
                )
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to load comments.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            channel = youtube.channels().list(part="id", mine=True).execute()
            items = channel.get("items") or []
            if not items:
                logger.warning("[youtube_comments] Inbox no_channel user_id={}", user_id)
                return {
                    "success": False,
                    "error_code": "no_channel",
                    "message": "No YouTube channel found.",
                }
            channel_id = items[0]["id"]

            threads = (
                youtube.commentThreads()
                .list(
                    part="snippet,replies",
                    allThreadsRelatedToChannelId=channel_id,
                    maxResults=page_size,
                    order="time",
                    textFormat="plainText",
                )
                .execute()
            )

            comments: List[Dict[str, Any]] = []
            reply_row_count = 0
            can_edit_count = 0
            for thread in threads.get("items") or []:
                top = (thread.get("snippet") or {}).get("topLevelComment", {})
                tsn = top.get("snippet") or {}
                replies = map_youtube_thread_replies(thread, mine_channel_id=channel_id)
                reply_row_count += len(replies)
                can_edit_count += sum(1 for row in replies if row.get("can_edit"))
                comments.append(
                    {
                        "thread_id": thread.get("id"),
                        "comment_id": top.get("id"),
                        "video_id": tsn.get("videoId"),
                        "author": tsn.get("authorDisplayName"),
                        "text": tsn.get("textDisplay") or tsn.get("textOriginal"),
                        "like_count": tsn.get("likeCount"),
                        "published_at": tsn.get("publishedAt"),
                        "total_reply_count": (thread.get("snippet") or {}).get(
                            "totalReplyCount", 0
                        ),
                        "can_reply": (thread.get("snippet") or {}).get("canReply", True),
                        "replies": replies,
                    }
                )

            attach_youtube_comment_video_titles(youtube, comments, user_id=user_id)
            unique_video_ids = {
                (row.get("video_id") or "").strip()
                for row in comments
                if (row.get("video_id") or "").strip()
            }
            logger.info(
                "[youtube_comments] Inbox complete user_id={} comment_count={} "
                "unique_video_id_count={} reply_row_count={} can_edit_count={} quota_cost={}",
                user_id,
                len(comments),
                len(unique_video_ids),
                reply_row_count,
                can_edit_count,
                YOUTUBE_COMMENT_THREADS_LIST_QUOTA_COST,
            )
            return {
                "success": True,
                "comments": comments,
                "message": f"Loaded {len(comments)} recent comments.",
            }
        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            _status, youtube_reason = youtube_comment_http_error_reason(e)
            logger.error(
                "[youtube_comments] Inbox failed user_id={} error_type={} "
                "http_status={} youtube_reason={}",
                user_id,
                fields["error_type"],
                fields["http_status"],
                youtube_reason,
            )
            return {
                "success": False,
                "error_code": youtube_comment_threads_list_error_code(e) or "inbox_failed",
                "message": user_safe_comment_error(e, action="inbox"),
                "comments": [],
            }

    def list_replies(
        self,
        user_id: str,
        parent_id: str,
        token_id: Optional[int] = None,
        max_results: int = YOUTUBE_COMMENTS_LIST_DEFAULT_RESULTS,
    ) -> Dict[str, Any]:
        """Comments.list for Show more. GET parentId only — never the id filter."""
        page_size = min(
            max(int(max_results), 1),
            YOUTUBE_COMMENTS_LIST_MAX_RESULTS,
        )
        parent = (parent_id or "").strip()
        logger.info(
            "[youtube_comments] Replies list start user_id={} has_parent_id={} "
            "max_results={} quota_cost={}",
            user_id,
            bool(parent),
            page_size,
            YOUTUBE_COMMENTS_LIST_QUOTA_COST,
        )
        if not parent:
            logger.warning(
                "[youtube_comments] Replies list skipped empty_parent user_id={}",
                user_id,
            )
            return {
                "success": False,
                "error_code": "parent_id_required",
                "message": "A parent comment is required to load replies.",
                "replies": [],
            }
        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning(
                    "[youtube_comments] Replies list skipped not_connected user_id={}",
                    user_id,
                )
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to load comments.",
                    "replies": [],
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            mine_channel_id = ""
            try:
                channel = youtube.channels().list(part="id", mine=True).execute()
                channel_items = channel.get("items") if isinstance(channel, dict) else None
                if not isinstance(channel_items, list):
                    channel_items = []
                if channel_items and isinstance(channel_items[0], dict):
                    mine_channel_id = str(channel_items[0].get("id") or "").strip()
            except Exception as channel_exc:
                fields = youtube_publish_error_log_fields(channel_exc)
                logger.warning(
                    "[youtube_comments] Replies list mine channel skipped user_id={} "
                    "error_type={} http_status={}",
                    user_id,
                    fields["error_type"],
                    fields["http_status"],
                )
            resp = (
                youtube.comments()
                .list(
                    part="snippet",
                    parentId=parent,
                    maxResults=page_size,
                    textFormat="plainText",
                )
                .execute()
            )
            replies = map_youtube_comment_reply_items(
                resp.get("items"),
                mine_channel_id=mine_channel_id,
            )
            can_edit_count = sum(1 for row in replies if row.get("can_edit"))
            logger.info(
                "[youtube_comments] Replies list complete user_id={} has_parent_id={} "
                "max_results={} returned_count={} can_edit_count={} quota_cost={}",
                user_id,
                True,
                page_size,
                len(replies),
                can_edit_count,
                YOUTUBE_COMMENTS_LIST_QUOTA_COST,
            )
            return {
                "success": True,
                "replies": replies,
                "message": f"Loaded {len(replies)} replies.",
            }
        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            _status, youtube_reason = youtube_comment_http_error_reason(e)
            logger.error(
                "[youtube_comments] Replies list failed user_id={} error_type={} "
                "http_status={} youtube_reason={} has_parent_id={} max_results={} "
                "quota_cost={}",
                user_id,
                fields["error_type"],
                fields["http_status"],
                youtube_reason,
                True,
                page_size,
                YOUTUBE_COMMENTS_LIST_QUOTA_COST,
            )
            return {
                "success": False,
                "error_code": youtube_comments_list_error_code(e) or "replies_failed",
                "message": user_safe_comment_error(e, action="replies"),
                "replies": [],
            }

    def update_reply(self, user_id: str, comment_id: str, text: str, token_id: Optional[int] = None) -> Dict[str, Any]:
        """Comments.update for HITL edit of an owned reply."""
        return execute_youtube_comment_update(
            self.oauth_service, user_id, comment_id, text, token_id=token_id
        )

    def delete_reply(self, user_id: str, comment_id: str, token_id: Optional[int] = None) -> Dict[str, Any]:
        """Comments.delete for HITL delete of an owned reply."""
        return execute_youtube_comment_delete(
            self.oauth_service, user_id, comment_id, token_id=token_id
        )

    def draft_reply(
        self,
        user_id: str,
        comment_text: str,
        video_title: Optional[str] = None,
        channel_niche: Optional[str] = None,
        persona_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """LLM draft only — human must approve before send (HITL)."""
        logger.info(
            "[youtube_comments] Draft start user_id={} comment_length={} "
            "has_video_title={} has_niche={} has_persona_notes={}",
            user_id,
            len(comment_text or ""),
            bool(video_title and str(video_title).strip()),
            bool(channel_niche and str(channel_niche).strip()),
            bool(persona_notes and str(persona_notes).strip()),
        )
        try:
            prompt = (
                "Draft a short, authentic YouTube comment reply for an SME thought-leader. "
                "Be warm, specific, and invite further conversation. "
                "No hashtags spam. Max 2 short sentences.\n\n"
                f"Channel niche: {channel_niche or 'general'}\n"
                f"Video title: {video_title or 'unknown'}\n"
                f"Persona notes: {persona_notes or 'professional, helpful'}\n"
                f"Viewer comment: {comment_text.strip()}\n\n"
                "Return only the reply text."
            )
            draft = llm_text_gen(
                prompt=prompt,
                system_prompt=(
                    "You are ALwrity, an AI writing assistant. "
                    "Draft HITL replies the creator will review before posting."
                ),
                user_id=user_id,
                flow_type="youtube_comment_draft",
                max_tokens=180,
                temperature=0.7,
            )
            text = (draft or "").strip().strip('"')
            if not text:
                logger.warning(
                    "[youtube_comments] Draft empty user_id={}",
                    user_id,
                )
                return {
                    "success": False,
                    "error_code": "empty_draft",
                    "message": "Could not draft a reply. Try again.",
                }
            logger.info(
                "[youtube_comments] Draft complete user_id={} draft_length={}",
                user_id,
                len(text),
            )
            return {"success": True, "draft": text, "message": "Draft ready for HITL review."}
        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            logger.error(
                "[youtube_comments] Draft failed user_id={} error_type={} http_status={}",
                user_id,
                fields["error_type"],
                fields["http_status"],
            )
            return {
                "success": False,
                "error_code": "draft_failed",
                "message": user_safe_comment_error(e, action="draft"),
            }

    def send_reply(
        self,
        user_id: str,
        parent_id: str,
        text: str,
        token_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Post an approved reply (HITL). parent_id is the comment/thread parent id."""
        logger.info(
            "[youtube_comments] Send start user_id={} has_parent_id={} reply_length={} "
            "has_token_id={} quota_cost={}",
            user_id,
            bool(parent_id),
            len(text or ""),
            bool(token_id),
            YOUTUBE_COMMENTS_INSERT_QUOTA_COST,
        )
        try:
            text = (text or "").strip()
            if not text:
                logger.warning("[youtube_comments] Send skipped empty_text user_id={}", user_id)
                return {
                    "success": False,
                    "error_code": "empty_text",
                    "message": "Reply text is required.",
                }
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                logger.warning(
                    "[youtube_comments] Send skipped not_connected user_id={}",
                    user_id,
                )
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to reply.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            body = {
                "snippet": {
                    "parentId": parent_id,
                    "textOriginal": text,
                }
            }
            resp = youtube.comments().insert(part="snippet", body=body).execute()
            logger.info(
                "[youtube_comments] Send complete user_id={} has_reply_id={} quota_cost={}",
                user_id,
                bool(resp.get("id")),
                YOUTUBE_COMMENTS_INSERT_QUOTA_COST,
            )
            return {
                "success": True,
                "comment_id": resp.get("id"),
                "message": "Reply published.",
            }
        except Exception as e:
            fields = youtube_publish_error_log_fields(e)
            _status, youtube_reason = youtube_comment_http_error_reason(e)
            logger.error(
                "[youtube_comments] Send failed user_id={} error_type={} "
                "http_status={} youtube_reason={}",
                user_id,
                fields["error_type"],
                fields["http_status"],
                youtube_reason,
            )
            return {
                "success": False,
                "error_code": youtube_comment_insert_error_code(e) or "reply_failed",
                "message": user_safe_comment_error(e, action="reply"),
            }
