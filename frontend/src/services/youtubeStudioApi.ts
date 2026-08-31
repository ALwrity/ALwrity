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
    const response = await apiClient.get(`${API_BASE}/comments/inbox`, { params });
    return response.data;
  },

  async draftCommentReply(body: {
    comment_text: string;
    video_title?: string;
    channel_niche?: string;
    persona_notes?: string;
  }) {
    const response = await apiClient.post(`${API_BASE}/comments/draft-reply`, body);
    return response.data;
  },

  async sendCommentReply(body: { parent_id: string; text: string; token_id?: number }) {
    const response = await apiClient.post(`${API_BASE}/comments/reply`, body);
    return response.data;
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
  }) {
    const response = await apiClient.get(`${API_BASE}/search`, { params });
    return response.data;
  },
};
