import { apiClient } from '../api/client';

/**
 * Typed client for the Phase 3b monitoring-health endpoints.
 *
 * Fail-fast contract (no mocks, no silent healthy defaults):
 * - Every failure throws a `MonitoringHealthError` carrying the real
 *   backend detail message and HTTP status. Callers must render the
 *   error — never substitute fabricated healthy data.
 * - Backend 404 "No execution logs yet" maps to code
 *   `awaiting-first-run` so the UI can show the truthful "scheduled,
 *   awaiting first run" info state instead of an error banner.
 */

export type MonitoringHealthStatus = 'healthy' | 'degraded' | 'down';

export interface MonitoringTaskHealth {
  id: number;
  title: string;
  metric: string;
  frequency: string;
  assignee: string;
  status: string;
  lastExecuted: string | null;
  lastResult: string | null;
  lastError: string | null;
  nextExecution: string | null;
}

export interface MonitoringHealth {
  strategy_id: number;
  status: MonitoringHealthStatus;
  totalTasks: number;
  executedTasks: number;
  successRate: number | null;
  overdueCount: number;
  byResult: Record<string, number>;
  lastExecuted: string | null;
  tasks: MonitoringTaskHealth[];
  generatedAt: string;
}

export type MonitoringHealthErrorCode =
  | 'awaiting-first-run'
  | 'not-found'
  | 'request-failed';

export class MonitoringHealthError extends Error {
  status?: number;
  code: MonitoringHealthErrorCode;

  constructor(message: string, code: MonitoringHealthErrorCode, status?: number) {
    super(message);
    this.name = 'MonitoringHealthError';
    this.code = code;
    this.status = status;
  }
}

export interface SchedulePatch {
  frequency?: string;
  status?: 'active' | 'paused';
}

function toHealthError(error: any): MonitoringHealthError {
  const status: number | undefined = error?.response?.status;
  const detail: string =
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    'Failed to load monitoring health';
  if (status === 404 && detail.toLowerCase().includes('no execution logs')) {
    return new MonitoringHealthError(detail, 'awaiting-first-run', status);
  }
  if (status === 404) {
    return new MonitoringHealthError(detail, 'not-found', status);
  }
  return new MonitoringHealthError(detail, 'request-failed', status);
}

export const monitoringHealthApi = {
  /**
   * Fetch aggregated monitoring health for a strategy.
   * Throws MonitoringHealthError on any failure — never returns stub data.
   */
  async getMonitoringHealth(strategyId: number): Promise<MonitoringHealth> {
    try {
      const response = await apiClient.get(
        `/api/content-planning/strategy/${strategyId}/monitoring-health`,
      );
      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Invalid health response');
      }
      return response.data.data as MonitoringHealth;
    } catch (error: any) {
      if (error instanceof MonitoringHealthError) throw error;
      throw toHealthError(error);
    }
  },

  /**
   * Update a task schedule (frequency and/or active/paused only).
   * Throws MonitoringHealthError with the real backend message on failure.
   */
  async updateTaskSchedule(
    strategyId: number,
    taskId: number,
    patch: SchedulePatch,
  ): Promise<{ frequency: string; status: string; nextExecution: string | null }> {
    try {
      const response = await apiClient.patch(
        `/api/content-planning/strategy/${strategyId}/tasks/${taskId}`,
        patch,
      );
      if (!response.data?.success || !response.data?.data) {
        throw new Error(response.data?.message || 'Invalid schedule response');
      }
      return response.data.data;
    } catch (error: any) {
      if (error instanceof MonitoringHealthError) throw error;
      throw toHealthError(error);
    }
  },
};
