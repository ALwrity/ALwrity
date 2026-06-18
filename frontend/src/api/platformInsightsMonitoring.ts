/**
 * Platform Insights Monitoring API Client
 * Provides typed functions for fetching platform insights (GSC/Bing) monitoring data.
 */

import { apiClient } from './client';

// TypeScript interfaces
export interface PlatformInsightsTask {
  id: number;
  platform: 'gsc' | 'bing';
  site_url: string | null;
  status: 'active' | 'failed' | 'paused';
  last_check: string | null;
  last_success: string | null;
  last_failure: string | null;
  failure_reason: string | null;
  next_check: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformInsightsStatusResponse {
  success: boolean;
  user_id: string;
  gsc_tasks: PlatformInsightsTask[];
  bing_tasks: PlatformInsightsTask[];
  total_tasks: number;
  // C2: present when the GET handler computed missing platforms without
  // auto-creating them. Empty array means the user has tasks for every
  // connected platform. The frontend can call
  // `ensurePlatformInsightsTasks` when this is non-empty.
  missing_platforms?: ('gsc' | 'bing')[];
  // C2: present on the POST response, listing what was created vs failed.
  created_platforms?: ('gsc' | 'bing')[];
  failed_platforms?: Array<{ platform: 'gsc' | 'bing'; error: string }>;
}

export interface PlatformInsightsExecutionLog {
  id: number;
  task_id: number;
  execution_date: string;
  status: 'success' | 'failed' | 'running' | 'skipped';
  result_data: any;
  error_message: string | null;
  execution_time_ms: number | null;
  data_source: 'cached' | 'api' | 'onboarding' | 'storage' | null;
  created_at: string;
}

export interface PlatformInsightsLogsResponse {
  success: boolean;
  logs: PlatformInsightsExecutionLog[];
  total_count: number;
}

/**
 * Get platform insights status for a user
 */
export const getPlatformInsightsStatus = async (
  userId: string
): Promise<PlatformInsightsStatusResponse> => {
  try {
    const response = await apiClient.get(`/api/scheduler/platform-insights/status/${userId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching platform insights status:', error);
    throw new Error(error.response?.data?.detail || 'Failed to fetch platform insights status');
  }
};

/**
 * Get execution logs for platform insights tasks
 */
export const getPlatformInsightsLogs = async (
  userId: string,
  limit: number = 10,
  taskId?: number
): Promise<PlatformInsightsLogsResponse> => {
  try {
    const params: any = { limit };
    if (taskId) {
      params.task_id = taskId;
    }
    const response = await apiClient.get(`/api/scheduler/platform-insights/logs/${userId}`, {
      params
    });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching platform insights logs:', error);
    throw new Error(error.response?.data?.detail || 'Failed to fetch platform insights logs');
  }
};

/**
 * C2: explicitly create any missing platform insights tasks. Replaces
 * the old auto-create side effect of GET /platform-insights/status.
 * Idempotent — existing tasks are not duplicated.
 */
export const ensurePlatformInsightsTasks = async (
  userId: string
): Promise<PlatformInsightsStatusResponse> => {
  try {
    const response = await apiClient.post(
      `/api/scheduler/platform-insights/${userId}/ensure-tasks`
    );
    return response.data;
  } catch (error: any) {
    console.error('Error ensuring platform insights tasks:', error);
    throw new Error(error.response?.data?.detail || 'Failed to ensure platform insights tasks');
  }
};

