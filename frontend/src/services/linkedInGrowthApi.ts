import { aiApiClient } from '../api/client';

// ---------------------------------------------------------------------------
// Types — Trending Topics
// ---------------------------------------------------------------------------
export interface TrendingTopicItem {
  topic: string;
  emoji: string;
  why_now: string;
  suggested_hook: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface TrendingTopicsResponse {
  industry: string;
  trending_topics: TrendingTopicItem[];
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Network Suggestions
// ---------------------------------------------------------------------------
export interface NetworkSuggestionItem {
  name: string;
  title: string;
  company: string;
  why_connect: string;
  suggested_note: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface NetworkSuggestionsResponse {
  suggestions: NetworkSuggestionItem[];
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Engagement Opportunities
// ---------------------------------------------------------------------------
export interface EngagementOpportunityItem {
  title: string;
  author: string;
  author_context: string;
  why_engage: string;
  suggested_comment: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EngagementOpportunitiesResponse {
  opportunities: EngagementOpportunityItem[];
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Post Preview Score
// ---------------------------------------------------------------------------
export interface PostPreviewDimension {
  dimension: string;
  score: number;
  feedback: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PostPreviewScoreResponse {
  overall_score: number;
  dimensions: PostPreviewDimension[];
  top_improvement: string;
  data_source_summary: string;
  generated_at: string;
}

export interface PreviewScoreRequest {
  content: string;
  context?: string;
}

// ---------------------------------------------------------------------------
// Types — Viral Content Analysis
// ---------------------------------------------------------------------------
export interface ViralPattern {
  pattern_name: string;
  description: string;
  engagement_multiplier: string;
  example_headline: string;
  example_author: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ViralAnalysisResponse {
  industry: string;
  patterns: ViralPattern[];
  top_recommendation: string;
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Weekly Content Strategy
// ---------------------------------------------------------------------------
export interface DailyPostIdea {
  day: string;
  content_type: string;
  headline: string;
  hook: string;
  why_this_works: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface WeeklyStrategyResponse {
  theme: string;
  week_of: string;
  daily_posts: DailyPostIdea[];
  key_topics: string[];
  focus_area: string;
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Content Gap Analyzer
// ---------------------------------------------------------------------------
export interface ContentGapItem {
  gap_topic: string;
  why_gap: string;
  why_it_matters: string;
  suggested_angle: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ContentGapsResponse {
  gaps: ContentGapItem[];
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Brand Scorecard
// ---------------------------------------------------------------------------
export interface BrandDimension {
  dimension: string;
  score: number;
  feedback: string;
  data_source_detail: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BrandScorecardResponse {
  overall_score: number;
  dimensions: BrandDimension[];
  top_recommendation: string;
  data_source_summary: string;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Types — Consolidated Growth Response
// ---------------------------------------------------------------------------
export interface ConsolidatedGrowthResponse {
  trending: TrendingTopicsResponse | null;
  network_suggestions: NetworkSuggestionsResponse | null;
  engagement_opportunities: EngagementOpportunitiesResponse | null;
  viral_analysis: ViralAnalysisResponse | null;
  weekly_strategy: WeeklyStrategyResponse | null;
  content_gaps: ContentGapsResponse | null;
  brand_scorecard: BrandScorecardResponse | null;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Growth Engine API client — uses aiApiClient for longer timeout (180s)
// ---------------------------------------------------------------------------
const BASE = '/api/linkedin/growth';
const client = aiApiClient;

export const linkedInGrowthApi = {
  /** Single consolidated call that loads all growth insights at once. */
  async analyzeAll(): Promise<ConsolidatedGrowthResponse> {
    const { data } = await client.post<ConsolidatedGrowthResponse>(`${BASE}/analyze-all`);
    return data;
  },

  /** Per-card refresh endpoints — kept for individual card refresh. */
  async getTrendingTopics(): Promise<TrendingTopicsResponse> {
    const { data } = await client.post<TrendingTopicsResponse>(`${BASE}/trending`);
    return data;
  },

  async getNetworkSuggestions(): Promise<NetworkSuggestionsResponse> {
    const { data } = await client.post<NetworkSuggestionsResponse>(`${BASE}/network-suggestions`);
    return data;
  },

  async getEngagementOpportunities(): Promise<EngagementOpportunitiesResponse> {
    const { data } = await client.post<EngagementOpportunitiesResponse>(`${BASE}/engagement-opportunities`);
    return data;
  },

  async getPostPreviewScore(params: PreviewScoreRequest): Promise<PostPreviewScoreResponse> {
    const { data } = await client.post<PostPreviewScoreResponse>(`${BASE}/preview-score`, params);
    return data;
  },

  async getViralAnalysis(): Promise<ViralAnalysisResponse> {
    const { data } = await client.post<ViralAnalysisResponse>(`${BASE}/viral-analysis`);
    return data;
  },

  async getWeeklyStrategy(): Promise<WeeklyStrategyResponse> {
    const { data } = await client.post<WeeklyStrategyResponse>(`${BASE}/weekly-strategy`);
    return data;
  },

  async getContentGaps(): Promise<ContentGapsResponse> {
    const { data } = await client.post<ContentGapsResponse>(`${BASE}/content-gaps`);
    return data;
  },

  async getBrandScorecard(): Promise<BrandScorecardResponse> {
    const { data } = await client.get<BrandScorecardResponse>(`${BASE}/brand-scorecard`);
    return data;
  },
};
