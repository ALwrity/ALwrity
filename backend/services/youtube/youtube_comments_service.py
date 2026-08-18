"""
YouTube comment inbox + HITL reply helpers (Data API v3).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.youtube_oauth_service import YouTubeOAuthService


class YouTubeCommentsService:
    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def list_inbox(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        max_results: int = 20,
    ) -> Dict[str, Any]:
        try:
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to load comments.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            channel = youtube.channels().list(part="id", mine=True).execute()
            items = channel.get("items") or []
            if not items:
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
                    maxResults=min(max_results, 50),
                    order="time",
                    textFormat="plainText",
                )
                .execute()
            )

            comments: List[Dict[str, Any]] = []
            for thread in threads.get("items") or []:
                top = (thread.get("snippet") or {}).get("topLevelComment", {})
                tsn = top.get("snippet") or {}
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
                    }
                )

            return {
                "success": True,
                "comments": comments,
                "message": f"Loaded {len(comments)} recent comments.",
            }
        except Exception as e:
            logger.error(f"YouTube comments inbox failed for {user_id}: {e}")
            return {
                "success": False,
                "error_code": "inbox_failed",
                "message": str(e),
                "comments": [],
            }

    def draft_reply(
        self,
        user_id: str,
        comment_text: str,
        video_title: Optional[str] = None,
        channel_niche: Optional[str] = None,
        persona_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """LLM draft only — human must approve before send (HITL)."""
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
                return {
                    "success": False,
                    "error_code": "empty_draft",
                    "message": "Could not draft a reply. Try again.",
                }
            return {"success": True, "draft": text, "message": "Draft ready for HITL review."}
        except Exception as e:
            logger.error(f"YouTube comment draft failed for {user_id}: {e}")
            return {
                "success": False,
                "error_code": "draft_failed",
                "message": str(e),
            }

    def send_reply(
        self,
        user_id: str,
        parent_id: str,
        text: str,
        token_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Post an approved reply (HITL). parent_id is the comment/thread parent id."""
        try:
            text = (text or "").strip()
            if not text:
                return {
                    "success": False,
                    "error_code": "empty_text",
                    "message": "Reply text is required.",
                }
            creds = self.oauth_service.get_valid_credentials(user_id, token_id)
            if not creds:
                return {
                    "success": False,
                    "error_code": "not_connected",
                    "message": "Connect YouTube to reply.",
                }

            youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
            body = {
                "snippet": {
                    "parentId": parent_id,
                    "textOriginal": text[:9000],
                }
            }
            resp = youtube.comments().insert(part="snippet", body=body).execute()
            return {
                "success": True,
                "comment_id": resp.get("id"),
                "message": "Reply published.",
            }
        except Exception as e:
            logger.error(f"YouTube comment reply failed for {user_id}: {e}")
            return {
                "success": False,
                "error_code": "reply_failed",
                "message": str(e),
            }
