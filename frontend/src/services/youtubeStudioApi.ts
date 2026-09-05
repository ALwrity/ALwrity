import { apiClient } from "../api/client";

const API_BASE = "/api/youtube";

/** Studio Hub client methods. Separate from the core youtubeApi object so webpack/TS pick them up. */
export const youtubeStudioApi = {
  async getChannelPulse(params?: { days?: number; token_id?: number }) {
    const response = await apiClient.get(`${API_BASE}/analytics/pulse`, { params });
    return response.data;
  },

  async getRetentionSummary(params?: { days?: number; token_id?: number }) {
    const response = await apiClient.get(`${API_BASE}/analytics/retention`, { params });
    return response.data;
  },

  async getCommentInbox(params?: { max_results?: number; token_id?: number }) {
    console.info("[youtubeStudioApi] comment inbox start", {
      maxResults: params?.max_results,
      hasTokenId: Boolean(params?.token_id),
    });
    try {
      const response = await apiClient.get(`${API_BASE}/comments/inbox`, { params });
      console.info("[youtubeStudioApi] comment inbox complete", {
        success: Boolean(response.data?.success),
        commentCount: Array.isArray(response.data?.comments)
          ? response.data.comments.length
          : 0,
      });
      return response.data;
    } catch (inboxError) {
      console.error("[youtubeStudioApi] comment inbox failed", {
        errorName: inboxError instanceof Error ? inboxError.name : "Error",
      });
      throw inboxError;
    }
  },

  async draftCommentReply(body: {
    comment_text: string;
    video_title?: string;
    channel_niche?: string;
    persona_notes?: string;
  }) {
    console.info("[youtubeStudioApi] comment draft start", {
      commentLength: (body.comment_text || "").length,
      hasNiche: Boolean(body.channel_niche),
      hasVideoTitle: Boolean(body.video_title),
    });
    try {
      const response = await apiClient.post(`${API_BASE}/comments/draft-reply`, body);
      console.info("[youtubeStudioApi] comment draft complete", {
        success: Boolean(response.data?.success),
        hasDraft: Boolean(response.data?.draft),
      });
      return response.data;
    } catch (draftError) {
      console.error("[youtubeStudioApi] comment draft failed", {
        errorName: draftError instanceof Error ? draftError.name : "Error",
      });
      throw draftError;
    }
  },

  async sendCommentReply(body: { parent_id: string; text: string; token_id?: number }) {
    console.info("[youtubeStudioApi] comment send start", {
      hasParentId: Boolean(body.parent_id),
      replyLength: (body.text || "").length,
      hasTokenId: Boolean(body.token_id),
    });
    try {
      const response = await apiClient.post(`${API_BASE}/comments/reply`, body);
      console.info("[youtubeStudioApi] comment send complete", {
        success: Boolean(response.data?.success),
        hasReplyId: Boolean(response.data?.comment_id),
      });
      return response.data;
    } catch (sendError) {
      console.error("[youtubeStudioApi] comment send failed", {
        errorName: sendError instanceof Error ? sendError.name : "Error",
      });
      throw sendError;
    }
  },

  async listCommentReplies(params: {
    parent_id: string;
    max_results?: number;
    token_id?: number;
  }) {
    console.info("[youtubeStudioApi] comment replies start", {
      hasParentId: Boolean(params.parent_id),
      maxResults: params.max_results,
      hasTokenId: Boolean(params.token_id),
    });
    try {
      const query: { parent_id: string; max_results?: number; token_id?: number } = {
        parent_id: params.parent_id,
      };
      if (params.max_results != null) {
        query.max_results = params.max_results;
      }
      if (params.token_id != null) {
        query.token_id = params.token_id;
      }
      const response = await apiClient.get(`${API_BASE}/comments/replies`, {
        params: query,
      });
      console.info("[youtubeStudioApi] comment replies complete", {
        success: Boolean(response.data?.success),
        replyCount: Array.isArray(response.data?.replies)
          ? response.data.replies.length
          : 0,
        hasParentId: true,
      });
      return response.data;
    } catch (repliesError) {
      console.error("[youtubeStudioApi] comment replies failed", {
        errorName: repliesError instanceof Error ? repliesError.name : "Error",
      });
      throw repliesError;
    }
  },

  async updateCommentReply(body: {
    comment_id: string;
    text: string;
    token_id?: number;
  }) {
    console.info("[youtubeStudioApi] comment update start", {
      hasCommentId: Boolean(body.comment_id),
      textLength: (body.text || "").length,
      hasTokenId: Boolean(body.token_id),
    });
    try {
      const response = await apiClient.put(`${API_BASE}/comments/update`, body);
      console.info("[youtubeStudioApi] comment update complete", {
        success: Boolean(response.data?.success),
        hasCommentId: Boolean(response.data?.comment_id),
      });
      return response.data;
    } catch (updateError) {
      console.error("[youtubeStudioApi] comment update failed", {
        errorName: updateError instanceof Error ? updateError.name : "Error",
      });
      throw updateError;
    }
  },

  async deleteCommentReply(params: { comment_id: string; token_id?: number }) {
    console.info("[youtubeStudioApi] comment delete start", {
      hasCommentId: Boolean(params.comment_id),
      hasTokenId: Boolean(params.token_id),
    });
    try {
      const query: { comment_id: string; token_id?: number } = {
        comment_id: params.comment_id,
      };
      if (params.token_id != null) {
        query.token_id = params.token_id;
      }
      const response = await apiClient.delete(`${API_BASE}/comments/delete`, {
        params: query,
      });
      console.info("[youtubeStudioApi] comment delete complete", {
        success: Boolean(response.data?.success),
        hasCommentId: Boolean(params.comment_id),
      });
      return response.data;
    } catch (deleteError) {
      console.error("[youtubeStudioApi] comment delete failed", {
        errorName: deleteError instanceof Error ? deleteError.name : "Error",
      });
      throw deleteError;
    }
  },

  async listChannelVideos(params?: { max_results?: number; token_id?: number }) {
    const response = await apiClient.get(`${API_BASE}/studio/videos`, { params });
    return response.data;
  },

  async listPlaylists(params?: { max_results?: number; token_id?: number }) {
    const response = await apiClient.get(`${API_BASE}/studio/playlists`, { params });
    return response.data;
  },

  async addVideoToPlaylist(body: {
    playlist_id: string;
    video_id: string;
    token_id?: number;
  }) {
    const response = await apiClient.post(`${API_BASE}/studio/playlists/add`, body);
    return response.data;
  },

  async suggestStaleRefresh(body: {
    title: string;
    description?: string;
    tags?: string[];
    niche?: string;
  }) {
    const response = await apiClient.post(`${API_BASE}/studio/stale-refresh/suggest`, body);
    return response.data;
  },

  async updateVideoMetadata(body: {
    video_id: string;
    title?: string;
    description?: string;
    tags?: string[];
    token_id?: number;
  }) {
    const response = await apiClient.post(`${API_BASE}/studio/videos/update-metadata`, body);
    return response.data;
  },

  async communityPostIdeas(body?: { niche?: string; recent_title?: string }) {
    const response = await apiClient.post(`${API_BASE}/studio/community-ideas`, body || {});
    return response.data;
  },

  async contentGapIdeas(body?: { niche?: string; recent_titles?: string[] }) {
    const response = await apiClient.post(`${API_BASE}/studio/content-gaps`, body || {});
    return response.data;
  },

  /** YouTube.Search.list by keyword — GET /api/youtube/search */
  async searchByKeyword(params: {
    q: string;
    max_results?: number;
    page_token?: string;
    token_id?: number;
    order?: string;
    event_type?: string;
    video_duration?: string;
    search_type?: string;
    upload_date?: string;
    time_zone?: string;
    video_feature?: string;
  }) {
    const response = await apiClient.get(`${API_BASE}/search`, { params });
    return response.data;
  },
};
