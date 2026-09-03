// Make sure to install axios: npm install axios
import { AxiosResponse } from 'axios';
import { apiClient, longRunningApiClient } from './client';
import type { WorkflowOptimizationSignals, WorkflowOutcomes } from '../types/workflow';

export type OnboardingTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface OnboardingSifIndexingDetails {
  phase?: string;
  pages_harvested?: number;
  pages_total?: number;
  sitemap_total?: number;
  harvest_source?: string;
  pages_indexed?: number;
  pillars_found?: number;
  indexed_pages?: Array<{ url: string; title?: string }>;
  log_messages?: string[];
  metadata_synced?: number;
  content_synced?: number;
  pages_analyzed?: number;
  content_gaps?: number;
}

export interface OnboardingTaskStatusEntry {
  status: OnboardingTaskStatus;
  started_at: string | null;
  progress_pct: number;
  details: OnboardingSifIndexingDetails | null;
  last_success?: string | null;
  failure_reason?: string | null;
  recurring?: boolean;
  next_execution?: string | null;
  index_freshness_hours?: number | null;
  index_stale?: boolean | null;
}

export interface OnboardingTasksStatusResponse {
  tasks: Record<string, OnboardingTaskStatusEntry>;
  total: number;
  completed_count: number;
  failed_count: number;
  all_done: boolean;
}

export async function fetchOnboardingTasksStatus(): Promise<OnboardingTasksStatusResponse> {
  const res: AxiosResponse<OnboardingTasksStatusResponse> = await longRunningApiClient.get('/api/onboarding/tasks/status');
  if (!res.data?.tasks) {
    throw new Error('Onboarding tasks status unavailable');
  }
  return res.data;
}

export interface OnboardingStepResponse {
  step: number;
  data?: any;
  validation_errors?: string[];
  detail?: string; // Error detail from HTTP responses
  message?: string; // Success message
  warnings?: string[]; // Warning messages
}

export interface OnboardingSessionResponse {
  id: number;
  user_id: number;
  current_step: number;
  progress: number;
}

export interface OnboardingProgressResponse {
  progress: number;
  current_step: number;
  total_steps: number;
  completion_percentage: number;
}

export async function startOnboarding() {
  const res: AxiosResponse<OnboardingSessionResponse> = await apiClient.post('/api/onboarding/start');
  return res.data;
}

export async function getCurrentStep() {
  // Get the current step from the onboarding status
  console.log('getCurrentStep: Calling /api/onboarding/status');
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/status');
  console.log('getCurrentStep: Backend returned:', res.data);
  return { step: res.data.current_step || 1 };
}

export async function setCurrentStep(step: number, stepData?: any) {
  // Complete the current step to move to the next one
  console.log('setCurrentStep: Completing step', step, 'with data:', stepData);
  try {
    const res: AxiosResponse<OnboardingStepResponse> = await apiClient.post(`/api/onboarding/step/${step}/complete`, {
      data: stepData || {},
      validation_errors: []
    });
    console.log('setCurrentStep: Backend response:', res.data);
    return { step, response: res.data }; // Include the full response data including warnings
  } catch (error: any) {
    // Handle HTTP errors from the backend
    console.error('setCurrentStep: Backend error:', error);
    if (error.response?.status >= 400) {
      const errorData = error.response.data;
      const errorMessage = errorData?.detail || errorData?.message || `Step completion failed with status ${error.response.status}`;
      throw new Error(errorMessage);
    }
    // Re-throw other errors
    throw error;
  }
}

export async function getProgress() {
  const res: AxiosResponse<OnboardingProgressResponse> = await apiClient.get('/api/onboarding/progress');
  return { progress: res.data.completion_percentage || 0 };
}

export async function setProgress(progress: number) {
  // Progress is managed automatically by the backend
  // This function is kept for compatibility but doesn't make a backend call
  return { progress };
}

// Additional functions for better integration
export async function getOnboardingConfig() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/config');
  return res.data;
}

export async function getStepData(stepNumber: number) {
  const res: AxiosResponse<any> = await apiClient.get(`/api/onboarding/step/${stepNumber}`);
  return res.data;
}

export async function skipStep(stepNumber: number) {
  const res: AxiosResponse<any> = await apiClient.post(`/api/onboarding/step/${stepNumber}/skip`);
  return res.data;
}

export async function completeOnboarding() {
  const res: AxiosResponse<any> = await apiClient.post('/api/onboarding/complete');
  return res.data;
}

export async function resetOnboarding() {
  const res: AxiosResponse<any> = await apiClient.post('/api/onboarding/reset');
  return res.data;
}

// New functions for FinalStep data loading
export async function getOnboardingSummary() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/summary');
  return res.data;
}

export async function getWebsiteAnalysisData() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/website-analysis');
  return res.data;
}

export async function getResearchPreferencesData() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/research-preferences');
  return res.data;
}

export async function getCompetitorAnalysis() {
  const res: AxiosResponse<any> = await apiClient.get('/api/onboarding/competitor-analysis');
  return res.data;
}

export interface SifQueryProvenance {
  query: string;
  limit?: number;
  trigger?: string;
  result_count?: number;
  outcome?: "success" | "miss" | "miss_healed" | "error";
  error?: string | null;
  heal?: { healed?: boolean; bootstrap_indexed?: number; website_sync_new?: number } | null;
  timestamp?: string;
}

export interface AgentEvidenceEntry {
  agent: string;
  evidence?: any[];
  analysis?: string;
  proposed_tasks?: any[];
  confidence?: number;
  expected_impact?: string[];
  effort?: string[];
  kpi?: string[];
  required_action_parameters?: any[];
  error?: string | null;
  declined?: boolean;
  message?: string | null;
  sif_queries?: SifQueryProvenance[];
}

export interface ProposalReviewSummary {
  counts: {
    accepted: number;
    rejected: number;
    merged: number;
    deferred: number;
    quarantined: number;
  };
  flagged: Array<{
    title?: string | null;
    agent?: string | null;
    status?: string | null;
    reasons?: string[];
  }>;
}

export interface MeetingPreflight {
  checks?: Record<string, { status?: string; message?: string; [key: string]: any }>;
  limitations?: string[];
  blocking?: boolean;
  [key: string]: any;
}

export interface PlanTransparency {
  limitations: string[];
  meeting_preflight: MeetingPreflight;
  agent_evidence: AgentEvidenceEntry[];
  proposal_review_summary: ProposalReviewSummary;
  guardian_health: number | null;
  quality_status: string | null;
  contextuality_validation: Record<string, any>;
}

export interface TodayPlanPreview extends PlanTransparency {
  date: string;
  tasks: any[];
  committee_agent_count: number;
  fallback_used: boolean;
  proposals_by_agent: Record<string, any[]>;
  template_fallback_count?: number;
  backfill_errors?: Array<{
    pillar?: string;
    title?: string;
    error?: string | null;
    reason?: string | null;
  }>;
  digest?: {
    status: string;
    reason?: string | null;
    contact_email?: string;
  };
  agent_states?: Array<{
    agent: string;
    state: "error" | "declined" | "ok";
    detail?: string | null;
  }>;
  failed_agents?: Array<{ agent: string; state: string; detail?: string | null }>;
  declined_agents?: Array<{ agent: string; state: string; detail?: string | null }>;
}

export interface RetryAgentResult extends PlanTransparency {
  success: boolean;
  agent?: string;
  proposals_by_agent?: Record<string, any[]>;
  template_fallback_count?: number;
  backfill_errors?: TodayPlanPreview["backfill_errors"];
  digest?: TodayPlanPreview["digest"];
  agent_states?: TodayPlanPreview["agent_states"];
  failed_agents?: TodayPlanPreview["failed_agents"];
  declined_agents?: TodayPlanPreview["declined_agents"];
}

export async function previewTodayPlan(force = false): Promise<TodayPlanPreview> {
  // Use long-running API client for this heavy operation
  const { longRunningApiClient } = await import('./client');
  // force=true re-runs the committee even when a plan already exists for
  // today ("Re-run preview"); without it the call is idempotent.
  const res: AxiosResponse<any> = await longRunningApiClient.post(
    '/api/today-workflow/preview',
    null,
    { params: force ? { force: true } : undefined },
  );
  return res.data?.data;
}

export async function retryTodayAgent(agentKey: string): Promise<RetryAgentResult> {
  const { longRunningApiClient } = await import('./client');
  const res: AxiosResponse<any> = await longRunningApiClient.post(`/api/today-workflow/retry-agent`, {
    agent_key: agentKey,
  });
  return res.data?.data ?? res.data;
}

export async function generateTodayPlan() {
  const res: AxiosResponse<any> = await apiClient.post('/api/today-workflow/generate');
  return res.data?.data;
}

export async function getWorkflowOutcomes(days = 30): Promise<WorkflowOutcomes> {
  const res: AxiosResponse<any> = await apiClient.get('/api/today-workflow/outcomes', {
    params: { days },
  });
  return {
    ...(res.data?.data?.outcomes || {}),
    real_outcomes: res.data?.data?.real_outcomes,
  } as WorkflowOutcomes;
}

export async function recordWorkflowTaskFeedback(
  taskId: string,
  score: -1 | 0 | 1,
  feedbackText?: string,
): Promise<void> {
  await apiClient.post(`/api/today-workflow/tasks/${encodeURIComponent(taskId)}/feedback`, {
    score,
    feedback_text: feedbackText,
  });
}

export async function getWorkflowOptimizationSignals(days = 30): Promise<WorkflowOptimizationSignals> {
  const res: AxiosResponse<any> = await apiClient.get('/api/today-workflow/optimization-signals', {
    params: { days },
  });
  return res.data?.data?.optimization;
}

export async function recordConversionEvent(event: {
  event_name: string;
  value?: number;
  currency?: string;
  source?: string;
  external_event_id?: string;
  occurred_at?: string;
  metadata?: Record<string, any>;
}): Promise<{ event_id: number | null; duplicate: boolean }> {
  const res: AxiosResponse<any> = await apiClient.post('/api/today-workflow/outcomes/conversions', event);
  return res.data?.data;
}

export interface ExecuteWorkflowTaskResult {
  task_id: string;
  status: string;
  execution: Record<string, any>;
}

export async function executeWorkflowTask(
  taskId: string,
  payload?: {
    action_type?: string;
    target_resource?: string;
    parameters?: Record<string, any>;
    expected_outcome?: string;
    risk_level?: number;
    requires_approval?: boolean;
  },
): Promise<ExecuteWorkflowTaskResult> {
  const res: AxiosResponse<any> = await apiClient.post(
    `/api/today-workflow/tasks/${encodeURIComponent(taskId)}/execute`,
    payload || {},
  );
  return res.data?.data;
}
