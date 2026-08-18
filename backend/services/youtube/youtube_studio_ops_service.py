"""
YouTube studio operations: channel videos, playlists, metadata refresh, community ideas.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from googleapiclient.discovery import build
from loguru import logger

from services.llm_providers.main_text_generation import llm_text_gen
from services.youtube.youtube_oauth_service import YouTubeOAuthService


class YouTubeStudioOpsService:
    def __init__(self, oauth_service: YouTubeOAuthService):
        self.oauth_service = oauth_service

    def list_channel_videos(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        max_results: int = 15,
    ) -> Dict[str, Any]:
        try:
            youtube, channel = self._client_and_channel(user_id, token_id)
            if not youtube:
                return channel  # error payload
            uploads = (
                (channel.get("contentDetails") or {})
                .get("relatedPlaylists", {})
                .get("uploads")
            )
            if not uploads:
                return {"success": True, "videos": [], "message": "No uploads playlist."}

            items_resp = (
                youtube.playlistItems()
                .list(
                    part="snippet,contentDetails",
                    playlistId=uploads,
                    maxResults=min(max_results, 50),
                )
                .execute()
            )
            video_ids = []
            meta = {}
            for item in items_resp.get("items") or []:
                vid = (item.get("contentDetails") or {}).get("videoId")
                if not vid:
                    continue
                video_ids.append(vid)
                sn = item.get("snippet") or {}
                meta[vid] = {
                    "video_id": vid,
                    "title": sn.get("title"),
                    "description": sn.get("description"),
                    "published_at": sn.get("publishedAt"),
                    "thumbnail": (
                        (sn.get("thumbnails") or {}).get("medium")
                        or (sn.get("thumbnails") or {}).get("default")
                        or {}
                    ).get("url"),
                }

            if video_ids:
                stats_resp = (
                    youtube.videos()
                    .list(part="statistics,snippet", id=",".join(video_ids))
                    .execute()
                )
                for v in stats_resp.get("items") or []:
                    vid = v.get("id")
                    if vid in meta:
                        st = v.get("statistics") or {}
                        meta[vid]["view_count"] = _int(st.get("viewCount"))
                        meta[vid]["like_count"] = _int(st.get("likeCount"))
                        meta[vid]["comment_count"] = _int(st.get("commentCount"))
                        sn = v.get("snippet") or {}
                        meta[vid]["tags"] = sn.get("tags") or []
                        meta[vid]["description"] = sn.get("description") or meta[vid].get(
                            "description"
                        )

            videos = [meta[vid] for vid in video_ids if vid in meta]
            return {"success": True, "videos": videos, "message": f"Loaded {len(videos)} videos."}
        except Exception as e:
            logger.error(f"YouTube list_channel_videos failed for {user_id}: {e}")
            return {"success": False, "error_code": "list_failed", "message": str(e)}

    def list_playlists(
        self,
        user_id: str,
        token_id: Optional[int] = None,
        max_results: int = 25,
    ) -> Dict[str, Any]:
        try:
            youtube, channel = self._client_and_channel(user_id, token_id)
            if not youtube:
                return channel
            resp = (
                youtube.playlists()
                .list(part="snippet,contentDetails", mine=True, maxResults=min(max_results, 50))
                .execute()
            )
            playlists = []
            for item in resp.get("items") or []:
                sn = item.get("snippet") or {}
                playlists.append(
                    {
                        "playlist_id": item.get("id"),
                        "title": sn.get("title"),
                        "description": sn.get("description"),
                        "item_count": (item.get("contentDetails") or {}).get("itemCount"),
                    }
                )
            return {"success": True, "playlists": playlists, "message": "Playlists loaded."}
        except Exception as e:
            logger.error(f"YouTube list_playlists failed for {user_id}: {e}")
            return {"success": False, "error_code": "playlists_failed", "message": str(e)}

    def add_video_to_playlist(
        self,
        user_id: str,
        playlist_id: str,
        video_id: str,
        token_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            youtube, err = self._client_only(user_id, token_id)
            if not youtube:
                return err
            body = {
                "snippet": {
                    "playlistId": playlist_id,
                    "resourceId": {"kind": "youtube#video", "videoId": video_id},
                }
            }
            resp = youtube.playlistItems().insert(part="snippet", body=body).execute()
            return {
                "success": True,
                "playlist_item_id": resp.get("id"),
                "message": "Video added to playlist.",
            }
        except Exception as e:
            logger.error(f"YouTube add_video_to_playlist failed for {user_id}: {e}")
            return {"success": False, "error_code": "playlist_add_failed", "message": str(e)}

    def suggest_stale_refresh(
        self,
        user_id: str,
        title: str,
        description: str = "",
        tags: Optional[List[str]] = None,
        niche: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            prompt = (
                "You are ALwrity YouTube SEO coach. Suggest a refresh pack for a stale video. "
                "Return strict JSON with keys: new_title, new_description, new_tags (array of 5-12), "
                "pin_comment, rationale.\n\n"
                f"Niche: {niche or 'SME thought leadership'}\n"
                f"Current title: {title}\n"
                f"Current description: {(description or '')[:1500]}\n"
                f"Current tags: {', '.join(tags or [])}\n"
            )
            raw = llm_text_gen(
                prompt=prompt,
                system_prompt="Return only valid JSON. No markdown.",
                user_id=user_id,
                json_struct={
                    "new_title": "string",
                    "new_description": "string",
                    "new_tags": ["string"],
                    "pin_comment": "string",
                    "rationale": "string",
                },
                flow_type="youtube_stale_refresh",
                max_tokens=700,
                temperature=0.6,
            )
            data = _parse_json(raw)
            return {
                "success": True,
                "suggestion": data,
                "message": "Refresh pack ready — review before applying (HITL).",
            }
        except Exception as e:
            logger.error(f"YouTube stale refresh suggest failed for {user_id}: {e}")
            return {"success": False, "error_code": "refresh_failed", "message": str(e)}

    def update_video_metadata(
        self,
        user_id: str,
        video_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        token_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """HITL-approved metadata update."""
        try:
            youtube, err = self._client_only(user_id, token_id)
            if not youtube:
                return err
            existing = (
                youtube.videos()
                .list(part="snippet", id=video_id)
                .execute()
            )
            items = existing.get("items") or []
            if not items:
                return {
                    "success": False,
                    "error_code": "video_not_found",
                    "message": "Video not found on this channel.",
                }
            snippet = items[0].get("snippet") or {}
            if title:
                snippet["title"] = title[:100]
            if description is not None:
                snippet["description"] = description
            if tags is not None:
                snippet["tags"] = tags
            # categoryId required on update
            if not snippet.get("categoryId"):
                snippet["categoryId"] = "22"
            body = {"id": video_id, "snippet": snippet}
            youtube.videos().update(part="snippet", body=body).execute()
            return {"success": True, "video_id": video_id, "message": "Metadata updated."}
        except Exception as e:
            logger.error(f"YouTube update_video_metadata failed for {user_id}: {e}")
            return {"success": False, "error_code": "update_failed", "message": str(e)}

    def community_post_ideas(
        self,
        user_id: str,
        niche: Optional[str] = None,
        recent_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """LLM community post ideas (YouTube has no public community-post write API)."""
        try:
            prompt = (
                "Generate 5 YouTube Community post ideas for an SME thought-leader channel. "
                "Return JSON: {\"ideas\": [{\"type\": \"poll|text|image_prompt\", \"copy\": \"...\", \"cta\": \"...\"}]}.\n"
                f"Niche: {niche or 'business growth'}\n"
                f"Recent video: {recent_title or 'n/a'}\n"
            )
            raw = llm_text_gen(
                prompt=prompt,
                system_prompt="Return only valid JSON.",
                user_id=user_id,
                json_struct={"ideas": [{"type": "text", "copy": "string", "cta": "string"}]},
                flow_type="youtube_community_ideas",
                max_tokens=600,
                temperature=0.7,
            )
            data = _parse_json(raw)
            ideas = data.get("ideas") if isinstance(data, dict) else []
            return {
                "success": True,
                "ideas": ideas or [],
                "message": "Copy an idea into YouTube Studio Community (manual publish).",
            }
        except Exception as e:
            logger.error(f"YouTube community ideas failed for {user_id}: {e}")
            return {"success": False, "error_code": "ideas_failed", "message": str(e)}

    def content_gap_ideas(
        self,
        user_id: str,
        niche: Optional[str] = None,
        recent_titles: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        try:
            titles = recent_titles or []
            prompt = (
                "Suggest 5 high-ROI YouTube video ideas that fill content gaps for this SME channel. "
                "Return JSON {\"gaps\": [{\"title\": \"...\", \"why\": \"...\", \"format\": \"long|shorts\"}]}.\n"
                f"Niche: {niche or 'general'}\n"
                f"Recent titles: {', '.join(titles[:12]) or 'none'}\n"
            )
            raw = llm_text_gen(
                prompt=prompt,
                system_prompt="Return only valid JSON.",
                user_id=user_id,
                json_struct={"gaps": [{"title": "string", "why": "string", "format": "long"}]},
                flow_type="youtube_content_gaps",
                max_tokens=600,
                temperature=0.65,
            )
            data = _parse_json(raw)
            return {
                "success": True,
                "gaps": (data.get("gaps") if isinstance(data, dict) else []) or [],
                "message": "Content gap ideas ready — pick one in Plan/Create (HITL).",
            }
        except Exception as e:
            logger.error(f"YouTube content gaps failed for {user_id}: {e}")
            return {"success": False, "error_code": "gaps_failed", "message": str(e)}

    def _client_and_channel(self, user_id: str, token_id: Optional[int]):
        creds = self.oauth_service.get_valid_credentials(user_id, token_id)
        if not creds:
            return None, {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube first.",
            }
        youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
        channel_resp = youtube.channels().list(
            part="snippet,contentDetails,statistics", mine=True
        ).execute()
        items = channel_resp.get("items") or []
        if not items:
            return None, {
                "success": False,
                "error_code": "no_channel",
                "message": "No YouTube channel found.",
            }
        return youtube, items[0]

    def _client_only(self, user_id: str, token_id: Optional[int]):
        creds = self.oauth_service.get_valid_credentials(user_id, token_id)
        if not creds:
            return None, {
                "success": False,
                "error_code": "not_connected",
                "message": "Connect YouTube first.",
            }
        return build("youtube", "v3", credentials=creds, cache_discovery=False), None


def _int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _parse_json(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    text = str(raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start : end + 1])
                return data if isinstance(data, dict) else {}
            except Exception:
                return {}
        return {}
