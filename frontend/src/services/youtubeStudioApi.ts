import { apiClient } from "../api/client";

const API_BASE = "/api/youtube";

export function isYouTubeStudioRequestCanceled(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: string; name?: string };
  return (
    candidate.code === "ERR_CANCELED" ||
    candidate.name === "CanceledError" ||
    candidate.name === "AbortError"
  );
}

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

  async getChannelOverview(params?: {
    days?: number;
    window?: string;
    start_date?: string;
    end_date?: string;
    token_id?: number;
  }) {
    const days = params?.days;
    console.info("[youtubeStudioApi] channel overview start", {
      days,
      window: params?.window,
      hasStartDate: Boolean(params?.start_date),
      hasEndDate: Boolean(params?.end_date),
    });
    try {
      const response = await apiClient.get(`${API_BASE}/analytics/overview`, { params });
      console.info("[youtubeStudioApi] channel overview complete", {
        success: Boolean(response.data?.success),
        dayCount: Array.isArray(response.data?.views_by_day)
          ? response.data.views_by_day.length
          : 0,
        topCount: Array.isArray(response.data?.top_videos)
          ? response.data.top_videos.length
          : 0,
        latestCount: Array.isArray(response.data?.latest_videos)
          ? response.data.latest_videos.length
          : 0,
      });
      return response.data;
    } catch (overviewError) {
      console.error("[youtubeStudioApi] channel overview failed", {
        errorName: overviewError instanceof Error ? overviewError.name : "Error",
      });
      throw overviewError;
    }
  },

  async getChannelAudience(params?: {
    days?: number;
    window?: string;
    start_date?: string;
    end_date?: string;
    token_id?: number;
  }) {
    console.info("[youtubeStudioApi] channel audience start", {
      days: params?.days,
      window: params?.window,
      hasStartDate: Boolean(params?.start_date),
      hasEndDate: Boolean(params?.end_date),
    });
    try {
      const response = await apiClient.get(`${API_BASE}/analytics/audience`, { params });
      console.info("[youtubeStudioApi] channel audience complete", {
        success: Boolean(response.data?.success),
        demoCount: Array.isArray(response.data?.demographics?.rows)
          ? response.data.demographics.rows.length
          : 0,
        countryCount: Array.isArray(response.data?.countries?.rows)
          ? response.data.countries.rows.length
          : 0,
        subscribedCount: Array.isArray(response.data?.subscribed?.rows)
          ? response.data.subscribed.rows.length
          : 0,
      });
      return response.data;
    } catch (audienceError) {
      console.error("[youtubeStudioApi] channel audience failed", {
        errorName: audienceError instanceof Error ? audienceError.name : "Error",
      });
      throw audienceError;
    }
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

  async draftCommentReply(
    body: {
      comment_text: string;
      video_title?: string;
      channel_niche?: string;
      persona_notes?: string;
    },
    options?: { signal?: AbortSignal },
  ) {
    console.info("[youtubeStudioApi] comment draft start", {
      commentLength: (body.comment_text || "").length,
      hasNiche: Boolean(body.channel_niche),
      hasVideoTitle: Boolean(body.video_title),
      hasAbortSignal: Boolean(options?.signal),
    });
    try {
      const response = options?.signal
        ? await apiClient.post(`${API_BASE}/comments/draft-reply`, body, {
            signal: options.signal,
          })
        : await apiClient.post(`${API_BASE}/comments/draft-reply`, body);
      console.info("[youtubeStudioApi] comment draft complete", {
        success: Boolean(response.data?.success),
        hasDraft: Boolean(response.data?.draft),
      });
      return response.data;
    } catch (draftError) {
      if (isYouTubeStudioRequestCanceled(draftError)) {
        console.info("[youtubeStudioApi] comment draft cancelled");
        throw draftError;
      }
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

  async setCommentModerationStatus(body: {
    comment_id: string;
    ban_author: boolean;
    token_id?: number;
  }) {
    console.info("[youtubeStudioApi] comment moderate start", {
      hasCommentId: Boolean(body.comment_id),
      banAuthor: Boolean(body.ban_author),
      hasTokenId: Boolean(body.token_id),
    });
    try {
      const payload: {
        comment_id: string;
        ban_author: boolean;
        token_id?: number;
      } = {
        comment_id: body.comment_id,
        ban_author: body.ban_author,
      };
      if (body.token_id != null) {
        payload.token_id = body.token_id;
      }
      const response = await apiClient.post(`${API_BASE}/comments/moderate`, payload);
      console.info("[youtubeStudioApi] comment moderate complete", {
        success: Boolean(response.data?.success),
        banAuthor: Boolean(body.ban_author),
      });
      return response.data;
    } catch (moderateError) {
      console.error("[youtubeStudioApi] comment moderate failed", {
        errorName: moderateError instanceof Error ? moderateError.name : "Error",
      });
      throw moderateError;
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
