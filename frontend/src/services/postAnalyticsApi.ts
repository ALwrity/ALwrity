import { aiApiClient } from '../api/client';

const BASE = '/api/linkedin/posts';

export interface PostEngagementMetrics {
  reactions: number;
  comments: number;
  reposts: number;
  impressions: number;
  engagement_rate: number;
  clicks: number;
  followers_gained: number;
}

export interface PostAuthor {
  name: string;
  avatar_url?: string | null;
  headline?: string | null;
  public_identifier?: string | null;
}

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
}

export interface PostListResponse {
  posts: LinkedInPost[];
  cursor?: string | null;
  has_more: boolean;
  total_count?: number | null;
}

export interface FetchPostsParams {
  cursor?: string;
  limit?: number;
}

export const postAnalyticsApi = {
  async fetchPosts(params?: FetchPostsParams): Promise<PostListResponse> {
    const { data } = await aiApiClient.get<PostListResponse>(BASE, { params });
    return data;
  },
};
