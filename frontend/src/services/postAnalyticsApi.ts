import { apiClient } from '../api/client';

const BASE = '/api/linkedin/posts';

export interface PostEngagementMetrics {
  reactions: number;
  comments: number;
  reposts: number;
  impressions: number;
  engagement_rate: number;
  clicks: number;
  followers_gained: number;
  /** Unipile analytics.engagements — null/undefined when omitted by provider. */
  engagements?: number | null;
  /** Unipile analytics.clickthrough_rate — null/undefined when omitted. */
  clickthrough_rate?: number | null;
  /** Unipile analytics.page_viewers_from_this_post. */
  page_viewers?: number | null;
  /** Unipile members_reached / users_reached_counter. */
  reach?: number | null;
}

export interface PostAttachment {
  type?: string;
  url?: string;
  unavailable?: boolean;
  title?: string;
}

export interface PostAuthor {
  name: string;
  avatar_url?: string | null;
  headline?: string | null;
  public_identifier?: string | null;
}

export type PerformanceContentType =
  | "post"
  | "article"
  | "carousel"
  | "video_script";

export interface LinkedInPost {
  id: string;
  social_id?: string | null;
  text: string;
  title?: string | null;
  created_at: string;
  engagement: PostEngagementMetrics;
  author: PostAuthor;
  share_url?: string | null;
  is_repost: boolean;
  is_company_post: boolean;
  user_reacted?: string | null;
  attachments?: PostAttachment[];
  /** Persisted at sync time — prefer over client inference when present. */
  content_type?: PerformanceContentType | null;
}

export interface PostListResponse {
  posts: LinkedInPost[];
  cursor?: string | null;
  has_more: boolean;
  total_count?: number | null;
  last_synced_at?: string | null;
}

export interface FetchPostsParams {
  cursor?: string;
  limit?: number;
  refresh?: boolean;
}

// ── Engagement Trends ──────────────────────────────────────────────────

export interface MetricDelta {
  before: number;
  now: number;
  delta: number;
  pct_change: number;
}

export interface PostDelta {
  post_id: string;
  /** Unipile social_id — required for list/reply comments API (Phase 2+). */
  social_id?: string | null;
  text: string;
  author_name: string;
  share_url: string | null;
  reactions_delta: number;
  comments_delta: number;
  impressions_delta: number;
  engagement_rate_now: number;
  engagement_rate_before: number;
  /** Share of total positive engagement growth (top gainers only). */
  growth_contribution_pct?: number | null;
  /** Optional until Phase 2 history API includes these fields. */
  followers_delta?: number | null;
  clicks_delta?: number | null;
  reposts_delta?: number | null;
  impressions_now?: number | null;
  reactions_now?: number | null;
}

export interface EngagementSummary {
  total_posts: number;
  reactions: MetricDelta;
  comments: MetricDelta;
  impressions: MetricDelta;
  avg_engagement_rate_before: number;
  avg_engagement_rate_now: number;
  /** Optional until Phase 2 history API includes these fields. */
  followers?: MetricDelta | null;
  clicks?: MetricDelta | null;
  reposts?: MetricDelta | null;
}

export interface PostAnalyticsHistoryResponse {
  period: { from: string; to: string };
  summary: EngagementSummary;
  top_gainers: PostDelta[];
  top_decliners: PostDelta[];
  /** ISO timestamp of the last successful LinkedIn analytics sync. */
  last_synced_at?: string | null;
  /** Optional until Phase 2 returns explicit Top / Rising / Falling lists. */
  top_posts?: PostDelta[] | null;
  rising_posts?: PostDelta[] | null;
  falling_posts?: PostDelta[] | null;
  period_key?: string | null;
  baseline_reason?: string | null;
  recommended_sync_cooldown_seconds?: number | null;
}

export const postAnalyticsApi = {
  async fetchPosts(params?: FetchPostsParams): Promise<PostListResponse> {
    const { data } = await apiClient.get<PostListResponse>(BASE, { params });
    return data;
  },

  /** Fetch cached post analytics from the workspace DB.
   *  Pass refresh=true to trigger a fresh sync from Unipile first. */
  async fetchStoredAnalytics(refresh = false): Promise<PostListResponse> {
    const { data } = await apiClient.get<PostListResponse>('/api/linkedin/post-analytics', {
      params: { refresh },
    });
    return data;
  },

  /** Fetch engagement trends for a period window (Phase 2+). */
  async fetchEngagementHistory(
    period: string = 'since_joining',
  ): Promise<PostAnalyticsHistoryResponse> {
    const { data } = await apiClient.get<PostAnalyticsHistoryResponse>(
      '/api/linkedin/post-analytics/history',
      { params: { period } },
    );
    return data;
  },
};
