import { apiClient, longRunningApiClient } from './client';

export interface SEOHealthScore {
  score: number;
  change: number;
  trend: string;
  label: string;
  color: string;
}

export interface SEOMetric {
  value: number;
  change: number;
  trend: string;
  description: string;
  color: string;
}

export interface PlatformStatus {
  status: string;
  connected: boolean;
  last_sync?: string;
  data_points?: number;
  // Additional Bing-specific properties
  has_expired_tokens?: boolean;
  last_token_date?: string;
  total_tokens?: number;
}

export interface AIInsight {
  insight: string;
  priority: string;
  category: string;
  action_required: boolean;
  tool_path?: string;
}

export interface SIFIndexingHealth {
  has_task: boolean;
  status: 'healthy' | 'warning' | 'critical' | 'not_scheduled';
  message?: string;
  task?: {
    id: number;
    website_url: string;
    raw_status: string;
    next_execution: string | null;
    last_success: string | null;
    last_failure: string | null;
    consecutive_failures: number;
    failure_pattern?: any;
  };
  last_run?: {
    status: string | null;
    time: string | null;
    error_message: string | null;
  };
}



export type OnboardingTaskStatus = 'active' | 'failed' | 'paused' | 'needs_intervention' | 'not_scheduled';

export interface OnboardingScheduledTaskHealthItem {
  label: string;
  results_key?: string | null;
  task_id?: number | null;
  task_type?: string | null;
  status: OnboardingTaskStatus;
  next_execution: string | null;
  last_success: string | null;
  last_failure: string | null;
  consecutive_failures: number;
  result_summary: string | null;
  latest_execution: {
    status: string | null;
    execution_date: string | null;
    execution_time_ms: number | null;
    error_message: string | null;
    result_summary: string | null;
  } | null;
}

export interface OnboardingScheduledTaskHealthResponse {
  status: string;
  website_url?: string | null;
  tasks: Record<string, OnboardingScheduledTaskHealthItem>;
  last_updated: string;
}

export interface SavedWebsiteAnalysis {
  id: number;
  session_id: number;
  website_url: string;
  analysis_date: string | null;
  status: string;
  warning_message?: string | null;
  crawl_result?: any;
  [key: string]: any;
}

export interface SEODashboardData {
  health_score: SEOHealthScore;
  key_insight: string;
  priority_alert: string;
  metrics: Record<string, SEOMetric>;
  platforms: Record<string, PlatformStatus>;
  ai_insights: AIInsight[];
  last_updated: string;
  website_url?: string;  // User's website URL from onboarding
  // Real data from backend
  summary?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  timeseries?: any[];
  advertools_insights?: any;
  competitor_insights?: {
    competitor_keywords: any[];
    content_gaps: any[];
    opportunity_score: number;
  };
  technical_seo_audit?: {
    status: string;
    task_status?: string | null;
    next_execution?: string | null;
    pages_audited: number;
    avg_score: number;
    fix_scheduled_pages: number;
    worst_pages: Array<{
      page_url: string;
      overall_score: number;
      status: string;
      issues_count?: number;
    }>;
    error?: string;
  };
}

// SEO Dashboard API functions
export const seoDashboardAPI = {
  // Get complete dashboard data
  async getDashboardData(): Promise<SEODashboardData> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/data');
      return response.data;
    } catch (error) {
      console.error('Error fetching SEO dashboard data:', error);
      throw error;
    }
  },

  // Get health score only
  async getHealthScore(): Promise<SEOHealthScore> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/health-score');
      return response.data;
    } catch (error) {
      console.error('Error fetching SEO health score:', error);
      throw error;
    }
  },

  // Get metrics only
  async getMetrics(): Promise<Record<string, SEOMetric>> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/metrics');
      return response.data;
    } catch (error) {
      console.error('Error fetching SEO metrics:', error);
      throw error;
    }
  },

  // Get platform status
  async getPlatformStatus(): Promise<Record<string, PlatformStatus>> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/platforms');
      return response.data;
    } catch (error) {
      console.error('Error fetching platform status:', error);
      throw error;
    }
  },

  // Get AI insights
  async getAIInsights(): Promise<AIInsight[]> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/insights');
      return response.data;
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      throw error;
    }
  },

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/health');
      return response.data;
    } catch (error) {
      console.error('Error checking SEO dashboard health:', error);
      throw error;
    }
  },

  async getSIFHealth(): Promise<SIFIndexingHealth> {
    try {
      const response = await apiClient.get('/api/seo-dashboard/sif-health');
      return response.data;
    } catch (error) {
      console.error('Error fetching SIF indexing health:', error);
      throw error;
    }
  },

  async getOnboardingTaskHealth(siteUrl?: string): Promise<OnboardingScheduledTaskHealthResponse> {
    try {
      const response = await longRunningApiClient.get('/api/seo-dashboard/onboarding-task-health', {
        params: siteUrl ? { site_url: siteUrl } : undefined
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching onboarding task health:', error);
      throw error;
    }
  },

  // Get the latest saved website analysis from onboarding (flat WebsiteAnalysis row)
  async getSavedWebsiteAnalysis(): Promise<{ success: boolean; analysis?: SavedWebsiteAnalysis; error?: string }> {
    try {
      const response = await apiClient.get('/api/onboarding/style-detection/session-analyses');
      const data = response.data;
      if (data.success && Array.isArray(data.analyses) && data.analyses.length > 0) {
        // session-analyses returns full flat rows ordered by created_at desc;
        // sort defensively and pick the most recent analysis
        const latest = [...data.analyses].sort((a, b) =>
          new Date(b.created_at || b.analysis_date || 0).getTime() -
          new Date(a.created_at || a.analysis_date || 0).getTime()
        )[0];
        if (latest) {
          return { success: true, analysis: latest as SavedWebsiteAnalysis };
        }
      }
      return { success: false, error: 'No saved website analysis found' };
    } catch (error) {
      console.error('Error fetching saved website analysis:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

}; 
