import { apiClient } from './client';

export interface ContentOpportunity {
  type: 'Content Optimization' | 'Content Enhancement';
  keyword: string;
  opportunity: string;
  potential_impact: 'High' | 'Medium';
  current_position: number;
  current_ctr: number;
  impressions: number;
  clicks: number;
  estimated_traffic_gain: number;
  priority: 'High' | 'Medium';
  suggested_format: string;
}

export interface KeywordGap {
  keyword: string;
  position: number;
  impressions: number;
  current_ctr: number;
  clicks: number;
  estimated_traffic_if_page1: number;
  gap_from_page1: number;
}

export interface QuickWin {
  keyword: string;
  position: number;
  impressions: number;
  current_ctr: number;
  clicks: number;
  estimated_traffic_gain: number;
  reason: string;
}

export interface PageOpportunity {
  page: string;
  page_title: string;
  impressions: number;
  clicks: number;
  current_ctr: number;
  current_position: number;
  reason: string;
}

export interface AIRecommendation {
  title: string;
  keyword: string;
  reason: string;
  format: string;
  estimated_impact: string;
}

export interface AIRecommendations {
  immediate_opportunities: AIRecommendation[];
  content_strategy: AIRecommendation[];
  long_term_strategy: AIRecommendation[];
}

export interface BrainstormSummary {
  site_url: string;
  date_range: { start: string; end: string };
  total_keywords_analyzed: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  avg_position: number;
  ctr_vs_benchmark: number;
  health_score: number;
  keyword_distribution: {
    positions_1_3: number;
    positions_4_10: number;
    positions_11_20: number;
    positions_21_plus: number;
  };
  top_keywords: Array<{ keyword: string; impressions: number; clicks: number; position: number; ctr: number }>;
  top_pages: Array<{ page: string; clicks: number; impressions: number; ctr: number }>;
}

export interface BrainstormResult {
  error?: string;
  content_opportunities: ContentOpportunity[];
  keyword_gaps: KeywordGap[];
  quick_wins: QuickWin[];
  page_opportunities: PageOpportunity[];
  ai_recommendations: AIRecommendations | Record<string, never>;
  summary: BrainstormSummary | Record<string, never>;
}

class GSCBrainstormAPI {
  private baseUrl = '/gsc';
  private getAuthToken: (() => Promise<string | null>) | null = null;

  setAuthTokenGetter(getToken: () => Promise<string | null>) {
    this.getAuthToken = getToken;
  }

  private async getAuthenticatedClient() {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    if (!token) {
      throw new Error('No authentication token available');
    }
    return apiClient.create({
      headers: { Authorization: `Bearer ${token}` },
      timeout: 300000, // 5 minutes — LLM calls via wavespeed can take 2+ minutes
    });
  }

  async brainstorm(keywords: string, siteUrl?: string, forceRefresh?: boolean): Promise<BrainstormResult> {
    const client = await this.getAuthenticatedClient();
    const response = await client.post(`${this.baseUrl}/brainstorm`, {
      keywords,
      site_url: siteUrl || undefined,
      force_refresh: forceRefresh || false,
    });
    return response.data;
  }
}

export const gscBrainstormAPI = new GSCBrainstormAPI();